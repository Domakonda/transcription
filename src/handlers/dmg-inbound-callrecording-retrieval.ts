import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: config.aws.region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lambda 3: dmg-inbound-callrecording-retrieval
 * Triggered by API Gateway from UI
 * Retrieves analytics data from DynamoDB and passes to UI
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.warn('Lambda dmg-inbound-callrecording-retrieval invoked');
  console.warn(`HTTP Method: ${event.httpMethod}`);
  console.warn(`Path: ${event.path}`);
  console.warn(`Query params: ${JSON.stringify(event.queryStringParameters)}`);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  try {
    // Get hash or callId from path or query parameters
    const hash = event.pathParameters?.hash || event.queryStringParameters?.hash;
    const callId = event.queryStringParameters?.callId;

    // Pagination parameters
    const pageSizeParam = event.queryStringParameters?.pageSize;
    const nextTokenParam = event.queryStringParameters?.nextToken;

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
        console.warn(`Resuming pagination from: ${JSON.stringify(exclusiveStartKey)}`);
      } catch (err) {
        console.error(`Invalid nextToken: ${err}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid pagination token',
            message: 'The nextToken parameter is malformed or expired',
          }),
        };
      }
    }

    // If callId is provided, convert it to hash
    let searchHash = hash;
    if (callId && !hash) {
      searchHash = createHash('md5').update(callId).digest('hex');
      console.warn(`Converted callId ${callId} to hash: ${searchHash}`);
    }

    // If no hash or callId provided, return recent records with pagination
    if (!searchHash) {
      console.warn(`No hash or callId provided, returning recent records (page size: ${pageSize})`);

      const scanCommand = new ScanCommand({
        TableName: config.dynamodb.tableName,
        Limit: pageSize,
        ExclusiveStartKey: exclusiveStartKey,
      });

      const response = await docClient.send(scanCommand);

      // Encode LastEvaluatedKey as base64 nextToken
      const nextToken = response.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64')
        : undefined;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Recent call recordings retrieved successfully',
          count: response.Items?.length || 0,
          items: response.Items || [],
          pagination: {
            pageSize,
            nextToken,
            hasMore: !!response.LastEvaluatedKey,
          },
        }),
      };
    }

    console.warn(`Querying DynamoDB for hash: ${searchHash} (page size: ${pageSize})`);

    // Query DynamoDB by hash with pagination
    const queryCommand = new QueryCommand({
      TableName: config.dynamodb.tableName,
      KeyConditionExpression: '#hash = :hash',
      ExpressionAttributeNames: {
        '#hash': 'hash',
      },
      ExpressionAttributeValues: {
        ':hash': searchHash,
      },
      ScanIndexForward: false, // Sort by timestamp descending
      Limit: pageSize,
      ExclusiveStartKey: exclusiveStartKey,
    });

    const response = await docClient.send(queryCommand);

    if (!response.Items || response.Items.length === 0) {
      console.warn(`No records found for hash: ${searchHash}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'No records found',
          message: `No call recording analytics found for the given ${callId ? 'callId' : 'hash'}`,
          searchedHash: searchHash,
        }),
      };
    }

    console.warn(`Found ${response.Items.length} records, passing to UI`);

    // Encode LastEvaluatedKey as base64 nextToken
    const nextToken = response.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Call recording analytics retrieved successfully',
        count: response.Items.length,
        items: response.Items,
        pagination: {
          pageSize,
          nextToken,
          hasMore: !!response.LastEvaluatedKey,
        },
      }),
    };
  } catch (error) {
    console.error(`Error retrieving analytics from DynamoDB: ${error}`);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
