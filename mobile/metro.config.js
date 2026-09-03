const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// NativeWind runs Tailwind over `global.css` at bundle time and hands Metro the
// compiled style objects. Because it happens in the bundler, no Tailwind
// runtime ships in the app and class strings cost nothing at render.
module.exports = withNativeWind(config, { input: './global.css' });
