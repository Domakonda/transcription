"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// dist/config/index.js
var require_config = __commonJS({
  "dist/config/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateConfig = exports2.config = void 0;
    exports2.config = {
      aws: {
        region: process.env.AWS_REGION || "us-east-1"
      },
      bedrock: {
        projectArn: process.env.BEDROCK_PROJECT_ARN || "",
        blueprintStage: process.env.BEDROCK_BLUEPRINT_STAGE || "LIVE",
        profileArn: process.env.BEDROCK_PROFILE_ARN || ""
      },
      s3: {
        inputBucket: process.env.S3_INPUT_BUCKET || "",
        outputBucket: process.env.S3_OUTPUT_BUCKET || "",
        outputPrefix: process.env.S3_OUTPUT_PREFIX || "transcription-outputs"
      },
      dynamodb: {
        tableName: process.env.DYNAMODB_TABLE_NAME || "conversational-analytics-dev-call-recordings"
      },
      pagination: {
        defaultPageSize: parseInt(process.env.PAGINATION_DEFAULT_PAGE_SIZE || "20", 10),
        maxPageSize: parseInt(process.env.PAGINATION_MAX_PAGE_SIZE || "100", 10)
      }
    };
    var validateConfig = /* @__PURE__ */ __name(() => {
      const required = [
        "BEDROCK_PROJECT_ARN",
        "BEDROCK_PROFILE_ARN",
        "S3_INPUT_BUCKET",
        "S3_OUTPUT_BUCKET",
        "DYNAMODB_TABLE_NAME"
      ];
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
      }
    }, "validateConfig");
    exports2.validateConfig = validateConfig;
  }
});

// dist/handlers/dmg-inbound-callrecording-retrieval.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var config_1 = require_config();
var crypto_1 = require("crypto");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config_1.config.aws.region });
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = /* @__PURE__ */ __name(async (event) => {
  console.warn("Lambda dmg-inbound-callrecording-retrieval invoked");
  console.warn(`HTTP Method: ${event.httpMethod}`);
  console.warn(`Path: ${event.path}`);
  console.warn(`Query params: ${JSON.stringify(event.queryStringParameters)}`);
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
  try {
    const hash = event.pathParameters?.hash || event.queryStringParameters?.hash;
    const callId = event.queryStringParameters?.callId;
    const pageSizeParam = event.queryStringParameters?.pageSize;
    const nextTokenParam = event.queryStringParameters?.nextToken;
    let pageSize = config_1.config.pagination.defaultPageSize;
    if (pageSizeParam) {
      const parsedSize = parseInt(pageSizeParam, 10);
      if (!isNaN(parsedSize) && parsedSize > 0) {
        pageSize = Math.min(parsedSize, config_1.config.pagination.maxPageSize);
      }
    }
    let exclusiveStartKey;
    if (nextTokenParam) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextTokenParam, "base64").toString("utf-8"));
        console.warn(`Resuming pagination from: ${JSON.stringify(exclusiveStartKey)}`);
      } catch (err) {
        console.error(`Invalid nextToken: ${err}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Invalid pagination token",
            message: "The nextToken parameter is malformed or expired"
          })
        };
      }
    }
    let searchHash = hash;
    if (callId && !hash) {
      searchHash = (0, crypto_1.createHash)("md5").update(callId).digest("hex");
      console.warn(`Converted callId ${callId} to hash: ${searchHash}`);
    }
    if (!searchHash) {
      console.warn(`No hash or callId provided, returning recent records (page size: ${pageSize})`);
      const scanCommand = new lib_dynamodb_1.ScanCommand({
        TableName: config_1.config.dynamodb.tableName,
        Limit: pageSize,
        ExclusiveStartKey: exclusiveStartKey
      });
      const response2 = await docClient.send(scanCommand);
      const nextToken2 = response2.LastEvaluatedKey ? Buffer.from(JSON.stringify(response2.LastEvaluatedKey)).toString("base64") : void 0;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Recent call recordings retrieved successfully",
          count: response2.Items?.length || 0,
          items: response2.Items || [],
          pagination: {
            pageSize,
            nextToken: nextToken2,
            hasMore: !!response2.LastEvaluatedKey
          }
        })
      };
    }
    console.warn(`Querying DynamoDB for hash: ${searchHash} (page size: ${pageSize})`);
    const queryCommand = new lib_dynamodb_1.QueryCommand({
      TableName: config_1.config.dynamodb.tableName,
      KeyConditionExpression: "#hash = :hash",
      ExpressionAttributeNames: {
        "#hash": "hash"
      },
      ExpressionAttributeValues: {
        ":hash": searchHash
      },
      ScanIndexForward: false,
      // Sort by timestamp descending
      Limit: pageSize,
      ExclusiveStartKey: exclusiveStartKey
    });
    const response = await docClient.send(queryCommand);
    if (!response.Items || response.Items.length === 0) {
      console.warn(`No records found for hash: ${searchHash}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "No records found",
          message: `No call recording analytics found for the given ${callId ? "callId" : "hash"}`,
          searchedHash: searchHash
        })
      };
    }
    console.warn(`Found ${response.Items.length} records, passing to UI`);
    const nextToken = response.LastEvaluatedKey ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString("base64") : void 0;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Call recording analytics retrieved successfully",
        count: response.Items.length,
        items: response.Items,
        pagination: {
          pageSize,
          nextToken,
          hasMore: !!response.LastEvaluatedKey
        }
      })
    };
  } catch (error) {
    console.error(`Error retrieving analytics from DynamoDB: ${error}`);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      })
    };
  }
}, "handler");
exports.handler = handler;
