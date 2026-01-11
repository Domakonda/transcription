# Lambda Deployment Flow - Complete Process

This document visualizes the entire deployment process from source code to AWS Lambda using Mermaid diagrams.

## Overview: Full Deployment Pipeline

```mermaid
graph TB
    Start([Developer writes TypeScript]) --> Install[yarn install]
    Install --> Build[yarn build]
    Build --> Bundle[yarn build:lambda]
    Bundle --> Deploy[yarn deploy:all]
    Deploy --> AWS[Lambda Running in AWS]

    style Start fill:#e1f5ff
    style Install fill:#fff3cd
    style Build fill:#d1ecf1
    style Bundle fill:#d4edda
    style Deploy fill:#f8d7da
    style AWS fill:#d4edda
```

---

## Phase 1: Dependency Installation (yarn install)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Yarn as Yarn CLI
    participant NPM as npm Registry
    participant FS as File System

    Dev->>Yarn: yarn install
    Yarn->>FS: Read package.json
    FS-->>Yarn: Dependencies list

    alt yarn.lock exists
        Yarn->>FS: Read yarn.lock
        FS-->>Yarn: Exact versions
        Note over Yarn: Use locked versions
    else No yarn.lock
        Note over Yarn: Resolve version ranges
    end

    Yarn->>NPM: Download @aws-sdk/client-bedrock-data-automation-runtime@^3.966.0
    NPM-->>Yarn: Package tarball
    Yarn->>NPM: Download @aws-sdk/client-s3@^3.716.0
    NPM-->>Yarn: Package tarball
    Yarn->>NPM: Download typescript@^5.7.2
    NPM-->>Yarn: Package tarball
    Yarn->>NPM: Download esbuild@^0.27.2
    NPM-->>Yarn: Package tarball

    Yarn->>FS: Extract to node_modules/
    Yarn->>FS: Create/update yarn.lock
    Yarn-->>Dev: ✅ Dependencies installed
```

### Detailed Dependency Tree

```mermaid
graph TB
    subgraph "node_modules/"
        SDK1["@aws-sdk/client-bedrock-data-automation-runtime"]
        SDK2["@aws-sdk/client-s3"]
        SDK3["@aws-sdk/client-dynamodb"]
        SDK4["@aws-sdk/lib-dynamodb"]
        TS["typescript"]
        ESB["esbuild"]
        ARCH["archiver"]

        SDK1 --> SMITHY1["@smithy/protocol-http"]
        SDK1 --> SMITHY2["@smithy/types"]
        SDK2 --> SMITHY3["@smithy/middleware-*"]
        SDK3 --> CRYPTO["@aws-crypto/*"]
    end

    PJ["package.json"] -.->|declares| SDK1
    PJ -.->|declares| SDK2
    PJ -.->|declares| SDK3
    PJ -.->|declares| TS
    PJ -.->|declares| ESB

    style PJ fill:#fff3cd
    style SDK1 fill:#d1ecf1
    style SDK2 fill:#d1ecf1
    style SDK3 fill:#d1ecf1
    style TS fill:#d4edda
    style ESB fill:#d4edda
```

---

## Phase 2: TypeScript Compilation (yarn build)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Yarn as Yarn CLI
    participant TSC as TypeScript Compiler
    participant FS as File System

    Dev->>Yarn: yarn build
    Yarn->>TSC: Execute node_modules/.bin/tsc
    TSC->>FS: Read tsconfig.json
    FS-->>TSC: Configuration

    Note over TSC: rootDir: "src"<br/>outDir: "dist"<br/>target: "ES2020"

    TSC->>FS: Read src/handlers/transcription.ts
    FS-->>TSC: TypeScript source
    TSC->>FS: Read src/config/index.ts
    FS-->>TSC: TypeScript source
    TSC->>FS: Read src/types/index.ts
    FS-->>TSC: TypeScript source

    Note over TSC: Type checking...<br/>Compiling to JavaScript...

    TSC->>FS: Write dist/handlers/transcription.js
    TSC->>FS: Write dist/config/index.js
    TSC->>FS: Write dist/types/index.js

    TSC-->>Yarn: ✅ Compilation successful
    Yarn-->>Dev: Build complete
```

### File Transformation Flow

```mermaid
graph LR
    subgraph "src/ (TypeScript)"
        TS1["handlers/<br/>transcription.ts"]
        TS2["handlers/<br/>persistence.ts"]
        TS3["handlers/<br/>retrieval.ts"]
        TS4["config/<br/>index.ts"]
        TS5["types/<br/>index.ts"]
    end

    subgraph "TypeScript Compiler"
        TSC["tsc<br/>(reads tsconfig.json)"]
    end

    subgraph "dist/ (JavaScript)"
        JS1["handlers/<br/>transcription.js"]
        JS2["handlers/<br/>persistence.js"]
        JS3["handlers/<br/>retrieval.js"]
        JS4["config/<br/>index.js"]
        JS5["types/<br/>index.js"]
    end

    TS1 -->|compile| TSC
    TS2 -->|compile| TSC
    TS3 -->|compile| TSC
    TS4 -->|compile| TSC
    TS5 -->|compile| TSC

    TSC -->|emit| JS1
    TSC -->|emit| JS2
    TSC -->|emit| JS3
    TSC -->|emit| JS4
    TSC -->|emit| JS5

    style TSC fill:#d1ecf1
    style TS1 fill:#fff3cd
    style TS2 fill:#fff3cd
    style TS3 fill:#fff3cd
    style JS1 fill:#d4edda
    style JS2 fill:#d4edda
    style JS3 fill:#d4edda
```

---

## Phase 3: Lambda Bundling (yarn build:lambda)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Yarn as Yarn CLI
    participant Node as Node.js
    participant ESB as esbuild
    participant Arch as archiver
    participant FS as File System

    Dev->>Yarn: yarn build:lambda
    Yarn->>Yarn: Run: yarn build
    Note over Yarn: (TypeScript compilation)

    Yarn->>Node: Execute build-lambda.js

    Note over Node: Loop for each Lambda:<br/>1. transcription<br/>2. persistence<br/>3. retrieval

    Node->>ESB: esbuild.build() for transcription
    ESB->>FS: Read dist/handlers/transcription.js
    FS-->>ESB: JavaScript code

    Note over ESB: Follow imports...

    ESB->>FS: Read dist/config/index.js
    FS-->>ESB: Config code
    ESB->>FS: Read node_modules/@aws-sdk/client-bedrock-data-automation-runtime
    FS-->>ESB: AWS SDK code
    ESB->>FS: Read node_modules/@smithy/*
    FS-->>ESB: Smithy dependencies

    Note over ESB: Bundling...<br/>Tree-shaking...<br/>Minifying...

    ESB->>FS: Write deploy-bundled/transcription/index.js
    Note over FS: 113 KB (was ~12 MB)

    ESB-->>Node: ✅ Bundle complete

    Node->>Arch: Create ZIP for transcription
    Arch->>FS: Read deploy-bundled/transcription/index.js
    FS-->>Arch: Bundled file
    Arch->>FS: Write lambda-transcription-bundled.zip
    Arch-->>Node: ✅ ZIP created

    Note over Node: Repeat for persistence<br/>and retrieval...

    Node-->>Yarn: All bundles created
    Yarn-->>Dev: ✅ Build complete
```

### esbuild Bundling Process (Detailed)

```mermaid
graph TB
    subgraph "Entry Point"
        Entry["dist/handlers/<br/>transcription.js<br/>(2 KB)"]
    end

    subgraph "Dependencies Discovery"
        Entry --> Import1["import config from<br/>'../config'"]
        Entry --> Import2["import BedrockClient from<br/>'@aws-sdk/...'"]
        Entry --> Import3["import crypto from<br/>'crypto'"]

        Import1 --> Config["dist/config/index.js<br/>(1 KB)"]
        Import2 --> SDK["node_modules/@aws-sdk/<br/>client-bedrock-...<br/>(10 MB)"]
        SDK --> Smithy["@smithy/*<br/>(2 MB)"]
        Import3 --> NodeBuiltin["Node.js built-in<br/>(excluded)"]
    end

    subgraph "esbuild Processing"
        Config --> Bundle["Bundle & Inline"]
        SDK --> Bundle
        Smithy --> Bundle
        Bundle --> TreeShake["Tree Shake<br/>(Remove unused code)"]
        TreeShake --> Minify["Minify<br/>(Compress)"]
    end

    subgraph "Output"
        Minify --> Output["deploy-bundled/<br/>transcription/<br/>index.js<br/>(113 KB)"]
    end

    style Entry fill:#fff3cd
    style SDK fill:#f8d7da
    style Bundle fill:#d1ecf1
    style TreeShake fill:#d1ecf1
    style Minify fill:#d1ecf1
    style Output fill:#d4edda
```

### Bundle Size Reduction

```mermaid
graph LR
    subgraph "Before Bundling"
        Before["Total: ~22 MB<br/>Files: 3,038<br/>────────────<br/>handler.js: 2 KB<br/>config.js: 1 KB<br/>node_modules/: 22 MB"]
    end

    subgraph "esbuild Process"
        Process["Bundle + Tree-shake + Minify"]
    end

    subgraph "After Bundling"
        After["Total: 113 KB<br/>Files: 1<br/>────────────<br/>index.js: 113 KB<br/>(everything bundled)"]
    end

    Before -->|esbuild| Process
    Process -->|99.5% smaller| After

    style Before fill:#f8d7da
    style Process fill:#d1ecf1
    style After fill:#d4edda
```

---

## Phase 4: AWS Deployment (yarn deploy:all)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Yarn as Yarn CLI
    participant AWS_CLI as AWS CLI
    participant S3 as AWS S3
    participant Lambda as AWS Lambda

    Dev->>Yarn: yarn deploy:all

    Note over Yarn: Sequential deployment:<br/>1. transcription<br/>2. persistence<br/>3. retrieval

    Yarn->>Yarn: yarn deploy:transcription
    Yarn->>AWS_CLI: aws lambda update-function-code

    AWS_CLI->>AWS_CLI: Read ~/.aws/credentials
    Note over AWS_CLI: Authenticate with AWS

    AWS_CLI->>AWS_CLI: Read lambda-transcription-bundled.zip (113 KB)

    AWS_CLI->>Lambda: Upload ZIP via HTTPS
    Note over Lambda: Receive ZIP file

    Lambda->>Lambda: Validate ZIP format
    Lambda->>Lambda: Extract index.js
    Lambda->>S3: Store code in internal S3
    S3-->>Lambda: ✅ Stored

    Lambda->>Lambda: Update function metadata:<br/>- CodeSize: 116018<br/>- CodeSha256: abc123...<br/>- LastModified: 2026-01-10

    Lambda-->>AWS_CLI: Response: Function updated
    AWS_CLI-->>Yarn: ✅ Deployment successful

    Note over Yarn: Repeat for persistence...
    Yarn->>AWS_CLI: Deploy persistence
    AWS_CLI->>Lambda: Upload ZIP
    Lambda-->>AWS_CLI: ✅ Updated

    Note over Yarn: Repeat for retrieval...
    Yarn->>AWS_CLI: Deploy retrieval
    AWS_CLI->>Lambda: Upload ZIP
    Lambda-->>AWS_CLI: ✅ Updated

    Yarn-->>Dev: ✅ All Lambdas deployed
```

### AWS Lambda Update Process

```mermaid
stateDiagram-v2
    [*] --> ReadZIP: AWS CLI reads ZIP
    ReadZIP --> Authenticate: Get AWS credentials
    Authenticate --> Upload: POST to Lambda API
    Upload --> Validate: Lambda validates ZIP

    Validate --> Extract: Valid ZIP
    Validate --> Error: Invalid ZIP

    Extract --> StoreS3: Store in internal S3
    StoreS3 --> UpdateMetadata: Update function config
    UpdateMetadata --> Ready: Function updated
    Ready --> [*]: Return success

    Error --> [*]: Return error

    note right of Upload
        Endpoint:
        lambda.us-east-1.amazonaws.com
        Method: POST
        Path: /2015-03-31/functions/
              {name}/code
    end note

    note right of StoreS3
        Lambda stores code in
        private S3 bucket
        (not visible to users)
    end note
```

---

## Complete End-to-End Flow

```mermaid
graph TB
    subgraph "Local Development"
        direction TB
        A1[Write TypeScript<br/>src/handlers/*.ts] --> A2[yarn install]
        A2 --> A3[yarn build<br/>TypeScript → JavaScript]
        A3 --> A4[yarn build:lambda<br/>Bundle + Minify]
        A4 --> A5[Create ZIPs<br/>113-195 KB each]
    end

    subgraph "AWS Deployment"
        direction TB
        B1[yarn deploy:all] --> B2[AWS CLI uploads ZIPs]
        B2 --> B3[Lambda extracts index.js]
        B3 --> B4[Store in internal S3]
        B4 --> B5[Lambda ready]
    end

    subgraph "Runtime in AWS"
        direction TB
        C1[Event triggers Lambda] --> C2[AWS loads index.js]
        C2 --> C3[Executes handler function]
        C3 --> C4[Read env variables]
        C4 --> C5[Call AWS services]
        C5 --> C6[Return response]
    end

    A5 --> B1
    B5 --> C1

    style A1 fill:#fff3cd
    style A3 fill:#d1ecf1
    style A4 fill:#d1ecf1
    style A5 fill:#d4edda
    style B5 fill:#d4edda
    style C3 fill:#d4edda
```

---

## Data Flow: From TypeScript to Running Lambda

```mermaid
flowchart TD
    Start([Developer Code]) --> TS[TypeScript Files<br/>src/**/*.ts]

    TS -->|tsc compiler| JS[JavaScript Files<br/>dist/**/*.js]

    JS -->|esbuild reads| Bundle{esbuild Bundler}
    NM[node_modules/<br/>@aws-sdk/*] -->|esbuild reads| Bundle

    Bundle -->|process| Inline[Inline all imports]
    Inline --> TreeShake[Remove unused code]
    TreeShake --> Minify[Compress & minify]

    Minify --> Single[Single File<br/>deploy-bundled/*/index.js<br/>113 KB]

    Single -->|archiver| ZIP[ZIP File<br/>lambda-*-bundled.zip]

    ZIP -->|AWS CLI upload| Cloud{AWS Lambda Service}

    Cloud -->|extract| Store[Store in S3]
    Cloud -->|metadata| Meta[Update function config]

    Store --> Ready[Lambda Ready]
    Meta --> Ready

    Ready -->|event triggers| Execute[Execute handler]

    Execute --> Output([Response])

    style TS fill:#fff3cd
    style JS fill:#d1ecf1
    style Bundle fill:#d1ecf1
    style Single fill:#d4edda
    style Ready fill:#d4edda
    style Execute fill:#d4edda
```

---

## File Size Transformation

```mermaid
graph LR
    subgraph "Source"
        S1["handlers/*.ts<br/>~6 KB total"]
        S2["config/index.ts<br/>~1 KB"]
        S3["types/index.ts<br/>~1 KB"]
    end

    subgraph "Compiled"
        C1["handlers/*.js<br/>~8 KB"]
        C2["config/index.js<br/>~1 KB"]
    end

    subgraph "Dependencies"
        D1["node_modules/<br/>@aws-sdk/*<br/>~22 MB<br/>3,038 files"]
    end

    subgraph "Bundled"
        B1["index.js<br/>113 KB<br/>1 file"]
    end

    subgraph "Deployed"
        E1["AWS Lambda<br/>index.js<br/>113 KB"]
    end

    S1 -->|tsc| C1
    S2 -->|tsc| C2
    S3 -->|tsc| C2

    C1 -->|esbuild| B1
    C2 -->|esbuild| B1
    D1 -->|esbuild<br/>tree-shake| B1

    B1 -->|AWS CLI| E1

    style D1 fill:#f8d7da
    style B1 fill:#d4edda
    style E1 fill:#d4edda
```

---

## Deployment Script Execution

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer Terminal
    participant PKG as package.json
    participant Node as Node.js
    participant Build as build-lambda.js
    participant ESB as esbuild
    participant AWS as AWS CLI

    Dev->>PKG: yarn deploy:all
    PKG->>PKG: Execute: yarn deploy:transcription
    PKG->>AWS: cd deploy-bundled && aws lambda update-function-code

    Note over AWS: Reads: lambda-transcription-bundled.zip

    AWS->>AWS: Authenticate (IAM credentials)
    AWS->>AWS: Call Lambda API:<br/>UpdateFunctionCode

    Note over AWS: Upload 113 KB ZIP

    AWS-->>PKG: ✅ HTTP 200 - Function updated

    PKG->>PKG: Execute: yarn deploy:persistence
    PKG->>AWS: aws lambda update-function-code
    AWS-->>PKG: ✅ HTTP 200

    PKG->>PKG: Execute: yarn deploy:retrieval
    PKG->>AWS: aws lambda update-function-code
    AWS-->>PKG: ✅ HTTP 200

    PKG-->>Dev: ✅ All deployments complete
```

---

## Lambda Cold Start (After Deployment)

```mermaid
sequenceDiagram
    participant Event as Event Source<br/>(SQS/S3/API Gateway)
    participant Lambda as AWS Lambda Service
    participant Container as Lambda Container
    participant Code as index.js

    Event->>Lambda: Trigger event

    Note over Lambda: First invocation<br/>(Cold Start)

    Lambda->>Lambda: Create new container
    Lambda->>Container: Initialize runtime (Node.js 20)

    Container->>Lambda: Request code
    Lambda->>Lambda: Fetch from internal S3
    Lambda-->>Container: Download index.js (113 KB)

    Note over Container: Fast download!<br/>~30-50ms

    Container->>Code: Load JavaScript
    Code->>Code: Initialize AWS SDK clients
    Code->>Code: Load config (env vars)

    Note over Code: Handler ready

    Container-->>Lambda: ✅ Container warm

    Lambda->>Code: Invoke: handler(event)
    Code->>Code: Execute business logic
    Code->>Code: Call Bedrock/DynamoDB/S3
    Code-->>Lambda: Return response
    Lambda-->>Event: Response

    Note over Lambda,Container: Total cold start:<br/>~600-800ms<br/>(vs 2-3s with 22 MB)
```

---

## Summary: Why Bundling Matters

```mermaid
graph TB
    subgraph "Without Bundling (22 MB)"
        W1[3,038 files] --> W2[2-3 second cold start]
        W2 --> W3[High memory usage]
        W3 --> W4[Slow deployments]
    end

    subgraph "With Bundling (113 KB)"
        B1[1 file] --> B2[0.6-0.8 second cold start]
        B2 --> B3[Low memory usage]
        B3 --> B4[Fast deployments]
    end

    Bundle["esbuild<br/>bundling"] --> B1

    W1 -.->|99.5% reduction| Bundle

    style W1 fill:#f8d7da
    style W2 fill:#f8d7da
    style Bundle fill:#d1ecf1
    style B1 fill:#d4edda
    style B2 fill:#d4edda
```

---

## Commands Reference

```mermaid
graph LR
    subgraph "Development Commands"
        D1["yarn install"] --> D2["Install dependencies<br/>Create yarn.lock"]
        D3["yarn build"] --> D4["Compile TypeScript"]
        D5["yarn build:lambda"] --> D6["Bundle + create ZIPs"]
    end

    subgraph "Deployment Commands"
        E1["yarn deploy:transcription"] --> E2["Deploy transcription Lambda"]
        E3["yarn deploy:persistence"] --> E4["Deploy persistence Lambda"]
        E5["yarn deploy:retrieval"] --> E6["Deploy retrieval Lambda"]
        E7["yarn deploy:all"] --> E8["Deploy all 3 Lambdas"]
    end

    D6 --> E7

    style D1 fill:#fff3cd
    style D3 fill:#d1ecf1
    style D5 fill:#d1ecf1
    style E7 fill:#d4edda
```
