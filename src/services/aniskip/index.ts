import type {
  AniSkipResponse,
  AniSkipResult,
  AniSkipType,
  AniSkipInterval,
  AniSkipMode,
} from '@/types';

export const ANISKIP_API_BASE = 'https://api.aniskip.com/v2';

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

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
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
    }
  },
};

export const aniSkipModeSteps: {
  mode: AniSkipMode;
  title: string;
  subLabel: string;
}[] = [
  { mode: 'manual', title: 'MANUALE', subLabel: 'TASTO OK' },
  { mode: 'auto', title: 'AUTOMATICO', subLabel: 'AUTO' },
  { mode: 'disabled', title: 'DISATTIVATO', subLabel: 'OFF' },
];

export type {
  AniSkipResponse,
  AniSkipResult,
  AniSkipType,
  AniSkipInterval,
};

