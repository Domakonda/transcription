"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_bedrock_data_automation_runtime_1 = require("@aws-sdk/client-bedrock-data-automation-runtime");
const crypto_1 = require("crypto");
const config_1 = require("../config");
const runtimeClient = new client_bedrock_data_automation_runtime_1.BedrockDataAutomationRuntimeClient({
    region: config_1.config.aws.region,
});
/**
 * Lambda 1: dmg-inbound-callrecording-transcription
 * Triggered by SQS queue (subscribed to SNS topic)
 * Processes audio files through Bedrock Data Automation Runtime
 */
const handler = async (event) => {
    console.warn('Lambda dmg-inbound-callrecording-transcription started');
    console.warn(`Processing ${event.Records.length} SQS messages`);
    console.warn(`Project ARN: ${config_1.config.bedrock.projectArn}`);
    console.warn(`Blueprint Stage: ${config_1.config.bedrock.blueprintStage}`);
    console.warn(`Profile ARN: ${config_1.config.bedrock.profileArn}`);
    for (const record of event.Records) {
        try {
            // Parse SQS message body (contains SNS message)
            const sqsBody = JSON.parse(record.body);
            // Parse the actual SNS message
            const snsMessage = JSON.parse(sqsBody.Message);
            console.warn(`\n=== Processing Call ===`);
            console.warn(`Call ID: ${snsMessage.callId}`);
            console.warn(`Audio S3 URI: ${snsMessage.audioS3Uri}`);
            // Validate required fields
            if (!snsMessage.audioS3Uri || !snsMessage.callId) {
                console.error('Missing required fields in SNS message');
                throw new Error('Missing audioS3Uri or callId in message');
            }
            // Construct output S3 URI based on call ID
            const outputS3Uri = `s3://${config_1.config.s3.outputBucket}/${config_1.config.s3.outputPrefix}/${snsMessage.callId}/`;
            console.warn(`\n=== Bedrock Invocation ===`);
            console.warn(`Input:  ${snsMessage.audioS3Uri}`);
            console.warn(`Output: ${outputS3Uri}`);
            // Generate unique client token for idempotency
            const clientToken = (0, crypto_1.randomUUID)();
            console.warn(`Client Token: ${clientToken}`);
            // Invoke Bedrock Data Automation asynchronously
            const command = new client_bedrock_data_automation_runtime_1.InvokeDataAutomationAsyncCommand({
                clientToken,
                inputConfiguration: {
                    s3Uri: snsMessage.audioS3Uri,
                },
                outputConfiguration: {
                    s3Uri: outputS3Uri,
                },
                dataAutomationConfiguration: {
                    dataAutomationProjectArn: config_1.config.bedrock.projectArn,
                    stage: config_1.config.bedrock.blueprintStage,
                },
                dataAutomationProfileArn: config_1.config.bedrock.profileArn,
            });
            const response = await runtimeClient.send(command);
            console.warn(`\n✅ Bedrock invocation successful`);
            console.warn(`Invocation ARN: ${response.invocationArn}`);
            console.warn(`Bedrock will process audio and write results to: ${outputS3Uri}`);
        }
        catch (error) {
            console.error(`\n❌ Error processing SQS message: ${error}`);
            console.error(`Error details:`, error);
            // Re-throw to allow SQS retry mechanism
            throw error;
        }
    }
    console.warn('\n=== Lambda dmg-inbound-callrecording-transcription completed ===');
};
exports.handler = handler;
//# sourceMappingURL=dmg-inbound-callrecording-transcription.js.map