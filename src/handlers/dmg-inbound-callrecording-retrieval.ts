import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RetrievalService } from '../services/retrieval.service';

/**
 * Lambda handler for retrieval requests from API Gateway
 * Retrieves analytics data from DynamoDB and passes to UI
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const service = new RetrievalService();
  return await service.handleRetrievalRequest(event);
};
