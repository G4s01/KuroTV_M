/**
 * Safe fallback mock for react-native-nitro-modules.
 * Prevents ModuleNotFoundError crashes in Expo Go or runtimes without C++ NitroModules.
 */

export const NitroModules = {
  createHybridObject: () => ({}),
  hasHybridObject: () => false,
  getHybridObject: () => null,
  registerHybridObject: () => {},
};

export class ModuleNotFoundError extends Error {
  constructor(name: string | Error) {
    const msg = typeof name === 'string' ? name : name?.message || 'Nitro module not found';
    super(`Nitro module "${msg}" is not available in this environment`);
    this.name = 'ModuleNotFoundError';
  }
}

export const isRuntimeAlive = () => true;
export const getInstalledNitro = () => null;
export const getNitroModules = () => NitroModules;
export const assertNitroVersion = () => {};
export const warnIfNitroVersionMismatch = () => {};
export const installWorkletsSupport = () => {};

export class HybridObject {}
export class AnyHybridObject {}
export class BoxedHybridObject {}

export const HybridView = () => null;
export const getHostComponent = () => null;
export const getHybridObjectConstructor = () => null;

export default {
  NitroModules,
  ModuleNotFoundError,
  isRuntimeAlive,
  getInstalledNitro,
  getNitroModules,
  assertNitroVersion,
  warnIfNitroVersionMismatch,
  installWorkletsSupport,
  HybridObject,
  AnyHybridObject,
  BoxedHybridObject,
  HybridView,
  getHostComponent,
  getHybridObjectConstructor,
};
