import { NativeModule, requireOptionalNativeModule } from 'expo';
import type {
  BatteryOptimizationStatus,
  BatterySettingsLaunchResult,
  SystemVolumeInfo,
} from './KuroDeviceControls.types';

export type KuroDeviceControlsEvents = {
  onBatteryOptimizationStatusChanged: (status: BatteryOptimizationStatus) => void;
};

declare class KuroDeviceControlsNativeModule extends NativeModule<KuroDeviceControlsEvents> {
  getSystemVolumeInfo(): SystemVolumeInfo;
  setSystemVolume(volume: number): SystemVolumeInfo;
  getSystemBrightness(): number;
  getWindowBrightness(): number;
  setWindowBrightness(brightness: number): void;
  restoreSystemBrightness(): void;
  getBatteryOptimizationStatus(): BatteryOptimizationStatus;
  requestIgnoreBatteryOptimizations(): BatterySettingsLaunchResult;
  openBatteryOptimizationSettings(): BatterySettingsLaunchResult;
}

export default requireOptionalNativeModule<KuroDeviceControlsNativeModule>('KuroDeviceControls');
