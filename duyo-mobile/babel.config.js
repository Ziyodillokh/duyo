module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      // Play's pre-launch report reads logcat, and the voice pipeline traces
      // through console — a running mic, the path to a WAV of the child's
      // reply. Release builds keep only console.error, which Sentry wants.
      production: {
        plugins: [['transform-remove-console', { exclude: ['error'] }]],
      },
    },
  };
};
