# S3 Bucket Configuration - Existing Bucket Setup

## 📦 Overview

This project now uses your **existing S3 bucket** (`pgr-experiment-data`) for both input audio files and transcription outputs, with outputs stored in a dedicated subfolder.

---

## 🏗️ **S3 Bucket Structure**

### **Bucket:** `pgr-experiment-data`
**ARN:** `arn:aws:s3:::pgr-experiment-data`

```
pgr-experiment-data/
│
├── [your existing files/folders]
│   └── audio-files/              # Your existing audio files (example)
│       ├── call-001.mp3
│       ├── call-002.wav
│       └── ...
│
└── transcription-outputs/         # NEW: Bedrock results go here
    ├── call-001/
    │   └── results.json
    ├── call-002/
    │   └── results.json
    └── ...
```

---

## 🎯 **How It Works**

### **Input Flow (Audio Files)**
1. Audio files exist anywhere in `pgr-experiment-data` bucket
2. External system sends SNS message with S3 URI: `s3://pgr-experiment-data/path/to/audio.mp3`
3. Lambda 1 (Materialization) receives message
4. Bedrock processes the audio from the input S3 URI

### **Output Flow (Transcription Results)**
1. Bedrock writes results to: `s3://pgr-experiment-data/transcription-outputs/call-id/results.json`
2. S3 event notification triggers SQS queue (filtered to `transcription-outputs/` prefix)
3. Lambda 2 (Persistence) reads results from S3
4. Lambda 2 writes analytics to DynamoDB

---

## 📂 **S3 Path Examples**

### **Input Audio (Flexible Location)**
```
s3://pgr-experiment-data/audio/2024/01/call-123.mp3
s3://pgr-experiment-data/recordings/call-456.wav
s3://pgr-experiment-data/any/path/you/want/audio.mp3
```

### **Output Transcriptions (Fixed Location)**
```
s3://pgr-experiment-data/transcription-outputs/call-123/results.json
s3://pgr-experiment-data/transcription-outputs/call-456/results.json
```

---

## ⚙️ **Terraform Configuration Changes**

### **1. Variables ([variables.tf](terraform/variables.tf))**

**Added:**
```hcl
variable "s3_input_bucket_name" {
  description = "Existing S3 bucket name containing audio files"
  type        = string
  default     = "pgr-experiment-data"
}

variable "s3_output_prefix" {
  description = "S3 prefix (subfolder) for Bedrock transcription outputs"
  type        = string
  default     = "transcription-outputs"
}
```

**Removed:**
```hcl
variable "s3_output_bucket_name"  # No longer needed
```

---

### **2. S3 Configuration ([s3_dmg_inbound_callrecording_persistence.tf](terraform/s3_dmg_inbound_callrecording_persistence.tf))**

**Before (Created New Bucket):**
```hcl
resource "aws_s3_bucket" "output" {
  bucket = var.s3_output_bucket_name
  # ... versioning, encryption, etc.
}
```

**After (References Existing Bucket):**
```hcl
data "aws_s3_bucket" "existing_bucket" {
  bucket = var.s3_input_bucket_name  # pgr-experiment-data
}
```

**Key Changes:**
- ✅ No longer creates a new S3 bucket
- ✅ References your existing bucket via `data` source
- ✅ Assumes encryption/versioning already configured
- ✅ S3 notification filters by `transcription-outputs/` prefix

---

### **3. S3 Event Notification**

**Configuration:**
```hcl
resource "aws_s3_bucket_notification" "output_notification" {
  bucket = data.aws_s3_bucket.existing_bucket.id

  queue {
    queue_arn     = aws_sqs_queue.dmg_inbound_callrecording_persistence.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "transcription-outputs/"   # Only trigger for this subfolder
    filter_suffix = "results.json"              # Only for results files
  }
}
```

**What This Does:**
- Triggers SQS message ONLY when files are created in `transcription-outputs/` with `.json` extension
- Ignores all other files in the bucket (won't interfere with existing workflows)

---

### **4. Lambda Environment Variables**

**Lambda 1 (Materialization):**
```hcl
environment {
  variables = {
    S3_INPUT_BUCKET     = "pgr-experiment-data"
    S3_OUTPUT_BUCKET    = "pgr-experiment-data"
    S3_OUTPUT_PREFIX    = "transcription-outputs"
    BEDROCK_PROJECT_ARN = "..."
  }
}
```

**Lambda 2 (Persistence):**
```hcl
environment {
  variables = {
    S3_INPUT_BUCKET     = "pgr-experiment-data"
    S3_OUTPUT_BUCKET    = "pgr-experiment-data"
    S3_OUTPUT_PREFIX    = "transcription-outputs"
    DYNAMODB_TABLE_NAME = "..."
  }
}
```

---

### **5. IAM Permissions**

**S3 Permissions:**
```hcl
{
  Effect = "Allow"
  Action = [
    "s3:GetObject",
    "s3:PutObject",
    "s3:ListBucket"
  ]
  Resource = [
    "arn:aws:s3:::pgr-experiment-data",
    "arn:aws:s3:::pgr-experiment-data/*"
  ]
}
```

**What Lambdas Can Do:**
- ✅ Read audio files from anywhere in the bucket
- ✅ Write results to `transcription-outputs/` subfolder
- ✅ List bucket contents

---

## 🚀 **Deployment**

### **No Additional Configuration Needed!**

The default values are already set:

```bash
cd terraform
terraform init
terraform apply
```

Terraform will:
- ✅ Use existing bucket `pgr-experiment-data`
- ✅ Create S3 notification for `transcription-outputs/` prefix
- ✅ Set up Lambdas with correct bucket references
- ✅ Configure IAM permissions for the bucket

---

### **Optional: Customize Subfolder Name**

If you want a different subfolder name (e.g., `bedrock-outputs`):

**Create `terraform/terraform.tfvars`:**
```hcl
s3_output_prefix = "bedrock-outputs"
```

Then deploy:
```bash
terraform apply
```

---

## 📋 **Application Code Updates**

Your Lambda application code should construct S3 URIs like this:

### **Lambda 1 (Materialization) - TypeScript Example:**

```typescript
import { config } from '../config';

// Input: audioS3Uri from SNS message
const audioS3Uri = snsMessage.audioS3Uri; // e.g., s3://pgr-experiment-data/audio/call-123.mp3

// Output: Construct Bedrock output path
const callId = extractCallId(audioS3Uri); // e.g., "call-123"
const outputS3Uri = `s3://${config.s3.outputBucket}/${config.s3.outputPrefix}/${callId}/`;
// Result: s3://pgr-experiment-data/transcription-outputs/call-123/

// Invoke Bedrock
const command = new InvokeDataAutomationAsyncCommand({
  dataAutomationConfiguration: {
    dataAutomationArn: config.bedrock.projectArn,
    stage: 'LIVE',
  },
  inputConfiguration: {
    s3Uri: audioS3Uri,  // Input from anywhere in bucket
  },
  outputConfiguration: {
    s3Uri: outputS3Uri,  // Output to transcription-outputs/
  },
});
```

### **Lambda 2 (Persistence) - Reading Results:**

```typescript
// S3 event provides the key
const s3Key = s3Event.s3.object.key;
// e.g., "transcription-outputs/call-123/results.json"

// Extract call ID from path
const callId = s3Key.split('/')[1];  // "call-123"

// Read results
const getCommand = new GetObjectCommand({
  Bucket: config.s3.outputBucket,  // pgr-experiment-data
  Key: s3Key,
});

const response = await s3Client.send(getCommand);
const results = JSON.parse(await response.Body.transformToString());
```

---

## ✅ **Verification Checklist**

After deployment, verify:

### **1. S3 Notification Configuration**
```bash
aws s3api get-bucket-notification-configuration \
  --bucket pgr-experiment-data
```

**Expected Output:**
```json
{
  "QueueConfigurations": [
    {
      "QueueArn": "arn:aws:sqs:us-east-1:...:dmg-inbound-callrecording-persistence-sqs-queue",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "prefix",
              "Value": "transcription-outputs/"
            },
            {
              "Name": "suffix",
              "Value": "results.json"
            }
          ]
        }
      }
    }
  ]
}
```

### **2. Lambda Environment Variables**
```bash
aws lambda get-function-configuration \
  --function-name dmg-inbound-callrecording-transcription \
  --query 'Environment.Variables'
```

**Expected Output:**
```json
{
  "S3_INPUT_BUCKET": "pgr-experiment-data",
  "S3_OUTPUT_BUCKET": "pgr-experiment-data",
  "S3_OUTPUT_PREFIX": "transcription-outputs",
  "BEDROCK_PROJECT_ARN": "arn:aws:bedrock:..."
}
```

### **3. IAM Permissions**
```bash
aws iam get-role-policy \
  --role-name conversational-analytics-dev-lambda-execution-role \
  --policy-name conversational-analytics-dev-lambda-custom-policy
```

**Check:** S3 actions include `pgr-experiment-data` ARN

---

## 🔍 **Testing**

### **Test S3 Notification**

Create a test file in the output folder:

```bash
echo '{"test": "data"}' > test-results.json

aws s3 cp test-results.json \
  s3://pgr-experiment-data/transcription-outputs/test-call-001/results.json
```

**Check SQS Queue:**
```bash
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/.../dmg-inbound-callrecording-persistence-sqs-queue \
  --max-number-of-messages 1
```

**Expected:** Message appears with S3 event details

---

## 🛡️ **Security Notes**

1. **Existing Bucket Permissions:** Terraform does NOT modify your existing bucket's:
   - Versioning configuration
   - Encryption settings
   - Public access blocks
   - Lifecycle policies
   - CORS rules

2. **Lambda IAM Role:** Has permissions to:
   - ✅ Read/write entire bucket
   - ✅ List bucket contents
   - ❌ Delete objects (not granted)
   - ❌ Modify bucket configuration (not granted)

3. **S3 Notifications:** Only triggers for files in `transcription-outputs/` subfolder
   - Won't affect other files or workflows in the bucket

---

## 📊 **Cost Impact**

Using an existing bucket instead of creating a new one:
- ✅ **Lower cost** - No additional storage charges for a second bucket
- ✅ **Simpler management** - Everything in one bucket
- ✅ **S3 notifications** - Free (first 1,000 events/month, then $0.001 per 1,000 events)

---

## 🐛 **Troubleshooting**

### **Error: Bucket Does Not Exist**
```
Error: NoSuchBucket: The specified bucket does not exist
```

**Solution:** Verify bucket name in [variables.tf](terraform/variables.tf):
```hcl
variable "s3_input_bucket_name" {
  default = "pgr-experiment-data"  # Check this matches your bucket name
}
```

---

### **Error: Access Denied (S3 Notification)**
```
Error: AccessDenied: Access Denied
```

**Cause:** Terraform tries to configure S3 notifications but lacks permissions

**Solution:** Ensure your AWS credentials have:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetBucketNotification",
    "s3:PutBucketNotification"
  ],
  "Resource": "arn:aws:s3:::pgr-experiment-data"
}
```

---

### **S3 Notification Not Triggering**

**Check:**
1. Files are created in `transcription-outputs/` subfolder ✓
2. Files end with `.json` extension ✓
3. SQS queue policy allows S3 to send messages ✓

**Debug:**
```bash
# Check notification configuration
aws s3api get-bucket-notification-configuration --bucket pgr-experiment-data

# Check SQS queue for messages
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All
```

---

## 📝 **Summary**

✅ **Uses existing bucket:** `pgr-experiment-data`
✅ **Subfolder for outputs:** `transcription-outputs/`
✅ **No bucket creation:** Terraform references existing bucket
✅ **Filtered notifications:** Only triggers for output files
✅ **Backward compatible:** Doesn't affect existing files/workflows
✅ **Ready to deploy:** Default configuration already set

Your bucket structure remains intact, and transcription outputs are neatly organized in a dedicated subfolder!
