export type PlayerStatusLike = 'idle' | 'loading' | 'readyToPlay' | 'error' | string;

export interface PlayingChangeInput {
  playing: boolean;
  status: PlayerStatusLike;
  userWantsPlayback: boolean;
  hasEnded: boolean;
  isScrubbing: boolean;
}

export interface PlayingChangeResult {
  isPlaying: boolean;
  isBuffering: boolean;
  userWantsPlayback: boolean;
  shouldResetAdvanceTimestamp: boolean;
}

/**
 * Resolves UI & intent state on `playingChange` without mistaking external/native pauses
 * (AudioFocus loss, notification shade pause, background transition) for buffering.
 */
export function resolvePlayingChangeState(input: PlayingChangeInput): PlayingChangeResult {
  const { playing, status, userWantsPlayback, hasEnded, isScrubbing } = input;

  if (playing) {
    return {
      isPlaying: true,
      isBuffering: false,
      userWantsPlayback: true,
      shouldResetAdvanceTimestamp: true,
    };
  }

  if (isScrubbing) {
    return {
      isPlaying: false,
      isBuffering: false,
      userWantsPlayback,
      shouldResetAdvanceTimestamp: false,
    };
  }

  if (hasEnded) {
    return {
      isPlaying: false,
      isBuffering: false,
      userWantsPlayback: false,
      shouldResetAdvanceTimestamp: false,
    };
  }

  // Only treat `playing: false` as buffering if the player is genuinely loading/buffering
  // while playback is requested. Otherwise an external pause occurred -> sync to paused state.
  if (userWantsPlayback && status === 'loading') {
    return {
      isPlaying: true,
      isBuffering: true,
      userWantsPlayback: true,
      shouldResetAdvanceTimestamp: false,
    };
  }

  return {
    isPlaying: false,
    isBuffering: false,
    userWantsPlayback: false,
    shouldResetAdvanceTimestamp: false,
  };
}

export interface StatusChangeInput {
  status: PlayerStatusLike;
  hasError: boolean;
  playerPlaying: boolean;
  userWantsPlayback: boolean;
  hasEnded: boolean;
  isScrubbing: boolean;
}

export interface StatusChangeResult {
  isBuffering: boolean;
  isPlaying: boolean;
  userWantsPlayback: boolean;
}

/**
 * Resolves UI state on `statusChange`, guaranteeing `readyToPlay` clears buffering
 * even when the player is currently paused.
 */
export function resolveStatusChangeState(input: StatusChangeInput): StatusChangeResult {
  const { status, hasError, playerPlaying, userWantsPlayback, hasEnded, isScrubbing } = input;

  if (hasError || status === 'error') {
    return {
      isBuffering: false,
      isPlaying: false,
      userWantsPlayback: false,
    };
  }

  if (status === 'loading') {
    return {
      isBuffering: !isScrubbing && !hasEnded && userWantsPlayback,
      isPlaying: playerPlaying || (userWantsPlayback && !hasEnded),
      userWantsPlayback,
    };
  }

  if (status === 'readyToPlay') {
    return {
      isBuffering: false,
      isPlaying: playerPlaying,
      userWantsPlayback: playerPlaying ? true : userWantsPlayback,
    };
  }

  // 'idle' or unknown
  return {
    isBuffering: false,
    isPlaying: false,
    userWantsPlayback: hasEnded ? false : userWantsPlayback,
  };
}

export interface PlayerSnapshotInput {
  playerPlaying: boolean;
  playerStatus: PlayerStatusLike;
  userWantsPlayback: boolean;
  hasEnded: boolean;
  isScrubbing: boolean;
}

/**
 * Re-synchronizes React state against native ExoPlayer snapshot (e.g. on foreground return or PiP exit).
 */
export function syncPlayerSnapshot(input: PlayerSnapshotInput): StatusChangeResult {
  const { playerPlaying, playerStatus, userWantsPlayback, hasEnded, isScrubbing } = input;

  if (playerPlaying) {
    return {
      isBuffering: false,
      isPlaying: true,
      userWantsPlayback: true,
    };
  }

  if (hasEnded || playerStatus === 'error') {
    return {
      isBuffering: false,
      isPlaying: false,
      userWantsPlayback: false,
    };
  }

  if (!isScrubbing && userWantsPlayback && playerStatus === 'loading') {
    return {
      isBuffering: true,
      isPlaying: true,
      userWantsPlayback: true,
    };
  }

  return {
    isBuffering: false,
    isPlaying: false,
    userWantsPlayback: false,
  };
}

export type StallRecoveryAction = 'none' | 'soft_kick' | 'reload_stream';

export interface StallEvaluationInput {
  time: number;
  duration: number;
  lastAdvanceTime: number;
  lastAdvanceTimestamp: number;
  now: number;
  userWantsPlayback: boolean;
  hasEnded: boolean;
  isScrubbing: boolean;
  playerPlaying: boolean;
  playerStatus: PlayerStatusLike;
  isBuffering: boolean;
  softKickAttempted: boolean;
  reloadAttempts: number;
  maxReloadAttempts?: number;
}

export interface StallEvaluationResult {
  advanced: boolean;
  nextIsBuffering: boolean;
  stallDurationMs: number;
  showManualReload: boolean;
  recoveryAction: StallRecoveryAction;
}

export const STALL_BUFFERING_THRESHOLD_MS = 1200;
export const STALL_SOFT_KICK_THRESHOLD_MS = 5000;
export const STALL_MANUAL_RELOAD_THRESHOLD_MS = 6000;
export const STALL_AUTO_RELOAD_THRESHOLD_MS = 11000;
export const MAX_STALL_AUTO_RELOADS = 2;

/**
 * Evaluates whether playback has stalled during active playback intent and returns
 * progressive recovery actions (soft kick -> full stream reload at current position).
 */
export function evaluatePlaybackStall(input: StallEvaluationInput): StallEvaluationResult {
  const {
    time,
    duration,
    lastAdvanceTime,
    lastAdvanceTimestamp,
    now,
    userWantsPlayback,
    hasEnded,
    isScrubbing,
    playerStatus,
    isBuffering,
    softKickAttempted,
    reloadAttempts,
    maxReloadAttempts = MAX_STALL_AUTO_RELOADS,
  } = input;

  if (!userWantsPlayback || hasEnded || isScrubbing || lastAdvanceTimestamp <= 0) {
    return {
      advanced: false,
      nextIsBuffering: false,
      stallDurationMs: 0,
      showManualReload: false,
      recoveryAction: 'none',
    };
  }

  if (Math.abs(time - lastAdvanceTime) > 0.05) {
    return {
      advanced: true,
      nextIsBuffering: false,
      stallDurationMs: 0,
      showManualReload: false,
      recoveryAction: 'none',
    };
  }

  const nearEnd = duration > 0 && time >= duration - 1;
  if (nearEnd || playerStatus === 'error') {
    return {
      advanced: false,
      nextIsBuffering: isBuffering,
      stallDurationMs: 0,
      showManualReload: false,
      recoveryAction: 'none',
    };
  }

  const stallDurationMs = Math.max(0, now - lastAdvanceTimestamp);
  const nextIsBuffering = stallDurationMs >= STALL_BUFFERING_THRESHOLD_MS ? true : isBuffering;
  const showManualReload = stallDurationMs >= STALL_MANUAL_RELOAD_THRESHOLD_MS;

  let recoveryAction: StallRecoveryAction = 'none';
  if (stallDurationMs >= STALL_AUTO_RELOAD_THRESHOLD_MS && reloadAttempts < maxReloadAttempts) {
    recoveryAction = 'reload_stream';
  } else if (stallDurationMs >= STALL_SOFT_KICK_THRESHOLD_MS && !softKickAttempted) {
    recoveryAction = 'soft_kick';
  }

  return {
    advanced: false,
    nextIsBuffering,
    stallDurationMs,
    showManualReload,
    recoveryAction,
  };
}
