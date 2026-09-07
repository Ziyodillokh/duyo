const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports `./wa-sqlite/wa-sqlite.wasm`, and Metro
// ships with no idea what a .wasm file is — so it resolved nothing and the
// worker failed to bundle on every request ("Unable to resolve
// ./wa-sqlite/wa-sqlite.wasm"). The binary is present in node_modules; only
// the extension was missing. Treating it as an asset is what lets SQLite —
// and so the memory feature — work on web at all.
config.resolver.assetExts.push('wasm');

// The Play bundle must not CONTAIN the self-updater, not merely refuse to run
// it. app-update.ts fetches a version manifest and points the user at an APK —
// Device and Network Abuse, if it ever executed. It cannot: the manifest URL is
// unset in this build and IS_PLAY_BUILD returns first. But Metro does not
// tree-shake, so the code shipped anyway, and a reviewer reading the bundle
// should find nothing rather than something that is merely unreachable.
//
// Swapped by the resolver so exactly one file changes and every import site
// stays as it is. The sideload APK build sets no EXPO_PUBLIC_DISTRIBUTION and
// resolves the real module, so it still updates itself.
if (process.env.EXPO_PUBLIC_DISTRIBUTION === 'play') {
  const path = require('path');
  const REAL = path.resolve(__dirname, 'src/lib/app-update.ts');
  const STUB = path.resolve(__dirname, 'src/lib/app-update.play.ts');
  const upstream = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = (upstream ?? context.resolveRequest)(context, moduleName, platform);
    if (resolved && resolved.type === 'sourceFile' && path.resolve(resolved.filePath) === REAL) {
      return { ...resolved, filePath: STUB };
    }
    return resolved;
  };
}

module.exports = config;
