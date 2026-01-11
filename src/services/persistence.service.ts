import { SQSEvent } from 'aws-lambda';
import { S3Repository } from '../repositories/s3.repository';
import { DynamoDBRepository } from '../repositories/dynamodb.repository';
import { Logger } from '../utils/logger';
import { generateCallIdHash } from '../utils/hash';
import { extractCallIdFromS3Key } from '../utils/validators';
import { CallRecordingRecord } from '../types';
import { config } from '../config';

interface S3EventRecord {
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventTime: string;
  eventName: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

/**
 * Service for persisting Bedrock transcription results
 * Business logic for Lambda 2: dmg-inbound-callrecording-persistence
 */
export class PersistenceService {
  private s3Repo: S3Repository;
  private dynamoRepo: DynamoDBRepository;
  private logger: Logger;

  constructor() {
    this.s3Repo = new S3Repository();
    this.dynamoRepo = new DynamoDBRepository();
    this.logger = new Logger('PersistenceService');
  }

  /**
   * Process SQS messages containing S3 event notifications
   */
  async processPersistenceRequests(event: SQSEvent): Promise<void> {
    this.logger.info('Processing persistence requests', {
      messageCount: event.Records.length,
    });

    for (const record of event.Records) {
      try {
        await this.processPersistenceRequest(record.body);
      } catch (error) {
        this.logger.error('Failed to process persistence request', error);
        throw error; // Re-throw to trigger SQS retry
      }
    }

    this.logger.info('Completed processing all persistence requests');
  }

  /**
   * Process a single persistence request
   */
  private async processPersistenceRequest(messageBody: string): Promise<void> {
    // Parse SQS message body (contains S3 event notification)
    const s3Event = JSON.parse(messageBody);

    // Handle both direct S3 events and SNS-wrapped S3 events
    const s3Records: S3EventRecord[] =
      s3Event.Records || (s3Event.Message ? JSON.parse(s3Event.Message).Records : []);

    for (const s3Record of s3Records) {
      await this.processS3Event(s3Record);
    }
  }

  /**
   * Process a single S3 event
   */
  private async processS3Event(s3Record: S3EventRecord): Promise<void> {
    const bucket = s3Record.s3.bucket.name;
    const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));

    this.logger.info('Processing S3 object', { bucket, key });

    // Only process result.json files (Bedrock custom output)
    if (!key.endsWith('result.json')) {
      this.logger.info('Skipping non-result file', { key });
      return;
    }

    // Extract call ID from S3 key path
    const callId = extractCallIdFromS3Key(key);
    if (!callId) {
      throw new Error(`Could not extract call ID from S3 key: ${key}`);
    }

    // Fetch Bedrock result from S3
    const bedrockResult = await this.s3Repo.getBedrockResult(bucket, key);
    const analytics = bedrockResult.inference_result;

    this.logger.info('Successfully parsed Bedrock output', {
      callId,
      hasSummary: !!analytics.call_summary,
      topicsCount: analytics.topics?.length || 0,
    });

    // Generate hash and prepare DynamoDB record
    const hash = generateCallIdHash(callId);
    const timestamp = Date.now();

    const dbRecord: CallRecordingRecord = {
      hash,
      epchdatetimestamp: timestamp,
      call_id: callId,
      s3_input_uri: `s3://${config.s3.inputBucket}/${callId}`,
      s3_output_uri: `s3://${bucket}/${callId}/`,
      bedrock_invocation_arn: undefined,
      bedrock_status: 'SUCCESS',
      call_summary: analytics.call_summary,
      call_categories: analytics.call_categories,
      topics: analytics.topics,
      transcript: analytics.transcript,
      audio_summary: analytics.audio_summary,
      topic_summary: analytics.topic_summary,
      created_at: new Date(timestamp).toISOString(),
      updated_at: new Date(timestamp).toISOString(),
    };

    // Save to DynamoDB
    await this.dynamoRepo.saveRecord(dbRecord);

    this.logger.info('Successfully persisted record', {
      hash,
      callId,
    });
  }
}
