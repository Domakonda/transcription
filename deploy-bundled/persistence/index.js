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

// dist/handlers/dmg-inbound-callrecording-persistence.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var client_s3_1 = require("@aws-sdk/client-s3");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var config_1 = require_config();
var crypto_1 = require("crypto");
var s3Client = new client_s3_1.S3Client({ region: config_1.config.aws.region });
var dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config_1.config.aws.region });
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = /* @__PURE__ */ __name(async (event) => {
  console.warn("Lambda dmg-inbound-callrecording-persistance started");
  console.warn(`Processing ${event.Records.length} SQS messages`);
  for (const record of event.Records) {
    try {
      const s3Event = JSON.parse(record.body);
      const s3Records = s3Event.Records || (s3Event.Message ? JSON.parse(s3Event.Message).Records : []);
      for (const s3Record of s3Records) {
        const bucket = s3Record.s3.bucket.name;
        const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));
        console.warn(`Processing S3 object: s3://${bucket}/${key}`);
        if (!key.endsWith("results.json")) {
          console.warn(`Skipping non-results file: ${key}`);
          continue;
        }
        const callId = key.split("/")[0];
        console.warn(`Fetching Bedrock custom output from S3: ${key}`);
        const getCommand = new client_s3_1.GetObjectCommand({
          Bucket: bucket,
          Key: key
        });
        const s3Response = await s3Client.send(getCommand);
        if (!s3Response.Body) {
          throw new Error("Empty response body from S3");
        }
        const bodyString = await s3Response.Body.transformToString();
        const analytics = JSON.parse(bodyString);
        console.warn("Successfully parsed Bedrock custom output");
        console.warn(`Call Summary: ${analytics.call_summary?.substring(0, 100)}...`);
        const hash = (0, crypto_1.createHash)("md5").update(callId).digest("hex");
        const timestamp = Date.now();
        const dbRecord = {
          hash,
          epchdatetimestamp: timestamp,
          call_id: callId,
          s3_input_uri: `s3://${config_1.config.s3.inputBucket}/${callId}`,
          // Reconstruct from call ID
          s3_output_uri: `s3://${bucket}/${callId}/`,
          bedrock_invocation_arn: void 0,
          // Not available in this flow
          bedrock_status: "SUCCESS",
          call_summary: analytics.call_summary,
          call_categories: analytics.call_categories,
          topics: analytics.topics,
          transcript: analytics.transcript,
          audio_summary: analytics.audio_summary,
          topic_summary: analytics.topic_summary,
          created_at: new Date(timestamp).toISOString(),
          updated_at: new Date(timestamp).toISOString()
        };
        console.warn(`Persisting record to DynamoDB: ${config_1.config.dynamodb.tableName}`);
        console.warn(`Hash: ${hash}, Call ID: ${callId}`);
        const putCommand = new lib_dynamodb_1.PutCommand({
          TableName: config_1.config.dynamodb.tableName,
          Item: dbRecord
        });
        await docClient.send(putCommand);
        console.warn(`Successfully persisted record for call: ${callId}`);
      }
    } catch (error) {
      console.error(`Error processing SQS message: ${error}`);
      throw error;
    }
  }
  console.warn("Lambda dmg-inbound-callrecording-persistance completed");
}, "handler");
exports.handler = handler;
