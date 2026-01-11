import { SQSEvent, SQSHandler } from 'aws-lambda';
import {
  BedrockDataAutomationClient,
  InvokeDataAutomationAsyncCommand,
} from '@aws-sdk/client-bedrock-data-automation';
import { config } from '../../../../com_library/config';
import { SnsMessage, SqsMessageBody } from '../../../../com_library/types';

const bedrockClient = new BedrockDataAutomationClient({ region: config.aws.region });

/**
 * Lambda 1: dmg-inbound-callrecording-materialization
 * Triggered by SQS queue (subscribed to SNS topic)
 * Materializes/invokes Bedrock Data Automation to process audio files
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.warn('Lambda dmg-inbound-callrecording-materialization started');
  console.warn(`Processing ${event.Records.length} SQS messages`);

  for (const record of event.Records) {
    try {
      // Parse SQS message body (contains SNS message)
      const sqsBody: SqsMessageBody = JSON.parse(record.body);

      // Parse the actual SNS message
      const snsMessage: SnsMessage = JSON.parse(sqsBody.Message);

      console.warn(`Processing call: ${snsMessage.callId}`);
      console.warn(`Audio S3 URI: ${snsMessage.audioS3Uri}`);

      // Validate required fields
      if (!snsMessage.audioS3Uri || !snsMessage.callId) {
        console.error('Missing required fields in SNS message');
        throw new Error('Missing audioS3Uri or callId in message');
      }

      // Construct output S3 URI based on call ID
      const outputS3Uri = `s3://${config.s3.outputBucket}/${snsMessage.callId}/`;

      console.warn(`Invoking Bedrock Data Automation`);
      console.warn(`Input: ${snsMessage.audioS3Uri}`);
      console.warn(`Output: ${outputS3Uri}`);

      // Invoke Bedrock Data Automation asynchronously
      const command = new InvokeDataAutomationAsyncCommand({
        dataAutomationConfiguration: {
          dataAutomationArn: config.bedrock.projectArn,
          stage: 'LIVE',
        },
        inputConfiguration: {
          s3Uri: snsMessage.audioS3Uri,
        },
        outputConfiguration: {
          s3Uri: outputS3Uri,
        },
      });

      const response = await bedrockClient.send(command);

      console.warn(`Bedrock invocation successful`);
      console.warn(`Invocation ARN: ${response.invocationArn}`);
      console.warn(`Bedrock will write results to: ${outputS3Uri}`);
    } catch (error) {
      console.error(`Error processing SQS message: ${error}`);
      // Re-throw to allow SQS retry mechanism
      throw error;
    }
  }

  console.warn('Lambda dmg-inbound-callrecording-materialization completed');
};