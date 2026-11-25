export const GESTURE_ACTIVATION_OFFSET_DP = 18;
export const BRIGHTNESS_AUTO_THRESHOLD = -0.04;
export const BRIGHTNESS_MIN_HARDWARE = 0.005;

/**
 * Computes an adaptive vertical swipe travel range from the player's available vertical space
 * (windowHeight minus safe-area insets and activation offset) so a single comfortable thumb
 * swipe can sweep 100% -> 0% (or AUTOMATICA) in both landscape phones and portrait/tablets.
 */
export function computeVerticalGestureTravelRange(
  windowHeight: number,
  topInset = 0,
  bottomInset = 0
): number {
  const safeHeight = Math.max(
    180,
    windowHeight - Math.max(0, topInset) - Math.max(0, bottomInset)
  );
  const usableSpan = Math.max(120, safeHeight * 0.50 - GESTURE_ACTIVATION_OFFSET_DP);
  return Math.max(130, Math.min(260, usableSpan));
}

export interface SystemVolumeGestureResult {
  targetVolume: number;
  stepIndex: number;
  percentage: number;
}

/**
 * Maps a swipe delta onto the device's real STREAM_MUSIC discrete step range [0..maxSteps].
 */
export function computeSystemVolumeGesture(
  startVolume: number,
  delta: number,
  maxSteps = 15
): SystemVolumeGestureResult {
  const safeMax = maxSteps > 0 ? maxSteps : 15;
  const clamped = Math.max(0, Math.min(1, startVolume + delta));
  const stepIndex = Math.max(0, Math.min(safeMax, Math.round(clamped * safeMax)));
  const quantizedVolume = stepIndex / safeMax;
  return {
    targetVolume: clamped,
    stepIndex,
    percentage: Math.round(quantizedVolume * 100),
  };
}

export interface WindowBrightnessGestureResult {
  /** -1 for AUTOMATICA (BRIGHTNESS_OVERRIDE_NONE), or [0.005 .. 1.0] for hardware window brightness */
  brightness: number;
  hudValue: number | 'AUTOMATICA';
  isAuto: boolean;
}

/**
 * Maps a swipe delta onto player-window brightness:
 * - > 0% .. 100% (0.005 .. 1.0)
 * - 0% zone (-0.04 < raw <= 0.008) -> minimum safe hardware backlight (0.005), HUD displays 0%
 * - raw <= -0.04 -> -1 (AUTOMATICA, restores system adaptive brightness inside the player)
 */
export function computeWindowBrightnessGesture(
  startBrightness: number,
  delta: number
): WindowBrightnessGestureResult {
  const raw = startBrightness + delta;
  if (raw <= BRIGHTNESS_AUTO_THRESHOLD) {
    return {
      brightness: -1,
      hudValue: 'AUTOMATICA',
      isAuto: true,
    };
  }
  if (raw <= 0.008) {
    return {
      brightness: BRIGHTNESS_MIN_HARDWARE,
      hudValue: 0,
      isAuto: false,
    };
  }
  const clamped = Math.max(BRIGHTNESS_MIN_HARDWARE, Math.min(1, raw));
  return {
    brightness: clamped,
    hudValue: Math.round(clamped * 100),
    isAuto: false,
  };
}
