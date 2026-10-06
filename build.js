const { CliLog, Config, generateProject, buildProject } = require('@bubblewrap/core');
const path = require('path');
const fs = require('fs');

async function run() {
  const processLog = new CliLog();
  const manifestPath = path.join(__dirname, 'twa-manifest.json');
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Keystore secrets setup
  manifestJson.signingKey = {
    path: path.join(__dirname, 'release.keystore'),
    alias: process.env.RELEASE_KEY_ALIAS || 'release'
  };

  const config = new Config(
    process.env.JAVA_HOME,
    process.env.ANDROID_HOME
  );

  console.log('Generating Android Project...');
  await generateProject(manifestJson, __dirname, config, processLog);

  console.log('Building Android Package...');
  await buildProject(
    config,
    manifestJson,
    process.env.BUBBLEWRAP_KEYSTORE_PASSWORD,
    process.env.BUBBLEWRAP_KEY_PASSWORD,
    processLog
  );

  console.log('Build completed successfully!');
}

run().catch((err) => {
  console.error('Build Error:', err);
  process.exit(1);
});