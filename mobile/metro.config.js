const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/*
 * Optional: drop the 964KB Material Symbols font.
 *
 * `expo-router` depends on `expo-symbols`, which statically requires
 * `@expo-google-fonts/material-symbols` so it can render Android tab icons
 * from SF Symbol names. This app uses a custom tab bar drawn with Ionicons and
 * never calls that path — but the require is static, so Metro ships the font
 * anyway. It is the single largest asset in the bundle.
 *
 * Stubbing it is safe *only while nothing renders a symbol*. If anyone later
 * adds `<SymbolView>`, `unstable_getMaterialSymbolSourceAsync`, or switches to
 * native tabs, this turns into a runtime crash with a confusing stack. Left off
 * by default for that reason: half a megabyte after APK compression is not
 * worth a hidden landmine. Uncomment deliberately.
 *
 * config.resolver.resolveRequest = (context, moduleName, platform) => {
 *   if (moduleName.startsWith('@expo-google-fonts/material-symbols')) {
 *     return { type: 'empty' };
 *   }
 *   return context.resolveRequest(context, moduleName, platform);
 * };
 */

// NativeWind runs Tailwind over `global.css` at bundle time and hands Metro the
// compiled style objects. Because it happens in the bundler, no Tailwind
// runtime ships in the app and class strings cost nothing at render.
module.exports = withNativeWind(config, { input: './global.css' });
