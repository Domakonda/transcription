import { SQSEvent } from 'aws-lambda';
import { BedrockRepository } from '../repositories/bedrock.repository';
import { Logger } from '../utils/logger';
import { validateS3Uri, validateCallId } from '../utils/validators';
import { config } from '../config';
import { SnsMessage, SqsMessageBody } from '../types';

/**
 * Service for handling transcription requests
 * Business logic for Lambda 1: dmg-inbound-callrecording-transcription
 */
export class TranscriptionService {
  private bedrockRepo: BedrockRepository;
  private logger: Logger;

  constructor() {
    this.bedrockRepo = new BedrockRepository();
    this.logger = new Logger('TranscriptionService');
  }

  /**
   * Process SQS messages containing transcription requests
   */
  async processTranscriptionRequests(event: SQSEvent): Promise<void> {
    this.logger.info('Processing transcription requests', {
      messageCount: event.Records.length,
    });

    for (const record of event.Records) {
      try {
        await this.processTranscriptionRequest(record.body);
      } catch (error) {
        this.logger.error('Failed to process transcription request', error);
        throw error; // Re-throw to trigger SQS retry
      }
    }

    this.logger.info('Completed processing all transcription requests');
  }

  /**
   * Process a single transcription request
   */
  private async processTranscriptionRequest(messageBody: string): Promise<void> {
    // Parse SQS message body (contains SNS message)
    const sqsBody: SqsMessageBody = JSON.parse(messageBody);

    // Parse the actual SNS message
    const snsMessage: SnsMessage = JSON.parse(sqsBody.Message);

    this.logger.info('Processing transcription request', {
      callId: snsMessage.callId,
      audioS3Uri: snsMessage.audioS3Uri,
    });

    // Validate input
    this.validateTranscriptionInput(snsMessage);

    // Construct output S3 URI
    const outputS3Uri = `s3://${config.s3.outputBucket}/${config.s3.outputPrefix}/${snsMessage.callId}/`;

    // Invoke Bedrock Data Automation
    const result = await this.bedrockRepo.invokeDataAutomation(
      snsMessage.audioS3Uri,
      outputS3Uri
    );

    this.logger.info('Transcription job submitted successfully', {
      callId: snsMessage.callId,
      invocationArn: result.invocationArn,
      outputUri: outputS3Uri,
    });
  }

  /**
   * Validate transcription input
   */
  private validateTranscriptionInput(message: SnsMessage): void {
    if (!validateCallId(message.callId)) {
      throw new Error(`Invalid call ID: ${message.callId}`);
    }

    if (!validateS3Uri(message.audioS3Uri)) {
      throw new Error(`Invalid S3 URI: ${message.audioS3Uri}`);
    }
  }
}
