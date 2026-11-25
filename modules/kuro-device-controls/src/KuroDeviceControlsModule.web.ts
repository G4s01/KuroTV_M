import { NativeModule, registerWebModule } from 'expo';
import type { SystemVolumeInfo } from './KuroDeviceControls.types';

class KuroDeviceControlsWebModule extends NativeModule {
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
}

export default registerWebModule(KuroDeviceControlsWebModule, 'KuroDeviceControls');
