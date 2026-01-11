import { SQSEvent, SQSHandler } from 'aws-lambda';
import {
  BedrockDataAutomationRuntimeClient,
  InvokeDataAutomationAsyncCommand,
} from '@aws-sdk/client-bedrock-data-automation-runtime';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { SnsMessage, SqsMessageBody } from '../types';

const runtimeClient = new BedrockDataAutomationRuntimeClient({
  region: config.aws.region,
});

/**
 * Lambda 1: dmg-inbound-callrecording-transcription
 * Triggered by SQS queue (subscribed to SNS topic)
 * Processes audio files through Bedrock Data Automation Runtime
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.warn('Lambda dmg-inbound-callrecording-transcription started');
  console.warn(`Processing ${event.Records.length} SQS messages`);
  console.warn(`Project ARN: ${config.bedrock.projectArn}`);
  console.warn(`Blueprint Stage: ${config.bedrock.blueprintStage}`);
  console.warn(`Profile ARN: ${config.bedrock.profileArn}`);

  for (const record of event.Records) {
    try {
      // Parse SQS message body (contains SNS message)
      const sqsBody: SqsMessageBody = JSON.parse(record.body);

      // Parse the actual SNS message
      const snsMessage: SnsMessage = JSON.parse(sqsBody.Message);

      console.warn(`\n=== Processing Call ===`);
      console.warn(`Call ID: ${snsMessage.callId}`);
      console.warn(`Audio S3 URI: ${snsMessage.audioS3Uri}`);

      // Validate required fields
      if (!snsMessage.audioS3Uri || !snsMessage.callId) {
        console.error('Missing required fields in SNS message');
        throw new Error('Missing audioS3Uri or callId in message');
      }

      // Construct output S3 URI based on call ID
      const outputS3Uri = `s3://${config.s3.outputBucket}/${config.s3.outputPrefix}/${snsMessage.callId}/`;

      console.warn(`\n=== Bedrock Invocation ===`);
      console.warn(`Input:  ${snsMessage.audioS3Uri}`);
      console.warn(`Output: ${outputS3Uri}`);

      // Generate unique client token for idempotency
      const clientToken = randomUUID();
      console.warn(`Client Token: ${clientToken}`);

      // Invoke Bedrock Data Automation asynchronously
      const command = new InvokeDataAutomationAsyncCommand({
        clientToken,
        inputConfiguration: {
          s3Uri: snsMessage.audioS3Uri,
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

      const response = await runtimeClient.send(command);

      console.warn(`\n✅ Bedrock invocation successful`);
      console.warn(`Invocation ARN: ${response.invocationArn}`);
      console.warn(`Bedrock will process audio and write results to: ${outputS3Uri}`);
    } catch (error) {
      console.error(`\n❌ Error processing SQS message: ${error}`);
      console.error(`Error details:`, error);
      // Re-throw to allow SQS retry mechanism
      throw error;
    }
  }

  console.warn('\n=== Lambda dmg-inbound-callrecording-transcription completed ===');
};
