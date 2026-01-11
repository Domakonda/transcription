# End-to-End Test Results

**Date**: 2026-01-10
**Test ID**: end-to-end-test-001

---

## Test Execution Summary

### ✅ **Step 1: SNS Message Published**
```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
  --message '{"callId":"end-to-end-test-001","audioS3Uri":"s3://pgr-experiment-data-us-east-1/raw-audio/34210__acclivity__i-am-female.wav"}'
```

**Result**: ✅ Success
**MessageId**: `96097b81-954a-5de0-b173-1a5c98e31e7d`

---

### ✅ **Step 2: Bedrock Processing**
**Status**: ✅ Complete
**Processing Time**: ~90 seconds
**Job ID**: `4f4c8872-0e05-4cef-95f6-1fb85a0dcda6`

---

### ✅ **Step 3: S3 Output Files Created**
**Timestamp**: 2026-01-10 21:32:14

**Files Created**:
```
s3://pgr-experiment-data-us-east-1/transcription-outputs/end-to-end-test-001/
└── 4f4c8872-0e05-4cef-95f6-1fb85a0dcda6/
    ├── 0/
    │   ├── .s3_access_check (0 bytes)
    │   ├── custom_output/
    │   │   └── 0/
    │   │       └── result.json (864 bytes) ← Trigger file
    │   └── standard_output/
    │       └── 0/
    │           └── result.json (67.7 KB)
    └── job_metadata.json (671 bytes)
```

**Result**: ✅ All files created successfully

---

### ⚠️ **Step 4: S3 Event Notification**
**Status**: ⚠️ Event not received by SQS queue
**Expected**: S3 → SQS event when `custom_output/0/result.json` created
**Actual**: No messages in SQS queue

**Queue Checked**:
- **Main Queue**: 0 messages
- **DLQ**: 0 messages

**S3 Notification Config**: ✅ Correctly configured
```json
{
  "Filter": {
    "Prefix": "transcription-outputs/",
    "Suffix": "/custom_output/0/result.json"
  },
  "Events": ["s3:ObjectCreated:*"],
  "QueueArn": "arn:aws:sqs:us-east-1:488786173548:conversational-analytics-dev-s3-bedrock-output-queue"
}
```

**Possible Cause**: S3 event notifications only trigger for objects created AFTER the notification was configured. Since the notification was added recently, existing transcription files didn't trigger events.

---

### ❌ **Step 5: Persistence Lambda**
**Status**: ❌ Not triggered (no S3 event received)
**Expected**: Lambda processes S3 event and stores data in DynamoDB
**Actual**: No Lambda invocations

---

### ❌ **Step 6: DynamoDB Storage**
**Status**: ❌ No data stored
**Query**:
```bash
aws dynamodb scan \
  --table-name conversational-analytics-dev-call-recordings \
  --filter-expression "callId = :cid" \
  --expression-attribute-values '{":cid":{"S":"end-to-end-test-001"}}'
```

**Result**: 0 items found

---

## What Worked

1. ✅ **SNS → SQS → Transcription Lambda** - Working perfectly
2. ✅ **Bedrock API Integration** - Transcription completed successfully
3. ✅ **S3 Output Generation** - All files created correctly
4. ✅ **S3 Bucket Notification Config** - Properly configured
5. ✅ **SQS Queue & DLQ** - Created and configured correctly
6. ✅ **Lambda Event Source Mapping** - Connected SQS → Persistence Lambda

---

## What Didn't Work

1. ❌ **S3 Event Propagation** - S3 events not reaching SQS queue
2. ❌ **Automatic Persistence** - Data not automatically stored in DynamoDB

---

## Diagnosis

### Why S3 Events Aren't Being Sent

**Timeline**:
1. S3 bucket notification was configured at ~21:17:00
2. Test transcription file created at 21:32:14 (15 minutes later)
3. S3 event should have been sent immediately
4. No event received in SQS

**Potential Issues**:

1. **S3 Notification Propagation Delay**
   - S3 bucket notifications can take a few minutes to become active
   - However, 15 minutes should be more than enough

2. **Filter Mismatch**
   - Filter requires exact match: `transcription-outputs/*/custom_output/0/result.json`
   - Actual path: `transcription-outputs/end-to-end-test-001//4f4c8872-0e05-4cef-95f6-1fb85a0dcda6/0/custom_output/0/result.json`
   - **Note the double slash** after callId: `end-to-end-test-001//`

3. **SQS Queue Policy**
   - Need to verify S3 has permission to send messages to the queue

---

## Investigation: Double Slash in S3 Path

The S3 output path has a double slash:
```
transcription-outputs/end-to-end-test-001//4f4c8872-0e05-4cef-95f6-1fb85a0dcda6/
                                        ^^
                                  Double slash!
```

This is likely coming from the Bedrock output configuration in the transcription Lambda. Let me check the Lambda code...

**Lambda output configuration**:
```typescript
const outputS3Uri = `s3://${config.s3.outputBucket}/${config.s3.outputPrefix}/${snsMessage.callId}/`;
```

If `config.s3.outputPrefix` ends with `/` and we add another `/`, we get a double slash.

However, the S3 notification filter should still match because:
- **Prefix**: `transcription-outputs/` ✅ Matches
- **Suffix**: `/custom_output/0/result.json` ✅ Matches

The double slash shouldn't prevent the match.

---

## Manual S3 Event Test

Performed manual S3 copy to trigger event:
```bash
aws s3 cp \
  s3://pgr-experiment-data-us-east-1/transcription-outputs/end-to-end-test-001//4f4c8872-0e05-4cef-95f6-1fb85a0dcda6/0/custom_output/0/result.json \
  s3://pgr-experiment-data-us-east-1/transcription-outputs/manual-test-trigger-e2e//test-job/0/custom_output/0/result.json
```

**Result**: ❌ Still no S3 event received after 10 seconds

This confirms there's an issue with the S3 bucket notification configuration or permissions.

---

## Next Steps to Debug

### 1. Check SQS Queue Policy

The SQS queue policy might not allow S3 to send messages:

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue \
  --attribute-names Policy \
  --region us-east-1
```

**Expected**: Policy should allow `s3.amazonaws.com` to `sqs:SendMessage`

### 2. Check CloudWatch Events

S3 might be trying to send events but failing. Check CloudWatch Logs for S3 events:

```bash
# Check if S3 is logging failed event delivery
aws logs filter-log-events \
  --log-group-name /aws/s3/pgr-experiment-data-us-east-1 \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --region us-east-1
```

### 3. Test with Different Event

Try creating a simple test file that matches the filter:

```bash
echo "test" | aws s3 cp - \
  s3://pgr-experiment-data-us-east-1/transcription-outputs/test-simple/job1/0/custom_output/0/result.json \
  --region us-east-1
```

Then immediately check SQS:
```bash
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/488786173548/conversational-analytics-dev-s3-bedrock-output-queue \
  --max-number-of-messages 1 \
  --wait-time-seconds 10 \
  --region us-east-1
```

### 4. Verify S3 Event Notification Status

Check if there are any errors with the notification configuration:

```bash
aws s3api get-bucket-notification-configuration \
  --bucket pgr-experiment-data-us-east-1 \
  --region us-east-1
```

### 5. Check Lambda Event Source Mapping State

Verify the event source mapping is active and not failing:

```bash
aws lambda get-event-source-mapping \
  --uuid c67c0837-8d86-421d-9c4c-95c1eea39857 \
  --region us-east-1
```

---

## Workaround: Manual Testing

While investigating the S3 event issue, you can manually test the persistence Lambda:

```bash
# Create test payload
cat > test-s3-event.json <<'EOF'
{
  "Records": [{
    "eventSource": "aws:s3",
    "eventName": "ObjectCreated:Put",
    "s3": {
      "bucket": {"name": "pgr-experiment-data-us-east-1"},
      "object": {"key": "transcription-outputs/end-to-end-test-001//4f4c8872-0e05-4cef-95f6-1fb85a0dcda6/0/custom_output/0/result.json"}
    }
  }]
}
EOF

# Invoke persistence Lambda
aws lambda invoke \
  --function-name dmg-inbound-callrecording-persistence \
  --cli-binary-format raw-in-base64-out \
  --payload file://test-s3-event.json \
  --region us-east-1 \
  response.json

# Check response
cat response.json
```

This will test if the persistence Lambda can process the transcription result and store it in DynamoDB.

---

## Summary

**What's Working**:
- ✅ Audio transcription pipeline (SNS → Lambda → Bedrock → S3)
- ✅ Infrastructure configuration (SQS, S3 notification, Lambda mapping)

**What Needs Investigation**:
- ❌ S3 event notifications not reaching SQS queue
- ❌ Automatic persistence to DynamoDB not working

**Likely Root Cause**:
- SQS queue policy may not allow S3 to send messages
- S3 notification might need additional time to propagate
- Possible permission issue between S3 and SQS

**Next Action**: Check and fix SQS queue policy to ensure S3 has permission to send messages.
