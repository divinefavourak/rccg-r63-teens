module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // `jsxImportSource: nativewind` is what lets any component accept
      // `className` — NativeWind compiles the string to a style object at
      // build time, so there is no runtime class parser in the bundle.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // babel-preset-expo adds react-native-worklets/plugin itself when
    // Reanimated is installed, so listing it here would apply it twice.
  };
};
