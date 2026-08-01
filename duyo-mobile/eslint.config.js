// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Every Uzbek string carries apostrophes (o', g', DUYO'ingiz), and this
      // rule wants each one written as an HTML entity. That guidance is for
      // the web — React Native renders JSX text directly, so there is nothing
      // to escape, and following it would make the UI copy unreadable.
      "react/no-unescaped-entities": "off",
    },
  },
]);
