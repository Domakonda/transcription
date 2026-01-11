# Mono Repo Deployment Guide

This project follows a **mono repo architecture** with **separate infrastructure and application deployments**.

## 🏗️ Architecture Philosophy

- **Infrastructure (Terraform)**: Manages AWS resources independently of application code
- **Application Code**: Built and deployed separately to Lambda functions
- **Decoupling**: Infrastructure can be provisioned without application code, and vice versa

---

## 📂 Directory Structure

```
bedrock-data-automation/
│
├── terraform/                          # Infrastructure layer
│   ├── *.tf                           # Terraform resource definitions
│   ├── lambda_placeholder.zip         # Minimal Lambda for initial deploy
│   ├── create_placeholder_lambda.bat  # Script to generate placeholder
│   └── terraform.tfvars               # Environment-specific variables
│
├── application/                        # Application layer (microservices)
│   ├── com_library/                   # Shared libraries
│   │   ├── config/index.ts
│   │   └── types/index.ts
│   └── inbound/callrecording/
│       ├── dmg-inbound-callrecording-transcription/
│       │   ├── src/index.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── dmg-inbound-callrecording-persistence/
│       └── dmg-inbound-callrecording-retrieval/
│
└── src/                                # Legacy monolithic structure (optional)
```

---

## 🚀 Deployment Workflow

### **Phase 1: Infrastructure Deployment (Terraform)**

Deploy AWS infrastructure **without application code**:

#### **Step 1: Create Placeholder Lambda**

```bash
# Windows
cd terraform
create_placeholder_lambda.bat

# Linux/Mac
cd terraform
bash create_placeholder_lambda.sh
```

This creates `lambda_placeholder.zip` with a minimal Lambda function.

#### **Step 2: Initialize Terraform**

```bash
cd terraform
terraform init
```

#### **Step 3: Configure Variables**

Create `terraform.tfvars`:

```hcl
aws_region            = "us-east-1"
project_name          = "conversational-analytics"
environment           = "dev"
s3_output_bucket_name = "my-bedrock-output-bucket"
```

#### **Step 4: Deploy Infrastructure**

```bash
# Preview changes
terraform plan -var-file="terraform.tfvars"

# Deploy
terraform apply -var-file="terraform.tfvars"
```

**What Gets Created:**
- ✅ SNS Topic
- ✅ 2 SQS Queues + 2 Dead Letter Queues
- ✅ 3 Lambda Functions (with placeholder code)
- ✅ DynamoDB Table
- ✅ S3 Buckets
- ✅ API Gateway
- ✅ IAM Roles & Policies
- ✅ CloudWatch Log Groups
- ✅ Bedrock Data Automation Project (CloudFormation)

**Lambda Status:** Functions exist but contain placeholder code that logs events.

---

### **Phase 2: Application Code Deployment**

Build and deploy **actual Lambda code** to replace placeholders:

#### **Option A: Deploy All Lambdas (Monolithic Build)**

```bash
# From project root
cd bedrock-data-automation

# Install dependencies
yarn install

# Build TypeScript to JavaScript
yarn build

# This creates dist/ directory with compiled code
```

**Deploy to Lambda 1 (Materialization):**
```bash
cd dist
zip -r lambda-materialization.zip .
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://lambda-materialization.zip
```

**Deploy to Lambda 2 (Persistence):**
```bash
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-persistence \
  --zip-file fileb://lambda-materialization.zip
```

**Deploy to Lambda 3 (Retrieval):**
```bash
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-retrieval \
  --zip-file fileb://lambda-materialization.zip
```

---

#### **Option B: Deploy Individual Lambdas (Microservices)**

Each Lambda has its own `package.json` and can be built/deployed independently:

**Lambda 1: Materialization**
```bash
cd application/inbound/callrecording/dmg-inbound-callrecording-transcription

# Install dependencies
npm install

# Build TypeScript
npm run build

# Package with dependencies
zip -r lambda.zip dist/ node_modules/

# Deploy
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://lambda.zip
```

**Repeat for Lambda 2 and Lambda 3** with their respective directories.

---

### **Phase 3: Verify Deployment**

#### **Check Lambda Functions**
```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `dmg-inbound`)].FunctionName'
```

#### **Check Infrastructure**
```bash
# SQS Queues
aws sqs list-queues | grep dmg-inbound

# DynamoDB Table
aws dynamodb describe-table --table-name conversational-analytics-dev-call-recordings

# API Gateway
aws apigateway get-rest-apis --query 'items[?name==`analytics-api`]'
```

#### **Test API Endpoint**
```bash
# Get API endpoint from Terraform output
terraform output api_gateway_invoke_url

# Test
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/analytics
```

---

## 🔄 CI/CD Integration

### **GitHub Actions Example**

```yaml
name: Deploy Infrastructure and Application

on:
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Create Placeholder Lambda
        run: |
          cd terraform
          bash create_placeholder_lambda.sh

      - name: Terraform Init
        run: cd terraform && terraform init

      - name: Terraform Apply
        run: cd terraform && terraform apply -auto-approve
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-lambdas:
    needs: terraform
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Build Application
        run: |
          yarn install
          yarn build

      - name: Package Lambda
        run: |
          cd dist
          zip -r lambda.zip .

      - name: Deploy to Lambda
        run: |
          aws lambda update-function-code \
            --function-name dmg-inbound-callrecording-transcription \
            --zip-file fileb://dist/lambda.zip
```

---

## 🎯 Key Benefits of This Approach

1. **Infrastructure Independence**: Deploy infrastructure without waiting for application code
2. **Rapid Prototyping**: Test infrastructure with placeholder code before finalizing logic
3. **Separate Versioning**: Infrastructure and application can be versioned independently
4. **Team Autonomy**: Infrastructure team and application team can work in parallel
5. **Rollback Flexibility**: Rollback application code without touching infrastructure
6. **Testing**: Deploy infrastructure to test environment, then promote application code

---

## 📋 Common Commands

### **Infrastructure Only**
```bash
# Deploy infrastructure
cd terraform && terraform apply

# Destroy infrastructure
cd terraform && terraform destroy
```

### **Application Only**
```bash
# Build application
yarn build

# Deploy Lambda 1
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://dist/lambda.zip
```

### **Full Deployment**
```bash
# 1. Create placeholder
cd terraform && bash create_placeholder_lambda.sh

# 2. Deploy infrastructure
terraform apply -auto-approve

# 3. Build application
cd .. && yarn build

# 4. Deploy application code
cd dist && zip -r lambda.zip .
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://lambda.zip
```

---

## 🔐 Security Notes

- Placeholder Lambda has **no access** to sensitive data
- IAM roles are **pre-configured** during infrastructure deployment
- Application code inherits infrastructure permissions
- Environment variables injected by Terraform, not hardcoded

---

## 🐛 Troubleshooting

### **Error: lambda_placeholder.zip not found**
```bash
cd terraform
create_placeholder_lambda.bat  # Windows
bash create_placeholder_lambda.sh  # Linux/Mac
```

### **Error: dist/ directory not found**
```bash
cd bedrock-data-automation
yarn install
yarn build
```

### **Lambda shows "Placeholder Lambda" in logs**
You haven't deployed application code yet. Run:
```bash
cd dist
zip -r lambda.zip .
aws lambda update-function-code --function-name <name> --zip-file fileb://lambda.zip
```

---

## 📞 Support

For issues or questions, check:
- [README.md](README.md) - Main project documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture details
- [DEPLOYMENT.md](DEPLOYMENT.md) - Traditional deployment guide
