# Lambda Deployment Summary

## Optimized Minimal Packages Deployed ✅

### Package Size Comparison

| Lambda | Before (Full) | After (Minimal) | Reduction |
|--------|---------------|-----------------|-----------|
| **Transcription** | 22.15 MB | **2.38 MB** | 89% smaller |
| **Persistence** | 22.15 MB | **4.10 MB** | 81% smaller |
| **Retrieval** | 22.15 MB | **3.00 MB** | 86% smaller |

### What Each Package Contains

#### 1. Transcription Lambda (2.38 MB)
**Files:**
```
handlers/
  └── dmg-inbound-callrecording-transcription.js  (handler)
config/
  └── index.js                                     (environment config)
node_modules/
  └── @aws-sdk/client-bedrock-data-automation-runtime/  (only this SDK)
package.json
```

**Dependencies:**
- `@aws-sdk/client-bedrock-data-automation-runtime` - Invokes Bedrock Data Automation
- Node.js built-in `crypto` module (for UUID generation)

#### 2. Persistence Lambda (4.10 MB)
**Files:**
```
handlers/
  └── dmg-inbound-callrecording-persistence.js  (handler)
config/
  └── index.js                                   (environment config)
node_modules/
  ├── @aws-sdk/client-s3/                        (S3 operations)
  ├── @aws-sdk/client-dynamodb/                  (DynamoDB client)
  └── @aws-sdk/lib-dynamodb/                     (DynamoDB document client)
package.json
```

**Dependencies:**
- `@aws-sdk/client-s3` - Download Bedrock output from S3
- `@aws-sdk/client-dynamodb` - DynamoDB operations
- `@aws-sdk/lib-dynamodb` - Higher-level DynamoDB document client
- Node.js built-in `crypto` module (for MD5 hashing)

#### 3. Retrieval Lambda (3.00 MB)
**Files:**
```
handlers/
  └── dmg-inbound-callrecording-retrieval.js  (handler)
config/
  └── index.js                                 (environment config)
node_modules/
  ├── @aws-sdk/client-dynamodb/                (DynamoDB client)
  └── @aws-sdk/lib-dynamodb/                   (DynamoDB document client)
package.json
```

**Dependencies:**
- `@aws-sdk/client-dynamodb` - Query DynamoDB
- `@aws-sdk/lib-dynamodb` - Document client for easier queries
- Node.js built-in `crypto` module (for MD5 hashing)

## Performance Impact

### Cold Start Improvement
Smaller package sizes mean:
- **Faster download** from S3 when Lambda needs to initialize
- **Faster extraction** and initialization
- **Reduced memory footprint**

**Expected cold start improvements:**
- Before: ~2-3 seconds
- After: ~1-1.5 seconds (30-50% faster)

### Runtime Performance
- **No change** - same compiled JavaScript code
- **Same execution speed** - only the necessary dependencies

## Deployment Process

### Build Command
```bash
npm run build
```

### Package Creation (Automated)
```bash
cd deploy

# Each Lambda gets its own package with minimal dependencies
npm install --production  # In each subdirectory
# Copy handler + config
# Create ZIP
```

### Deploy Command
```bash
# Transcription
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-transcription \
  --zip-file fileb://deploy/lambda-transcription-min.zip

# Persistence
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-persistence \
  --zip-file fileb://deploy/lambda-persistence-min.zip

# Retrieval
aws lambda update-function-code \
  --function-name dmg-inbound-callrecording-retrieval \
  --zip-file fileb://deploy/lambda-retrieval-min.zip
```

## Current Lambda Configuration

### Environment Variables (All Lambdas)
```bash
AWS_REGION=us-east-1
S3_INPUT_BUCKET=pgr-experiment-data
S3_OUTPUT_BUCKET=pgr-experiment-data
S3_OUTPUT_PREFIX=transcription-outputs
BEDROCK_PROJECT_ARN=arn:aws:bedrock:us-east-1:488786173548:data-automation-project/4e5b4cdd1bb3
BEDROCK_BLUEPRINT_STAGE=LIVE
BEDROCK_PROFILE_ARN=arn:aws:bedrock:us-east-1:488786173548:data-automation-profile/us.data-automation-v1
DYNAMODB_TABLE_NAME=conversational-analytics-dev-call-recordings
```

### Additional Variables (Retrieval Only)
```bash
PAGINATION_DEFAULT_PAGE_SIZE=20
PAGINATION_MAX_PAGE_SIZE=100
```

## Terraform Configuration

Each Lambda has a lifecycle block to prevent Terraform from overwriting code deployments:

```hcl
lifecycle {
  ignore_changes = [
    filename,
    source_code_hash,
    handler,
    last_modified
  ]
}
```

This allows us to deploy code via AWS CLI without Terraform reverting the changes.

## Verification

Check deployed Lambda sizes:
```bash
aws lambda list-functions --region us-east-1 \
  --query "Functions[?starts_with(FunctionName, 'dmg-inbound-callrecording')].{Name:FunctionName, Size:CodeSize}" \
  --output table
```

Expected output:
```
dmg-inbound-callrecording-transcription  |  2377434  (2.38 MB)
dmg-inbound-callrecording-persistence    |  4102472  (4.10 MB)
dmg-inbound-callrecording-retrieval      |  2999251  (3.00 MB)
```

## What's NOT Included (Intentionally)

Each Lambda package does **NOT** include:
- ❌ Other Lambda handlers (transcription Lambda doesn't have retrieval/persistence code)
- ❌ Unused AWS SDK modules
- ❌ Dev dependencies (TypeScript, build tools, etc.)
- ❌ Source TypeScript files (only compiled .js)
- ❌ Type definition files (.d.ts, .d.ts.map)
- ❌ Source maps (.js.map) - could add back for debugging if needed

## Best Practices Applied

1. ✅ **Minimal dependencies** - Only what each Lambda actually uses
2. ✅ **Separate packages** - No shared code between Lambdas in deployment
3. ✅ **Production mode** - `npm install --production` (no devDependencies)
4. ✅ **Compiled code only** - JavaScript only, no TypeScript source
5. ✅ **Shared config** - Single config file imported by all handlers (minimal code duplication)

## Future Optimizations

If you need even smaller packages:

1. **Tree shaking**: Use bundlers like esbuild or webpack to only include used code
2. **AWS SDK v3 optimization**: Could bundle only the exact API calls needed
3. **Remove source maps**: Currently not included, but could save more space
4. **Layer approach**: Move common dependencies to a Lambda Layer (shared across functions)

## Testing

After deployment, verify each Lambda:

### Test Transcription
```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:488786173548:dmg-inbound-callrecording-transcript \
  --message '{"callId":"test-001","audioS3Uri":"s3://pgr-experiment-data/raw-audio-files/test.mp3"}'
```

### Test Retrieval (via API Gateway)
```bash
curl https://3qcv9fvb6l.execute-api.us-east-1.amazonaws.com/dev/analytics/test-hash
```

Check CloudWatch Logs for confirmation.

---

**Status**: ✅ All 3 Lambdas deployed with minimal optimized packages
**Date**: 2026-01-10
**Deployed By**: AWS CLI
**Managed By**: Terraform (infrastructure) + Manual deployment (code)
