export const DOUBLE_TAP_WINDOW_MS = 260;
export const CENTER_PLAY_BUTTON_SIZE = 72;
export const CENTER_PLAY_EXCLUSION_WIDTH = CENTER_PLAY_BUTTON_SIZE;

export type TapSide = 'left' | 'right';
export type TapZone = TapSide | 'center';

export interface ActiveSkipState {
  direction: TapSide;
  seconds: number;
}

export interface OverlayOpenTapRecord {
  time: number;
  side: TapSide;
}

export interface PendingLateralTapRecord {
  time: number;
  side: TapSide;
}

export type PlayerSurfaceTapAction =
  | { type: 'advance_cumulative'; side: TapSide }
  | { type: 'double_tap_seek'; side: TapSide }
  | { type: 'schedule_open_overlay'; side: TapSide; delayMs: number }
  | { type: 'open_overlay_immediate'; zone: TapZone };

export type OverlayBackgroundTapAction =
  | { type: 'double_tap_seek'; side: TapSide }
  | { type: 'close_overlay' };

/**
 * Resolves whether a horizontal coordinate falls on the left skip zone, the central
 * Play/Pause exclusion zone (matching the 72dp Play button width), or the right skip zone.
 */
export function resolveTapZone(
  x: number,
  viewportWidth: number,
  centerExclusionWidth: number = CENTER_PLAY_EXCLUSION_WIDTH
): TapZone {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(x)) {
    return 'center';
  }
  const safeWidth =
    Number.isFinite(centerExclusionWidth) && centerExclusionWidth > 0
      ? Math.min(centerExclusionWidth, viewportWidth * 0.4)
      : CENTER_PLAY_EXCLUSION_WIDTH;
  const center = viewportWidth / 2;
  const halfBand = safeWidth / 2;
  if (x < center - halfBand) {
    return 'left';
  }
  if (x <= center + halfBand) {
    return 'center';
  }
  return 'right';
}

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
 * Resolves a single tap on the hidden-controls player surface across the three horizontal
 * zones and configurable lateral tap delay:
 * - Center Play button zone (72dp centered) always opens the OSD immediately (0 ms) and never skips.
 * - Lateral bands respect `tapDelayMs`: when > 0, tap 1 schedules OSD opening so a rapid
 *   second tap triggers a clean double-tap skip with zero overlay flash; when 0 (OFF), tap 1
 *   opens OSD immediately while preserving a post-open grace window on that lateral band.
 */
export function resolvePlayerTapAction(params: {
  zone: TapZone;
  tapDelayMs: number;
  now?: number;
  accumulatedSkip: ActiveSkipState | null;
  pendingLateralTap?: PendingLateralTapRecord | null;
  lastOverlayOpenTap: OverlayOpenTapRecord | null;
  doubleTapGraceWindowMs?: number;
}): PlayerSurfaceTapAction {
  const {
    zone,
    tapDelayMs,
    now = getTapTimestampMs(),
    accumulatedSkip,
    pendingLateralTap = null,
    lastOverlayOpenTap,
    doubleTapGraceWindowMs = DOUBLE_TAP_WINDOW_MS,
  } = params;

  if (zone === 'center') {
    return { type: 'open_overlay_immediate', zone: 'center' };
  }

  if (accumulatedSkip && accumulatedSkip.direction === zone) {
    return { type: 'advance_cumulative', side: zone };
  }

  if (tapDelayMs > 0) {
    if (
      pendingLateralTap &&
      pendingLateralTap.side === zone &&
      now - pendingLateralTap.time <= tapDelayMs
    ) {
      return { type: 'double_tap_seek', side: zone };
    }
    return { type: 'schedule_open_overlay', side: zone, delayMs: tapDelayMs };
  }

  if (
    lastOverlayOpenTap &&
    lastOverlayOpenTap.side === zone &&
    now - lastOverlayOpenTap.time <= doubleTapGraceWindowMs
  ) {
    return { type: 'double_tap_seek', side: zone };
  }

  return { type: 'open_overlay_immediate', zone };
}

/**
 * Resolves a tap on the OSD overlay background: center taps always close the overlay cleanly
 * (never triggering skip), while lateral taps within the 0 ms grace window convert to skip.
 */
export function resolveOverlayBackgroundTapAction(params: {
  zone: TapZone;
  pressTime?: number;
  lastOverlayOpenTap: OverlayOpenTapRecord | null;
  windowMs?: number;
}): OverlayBackgroundTapAction {
  const {
    zone,
    pressTime = getTapTimestampMs(),
    lastOverlayOpenTap,
    windowMs = DOUBLE_TAP_WINDOW_MS,
  } = params;

  if (zone === 'center') {
    return { type: 'close_overlay' };
  }

  if (
    lastOverlayOpenTap &&
    lastOverlayOpenTap.side === zone &&
    pressTime - lastOverlayOpenTap.time <= windowMs
  ) {
    return { type: 'double_tap_seek', side: zone };
  }

  return { type: 'close_overlay' };
}
