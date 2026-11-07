export const Platform = {
  OS: 'android',
  select: (obj) => obj.android || obj.default,
  constants: {
    supportedAbis: ['arm64-v8a', 'armeabi-v7a'],
  },
};

export const NativeModules = {};
export const StyleSheet = {
  create: (styles) => styles,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};
export const Dimensions = {
  get: () => ({ width: 400, height: 800 }),
};
export default { Platform, NativeModules, StyleSheet, Dimensions };
