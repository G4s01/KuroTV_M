export type MalListStatusValue = 'watching' | 'plan_to_watch' | 'completed';
export type MalEditableStatus = MalListStatusValue | 'on_hold' | 'dropped';
export type MalMediaStatus = 'finished_airing' | 'currently_airing' | 'not_yet_aired' | string;
export type MalAudioPreference = 'ask' | 'sub' | 'ita';
export type MalAutoSyncMode = 'off' | 'episodes' | 'completed_only';
export type MalSortOption = 'recent' | 'title' | 'score';

export interface MalAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  username?: string;
  userId?: number;
  picture?: string;
  updatedAt?: number;
}

export interface MalOAuthPending {
  codeVerifier: string;
  state: string;
  clientId: string;
  createdAt: number;
}

export interface MalSettings {
  autoSyncMode: MalAutoSyncMode;
  autoSyncOnComplete: boolean;
  watchingThresholdEnabled: boolean;
  watchingThresholdEpisodes: number;
  audioPreference: MalAudioPreference;
}

export interface MalUserProfile {
  id: number;
  name: string;
  picture?: string;
}

export interface MalAnimeListEntry {
  malId: number;
  title: string;
  mainPicture?: {
    medium?: string;
    large?: string;
  };
  status: MalEditableStatus;
  score: number;
  watchedEpisodes: number;
  numEpisodes: number;
  mediaStatus?: MalMediaStatus;
  mediaType?: string;
  mean?: number;
  alternativeTitles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  updatedAt?: string;
}

export interface MalAnimeStatusDetails {
  malId: number;
  title: string;
  numEpisodes: number;
  mediaStatus?: MalMediaStatus;
  mediaType?: string;
  mean?: number;
  mainPicture?: {
    medium?: string;
    large?: string;
  };
  alternativeTitles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  listEntry: MalAnimeListEntry | null;
}

export interface MalListCache {
  watching: MalAnimeListEntry[];
  plan_to_watch: MalAnimeListEntry[];
  completed: MalAnimeListEntry[];
  updatedAt: number;
}

export interface MalIdMappingByAnimeId {
  animeId: string;
  malId: number;
  title: string;
  totalEpisodes?: number | null;
  isCompletedSeries?: boolean;
  isOngoingSeries?: boolean;
  audio?: 'sub' | 'ita';
  updatedAt: number;
}

export interface MalIdMappingByMalId {
  malId: number;
  primaryAnimeId: string;
  candidateAnimeIds: string[];
  title: string;
  updatedAt: number;
}

export interface MalIdMapStore {
  byAnimeId: Record<string, MalIdMappingByAnimeId>;
  byMalId: Record<number, MalIdMappingByMalId>;
}

export type MalSyncProposalReason =
  | 'promote_ptw'
  | 'advance_episodes'
  | 'complete_series'
  | 'add_to_list';

export interface MalSyncProposal {
  malId: number;
  animeId: string;
  animeIds: string[];
  title: string;
  thumbnail?: string;
  currentMalStatus: MalEditableStatus | 'not_in_list';
  currentMalEpisodes: number;
  targetStatus: MalListStatusValue;
  targetEpisodes: number;
  totalEpisodes: number | null;
  reason: MalSyncProposalReason;
  selected: boolean;
}

export interface MalUnmappedLocalSeries {
  animeId: string;
  title: string;
  thumbnail?: string;
  watchedEpisodes: number;
}

export interface MalDiffResult {
  proposals: MalSyncProposal[];
  unmapped: MalUnmappedLocalSeries[];
  alreadySyncedCount: number;
}

export interface MalPendingUpdate {
  malId: number;
  animeId: string;
  title?: string;
  status: MalListStatusValue;
  watchedEpisodes: number;
  totalEpisodes?: number | null;
  isOngoingSeries?: boolean;
  updatedAt: number;
}

export interface MalSyncApplyResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ malId: number; title: string; message: string }>;
}

export interface MalAutoSyncResult {
  status:
    | 'disabled'
    | 'not_connected'
    | 'invalid'
    | 'deduped'
    | 'skipped_completed'
    | 'skipped_completed_only'
    | 'below_watching_threshold'
    | 'skipped_already_ahead'
    | 'synced'
    | 'queued'
    | 'auth_error';
  targetStatus?: MalListStatusValue;
  targetEpisodes?: number;
}
