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

// dist/handlers/dmg-inbound-callrecording-transcription.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var client_bedrock_data_automation_runtime_1 = require("@aws-sdk/client-bedrock-data-automation-runtime");
var crypto_1 = require("crypto");
var config_1 = require_config();
var runtimeClient = new client_bedrock_data_automation_runtime_1.BedrockDataAutomationRuntimeClient({
  region: config_1.config.aws.region
});
var handler = /* @__PURE__ */ __name(async (event) => {
  console.warn("Lambda dmg-inbound-callrecording-transcription started");
  console.warn(`Processing ${event.Records.length} SQS messages`);
  console.warn(`Project ARN: ${config_1.config.bedrock.projectArn}`);
  console.warn(`Blueprint Stage: ${config_1.config.bedrock.blueprintStage}`);
  console.warn(`Profile ARN: ${config_1.config.bedrock.profileArn}`);
  for (const record of event.Records) {
    try {
      const sqsBody = JSON.parse(record.body);
      const snsMessage = JSON.parse(sqsBody.Message);
      console.warn(`
=== Processing Call ===`);
      console.warn(`Call ID: ${snsMessage.callId}`);
      console.warn(`Audio S3 URI: ${snsMessage.audioS3Uri}`);
      if (!snsMessage.audioS3Uri || !snsMessage.callId) {
        console.error("Missing required fields in SNS message");
        throw new Error("Missing audioS3Uri or callId in message");
      }
      const outputS3Uri = `s3://${config_1.config.s3.outputBucket}/${config_1.config.s3.outputPrefix}/${snsMessage.callId}/`;
      console.warn(`
=== Bedrock Invocation ===`);
      console.warn(`Input:  ${snsMessage.audioS3Uri}`);
      console.warn(`Output: ${outputS3Uri}`);
      const clientToken = (0, crypto_1.randomUUID)();
      console.warn(`Client Token: ${clientToken}`);
      const command = new client_bedrock_data_automation_runtime_1.InvokeDataAutomationAsyncCommand({
        clientToken,
        inputConfiguration: {
          s3Uri: snsMessage.audioS3Uri
        },
        outputConfiguration: {
          s3Uri: outputS3Uri
        },
        dataAutomationConfiguration: {
          dataAutomationProjectArn: config_1.config.bedrock.projectArn,
          stage: config_1.config.bedrock.blueprintStage
        },
        dataAutomationProfileArn: config_1.config.bedrock.profileArn
      });
      const response = await runtimeClient.send(command);
      console.warn(`
\u2705 Bedrock invocation successful`);
      console.warn(`Invocation ARN: ${response.invocationArn}`);
      console.warn(`Bedrock will process audio and write results to: ${outputS3Uri}`);
    } catch (error) {
      console.error(`
\u274C Error processing SQS message: ${error}`);
      console.error(`Error details:`, error);
      throw error;
    }
  }
  console.warn("\n=== Lambda dmg-inbound-callrecording-transcription completed ===");
}, "handler");
exports.handler = handler;
