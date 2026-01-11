import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { BedrockResult } from '../types';

/**
 * Repository for AWS S3 operations
 */
export class S3Repository {
  private client: S3Client;
  private logger: Logger;

  constructor() {
    this.client = new S3Client({ region: config.aws.region });
    this.logger = new Logger('S3Repository');
  }

  /**
   * Get Bedrock result JSON from S3
   */
  async getBedrockResult(bucket: string, key: string): Promise<BedrockResult> {
    this.logger.info('Fetching Bedrock result from S3', { bucket, key });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    const bodyString = await response.Body.transformToString();
    const result: BedrockResult = JSON.parse(bodyString);

    this.logger.info('Successfully fetched and parsed Bedrock result');

    return result;
  }

  /**
   * Get object from S3 as string
   */
  async getObject(bucket: string, key: string): Promise<string> {
    this.logger.info('Fetching object from S3', { bucket, key });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    return await response.Body.transformToString();
  }
}
