const { ConsoleLog, Config, generateProject, buildProject, TwaManifest } = require('@bubblewrap/core');
const path = require('path');

async function run() {
  // Use ConsoleLog instead of CliLog
  const processLog = new ConsoleLog();
  
  // Load local manifest
  const twaManifest = await TwaManifest.fromLocalFolder(__dirname);
  
  // Configure keystore explicitly
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