// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Map cheerio to cheerio/slim to prevent Node.js 'node:stream' native dependency issues in React Native runtime
const cheerioSlimPath = require.resolve('cheerio/slim');
const unistylesSafePath = path.resolve(__dirname, 'src/theme/unistyles.ts');
const nitroMockPath = path.resolve(__dirname, 'src/theme/nitro-modules-mock.ts');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  cheerio: cheerioSlimPath,
  'react-native-unistyles': unistylesSafePath,
  'react-native-nitro-modules': nitroMockPath,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'cheerio' || moduleName.startsWith('cheerio/')) {
    return {
      filePath: cheerioSlimPath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react-native-unistyles' || moduleName.startsWith('react-native-unistyles/')) {
    return {
      filePath: unistylesSafePath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react-native-nitro-modules' || moduleName.startsWith('react-native-nitro-modules/')) {
    return {
      filePath: nitroMockPath,
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
