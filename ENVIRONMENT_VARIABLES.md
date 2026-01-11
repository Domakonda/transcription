# Environment Variables Reference

This document lists all environment variables used by the Lambda functions and how they are configured.

## Lambda 1: dmg-inbound-callrecording-transcription

Invokes Bedrock Data Automation to process audio files.

| Variable | Description | Source | Default |
|----------|-------------|--------|---------|
| `S3_INPUT_BUCKET` | S3 bucket containing audio files | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_BUCKET` | S3 bucket for Bedrock outputs | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_PREFIX` | S3 prefix for outputs | `var.s3_output_prefix` | `transcription-outputs` |
| `BEDROCK_PROJECT_ARN` | Bedrock Data Automation project ARN | CloudFormation stack output | N/A |
| `BEDROCK_BLUEPRINT_STAGE` | Blueprint stage (DEVELOPMENT/LIVE) | `var.blueprint_stage` | `LIVE` |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name | `aws_dynamodb_table.call_recordings.name` | N/A |

## Lambda 2: dmg-inbound-callrecording-persistence

Reads Bedrock results from S3 and persists to DynamoDB.

| Variable | Description | Source | Default |
|----------|-------------|--------|---------|
| `S3_INPUT_BUCKET` | S3 bucket containing audio files | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_BUCKET` | S3 bucket with Bedrock outputs | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_PREFIX` | S3 prefix for outputs | `var.s3_output_prefix` | `transcription-outputs` |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name | `aws_dynamodb_table.call_recordings.name` | N/A |
| `BEDROCK_PROJECT_ARN` | Bedrock Data Automation project ARN | CloudFormation stack output | N/A |
| `BEDROCK_BLUEPRINT_STAGE` | Blueprint stage (DEVELOPMENT/LIVE) | `var.blueprint_stage` | `LIVE` |

## Lambda 3: dmg-inbound-callrecording-retrieval

Retrieves analytics data from DynamoDB via API Gateway.

| Variable | Description | Source | Default |
|----------|-------------|--------|---------|
| `DYNAMODB_TABLE_NAME` | DynamoDB table name | `aws_dynamodb_table.call_recordings.name` | N/A |
| `S3_INPUT_BUCKET` | S3 bucket containing audio files | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_BUCKET` | S3 bucket with Bedrock outputs | `var.s3_input_bucket_name` | `pgr-experiment-data` |
| `S3_OUTPUT_PREFIX` | S3 prefix for outputs | `var.s3_output_prefix` | `transcription-outputs` |
| `BEDROCK_PROJECT_ARN` | Bedrock Data Automation project ARN | CloudFormation stack output | N/A |
| `BEDROCK_BLUEPRINT_STAGE` | Blueprint stage (DEVELOPMENT/LIVE) | `var.blueprint_stage` | `LIVE` |
| `PAGINATION_DEFAULT_PAGE_SIZE` | Default page size for queries | `var.pagination_default_page_size` | `20` |
| `PAGINATION_MAX_PAGE_SIZE` | Maximum allowed page size | `var.pagination_max_page_size` | `100` |

## Terraform Variables

Configure these in your `terraform.tfvars` file or via command line:

### Infrastructure Variables

```hcl
# Basic Configuration
aws_region              = "us-east-1"
project_name            = "conversational-analytics"
environment             = "dev"  # dev, staging, or prod

# S3 Configuration
s3_input_bucket_name    = "pgr-experiment-data"
s3_output_prefix        = "transcription-outputs"

# Bedrock Configuration
blueprint_stage         = "LIVE"  # DEVELOPMENT or LIVE

# Lambda Configuration
lambda_runtime          = "nodejs20.x"
lambda_timeout          = 300
lambda_memory_size      = 512

# Pagination Configuration
pagination_default_page_size = 20   # 1-100
pagination_max_page_size     = 100  # 1-1000

# Encryption (optional)
kms_key_arn            = ""  # Leave empty for default encryption
```

### Example terraform.tfvars

```hcl
# Production Configuration
environment             = "prod"
blueprint_stage         = "LIVE"
lambda_memory_size      = 1024
pagination_default_page_size = 50
pagination_max_page_size     = 200
```

## Config Module

All Lambda functions import configuration from `src/config/index.ts`:

```typescript
export const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
  bedrock: {
    projectArn: process.env.BEDROCK_PROJECT_ARN || '',
    blueprintStage: process.env.BEDROCK_BLUEPRINT_STAGE || 'LIVE',
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
} as const;
```

## No Hardcoded Values

All previously hardcoded values have been moved to environment variables:

- ✅ `'LIVE'` → `config.bedrock.blueprintStage`
- ✅ `20` (page size) → `config.pagination.defaultPageSize`
- ✅ `100` (max page size) → `config.pagination.maxPageSize`

This allows you to:
1. Configure different values per environment (dev/staging/prod)
2. Modify settings via Terraform without code changes
3. Override values at deployment time
4. Test with different configurations
