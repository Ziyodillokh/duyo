const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports `./wa-sqlite/wa-sqlite.wasm`, and Metro
// ships with no idea what a .wasm file is — so it resolved nothing and the
// worker failed to bundle on every request ("Unable to resolve
// ./wa-sqlite/wa-sqlite.wasm"). The binary is present in node_modules; only
// the extension was missing. Treating it as an asset is what lets SQLite —
// and so the memory feature — work on web at all.
config.resolver.assetExts.push('wasm');

module.exports = config;
