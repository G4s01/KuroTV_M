export const DOUBLE_TAP_WINDOW_MS = 260;

export type TapSide = 'left' | 'right';

export interface ActiveSkipState {
  direction: TapSide;
  seconds: number;
}

export interface OverlayOpenTapRecord {
  time: number;
  side: TapSide;
}

export type PlayerSurfaceTapAction =
  | { type: 'advance_cumulative'; side: TapSide }
  | { type: 'double_tap_seek'; side: TapSide }
  | { type: 'open_overlay'; side: TapSide };

export type OverlayBackgroundTapAction =
  | { type: 'double_tap_seek'; side: TapSide }
  | { type: 'close_overlay' };

/**
 * Resolves whether a horizontal coordinate falls on the left or right half of the player.
 */
export function resolveTapSide(x: number, viewportWidth: number): TapSide {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return 'right';
  }
  return x < viewportWidth / 2 ? 'left' : 'right';
}

/**
 * Returns the current epoch timestamp in milliseconds for gesture timing windows.
 */
export function getTapTimestampMs(): number {
  return Date.now();
}

/**
 * Resolves a single tap on the hidden-controls player surface without waiting for a
 * Gesture.Exclusive double-tap timeout, allowing instant OSD + haptic response.
 */
export function resolvePlayerTapAction(params: {
  side: TapSide;
  now?: number;
  accumulatedSkip: ActiveSkipState | null;
  lastOverlayOpenTap: OverlayOpenTapRecord | null;
  windowMs?: number;
}): PlayerSurfaceTapAction {
  const {
    side,
    now = getTapTimestampMs(),
    accumulatedSkip,
    lastOverlayOpenTap,
    windowMs = DOUBLE_TAP_WINDOW_MS,
  } = params;

  if (accumulatedSkip && accumulatedSkip.direction === side) {
    return { type: 'advance_cumulative', side };
  }

  if (
    lastOverlayOpenTap &&
    lastOverlayOpenTap.side === side &&
    now - lastOverlayOpenTap.time <= windowMs
  ) {
    return { type: 'double_tap_seek', side };
  }

  return { type: 'open_overlay', side };
}

/**
 * Resolves a tap on the OSD overlay background: if it lands within the double-tap
 * window on the same side that just opened the overlay, converts it into a double-tap seek.
 */
export function resolveOverlayBackgroundTapAction(params: {
  side: TapSide;
  pressTime?: number;
  lastOverlayOpenTap: OverlayOpenTapRecord | null;
  windowMs?: number;
}): OverlayBackgroundTapAction {
  const {
    side,
    pressTime = getTapTimestampMs(),
    lastOverlayOpenTap,
    windowMs = DOUBLE_TAP_WINDOW_MS,
  } = params;

  if (
    lastOverlayOpenTap &&
    lastOverlayOpenTap.side === side &&
    pressTime - lastOverlayOpenTap.time <= windowMs
  ) {
    return { type: 'double_tap_seek', side };
  }

  return { type: 'close_overlay' };
}
