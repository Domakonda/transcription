import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { CallRecordingRecord } from '../types';

/**
 * Repository for AWS DynamoDB operations
 */
export class DynamoDBRepository {
  private docClient: DynamoDBDocumentClient;
  private logger: Logger;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: config.aws.region });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = config.dynamodb.tableName;
    this.logger = new Logger('DynamoDBRepository');
  }

  /**
   * Save a call recording record to DynamoDB
   */
  async saveRecord(record: CallRecordingRecord): Promise<void> {
    this.logger.info('Saving record to DynamoDB', {
      hash: record.hash,
      callId: record.call_id,
    });

    const command = new PutCommand({
      TableName: this.tableName,
      Item: record,
    });

    await this.docClient.send(command);

    this.logger.info('Successfully saved record to DynamoDB');
  }

  /**
   * Query records by hash (partition key)
   */
  async queryByHash(
    hash: string,
    options?: {
      limit?: number;
      exclusiveStartKey?: any;
      scanIndexForward?: boolean;
    }
  ): Promise<{
    items: CallRecordingRecord[];
    lastEvaluatedKey?: any;
  }> {
    this.logger.info('Querying records by hash', { hash, options });

    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: '#hash = :hash',
      ExpressionAttributeNames: {
        '#hash': 'hash',
      },
      ExpressionAttributeValues: {
        ':hash': hash,
      },
      ScanIndexForward: options?.scanIndexForward ?? false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.exclusiveStartKey,
    });

    const response = await this.docClient.send(command);

    this.logger.info('Query completed', { count: response.Items?.length || 0 });

    return {
      items: (response.Items as CallRecordingRecord[]) || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  }

  /**
   * Scan all records with pagination
   */
  async scanRecords(options?: {
    limit?: number;
    exclusiveStartKey?: any;
  }): Promise<{
    items: CallRecordingRecord[];
    lastEvaluatedKey?: any;
  }> {
    this.logger.info('Scanning all records', { options });

    const command = new ScanCommand({
      TableName: this.tableName,
      Limit: options?.limit,
      ExclusiveStartKey: options?.exclusiveStartKey,
    });

    const response = await this.docClient.send(command);

    this.logger.info('Scan completed', { count: response.Items?.length || 0 });

    return {
      items: (response.Items as CallRecordingRecord[]) || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  }
}
