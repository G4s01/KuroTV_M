import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.require = require;

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
  if (specifier === 'react-native-unistyles' || specifier.startsWith('react-native-unistyles/')) {
    return {
      url: pathToFileURL(path.resolve(process.cwd(), 'src/theme/unistyles.ts')).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native-nitro-modules' || specifier.startsWith('react-native-nitro-modules/')) {
    return {
      url: pathToFileURL(path.resolve(process.cwd(), 'src/theme/nitro-modules-mock.ts')).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native-safe-area-context') {
    return {
      url: new URL('./mocks/react-native-safe-area-context.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native-gesture-handler') {
    return {
      url: new URL('./mocks/react-native-gesture-handler.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === '@expo/vector-icons') {
    return {
      url: new URL('./mocks/expo-vector-icons.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === '@shopify/flash-list') {
    return {
      url: new URL('./mocks/flash-list.mjs', import.meta.url).href,
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

export async function load(url, context, defaultLoad) {
  if (url.endsWith('.svg') || url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.webp')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default 1;',
    };
  }

  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, 'utf-8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filePath,
    });
    return {
      format: 'module',
      shortCircuit: true,
      source: result.outputText,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
