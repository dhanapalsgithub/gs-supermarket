const { ConsoleLog, Config, generateProject, buildProject, TwaManifest } = require('@bubblewrap/core');
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

  // Set signing key configuration
  twaManifest.signingKey = {
    path: path.join(__dirname, 'release.keystore'),
    alias: process.env.RELEASE_KEY_ALIAS || 'release'
  };

  const config = new Config(
    process.env.JAVA_HOME,
    process.env.ANDROID_HOME
  );

  console.log('Generating Android Project...');
  await generateProject(twaManifest, __dirname, config, processLog);

  console.log('Building Android Package...');
  const success = await buildProject(
    config,
    twaManifest,
    process.env.BUBBLEWRAP_KEYSTORE_PASSWORD,
    process.env.BUBBLEWRAP_KEY_PASSWORD,
    processLog
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