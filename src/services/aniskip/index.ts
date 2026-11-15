import type {
  AniSkipResponse,
  AniSkipResult,
  AniSkipType,
  AniSkipInterval,
  AniSkipMode,
  AniSkipSettings,
} from '@/types';

export const ANISKIP_API_BASE = 'https://api.aniskip.com/v2';
export const ENDING_COINCIDE_END_THRESHOLD_SECONDS = 5;

export function isEndingSkipType(skipType?: AniSkipType | string | null): boolean {
  return skipType === 'ed' || skipType === 'mixed-ed';
}

export function doesEndingCoincideWithEnd(
  skip: AniSkipResult | null | undefined,
  episodeDuration: number,
  thresholdSeconds: number = ENDING_COINCIDE_END_THRESHOLD_SECONDS,
): boolean {
  if (!skip || !isEndingSkipType(skip.skipType)) return false;
  const effectiveDuration =
    Number.isFinite(episodeDuration) && episodeDuration > 0
      ? episodeDuration
      : Number.isFinite(skip.episodeLength) && skip.episodeLength > 0
      ? skip.episodeLength
      : 0;
  if (effectiveDuration <= 0) return false;
  return effectiveDuration - skip.interval.endTime <= thresholdSeconds;
}

export interface AniSkipNextPrompt {
  promptId: string;
  startTime: number;
  endTime: number;
}

export interface AniSkipOverlayState {
  primarySkip: {
    skip: AniSkipResult;
    action: 'skip' | 'next';
  } | null;
  separateNext: AniSkipNextPrompt | null;
  autoAction: {
    skip: AniSkipResult;
    action: 'skip' | 'next';
    targetTime: number;
  } | null;
}

export interface ComputeAniSkipOverlayParams {
  currentTime: number;
  episodeDuration: number;
  skips: AniSkipResult[];
  settings: AniSkipSettings;
  hasNextEpisode: boolean;
  autoSkippedIds?: Set<string>;
}

function isSkipEnabledBySettings(res: AniSkipResult, settings: AniSkipSettings): boolean {
  if (res.skipType === 'op' || res.skipType === 'mixed-op') return settings.enableOpening;
  if (isEndingSkipType(res.skipType)) return settings.enableEnding;
  if (res.skipType === 'recap') return settings.enableRecap;
  return false;
}

function resolveEffectiveDuration(res: AniSkipResult, episodeDuration: number): number {
  if (Number.isFinite(episodeDuration) && episodeDuration > 0) return episodeDuration;
  if (Number.isFinite(res.episodeLength) && res.episodeLength > 0) return res.episodeLength;
  return 0;
}

/**
 * Computes active AniSkip button or automatic skip action for the current playback position.
 * Never shows 'SALTA' and 'PROSSIMO' simultaneously:
 * - Ending coinciding with episode end (within 5s) + next episode available -> replaces 'SALTA' with 'PROSSIMO'.
 * - Ending followed by post-ending content + next episode available -> shows 'SALTA' during the ending (manual)
 *   and a separate 'PROSSIMO' button only after the ending finishes (or right after skipping it) in both manual & auto modes.
 */
export function computeAniSkipOverlayState({
  currentTime,
  episodeDuration,
  skips,
  settings,
  hasNextEpisode,
  autoSkippedIds,
}: ComputeAniSkipOverlayParams): AniSkipOverlayState {
  if (!Array.isArray(skips) || skips.length === 0 || settings.mode === 'disabled') {
    return { primarySkip: null, separateNext: null, autoAction: null };
  }

  const configuredDuration =
    typeof settings.buttonDuration === 'number' && settings.buttonDuration > 0
      ? settings.buttonDuration
      : settings.buttonDuration === 0
      ? Infinity
      : 10;

  const matchingSkip =
    skips.find((res) => {
      if (!isSkipEnabledBySettings(res, settings)) return false;
      return currentTime >= res.interval.startTime && currentTime < res.interval.endTime;
    }) || null;

  let primarySkip: AniSkipOverlayState['primarySkip'] = null;
  let separateNext: AniSkipNextPrompt | null = null;
  let autoAction: AniSkipOverlayState['autoAction'] = null;

  if (matchingSkip) {
    const isEnding = isEndingSkipType(matchingSkip.skipType);
    const effectiveDuration = resolveEffectiveDuration(matchingSkip, episodeDuration);
    const coincidesWithEnd = isEnding && doesEndingCoincideWithEnd(matchingSkip, effectiveDuration);

    if (settings.mode === 'auto') {
      if (!autoSkippedIds?.has(matchingSkip.skipId)) {
        if (coincidesWithEnd && hasNextEpisode) {
          autoAction = {
            skip: matchingSkip,
            action: 'next',
            targetTime: effectiveDuration,
          };
        } else {
          autoAction = {
            skip: matchingSkip,
            action: 'skip',
            targetTime: matchingSkip.interval.endTime + 0.5,
          };
        }
      }
    } else {
      const maxDisplayEnd = isFinite(configuredDuration)
        ? Math.min(matchingSkip.interval.endTime, matchingSkip.interval.startTime + configuredDuration)
        : matchingSkip.interval.endTime;

      if (currentTime >= matchingSkip.interval.startTime && currentTime < maxDisplayEnd) {
        if (coincidesWithEnd && hasNextEpisode) {
          primarySkip = { skip: matchingSkip, action: 'next' };
        } else {
          primarySkip = { skip: matchingSkip, action: 'skip' };
        }
      }
    }
  }

  if (!primarySkip && settings.enableEnding && hasNextEpisode) {
    const postEndingTarget = skips.find((res) => {
      if (!isEndingSkipType(res.skipType)) return false;
      const effectiveDuration = resolveEffectiveDuration(res, episodeDuration);
      if (effectiveDuration <= 0 || doesEndingCoincideWithEnd(res, effectiveDuration)) {
        return false;
      }
      const postEndMaxDisplayEnd = isFinite(configuredDuration)
        ? Math.min(effectiveDuration, res.interval.endTime + configuredDuration)
        : effectiveDuration;
      return currentTime >= res.interval.endTime && currentTime < postEndMaxDisplayEnd;
    });

    if (postEndingTarget) {
      separateNext = {
        promptId: `${postEndingTarget.skipId}-post-next`,
        startTime: postEndingTarget.interval.endTime,
        endTime: resolveEffectiveDuration(postEndingTarget, episodeDuration),
      };
    }
  }

  return { primarySkip, separateNext, autoAction };
}

export interface GetSkipTimesParams {
  malId: number;
  episodeNumber: number;
  episodeLength?: number;
  signal?: AbortSignal;
}

export const AniSkipService = {
  getSkipTimes: async ({
    malId,
    episodeNumber,
    episodeLength = 0,
    signal,
  }: GetSkipTimesParams): Promise<AniSkipResult[]> => {
    const epNum =
      typeof episodeNumber === 'string'
        ? parseFloat(episodeNumber)
        : episodeNumber;
    const cleanMalId =
      typeof malId === 'string' ? parseInt(malId, 10) : malId;
    const cleanDuration =
      Number.isFinite(episodeLength) ? Math.max(0, episodeLength!) : 0;

    if (
      !cleanMalId ||
      cleanMalId <= 0 ||
      epNum === undefined ||
      epNum === null ||
      !Number.isFinite(epNum) ||
      epNum < 0
    ) {
      return [];
    }

    const types: AniSkipType[] = ['op', 'ed', 'mixed-op', 'mixed-ed', 'recap'];
    const typesQuery = types.map((t) => `types=${t}`).join('&');
    const url = `${ANISKIP_API_BASE}/skip-times/${cleanMalId}/${epNum}?${typesQuery}&episodeLength=${cleanDuration}`;

    let customTimer: ReturnType<typeof setTimeout> | null = null;
    let effectiveSignal = signal;
    if (!effectiveSignal) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        effectiveSignal = AbortSignal.timeout(12000);
      } else {
        const controller = new AbortController();
        customTimer = setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, 12000);
        effectiveSignal = controller.signal;
      }
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: effectiveSignal,
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`AniSkip API error: status ${response.status}`);
      }

      const data = (await response.json()) as AniSkipResponse;
      if (!data || !Array.isArray(data.results)) {
        return [];
      }

      // Filter and sanitize valid intervals
      return data.results
        .filter(
          (r) =>
            Boolean(r) &&
            Boolean(r.interval) &&
            typeof r.skipType === 'string' &&
            Number.isFinite(r.interval.startTime) &&
            Number.isFinite(r.interval.endTime) &&
            r.interval.startTime >= 0 &&
            r.interval.startTime < r.interval.endTime,
        )
        .map((r) => ({
          ...r,
          skipId:
            r.skipId ||
            `${r.skipType}-${r.interval.startTime}-${r.interval.endTime}`,
        }));
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      console.warn(
        `[AniSkipService] Failed to fetch skip times for malId=${malId}, ep=${episodeNumber}:`,
        err,
      );
      return [];
    } finally {
      if (customTimer) {
        clearTimeout(customTimer);
      }
    }
  },
};

export const aniSkipModeSteps: {
  mode: AniSkipMode;
  title: string;
  subLabel: string;
}[] = [
  { mode: 'manual', title: 'MANUALE', subLabel: 'TOUCH' },
  { mode: 'auto', title: 'AUTOMATICO', subLabel: 'AUTO' },
  { mode: 'disabled', title: 'DISATTIVATO', subLabel: 'OFF' },
];

export type {
  AniSkipResponse,
  AniSkipResult,
  AniSkipType,
  AniSkipInterval,
};

