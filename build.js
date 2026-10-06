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

  // Pass --skipJdkCheck and explicit JDK path to bypass interactive prompt completely
  const jdkPath = process.env.JAVA_HOME || '/opt/hostedtoolcache/Java_Zulu_jdk/17.0.20-8/x64';
  const buildCmd = `npx @bubblewrap/cli build --skipJdkCheck --skipDependenciesCheck --jdkPath="${jdkPath}" --signingKeyPath="${keystorePath}" --signingKeyAlias="${keyAlias}"`;

  console.log('Executing:', buildCmd);

  try {
    execSync(buildCmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        JAVA_HOME: jdkPath,
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