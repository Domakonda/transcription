import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBRepository } from '../repositories/dynamodb.repository';
import { Logger } from '../utils/logger';
import { generateCallIdHash } from '../utils/hash';
import { config } from '../config';

/**
 * Service for retrieving call recording analytics
 * Business logic for Lambda 3: dmg-inbound-callrecording-retrieval
 */
export class RetrievalService {
  private dynamoRepo: DynamoDBRepository;
  private logger: Logger;

  constructor() {
    this.dynamoRepo = new DynamoDBRepository();
    this.logger = new Logger('RetrievalService');
  }

  /**
   * Build CORS headers for API responses
   */
  private getCorsHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };
  }

  /**
   * Handle API Gateway retrieval requests
   */
  async handleRetrievalRequest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Handling retrieval request', {
      httpMethod: event.httpMethod,
      path: event.path,
    });

    try {
      // Get hash or callId from parameters
      const hash = event.pathParameters?.hash || event.queryStringParameters?.hash;
      const callId = event.queryStringParameters?.callId;

      // Get pagination parameters
      const pagination = this.parsePaginationParams(event.queryStringParameters);

      // If no hash or callId, return recent records
      if (!hash && !callId) {
        return await this.listRecentRecords(pagination);
      }

      // Convert callId to hash if provided
      const searchHash = callId && !hash ? generateCallIdHash(callId) : hash!;

      // Query records by hash
      return await this.getRecordsByHash(searchHash, pagination);
    } catch (error) {
      this.logger.error('Error processing retrieval request', error);

      return {
        statusCode: 500,
        headers: this.getCorsHeaders(),
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        }),
      };
    }
  }

  /**
   * Get records by hash with pagination
   */
  private async getRecordsByHash(
    hash: string,
    pagination: PaginationParams
  ): Promise<APIGatewayProxyResult> {
    this.logger.info('Querying records by hash', { hash, pagination });

    const result = await this.dynamoRepo.queryByHash(hash, {
      limit: pagination.pageSize,
      exclusiveStartKey: pagination.exclusiveStartKey,
      scanIndexForward: false,
    });

    if (result.items.length === 0) {
      return {
        statusCode: 404,
        headers: this.getCorsHeaders(),
        body: JSON.stringify({
          error: 'No records found',
          message: 'No call recording analytics found for the given hash',
          searchedHash: hash,
        }),
      };
    }

    const nextToken = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      statusCode: 200,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        message: 'Call recording analytics retrieved successfully',
        count: result.items.length,
        items: result.items,
        pagination: {
          pageSize: pagination.pageSize,
          nextToken,
          hasMore: !!result.lastEvaluatedKey,
        },
      }),
    };
  }

  /**
   * List recent records with pagination
   */
  private async listRecentRecords(pagination: PaginationParams): Promise<APIGatewayProxyResult> {
    this.logger.info('Listing recent records', { pagination });

    const result = await this.dynamoRepo.scanRecords({
      limit: pagination.pageSize,
      exclusiveStartKey: pagination.exclusiveStartKey,
    });

    const nextToken = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      statusCode: 200,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        message: 'Recent call recordings retrieved successfully',
        count: result.items.length,
        items: result.items,
        pagination: {
          pageSize: pagination.pageSize,
          nextToken,
          hasMore: !!result.lastEvaluatedKey,
        },
      }),
    };
  }

  /**
   * Parse pagination parameters from query string
   */
  private parsePaginationParams(
    queryParams: { [key: string]: string | undefined } | null
  ): PaginationParams {
    const pageSizeParam = queryParams?.pageSize;
    const nextTokenParam = queryParams?.nextToken;

    // Parse and validate page size
    let pageSize = config.pagination.defaultPageSize;
    if (pageSizeParam) {
      const parsedSize = parseInt(pageSizeParam, 10);
      if (!isNaN(parsedSize) && parsedSize > 0) {
        pageSize = Math.min(parsedSize, config.pagination.maxPageSize);
      }
    }

    // Parse nextToken (base64 encoded LastEvaluatedKey)
    let exclusiveStartKey;
    if (nextTokenParam) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextTokenParam, 'base64').toString('utf-8'));
      } catch (err) {
        this.logger.warn('Invalid nextToken, ignoring', { nextTokenParam });
      }
    }

    return { pageSize, exclusiveStartKey };
  }
}

interface PaginationParams {
  pageSize: number;
  exclusiveStartKey?: any;
}
