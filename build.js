const { TwaManifest, Bbwrap, Config } = require('@bubblewrap/core');
const path = require('path');
const fs = require('fs');

async function runBuild() {
  try {
    console.log('Setting up JDK & Android SDK config...');
    const config = new Config(
      process.env.JAVA_HOME,
      process.env.ANDROID_HOME
    );

    console.log('Loading TWA Manifest...');
    const twaManifest = await TwaManifest.fromFile('./twa-manifest.json');
    
    twaManifest.signingKey.path = path.resolve('release.keystore');
    twaManifest.signingKey.alias = process.env.RELEASE_KEY_ALIAS || 'release';

    console.log('Generating TWA Android Project...');
    const bbwrap = new Bbwrap(config);
    await bbwrap.generateProject(twaManifest);

    console.log('Building Signed APK & AAB...');
    const keyStorePassword = process.env.RELEASE_STORE_PASSWORD;
    const keyPassword = process.env.RELEASE_KEY_PASSWORD;

    await bbwrap.buildProject(twaManifest, keyStorePassword, keyPassword);

    // Subfolder-களில் உள்ள APK & AAB கோப்புகளை Root-க்கு நகர்த்துகிறது
    function findAndCopyFiles(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          findAndCopyFiles(fullPath);
        } else if (file.endsWith('.apk') || file.endsWith('.aab')) {
          fs.copyFileSync(fullPath, path.join(process.cwd(), file));
          console.log(`Copied artifact: ${file}`);
        }
      }
    }

    findAndCopyFiles(process.cwd());
    console.log('Build finished successfully!');
  } catch (error) {
    console.error('Build failed with error:', error);
    process.exit(1);
  }
}

runBuild();