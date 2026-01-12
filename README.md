# AWS Bedrock Data Automation - Audio Transcription Pipeline

Complete serverless pipeline for audio transcription using AWS Bedrock Data Automation with automatic persistence to DynamoDB and API-based retrieval.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSCRIPTION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

S3 Audio Upload
    ↓ (S3 Event Notification)
SNS Topic (dmg-inbound-callrecording-transcript)
    ↓ (SNS Subscription)
SQS Queue (dmg-inbound-callrecording-transcription)
    ↓ (Event Source Mapping - Batch: 1, Max Concurrency: 10)
Lambda Function (dmg-inbound-callrecording-transcription)
    ├─ Reads S3 audio file metadata
    ├─ Creates initial DynamoDB record (status: PROCESSING)
    └─ Invokes Bedrock Data Automation API (async)
            ↓
    Bedrock Data Automation (3-5 minutes processing)
    ├─ Speech-to-text transcription
    ├─ Speaker diarization
    ├─ Content moderation
    └─ Custom analytics (call summary, categories, topics)
            ↓
    S3 Output (transcription results JSON)
            ↓ (S3 Event Notification - Direct to SQS)
    SQS Queue (s3-bedrock-output-queue)
            ↓ (Event Source Mapping - Batch: 1, Max Concurrency: 10)
    Lambda Function (dmg-inbound-callrecording-persistence)
    ├─ Reads S3 transcription results
    ├─ Parses JSON output
    └─ Updates DynamoDB record (status: COMPLETED)
            ↓
    DynamoDB Table (call-recordings)
    ├─ Hash key: hash (call identifier)
    ├─ Range key: epchdatetimestamp
    └─ Stores: transcript, speakers, metadata


┌─────────────────────────────────────────────────────────────────┐
│                      RETRIEVAL FLOW                              │
└─────────────────────────────────────────────────────────────────┘

User/Application
    ↓ (HTTP GET Request)
API Gateway (REST API)
    ├─ GET /?hash={hash}
    ├─ Supports pagination with lastEvaluatedKey
    └─ CORS enabled
            ↓ (Lambda Integration)
    Lambda Function (dmg-inbound-callrecording-retrieval)
    ├─ Parses query parameters
    ├─ Queries DynamoDB by hash
    └─ Returns paginated JSON response
            ↓
    DynamoDB Table (call-recordings)
            ↓
    JSON Response to User
```

## Infrastructure Components

All infrastructure is managed via Terraform in the `terraform/` directory.

### Storage & Messaging

- **S3 Buckets**:
  - Input bucket for audio files
  - Output bucket for Bedrock transcription results (managed by Bedrock CloudFormation)

- **SNS Topics**:
  - `dmg-inbound-callrecording-transcript` - Audio upload notifications

- **SQS Queues**:
  - `dmg-inbound-callrecording-transcription` - Transcription requests
    - Visibility timeout: 900s (15 minutes)
    - Message retention: 4 days
    - Batch size: 1 message
    - Maximum concurrency: 10
  - `s3-bedrock-output-queue` - Bedrock result notifications (direct from S3)
    - Visibility timeout: 900s
    - Message retention: 4 days
    - Batch size: 1 message
    - Maximum concurrency: 10
  - Dead Letter Queues for both (14-day retention)

### Compute

- **Lambda Functions**:
  - `dmg-inbound-callrecording-transcription`
    - Runtime: Node.js 20.x
    - Memory: 512 MB
    - Timeout: 180 seconds
    - Trigger: SQS (transcription queue)
    - Purpose: Initiates Bedrock transcription jobs

  - `dmg-inbound-callrecording-persistence`
    - Runtime: Node.js 20.x
    - Memory: 512 MB
    - Timeout: 180 seconds
    - Trigger: SQS (persistence queue)
    - Purpose: Stores Bedrock results in DynamoDB

  - `dmg-inbound-callrecording-retrieval`
    - Runtime: Node.js 20.x
    - Memory: 256 MB
    - Timeout: 30 seconds
    - Trigger: API Gateway
    - Purpose: Queries DynamoDB and returns transcription data

### Database

- **DynamoDB Tables**:
  - `call-recordings` (Main table)
    - Hash key: `hash` (String) - Call identifier hash
    - Range key: `epchdatetimestamp` (Number) - Epoch timestamp
    - Billing mode: PAY_PER_REQUEST (on-demand)
    - Point-in-time recovery: Enabled
    - Encryption: Server-side (KMS optional)

  - `quota-tracking` (For future quota management)
    - Hash key: `request_id` (String)
    - TTL: 1 hour (auto-cleanup)
    - Billing mode: PAY_PER_REQUEST
    - Purpose: Track in-flight Bedrock requests

### API

- **API Gateway** (REST API):
  - Stage: `prod`
  - Endpoint: `GET /`
  - Query parameters: `hash`, `lastEvaluatedKey` (pagination)
  - Integration: Lambda proxy
  - CORS: Enabled
  - Authorization: None (configure as needed)

### AI/ML

- **AWS Bedrock Data Automation**:
  - Project: `dmg-inbound-transcription-post-call-analytics`
  - Blueprint: `dmg-inbound-transcription-blueprint` (AUDIO type)
  - Stage: LIVE
  - Managed via CloudFormation (embedded in Terraform)
  - Custom outputs: call_summary, call_categories, topics
  - Standard outputs: transcript, speaker diarization, content moderation

## Quick Start

### 1. Install Dependencies
```bash
yarn install
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
yarn build:lambda

# Deploy individual functions
yarn deploy:transcription
yarn deploy:persistence
yarn deploy:retrieval
```

## Configuration

### Environment Variables

Lambda functions use these environment variables (automatically set via Terraform):

**Transcription Lambda:**
- `AWS_REGION` - AWS region
- `S3_INPUT_BUCKET` - S3 bucket for audio files
- `S3_OUTPUT_BUCKET` - S3 bucket for transcription results
- `S3_OUTPUT_PREFIX` - Prefix for output files (default: `transcription-outputs`)
- `BEDROCK_PROJECT_ARN` - Bedrock Data Automation project ARN
- `BEDROCK_PROFILE_ARN` - Bedrock service profile ARN (regional endpoint)
- `BEDROCK_BLUEPRINT_STAGE` - Blueprint stage (`LIVE` or `DEVELOPMENT`)
- `DYNAMODB_TABLE_NAME` - Main DynamoDB table name
- `QUOTA_TRACKING_TABLE_NAME` - Quota tracking table (future use)

**Persistence Lambda:**
- `AWS_REGION` - AWS region
- `S3_INPUT_BUCKET` - S3 bucket for audio files
- `S3_OUTPUT_BUCKET` - S3 bucket for results
- `S3_OUTPUT_PREFIX` - Prefix for output files
- `BEDROCK_PROJECT_ARN` - Bedrock project ARN
- `BEDROCK_BLUEPRINT_STAGE` - Blueprint stage
- `DYNAMODB_TABLE_NAME` - Main DynamoDB table name
- `QUOTA_TRACKING_TABLE_NAME` - Quota tracking table (future use)

**Retrieval Lambda:**
- `AWS_REGION` - AWS region
- `DYNAMODB_TABLE_NAME` - Main DynamoDB table name
- `PAGINATION_DEFAULT_PAGE_SIZE` - Default page size (default: 20)
- `PAGINATION_MAX_PAGE_SIZE` - Maximum page size (default: 100)

### Terraform Variables

Configure these in `terraform/terraform.tfvars`:

```hcl
aws_region              = "us-east-1"
project_name            = "conversational-analytics"
environment             = "dev"  # dev, staging, or prod
s3_input_bucket_name    = "your-bucket-name"
s3_output_prefix        = "transcription-outputs"
blueprint_stage         = "LIVE"  # or "DEVELOPMENT"
lambda_runtime          = "nodejs20.x"
lambda_memory_size      = 512
pagination_default_page_size = 20
pagination_max_page_size     = 100
```

## Testing

### Upload Audio File to S3

Upload an audio file to your S3 bucket. This will automatically trigger the transcription pipeline:

```bash
aws s3 cp your-audio-file.wav s3://your-bucket-name/audio/
```

### Manual SNS Trigger

Alternatively, manually trigger transcription by publishing to SNS:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:{region}:{account-id}:dmg-inbound-callrecording-transcript \
  --message file://test-message.json
```

**test-message.json:**
```json
{
  "Records": [{
    "s3": {
      "bucket": {"name": "your-bucket-name"},
      "object": {"key": "audio/your-audio-file.wav"}
    }
  }]
}
```

### Query Results via API

After transcription completes (3-5 minutes), query via API Gateway:

```bash
# Get API Gateway URL from Terraform outputs
terraform output api_gateway_url

# Query by hash
curl "https://your-api-id.execute-api.region.amazonaws.com/prod?hash=your-hash-value"

# Query with pagination
curl "https://your-api-id.execute-api.region.amazonaws.com/prod?hash=your-hash-value&lastEvaluatedKey=xyz"
```

### Monitor Processing

Check Lambda logs in CloudWatch:

```bash
# Transcription Lambda logs
aws logs tail /aws/lambda/dmg-inbound-callrecording-transcription --follow

# Persistence Lambda logs
aws logs tail /aws/lambda/dmg-inbound-callrecording-persistence --follow

# Retrieval Lambda logs
aws logs tail /aws/lambda/dmg-inbound-callrecording-retrieval --follow
```

### Check DynamoDB Records

Query DynamoDB directly:

```bash
aws dynamodb query \
  --table-name your-table-name \
  --key-condition-expression "hash = :hash" \
  --expression-attribute-values '{":hash":{"S":"your-hash-value"}}'
```

### S3 Bucket Policy

The S3 bucket requires a policy allowing Bedrock service principal access. This is configured in `terraform/s3_bucket_policy.tf`.

## Project Structure

```
transcription/
├── src/                          # TypeScript source code
│   ├── config/
│   │   └── index.ts             # Configuration management
│   ├── handlers/                # Lambda function entry points
│   │   ├── dmg-inbound-callrecording-transcription.ts
│   │   ├── dmg-inbound-callrecording-persistence.ts
│   │   └── dmg-inbound-callrecording-retrieval.ts
│   ├── services/                # Business logic layer
│   │   ├── transcription.service.ts
│   │   ├── persistence.service.ts
│   │   └── retrieval.service.ts
│   ├── repositories/            # Data access layer
│   │   ├── dynamodb.repository.ts
│   │   ├── s3.repository.ts
│   │   └── bedrock.repository.ts
│   ├── utils/                   # Utility functions
│   │   ├── logger.ts
│   │   ├── hash.ts
│   │   └── validators.ts
│   └── types/                   # TypeScript type definitions
│       └── index.ts
│
├── terraform/                   # Infrastructure as Code
│   ├── providers.tf            # AWS provider configuration
│   ├── variables.tf            # Input variables
│   ├── locals.tf               # Local values
│   ├── outputs.tf              # Output values
│   ├── iam.tf                  # IAM roles and policies
│   ├── sns_*.tf                # SNS topic configurations
│   ├── sqs_*.tf                # SQS queue configurations
│   ├── lambda_*.tf             # Lambda function definitions
│   ├── dynamodb_*.tf           # DynamoDB table definitions
│   ├── apigateway_*.tf         # API Gateway configuration
│   ├── s3_bucket_policy.tf     # S3 bucket policies
│   ├── bedrock_data_automation_template.yaml  # Bedrock CloudFormation
│   ├── dmg_inbound_callrecording_bda_cloudFormation_stack.tf
│   └── placeholder_lambda/     # Placeholder Lambda code for initial deployment
│       ├── transcription/
│       ├── persistence/
│       └── retrieval/
│
├── events/                      # Test event samples
│   ├── sampleTranscriptionEvent.json
│   ├── samplePersistenceEvent.json
│   ├── sampleRetrievalEventFound.json
│   ├── sampleRetrievalEventNotFound.json
│   └── sampleRetrievalEventPagination.json
│
├── dist/                        # Compiled JavaScript (generated by tsc)
├── deploy-bundled/              # Lambda deployment packages (generated)
│   ├── transcription/
│   ├── persistence/
│   └── retrieval/
│
├── build-lambda.js              # Lambda build and packaging script
├── package.json                 # Dependencies and scripts (yarn)
├── yarn.lock                    # Locked dependency versions
├── tsconfig.json                # TypeScript configuration
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```

## Layered Architecture

The application follows a clean **layered architecture pattern**:

1. **Handlers** (Entry Points)
   - Thin wrappers around services
   - Parse AWS Lambda events
   - Call services and return responses
   - 11-13 lines of code each

2. **Services** (Business Logic)
   - Core application logic
   - Orchestrate repositories
   - Handle errors and retries
   - Transform data

3. **Repositories** (Data Access)
   - Abstract AWS SDK calls
   - Provide clean interfaces for data operations
   - Handle S3, DynamoDB, Bedrock interactions

4. **Utilities** (Shared Functions)
   - Logger (structured logging)
   - Hash (SHA-256 hashing for call IDs)
   - Validators (input validation)

## Build & Deployment Process

### Build Script (`build-lambda.js`)

The build script creates optimized Lambda deployment packages:

1. **Compile TypeScript** → JavaScript (using `tsc`)
2. **Bundle handler code** → Single file (using `esbuild`)
   - External AWS SDK (not bundled, provided by Lambda)
   - Tree-shaking to remove unused code
   - Minification disabled (for debugging)
3. **Install production dependencies** → Only required packages per Lambda
4. **Create ZIP archives** → Ready for deployment

**Result:** 2-4 MB packages instead of 50+ MB with full AWS SDK

### Deployment Workflow

**Two-Phase Deployment:**

**Phase 1: Infrastructure (Terraform)**
```bash
cd terraform
terraform init
terraform plan
terraform apply
```
- Creates all AWS resources
- Deploys placeholder Lambda code (allows infrastructure provisioning)
- `lifecycle.ignore_changes` prevents Terraform from reverting code updates

**Phase 2: Application Code (AWS CLI)**
```bash
yarn build:lambda          # Build optimized packages
yarn deploy:transcription  # Deploy via AWS CLI
yarn deploy:persistence
yarn deploy:retrieval
```
- Builds actual application code
- Deploys via `aws lambda update-function-code`
- Lifecycle block ensures Terraform doesn't overwrite

**Why This Approach?**
- Separates infrastructure management from code deployment
- Allows fast code-only deployments without Terraform
- Supports CI/CD pipelines
- Prevents race conditions during initial provisioning

## Error Handling & Resilience

### SQS Queue Configuration

**Transcription Queue:**
- Visibility timeout: 900 seconds (15 minutes)
- Message retention: 4 days
- Redrive policy: 10 max receives before DLQ
- Rationale: Handles Bedrock rate limiting and transient failures

**Persistence Queue:**
- Visibility timeout: 900 seconds
- Message retention: 4 days
- Redrive policy: 3 max receives before DLQ
- Rationale: Faster failure detection for S3 read errors

**Dead Letter Queues:**
- Retention: 14 days
- Purpose: Manual inspection and replay of failed messages

### Lambda Concurrency

- **Maximum concurrency: 10** per function
- Prevents overwhelming Bedrock API (default quota ~50-100 requests/min)
- SQS acts as buffer, absorbing traffic spikes
- Messages wait in queue until Lambda capacity available

### Future: Quota Management

The `quota-tracking` DynamoDB table is provisioned for future implementation:
- Track in-flight Bedrock requests
- Enforce rate limits across Lambda instances
- Circuit breaker pattern for sustained failures
- See `EventBridge_Quota_Management_Proposal.md` for details

## API Endpoints

### GET / (Root)

Query transcriptions by hash with pagination support.

**Query Parameters:**
- `hash` (required) - Call identifier hash
- `lastEvaluatedKey` (optional) - Pagination token from previous response

**Response:**
```json
{
  "items": [
    {
      "hash": "abc123...",
      "epchdatetimestamp": 1736553600,
      "call_id": "call-001",
      "status": "COMPLETED",
      "transcript": "Full transcript text...",
      "speakers": [...],
      "metadata": {...}
    }
  ],
  "lastEvaluatedKey": "xyz..." // Include in next request for pagination
}
```

**Example Requests:**
```bash
# First page
curl "https://your-api.execute-api.us-east-1.amazonaws.com/prod?hash=abc123"

# Next page
curl "https://your-api.execute-api.us-east-1.amazonaws.com/prod?hash=abc123&lastEvaluatedKey=xyz"
```

## Cost Optimization

### Lambda
- Right-sized memory allocation (256-512 MB)
- Short timeouts (30-180 seconds)
- Handler-only deployment (no AWS SDK bloat)
- On-demand scaling with concurrency limits

### DynamoDB
- Pay-per-request billing (no provisioned capacity)
- Point-in-time recovery enabled (operational safety)
- TTL on quota tracking table (automatic cleanup)

### S3
- Standard storage class
- Lifecycle policies can be added for archival

### SQS
- No polling charges (event source mapping uses long polling)
- Message retention: 4 days (balance between durability and cost)

## Monitoring & Observability

### CloudWatch Logs
- Log groups: `/aws/lambda/{function-name}`
- Retention: 14 days (configurable in Terraform)
- Structured logging via custom Logger utility

### Metrics (Future)
- Custom CloudWatch metrics for:
  - Bedrock API call count
  - Transcription processing time
  - Quota utilization percentage
  - API response times

### Alarms (Recommended)
- Lambda error rate > 5%
- DLQ message count > 0
- API Gateway 5xx errors
- Bedrock throttling events

## Security Considerations

### IAM Least Privilege
- Lambda execution role has minimal required permissions
- Service-specific policies (S3, DynamoDB, Bedrock, SQS)
- No wildcard resource ARNs (except Bedrock, due to service limitations)

### Encryption
- DynamoDB: Server-side encryption (AWS managed or KMS)
- S3: Default encryption enabled
- SQS: Server-side encryption
- In-transit: All AWS service communication over TLS

### API Gateway
- CORS enabled (configure allowed origins for production)
- Authorization: Currently none (add API keys, Cognito, or IAM auth as needed)
- Rate limiting: Configure usage plans for production

### Secrets Management
- No hardcoded credentials
- AWS SDK uses IAM role credentials
- Consider AWS Secrets Manager for third-party API keys

## Troubleshooting

### Transcription not starting
1. Check S3 event notification configuration (input bucket → SNS → SQS)
2. Verify SNS topic subscription to transcription SQS queue
3. Check Lambda CloudWatch logs
4. Verify IAM permissions for Lambda to read S3

### Transcription stuck in PROCESSING
1. Check Bedrock API quotas and throttling
2. Monitor CloudWatch logs for Bedrock API errors
3. Verify S3 output bucket permissions for Bedrock
4. Check DLQ for failed messages

### Results not persisting
1. Check S3 output bucket event notifications (direct to s3-bedrock-output-queue)
2. Verify persistence Lambda is triggered (CloudWatch logs)
3. Check SQS queue policy allows S3 to send messages
4. Check IAM permissions for DynamoDB write
5. Verify DynamoDB table name in environment variables

### API returns empty results
1. Verify hash value is correct
2. Check DynamoDB for records with that hash
3. Review retrieval Lambda logs for errors
4. Verify API Gateway integration with Lambda

