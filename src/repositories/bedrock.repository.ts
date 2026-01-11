import {
  BedrockDataAutomationRuntimeClient,
  InvokeDataAutomationAsyncCommand,
} from '@aws-sdk/client-bedrock-data-automation-runtime';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { Logger } from '../utils/logger';

/**
 * Repository for AWS Bedrock Data Automation operations
 */
export class BedrockRepository {
  private client: BedrockDataAutomationRuntimeClient;
  private logger: Logger;

  constructor() {
    this.client = new BedrockDataAutomationRuntimeClient({
      region: config.aws.region,
    });
    this.logger = new Logger('BedrockRepository');
  }

  /**
   * Invoke Bedrock Data Automation for audio transcription
   */
  async invokeDataAutomation(
    audioS3Uri: string,
    outputS3Uri: string
  ): Promise<{ invocationArn: string; clientToken: string }> {
    const clientToken = randomUUID();

    this.logger.info('Invoking Bedrock Data Automation', {
      inputUri: audioS3Uri,
      outputUri: outputS3Uri,
      clientToken,
    });

    const command = new InvokeDataAutomationAsyncCommand({
      clientToken,
      inputConfiguration: {
        s3Uri: audioS3Uri,
      },
      outputConfiguration: {
        s3Uri: outputS3Uri,
      },
      dataAutomationConfiguration: {
        dataAutomationProjectArn: config.bedrock.projectArn,
        stage: config.bedrock.blueprintStage as 'DEVELOPMENT' | 'LIVE',
      },
      dataAutomationProfileArn: config.bedrock.profileArn,
    });

    const response = await this.client.send(command);

    this.logger.info('Bedrock invocation successful', {
      invocationArn: response.invocationArn,
    });

    return {
      invocationArn: response.invocationArn || '',
      clientToken,
    };
  }
}
