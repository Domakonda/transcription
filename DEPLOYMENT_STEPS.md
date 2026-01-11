# Lambda Deployment Process - Step-by-Step Guide

Complete breakdown of the deployment process from source code to running Lambda in AWS.

---

## 🎯 Overview

**Goal**: Deploy TypeScript Lambda functions to AWS as optimized, single-file bundles

**Starting Point**: TypeScript source code in `src/`

**End Result**: Lambda functions running in AWS (113-195 KB each)

---

## 📋 Complete Step-by-Step Process

### **PHASE 0: Developer Setup**

**Step 0.1**: Write TypeScript Source Code
- Create handler files in `src/handlers/`
  - `dmg-inbound-callrecording-transcription.ts`
  - `dmg-inbound-callrecording-persistence.ts`
  - `dmg-inbound-callrecording-retrieval.ts`
- Create shared configuration in `src/config/index.ts`
- Define TypeScript types in `src/types/index.ts`

---

### **PHASE 1: Install Dependencies** (`yarn install`)

**Command**: `yarn install`

**Step 1.1**: Read Project Configuration
- Read `package.json` to identify required dependencies
- List includes:
  - `@aws-sdk/client-bedrock-data-automation-runtime`
  - `@aws-sdk/client-s3`
  - `@aws-sdk/client-dynamodb`
  - `@aws-sdk/lib-dynamodb`
  - `typescript`
  - `esbuild`
  - `archiver`

**Step 1.2**: Check for Lock File
- Check if `yarn.lock` exists in project root
  - **If YES**: Use exact versions from `yarn.lock` (ensures consistency)
  - **If NO**: Resolve version ranges from `package.json` (e.g., `^3.966.0`)

**Step 1.3**: Download Packages from npm Registry
- For each dependency:
  - Download package tarball from https://registry.yarnpkg.com/
  - Download transitive dependencies (e.g., `@smithy/*`, `@aws-crypto/*`)
  - Verify package integrity using checksums

**Step 1.4**: Extract to `node_modules/`
- Unpack all downloaded packages
- Create directory structure:
  ```
  node_modules/
  ├── @aws-sdk/
  │   ├── client-bedrock-data-automation-runtime/
  │   ├── client-s3/
  │   ├── client-dynamodb/
  │   └── lib-dynamodb/
  ├── @smithy/
  ├── typescript/
  ├── esbuild/
  └── archiver/
  ```

**Step 1.5**: Create/Update `yarn.lock`
- Generate lock file with exact versions of all installed packages
- Includes checksums and resolved URLs
- Ensures future installs use identical versions

**📊 Result**: `node_modules/` populated with ~22 MB of dependencies

---

### **PHASE 2: Compile TypeScript** (`yarn build`)

**Command**: `yarn build` (executes `tsc`)

**Step 2.1**: Read TypeScript Configuration
- Read `tsconfig.json` to determine compilation settings:
  - `rootDir: "src"` - Where to find TypeScript files
  - `outDir: "dist"` - Where to output JavaScript files
  - `target: "ES2020"` - JavaScript version to emit
  - `module: "commonjs"` - Module system (required for Node.js)

**Step 2.2**: Locate Source Files
- Find all `.ts` files in `src/` directory:
  - `src/handlers/dmg-inbound-callrecording-transcription.ts`
  - `src/handlers/dmg-inbound-callrecording-persistence.ts`
  - `src/handlers/dmg-inbound-callrecording-retrieval.ts`
  - `src/config/index.ts`
  - `src/types/index.ts`

**Step 2.3**: Read TypeScript Source Files
- For each `.ts` file:
  - Read file contents
  - Parse TypeScript syntax
  - Build abstract syntax tree (AST)

**Step 2.4**: Type Checking
- Verify all types are correct
  - Check import statements resolve properly
  - Validate function signatures match
  - Ensure variables have compatible types
  - Verify AWS SDK types are correct
- Report any type errors (compilation fails if errors found)

**Step 2.5**: Emit JavaScript
- For each TypeScript file, generate corresponding JavaScript file:
  - Remove type annotations (TypeScript-specific syntax)
  - Convert modern syntax if needed (based on `target`)
  - Keep same directory structure
  - Generate source maps (optional, for debugging)

**Step 2.6**: Write Output Files
- Create `dist/` directory structure:
  ```
  dist/
  ├── handlers/
  │   ├── dmg-inbound-callrecording-transcription.js
  │   ├── dmg-inbound-callrecording-persistence.js
  │   └── dmg-inbound-callrecording-retrieval.js
  ├── config/
  │   └── index.js
  └── types/
      └── index.js
  ```

**📊 Result**: JavaScript files in `dist/` (~8 KB total)

---

### **PHASE 3: Bundle with esbuild** (`yarn build:lambda`)

**Command**: `yarn build:lambda` (executes `npm run build && node build-lambda.js`)

#### **Sub-Phase 3A: Run TypeScript Compilation**

**Step 3A.1**: Execute `yarn build`
- Runs Phase 2 again (ensures latest TypeScript changes are compiled)

#### **Sub-Phase 3B: Bundle Each Lambda**

**Step 3B.1**: Execute `build-lambda.js` Script
- Node.js runs the custom bundling script
- Loops through each Lambda function:
  1. Transcription
  2. Persistence
  3. Retrieval

---

#### **For Each Lambda (e.g., Transcription):**

**Step 3B.2**: Configure esbuild
- Set bundling options:
  - `entryPoints`: `['dist/handlers/dmg-inbound-callrecording-transcription.js']`
  - `bundle: true` - Combine all dependencies
  - `minify: true` - Compress code
  - `platform: 'node'` - Target Node.js environment
  - `target: 'node20'` - Node.js 20 runtime
  - `outfile`: `'deploy-bundled/transcription/index.js'`
  - `external: []` - Bundle everything (no external dependencies)
  - `sourcemap: false` - Don't generate source maps (saves space)
  - `treeShaking: true` - Remove unused code

**Step 3B.3**: Read Entry Point
- esbuild reads `dist/handlers/dmg-inbound-callrecording-transcription.js`
- Parses JavaScript to identify all import statements

**Step 3B.4**: Follow Import Chain
- For each import found:

  **Import 1**: `import { config } from '../config'`
  - Read `dist/config/index.js`
  - Inline the config code into bundle

  **Import 2**: `import { BedrockDataAutomationRuntimeClient } from '@aws-sdk/...'`
  - Locate package in `node_modules/@aws-sdk/client-bedrock-data-automation-runtime/`
  - Read main entry file
  - Follow all nested imports within AWS SDK
  - Include `@smithy/*` dependencies
  - Include `@aws-crypto/*` dependencies
  - Total: ~10 MB of SDK code

  **Import 3**: `import { randomUUID } from 'crypto'`
  - Recognize as Node.js built-in module
  - Mark as external (don't bundle, available in Lambda runtime)

**Step 3B.5**: Tree-Shaking (Dead Code Elimination)
- Analyze which functions/classes are actually called
- Remove unused exports from AWS SDK
- Example:
  - AWS SDK exports 50 different operations
  - Handler only uses `InvokeDataAutomationAsyncCommand`
  - Tree-shaking removes the other 49 operations
- Result: Reduce 10 MB SDK → ~100 KB of actually used code

**Step 3B.6**: Minification
- Remove all whitespace (spaces, newlines, tabs)
- Shorten variable names:
  - `const bedrockDataAutomationClient` → `const a`
  - `async function processTranscription` → `async function b`
- Remove comments
- Simplify expressions where possible
- Result: Further compress code by ~40%

**Step 3B.7**: Write Bundled Output
- Write single file: `deploy-bundled/transcription/index.js`
- File size: 384 KB (uncompressed)
- Contains:
  - Your handler code
  - Config code
  - All AWS SDK code (tree-shaken)
  - All dependencies (minified)
  - Everything in one file!

**Step 3B.8**: Create ZIP Archive
- Use `archiver` library to create ZIP file
- Read `deploy-bundled/transcription/index.js`
- Compress using ZIP algorithm
- Write `deploy-bundled/lambda-transcription-bundled.zip`
- ZIP size: 113 KB (compressed)

**Step 3B.9**: Repeat for Other Lambdas
- **Persistence Lambda**:
  - Entry: `dist/handlers/dmg-inbound-callrecording-persistence.js`
  - Bundles: S3 client, DynamoDB client
  - Output: `deploy-bundled/persistence/index.js`
  - ZIP: `lambda-persistence-bundled.zip` (195 KB)

- **Retrieval Lambda**:
  - Entry: `dist/handlers/dmg-inbound-callrecording-retrieval.js`
  - Bundles: DynamoDB client only
  - Output: `deploy-bundled/retrieval/index.js`
  - ZIP: `lambda-retrieval-bundled.zip` (139 KB)

**📊 Result**: 3 ZIP files (113 KB, 195 KB, 139 KB) in `deploy-bundled/`

---

### **PHASE 4: Deploy to AWS** (`yarn deploy:all`)

**Command**: `yarn deploy:all`

**Step 4.1**: Execute Deployment Scripts Sequentially
- Runs three commands in order:
  1. `yarn deploy:transcription`
  2. `yarn deploy:persistence`
  3. `yarn deploy:retrieval`

---

#### **For Each Lambda (e.g., Transcription):**

**Step 4.2**: Change Directory
- Navigate to `deploy-bundled/` folder
- Ensures ZIP file paths are correct

**Step 4.3**: Read AWS Credentials
- AWS CLI reads credentials from:
  - `~/.aws/credentials` (credentials file)
  - OR environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
  - OR IAM role (if running on EC2/ECS)

**Step 4.4**: Authenticate with AWS
- AWS CLI validates credentials with AWS STS (Security Token Service)
- Exchanges credentials for temporary session token
- Verifies IAM permissions to update Lambda functions

**Step 4.5**: Read ZIP File
- Read `lambda-transcription-bundled.zip` from disk (113 KB)
- Load entire file into memory

**Step 4.6**: Prepare API Request
- Construct HTTP request:
  - **Endpoint**: `lambda.us-east-1.amazonaws.com`
  - **Method**: POST
  - **Path**: `/2015-03-31/functions/dmg-inbound-callrecording-transcription/code`
  - **Headers**:
    - `Authorization: AWS4-HMAC-SHA256 ...` (signed request)
    - `Content-Type: application/zip`
    - `Content-Length: 115584` (113 KB in bytes)
  - **Body**: Binary ZIP file contents

**Step 4.7**: Upload ZIP to AWS Lambda Service
- Send HTTPS POST request to Lambda API
- Upload 113 KB ZIP file over the internet
- Progress: Typically takes 1-2 seconds with good connection

**Step 4.8**: AWS Lambda Receives Upload
- Lambda service receives ZIP file
- Stores temporarily for validation

**Step 4.9**: Validate ZIP Format
- Lambda checks:
  - Is it a valid ZIP file?
  - Can it be extracted?
  - Is it under 50 MB limit?
  - Does it contain valid code?

**Step 4.10**: Extract ZIP Contents
- Lambda unzips the file
- Finds `index.js` (single file)
- Validates JavaScript syntax

**Step 4.11**: Store Code in Internal S3
- Lambda service has private S3 bucket (not visible to users)
- Uploads extracted code to S3 for storage
- Generates unique version identifier

**Step 4.12**: Update Lambda Metadata
- Update Lambda function configuration in AWS database:
  - `CodeSize: 116018` (113 KB in bytes)
  - `CodeSha256: abc123def456...` (SHA-256 hash for version tracking)
  - `LastModified: 2026-01-10T19:30:00.000Z`
  - `Runtime: nodejs20.x`
  - `Handler: index.handler`
  - `Version: $LATEST`

**Step 4.13**: Return Success Response
- Lambda API returns HTTP 200 OK with JSON:
  ```json
  {
    "FunctionName": "dmg-inbound-callrecording-transcription",
    "FunctionArn": "arn:aws:lambda:us-east-1:488786173548:function:dmg-inbound-callrecording-transcription",
    "Runtime": "nodejs20.x",
    "Handler": "index.handler",
    "CodeSize": 116018,
    "LastModified": "2026-01-10T19:30:00.000+0000"
  }
  ```

**Step 4.14**: AWS CLI Displays Result
- Shows success message in terminal:
  ```
  ✅ Successfully updated function: dmg-inbound-callrecording-transcription
  CodeSize: 113 KB
  ```

**Step 4.15**: Repeat for Other Lambdas
- Deploy persistence Lambda (195 KB)
- Deploy retrieval Lambda (139 KB)

**📊 Result**: All 3 Lambdas deployed and ready in AWS

---

### **PHASE 5: Lambda Runtime in AWS**

This phase happens automatically when an event triggers your Lambda.

#### **Scenario A: First Invocation (Cold Start)**

**Step 5A.1**: Event Triggers Lambda
- Event source sends event to Lambda:
  - **Transcription**: SQS message with audio file details
  - **Persistence**: S3 event notification
  - **Retrieval**: API Gateway HTTP request

**Step 5A.2**: Lambda Service Receives Event
- AWS Lambda service receives the trigger
- Checks if there's a warm container available for this function

**Step 5A.3**: No Warm Container Available
- Decision: Need to do a cold start
- Allocates compute resources (CPU, memory)

**Step 5A.4**: Create Execution Environment
- AWS creates isolated container (microVM)
- Allocates memory: 512 MB (or configured amount)
- Allocates CPU proportional to memory

**Step 5A.5**: Initialize Node.js Runtime
- Install Node.js 20.x runtime in container
- Set up system libraries
- Initialize V8 JavaScript engine
- Time: ~100-200ms

**Step 5A.6**: Download Code from Internal S3
- Fetch `index.js` from Lambda's private S3 bucket
- Download 113 KB file
- Time: ~30-50ms (fast because it's small!)

**Step 5A.7**: Load JavaScript Code
- Node.js reads `index.js`
- Parses JavaScript syntax
- Compiles to machine code (V8 JIT compilation)
- Time: ~50-100ms

**Step 5A.8**: Initialize AWS SDK Clients
- Your code runs initialization:
  ```javascript
  const client = new BedrockDataAutomationRuntimeClient({
    region: 'us-east-1'
  });
  ```
- Creates HTTP connection pools
- Sets up credentials
- Time: ~100-200ms

**Step 5A.9**: Load Configuration
- Read environment variables:
  - `BEDROCK_PROJECT_ARN`
  - `BEDROCK_PROFILE_ARN`
  - `S3_INPUT_BUCKET`
  - `S3_OUTPUT_BUCKET`
  - `DYNAMODB_TABLE_NAME`
- Store in config object
- Time: <1ms

**Step 5A.10**: Handler Ready
- Container is now "warm"
- Total cold start time: ~600-800ms
  - Compare to 22 MB package: ~2-3 seconds!

**Step 5A.11**: Invoke Handler Function
- Lambda calls your exported handler:
  ```javascript
  exports.handler(event, context, callback)
  ```

**Step 5A.12**: Execute Business Logic
- Your handler code runs:
  - **Transcription**: Parse SQS message, invoke Bedrock
  - **Persistence**: Download S3 file, store in DynamoDB
  - **Retrieval**: Query DynamoDB, return paginated results

**Step 5A.13**: Call AWS Services
- Handler makes AWS SDK calls:
  - `bedrockClient.send(InvokeDataAutomationAsyncCommand)`
  - `s3Client.send(GetObjectCommand)`
  - `dynamoDBClient.send(QueryCommand)`
- Time: Depends on service (typically 50-500ms)

**Step 5A.14**: Return Response
- Handler returns result:
  ```javascript
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  }
  ```

**Step 5A.15**: Lambda Returns to Event Source
- Lambda service sends response back:
  - **SQS**: Deletes message from queue
  - **S3**: Logs success
  - **API Gateway**: Returns HTTP 200 to client

**Step 5A.16**: Keep Container Warm
- Lambda keeps container running for ~10-15 minutes
- If another request comes in during this time → warm start!

---

#### **Scenario B: Subsequent Invocation (Warm Start)**

**Step 5B.1**: Event Triggers Lambda
- Another event arrives within 15 minutes

**Step 5B.2**: Lambda Service Receives Event
- Checks for warm container
- Found! Container is still running

**Step 5B.3**: Reuse Existing Container
- Skip steps 5A.4 through 5A.10 (already done!)
- Jump directly to handler invocation

**Step 5B.4**: Invoke Handler
- Call `exports.handler(event)` immediately
- Total latency: ~5-20ms (instead of 600-800ms)

**Step 5B.5**: Execute and Return
- Same as steps 5A.12 through 5A.15

---

## 📊 Performance Comparison

### Before Bundling (22 MB package)
1. **Download**: 500-800ms (large file)
2. **Extract**: 400-600ms (3,038 files to unzip)
3. **Load**: 200-300ms (parse many files)
4. **Initialize**: 800-1000ms (load dependencies)
5. **Total Cold Start**: **2-3 seconds**

### After Bundling (113 KB package)
1. **Download**: 30-50ms (small file)
2. **Extract**: 20-30ms (1 file only)
3. **Load**: 50-100ms (single file)
4. **Initialize**: 500-600ms (pre-bundled code)
5. **Total Cold Start**: **0.6-0.8 seconds**

**Improvement**: 70% faster cold starts!

---

## 🎯 Summary

**Total Steps**: 5 Phases, 75+ individual steps

**Key Transformations**:
1. TypeScript (8 KB) → JavaScript (8 KB)
2. JavaScript + Dependencies (22 MB) → Bundled (113 KB)
3. Local machine → AWS Lambda
4. Cold start (2-3s) → Optimized (0.6-0.8s)

**Files Created During Process**:
- `node_modules/` - Dependencies (22 MB)
- `dist/` - Compiled JavaScript (8 KB)
- `deploy-bundled/` - Bundled code (113-195 KB)
- `*.zip` - Deployment packages (113-195 KB)

**Final State in AWS**:
- 3 Lambda functions
- Each with single `index.js` file
- Ready to handle events
- Optimized for performance

---

## 🚀 Quick Reference Commands

```bash
# Full deployment process
yarn install          # Phase 1: Install dependencies
yarn build            # Phase 2: Compile TypeScript
yarn build:lambda     # Phase 3: Bundle with esbuild
yarn deploy:all       # Phase 4: Deploy to AWS
                      # Phase 5: Happens automatically on events
```

**Total time for full deployment**: ~2-5 minutes (depending on internet speed)
