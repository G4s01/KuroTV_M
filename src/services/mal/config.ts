import { AppStorage, StorageKeys } from '../storage/app-storage';
import type { MalAuthSyncRecord } from '../sync/types';
import type {
  MalAnimeListEntry,
  MalAutoSyncMode,
  MalListCache,
  MalListStatusValue,
  MalSettings,
} from './types';

export const MAL_OAUTH_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize';
export const MAL_OAUTH_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
export const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
export const MAL_REDIRECT_URI = 'kurotv://mal-callback';
export const MAL_API_CONFIG_URL = 'https://myanimelist.net/apiconfig';

export const DEFAULT_MAL_WATCHING_THRESHOLD_EPISODES = 3;
export const MIN_MAL_WATCHING_THRESHOLD_EPISODES = 1;
export const MAX_MAL_WATCHING_THRESHOLD_EPISODES = 24;

export const DEFAULT_MAL_SETTINGS: MalSettings = {
  autoSyncMode: 'off',
  autoSyncOnComplete: false,
  watchingThresholdEnabled: false,
  watchingThresholdEpisodes: DEFAULT_MAL_WATCHING_THRESHOLD_EPISODES,
  audioPreference: 'ask',
};

type MalSettingsListener = (settings: MalSettings) => void;
type MalDataListener = () => void;

const malSettingsListeners = new Set<MalSettingsListener>();
const malDataListeners = new Set<MalDataListener>();

export function addMalSettingsListener(listener: MalSettingsListener): () => void {
  malSettingsListeners.add(listener);
  return () => {
    malSettingsListeners.delete(listener);
  };
}

export function notifyMalSettingsListeners(settings: MalSettings): void {
  for (const listener of malSettingsListeners) {
    try {
      listener(settings);
    } catch {
      // Ignore listener errors safely
    }
  }
}

export function addMalDataListener(listener: MalDataListener): () => void {
  malDataListeners.add(listener);
  return () => {
    malDataListeners.delete(listener);
  };
}

export function notifyMalDataListeners(): void {
  for (const listener of malDataListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors safely
    }
  }
}

export function getActiveMalProfileScope(): string {
  return AppStorage.getActiveMalScopeId();
}

export function getMalScopedKey(baseKey: string, scopeId?: string): string {
  return AppStorage.getMalScopedStorageKey(baseKey, scopeId);
}

export function getActiveKuroSyncProfileInfo(): {
  isConnected: boolean;
  profileId: string;
  profileName?: string;
} {
  const scopeId = getActiveMalProfileScope();
  if (scopeId === 'local') {
    return { isConnected: false, profileId: 'local' };
  }
  const profileName = AppStorage.getString(StorageKeys.SYNC_PROFILE_NAME)?.trim() || undefined;
  return {
    isConnected: true,
    profileId: scopeId,
    profileName,
  };
}

export function clampMalWatchingThresholdEpisodes(raw?: number | null): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MAL_WATCHING_THRESHOLD_EPISODES;
  }
  const rounded = Math.round(raw);
  return Math.max(
    MIN_MAL_WATCHING_THRESHOLD_EPISODES,
    Math.min(MAX_MAL_WATCHING_THRESHOLD_EPISODES, rounded)
  );
}

export function normalizeMalClientId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim();
}

export function isValidMalClientId(raw?: string | null): boolean {
  const clean = normalizeMalClientId(raw);
  return /^[a-zA-Z0-9]{16,128}$/.test(clean);
}

export function getStoredMalClientId(scopeId?: string): string {
  return normalizeMalClientId(AppStorage.getString(getMalScopedKey(StorageKeys.MAL_CLIENT_ID, scopeId)));
}

export function setStoredMalClientId(clientId: string, scopeId?: string): string {
  const clean = normalizeMalClientId(clientId);
  const key = getMalScopedKey(StorageKeys.MAL_CLIENT_ID, scopeId);
  if (!clean) {
    AppStorage.remove(key);
    notifyMalDataListeners();
    return '';
  }
  AppStorage.setString(key, clean);
  notifyMalDataListeners();
  return clean;
}

export function getEffectiveMalClientId(scopeId?: string): string {
  const stored = getStoredMalClientId(scopeId);
  if (stored) return stored;
  const envId =
    typeof process !== 'undefined' && process.env
      ? normalizeMalClientId(process.env.EXPO_PUBLIC_MAL_CLIENT_ID)
      : '';
  return envId;
}

function resolveMalAutoSyncMode(saved?: Partial<MalSettings> | null): MalAutoSyncMode {
  if (
    saved?.autoSyncMode === 'off' ||
    saved?.autoSyncMode === 'episodes' ||
    saved?.autoSyncMode === 'completed_only'
  ) {
    return saved.autoSyncMode;
  }
  if (typeof saved?.autoSyncOnComplete === 'boolean') {
    return saved.autoSyncOnComplete ? 'episodes' : 'off';
  }
  return DEFAULT_MAL_SETTINGS.autoSyncMode;
}

export function getMalSettings(scopeId?: string): MalSettings {
  const saved = AppStorage.getObject<Partial<MalSettings>>(
    getMalScopedKey(StorageKeys.MAL_SETTINGS, scopeId)
  );
  const audioPreference =
    saved?.audioPreference === 'sub' ||
    saved?.audioPreference === 'ita' ||
    saved?.audioPreference === 'ask'
      ? saved.audioPreference
      : DEFAULT_MAL_SETTINGS.audioPreference;

  const autoSyncMode = resolveMalAutoSyncMode(saved);
  return {
    autoSyncMode,
    autoSyncOnComplete: autoSyncMode !== 'off',
    watchingThresholdEnabled: Boolean(saved?.watchingThresholdEnabled),
    watchingThresholdEpisodes: clampMalWatchingThresholdEpisodes(saved?.watchingThresholdEpisodes),
    audioPreference,
  };
}

export function saveMalSettings(partial: Partial<MalSettings>, scopeId?: string): MalSettings {
  const current = getMalSettings(scopeId);
  let nextMode: MalAutoSyncMode = current.autoSyncMode;
  if (
    partial.autoSyncMode === 'off' ||
    partial.autoSyncMode === 'episodes' ||
    partial.autoSyncMode === 'completed_only'
  ) {
    nextMode = partial.autoSyncMode;
  } else if (typeof partial.autoSyncOnComplete === 'boolean') {
    nextMode = partial.autoSyncOnComplete
      ? current.autoSyncMode === 'completed_only'
        ? 'completed_only'
        : 'episodes'
      : 'off';
  }

  const next: MalSettings = {
    ...current,
    ...partial,
    autoSyncMode: nextMode,
    autoSyncOnComplete: nextMode !== 'off',
    watchingThresholdEnabled:
      typeof partial.watchingThresholdEnabled === 'boolean'
        ? partial.watchingThresholdEnabled
        : current.watchingThresholdEnabled,
    watchingThresholdEpisodes: clampMalWatchingThresholdEpisodes(
      partial.watchingThresholdEpisodes ?? current.watchingThresholdEpisodes
    ),
  };
  AppStorage.setObject(getMalScopedKey(StorageKeys.MAL_SETTINGS, scopeId), next);
  notifyMalSettingsListeners(next);
  notifyMalDataListeners();
  return next;
}

export function getMalIgnoredAnimeIds(scopeId?: string): string[] {
  const raw = AppStorage.getObject<unknown>(
    getMalScopedKey(StorageKeys.MAL_IGNORED_ANIME_IDS, scopeId)
  );
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

export function addMalIgnoredAnimeIds(animeIds: string[], scopeId?: string): string[] {
  const current = new Set(getMalIgnoredAnimeIds(scopeId));
  for (const id of animeIds) {
    if (typeof id === 'string' && id.trim()) {
      current.add(id.trim());
    }
  }
  const next = Array.from(current);
  AppStorage.setObject(getMalScopedKey(StorageKeys.MAL_IGNORED_ANIME_IDS, scopeId), next);
  notifyMalDataListeners();
  return next;
}

export function clearMalIgnoredAnimeIds(scopeId?: string): void {
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_IGNORED_ANIME_IDS, scopeId));
  notifyMalDataListeners();
}

export function getMalLastSyncTime(scopeId?: string): number | null {
  const val = AppStorage.getNumber(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, scopeId));
  return typeof val === 'number' && val > 0 ? val : null;
}

export function setMalLastSyncTime(timestamp = Date.now(), scopeId?: string): void {
  AppStorage.setNumber(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, scopeId), timestamp);
  notifyMalDataListeners();
}

export function getMalListCache(scopeId?: string): MalListCache | null {
  const raw = AppStorage.getObject<Partial<MalListCache>>(
    getMalScopedKey(StorageKeys.MAL_LIST_CACHE, scopeId)
  );
  if (!raw || typeof raw !== 'object') return null;
  return {
    watching: Array.isArray(raw.watching) ? raw.watching : [],
    plan_to_watch: Array.isArray(raw.plan_to_watch) ? raw.plan_to_watch : [],
    completed: Array.isArray(raw.completed) ? raw.completed : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export function saveMalListCache(cache: MalListCache, scopeId?: string): void {
  AppStorage.setObject(getMalScopedKey(StorageKeys.MAL_LIST_CACHE, scopeId), cache);
  notifyMalDataListeners();
}

export function saveMalStatusListToCache(
  status: MalListStatusValue,
  entries: MalAnimeListEntry[],
  scopeId?: string
): MalListCache {
  const existing = getMalListCache(scopeId) || {
    watching: [],
    plan_to_watch: [],
    completed: [],
    updatedAt: 0,
  };
  const next: MalListCache = {
    ...existing,
    [status]: entries,
    updatedAt: Date.now(),
  };
  saveMalListCache(next, scopeId);
  return next;
}

export function upsertEntryInMalListCache(entry: MalAnimeListEntry, scopeId?: string): void {
  const cache = getMalListCache(scopeId) || {
    watching: [],
    plan_to_watch: [],
    completed: [],
    updatedAt: 0,
  };

  const lists: MalListStatusValue[] = ['watching', 'plan_to_watch', 'completed'];
  const next: MalListCache = {
    watching: cache.watching.filter((e) => e.malId !== entry.malId),
    plan_to_watch: cache.plan_to_watch.filter((e) => e.malId !== entry.malId),
    completed: cache.completed.filter((e) => e.malId !== entry.malId),
    updatedAt: Date.now(),
  };

  if (lists.includes(entry.status as MalListStatusValue)) {
    const targetKey = entry.status as MalListStatusValue;
    next[targetKey] = [entry, ...next[targetKey]];
  }

  saveMalListCache(next, scopeId);
}

export function removeEntryFromMalListCache(malId: number, scopeId?: string): void {
  const cache = getMalListCache(scopeId);
  if (!cache) return;
  const next: MalListCache = {
    watching: cache.watching.filter((e) => e.malId !== malId),
    plan_to_watch: cache.plan_to_watch.filter((e) => e.malId !== malId),
    completed: cache.completed.filter((e) => e.malId !== malId),
    updatedAt: Date.now(),
  };
  saveMalListCache(next, scopeId);
}

export function findEntryInMalListCache(malId: number, scopeId?: string): MalAnimeListEntry | null {
  const cache = getMalListCache(scopeId);
  if (!cache) return null;
  for (const list of [cache.watching, cache.plan_to_watch, cache.completed]) {
    const found = list.find((e) => e.malId === malId);
    if (found) return found;
  }
  return null;
}

export function clearMalListCache(scopeId?: string): void {
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LIST_CACHE, scopeId));
  notifyMalDataListeners();
}

export function getMalAuthSyncRecordForScope(scopeId: string): MalAuthSyncRecord | null {
  const cleanScope = scopeId?.trim();
  if (!cleanScope || cleanScope === 'local') return null;

  const session = AppStorage.getObject<{
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
    username?: string;
    userId?: number;
    picture?: string;
    updatedAt?: number;
  }>(getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, cleanScope));

  if (!session?.accessToken || !session?.refreshToken) {
    return null;
  }

  const clientId = getEffectiveMalClientId(cleanScope);
  if (!clientId) {
    return null;
  }

  return {
    profileId: cleanScope,
    clientId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: typeof session.expiresAt === 'number' ? session.expiresAt : 0,
    tokenType: session.tokenType || 'Bearer',
    username: session.username,
    userId: session.userId,
    picture: session.picture,
    updatedAt: typeof session.updatedAt === 'number' && session.updatedAt > 0 ? session.updatedAt : Date.now(),
  };
}

export function applyRemoteMalAuthRecordForScope(
  scopeId: string,
  record: MalAuthSyncRecord | null | undefined,
  options?: { notify?: boolean }
): boolean {
  const cleanScope = scopeId?.trim();
  if (!cleanScope || cleanScope === 'local') return false;

  const sessionKey = getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, cleanScope);
  const clientIdKey = getMalScopedKey(StorageKeys.MAL_CLIENT_ID, cleanScope);

  if (!record || !record.accessToken || !record.refreshToken) {
    const hadSession = Boolean(AppStorage.getObject(sessionKey));
    if (hadSession) {
      AppStorage.remove(sessionKey);
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, cleanScope));
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LIST_CACHE, cleanScope));
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, cleanScope));
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, cleanScope));
      if (options?.notify !== false) {
        notifyMalDataListeners();
      }
      return true;
    }
    return false;
  }

  const prevSession = AppStorage.getObject<{
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    updatedAt?: number;
  }>(sessionKey);
  const prevClientId = normalizeMalClientId(AppStorage.getString(clientIdKey));
  const nextClientId = normalizeMalClientId(record.clientId);

  const unchanged =
    prevSession?.accessToken === record.accessToken &&
    prevSession?.refreshToken === record.refreshToken &&
    prevSession?.expiresAt === record.expiresAt &&
    prevSession?.updatedAt === record.updatedAt &&
    (!nextClientId || prevClientId === nextClientId);

  if (nextClientId) {
    AppStorage.setString(clientIdKey, nextClientId);
  }
  AppStorage.setObject(sessionKey, {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: typeof record.expiresAt === 'number' ? record.expiresAt : 0,
    tokenType: record.tokenType || 'Bearer',
    username: record.username,
    userId: record.userId,
    picture: record.picture,
    updatedAt: typeof record.updatedAt === 'number' && record.updatedAt > 0 ? record.updatedAt : Date.now(),
  });

  if (options?.notify !== false && !unchanged) {
    notifyMalDataListeners();
  }
  return !unchanged;
}

export function clearSyncedMalProfileData(scopeId: string): void {
  const cleanScope = scopeId?.trim();
  if (!cleanScope || cleanScope === 'local') return;
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, cleanScope));
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, cleanScope));
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LIST_CACHE, cleanScope));
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, cleanScope));
  AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, cleanScope));
}
