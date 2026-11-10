export type AniSkipType = 'op' | 'ed' | 'mixed-op' | 'mixed-ed' | 'recap';

export interface AniSkipInterval {
  startTime: number;
  endTime: number;
}

export interface AniSkipResult {
  interval: AniSkipInterval;
  skipType: AniSkipType;
  skipId: string;
  episodeLength: number;
}

export interface AniSkipResponse {
  found: boolean;
  results: AniSkipResult[];
  message?: string;
  statusCode: number;
}

export type AniSkipMode = 'manual' | 'auto' | 'disabled';

export interface AniSkipSettings {
  mode: AniSkipMode;
  enableOpening: boolean;
  enableEnding: boolean;
  enableRecap: boolean;
  buttonDuration: number;
}

export const DEFAULT_ANISKIP_SETTINGS: AniSkipSettings = {
  mode: 'manual',
  enableOpening: true,
  enableEnding: true,
  enableRecap: true,
  buttonDuration: 10,
};
