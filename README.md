# AWS Bedrock Data Automation - Audio Transcription Pipeline

Complete serverless pipeline for audio transcription using AWS Bedrock Data Automation with automatic persistence to DynamoDB.

## Architecture

```
Audio Upload → SNS → SQS → Lambda (Transcription)
                              ↓
                         Bedrock API
                              ↓
                         S3 Results
                              ↓
                    S3 Event Notification
                              ↓
                    SQS → Lambda (Persistence)
                              ↓
                          DynamoDB
                              ↓
                        API Gateway
```

## Infrastructure

All infrastructure is managed via Terraform in the `terraform/` directory:

- **SNS Topic**: Receives audio upload notifications
- **SQS Queues**:
  - Transcription queue (10 retries)
  - S3 event queue (3 retries)
  - Dead Letter Queues for both
- **Lambda Functions**:
  - `dmg-inbound-callrecording-transcription` - Triggers Bedrock transcription
  - `dmg-inbound-callrecording-persistence` - Stores results in DynamoDB
  - `dmg-inbound-callrecording-retrieval` - API for querying transcriptions
- **S3 Bucket**: `pgr-experiment-data-us-east-1`
- **DynamoDB Table**: `conversational-analytics-dev-call-recordings`
- **API Gateway**: REST API for retrieving transcriptions

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Deploy Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 3. Build and Deploy Lambda Functions
```bash
# Build all Lambda functions
npm run build:lambda

# Deploy individual functions
npm run deploy:transcription
npm run deploy:persistence
npm run deploy:retrieval
```

## Testing

Trigger a transcription by publishing to SNS:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
  --message '{
    "callId": "test-001",
    "audioS3Uri": "s3://pgr-experiment-data-us-east-1/raw-audio/your-audio-file.wav"
  }'
```

## Configuration

### Environment Variables

Lambda functions use these environment variables (set via Terraform):

- `S3_INPUT_BUCKET`: S3 bucket for audio files
- `S3_OUTPUT_BUCKET`: S3 bucket for transcription results
- `S3_OUTPUT_PREFIX`: Prefix for output files
- `DYNAMODB_TABLE`: DynamoDB table name
- `BEDROCK_BLUEPRINT_ARN`: Bedrock blueprint ARN
- `BEDROCK_PROJECT_ARN`: Bedrock project ARN

### S3 Bucket Policy

The S3 bucket requires a policy allowing Bedrock service principal access. This is configured in `terraform/s3_bucket_policy.tf`.

## Project Structure

```
.
├── src/
│   ├── config/           # Configuration
│   ├── handlers/         # Lambda function handlers
│   └── types/            # TypeScript type definitions
├── terraform/            # Infrastructure as Code
│   ├── *.tf             # Terraform configuration files
│   └── placeholder_lambda/  # Initial placeholder code
├── events/              # Sample test events
├── build-lambda.js      # Build script for Lambda functions
└── package.json         # Node.js dependencies
```

## Build Script

The `build-lambda.js` script:
1. Compiles TypeScript to JavaScript
2. Creates separate deployment packages for each Lambda
3. Installs only production dependencies
4. Generates ZIP files in `deploy-bundled/` directory

## Deployment

Each Lambda function is deployed with handler-only code (no AWS SDK bundled) to keep package sizes small (2-4 MB instead of 50+ MB).

## Dead Letter Queues

- **Transcription Queue**: 10 retries (handles Bedrock rate limiting)
- **S3 Event Queue**: 3 retries (faster failure detection)
- All DLQs retain messages for 14 days

## API Endpoints

API Gateway provides these endpoints:

- `GET /transcriptions?callId={id}` - Get transcription by call ID
- `GET /transcriptions?startDate={date}&endDate={date}` - Get transcriptions by date range

## License

Proprietary
