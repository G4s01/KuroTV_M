import { AppStorage, StorageKeys } from '../storage/app-storage';
import type {
  MalAnimeListEntry,
  MalListCache,
  MalListStatusValue,
  MalSettings,
} from './types';

export const MAL_OAUTH_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize';
export const MAL_OAUTH_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
export const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
export const MAL_REDIRECT_URI = 'kurotv://mal-callback';
export const MAL_API_CONFIG_URL = 'https://myanimelist.net/apiconfig';

export const DEFAULT_MAL_SETTINGS: MalSettings = {
  autoSyncOnComplete: false,
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

export function normalizeMalClientId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim();
}

export function isValidMalClientId(raw?: string | null): boolean {
  const clean = normalizeMalClientId(raw);
  return /^[a-zA-Z0-9]{16,128}$/.test(clean);
}

export function getStoredMalClientId(): string {
  return normalizeMalClientId(AppStorage.getString(StorageKeys.MAL_CLIENT_ID));
}

export function setStoredMalClientId(clientId: string): string {
  const clean = normalizeMalClientId(clientId);
  if (!clean) {
    AppStorage.remove(StorageKeys.MAL_CLIENT_ID);
    notifyMalDataListeners();
    return '';
  }
  AppStorage.setString(StorageKeys.MAL_CLIENT_ID, clean);
  notifyMalDataListeners();
  return clean;
}

export function getEffectiveMalClientId(): string {
  const stored = getStoredMalClientId();
  if (stored) return stored;
  const envId =
    typeof process !== 'undefined' && process.env
      ? normalizeMalClientId(process.env.EXPO_PUBLIC_MAL_CLIENT_ID)
      : '';
  return envId;
}

export function getMalSettings(): MalSettings {
  const saved = AppStorage.getObject<Partial<MalSettings>>(StorageKeys.MAL_SETTINGS);
  const audioPreference =
    saved?.audioPreference === 'sub' ||
    saved?.audioPreference === 'ita' ||
    saved?.audioPreference === 'ask'
      ? saved.audioPreference
      : DEFAULT_MAL_SETTINGS.audioPreference;

  return {
    autoSyncOnComplete: Boolean(saved?.autoSyncOnComplete),
    audioPreference,
  };
}

export function saveMalSettings(partial: Partial<MalSettings>): MalSettings {
  const current = getMalSettings();
  const next: MalSettings = {
    ...current,
    ...partial,
  };
  AppStorage.setObject(StorageKeys.MAL_SETTINGS, next);
  notifyMalSettingsListeners(next);
  notifyMalDataListeners();
  return next;
}

export function getMalIgnoredAnimeIds(): string[] {
  const raw = AppStorage.getObject<unknown>(StorageKeys.MAL_IGNORED_ANIME_IDS);
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

export function addMalIgnoredAnimeIds(animeIds: string[]): string[] {
  const current = new Set(getMalIgnoredAnimeIds());
  for (const id of animeIds) {
    if (typeof id === 'string' && id.trim()) {
      current.add(id.trim());
    }
  }
  const next = Array.from(current);
  AppStorage.setObject(StorageKeys.MAL_IGNORED_ANIME_IDS, next);
  notifyMalDataListeners();
  return next;
}

export function clearMalIgnoredAnimeIds(): void {
  AppStorage.remove(StorageKeys.MAL_IGNORED_ANIME_IDS);
  notifyMalDataListeners();
}

export function getMalLastSyncTime(): number | null {
  const val = AppStorage.getNumber(StorageKeys.MAL_LAST_SYNC_TIME);
  return typeof val === 'number' && val > 0 ? val : null;
}

export function setMalLastSyncTime(timestamp = Date.now()): void {
  AppStorage.setNumber(StorageKeys.MAL_LAST_SYNC_TIME, timestamp);
  notifyMalDataListeners();
}

export function getMalListCache(): MalListCache | null {
  const raw = AppStorage.getObject<Partial<MalListCache>>(StorageKeys.MAL_LIST_CACHE);
  if (!raw || typeof raw !== 'object') return null;
  return {
    watching: Array.isArray(raw.watching) ? raw.watching : [],
    plan_to_watch: Array.isArray(raw.plan_to_watch) ? raw.plan_to_watch : [],
    completed: Array.isArray(raw.completed) ? raw.completed : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export function saveMalListCache(cache: MalListCache): void {
  AppStorage.setObject(StorageKeys.MAL_LIST_CACHE, cache);
  notifyMalDataListeners();
}

export function saveMalStatusListToCache(
  status: MalListStatusValue,
  entries: MalAnimeListEntry[]
): MalListCache {
  const existing = getMalListCache() || {
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
  saveMalListCache(next);
  return next;
}

export function upsertEntryInMalListCache(entry: MalAnimeListEntry): void {
  const cache = getMalListCache() || {
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

  saveMalListCache(next);
}

export function removeEntryFromMalListCache(malId: number): void {
  const cache = getMalListCache();
  if (!cache) return;
  const next: MalListCache = {
    watching: cache.watching.filter((e) => e.malId !== malId),
    plan_to_watch: cache.plan_to_watch.filter((e) => e.malId !== malId),
    completed: cache.completed.filter((e) => e.malId !== malId),
    updatedAt: Date.now(),
  };
  saveMalListCache(next);
}

export function findEntryInMalListCache(malId: number): MalAnimeListEntry | null {
  const cache = getMalListCache();
  if (!cache) return null;
  for (const list of [cache.watching, cache.plan_to_watch, cache.completed]) {
    const found = list.find((e) => e.malId === malId);
    if (found) return found;
  }
  return null;
}

export function clearMalListCache(): void {
  AppStorage.remove(StorageKeys.MAL_LIST_CACHE);
  notifyMalDataListeners();
}
