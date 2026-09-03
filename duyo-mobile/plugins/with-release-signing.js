const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the upload key instead of the debug key.
 *
 * The React Native template ships `release { signingConfig signingConfigs.debug }`,
 * and `signingConfigs.debug` hardcodes Android's published credentials — keystore
 * password `android`, alias `androiddebugkey`. Play refuses anything signed that
 * way. We can't just fix the generated file: `android/` is not in git and every
 * build recreates it from this config, so the edit has to happen at prebuild time.
 *
 * The keystore itself arrives as gradle properties, so neither the file nor the
 * passwords are ever in the repo:
 *
 *   ./gradlew bundleRelease \
 *     -PDUYO_UPLOAD_STORE_FILE=... -PDUYO_UPLOAD_STORE_PASSWORD=... \
 *     -PDUYO_UPLOAD_KEY_ALIAS=...  -PDUYO_UPLOAD_KEY_PASSWORD=...
 *
 * Without those properties the release config stays empty and gradle emits an
 * unsigned artifact. That is deliberate: an unsigned build fails loudly at
 * install or upload, whereas a debug-signed one looks fine right up until Play
 * rejects it. Debug builds are untouched and still need no credentials.
 */

const SIGNING_CONFIGS_OPEN = 'signingConfigs {';
const BUILD_TYPES_OPEN = 'buildTypes {';
const RELEASE_OPEN = 'release {';
const DEBUG_SIGNING = 'signingConfig signingConfigs.debug';

const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('DUYO_UPLOAD_STORE_FILE')) {
                storeFile file(DUYO_UPLOAD_STORE_FILE)
                storePassword DUYO_UPLOAD_STORE_PASSWORD
                keyAlias DUYO_UPLOAD_KEY_ALIAS
                keyPassword DUYO_UPLOAD_KEY_PASSWORD
            }
        }`;

/** Throws rather than returning -1, so a template change can never quietly
 * leave the release build on the debug key. */
function locate(source, needle, from = 0) {
  const at = source.indexOf(needle, from);
  if (at === -1) {
    throw new Error(
      `with-release-signing: "${needle}" not found in app/build.gradle — the ` +
        'React Native template changed and the release signing patch no longer applies.'
    );
  }
  return at;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let source = cfg.modResults.contents;

    const signingConfigsAt = locate(source, SIGNING_CONFIGS_OPEN);
    const insertAt = signingConfigsAt + SIGNING_CONFIGS_OPEN.length;
    source = source.slice(0, insertAt) + RELEASE_SIGNING_CONFIG + source.slice(insertAt);

    // `signingConfig signingConfigs.debug` appears twice — once in the debug
    // buildType, where it belongs. Walk in from `buildTypes { ... release {` so
    // only the release one is rewritten.
    const releaseAt = locate(source, RELEASE_OPEN, locate(source, BUILD_TYPES_OPEN));
    const debugSigningAt = locate(source, DEBUG_SIGNING, releaseAt);
    source =
      source.slice(0, debugSigningAt) +
      'signingConfig signingConfigs.release' +
      source.slice(debugSigningAt + DEBUG_SIGNING.length);

    cfg.modResults.contents = source;
    return cfg;
  });
};
