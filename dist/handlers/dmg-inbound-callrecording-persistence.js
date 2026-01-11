"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const config_1 = require("../config");
const crypto_1 = require("crypto");
const s3Client = new client_s3_1.S3Client({ region: config_1.config.aws.region });
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config_1.config.aws.region });
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
/**
 * Lambda 2: dmg-inbound-callrecording-persistance
 * Triggered by SQS queue (subscribed to S3 event notifications)
 * Reads Bedrock custom output results from S3 and persists to DynamoDB
 */
const handler = async (event) => {
    console.warn('Lambda dmg-inbound-callrecording-persistance started');
    console.warn(`Processing ${event.Records.length} SQS messages`);
    for (const record of event.Records) {
        try {
            // Parse SQS message body (contains S3 event notification)
            const s3Event = JSON.parse(record.body);
            // Handle both direct S3 events and SNS-wrapped S3 events
            const s3Records = s3Event.Records ||
                (s3Event.Message ? JSON.parse(s3Event.Message).Records : []);
            for (const s3Record of s3Records) {
                const bucket = s3Record.s3.bucket.name;
                const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
                console.warn(`Processing S3 object: s3://${bucket}/${key}`);
                // Only process results.json files
                if (!key.endsWith('results.json')) {
                    console.warn(`Skipping non-results file: ${key}`);
                    continue;
                }
                // Extract call ID from S3 key path (e.g., "call-123/results.json" -> "call-123")
                const callId = key.split('/')[0];
                // Get the results file from S3
                console.warn(`Fetching Bedrock custom output from S3: ${key}`);
                const getCommand = new client_s3_1.GetObjectCommand({
                    Bucket: bucket,
                    Key: key,
                });
                const s3Response = await s3Client.send(getCommand);
                if (!s3Response.Body) {
                    throw new Error('Empty response body from S3');
                }
                // Parse the Bedrock custom output results
                const bodyString = await s3Response.Body.transformToString();
                const analytics = JSON.parse(bodyString);
                console.warn('Successfully parsed Bedrock custom output');
                console.warn(`Call Summary: ${analytics.call_summary?.substring(0, 100)}...`);
                // Generate hash for the record
                const hash = (0, crypto_1.createHash)('md5').update(callId).digest('hex');
                const timestamp = Date.now();
                // Prepare DynamoDB record
                const dbRecord = {
                    hash,
                    epchdatetimestamp: timestamp,
                    call_id: callId,
                    s3_input_uri: `s3://${config_1.config.s3.inputBucket}/${callId}`, // Reconstruct from call ID
                    s3_output_uri: `s3://${bucket}/${callId}/`,
                    bedrock_invocation_arn: undefined, // Not available in this flow
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
                console.warn(`Persisting record to DynamoDB: ${config_1.config.dynamodb.tableName}`);
                console.warn(`Hash: ${hash}, Call ID: ${callId}`);
                // Write to DynamoDB
                const putCommand = new lib_dynamodb_1.PutCommand({
                    TableName: config_1.config.dynamodb.tableName,
                    Item: dbRecord,
                });
                await docClient.send(putCommand);
                console.warn(`Successfully persisted record for call: ${callId}`);
            }
        }
        catch (error) {
            console.error(`Error processing SQS message: ${error}`);
            // Re-throw to allow SQS retry mechanism
            throw error;
        }
    }
    console.warn('Lambda dmg-inbound-callrecording-persistance completed');
};
exports.handler = handler;
//# sourceMappingURL=dmg-inbound-callrecording-persistence.js.map