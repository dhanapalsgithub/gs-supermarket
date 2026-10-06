const { ConsoleLog, Config, TwaManifest, TwaBuilder } = require('@bubblewrap/core');
const path = require('path');
const fs = require('fs');

async function run() {
  const processLog = new ConsoleLog();
  
  // Load twa-manifest.json directly
  const manifestPath = path.join(__dirname, 'twa-manifest.json');
  
  let twaManifest;
  if (typeof TwaManifest.fromFile === 'function') {
    twaManifest = await TwaManifest.fromFile(manifestPath);
  } else {
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    twaManifest = new TwaManifest(manifestJson);
  }

  // Set signing key configuration directly from secrets
  twaManifest.signingKey = {
    path: path.join(__dirname, 'release.keystore'),
    alias: process.env.RELEASE_KEY_ALIAS || 'release'
  };

  const config = new Config(
    process.env.JAVA_HOME,
    process.env.ANDROID_HOME
  );

  console.log('Building Android Package using TwaBuilder (AAB/APK)...');
  
  // Instantiate TwaBuilder and trigger build
  const builder = new TwaBuilder(
    config,
    twaManifest,
    processLog
  );

  const success = await builder.build(
    process.env.BUBBLEWRAP_KEYSTORE_PASSWORD,
    process.env.BUBBLEWRAP_KEY_PASSWORD
  );

  if (!success) {
    throw new Error('Bubblewrap TwaBuilder failed to generate release packages');
  }

  console.log('Build completed successfully!');
}

run().catch((err) => {
  console.error('Build Error:', err);
  process.exit(1);
});