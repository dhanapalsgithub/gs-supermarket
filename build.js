const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Starting Bubblewrap CLI build...');

  const keystorePath = path.join(__dirname, 'release.keystore');
  const keyAlias = process.env.RELEASE_KEY_ALIAS || 'release';

  if (!fs.existsSync(keystorePath)) {
    throw new Error('release.keystore file not found!');
  }

  // Set default SDK/JDK paths for GitHub Actions environment
  const androidSdkPath = process.env.ANDROID_HOME || '/usr/local/lib/android/sdk';
  const javaHomePath = process.env.JAVA_HOME;

  // Added --skipConfig to bypass interactive prompts and use ~/.bubblewrap/config.json
  const buildCmd = `npx @bubblewrap/cli build --skipConfig --signingKeyPath="${keystorePath}" --signingKeyAlias="${keyAlias}"`;

  console.log('Executing:', buildCmd);

  try {
    execSync(buildCmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ANDROID_HOME: androidSdkPath,
        ANDROID_SDK_ROOT: androidSdkPath,
        JAVA_HOME: javaHomePath,
        BUBBLEWRAP_KEYSTORE_PASSWORD: process.env.BUBBLEWRAP_KEYSTORE_PASSWORD,
        BUBBLEWRAP_KEY_PASSWORD: process.env.BUBBLEWRAP_KEY_PASSWORD
      }
    });
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Bubblewrap build failed:', error.message);
    process.exit(1);
  }
}

run();