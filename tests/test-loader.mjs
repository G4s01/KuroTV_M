import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'react-native') {
    return {
      url: new URL('./mocks/react-native.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native-mmkv') {
    return {
      url: new URL('./mocks/react-native-mmkv.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native-unistyles') {
    return {
      url: new URL('./mocks/react-native-unistyles.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith('expo-') || specifier === 'expo') {
    return {
      url: new URL('./mocks/expo.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }

  // Handle @/* alias and relative imports
  let resolvedTarget = specifier;
  if (specifier.startsWith('@/')) {
    resolvedTarget = path.join(process.cwd(), 'src', specifier.slice(2));
  } else if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const parentDir = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    resolvedTarget = path.resolve(parentDir, specifier);
  }

  if (resolvedTarget.startsWith('/')) {
    const candidates = [
      resolvedTarget,
      `${resolvedTarget}.ts`,
      `${resolvedTarget}.tsx`,
      `${resolvedTarget}.js`,
      path.join(resolvedTarget, 'index.ts'),
      path.join(resolvedTarget, 'index.tsx'),
      path.join(resolvedTarget, 'index.js'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return {
          url: pathToFileURL(cand).href,
          shortCircuit: true,
        };
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
