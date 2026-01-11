# Quick Reference Guide

## Architecture Flow

```
Existing Lambda → SNS → SQS → Lambda 1 (materialization) → Bedrock → S3
                                                                        ↓
                                                                   S3 Event
                                                                        ↓
                                                                      SQS
                                                                        ↓
                                UI ← API Gateway ← Lambda 3 (retrieval) ← DynamoDB ← Lambda 2 (persistence)
```

## Lambda Functions

| Lambda | Trigger | Purpose | Handler |
|--------|---------|---------|---------|
| **dmg-inbound-callrecording-transcription** | SQS (SNS subscription) | Invokes Bedrock | `handlers/dmg-inbound-callrecording-transcription.handler` |
| **dmg-inbound-callrecording-persistence** | SQS (S3 events) | S3 → DynamoDB | `handlers/dmg-inbound-callrecording-persistence.handler` |
| **dmg-inbound-callrecording-retrieval** | API Gateway | DynamoDB → UI | `handlers/dmg-inbound-callrecording-retrieval.handler` |

## Terraform Files

### By Lambda Function

**Lambda 1 (Materialization)**:
- `sns_dmg_inbound_callrecording_transcription.tf`
- `sqs_dmg_inbound_callrecording_transcription.tf`
- `lambda_dmg_inbound_callrecording_transcription.tf`

**Lambda 2 (Persistance)**:
- `s3_dmg_inbound_callrecording_persistence.tf`
- `sqs_dmg_inbound_callrecording_persistence.tf`
- `lambda_dmg_inbound_callrecording_persistence.tf`

**Lambda 3 (Retrieval)**:
- `apigateway_dmg_inbound_callrecording_retrieval.tf`
- `lambda_dmg_inbound_callrecording_retrieval.tf`

**Shared**:
- `providers.tf`, `variables.tf`, `locals.tf`, `iam.tf`, `dynamodb.tf`, `bedrock.tf`, `outputs.tf`

## Common Commands

### Build & Deploy
```bash
yarn install        # Install dependencies
yarn build          # Build TypeScript
cd terraform
terraform init      # Initialize Terraform
terraform plan      # Preview changes
terraform apply     # Deploy infrastructure
```

### Development
```bash
yarn build:watch    # Watch mode
yarn lint           # Check code quality
yarn lint:fix       # Auto-fix linting issues
yarn test           # Run tests
```

### Monitoring
```bash
# Lambda logs
aws logs tail /aws/lambda/dmg-inbound-callrecording-transcription --follow
aws logs tail /aws/lambda/dmg-inbound-callrecording-persistence --follow
aws logs tail /aws/lambda/dmg-inbound-callrecording-retrieval --follow

# SQS queues
aws sqs get-queue-attributes --queue-url {url} --attribute-names All

# DynamoDB
aws dynamodb scan --table-name conversational-analytics-dev-call-recordings --limit 10
```

## Environment Variables

### Lambda 1 (Materialization)
- `AWS_REGION`
- `S3_OUTPUT_BUCKET`
- `BEDROCK_PROJECT_ARN`

### Lambda 2 (Persistance)
- `AWS_REGION`
- `DYNAMODB_TABLE_NAME`

### Lambda 3 (Retrieval)
- `AWS_REGION`
- `DYNAMODB_TABLE_NAME`

## SNS Message Format

Your existing Lambda should publish:
```json
{
  "callId": "unique-call-id",
  "audioS3Uri": "s3://bucket/path/to/audio.mp3",
  "timestamp": "2024-01-01T00:00:00Z",
  "metadata": {}
}
```

## API Endpoints

```bash
# Get by hash
GET /analytics/{hash}

# Get by callId
GET /analytics?callId=call-123

# List recent
GET /analytics
```

## DynamoDB Schema

```
Hash Key: hash (String) - MD5 of callId
Range Key: epchdatetimestamp (Number) - Unix timestamp

Attributes:
- call_id
- s3_input_uri
- s3_output_uri
- bedrock_status
- call_summary
- call_categories (List)
- topics (List)
- transcript
- audio_summary
- topic_summary
- created_at
- updated_at
```

## Terraform Variables

```hcl
aws_region            = "us-east-1"
project_name          = "conversational-analytics"
environment           = "dev"
s3_output_bucket_name = "your-unique-bucket"
blueprint_stage       = "LIVE"
lambda_runtime        = "nodejs20.x"
lambda_timeout        = 300
lambda_memory_size    = 512
```

## Troubleshooting Quick Checks

1. **No messages flowing?**
   - Check SNS topic permissions
   - Verify SQS subscription
   - Check Lambda event source mapping

2. **Lambda 1 errors?**
   - Verify Bedrock project ARN
   - Check IAM permissions
   - Validate SNS message format

3. **No S3 results?**
   - Check Bedrock processing time (30-60s)
   - Verify S3 bucket name
   - Check Bedrock CloudFormation stack

4. **Lambda 2 not triggered?**
   - Verify S3 event notification
   - Check SQS queue 2
   - Check Lambda event source mapping

5. **No DynamoDB records?**
   - Check Lambda 2 CloudWatch logs
   - Verify S3 results.json format
   - Check DynamoDB IAM permissions

6. **API 404 errors?**
   - Verify hash/callId value
   - Check DynamoDB for record
   - Try GET /analytics (list all)

## Testing Flow

1. Publish to SNS:
```bash
aws sns publish \
  --topic-arn arn:aws:sns:... \
  --message '{"callId":"test-123","audioS3Uri":"s3://...","timestamp":"..."}'
```

2. Monitor Lambda 1:
```bash
aws logs tail /aws/lambda/dmg-inbound-callrecording-transcription --follow
```

3. Wait for Bedrock (~30-60 seconds)

4. Check S3:
```bash
aws s3 ls s3://output-bucket/test-123/
```

5. Monitor Lambda 2:
```bash
aws logs tail /aws/lambda/dmg-inbound-callrecording-persistence --follow
```

6. Query DynamoDB:
```bash
aws dynamodb scan --table-name conversational-analytics-dev-call-recordings
```

7. Test API:
```bash
curl https://{api-id}.execute-api.us-east-1.amazonaws.com/dev/analytics?callId=test-123
```

## Resource Names

| Resource | Name |
|----------|------|
| SNS Topic | `dmg-inbound-callrecording-transcript` |
| SQS Queue 1 | `dmg-inbound-callrecording-transcript-sqs-queue` |
| SQS DLQ 1 | `dmg-inbound-callrecording-transcript-sqs-dlq` |
| SQS Queue 2 | `dmg-inbound-callrecording-persistence-sqs-queue` |
| SQS DLQ 2 | `dmg-inbound-callrecording-persistence-sqs-dlq` |
| Lambda 1 | `dmg-inbound-callrecording-transcription` |
| Lambda 2 | `dmg-inbound-callrecording-persistence` |
| Lambda 3 | `dmg-inbound-callrecording-retrieval` |
| API Gateway | `dmg-inbound-callrecording-analytics-api` |
| DynamoDB Table | `{project}-{env}-call-recordings` |

## IAM Permissions Required

**Lambda 1**:
- SQS: ReceiveMessage, DeleteMessage
- Bedrock: InvokeDataAutomationAsync
- S3: PutObject (output bucket)

**Lambda 2**:
- SQS: ReceiveMessage, DeleteMessage
- S3: GetObject (output bucket)
- DynamoDB: PutItem

**Lambda 3**:
- DynamoDB: Query, Scan, GetItem

## File Locations

```
src/handlers/              - Lambda TypeScript code
terraform/                 - Infrastructure as code
template.yaml              - AWS SAM template
ARCHITECTURE.md            - Detailed architecture docs
DEPLOYMENT.md              - Deployment guide
PROJECT_COMPLETE.md        - Project summary
QUICK_REFERENCE.md         - This file
```
