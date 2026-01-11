# Transcription Lambda - TypeScript Implementation

## Overview

This document compares the Python implementation you provided with our improved TypeScript implementation for the Bedrock Data Automation transcription Lambda.

## Key Improvements

### 1. **Event-Driven Architecture**

**Python (Batch Processing):**
- Processes ALL audio files in a folder at once
- Requires manual invocation with folder paths
- Lists files using S3 client

**TypeScript (Event-Driven):**
- Processes ONE audio file per SNS message
- Automatically triggered by SQS queue
- Scales automatically with incoming messages
- Better error isolation (one failure doesn't affect others)

### 2. **Idempotency**

**Python:**
```python
clientToken=str(uuid.uuid4())  # New UUID for each file
```

**TypeScript:**
```typescript
const clientToken = randomUUID();  // Unique token per invocation
```

Both generate unique tokens, but TypeScript's event-driven approach ensures each message gets processed independently with proper retry logic via SQS.

### 3. **Configuration Management**

**Python:**
```python
def __init__(self):
    self.BDA_PROFILE_ARN=f"arn:aws:bedrock:{region}:{account}:data-automation-profile/us.data-automation-v1"
    # Hardcoded profile ARN construction
```

**TypeScript:**
```typescript
// Environment variable from Terraform
profileArn: process.env.BEDROCK_PROFILE_ARN
```

Benefits:
- Centralized configuration via Terraform
- No runtime AWS API calls to get account ID
- Easier to manage across environments (dev, staging, prod)

### 4. **Error Handling**

**Python:**
```python
except Exception as e:
    print(f"Error: {e}")
    return {
        'statusCode': 500,
        'body': json.dumps({'error': str(e)})
    }
```

**TypeScript:**
```typescript
catch (error) {
  console.error(`❌ Error processing SQS message: ${error}`);
  console.error(`Error details:`, error);
  throw error;  // Allow SQS retry mechanism
}
```

Benefits:
- Leverages SQS retry policy (configurable retries)
- Failed messages go to Dead Letter Queue (DLQ) for investigation
- No need to track processing status manually

### 5. **Performance Characteristics**

| Aspect | Python (Batch) | TypeScript (Event-Driven) |
|--------|----------------|---------------------------|
| Cold Start | ~2-3s | ~1-2s (Node.js faster) |
| Concurrency | Sequential processing | Parallel (up to 10 concurrent) |
| Failure Impact | Entire batch fails | Single message fails |
| Retry Logic | Manual | Automatic via SQS |
| Scalability | Limited by Lambda timeout | Auto-scales with queue depth |

### 6. **Code Structure**

**Python Function Flow:**
```
1. Initialize clients (STS call for account ID)
2. List all files in S3 folder
3. Loop through files
4. Invoke BDA for each file
5. Collect all results
6. Return array of invocation ARNs
```

**TypeScript Handler Flow:**
```
1. Receive SQS event (1 message = 1 file)
2. Parse SNS message
3. Validate input
4. Invoke BDA
5. Log success
6. SQS auto-deletes message on success
```

## Code Comparison

### Python Approach (Your Code)

```python
# Pros:
# - See all results in one Lambda invocation
# - Good for bulk/batch operations
# - Returns elapsed time

# Cons:
# - Must process all files even if some fail
# - Limited by Lambda timeout (15 min max)
# - Manual retry logic needed
# - Requires list operation on S3

invocation_arns = []
for key in audio_files:
    invocation_arn = processor.process_audio(
        input_s3_uri, output_s3_uri, project_arn
    )
    invocation_arns.append({...})
```

### TypeScript Approach (Our Implementation)

```typescript
// Pros:
// - Automatic scaling
// - Built-in retry via SQS
// - DLQ for failed messages
// - Individual file error isolation
// - No S3 list operations needed

// Cons:
// - Need to aggregate results elsewhere if needed
// - Requires SNS/SQS infrastructure

for (const record of event.Records) {
  const snsMessage = JSON.parse(JSON.parse(record.body).Message);
  const response = await runtimeClient.send(command);
  console.warn(`Invocation ARN: ${response.invocationArn}`);
}
```

## Architecture Pattern

### Python Pattern: Direct Invocation
```
[Manual Trigger] → [Lambda] → [List S3] → [Process All Files] → [Return Results]
```

### TypeScript Pattern: Event-Driven
```
[Audio Upload] → [S3 Event] → [SNS] → [SQS] → [Lambda] → [BDA]
                                         ↓
                                    [DLQ (failures)]
```

## When to Use Each Approach

### Use Python Batch Approach When:
- Need to process existing historical data
- Want synchronous results for all files
- Running one-time migrations
- Prefer simpler infrastructure (no SNS/SQS)

### Use TypeScript Event-Driven Approach When:
- Processing real-time audio uploads
- Need high scalability
- Want automatic retry logic
- Require error isolation per file
- Building production systems with proper observability

## Configuration

### Python
```python
# Event payload example:
{
    "bucket": "pgr-experiment-data",
    "input_prefix": "raw-audio-files/",
    "output_prefix": "transcription-outputs/",
    "project_arn": "arn:aws:bedrock:..."
}
```

### TypeScript
```typescript
// SNS message format:
{
    "callId": "call-12345",
    "audioS3Uri": "s3://bucket/raw-audio-files/call-12345.mp3"
}

// Environment variables (managed by Terraform):
BEDROCK_PROJECT_ARN=arn:aws:bedrock:us-east-1:xxx:data-automation-project/yyy
BEDROCK_PROFILE_ARN=arn:aws:bedrock:us-east-1:xxx:data-automation-profile/us.data-automation-v1
BEDROCK_BLUEPRINT_STAGE=LIVE
S3_OUTPUT_BUCKET=pgr-experiment-data
S3_OUTPUT_PREFIX=transcription-outputs
```

## Deployment

### Python
- Package manually
- Upload ZIP to Lambda
- Update function code

### TypeScript
- Build with `npm run build`
- Package with deployment script
- Deploy via AWS CLI or Terraform
- Environment variables managed by Terraform

```bash
npm run build
# Package script creates deploy/lambda-transcription.zip
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://deploy/lambda-transcription.zip
```

## Current Status

✅ **Deployed and Ready:**
- Lambda function: `dmg-inbound-callrecording-transcription`
- Runtime: Node.js 20.x
- Handler: `handlers/dmg-inbound-callrecording-transcription.handler`
- Size: ~22 MB (includes all dependencies)
- Environment variables: All configured via Terraform
- SQS Trigger: Configured with batch size 1, max concurrency 10
- Dead Letter Queue: Configured for failed messages

## Testing

To trigger the Lambda, publish a message to SNS:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
  --message '{
    "callId": "test-call-001",
    "audioS3Uri": "s3://pgr-experiment-data/raw-audio-files/test.mp3"
  }'
```

The message will:
1. Flow through SNS → SQS
2. Trigger the Lambda
3. Invoke Bedrock Data Automation
4. Log the invocation ARN
5. Bedrock writes results to S3

Monitor in CloudWatch Logs: `/aws/lambda/dmg-inbound-callrecording-transcription`

## Summary

Both approaches are valid, but serve different use cases:

- **Python batch processor**: Better for one-time bulk operations, migrations, or admin tasks
- **TypeScript event-driven**: Better for production systems with real-time processing, automatic scaling, and robust error handling

Our TypeScript implementation is production-ready and follows AWS best practices for event-driven architectures.
