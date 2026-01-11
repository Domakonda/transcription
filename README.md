# Bedrock Data Automation - Conversational Analytics

A production-ready AWS Bedrock Data Automation project built with TypeScript, Terraform, and AWS SAM for processing audio files and extracting conversational analytics.

## Architecture

This project implements an event-driven serverless architecture for audio conversational analytics:

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────┐
│ Audio File  │────▶│ Lambda 1 │────▶│   Bedrock   │────▶│   S3    │────▶│ Lambda 2 │
│ (S3 Input)  │     │(Trigger) │     │ Automation  │     │ Output  │     │(Process) │
└─────────────┘     └──────────┘     └─────────────┘     └─────────┘     └──────────┘
                                                                                  │
                                                                                  ▼
                                                                          ┌──────────────┐
                                                                          │  DynamoDB    │
                                                                          │   (Store)    │
                                                                          └──────────────┘
                                                                                  │
                                                                                  ▼
                    ┌──────────┐     ┌──────────┐     ┌──────────────────────────┐
                    │ Web/CLI  │◀────│   API    │◀────│     Lambda 3             │
                    │  Client  │     │ Gateway  │     │  (Retrieve Analytics)    │
                    └──────────┘     └──────────┘     └──────────────────────────┘
```

### Workflow

1. **Audio Upload**: Audio file uploaded to S3 input bucket
2. **Bedrock Invocation**: Lambda triggered by S3 event, invokes Bedrock Data Automation
3. **Processing**: Bedrock processes audio and extracts:
   - Call summary
   - Call categories
   - Topics
   - Transcript
   - Audio summary
   - Content moderation
4. **Results Storage**: Bedrock writes results.json to S3 output bucket
5. **DynamoDB Write**: Lambda triggered by results.json, parses and stores in DynamoDB
6. **API Retrieval**: REST API endpoint to query analytics by hash

## Features

- Event-driven serverless architecture
- TypeScript Lambda functions with strict typing
- Terraform infrastructure as code
- AWS SAM for local development and testing
- ESLint configuration for code quality
- Comprehensive error handling
- CORS-enabled REST API
- Encrypted S3 buckets with versioning
- DynamoDB with point-in-time recovery
- CloudWatch logging and monitoring

## Prerequisites

- Node.js 20.x or later
- Yarn package manager
- AWS CLI configured with appropriate credentials
- Terraform 1.14 or later
- AWS SAM CLI (for local testing)
- AWS Account with Bedrock Data Automation enabled

## Project Structure

```
bedrock-data-automation/
├── src/
│   ├── handlers/
│   │   ├── s3-trigger.ts              # Invokes Bedrock on audio upload
│   │   ├── s3-output-trigger.ts       # Processes results and writes to DynamoDB
│   │   └── api-get-analytics.ts       # API endpoint handler
│   ├── types/
│   │   └── index.ts                   # TypeScript type definitions
│   └── config/
│       └── index.ts                   # Environment configuration
├── terraform/
│   ├── providers.tf                   # Terraform providers
│   ├── variables.tf                   # Input variables
│   ├── locals.tf                      # Local values
│   ├── s3.tf                          # S3 buckets and notifications
│   ├── lambda.tf                      # Lambda functions
│   ├── iam.tf                         # IAM roles and policies
│   ├── dynamodb.tf                    # DynamoDB table
│   ├── apigateway.tf                  # API Gateway configuration
│   ├── bedrock.tf                     # Bedrock CloudFormation stack
│   ├── bedrock_data_automation_template.yaml
│   └── terraform.tfvars.example       # Example variables
├── template.yaml                      # AWS SAM template
├── package.json                       # Node.js dependencies and scripts
├── tsconfig.json                      # TypeScript configuration
├── eslint.config.js                   # ESLint configuration
├── jest.config.js                     # Jest testing configuration
└── README.md                          # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd bedrock-data-automation
yarn install
```

### 2. Build TypeScript Code

```bash
yarn build
```

### 3. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your configuration:

```hcl
aws_region            = "us-east-1"
project_name          = "conversational-analytics"
environment           = "dev"
s3_input_bucket_name  = "your-unique-input-bucket-name"
s3_output_bucket_name = "your-unique-output-bucket-name"
```

### 4. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

### 5. Note Important Outputs

After deployment, Terraform will output:

- `bedrock_project_arn`: ARN of the Bedrock Data Automation project
- `api_gateway_url`: URL for the analytics API
- `dynamodb_table_name`: Name of the DynamoDB table
- `s3_input_bucket`: Input bucket name
- `s3_output_bucket`: Output bucket name

## Usage

### Upload Audio Files

Upload audio files (.mp3, .wav, .m4a) to the S3 input bucket:

```bash
aws s3 cp audio-file.mp3 s3://your-input-bucket/audio-file.mp3
```

This automatically:
1. Triggers Lambda to invoke Bedrock
2. Bedrock processes the audio
3. Results are written to S3 output bucket
4. Another Lambda processes results and stores in DynamoDB

### Query Analytics

Retrieve analytics using the REST API:

```bash
# Get analytics by hash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/analytics/{hash}
```

Example response:

```json
{
  "count": 1,
  "items": [
    {
      "hash": "abc123...",
      "epchdatetimestamp": 1704067200000,
      "s3_input_uri": "s3://input-bucket/audio-file.mp3",
      "s3_output_uri": "s3://output-bucket/audio-file/",
      "bedrock_status": "SUCCESS",
      "call_summary": "Customer called regarding billing inquiry...",
      "call_categories": ["Billing", "Customer service"],
      "topics": ["payment", "invoice", "account"],
      "transcript": "Full transcript text...",
      "audio_summary": "Summary of the conversation...",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Local Development with AWS SAM

### Build with SAM

```bash
sam build
```

### Test Lambda Functions Locally

#### Test S3 Trigger Lambda

```bash
sam local invoke S3TriggerFunction -e events/s3-event.json
```

#### Test API Gateway Lambda

```bash
sam local start-api
curl http://localhost:3000/analytics/abc123
```

#### Generate S3 Event

```bash
sam local generate-event s3 put --bucket test-bucket --key audio.mp3 > events/s3-event.json
```

### Test with DynamoDB Local

```bash
# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create table
aws dynamodb create-table \
  --table-name conversational-analytics-dev-call-recordings \
  --attribute-definitions \
    AttributeName=hash,AttributeType=S \
    AttributeName=epchdatetimestamp,AttributeType=N \
  --key-schema \
    AttributeName=hash,KeyType=HASH \
    AttributeName=epchdatetimestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

## Development Scripts

```bash
# Build TypeScript
yarn build

# Watch mode
yarn build:watch

# Lint code
yarn lint

# Fix linting issues
yarn lint:fix

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage

# Clean build artifacts
yarn clean

# Package for deployment
yarn package
```

## Testing

### Unit Tests

Create unit tests in `src/__tests__/` or alongside source files:

```typescript
// src/handlers/__tests__/api-get-analytics.test.ts
import { handler } from '../api-get-analytics';

describe('API Get Analytics Handler', () => {
  it('should return 400 for missing hash parameter', async () => {
    const event = {
      pathParameters: null,
    };

    const result = await handler(event as any);
    expect(result.statusCode).toBe(400);
  });
});
```

Run tests:

```bash
yarn test
```

### Integration Tests

Test end-to-end with AWS SAM:

```bash
sam local start-api &
curl http://localhost:3000/analytics/test-hash
```

## Deployment

### Deploy with Terraform

```bash
cd terraform
terraform apply
```

### Update Lambda Functions Only

After code changes:

```bash
# Build and package
yarn build
cd terraform
terraform apply -target=aws_lambda_function.s3_trigger
terraform apply -target=aws_lambda_function.s3_output_trigger
terraform apply -target=aws_lambda_function.api_get_analytics
```

## Monitoring and Logging

### CloudWatch Logs

View Lambda logs:

```bash
aws logs tail /aws/lambda/conversational-analytics-dev-s3-trigger --follow
aws logs tail /aws/lambda/conversational-analytics-dev-s3-output-trigger --follow
aws logs tail /aws/lambda/conversational-analytics-dev-api-analytics --follow
```

### API Gateway Logs

```bash
aws logs tail /aws/apigateway/conversational-analytics-dev-analytics-api --follow
```

### DynamoDB Metrics

Monitor DynamoDB in CloudWatch:
- Read/Write Capacity Units
- Throttled Requests
- System Errors

## Troubleshooting

### Lambda Execution Errors

Check CloudWatch Logs for detailed error messages:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/conversational-analytics-dev-s3-trigger \
  --filter-pattern "ERROR"
```

### Bedrock Invocation Failures

Common issues:
- Invalid project ARN
- Insufficient IAM permissions
- Unsupported audio format
- S3 access denied

### API Gateway 403 Errors

Check:
- Lambda execution role permissions
- API Gateway resource policy
- CORS configuration

## Cost Optimization

- Lambda: Pay per invocation and compute time
- S3: Pay for storage and requests
- DynamoDB: Using on-demand billing
- API Gateway: Pay per API call
- Bedrock: Pay per processing unit

### Estimated Monthly Costs (1000 audio files)

- Lambda: ~$1-5
- S3: ~$1-3
- DynamoDB: ~$1-2
- API Gateway: ~$3-5
- Bedrock: Variable based on usage

## Security Best Practices

- All S3 buckets have encryption enabled
- Public access blocked on all buckets
- IAM roles follow least privilege principle
- API Gateway uses AWS IAM authorization (configurable)
- CloudWatch Logs for audit trails
- VPC integration available (optional)

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests: `yarn test`
4. Run linter: `yarn lint`
5. Submit pull request

## License

ISC

## Support

For issues and questions:
- Check CloudWatch Logs
- Review Terraform apply output
- Verify IAM permissions
- Ensure Bedrock Data Automation is enabled in your region
