# Dead Letter Queue (DLQ) Configuration Overview

**Date**: 2026-01-10
**All SQS Queues**: 3 Main Queues + 3 DLQs

---

## Summary Table

| Queue Name | Max Retries | DLQ Name | DLQ Retention | Terraform File |
|-----------|-------------|----------|---------------|----------------|
| **Transcription SQS** | 10 | transcription-dlq | 14 days | [sqs_dmg_inbound_callrecording_transcription.tf](terraform/sqs_dmg_inbound_callrecording_transcription.tf) |
| **Persistence SQS** | 10 | persistence-dlq | 14 days | [sqs_dmg_inbound_callrecording_persistence.tf](terraform/sqs_dmg_inbound_callrecording_persistence.tf) |
| **S3 Event SQS** | 3 | s3-bedrock-output-dlq | 14 days | [sqs_s3_bedrock_output.tf](terraform/sqs_s3_bedrock_output.tf) |

---

## 1. Transcription SQS Queue

### Purpose
Receives SNS messages to trigger audio transcription via Bedrock.

### Configuration

**File**: [terraform/sqs_dmg_inbound_callrecording_transcription.tf](terraform/sqs_dmg_inbound_callrecording_transcription.tf:18-38)

```hcl
# Main Queue
resource "aws_sqs_queue" "dmg_inbound_callrecording_transcript" {
  name                       = "dmg-inbound-callrecording-transcript-sqs-queue"
  visibility_timeout_seconds = 360  # 6 minutes (2x Lambda timeout)
  message_retention_seconds  = 345600  # 4 days

  # DLQ Configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dmg_inbound_callrecording_transcript_dlq.arn
    maxReceiveCount     = 10  ← After 10 failed attempts → DLQ
  })
}

# DLQ
resource "aws_sqs_queue" "dmg_inbound_callrecording_transcript_dlq" {
  name                      = "dmg-inbound-callrecording-transcript-sqs-dlq"
  message_retention_seconds = 1209600  # 14 days
}
```

### Retry Flow

```
SNS Message → SQS Main Queue → Transcription Lambda
                    ↓
              Lambda Fails
                    ↓
          Message Returns to Queue
                    ↓
              Retry #1, #2, #3...
                    ↓
         After 10 Failed Attempts
                    ↓
              Moved to DLQ
                    ↓
         Stored for 14 days
```

### Queue URLs

- **Main Queue**: `https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-transcript-sqs-queue`
- **DLQ**: `https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-transcript-sqs-dlq`

---

## 2. Persistence SQS Queue (OLD - Not Used Anymore)

### Purpose
Originally designed to receive S3 event notifications. **Now replaced by S3 Event SQS Queue**.

### Configuration

**File**: [terraform/sqs_dmg_inbound_callrecording_persistence.tf](terraform/sqs_dmg_inbound_callrecording_persistence.tf:20-40)

```hcl
# Main Queue
resource "aws_sqs_queue" "dmg_inbound_callrecording_persistence" {
  name                       = "dmg-inbound-callrecording-persistence-sqs-queue"
  visibility_timeout_seconds = 360  # 6 minutes (2x Lambda timeout)
  message_retention_seconds  = 345600  # 4 days

  # DLQ Configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dmg_inbound_callrecording_persistence_dlq.arn
    maxReceiveCount     = 10  ← After 10 failed attempts → DLQ
  })
}

# DLQ
resource "aws_sqs_queue" "dmg_inbound_callrecording_persistence_dlq" {
  name                      = "dmg-inbound-callrecording-persistence-sqs-dlq"
  message_retention_seconds = 1209600  # 14 days
}
```

### Queue URLs

- **Main Queue**: `https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-persistence-sqs-queue`
- **DLQ**: `https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-persistence-sqs-dlq`

**Note**: This queue still exists but is **not actively used** for S3 events. The new S3 Event SQS Queue has taken over this responsibility.

---

## 3. S3 Event SQS Queue (NEW - Active)

### Purpose
Receives S3 event notifications when Bedrock writes transcription results.

### Configuration

**File**: [terraform/sqs_s3_bedrock_output.tf](terraform/sqs_s3_bedrock_output.tf:18-36)

```hcl
# Main Queue
resource "aws_sqs_queue" "s3_bedrock_output" {
  name                       = "conversational-analytics-dev-s3-bedrock-output-queue"
  visibility_timeout_seconds = 900  # 15 minutes (3x Lambda timeout)
  message_retention_seconds  = 345600  # 4 days
  receive_wait_time_seconds  = 20  # Long polling

  # DLQ Configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.s3_bedrock_output_dlq.arn
    maxReceiveCount     = 3  ← After 3 failed attempts → DLQ
  })
}

# DLQ
resource "aws_sqs_queue" "s3_bedrock_output_dlq" {
  name                      = "conversational-analytics-dev-s3-bedrock-output-dlq"
  message_retention_seconds = 1209600  # 14 days
}
```

### Retry Flow

```
Bedrock Writes to S3
        ↓
S3 Event Notification
        ↓
S3 Event SQS Main Queue → Persistence Lambda
        ↓
  Lambda Fails
        ↓
Message Returns to Queue
        ↓
  Retry #1, #2, #3
        ↓
After 3 Failed Attempts
        ↓
  Moved to DLQ
        ↓
Stored for 14 days
```

### Queue URLs

- **Main Queue**: `https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue`
- **DLQ**: `https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq`

### S3 Event Trigger

**File**: [terraform/sqs_s3_bedrock_output.tf](terraform/sqs_s3_bedrock_output.tf:66-76)

```hcl
resource "aws_s3_bucket_notification" "bedrock_output_notification" {
  bucket = "pgr-experiment-data-us-east-1"

  queue {
    id            = "bedrock-transcription-complete"
    queue_arn     = aws_sqs_queue.s3_bedrock_output.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "transcription-outputs/"
    filter_suffix = "/custom_output/0/result.json"
  }
}
```

**When triggered**:
- S3 object created matching: `transcription-outputs/*/custom_output/0/result.json`
- Event sent to: `s3_bedrock_output` SQS queue
- Lambda automatically processes message

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSCRIPTION PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

Audio Upload → SNS Topic
                  ↓
         ┌────────────────┐
         │ Transcription  │
         │   SQS Queue    │ ←─── Max 10 retries
         └────────┬───────┘
                  ↓ (fails 10x)
         ┌────────────────┐
         │ Transcription  │
         │      DLQ       │ ←─── Stores for 14 days
         └────────────────┘
                  ↓ (success)
         ┌────────────────┐
         │ Transcription  │
         │     Lambda     │
         └────────┬───────┘
                  ↓
            Bedrock API
                  ↓
         S3 Result Files
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE PIPELINE                         │
└─────────────────────────────────────────────────────────────────┘

S3 Event Notification
         ↓
┌────────────────┐
│  S3 Event SQS  │
│  Queue (NEW)   │ ←─── Max 3 retries
└────────┬───────┘
         ↓ (fails 3x)
┌────────────────┐
│  S3 Event DLQ  │ ←─── Stores for 14 days
└────────────────┘
         ↓ (success)
┌────────────────┐
│  Persistence   │
│     Lambda     │
└────────┬───────┘
         ↓
    DynamoDB Table
         ↓
    API Gateway
```

---

## Why Different Max Retry Counts?

### Transcription Queue: 10 Retries
**Reasoning**:
- Bedrock API calls can be rate-limited
- Temporary network issues common
- Audio processing is expensive - worth multiple attempts
- Less frequent failures expected

### S3 Event Queue: 3 Retries
**Reasoning**:
- S3 files are static - either they exist or they don't
- DynamoDB writes are fast and reliable
- If Lambda fails 3 times, likely a code bug (not transient error)
- Faster identification of persistent issues

---

## Monitoring DLQs

### Check DLQ Message Count

```bash
# Transcription DLQ
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-transcript-sqs-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1

# Persistence DLQ (old)
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/dmg-inbound-callrecording-persistence-sqs-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1

# S3 Event DLQ (new)
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

### Inspect Failed Messages

```bash
# Receive message from DLQ
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
  --max-number-of-messages 1 \
  --region us-east-1
```

### Reprocess Failed Messages

If you fix the issue causing failures, you can manually reprocess DLQ messages:

```bash
# 1. Receive message from DLQ
MESSAGE=$(aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
  --region us-east-1)

# 2. Send message back to main queue
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue \
  --message-body "$(echo $MESSAGE | jq -r '.Messages[0].Body')" \
  --region us-east-1

# 3. Delete from DLQ
aws sqs delete-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
  --receipt-handle "$(echo $MESSAGE | jq -r '.Messages[0].ReceiptHandle')" \
  --region us-east-1
```

---

## CloudWatch Alarms (Recommended)

Set up alarms to notify when messages appear in DLQs:

```hcl
resource "aws_cloudwatch_metric_alarm" "s3_event_dlq_alarm" {
  alarm_name          = "s3-bedrock-output-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "Alert when messages end up in S3 Bedrock output DLQ"

  dimensions = {
    QueueName = "conversational-analytics-dev-s3-bedrock-output-dlq"
  }
}
```

---

## Summary

| Feature | Transcription Queue | Persistence Queue (Old) | S3 Event Queue (NEW) |
|---------|-------------------|----------------------|-------------------|
| **Purpose** | SNS → Lambda | S3 → Lambda (unused) | S3 → Lambda (active) |
| **Max Retries** | 10 | 10 | 3 |
| **Visibility Timeout** | 6 minutes | 6 minutes | 15 minutes |
| **Message Retention** | 4 days | 4 days | 4 days |
| **DLQ Retention** | 14 days | 14 days | 14 days |
| **Status** | ✅ Active | ⚠️ Exists but unused | ✅ Active |

**Key Point**: The **S3 Event SQS Queue** is the new, actively used queue for handling Bedrock transcription results. It has only 3 retries because S3 event processing should be quick and deterministic.
