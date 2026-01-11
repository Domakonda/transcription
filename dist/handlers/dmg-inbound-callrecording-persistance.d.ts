import { SQSHandler } from 'aws-lambda';
/**
 * Lambda 2: dmg-inbound-callrecording-persistance
 * Triggered by SQS queue (subscribed to S3 event notifications)
 * Reads Bedrock custom output results from S3 and persists to DynamoDB
 */
export declare const handler: SQSHandler;
//# sourceMappingURL=dmg-inbound-callrecording-persistance.d.ts.map