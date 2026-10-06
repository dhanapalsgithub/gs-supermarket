const { TwaManifest, Bbwrap } = require('@bubblewrap/core');
const path = require('path');
const fs = require('fs');

async function runBuild() {
  try {
    console.log('Loading TWA Manifest...');
    const twaManifest = await TwaManifest.fromFile('./twa-manifest.json');
    
    // Keystore path மற்றும் alias சரிபார்க்கிறது
    twaManifest.signingKey.path = path.resolve('release.keystore');
    twaManifest.signingKey.alias = process.env.RELEASE_KEY_ALIAS || 'release';

    console.log('Building TWA Android Project...');
    const bbwrap = new Bbwrap();
    
    // Android project கோப்புகளை உருவாக்குகிறது
    await bbwrap.generateProject(twaManifest);

    // Keystore பாஸ்வேர்டுகளை வழங்கி Sign செய்து Build செய்கிறது
    const keyStorePassword = process.env.RELEASE_STORE_PASSWORD;
    const keyPassword = process.env.RELEASE_KEY_PASSWORD;

    await bbwrap.buildProject(twaManifest, keyStorePassword, keyPassword);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

runBuild();