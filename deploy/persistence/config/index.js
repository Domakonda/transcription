"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
// Environment Configuration
exports.config = {
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
    },
    bedrock: {
        projectArn: process.env.BEDROCK_PROJECT_ARN || '',
        blueprintStage: process.env.BEDROCK_BLUEPRINT_STAGE || 'LIVE',
        profileArn: process.env.BEDROCK_PROFILE_ARN || '',
    },
    s3: {
        inputBucket: process.env.S3_INPUT_BUCKET || '',
        outputBucket: process.env.S3_OUTPUT_BUCKET || '',
        outputPrefix: process.env.S3_OUTPUT_PREFIX || 'transcription-outputs',
    },
    dynamodb: {
        tableName: process.env.DYNAMODB_TABLE_NAME || 'conversational-analytics-dev-call-recordings',
    },
    pagination: {
        defaultPageSize: parseInt(process.env.PAGINATION_DEFAULT_PAGE_SIZE || '20', 10),
        maxPageSize: parseInt(process.env.PAGINATION_MAX_PAGE_SIZE || '100', 10),
    },
};
// Validate required environment variables
const validateConfig = () => {
    const required = [
        'BEDROCK_PROJECT_ARN',
        'BEDROCK_PROFILE_ARN',
        'S3_INPUT_BUCKET',
        'S3_OUTPUT_BUCKET',
        'DYNAMODB_TABLE_NAME',
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
exports.validateConfig = validateConfig;
//# sourceMappingURL=index.js.map