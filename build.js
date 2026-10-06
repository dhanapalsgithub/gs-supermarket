const bubblewrapCore = require('@bubblewrap/core');
const path = require('path');
const fs = require('fs');

// Safely extract exports from @bubblewrap/core
const ConsoleLog = bubblewrapCore.ConsoleLog;
const Config = bubblewrapCore.Config;
const TwaManifest = bubblewrapCore.TwaManifest;
const Bubblewrap = bubblewrapCore.Bubblewrap || bubblewrapCore.default || bubblewrapCore;

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

  // Set signing key configuration directly from environment variables
  twaManifest.signingKey = {
    path: path.join(__dirname, 'release.keystore'),
    alias: process.env.RELEASE_KEY_ALIAS || 'release'
  };

  const config = new Config(
    process.env.JAVA_HOME,
    process.env.ANDROID_HOME
  );

  console.log('Building Android Package (AAB/APK)...');
  
  // Instantiate Bubblewrap class safely
  const bubblewrap = new Bubblewrap(config, twaManifest, processLog);
  const success = await bubblewrap.build(
    process.env.BUBBLEWRAP_KEYSTORE_PASSWORD,
    process.env.BUBBLEWRAP_KEY_PASSWORD
  );

  if (!success) {
    throw new Error('Bubblewrap build failed');
  }

  console.log('Build completed successfully!');
}

run().catch((err) => {
  console.error('Build Error:', err);
  process.exit(1);
});