export interface SystemVolumeInfo {
  volume: number;
  currentStep: number;
  maxSteps: number;
}

export interface BatteryOptimizationStatus {
  isSupported: boolean;
  isIgnoringBatteryOptimizations: boolean;
  isBackgroundRestricted: boolean;
  isUnrestricted: boolean;
  manufacturer: string;
  sdkInt: number;
}

export type BatteryLaunchMethod =
  | 'request_dialog'
  | 'app_details'
  | 'battery_list'
  | 'system_settings'
  | 'none';

export interface BatterySettingsLaunchResult {
  launched: boolean;
  alreadyUnrestricted: boolean;
  method: BatteryLaunchMethod;
}
