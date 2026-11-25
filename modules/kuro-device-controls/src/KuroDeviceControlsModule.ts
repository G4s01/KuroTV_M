import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { SystemVolumeInfo } from './KuroDeviceControls.types';

declare class KuroDeviceControlsNativeModule extends NativeModule {
  getSystemVolumeInfo(): SystemVolumeInfo;
  setSystemVolume(volume: number): SystemVolumeInfo;
  getSystemBrightness(): number;
  getWindowBrightness(): number;
  setWindowBrightness(brightness: number): void;
  restoreSystemBrightness(): void;
}

export default requireOptionalNativeModule<KuroDeviceControlsNativeModule>('KuroDeviceControls');
