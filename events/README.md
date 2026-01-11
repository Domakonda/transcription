# Test Event Payloads

Sample event payloads for testing Lambda functions locally or in AWS Console.

## Transcription Lambda Events

### sampleTranscriptionEvent.json
**Purpose**: Test the transcription Lambda handler
**Trigger**: SQS message containing SNS notification with audio file details
**Usage**:
```bash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-transcription \
  --payload file://events/sampleTranscriptionEvent.json \
  --region us-east-1 \
  response.json
```

## Persistence Lambda Events

### samplePersistenceEvent.json
**Purpose**: Test S3 event notification when Bedrock output is created
**Usage:**
```bash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-persistence \
  --payload file://events/samplePersistenceEvent.json \
  --region us-east-1 \
  response.json
```

## Retrieval Lambda Events

### sampleRetrievalEventFound.json
**Purpose**: API Gateway event for retrieving call recordings by hash (when records exist)
**Query Parameters:**
- `pageSize`: Number of items per page (default: 20, max: 100)
- `nextToken`: Base64-encoded token for pagination (optional)

### sampleRetrievalEventNotFound.json
**Purpose**: Test case for when no records match the hash

### sampleRetrievalEventPagination.json
**Purpose**: Test event with pagination parameters to verify `nextToken` handling

## Expected Responses

### Transcription Lambda
```json
{
  "statusCode": 200,
  "message": "Transcription initiated"
}
```

### Persistence Lambda
Processes S3 event, downloads Bedrock output, stores in DynamoDB.

### Retrieval Lambda
**Found:** Returns paginated call recordings
**Not Found:** Returns 404 with error message
**Pagination**: Uses nextToken for continuation

## Testing via AWS CLI

### Transcription Lambda
```bash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-transcription \
  --payload file://events/sampleTranscriptionEvent.json \
  --region us-east-1 \
  output.json
```

### Persistence Lambda
```bash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-persistence \
  --payload file://events/samplePersistenceEvent.json \
  --region us-east-1 \
  persistence-response.json
```

### Retrieval Lambda
```bash
# Test with found hash
aws lambda invoke \
  --function-name dmg-inbound-callrecording-retrieval \
  --payload file://events/sampleRetrievalEventFound.json \
  --region us-east-1 \
  retrieval-response.json

# Test with not found
aws lambda invoke \
  --function-name dmg-inbound-callrecording-retrieval \
  --payload file://events/sampleRetrievalEventNotFound.json \
  --region us-east-1 \
  response-not-found.json

# Test with pagination
aws lambda invoke \
  --function-name dmg-inbound-callrecording-retrieval \
  --payload file://events/sampleRetrievalEventPagination.json \
  --region us-east-1 \
  response-pagination.json
```
