import { SQSHandler, SQSEvent } from 'aws-lambda';
import { PersistenceService } from '../services/persistence.service';

/**
 * Lambda handler for persistence requests from SQS
 * Reads Bedrock custom output results from S3 and persists to DynamoDB
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const service = new PersistenceService();
  await service.processPersistenceRequests(event);
};
