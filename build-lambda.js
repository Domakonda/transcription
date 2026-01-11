#!/usr/bin/env node
/**
 * Build script for Lambda functions
 * Creates minimal, bundled packages with clean structure
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

// Lambda configurations
const lambdas = [
  {
    name: 'transcription',
    handler: 'dmg-inbound-callrecording-transcription',
    dependencies: ['@aws-sdk/client-bedrock-data-automation-runtime'],
  },
  {
    name: 'persistence',
    handler: 'dmg-inbound-callrecording-persistence',
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
  },
  {
    name: 'retrieval',
    handler: 'dmg-inbound-callrecording-retrieval',
    dependencies: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
  },
];

async function buildLambda(config) {
  console.log(`\n📦 Building ${config.name} Lambda...`);

  const outDir = `deploy-bundled/${config.name}`;

  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Copy handler code (bundled with local imports only)
  await esbuild.build({
    entryPoints: [`dist/handlers/${config.handler}.js`],
    bundle: true,
    minify: false,        // Keep code readable
    platform: 'node',
    target: 'node20',
    outfile: `${outDir}/index.js`,
    external: ['@aws-sdk/*'],  // Don't bundle AWS SDK
    sourcemap: false,
    format: 'cjs',
    keepNames: true,
  });

  console.log(`✅ Handler bundled: ${outDir}/index.js`);

  // Install only required dependencies
  const packageJson = {
    name: `${config.name}-lambda`,
    version: '1.0.0',
    dependencies: {},
  };

  const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  config.dependencies.forEach((dep) => {
    packageJson.dependencies[dep] = rootPackageJson.dependencies[dep];
  });

  fs.writeFileSync(
    `${outDir}/package.json`,
    JSON.stringify(packageJson, null, 2)
  );

  console.log(`📦 Installing dependencies for ${config.name}...`);
  execSync('npm install --production --silent', {
    cwd: outDir,
    stdio: 'inherit',
  });

  // Get bundle size
  const stats = fs.statSync(`${outDir}/index.js`);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`   Handler size: ${sizeKB} KB`);

  return outDir;
}

async function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const sizeKB = (archive.pointer() / 1024).toFixed(2);
      console.log(`✅ Created ${path.basename(outputPath)} (${sizeKB} KB)`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  console.log('🚀 Building Lambda packages with esbuild...\n');

  // Create deploy-bundled directory
  if (!fs.existsSync('deploy-bundled')) {
    fs.mkdirSync('deploy-bundled');
  }

  // Build each Lambda
  for (const lambda of lambdas) {
    const outDir = await buildLambda(lambda);

    // Create ZIP
    const zipPath = `deploy-bundled/lambda-${lambda.name}-bundled.zip`;
    await createZip(outDir, zipPath);
  }

  console.log('\n✨ All Lambda packages built successfully!\n');

  // Show summary
  console.log('📊 Package Summary:');
  for (const lambda of lambdas) {
    const zipPath = `deploy-bundled/lambda-${lambda.name}-bundled.zip`;
    const stats = fs.statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   ${lambda.name}: ${sizeKB} KB`);
  }
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
