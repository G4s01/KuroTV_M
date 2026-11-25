import { Platform } from 'react-native';
import KuroDeviceControls from '../../../modules/kuro-device-controls';
import type {
  BatteryOptimizationStatus,
  BatterySettingsLaunchResult,
} from './types';

export interface BatteryNativeAdapter {
  getBatteryOptimizationStatus: () => BatteryOptimizationStatus;
  requestIgnoreBatteryOptimizations: () => BatterySettingsLaunchResult;
  openBatteryOptimizationSettings: () => BatterySettingsLaunchResult;
  addStatusListener?: (listener: (status: BatteryOptimizationStatus) => void) => () => void;
}

const DEFAULT_FALLBACK_STATUS: BatteryOptimizationStatus = {
  isSupported: false,
  isIgnoringBatteryOptimizations: true,
  isBackgroundRestricted: false,
  isUnrestricted: true,
  manufacturer: '',
  sdkInt: 0,
};

let testAdapter: BatteryNativeAdapter | null = null;

function normalizeStatus(raw: Partial<BatteryOptimizationStatus> | null | undefined): BatteryOptimizationStatus {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FALLBACK_STATUS };
  }
  const isIgnoring = raw.isIgnoringBatteryOptimizations ?? true;
  const isBgRestricted = raw.isBackgroundRestricted ?? false;
  return {
    isSupported: Boolean(raw.isSupported),
    isIgnoringBatteryOptimizations: Boolean(isIgnoring),
    isBackgroundRestricted: Boolean(isBgRestricted),
    isUnrestricted:
      typeof raw.isUnrestricted === 'boolean'
        ? raw.isUnrestricted
        : Boolean(isIgnoring && !isBgRestricted),
    manufacturer: typeof raw.manufacturer === 'string' ? raw.manufacturer : '',
    sdkInt: typeof raw.sdkInt === 'number' && Number.isFinite(raw.sdkInt) ? raw.sdkInt : 0,
  };
}

class BatteryServiceImpl {
  setAdapterForTest(adapter: BatteryNativeAdapter | null): void {
    testAdapter = adapter;
  }

  isNativeSupported(): boolean {
    if (testAdapter) {
      return testAdapter.getBatteryOptimizationStatus().isSupported;
    }
    if (Platform.OS !== 'android') return false;
    return typeof KuroDeviceControls?.getBatteryOptimizationStatus === 'function';
  }

  getStatus(): BatteryOptimizationStatus {
    if (testAdapter) {
      return normalizeStatus(testAdapter.getBatteryOptimizationStatus());
    }
    if (Platform.OS !== 'android') {
      return { ...DEFAULT_FALLBACK_STATUS };
    }
    try {
      if (typeof KuroDeviceControls?.getBatteryOptimizationStatus === 'function') {
        return normalizeStatus(KuroDeviceControls.getBatteryOptimizationStatus());
      }
    } catch {
      // Safe fallback when native module is unavailable
    }
    return { ...DEFAULT_FALLBACK_STATUS };
  }

  requestUnrestricted(): BatterySettingsLaunchResult {
    if (testAdapter) {
      return testAdapter.requestIgnoreBatteryOptimizations();
    }
    if (Platform.OS !== 'android') {
      return { launched: false, alreadyUnrestricted: true, method: 'none' };
    }
    try {
      if (typeof KuroDeviceControls?.requestIgnoreBatteryOptimizations === 'function') {
        return KuroDeviceControls.requestIgnoreBatteryOptimizations();
      }
    } catch {
      // Safe fallback
    }
    return { launched: false, alreadyUnrestricted: false, method: 'none' };
  }

  openSystemSettings(): BatterySettingsLaunchResult {
    if (testAdapter) {
      return testAdapter.openBatteryOptimizationSettings();
    }
    if (Platform.OS !== 'android') {
      return { launched: false, alreadyUnrestricted: true, method: 'none' };
    }
    try {
      if (typeof KuroDeviceControls?.openBatteryOptimizationSettings === 'function') {
        return KuroDeviceControls.openBatteryOptimizationSettings();
      }
    } catch {
      // Safe fallback
    }
    return { launched: false, alreadyUnrestricted: false, method: 'none' };
  }

  subscribeNativeStatusChange(
    listener: (status: BatteryOptimizationStatus) => void
  ): () => void {
    if (testAdapter?.addStatusListener) {
      return testAdapter.addStatusListener((status) => {
        listener(normalizeStatus(status));
      });
    }
    if (Platform.OS !== 'android') {
      return () => {};
    }
    try {
      const sub = KuroDeviceControls?.addListener?.(
        'onBatteryOptimizationStatusChanged',
        (raw) => {
          listener(normalizeStatus(raw));
        }
      );
      if (sub && typeof sub.remove === 'function') {
        return () => {
          try {
            sub.remove();
          } catch {
            // Safe cleanup
          }
        };
      }
    } catch {
      // Safe fallback
    }
    return () => {};
  }
}

export const BatteryService = new BatteryServiceImpl();
