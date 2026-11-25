/**
 * Battery Optimization & Power Restriction Types
 */

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

export type BatteryVerificationState =
  | 'idle'
  | 'awaiting_return'
  | 'verified'
  | 'not_applied';
