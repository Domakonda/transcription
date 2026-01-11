# Architecture Documentation

## System Overview

This project implements an event-driven serverless architecture for processing inbound call recordings using AWS Bedrock Data Automation.

## Architecture Diagram

```
┌─────────────────┐
│ Existing Lambda │ (managed separately)
│   (Publishes)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SNS Topic                                   │
│           dmg-inbound-callrecording-transcript                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │   SQS Queue    │
                   │  (Subscriber)  │
                   └───────┬────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │         Lambda 1                         │
        │  dmg-inbound-callrecording-             │
        │      materialization                     │
        │  (Invokes Bedrock BDA)                  │
        └───────────────┬──────────────────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │  AWS Bedrock Data      │
            │  Automation Service    │
            │  (Processes Audio)     │
            └───────────┬────────────┘
                        │
                        │ writes results.json
                        ▼
                ┌───────────────┐
                │  S3 Bucket    │
                │   (Output)    │
                └───────┬───────┘
                        │
                        │ S3 Event Notification
                        ▼
                ┌───────────────┐
                │  SQS Queue    │
                │ (S3 Events)   │
                └───────┬───────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │         Lambda 2                  │
        │  dmg-inbound-callrecording-      │
        │      persistence                  │
        │  (Reads S3, Writes DynamoDB)     │
        └───────────────┬───────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   DynamoDB    │
                │    Table      │
                └───────┬───────┘
                        │
                        │ reads
                        ▼
        ┌───────────────────────────────────┐
        │         Lambda 3                  │
        │  dmg-inbound-callrecording-      │
        │      retrieval                    │
        │  (Queries DynamoDB)              │
        └───────────────┬───────────────────┘
                        ▲
                        │
                ┌───────┴───────┐
                │  API Gateway  │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │      UI       │
                │   (Client)    │
                └───────────────┘
```

## Component Details

### 1. SNS Topic: dmg-inbound-callrecording-transcript

**Purpose**: Message bus for inbound call recording notifications

**Configuration**:
- Name: `dmg-inbound-callrecording-transcript`
- Publisher: Existing Lambda function (managed separately)
- Subscribers: SQS queue for Lambda 1

**Message Format**:
```json
{
  "callId": "unique-call-identifier",
  "audioS3Uri": "s3://bucket/path/to/audio.mp3",
  "timestamp": "2024-01-01T00:00:00Z",
  "metadata": {
    // optional metadata
  }
}
```

### 2. SQS Queue 1: dmg-inbound-callrecording-transcript-sqs-queue

**Purpose**: Buffer for SNS messages, triggers Lambda 1

**Configuration**:
- Visibility timeout: 360 seconds (2x Lambda timeout)
- Delay: 30 seconds
- Dead Letter Queue: Yes (max 10 retries)
- Long polling: Enabled (10 seconds)

**Terraform File**: `sqs_dmg_inbound_callrecording_transcription.tf`

### 3. Lambda 1: dmg-inbound-callrecording-transcription

**Purpose**: Materializes/invokes Bedrock Data Automation for audio processing

**Trigger**: SQS queue (SNS subscription)

**Handler**: `handlers/dmg-inbound-callrecording-transcription.handler`

**Process**:
1. Receives SQS message containing SNS notification
2. Parses callId and audioS3Uri
3. Invokes Bedrock Data Automation asynchronously
4. Configures output to S3 bucket

**Environment Variables**:
- `AWS_REGION`: AWS region
- `S3_OUTPUT_BUCKET`: Bedrock output bucket name
- `BEDROCK_PROJECT_ARN`: ARN of Bedrock project

**IAM Permissions**:
- SQS: ReceiveMessage, DeleteMessage
- Bedrock: InvokeDataAutomationAsync
- S3: PutObject (output bucket)

**Terraform File**: `lambda_dmg_inbound_callrecording_transcription.tf`

### 4. AWS Bedrock Data Automation

**Purpose**: Processes audio files and extracts conversational analytics

**Configuration**:
- Project: Conversational Analytics
- Blueprint: Custom audio blueprint
- Stage: LIVE

**Outputs (Custom)**:
- `call_summary`: Summary of the conversation
- `call_categories`: Categories (Billing, Tech support, etc.)
- `topics`: Main topics discussed

**Outputs (Standard)**:
- `transcript`: Full text transcript
- `audio_summary`: AI-generated summary
- `topic_summary`: Topic-based summary
- `audio_content_moderation`: Content moderation flags

**Result Location**: `s3://bucket/{callId}/results.json`

**Terraform File**: `bedrock.tf`, `bedrock_data_automation_template.yaml`

### 5. S3 Bucket: Output Bucket

**Purpose**: Receives Bedrock processing results

**Configuration**:
- Versioning: Enabled
- Encryption: AES256 or KMS
- Public access: Blocked
- Event notifications: Enabled (for results.json files)

**Terraform File**: `s3_dmg_inbound_callrecording_persistence.tf`

### 6. SQS Queue 2: dmg-inbound-callrecording-persistence-sqs-queue

**Purpose**: Buffer for S3 event notifications, triggers Lambda 2

**Configuration**:
- Visibility timeout: 360 seconds
- Delay: 10 seconds
- Dead Letter Queue: Yes (max 10 retries)
- Long polling: Enabled (10 seconds)

**Terraform File**: `sqs_dmg_inbound_callrecording_persistence.tf`

### 7. Lambda 2: dmg-inbound-callrecording-persistence

**Purpose**: Reads Bedrock custom output from S3 and persists to DynamoDB

**Trigger**: SQS queue (S3 event notifications)

**Handler**: `handlers/dmg-inbound-callrecording-persistence.handler`

**Process**:
1. Receives SQS message containing S3 event
2. Extracts S3 bucket and key (results.json)
3. Fetches and parses Bedrock results
4. Transforms to DynamoDB record format
5. Writes to DynamoDB table

**Environment Variables**:
- `AWS_REGION`: AWS region
- `DYNAMODB_TABLE_NAME`: DynamoDB table name

**IAM Permissions**:
- SQS: ReceiveMessage, DeleteMessage
- S3: GetObject (output bucket)
- DynamoDB: PutItem

**Terraform File**: `lambda_dmg_inbound_callrecording_persistence.tf`

### 8. DynamoDB Table: call-recordings

**Purpose**: Persistent storage for call recording analytics

**Schema**:
- **Hash Key**: `hash` (String) - MD5 hash of callId
- **Range Key**: `epchdatetimestamp` (Number) - Unix timestamp
- **Attributes**:
  - `call_id`: Original call identifier
  - `s3_input_uri`: Original audio S3 URI
  - `s3_output_uri`: Bedrock output S3 URI
  - `bedrock_status`: Processing status
  - `call_summary`: Call summary text
  - `call_categories`: Array of categories
  - `topics`: Array of topics
  - `transcript`: Full transcript text
  - `audio_summary`: AI summary
  - `topic_summary`: Topic summary
  - `created_at`: ISO timestamp
  - `updated_at`: ISO timestamp

**Configuration**:
- Billing mode: PAY_PER_REQUEST (on-demand)
- Point-in-time recovery: Enabled
- Encryption: Server-side encryption enabled

**Terraform File**: `dynamodb.tf`

### 9. Lambda 3: dmg-inbound-callrecording-retrieval

**Purpose**: Retrieves analytics data from DynamoDB for UI

**Trigger**: API Gateway

**Handler**: `handlers/dmg-inbound-callrecording-retrieval.handler`

**Process**:
1. Receives HTTP GET request from API Gateway
2. Extracts hash or callId from request
3. Queries DynamoDB by hash key
4. Returns analytics data as JSON

**API Endpoints**:
- `GET /analytics/{hash}` - Get by hash
- `GET /analytics?callId=xxx` - Get by callId (converted to hash)
- `GET /analytics` - List recent records

**Response Format**:
```json
{
  "message": "Call recording analytics retrieved successfully",
  "count": 1,
  "items": [
    {
      "hash": "abc123...",
      "call_id": "call-123",
      "call_summary": "Customer called regarding...",
      "call_categories": ["Billing", "Customer service"],
      "topics": ["payment", "invoice"],
      "transcript": "Full transcript...",
      // ... other fields
    }
  ]
}
```

**Environment Variables**:
- `AWS_REGION`: AWS region
- `DYNAMODB_TABLE_NAME`: DynamoDB table name

**IAM Permissions**:
- DynamoDB: Query, Scan, GetItem

**Terraform File**: `lambda_dmg_inbound_callrecording_retrieval.tf`

### 10. API Gateway: dmg-inbound-callrecording-analytics-api

**Purpose**: REST API for UI to retrieve analytics

**Configuration**:
- Type: REST API
- Stage: dev/staging/prod
- CORS: Enabled
- Authentication: None (configurable)

**Endpoints**:
- `GET /analytics` - List recent
- `GET /analytics/{hash}` - Get specific record
- `OPTIONS /analytics/{hash}` - CORS preflight

**Terraform File**: `apigateway_dmg_inbound_callrecording_retrieval.tf`

## Data Flow

### Happy Path Flow

1. **Existing Lambda** publishes message to **SNS topic** with callId and audioS3Uri
2. **SNS** delivers message to **SQS Queue 1**
3. **Lambda 1** (materialization):
   - Polls SQS Queue 1
   - Invokes Bedrock Data Automation
   - Bedrock starts processing audio asynchronously
4. **Bedrock** processes audio and writes `results.json` to **S3 bucket**
5. **S3** sends event notification to **SQS Queue 2**
6. **Lambda 2** (persistence):
   - Polls SQS Queue 2
   - Reads results.json from S3
   - Parses custom output
   - Writes to DynamoDB
7. **UI** sends HTTP request to **API Gateway**
8. **API Gateway** triggers **Lambda 3** (retrieval)
9. **Lambda 3**:
   - Queries DynamoDB
   - Returns analytics data
10. **UI** receives and displays analytics

### Error Handling

- **SQS Dead Letter Queues**: Failed messages moved after 10 retries
- **Lambda Retries**: Automatic retry by SQS visibility timeout
- **CloudWatch Logs**: All Lambda executions logged
- **DynamoDB**: Point-in-time recovery for data protection

## Naming Conventions

All resources follow the `dmg-inbound-callrecording-{process}` naming pattern:

- **SNS Topic**: `dmg-inbound-callrecording-transcript`
- **SQS Queues**: `dmg-inbound-callrecording-{lambda-name}-sqs-queue`
- **Lambda Functions**:
  - `dmg-inbound-callrecording-transcription`
  - `dmg-inbound-callrecording-persistence`
  - `dmg-inbound-callrecording-retrieval`
- **API Gateway**: `dmg-inbound-callrecording-analytics-api`
- **DynamoDB Table**: `{project}-{env}-call-recordings`

## Scalability

- **SNS**: Unlimited messages per second
- **SQS**: Unlimited messages, configurable throughput
- **Lambda**: Concurrent execution limits (default 1000, can be increased)
- **Bedrock**: Rate limited by AWS quotas
- **DynamoDB**: On-demand scaling, no capacity planning needed
- **API Gateway**: 10,000 requests per second (soft limit)

## Monitoring

### CloudWatch Metrics

- Lambda invocations, errors, duration
- SQS message count, age
- API Gateway 4xx/5xx errors, latency
- DynamoDB consumed capacity

### CloudWatch Logs

- `/aws/lambda/dmg-inbound-callrecording-transcription`
- `/aws/lambda/dmg-inbound-callrecording-persistence`
- `/aws/lambda/dmg-inbound-callrecording-retrieval`
- `/aws/apigateway/dmg-inbound-callrecording-analytics-api`

### Alarms (Recommended)

- Lambda error rate > 5%
- SQS DLQ message count > 0
- API Gateway 5xx errors > 1%
- Bedrock invocation failures

## Security

- **S3**: Server-side encryption, public access blocked
- **DynamoDB**: Encryption at rest, point-in-time recovery
- **IAM**: Least privilege principle for all roles
- **VPC**: Optional VPC integration for Lambda functions
- **API Gateway**: Can add AWS IAM, API keys, or Cognito authentication

## Cost Optimization

- Lambda: Pay per invocation + compute time
- SQS: First 1M requests free per month
- DynamoDB: On-demand billing, only pay for what you use
- S3: Pay for storage + requests
- Bedrock: Pay per processing unit
- API Gateway: Pay per million requests

## Disaster Recovery

- **RTO (Recovery Time Objective)**: < 1 hour (redeploy with Terraform)
- **RPO (Recovery Point Objective)**: < 5 minutes (DynamoDB PITR)
- **Backup Strategy**:
  - DynamoDB: Point-in-time recovery (last 35 days)
  - S3: Versioning enabled
  - Infrastructure: Version controlled in Git

## Future Enhancements

- Add Step Functions for complex orchestration
- Implement retry logic with exponential backoff
- Add X-Ray tracing for distributed tracing
- Implement API authentication (API keys, Cognito)
- Add custom CloudWatch dashboards
- Implement S3 lifecycle policies
- Add SNS notifications for failures
