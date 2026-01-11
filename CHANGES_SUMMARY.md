# Changes Summary - Mono Repo Architecture

## 📅 Date: 2026-01-10

---

## ✅ Changes Made

### **1. SQS Queue Delay Configuration**
**File:** `terraform/sqs_dmg_inbound_callrecording_persistence.tf`
- Changed `delay_seconds` from **10** to **30 seconds**
- Both SQS queues now have 30-second delay
- Gives Bedrock more time to write complete results to S3

---

### **2. Bedrock CloudFormation Stack**
**File Created:** `terraform/dmg_inbound_callrecording_bda_cloudFormation_stack.tf`
- New Terraform file for Bedrock Data Automation
- Stack name: `bedrock-conversational-analytics-my-analytics-project`
- Includes `CAPABILITY_IAM` for IAM resource creation
- Simple tags: Environment=development, Project=conversational-analytics
- Outputs: `blueprint_arn`, `project_arn`

**File Deleted:** `terraform/bedrock.tf` (old version, replaced by new file)

---

### **3. Lambda Functions - Mono Repo Architecture**
Updated all 3 Lambda Terraform files to support independent infrastructure deployment:

#### **Files Modified:**
1. `terraform/lambda_dmg_inbound_callrecording_transcription.tf`
2. `terraform/lambda_dmg_inbound_callrecording_persistence.tf`
3. `terraform/lambda_dmg_inbound_callrecording_retrieval.tf`

#### **Changes:**
- ❌ Removed: `data.archive_file.lambda_zip` dependency on `../dist` directory
- ✅ Added: Reference to `lambda_placeholder.zip` for initial deployment
- ✅ Changed handler: From `handlers/filename.handler` to `index.handler`
- ✅ Changed source_code_hash: From `data.archive_file` to `filebase64sha256()`

**Before:**
```terraform
data "archive_file" "lambda_zip" {
  source_dir  = "${path.module}/../dist"  # ❌ Requires dist/ to exist
}

resource "aws_lambda_function" "..." {
  filename         = data.archive_file.lambda_zip.output_path
  handler          = "handlers/dmg-inbound-callrecording-transcription.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}
```

**After:**
```terraform
resource "aws_lambda_function" "..." {
  filename         = "${path.module}/lambda_placeholder.zip"
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder.zip")
}
```

---

### **4. Placeholder Lambda**
**Files Created:**
- `terraform/placeholder_lambda/index.js` - Minimal Lambda function
- `terraform/lambda_placeholder.zip` - Packaged placeholder (10 KB)
- `terraform/create_placeholder_lambda.bat` - Windows script to recreate placeholder
- `terraform/create_placeholder_lambda.sh` - Linux/Mac script to recreate placeholder

**Purpose:**
- Allows Terraform to deploy infrastructure without application code
- Logs events when invoked (for debugging)
- Returns HTTP 200 with placeholder message

---

### **5. Documentation**
**File Created:** `MONO_REPO_DEPLOYMENT.md`
- Complete guide for mono repo deployment workflow
- Explains infrastructure vs application separation
- Step-by-step deployment instructions
- CI/CD integration examples
- Troubleshooting guide

**File Created:** `CHANGES_SUMMARY.md` (this file)

---

## 🎯 What This Enables

### **Before (Tightly Coupled):**
```
Build Application → Terraform Deploy (fails if dist/ missing)
```

### **After (Decoupled):**
```
Phase 1: Terraform Deploy (with placeholders) → Infrastructure ready ✅
Phase 2: Build Application → Deploy code → Full functionality ✅
```

---

## 🚀 Deployment Commands

### **Deploy Infrastructure Only:**
```bash
cd terraform
terraform init
terraform apply -var="s3_output_bucket_name=my-bucket"
```

**Result:**
- ✅ All AWS infrastructure created
- ✅ Lambda functions exist with placeholder code
- ✅ API Gateway, SQS, SNS, DynamoDB ready
- ⏳ Awaiting application code deployment

---

### **Deploy Application Code:**

**Option 1: All Lambdas (Monolithic)**
```bash
cd bedrock-data-automation
yarn install
yarn build
cd dist
zip -r lambda.zip .

# Deploy to each Lambda
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://lambda.zip
```

**Option 2: Individual Lambdas (Microservices)**
```bash
cd application/inbound/callrecording/dmg-inbound-callrecording-transcription
npm install
npm run build
zip -r lambda.zip dist/ node_modules/

aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://lambda.zip
```

---

## 📊 Current Project Structure

```
bedrock-data-automation/
│
├── terraform/                                    # Infrastructure layer
│   ├── dmg_inbound_callrecording_bda_cloudFormation_stack.tf  ✅ NEW
│   ├── sqs_dmg_inbound_callrecording_persistence.tf           ✅ MODIFIED (delay: 30s)
│   ├── lambda_dmg_inbound_callrecording_transcription.tf    ✅ MODIFIED (placeholder)
│   ├── lambda_dmg_inbound_callrecording_persistence.tf        ✅ MODIFIED (placeholder)
│   ├── lambda_dmg_inbound_callrecording_retrieval.tf          ✅ MODIFIED (placeholder)
│   ├── lambda_placeholder.zip                                  ✅ NEW (10 KB)
│   ├── placeholder_lambda/index.js                             ✅ NEW
│   ├── create_placeholder_lambda.bat                           ✅ NEW
│   ├── create_placeholder_lambda.sh                            ✅ NEW
│   └── [other .tf files unchanged]
│
├── application/                                  # Application layer
│   └── [unchanged - ready for microservices build]
│
├── src/                                          # Monolithic structure
│   └── [unchanged - ready for monolithic build]
│
├── MONO_REPO_DEPLOYMENT.md                       ✅ NEW
├── CHANGES_SUMMARY.md                            ✅ NEW
└── [other files unchanged]
```

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] `terraform/lambda_placeholder.zip` exists (10 KB)
- [ ] No `terraform/bedrock.tf` file (should be deleted)
- [ ] `terraform/dmg_inbound_callrecording_bda_cloudFormation_stack.tf` exists
- [ ] SQS persistence queue has `delay_seconds = 30`
- [ ] All 3 Lambda .tf files reference `lambda_placeholder.zip`

---

## 🔍 Testing Steps

### **1. Test Infrastructure Deployment:**
```bash
cd terraform
terraform init
terraform plan -var="s3_output_bucket_name=test-bucket"
```

**Expected:** No errors, shows resources to create

### **2. Test Placeholder Lambda (After Deploy):**
```bash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-transcription \
  --payload '{"test": true}' \
  response.json

cat response.json
```

**Expected:**
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Placeholder Lambda - deploy application code to activate\",...}"
}
```

### **3. Test Application Deployment:**
```bash
cd bedrock-data-automation
yarn build
# Should create dist/ directory with .js files
```

---

## 🎓 Key Concepts

### **Placeholder Lambda**
- Minimal JavaScript function
- Logs events for debugging
- Returns success response
- Allows infrastructure provisioning without real code

### **Decoupled Deployment**
- Infrastructure = Terraform managed
- Application = Separate build & deploy
- Can update infrastructure without touching app
- Can update app without touching infrastructure

### **Mono Repo Benefits**
- Single repository for all code
- Shared configuration
- Independent versioning
- Parallel development

---

## 📞 Next Steps

1. **Test infrastructure deployment:**
   ```bash
   cd terraform
   terraform init
   terraform plan -var="s3_output_bucket_name=your-bucket-name"
   ```

2. **If successful, apply:**
   ```bash
   terraform apply -var="s3_output_bucket_name=your-bucket-name"
   ```

3. **Build and deploy application:**
   ```bash
   cd ..
   yarn install
   yarn build
   # Then deploy to Lambda functions
   ```

4. **Verify end-to-end flow:**
   - Send test message to SNS
   - Check Lambda logs in CloudWatch
   - Verify DynamoDB record creation
   - Test API Gateway endpoint

---

## 🐛 Troubleshooting

### **Error: lambda_placeholder.zip not found**
```bash
cd terraform/placeholder_lambda
tar -a -c -f ../lambda_placeholder.zip index.js
```

### **Terraform shows both bedrock.tf and dmg_inbound_callrecording_bda_cloudFormation_stack.tf**
Delete the old file:
```bash
cd terraform
rm bedrock.tf
```

### **Lambda still references dist/ directory**
Check that all 3 Lambda .tf files have been updated to use `lambda_placeholder.zip`

---

## ✨ Summary

You can now:
- ✅ Deploy infrastructure **without** building application code
- ✅ Test infrastructure with placeholder Lambdas
- ✅ Deploy application code independently
- ✅ Update infrastructure and application on different schedules
- ✅ Support both monolithic and microservices build patterns

The infrastructure is **ready for deployment** with `terraform apply`!
