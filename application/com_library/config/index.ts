// Environment Configuration
export const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
  bedrock: {
    projectArn: process.env.BEDROCK_PROJECT_ARN || '',
  },
  s3: {
    inputBucket: process.env.S3_INPUT_BUCKET || '',
    outputBucket: process.env.S3_OUTPUT_BUCKET || '',
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE_NAME || 'conversational-analytics-dev-call-recordings',
  },
} as const;

// Validate required environment variables
export const validateConfig = (): void => {
  const required = [
    'BEDROCK_PROJECT_ARN',
    'S3_INPUT_BUCKET',
    'S3_OUTPUT_BUCKET',
    'DYNAMODB_TABLE_NAME',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
