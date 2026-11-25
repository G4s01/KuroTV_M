import { NativeModule, registerWebModule } from 'expo';
import type {
  BatteryOptimizationStatus,
  BatterySettingsLaunchResult,
  SystemVolumeInfo,
} from './KuroDeviceControls.types';
import type { KuroDeviceControlsEvents } from './KuroDeviceControlsModule';

class KuroDeviceControlsWebModule extends NativeModule<KuroDeviceControlsEvents> {
  getSystemVolumeInfo(): SystemVolumeInfo {
    return { volume: 1.0, currentStep: 15, maxSteps: 15 };
  }
  setSystemVolume(volume: number): SystemVolumeInfo {
    const clamped = Math.max(0, Math.min(1, volume));
    return {
      volume: clamped,
      currentStep: Math.round(clamped * 15),
      maxSteps: 15,
    };
  }
  getSystemBrightness(): number {
    return 0.5;
  }
  getWindowBrightness(): number {
    return -1;
  }
  setWindowBrightness(_brightness: number): void {}
  restoreSystemBrightness(): void {}
  getBatteryOptimizationStatus(): BatteryOptimizationStatus {
    return {
      isSupported: false,
      isIgnoringBatteryOptimizations: true,
      isBackgroundRestricted: false,
      isUnrestricted: true,
      manufacturer: '',
      sdkInt: 0,
    };
  }
  requestIgnoreBatteryOptimizations(): BatterySettingsLaunchResult {
    return {
      launched: false,
      alreadyUnrestricted: true,
      method: 'none',
    };
  }
  openBatteryOptimizationSettings(): BatterySettingsLaunchResult {
    return {
      launched: false,
      alreadyUnrestricted: true,
      method: 'none',
    };
  }
}

export default registerWebModule(KuroDeviceControlsWebModule, 'KuroDeviceControls');
