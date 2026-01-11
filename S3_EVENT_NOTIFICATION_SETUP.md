# S3 Event Notification for Bedrock Output - Setup Complete

**Date**: 2026-01-10
**Status**: ✅ Successfully Deployed

---

## Summary

Successfully configured S3 bucket event notifications to automatically trigger the persistence Lambda when Bedrock writes transcription results. This completes the end-to-end automated pipeline.

---

## Architecture

```
Audio Upload → SNS → SQS → Transcription Lambda → Bedrock
                                                      ↓
                                                  S3 Output
                                                      ↓
                                              S3 Event Notification
                                                      ↓
                                                  New SQS Queue
                                                      ↓
                                              Persistence Lambda
                                                      ↓
                                                  DynamoDB
```

---

## Components Created

### 1. S3 Bedrock Output SQS Queue

**Queue Name**: `conversational-analytics-dev-s3-bedrock-output-queue`
**Queue URL**: `https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue`

**Configuration**:
- Visibility Timeout: 900 seconds (15 minutes)
- Message Retention: 345600 seconds (4 days)
- Long Polling: 20 seconds
- Batch Size: 1 message per Lambda invocation
- Maximum Concurrency: 10

### 2. Dead Letter Queue

**Queue Name**: `conversational-analytics-dev-s3-bedrock-output-dlq`
**Queue URL**: `https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq`

**Configuration**:
- Message Retention: 1209600 seconds (14 days)
- Max Receive Count: 3 attempts before moving to DLQ

### 3. S3 Bucket Notification

**Trigger**: When Bedrock writes transcription results
**Filter**:
- Prefix: `transcription-outputs/`
- Suffix: `/custom_output/0/result.json`

**Events**: `s3:ObjectCreated:*`

This ensures only the custom output result files trigger the Lambda (not standard output or metadata files).

### 4. Lambda Event Source Mapping

**Mapping ID**: Auto-generated
**Source**: S3 Bedrock Output SQS Queue
**Destination**: `dmg-inbound-callrecording-persistence` Lambda
**Function Response Types**: `ReportBatchItemFailures`

### 5. IAM Policy Update

Updated Lambda IAM policy to include permissions for the new SQS queue:

```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"
  ],
  "Resource": [
    "arn:aws:sqs:us-east-1:488786173548:dmg-inbound-callrecording-transcript-sqs-queue",
    "arn:aws:sqs:us-east-1:488786173548:dmg-inbound-callrecording-persistence-sqs-queue",
    "arn:aws:sqs:us-east-1:488786173548:conversational-analytics-dev-s3-bedrock-output-queue"
  ]
}
```

---

## Terraform Resources

**File**: [terraform/sqs_s3_bedrock_output.tf](terraform/sqs_s3_bedrock_output.tf)

### Resources Created:

```hcl
# Dead Letter Queue
resource "aws_sqs_queue" "s3_bedrock_output_dlq"

# Main SQS Queue
resource "aws_sqs_queue" "s3_bedrock_output"

# SQS Queue Policy (allows S3 to send messages)
resource "aws_sqs_queue_policy" "s3_bedrock_output_policy"

# S3 Bucket Notification
resource "aws_s3_bucket_notification" "bedrock_output_notification"

# Lambda Event Source Mapping
resource "aws_lambda_event_source_mapping" "sqs_to_lambda_persistence_bedrock"
```

---

## How It Works

### Step-by-Step Flow

1. **User triggers transcription** via SNS message
   ```bash
   aws sns publish \
     --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
     --message '{"callId":"call-001","audioS3Uri":"s3://bucket/audio.wav"}'
   ```

2. **SNS → SQS** - Message queued for transcription Lambda

3. **Transcription Lambda** - Picks up SQS message and invokes Bedrock

4. **Bedrock processes audio** (~60-90 seconds)

5. **Bedrock writes to S3**:
   ```
   s3://pgr-experiment-data-us-east-1/transcription-outputs/call-001/
   └── {job-id}/
       └── 0/
           └── custom_output/
               └── 0/
                   └── result.json  ← This triggers S3 event
   ```

6. **S3 Event Notification** - S3 sends event to SQS queue

7. **SQS → Persistence Lambda** - Lambda automatically triggered

8. **Persistence Lambda**:
   - Downloads `result.json` from S3
   - Parses transcription data
   - Stores in DynamoDB

9. **DynamoDB Record Created**:
   ```json
   {
     "hash": "call-001",
     "callId": "call-001",
     "timestamp": 1736468400000,
     "topics": ["self-identity", "art", "culture"],
     "callCategories": ["General inquiries"],
     "callSummary": "...",
     "s3Key": "transcription-outputs/call-001/.../result.json"
   }
   ```

---

## Testing

### Trigger a New Transcription

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
  --message '{"callId":"test-123","audioS3Uri":"s3://pgr-experiment-data-us-east-1/raw-audio/audio.wav"}' \
  --region us-east-1
```

### Check SQS Queue Status

```bash
# Check main queue
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region us-east-1

# Check DLQ
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

### Verify DynamoDB Storage

```bash
aws dynamodb scan \
  --table-name conversational-analytics-dev-call-recordings \
  --region us-east-1 \
  --limit 10
```

### Query via API Gateway

```bash
curl https://3qcv9fvb6l.execute-api.us-east-1.amazonaws.com/dev/analytics/test-123
```

---

## Event Filtering

The S3 bucket notification is configured to only trigger on specific files:

**Filter Rules**:
- **Prefix**: `transcription-outputs/`
  - Only files in the transcription outputs folder
- **Suffix**: `/custom_output/0/result.json`
  - Only the custom output result files (not standard output or metadata)

**Why this filter?**

Bedrock creates multiple files per transcription:
```
transcription-outputs/call-001/{job-id}/
├── 0/
│   ├── .s3_access_check          ← Ignored
│   ├── custom_output/
│   │   └── 0/
│   │       └── result.json       ← TRIGGERS EVENT ✅
│   └── standard_output/
│       └── 0/
│           └── result.json       ← Ignored (different path)
└── job_metadata.json             ← Ignored
```

This prevents duplicate Lambda invocations and ensures we only process the summary file (custom output) which contains topics, categories, and call summary.

---

## Monitoring

### CloudWatch Metrics

Monitor the following metrics:

1. **SQS Queue**:
   - `ApproximateNumberOfMessagesVisible` - Messages waiting
   - `ApproximateNumberOfMessagesNotVisible` - Being processed
   - `ApproximateAgeOfOldestMessage` - Queue lag

2. **Lambda**:
   - `Invocations` - How many times triggered
   - `Errors` - Failed invocations
   - `Duration` - Processing time
   - `Throttles` - Rate limiting

3. **DLQ**:
   - `ApproximateNumberOfMessages` - Failed messages

### CloudWatch Alarms (Recommended)

```terraform
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
    QueueName = aws_sqs_queue.s3_bedrock_output_dlq.name
  }
}
```

---

## Troubleshooting

### Messages in DLQ

If messages appear in the dead letter queue:

1. **Check Lambda logs**:
   ```bash
   aws logs tail /aws/lambda/dmg-inbound-callrecording-persistence \
     --since 1h \
     --region us-east-1
   ```

2. **Inspect failed message**:
   ```bash
   aws sqs receive-message \
     --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-dlq \
     --region us-east-1
   ```

3. **Common issues**:
   - Malformed JSON in result.json
   - DynamoDB throttling
   - IAM permission issues
   - S3 object not found (file deleted before Lambda processed)

### Lambda Not Triggered

If persistence Lambda isn't being triggered:

1. **Check S3 notification config**:
   ```bash
   aws s3api get-bucket-notification-configuration \
     --bucket pgr-experiment-data-us-east-1 \
     --region us-east-1
   ```

2. **Verify SQS policy allows S3**:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue \
     --attribute-names Policy \
     --region us-east-1
   ```

3. **Check event source mapping**:
   ```bash
   aws lambda list-event-source-mappings \
     --function-name dmg-inbound-callrecording-persistence \
     --region us-east-1
   ```

---

## Performance Considerations

### Concurrency

- **Maximum Concurrency**: 10 (configured in event source mapping)
- **Batch Size**: 1 message per invocation
- This means up to 10 S3 events can be processed simultaneously

### Latency

From Bedrock completion to DynamoDB storage:

1. **S3 Write**: Immediate (Bedrock completes)
2. **S3 Event → SQS**: < 1 second
3. **SQS → Lambda**: < 1 second (long polling enabled)
4. **Lambda Processing**: 2-5 seconds
5. **DynamoDB Write**: < 1 second

**Total**: ~3-7 seconds from Bedrock completion to DynamoDB storage

### Cost Optimization

**SQS Costs**:
- First 1M requests/month: Free
- After: $0.40 per million requests

**Lambda Costs**:
- First 1M requests/month: Free
- After: $0.20 per million requests
- Compute: $0.0000166667 per GB-second

For 1000 transcriptions/month:
- SQS: Free tier
- Lambda: Free tier
- **Total additional cost**: $0

---

## Summary

✅ **S3 Event Notification**: Configured on transcription outputs
✅ **SQS Queue**: Created for S3 events
✅ **Dead Letter Queue**: Configured for failed processing
✅ **Lambda Event Source**: Connected SQS to persistence Lambda
✅ **IAM Permissions**: Updated for new queue access
✅ **Filtering**: Only custom output result files trigger events

**Status**: Fully automated pipeline ready for production use.

The complete workflow is now:
```
Audio Upload → Transcription → Bedrock → S3 → SQS → Persistence → DynamoDB → API
```

All steps are automated with no manual intervention required.
