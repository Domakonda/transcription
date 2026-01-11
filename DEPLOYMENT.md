# Deployment Guide

This guide provides step-by-step instructions for deploying the Bedrock Data Automation project to AWS.

## Prerequisites Checklist

- [ ] AWS Account with admin or sufficient IAM permissions
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Node.js 20.x installed
- [ ] Yarn package manager installed
- [ ] Terraform 1.14+ installed
- [ ] Bedrock Data Automation enabled in your AWS region

## Step 1: Clone and Setup

```bash
# Navigate to project directory
cd bedrock-data-automation

# Install dependencies
yarn install

# Verify installation
yarn build
```

## Step 2: Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity
```

## Step 3: Configure Terraform Variables

```bash
cd terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
nano terraform.tfvars  # or use your preferred editor
```

### Required Variables

Update these values in `terraform.tfvars`:

```hcl
# Your AWS region
aws_region = "us-east-1"

# Project configuration
project_name = "conversational-analytics"
environment  = "dev"

# S3 bucket names (MUST BE GLOBALLY UNIQUE)
s3_input_bucket_name  = "your-company-audio-input-20240101"
s3_output_bucket_name = "your-company-audio-output-20240101"

# Optional: KMS key for encryption
kms_key_arn = ""  # Leave empty for default S3 encryption

# Bedrock configuration
blueprint_stage = "LIVE"
```

## Step 4: Build Lambda Functions

```bash
# Return to root directory
cd ..

# Clean and build
yarn clean
yarn build

# Verify dist/ folder was created
ls dist/
```

## Step 5: Initialize Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Verify providers are downloaded
ls .terraform/providers/
```

## Step 6: Review Terraform Plan

```bash
# Generate and review the plan
terraform plan

# Review output carefully
# Expected resources: ~30-40 resources
```

### Expected Resources to be Created

- 2 S3 Buckets (input, output)
- 3 Lambda Functions (s3-trigger, s3-output-trigger, api-get-analytics)
- 1 DynamoDB Table
- 1 API Gateway REST API
- 1 CloudFormation Stack (Bedrock resources)
- IAM Roles and Policies
- CloudWatch Log Groups
- S3 Event Notifications

## Step 7: Deploy Infrastructure

```bash
# Apply Terraform configuration
terraform apply

# Type 'yes' when prompted
# Deployment takes approximately 5-10 minutes
```

## Step 8: Verify Deployment

### Check Outputs

After successful deployment, Terraform will display outputs:

```
Outputs:

api_gateway_url = "https://abc123.execute-api.us-east-1.amazonaws.com/dev/analytics/{hash}"
bedrock_blueprint_arn = "arn:aws:bedrock:us-east-1:123456789012:blueprint/..."
bedrock_project_arn = "arn:aws:bedrock:us-east-1:123456789012:data-automation-project/..."
dynamodb_table_name = "conversational-analytics-dev-call-recordings"
s3_input_bucket = "your-company-audio-input-20240101"
s3_output_bucket = "your-company-audio-output-20240101"
```

### Verify Resources in AWS Console

1. **S3 Buckets**: Check both input and output buckets exist
2. **Lambda Functions**: Verify 3 functions are deployed
3. **DynamoDB**: Check table is created with correct schema
4. **API Gateway**: Verify API is deployed to 'dev' stage
5. **CloudFormation**: Check Bedrock stack is CREATE_COMPLETE

### Test Lambda Functions

```bash
# Test S3 trigger function
aws lambda invoke \
  --function-name conversational-analytics-dev-s3-trigger \
  --payload '{"test": true}' \
  response.json

# Check response
cat response.json
```

## Step 9: Test End-to-End

### Upload Test Audio File

```bash
# Upload a test audio file
aws s3 cp test-audio.mp3 s3://your-company-audio-input-20240101/test-audio.mp3

# Monitor Lambda logs
aws logs tail /aws/lambda/conversational-analytics-dev-s3-trigger --follow
```

### Check Processing

```bash
# Wait for Bedrock processing (typically 30-60 seconds for short audio)
# Check output bucket for results
aws s3 ls s3://your-company-audio-output-20240101/test-audio/

# You should see results.json file
```

### Query API

```bash
# Calculate hash of your file name
# For test-audio: hash=$(echo -n "test-audio" | md5sum | cut -d' ' -f1)

# Query API
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/analytics/{hash}
```

## Step 10: Set Up Monitoring

### CloudWatch Dashboards

Create a CloudWatch dashboard to monitor:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name conversational-analytics-dev \
  --dashboard-body file://cloudwatch-dashboard.json
```

### CloudWatch Alarms

Set up alarms for:
- Lambda errors
- API Gateway 5xx errors
- DynamoDB throttling
- S3 event notification failures

```bash
# Example: Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name conversational-analytics-dev-lambda-errors \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

## Updating the Infrastructure

### Update Lambda Code Only

```bash
# Make code changes
# Build
yarn build

# Update Lambda functions
cd terraform
terraform apply -target=aws_lambda_function.s3_trigger
terraform apply -target=aws_lambda_function.s3_output_trigger
terraform apply -target=aws_lambda_function.api_get_analytics
```

### Update Infrastructure Configuration

```bash
# Edit terraform.tfvars
nano terraform/terraform.tfvars

# Apply changes
cd terraform
terraform plan
terraform apply
```

## Rollback Procedure

If deployment fails or you need to rollback:

```bash
# Review current state
terraform show

# Destroy specific resource
terraform destroy -target=resource_type.resource_name

# Or destroy everything
terraform destroy
```

## Troubleshooting Deployment

### Issue: S3 Bucket Name Already Exists

**Error**: "BucketAlreadyExists"

**Solution**: S3 bucket names must be globally unique. Change bucket names in `terraform.tfvars`:

```hcl
s3_input_bucket_name  = "your-company-audio-input-20240101-v2"
s3_output_bucket_name = "your-company-audio-output-20240101-v2"
```

### Issue: Insufficient Permissions

**Error**: "User is not authorized to perform: bedrock:CreateDataAutomationProject"

**Solution**: Ensure your IAM user/role has Bedrock permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:*",
        "lambda:*",
        "s3:*",
        "dynamodb:*",
        "apigateway:*",
        "iam:*",
        "cloudformation:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Issue: Lambda Package Too Large

**Error**: "InvalidParameterValueException: Unzipped size must be smaller than..."

**Solution**: Ensure you're only packaging necessary files:

```bash
yarn clean
yarn build
cd dist
ls -lh  # Check size
```

### Issue: Bedrock Not Available in Region

**Error**: "Bedrock service is not available in region"

**Solution**: Use a region where Bedrock is available (us-east-1, us-west-2, etc.):

```hcl
aws_region = "us-east-1"
```

## Post-Deployment Tasks

### 1. Set Up Budget Alerts

```bash
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json
```

### 2. Enable AWS Config

Monitor compliance and configuration changes:

```bash
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=ROLE_ARN \
  --recording-group allSupported=true
```

### 3. Set Up Backup

Enable DynamoDB point-in-time recovery (already enabled by Terraform):

```bash
# Verify backup is enabled
aws dynamodb describe-continuous-backups \
  --table-name conversational-analytics-dev-call-recordings
```

### 4. Document API Endpoints

Share the API Gateway URL with your team:

```bash
terraform output api_gateway_url
```

## Production Deployment

For production deployment:

1. Use separate AWS account or VPC
2. Enable VPC endpoints for private connectivity
3. Use custom domain for API Gateway
4. Enable WAF for API Gateway
5. Set up multi-region replication
6. Implement CI/CD pipeline
7. Use Terraform remote state with S3 + DynamoDB locking

### Production terraform.tfvars Example

```hcl
aws_region     = "us-east-1"
project_name   = "conversational-analytics"
environment    = "prod"

s3_input_bucket_name  = "company-prod-audio-input"
s3_output_bucket_name = "company-prod-audio-output"

kms_key_arn = "arn:aws:kms:us-east-1:123456789012:key/your-key-id"

lambda_memory_size = 1024
lambda_timeout     = 600

tags = {
  Project     = "bedrock-data-automation"
  Environment = "production"
  ManagedBy   = "terraform"
  Owner       = "data-team"
  CostCenter  = "engineering"
}
```

## Cleanup

To completely remove all resources:

```bash
cd terraform

# Destroy all resources
terraform destroy

# Type 'yes' when prompted
# This will delete all resources including S3 buckets and DynamoDB tables

# Clean local build artifacts
cd ..
yarn clean
rm -rf node_modules
```

## Support and Maintenance

- Monitor CloudWatch Logs daily
- Review AWS Cost Explorer weekly
- Update Lambda runtimes as needed
- Rotate IAM credentials regularly
- Keep Terraform version updated
- Review security findings from AWS Security Hub

## Next Steps

- [ ] Set up CI/CD pipeline
- [ ] Configure custom domain
- [ ] Enable AWS X-Ray tracing
- [ ] Implement comprehensive monitoring
- [ ] Set up automated backups
- [ ] Create disaster recovery plan
- [ ] Document API endpoints with Swagger/OpenAPI
