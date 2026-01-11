# Terraform Import Guide - Handling Existing Resources

## 🎯 Problem

You have existing AWS resources that need to be imported into Terraform state instead of being created fresh.

---

## ✅ **Quick Fix Commands**

Run these commands in order to import existing resources:

### **1. Import CloudFormation Stack**
```bash
cd terraform

terraform import aws_cloudformation_stack.bedrock_data_automation bedrock-conversational-analytics-my-analytics-project
```

### **2. Import SNS Topic**
```bash
# Get the topic ARN first
aws sns list-topics | grep dmg-inbound-callrecording-transcript

# Import (replace with actual ARN)
terraform import aws_sns_topic.dmg_inbound_callrecording_transcript arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:dmg-inbound-callrecording-transcript
```

### **3. Import SQS Queues**
```bash
# Get queue URLs
aws sqs list-queues | grep dmg-inbound-callrecording

# Import main queue
terraform import aws_sqs_queue.dmg_inbound_callrecording_transcript https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/dmg-inbound-callrecording-transcript-sqs-queue

# Import DLQ
terraform import aws_sqs_queue.dmg_inbound_callrecording_transcript_dlq https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/dmg-inbound-callrecording-transcript-sqs-dlq
```

---

## 🗑️ **OR: Delete and Recreate (Cleaner Option)**

If you don't need the existing resources, delete them and let Terraform create fresh ones:

```bash
# Delete CloudFormation Stack
aws cloudformation delete-stack --stack-name bedrock-conversational-analytics-my-analytics-project

# Delete SNS Topic
aws sns delete-topic --topic-arn arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:dmg-inbound-callrecording-transcript

# Delete SQS Queues
aws sqs delete-queue --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/dmg-inbound-callrecording-transcript-sqs-queue
aws sqs delete-queue --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/dmg-inbound-callrecording-transcript-sqs-dlq

# Wait 60 seconds for resources to fully delete
sleep 60

# Now run terraform apply again
terraform apply
```

---

## 🔧 **S3 Bucket Region Issue**

Your S3 bucket `pgr-experiment-data` is in **us-east-2**, but your infrastructure is deploying to **us-east-1**.

**This is FINE** - S3 buckets can be accessed from any region. However, S3 notifications must be configured in the bucket's home region.

### **Option 1: Skip S3 Notification (Manual Setup Later)**

Comment out the S3 notification resource temporarily:

**Edit:** `terraform/s3_dmg_inbound_callrecording_persistence.tf`

```hcl
# TEMPORARILY COMMENTED OUT - Configure manually in AWS Console
# resource "aws_s3_bucket_notification" "output_notification" {
#   bucket = local.s3_bucket_name
#   queue {
#     queue_arn     = aws_sqs_queue.dmg_inbound_callrecording_persistence.arn
#     events        = ["s3:ObjectCreated:*"]
#     filter_prefix = "${var.s3_output_prefix}/"
#     filter_suffix = "results.json"
#   }
#   depends_on = [aws_sqs_queue_policy.s3_to_sqs_persistence_policy]
# }
```

Then **manually configure** the S3 notification in AWS Console (in us-east-2):
1. Go to S3 Console → `pgr-experiment-data` bucket
2. Properties → Event notifications → Create event notification
3. Name: `bedrock-results-notification`
4. Prefix: `transcription-outputs/`
5. Suffix: `results.json`
6. Destination: SQS queue (select the persistence queue ARN from us-east-1)

---

### **Option 2: Add Multi-Region Provider (Complex)**

Add a second AWS provider for us-east-2 and use it specifically for the S3 notification.

**Edit:** `terraform/providers.tf`

```hcl
provider "aws" {
  alias  = "s3_region"
  region = "us-east-2"
}
```

**Edit:** `terraform/s3_dmg_inbound_callrecording_persistence.tf`

```hcl
resource "aws_s3_bucket_notification" "output_notification" {
  provider = aws.s3_region  # Use us-east-2 provider
  bucket   = local.s3_bucket_name

  queue {
    queue_arn     = aws_sqs_queue.dmg_inbound_callrecording_persistence.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "${var.s3_output_prefix}/"
    filter_suffix = "results.json"
  }

  depends_on = [aws_sqs_queue_policy.s3_to_sqs_persistence_policy]
}
```

---

## 📋 **Summary of Errors and Fixes**

| Error | Fix |
|-------|-----|
| `AWS_REGION` reserved variable | ✅ **FIXED** - Removed from Lambda env vars |
| CloudFormation stack exists | Import or delete and recreate |
| SNS topic exists with different tags | Import or delete and recreate |
| SQS queues exist with different attributes | Import or delete and recreate |
| S3 bucket in us-east-2, deploying to us-east-1 | Skip S3 notification OR use multi-region provider |

---

## 🎯 **Recommended Approach**

**Step 1:** Delete existing resources (cleanest)
```bash
aws cloudformation delete-stack --stack-name bedrock-conversational-analytics-my-analytics-project
aws sns delete-topic --topic-arn <ARN>
aws sqs delete-queue --queue-url <URL>
aws sqs delete-queue --queue-url <DLQ-URL>
```

**Step 2:** Comment out S3 notification temporarily
```hcl
# resource "aws_s3_bucket_notification" "output_notification" { ... }
```

**Step 3:** Deploy with Terraform
```bash
terraform apply
```

**Step 4:** Manually configure S3 notification in AWS Console (in us-east-2 region)

---

## 🔍 **Why These Errors Occurred**

1. **Existing Resources**: You likely ran `terraform apply` before, or these resources were created manually
2. **AWS_REGION**: Lambda automatically provides this environment variable
3. **S3 Cross-Region**: S3 API calls must go to the bucket's home region for certain operations like notifications

---

## 📞 **Next Steps**

Choose one approach:
- **Quick**: Delete all existing resources, comment out S3 notification, deploy, configure S3 notification manually
- **Thorough**: Import all existing resources, add multi-region provider for S3

**Recommendation:** Delete and recreate for a clean start!
