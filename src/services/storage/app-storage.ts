import { MMKV } from 'react-native-mmkv';
import type { AnimeItem } from '@/types/anime';
import type { AnimeHomePage, SchedulePageData } from '@/types/scraper';
import type { AniSkipSettings, AniSkipMode } from '@/types/aniskip';
import { DEFAULT_ANISKIP_SETTINGS } from '@/types/aniskip';
import { scraperConfig } from '../scraper/config';

export type { AniSkipSettings, AniSkipMode };
export { DEFAULT_ANISKIP_SETTINGS };

export type NavBarMode = 'auto-hide' | 'visible';


export interface StorageAdapter {
  getString(key: string): string | undefined;
  set(key: string, value: string | number | boolean): void;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  remove(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
  contains(key: string): boolean;
}

class InMemoryStorage implements StorageAdapter {
  private map = new Map<string, string | number | boolean>();

  getString(key: string): string | undefined {
    const val = this.map.get(key);
    return typeof val === 'string' ? val : undefined;
  }
  set(key: string, value: string | number | boolean): void {
    this.map.set(key, value);
  }
  getNumber(key: string): number | undefined {
    const val = this.map.get(key);
    return typeof val === 'number' ? val : undefined;
  }
  getBoolean(key: string): boolean | undefined {
    const val = this.map.get(key);
    return typeof val === 'boolean' ? val : undefined;
  }
  remove(key: string): void {
    this.map.delete(key);
  }
  clearAll(): void {
    this.map.clear();
  }
  getAllKeys(): string[] {
    return Array.from(this.map.keys());
  }
  contains(key: string): boolean {
    return this.map.has(key);
  }
}

class MMKVStorageAdapter implements StorageAdapter {
  private mmkv: MMKV;

  constructor(mmkv: MMKV) {
    this.mmkv = mmkv;
  }

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }
  set(key: string, value: string | number | boolean): void {
    this.mmkv.set(key, value);
  }
  getNumber(key: string): number | undefined {
    return this.mmkv.getNumber(key);
  }
  getBoolean(key: string): boolean | undefined {
    return this.mmkv.getBoolean(key);
  }
  remove(key: string): void {
    this.mmkv.delete(key);
  }
  clearAll(): void {
    this.mmkv.clearAll();
  }
  getAllKeys(): string[] {
    return this.mmkv.getAllKeys();
  }
  contains(key: string): boolean {
    return this.mmkv.contains(key);
  }
}

function initStorage(): StorageAdapter {
  try {
    const instance = new MMKV({ id: 'kurotv-storage' });
    return new MMKVStorageAdapter(instance);
  } catch {
    // Non-native or testing fallback
    return new InMemoryStorage();
  }
}

export const storage = initStorage();

export const StorageKeys = {
  THEME_MODE: 'settings.themeMode',
  APP_SETTINGS: 'settings.appSettings',
  CUSTOM_THEME_COLORS: 'settings.customColors',
  CUSTOM_COLORS_OLED: 'settings.customColors.oled',
  CUSTOM_COLORS_LIGHT: 'settings.customColors.light',
  CUSTOM_COLORS_CUSTOM: 'settings.customColors.custom',
  FAVORITES: 'user.favorites',
  WATCH_HISTORY: 'user.history',
  WATCH_PROGRESS_PREFIX: 'user.progress.',
  CONTINUE_WATCHING: 'user.continueWatching',
  ANILIST_TOKEN: 'auth.anilistToken',
  AUTOPLAY_NEXT: 'player.autoplayNext',
  DEFAULT_SERVER: 'player.defaultServer',
  UPDATE_MANIFEST_URL: 'settings.updateManifestUrl',
  THEME_FAMILY: 'settings.themeFamily',
  PIKACHU_MODE: 'settings.pikachuMode',
  ORCHID_MODE: 'settings.orchidMode',
  RAINBOW_MODE: 'settings.rainbowMode',
  CUSTOM_DOMAIN: 'settings.customDomain',
  HOME_DATA: 'cache.homeData',
  SCHEDULE_DATA: 'cache.scheduleData',
  ANISKIP_SETTINGS: 'settings.aniSkipSettings',
  SEARCH_HISTORY: 'user.searchHistory',
  SYNC_SERVER_URL: 'sync.server_url',
  SYNC_DEVICE_TOKEN: 'sync.device_token',
  SYNC_DEVICE_ID: 'sync.device_id',
  SYNC_PROFILE_ID: 'sync.profile_id',
  SYNC_PROFILE_NAME: 'sync.profile_name',
  SYNC_LAST_TIMESTAMP: 'sync.last_timestamp',
  SYNC_LAST_TIME: 'sync.last_sync_time',
  SYNC_PENDING_MUTATIONS: 'sync.pending_mutations',
  SYNC_PENDING_DELETIONS: 'sync.pending_deletions',
  SYNC_IS_ENABLED: 'sync.is_enabled',
  SYNC_MASTER_PASSWORD: 'sync.master_password',
} as const;

export type ThemeMode = 'oled' | 'light' | 'custom';
export type ThemeFamily = 'default' | 'pikachu' | 'orchid' | 'rainbow' | 'custom';
export type PikachuMode = 'dark' | 'light';
export type OrchidMode = 'dark' | 'light';
export type RainbowMode = 'dark' | 'light';
export type EndingThreshold = 90 | 60 | 30 | 0;
export type PreferredQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
export type HistoryRetentionDays = -1 | 0 | 30 | 60 | 90 | 180;
export type SearchMode = 'auto' | 'manual';

export interface AppSettings {
  themeMode: ThemeMode;
  themeFamily?: ThemeFamily;
  pikachuMode?: PikachuMode;
  orchidMode?: OrchidMode;
  rainbowMode?: RainbowMode;
  customColors?: Record<string, string>;
  endingThresholdSeconds: EndingThreshold;
  preferredQuality: PreferredQuality;
  tld: string;
  customDomain?: string;
  autoplayNext: boolean;
  defaultServer: string;
  historyRetentionDays: HistoryRetentionDays;
  searchHistoryRetentionDays?: HistoryRetentionDays;
  searchMode: SearchMode;
  searchDebounceMs: number;
  searchMinChars: number;
  aniSkipSettings?: AniSkipSettings;
  navBarMode?: NavBarMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'oled',
  themeFamily: 'default',
  pikachuMode: 'dark',
  orchidMode: 'dark',
  rainbowMode: 'dark',
  endingThresholdSeconds: 90,
  preferredQuality: 'auto',
  tld: 'so',
  autoplayNext: true,
  defaultServer: '9',
  historyRetentionDays: 90,
  searchHistoryRetentionDays: 90,
  searchMode: 'auto',
  searchDebounceMs: 800,
  searchMinChars: 3,
  aniSkipSettings: DEFAULT_ANISKIP_SETTINGS,
  navBarMode: 'visible',
};

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export interface WatchProgressItem {
  animeId: string;
  animeTitle: string;
  thumbnail: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number | string;
  currentTime: number;
  duration: number;
  percentage: number;
  isCompleted: boolean;
  updatedAt: number;
  dataId?: string;
  serverId?: string;
}

export interface WatchHistoryItem {
  animeId: string;
  title: string;
  thumbnail: string;
  episodeId: string;
  episodeNumber: number;
  position: number;
  duration: number;
  progressPercent: number;
  updatedAt: number;
  isCompleted?: boolean;
  dataId?: string;
  serverId?: string;
}

export interface ContinueWatchingItem {
  animeId: string;
  title: string;
  thumbnail: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number | string;
  position: number;
  duration: number;
  percentage: number;
  updatedAt: number;
  dataId?: string;
  serverId?: string;
  isCaughtUp?: boolean;
  lastCheckedAt?: number;
}

export interface SaveProgressPayload {
  animeId: string;
  animeTitle?: string;
  title?: string;
  thumbnail?: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number | string;
  currentTime?: number;
  position?: number;
  duration: number;
  dataId?: string;
  serverId?: string;
  nextEpisode?: {
    id: string;
    number: number;
    dataId?: string;
  };
  isOngoing?: boolean;
}

export interface WatchHistoryDeleteTarget {
  animeId: string;
  episodeId?: string;
  episodeNumber?: number;
}

function matchesHistoryTarget(
  item: { animeId: string; episodeId?: string; episodeNumber?: number },
  target: WatchHistoryDeleteTarget
): boolean {
  if (!target.animeId || item.animeId !== target.animeId) return false;
  if (target.episodeId && item.episodeId === target.episodeId) return true;
  if (target.episodeNumber !== undefined && item.episodeNumber === target.episodeNumber) return true;
  if (!target.episodeId && target.episodeNumber === undefined) return true;
  return false;
}

function removeWatchHistoryTargets(targets: WatchHistoryDeleteTarget[]): {
  removedCount: number;
  modified: boolean;
} {
  const validTargets = targets.filter((t) => Boolean(t?.animeId));
  if (validTargets.length === 0) return { removedCount: 0, modified: false };

  let modified = false;
  let removedCount = 0;

  // 1. Remove matching entries from watch history in a single pass
  const rawHistory = AppStorage.getObject<WatchHistoryItem[]>(StorageKeys.WATCH_HISTORY);
  if (Array.isArray(rawHistory)) {
    const filtered = rawHistory.filter((item) => {
      const isTarget = validTargets.some((target) => matchesHistoryTarget(item, target));
      if (isTarget) {
        AppStorage.recordSyncDeletion('watch_history', `${item.animeId}:${item.episodeNumber}`);
        AppStorage.recordSyncDeletion('watch_progress', `${item.animeId}:${item.episodeNumber}`);
      }
      return !isTarget;
    });
    removedCount = rawHistory.length - filtered.length;
    if (removedCount > 0) {
      modified = true;
      AppStorage.setObject(StorageKeys.WATCH_HISTORY, filtered);
    }
  }

  // 2. Remove episode progress key(s)
  const wildcardAnimeIds = new Set<string>();
  for (const target of validTargets) {
    if (target.episodeNumber !== undefined) {
      AppStorage.recordSyncDeletion('watch_progress', `${target.animeId}:${target.episodeNumber}`);
      AppStorage.recordSyncDeletion('watch_history', `${target.animeId}:${target.episodeNumber}`);
      const progressKey = `${StorageKeys.WATCH_PROGRESS_PREFIX}${target.animeId}.${target.episodeNumber}`;
      if (storage.contains(progressKey)) {
        storage.remove(progressKey);
        modified = true;
      }
    } else if (!target.episodeId) {
      wildcardAnimeIds.add(target.animeId);
    }
  }

  if (wildcardAnimeIds.size > 0) {
    const allKeys = storage.getAllKeys();
    const wildcardDeletions: Array<{ type: string; key: string }> = [];
    for (const k of allKeys) {
      if (!k.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX)) continue;
      for (const animeId of wildcardAnimeIds) {
        const prefix = `${StorageKeys.WATCH_PROGRESS_PREFIX}${animeId}.`;
        if (k.startsWith(prefix)) {
          const epNumStr = k.slice(prefix.length);
          if (epNumStr) {
            wildcardDeletions.push({
              type: 'watch_progress',
              key: `${animeId}:${epNumStr}`,
            });
            wildcardDeletions.push({
              type: 'watch_history',
              key: `${animeId}:${epNumStr}`,
            });
          }
          storage.remove(k);
          modified = true;
          break;
        }
      }
    }
    if (wildcardDeletions.length > 0) {
      AppStorage.recordSyncDeletions(wildcardDeletions);
    }
  }

  // 3. Update or remove affected continue watching entries
  const continueList = AppStorage.getContinueWatching();
  if (continueList.length > 0) {
    let continueModified = false;
    let remainingHistoryCache: WatchHistoryItem[] | null = null;
    const updatedContinue: ContinueWatchingItem[] = [];

    for (const entry of continueList) {
      const isAffected = validTargets.some((target) => matchesHistoryTarget(entry, target));
      if (!isAffected) {
        updatedContinue.push(entry);
        continue;
      }

      continueModified = true;
      if (remainingHistoryCache === null) {
        remainingHistoryCache = AppStorage.getWatchHistory();
      }
      const latest = remainingHistoryCache.find((h) => h.animeId === entry.animeId);
      if (latest) {
        updatedContinue.push({
          ...entry,
          episodeId: latest.episodeId,
          episodeNumber: latest.episodeNumber,
          position: latest.position,
          duration: latest.duration,
          percentage: latest.progressPercent,
          updatedAt: latest.updatedAt,
          dataId: latest.dataId,
          serverId: latest.serverId,
          isCaughtUp: false,
        });
      } else {
        AppStorage.recordSyncDeletion('continue_watching', entry.animeId);
      }
    }

    if (continueModified) {
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, updatedContinue);
      modified = true;
    }
  }

  if (modified) {
    notifySettingsListeners(AppStorage.getSettings());
  }

  return { removedCount, modified };
}

export type SettingsListener = (settings: AppSettings) => void;
const settingsListeners = new Set<SettingsListener>();

function notifySettingsListeners(settings: AppSettings): void {
  for (const listener of settingsListeners) {
    try {
      listener(settings);
    } catch {
      // Ignore listener errors safely
    }
  }
}

export type StorageMutationListener = (type: string, key?: string) => void;
const mutationListeners = new Set<StorageMutationListener>();

function notifyMutationListeners(type: string, key?: string): void {
  for (const listener of mutationListeners) {
    try {
      listener(type, key);
    } catch {
      // Ignore listener errors safely
    }
  }
}

export const AppStorage = {
  addSettingsListener: (listener: SettingsListener): (() => void) => {
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  },

  addMutationListener: (listener: StorageMutationListener): (() => void) => {
    mutationListeners.add(listener);
    return () => {
      mutationListeners.delete(listener);
    };
  },

  isHistoryEnabled: (): boolean => {
    return AppStorage.getHistoryRetentionDays() !== -1;
  },

  getString: (key: string): string | undefined => {
    return storage.getString(key);
  },

  setString: (key: string, value: string): void => {
    storage.set(key, value);
  },

  getNumber: (key: string): number | undefined => {
    return storage.getNumber(key);
  },

  setNumber: (key: string, value: number): void => {
    storage.set(key, value);
  },

  getBoolean: (key: string, defaultValue = false): boolean => {
    return storage.getBoolean(key) ?? defaultValue;
  },

  setBoolean: (key: string, value: boolean): void => {
    storage.set(key, value);
  },

  getObject: <T>(key: string): T | null => {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setObject: <T>(key: string, value: T): void => {
    try {
      storage.set(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[AppStorage] Failed to serialize object for key "${key}":`, err);
    }
  },

  remove: (key: string): void => {
    storage.remove(key);
  },

  clearAll: (): void => {
    storage.clearAll();
  },

  // ----------------------------------------------------
  // Settings
  // ----------------------------------------------------
  getSettings: (): AppSettings => {
    const saved = AppStorage.getObject<Partial<AppSettings>>(StorageKeys.APP_SETTINGS);
    const themeMode =
      (AppStorage.getString(StorageKeys.THEME_MODE) as ThemeMode | undefined) ||
      saved?.themeMode ||
      DEFAULT_SETTINGS.themeMode;
    const customColors = AppStorage.getCustomColors();
    const aniSkipSettings = AppStorage.getAniSkipSettings();

    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      themeMode,
      aniSkipSettings,
      ...(Object.keys(customColors).length > 0 ? { customColors } : {}),
    };
  },

  saveSettings: (partial: Partial<AppSettings>, isRemoteSync = false): AppSettings => {
    const current = AppStorage.getSettings();
    const updated: AppSettings = {
      ...current,
      ...partial,
    };
    AppStorage.setObject(StorageKeys.APP_SETTINGS, updated);

    if (partial.themeMode) {
      AppStorage.setString(StorageKeys.THEME_MODE, partial.themeMode);
    }
    if (partial.customColors) {
      AppStorage.setObject(StorageKeys.CUSTOM_THEME_COLORS, partial.customColors);
    }
    if (partial.tld) {
      AppStorage.setTld(partial.tld);
    }
    if (partial.historyRetentionDays !== undefined) {
      AppStorage.cleanupExpiredHistory(partial.historyRetentionDays);
    }
    if (partial.searchHistoryRetentionDays !== undefined) {
      AppStorage.cleanupExpiredSearchHistory(partial.searchHistoryRetentionDays);
    }
    if (partial.aniSkipSettings) {
      AppStorage.saveAniSkipSettings(partial.aniSkipSettings, isRemoteSync);
    }

    if (!isRemoteSync) {
      const sharedKeys = [
        'endingThresholdSeconds',
        'preferredQuality',
        'autoplayNext',
        'defaultServer',
        'tld',
        'customDomain',
        'historyRetentionDays',
        'searchHistoryRetentionDays',
      ] as const;

      const sharedMutation: Record<string, any> = {};
      let hasShared = false;
      for (const k of sharedKeys) {
        if (partial[k] !== undefined) {
          sharedMutation[k] = partial[k];
          hasShared = true;
        }
      }
      if (hasShared) {
        AppStorage.recordSyncMutation('sharedSettings', sharedMutation);
      }
    }

    notifySettingsListeners(updated);
    return updated;
  },

  getCustomColors: (themeMode: 'oled' | 'light' | 'custom' = 'oled'): Record<string, string> => {
    if (themeMode === 'custom') {
      return AppStorage.getObject<Record<string, string>>(StorageKeys.CUSTOM_COLORS_CUSTOM) || {};
    }
    const key = themeMode === 'light' ? StorageKeys.CUSTOM_COLORS_LIGHT : StorageKeys.CUSTOM_COLORS_OLED;
    const direct = AppStorage.getObject<Record<string, string>>(key);
    if (direct && Object.keys(direct).length > 0) return direct;
    if (themeMode === 'oled') {
      return AppStorage.getObject<Record<string, string>>(StorageKeys.CUSTOM_THEME_COLORS) || {};
    }
    return {};
  },

  setCustomColor: (
    themeModeOrColorKey: 'oled' | 'light' | 'custom' | string,
    colorKeyOrHex: string,
    maybeHex?: string,
  ): Record<string, string> => {
    let mode: 'oled' | 'light' | 'custom' = 'oled';
    let key: string;
    let hex: string;

    if (maybeHex !== undefined) {
      mode = (themeModeOrColorKey as 'oled' | 'light' | 'custom') || 'oled';
      key = colorKeyOrHex;
      hex = maybeHex;
    } else {
      key = themeModeOrColorKey;
      hex = colorKeyOrHex;
    }

    const current = AppStorage.getCustomColors(mode);
    const updated = { ...current, [key]: hex };
    const storageKey =
      mode === 'custom'
        ? StorageKeys.CUSTOM_COLORS_CUSTOM
        : mode === 'light'
          ? StorageKeys.CUSTOM_COLORS_LIGHT
          : StorageKeys.CUSTOM_COLORS_OLED;
    AppStorage.setObject(storageKey, updated);
    if (mode === 'oled') {
      AppStorage.setObject(StorageKeys.CUSTOM_THEME_COLORS, updated);
    }
    return updated;
  },

  setCustomColors: (
    themeModeOrColors: 'oled' | 'light' | 'custom' | Record<string, string>,
    maybeColors?: Record<string, string>,
  ): Record<string, string> => {
    let mode: 'oled' | 'light' | 'custom' = 'oled';
    let colors: Record<string, string>;

    if (typeof themeModeOrColors === 'string') {
      mode = themeModeOrColors;
      colors = maybeColors || {};
    } else {
      colors = themeModeOrColors;
    }

    const current = AppStorage.getCustomColors(mode);
    const updated = { ...current, ...colors };
    const storageKey =
      mode === 'custom'
        ? StorageKeys.CUSTOM_COLORS_CUSTOM
        : mode === 'light'
          ? StorageKeys.CUSTOM_COLORS_LIGHT
          : StorageKeys.CUSTOM_COLORS_OLED;
    AppStorage.setObject(storageKey, updated);
    if (mode === 'oled') {
      AppStorage.setObject(StorageKeys.CUSTOM_THEME_COLORS, updated);
    }
    return updated;
  },

  resetCustomColors: (themeMode: 'oled' | 'light' | 'custom' = 'oled'): void => {
    const storageKey =
      themeMode === 'custom'
        ? StorageKeys.CUSTOM_COLORS_CUSTOM
        : themeMode === 'light'
          ? StorageKeys.CUSTOM_COLORS_LIGHT
          : StorageKeys.CUSTOM_COLORS_OLED;
    AppStorage.remove(storageKey);
    if (themeMode === 'oled') {
      AppStorage.remove(StorageKeys.CUSTOM_THEME_COLORS);
      const saved = AppStorage.getObject<Partial<AppSettings>>(StorageKeys.APP_SETTINGS);
      if (saved?.customColors) {
        delete saved.customColors;
        AppStorage.setObject(StorageKeys.APP_SETTINGS, saved);
      }
    }
  },

  getHistoryRetentionDays: (): HistoryRetentionDays => {
    return AppStorage.getSettings().historyRetentionDays ?? 90;
  },

  setHistoryRetentionDays: (days: HistoryRetentionDays): void => {
    AppStorage.saveSettings({ historyRetentionDays: days });
    AppStorage.cleanupExpiredHistory(days);
  },

  getEndingThreshold: (): EndingThreshold => {
    return AppStorage.getSettings().endingThresholdSeconds;
  },

  setEndingThreshold: (threshold: EndingThreshold): void => {
    AppStorage.saveSettings({ endingThresholdSeconds: threshold });
  },

  getPreferredQuality: (): PreferredQuality => {
    return AppStorage.getSettings().preferredQuality;
  },

  setPreferredQuality: (quality: PreferredQuality): void => {
    AppStorage.saveSettings({ preferredQuality: quality });
  },

  getTld: (): string => {
    const settings = AppStorage.getSettings();
    return settings.tld || scraperConfig.getTld();
  },

  setTld: (newTld: string): void => {
    const cleanTld = newTld.replace(/^\.+/, '').trim().toLowerCase();
    if (cleanTld) {
      scraperConfig.setTld(cleanTld);
      const settings = AppStorage.getSettings();
      const updated = {
        ...settings,
        tld: cleanTld,
      };
      delete updated.customDomain;
      AppStorage.setObject(StorageKeys.APP_SETTINGS, updated);
    }
  },

  getUpdateManifestUrl: (): string | undefined => {
    return AppStorage.getString(StorageKeys.UPDATE_MANIFEST_URL);
  },

  setUpdateManifestUrl: (url: string): void => {
    AppStorage.setString(StorageKeys.UPDATE_MANIFEST_URL, url.trim());
  },

  getCustomDomain: (): string | undefined => {
    return AppStorage.getSettings().customDomain;
  },

  setCustomDomain: (domainOrUrl: string): void => {
    const trimmed = domainOrUrl.trim().replace(/\/+$/, '');
    if (trimmed) {
      const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      scraperConfig.setBaseUrl(fullUrl);
      const detectedTld = scraperConfig.getTld();
      const settings = AppStorage.getSettings();
      AppStorage.setObject(StorageKeys.APP_SETTINGS, {
        ...settings,
        customDomain: fullUrl,
        tld: detectedTld || 'so',
      });
    }
  },

  removeCustomDomain: (): void => {
    const settings = AppStorage.getSettings();
    const updated = { ...settings };
    delete updated.customDomain;
    const fallbackTld = updated.tld && updated.tld !== settings.customDomain ? updated.tld : 'so';
    updated.tld = fallbackTld;
    scraperConfig.setTld(fallbackTld);
    AppStorage.setObject(StorageKeys.APP_SETTINGS, updated);
  },

  getThemeFamily: (): ThemeFamily => {
    return AppStorage.getSettings().themeFamily || 'default';
  },

  setThemeFamily: (family: ThemeFamily): void => {
    AppStorage.saveSettings({ themeFamily: family });
  },

  getThemeMode: (): ThemeMode => {
    return AppStorage.getSettings().themeMode || 'oled';
  },

  setThemeMode: (mode: ThemeMode): void => {
    AppStorage.saveSettings({ themeMode: mode });
  },

  getPikachuMode: (): PikachuMode => {
    return AppStorage.getSettings().pikachuMode || 'dark';
  },

  setPikachuMode: (mode: PikachuMode): void => {
    AppStorage.saveSettings({ pikachuMode: mode });
  },

  getOrchidMode: (): OrchidMode => {
    return AppStorage.getSettings().orchidMode || 'dark';
  },

  setOrchidMode: (mode: OrchidMode): void => {
    AppStorage.saveSettings({ orchidMode: mode });
  },

  getRainbowMode: (): RainbowMode => {
    return AppStorage.getSettings().rainbowMode || 'dark';
  },

  setRainbowMode: (mode: RainbowMode): void => {
    AppStorage.saveSettings({ rainbowMode: mode });
  },

  getSearchMode: (): SearchMode => {
    return AppStorage.getSettings().searchMode ?? 'auto';
  },

  setSearchMode: (mode: SearchMode): void => {
    AppStorage.saveSettings({ searchMode: mode });
  },

  getSearchDebounceMs: (): number => {
    return AppStorage.getSettings().searchDebounceMs ?? 800;
  },

  setSearchDebounceMs: (ms: number): void => {
    AppStorage.saveSettings({ searchDebounceMs: ms });
  },

  getSearchMinChars: (): number => {
    return AppStorage.getSettings().searchMinChars ?? 3;
  },

  setSearchMinChars: (chars: number): void => {
    AppStorage.saveSettings({ searchMinChars: chars });
  },

  // ----------------------------------------------------
  // AniSkip Settings
  // ----------------------------------------------------
  getAniSkipSettings: (): AniSkipSettings => {
    const saved = AppStorage.getObject<Partial<AniSkipSettings>>(StorageKeys.ANISKIP_SETTINGS);
    return {
      ...DEFAULT_ANISKIP_SETTINGS,
      ...saved,
      buttonDuration:
        typeof saved?.buttonDuration === 'number'
          ? saved.buttonDuration
          : DEFAULT_ANISKIP_SETTINGS.buttonDuration,
    };
  },

  saveAniSkipSettings: (partial: Partial<AniSkipSettings>, isRemoteSync = false): AniSkipSettings => {
    const current = AppStorage.getAniSkipSettings();
    const updated: AniSkipSettings = {
      ...current,
      ...partial,
    };
    AppStorage.setObject(StorageKeys.ANISKIP_SETTINGS, updated);
    if (!isRemoteSync) {
      AppStorage.recordSyncMutation('sharedSettings', { aniSkipSettings: updated });
    }
    notifySettingsListeners(AppStorage.getSettings());
    return updated;
  },

  setAniSkipSettings: (partial: Partial<AniSkipSettings>): AniSkipSettings => {
    return AppStorage.saveAniSkipSettings(partial);
  },

  // ----------------------------------------------------
  // System Navigation Bar Settings
  // ----------------------------------------------------
  getNavBarMode: (): NavBarMode => {
    return AppStorage.getSettings().navBarMode ?? 'visible';
  },

  setNavBarMode: (mode: NavBarMode): void => {
    AppStorage.saveSettings({ navBarMode: mode });
  },

  // ----------------------------------------------------
  // Favorites
  // ----------------------------------------------------
  getFavorites: (): AnimeItem[] => {
    const data = AppStorage.getObject<unknown>(StorageKeys.FAVORITES);
    return Array.isArray(data) ? (data as AnimeItem[]) : [];
  },

  isFavorite: (animeId: string): boolean => {
    if (!animeId) return false;
    const favorites = AppStorage.getFavorites();
    return favorites.some((fav) => fav.id === animeId);
  },

  toggleFavorite: (item: AnimeItem): boolean => {
    if (!item?.id) return false;
    const favorites = AppStorage.getFavorites();
    const existingIndex = favorites.findIndex((fav) => fav.id === item.id);
    if (existingIndex >= 0) {
      favorites.splice(existingIndex, 1);
      AppStorage.setObject(StorageKeys.FAVORITES, favorites);
      AppStorage.recordSyncDeletion('favorite', item.id);
      notifySettingsListeners(AppStorage.getSettings());
      return false;
    } else {
      const withTimestamp: AnimeItem = {
        ...item,
        updatedAt: Date.now(),
      };
      favorites.unshift(withTimestamp);
      AppStorage.setObject(StorageKeys.FAVORITES, favorites);
      AppStorage.recordSyncMutation('favorites', withTimestamp);
      notifySettingsListeners(AppStorage.getSettings());
      return true;
    }
  },

  removeFavorite: (animeId: string): void => {
    if (!animeId) return;
    const favorites = AppStorage.getFavorites().filter((fav) => fav.id !== animeId);
    AppStorage.setObject(StorageKeys.FAVORITES, favorites);
    AppStorage.recordSyncDeletion('favorite', animeId);
    notifySettingsListeners(AppStorage.getSettings());
  },

  removeFavorites: (animeIds: string[]): number => {
    if (!Array.isArray(animeIds) || animeIds.length === 0) return 0;
    const idSet = new Set(animeIds.filter(Boolean));
    if (idSet.size === 0) return 0;
    const favorites = AppStorage.getFavorites();
    const remaining = favorites.filter((fav) => !idSet.has(fav.id));
    const removed = favorites.length - remaining.length;
    if (removed > 0) {
      AppStorage.setObject(StorageKeys.FAVORITES, remaining);
      const deletions = Array.from(idSet).map((id) => ({
        type: 'favorite',
        key: id,
      }));
      AppStorage.recordSyncDeletions(deletions);
      notifySettingsListeners(AppStorage.getSettings());
    }
    return removed;
  },

  // ----------------------------------------------------
  // Watch Progress & History & Continue Watching
  // ----------------------------------------------------
  cleanupExpiredHistory: (customRetentionDays?: number): number => {
    const retentionDays =
      customRetentionDays !== undefined
        ? customRetentionDays
        : AppStorage.getHistoryRetentionDays();

    // 0 means keep forever (no auto-deletion)
    if (retentionDays <= 0) return 0;

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    // 1. Clean watch history
    const history = AppStorage.getObject<WatchHistoryItem[]>(StorageKeys.WATCH_HISTORY);
    if (Array.isArray(history)) {
      const validHistory = history.filter((item) => {
        const itemTime = item.updatedAt || 0;
        return itemTime >= cutoffTime;
      });
      if (validHistory.length !== history.length) {
        removedCount += history.length - validHistory.length;
        AppStorage.setObject(StorageKeys.WATCH_HISTORY, validHistory);
      }
    }

    // 2. Clean continue watching
    const continueList = AppStorage.getObject<ContinueWatchingItem[]>(StorageKeys.CONTINUE_WATCHING);
    if (Array.isArray(continueList)) {
      const validContinue = continueList.filter((item) => {
        const itemTime = item.updatedAt || 0;
        return itemTime >= cutoffTime;
      });
      if (validContinue.length !== continueList.length) {
        AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, validContinue);
      }
    }

    // 3. Clean episode-level progress
    const allKeys = storage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX)) {
        const item = AppStorage.getObject<WatchProgressItem>(key);
        if (item && item.updatedAt && item.updatedAt < cutoffTime) {
          storage.remove(key);
          removedCount++;
        }
      }
    }

    return removedCount;
  },

  /**
   * Prunes old watch progress entries to prevent unbounded MMKV growth.
   * - Retains all items in active "Continue Watching"
   * - Deletes completed episodes older than retentionDays (default 60 days)
   * - If total progress keys still exceed maxItems, removes the oldest completed entries (LRU)
   */
  pruneOldProgress: (maxItems = 200, retentionDays = 60): number => {
    const continueWatching = AppStorage.getContinueWatching();
    const activeAnimeIds = new Set(continueWatching.map((c) => c.animeId));

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const allKeys = storage.getAllKeys();
    const progressKeys = allKeys.filter((k) => k.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX));

    let removedCount = 0;
    const remainingEntries: { key: string; item: WatchProgressItem }[] = [];

    for (const key of progressKeys) {
      const item = AppStorage.getObject<WatchProgressItem>(key);
      if (!item) {
        storage.remove(key);
        removedCount++;
        continue;
      }

      const isCurrentContinue = activeAnimeIds.has(item.animeId);
      // If completed and older than retention period, and not active in continue watching: remove
      if (!isCurrentContinue && item.isCompleted && (item.updatedAt || 0) < cutoffTime) {
        storage.remove(key);
        removedCount++;
        continue;
      }

      remainingEntries.push({ key, item });
    }

    // If still over maxItems, remove oldest completed entries first, then oldest non-active entries
    if (remainingEntries.length > maxItems) {
      const prunable = remainingEntries.filter((entry) => !activeAnimeIds.has(entry.item.animeId));
      prunable.sort((a, b) => {
        if (a.item.isCompleted && !b.item.isCompleted) return -1;
        if (!a.item.isCompleted && b.item.isCompleted) return 1;
        return (a.item.updatedAt || 0) - (b.item.updatedAt || 0);
      });

      const excess = remainingEntries.length - maxItems;
      const toRemove = prunable.slice(0, excess);
      for (const entry of toRemove) {
        storage.remove(entry.key);
        removedCount++;
      }
    }

    return removedCount;
  },

  getWatchHistory: (): WatchHistoryItem[] => {
    const retentionDays = AppStorage.getHistoryRetentionDays();
    if (retentionDays === -1) return [];
    const data = AppStorage.getObject<unknown>(StorageKeys.WATCH_HISTORY);
    const history = Array.isArray(data) ? (data as WatchHistoryItem[]) : [];
    if (retentionDays === 0) return history;
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return history.filter((item) => (item.updatedAt || 0) >= cutoffTime);
  },

  getContinueWatching: (): ContinueWatchingItem[] => {
    const retentionDays = AppStorage.getHistoryRetentionDays();
    if (retentionDays === -1) return [];
    const saved = AppStorage.getObject<unknown>(StorageKeys.CONTINUE_WATCHING);
    const cutoffTime = retentionDays > 0 ? Date.now() - retentionDays * 24 * 60 * 60 * 1000 : 0;
    if (Array.isArray(saved)) {
      return retentionDays > 0
        ? (saved as ContinueWatchingItem[]).filter((item) => (item.updatedAt || 0) >= cutoffTime)
        : (saved as ContinueWatchingItem[]);
    }
    return [];
  },

  removeContinueWatching: (animeId: string): void => {
    if (!animeId) return;
    const current = AppStorage.getContinueWatching().filter((c) => c.animeId !== animeId);
    AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, current);
    AppStorage.recordSyncDeletion('continue_watching', animeId);
    notifySettingsListeners(AppStorage.getSettings());
  },

  updateContinueWatchingEpisode: (
    animeId: string,
    newEpisode: { id: string; number: number; dataId?: string },
    totalEpisodes?: number | string
  ): boolean => {
    if (!animeId || !newEpisode?.number) return false;
    const rawContinue = AppStorage.getObject<ContinueWatchingItem[]>(StorageKeys.CONTINUE_WATCHING);
    if (!Array.isArray(rawContinue)) return false;

    const targetIdx = rawContinue.findIndex((c) => c.animeId === animeId);
    if (targetIdx === -1) return false;

    const item = rawContinue[targetIdx];
    if (newEpisode.number > item.episodeNumber) {
      const updatedItem: ContinueWatchingItem = {
        ...item,
        episodeId: newEpisode.id,
        episodeNumber: newEpisode.number,
        dataId: newEpisode.dataId || item.dataId,
        totalEpisodes: totalEpisodes ?? item.totalEpisodes,
        position: 0,
        duration: 0,
        percentage: 0,
        isCaughtUp: false,
        updatedAt: Date.now(),
        lastCheckedAt: Date.now(),
      };
      rawContinue.splice(targetIdx, 1);
      rawContinue.unshift(updatedItem);
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, rawContinue.slice(0, 50));
      return true;
    } else if (totalEpisodes && item.totalEpisodes !== totalEpisodes) {
      item.totalEpisodes = totalEpisodes;
      item.lastCheckedAt = Date.now();
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, rawContinue);
      return true;
    }
    return false;
  },

  markContinueWatchingChecked: (animeId: string): void => {
    if (!animeId) return;
    const rawContinue = AppStorage.getObject<ContinueWatchingItem[]>(StorageKeys.CONTINUE_WATCHING);
    if (!Array.isArray(rawContinue)) return;
    const item = rawContinue.find((c) => c.animeId === animeId);
    if (item) {
      item.lastCheckedAt = Date.now();
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, rawContinue);
    }
  },

  getWatchProgress: (animeId: string, episodeNumber: number): WatchProgressItem | undefined => {
    if (!animeId) return undefined;
    const progressKey = `${StorageKeys.WATCH_PROGRESS_PREFIX}${animeId}.${episodeNumber}`;
    const direct = AppStorage.getObject<WatchProgressItem>(progressKey);
    if (direct) {
      const retentionDays = AppStorage.getHistoryRetentionDays();
      if (retentionDays > 0) {
        const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        if ((direct.updatedAt || 0) < cutoffTime) {
          return undefined;
        }
      }
      return direct;
    }

    // Fallback to searching watch history
    const history = AppStorage.getWatchHistory();
    const match = history.find(
      (h) => h.animeId === animeId && h.episodeNumber === episodeNumber,
    );
    if (match) {
      return {
        animeId: match.animeId,
        animeTitle: match.title,
        thumbnail: match.thumbnail,
        episodeId: match.episodeId,
        episodeNumber: match.episodeNumber,
        currentTime: match.position,
        duration: match.duration,
        percentage: match.progressPercent,
        isCompleted: Boolean(match.isCompleted || match.progressPercent >= 90),
        updatedAt: match.updatedAt,
        dataId: match.dataId,
        serverId: match.serverId,
      };
    }
    return undefined;
  },

  getLatestAnimeProgress: (animeId: string): WatchProgressItem | undefined => {
    if (!animeId) return undefined;
    const continueItem = AppStorage.getContinueWatching().find((c) => c.animeId === animeId);
    if (continueItem) {
      return {
        animeId: continueItem.animeId,
        animeTitle: continueItem.title,
        thumbnail: continueItem.thumbnail,
        episodeId: continueItem.episodeId,
        episodeNumber: continueItem.episodeNumber,
        totalEpisodes: continueItem.totalEpisodes,
        currentTime: continueItem.position,
        duration: continueItem.duration,
        percentage: continueItem.percentage,
        isCompleted: continueItem.percentage >= 90,
        updatedAt: continueItem.updatedAt,
        dataId: continueItem.dataId,
        serverId: continueItem.serverId,
      };
    }
    const historyItem = AppStorage.getWatchHistory().find((h) => h.animeId === animeId);
    if (historyItem) {
      return {
        animeId: historyItem.animeId,
        animeTitle: historyItem.title,
        thumbnail: historyItem.thumbnail,
        episodeId: historyItem.episodeId,
        episodeNumber: historyItem.episodeNumber,
        currentTime: historyItem.position,
        duration: historyItem.duration,
        percentage: historyItem.progressPercent,
        isCompleted: Boolean(historyItem.isCompleted || historyItem.progressPercent >= 90),
        updatedAt: historyItem.updatedAt,
        dataId: historyItem.dataId,
        serverId: historyItem.serverId,
      };
    }
    return undefined;
  },

  saveWatchProgress: (payload: SaveProgressPayload): WatchProgressItem | null => {
    if (!payload?.animeId) return null;
    const retentionDays = AppStorage.getHistoryRetentionDays();
    if (retentionDays === -1) {
      // History is completely disabled
      return null;
    }

    const currentTime = Math.max(0, payload.currentTime ?? payload.position ?? 0);
    const duration = Math.max(0, payload.duration || 0);
    const percentage = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const existing = AppStorage.getWatchProgress(payload.animeId, payload.episodeNumber);
    const endingThreshold = AppStorage.getEndingThreshold() || 90;
    const isCompleted = Boolean(
      existing?.isCompleted ||
      percentage >= 90 ||
      (duration > 0 && duration - currentTime <= endingThreshold && currentTime > 30)
    );
    const animeTitle = payload.animeTitle || payload.title || existing?.animeTitle || 'Anime';
    const thumbnail = payload.thumbnail || existing?.thumbnail || '';
    const updatedAt = Date.now();
    const dataId = payload.dataId || existing?.dataId;
    const serverId = payload.serverId || existing?.serverId;

    const progressItem: WatchProgressItem = {
      animeId: payload.animeId,
      animeTitle,
      thumbnail,
      episodeId: payload.episodeId || existing?.episodeId || '',
      episodeNumber: payload.episodeNumber,
      totalEpisodes: payload.totalEpisodes || existing?.totalEpisodes,
      currentTime,
      duration,
      percentage,
      isCompleted,
      updatedAt,
      dataId,
      serverId,
    };

    // 1. Save specific episode progress
    const progressKey = `${StorageKeys.WATCH_PROGRESS_PREFIX}${payload.animeId}.${payload.episodeNumber}`;
    AppStorage.setObject(progressKey, progressItem);

    // 2. Update watch history (limit 100) - read directly without scanning disk keys
    const rawHistory = AppStorage.getObject<WatchHistoryItem[]>(StorageKeys.WATCH_HISTORY);
    const history = Array.isArray(rawHistory) ? rawHistory : [];
    const filteredHistory = history.filter(
      (h) => !(h.animeId === payload.animeId && h.episodeNumber === payload.episodeNumber),
    );
    const historyItem: WatchHistoryItem = {
      animeId: payload.animeId,
      title: animeTitle,
      thumbnail,
      episodeId: payload.episodeId,
      episodeNumber: payload.episodeNumber,
      position: currentTime,
      duration,
      progressPercent: percentage,
      updatedAt,
      isCompleted,
      dataId,
      serverId,
    };
    filteredHistory.unshift(historyItem);
    AppStorage.setObject(StorageKeys.WATCH_HISTORY, filteredHistory.slice(0, 100));

    // 3. Update continue watching (deduplicated by animeId, limit 50) - read directly without scanning disk keys
    const rawContinue = AppStorage.getObject<ContinueWatchingItem[]>(StorageKeys.CONTINUE_WATCHING);
    const continueList = Array.isArray(rawContinue)
      ? rawContinue.filter((c) => c.animeId !== payload.animeId)
      : [];

    if (isCompleted) {
      if (payload.nextEpisode && payload.nextEpisode.number) {
        // Advance to next episode starting at 0%
        const nextContinueItem: ContinueWatchingItem = {
          animeId: payload.animeId,
          title: animeTitle,
          thumbnail,
          episodeId: payload.nextEpisode.id,
          episodeNumber: payload.nextEpisode.number,
          totalEpisodes: payload.totalEpisodes,
          position: 0,
          duration: 0,
          percentage: 0,
          updatedAt,
          dataId: payload.nextEpisode.dataId,
          serverId,
          isCaughtUp: false,
        };
        continueList.unshift(nextContinueItem);
      } else {
        // No next episode available in current list.
        // Check if the anime is ongoing (unknown total '?' or explicit isOngoing flag)
        const totalStr = String(payload.totalEpisodes || existing?.totalEpisodes || '').trim();
        const isOngoing = totalStr.includes('?') || Boolean(payload.isOngoing);
        if (isOngoing) {
          const caughtUpItem: ContinueWatchingItem = {
            animeId: payload.animeId,
            title: animeTitle,
            thumbnail,
            episodeId: payload.episodeId || existing?.episodeId || '',
            episodeNumber: payload.episodeNumber,
            totalEpisodes: payload.totalEpisodes || existing?.totalEpisodes,
            position: currentTime,
            duration,
            percentage: 100,
            updatedAt,
            dataId,
            serverId,
            isCaughtUp: true,
            lastCheckedAt: Date.now(),
          };
          continueList.unshift(caughtUpItem);
        }
        // If not ongoing (series concluded), keep it removed from continue watching
      }
    } else {
      const continueItem: ContinueWatchingItem = {
        animeId: payload.animeId,
        title: animeTitle,
        thumbnail,
        episodeId: payload.episodeId,
        episodeNumber: payload.episodeNumber,
        totalEpisodes: payload.totalEpisodes,
        position: currentTime,
        duration,
        percentage,
        updatedAt,
        dataId,
        serverId,
        isCaughtUp: false,
      };
      continueList.unshift(continueItem);
    }
    AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, continueList.slice(0, 50));

    AppStorage.recordSyncMutation('watchProgress', progressItem);
    AppStorage.recordSyncMutation('watchHistory', historyItem);
    if (continueList.length > 0) {
      AppStorage.recordSyncMutation('continueWatching', continueList[0]);
    }

    return progressItem;
  },

  clearWatchHistory: (): void => {
    const rawHistory = AppStorage.getObject<WatchHistoryItem[]>(StorageKeys.WATCH_HISTORY) || [];
    const continueList = AppStorage.getObject<ContinueWatchingItem[]>(StorageKeys.CONTINUE_WATCHING) || [];
    const deletions: Array<{ type: string; key: string }> = [];
    for (const item of rawHistory) {
      deletions.push({ type: 'watch_history', key: `${item.animeId}:${item.episodeNumber}` });
      deletions.push({ type: 'watch_progress', key: `${item.animeId}:${item.episodeNumber}` });
    }
    for (const c of continueList) {
      deletions.push({ type: 'continue_watching', key: c.animeId });
    }
    if (deletions.length > 0) {
      AppStorage.recordSyncDeletions(deletions);
    }
    AppStorage.remove(StorageKeys.WATCH_HISTORY);
    AppStorage.remove(StorageKeys.CONTINUE_WATCHING);
    // Remove all episode-level progress keys
    const allKeys = storage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX)) {
        storage.remove(key);
      }
    }
    notifySettingsListeners(AppStorage.getSettings());
  },

  removeWatchHistoryItem: (animeId: string, episodeId?: string, episodeNumber?: number): boolean => {
    if (!animeId) return false;
    return removeWatchHistoryTargets([{ animeId, episodeId, episodeNumber }]).modified;
  },

  removeWatchHistoryItems: (targets: WatchHistoryDeleteTarget[]): number => {
    if (!Array.isArray(targets) || targets.length === 0) return 0;
    return removeWatchHistoryTargets(targets).removedCount;
  },


  // ----------------------------------------------------
  // Search History
  // ----------------------------------------------------
  isSearchHistoryEnabled: (): boolean => {
    return AppStorage.getSearchHistoryRetentionDays() !== -1;
  },

  getSearchHistoryRetentionDays: (): HistoryRetentionDays => {
    return AppStorage.getSettings().searchHistoryRetentionDays ?? 90;
  },

  setSearchHistoryRetentionDays: (days: HistoryRetentionDays): void => {
    AppStorage.saveSettings({ searchHistoryRetentionDays: days });
    AppStorage.cleanupExpiredSearchHistory(days);
  },

  getSearchHistory: (): SearchHistoryItem[] => {
    const retentionDays = AppStorage.getSearchHistoryRetentionDays();
    if (retentionDays === -1) return [];
    const data = AppStorage.getObject<unknown>(StorageKeys.SEARCH_HISTORY);
    const history = Array.isArray(data) ? (data as SearchHistoryItem[]) : [];
    if (history.length === 0) return [];

    const cutoffTime = retentionDays > 0 ? Date.now() - retentionDays * 24 * 60 * 60 * 1000 : 0;
    const validHistory =
      retentionDays > 0 ? history.filter((item) => (item.timestamp || 0) >= cutoffTime) : history;

    // Deduplicate and filter out incomplete prefix fragments so only the most complete queries are returned
    const result: SearchHistoryItem[] = [];
    for (let i = 0; i < validHistory.length; i++) {
      const item = validHistory[i];
      const itemLower = item.query.trim().toLowerCase();
      const hasMoreComplete = validHistory.some((other, j) => {
        if (i === j) return false;
        const otherLower = other.query.trim().toLowerCase();
        return otherLower.startsWith(itemLower) && otherLower.length > itemLower.length;
      });
      if (!hasMoreComplete) {
        result.push(item);
      }
    }
    return result;
  },

  addSearchHistory: (query: string): void => {
    if (!AppStorage.isSearchHistoryEnabled()) return;
    const clean = query.trim();
    if (!clean || clean.length < 2) return;

    const cleanLower = clean.toLowerCase();
    const current = AppStorage.getSearchHistory();

    // Filter out exact matches and any incomplete prefixes of the new query
    // (e.g. if new query is "ONE PIECE", remove "ONE", "ONE P", etc.)
    const prefixDeletions: Array<{ type: string; key: string }> = [];
    const filtered = current.filter((item) => {
      const itemLower = item.query.trim().toLowerCase();
      if (itemLower === cleanLower) return false;
      if (cleanLower.startsWith(itemLower) && cleanLower.length > itemLower.length) {
        prefixDeletions.push({ type: 'search_history', key: item.query.trim() });
        return false;
      }
      return true;
    });

    if (prefixDeletions.length > 0) {
      AppStorage.recordSyncDeletions(prefixDeletions);
    }

    const newItem: SearchHistoryItem = {
      query: clean,
      timestamp: Date.now(),
    };
    filtered.unshift(newItem);

    const maxItems = 50;
    AppStorage.setObject(StorageKeys.SEARCH_HISTORY, filtered.slice(0, maxItems));
    AppStorage.recordSyncMutation('searchHistory', newItem);
    notifySettingsListeners(AppStorage.getSettings());
  },

  removeSearchHistoryItem: (query: string): void => {
    if (!query) return;
    const clean = query.trim().toLowerCase();
    const current = AppStorage.getSearchHistory();
    const filtered = current.filter(
      (item) => item.query.trim().toLowerCase() !== clean,
    );
    AppStorage.setObject(StorageKeys.SEARCH_HISTORY, filtered);
    AppStorage.recordSyncDeletion('search_history', query.trim());
    notifySettingsListeners(AppStorage.getSettings());
  },

  clearSearchHistory: (): void => {
    const current = AppStorage.getSearchHistory();
    const deletions = current.map((item) => ({
      type: 'search_history',
      key: item.query.trim(),
    }));
    if (deletions.length > 0) {
      AppStorage.recordSyncDeletions(deletions);
    }
    AppStorage.remove(StorageKeys.SEARCH_HISTORY);
    notifySettingsListeners(AppStorage.getSettings());
  },

  cleanupExpiredSearchHistory: (customRetentionDays?: number): number => {
    const retentionDays =
      customRetentionDays !== undefined
        ? customRetentionDays
        : AppStorage.getSearchHistoryRetentionDays();

    if (retentionDays === -1) {
      AppStorage.clearSearchHistory();
      return 0;
    }

    const current = AppStorage.getSearchHistory();
    const stored = AppStorage.getObject<SearchHistoryItem[]>(StorageKeys.SEARCH_HISTORY);
    const initialCount = Array.isArray(stored) ? stored.length : 0;

    AppStorage.setObject(StorageKeys.SEARCH_HISTORY, current);
    return Math.max(0, initialCount - current.length);
  },

  // ----------------------------------------------------
  // Home & Schedule Data Cache
  // ----------------------------------------------------
  getHomeData: (): AnimeHomePage | null => {
    return AppStorage.getObject<AnimeHomePage>(StorageKeys.HOME_DATA);
  },

  saveHomeData: (data: AnimeHomePage): void => {
    if (!data) return;
    AppStorage.setObject(StorageKeys.HOME_DATA, data);
  },

  getScheduleData: (): SchedulePageData | null => {
    return AppStorage.getObject<SchedulePageData>(StorageKeys.SCHEDULE_DATA);
  },

  saveScheduleData: (data: SchedulePageData): void => {
    if (!data) return;
    AppStorage.setObject(StorageKeys.SCHEDULE_DATA, data);
  },

  // ----------------------------------------------------
  // Sync Bridge & Deletion Tombstones
  // ----------------------------------------------------
  recordSyncDeletions: (
    items: Array<{ type: string; key: string; deletedAt?: number }>
  ): void => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      const now = Date.now();
      const existing =
        AppStorage.getObject<Array<{ type: string; key: string; deletedAt: number }>>(
          StorageKeys.SYNC_PENDING_DELETIONS
        ) || [];

      const map = new Map<string, { type: string; key: string; deletedAt: number }>();
      for (const d of existing) {
        map.set(`${d.type}:${d.key}`, d);
      }
      for (const item of items) {
        if (!item?.type || !item?.key) continue;
        map.set(`${item.type}:${item.key}`, {
          type: item.type,
          key: item.key,
          deletedAt: item.deletedAt || now,
        });
      }
      const updated = Array.from(map.values()).slice(-200);
      AppStorage.setObject(StorageKeys.SYNC_PENDING_DELETIONS, updated);

      // Reconcile pending mutations: remove any pending mutations for deleted items
      const pendingMutations =
        AppStorage.getObject<Record<string, any>>(StorageKeys.SYNC_PENDING_MUTATIONS);
      if (pendingMutations && typeof pendingMutations === 'object') {
        let mutModified = false;
        for (const item of items) {
          if (item.type === 'favorite' && Array.isArray(pendingMutations.favorites)) {
            const before = pendingMutations.favorites.length;
            pendingMutations.favorites = pendingMutations.favorites.filter((f: any) => f.id !== item.key);
            if (pendingMutations.favorites.length !== before) mutModified = true;
          } else if (item.type === 'continue_watching' && Array.isArray(pendingMutations.continueWatching)) {
            const before = pendingMutations.continueWatching.length;
            pendingMutations.continueWatching = pendingMutations.continueWatching.filter((c: any) => c.animeId !== item.key);
            if (pendingMutations.continueWatching.length !== before) mutModified = true;
          } else if (item.type === 'watch_history' || item.type === 'watch_progress') {
            const [animeId, epStr] = item.key.split(':');
            const epNum = epStr ? parseInt(epStr, 10) : undefined;
            const targetProp = item.type === 'watch_history' ? 'watchHistory' : 'watchProgress';
            if (Array.isArray(pendingMutations[targetProp])) {
              const before = pendingMutations[targetProp].length;
              pendingMutations[targetProp] = pendingMutations[targetProp].filter(
                (p: any) => !(p.animeId === animeId && (epNum === undefined || p.episodeNumber === epNum))
              );
              if (pendingMutations[targetProp].length !== before) mutModified = true;
            }
          } else if (item.type === 'search_history' && Array.isArray(pendingMutations.searchHistory)) {
            const before = pendingMutations.searchHistory.length;
            pendingMutations.searchHistory = pendingMutations.searchHistory.filter(
              (s: any) => (s.query || '').toLowerCase() !== item.key.toLowerCase()
            );
            if (pendingMutations.searchHistory.length !== before) mutModified = true;
          }
        }
        if (mutModified) {
          AppStorage.setObject(StorageKeys.SYNC_PENDING_MUTATIONS, pendingMutations);
        }
      }

      for (const item of items) {
        if (item?.type) notifyMutationListeners(item.type, item.key);
      }
    } catch {
      // Safe fallback
    }
  },

  recordSyncDeletion: (type: string, key: string, deletedAt = Date.now()): void => {
    if (!type || !key) return;
    AppStorage.recordSyncDeletions([{ type, key, deletedAt }]);
  },

  getPendingSyncDeletions: (): Array<{ type: string; key: string; deletedAt?: number }> => {
    const data = AppStorage.getObject<Array<{ type: string; key: string; deletedAt?: number }>>(
      StorageKeys.SYNC_PENDING_DELETIONS
    );
    return Array.isArray(data) ? data : [];
  },

  clearPendingSyncDeletions: (): void => {
    AppStorage.remove(StorageKeys.SYNC_PENDING_DELETIONS);
  },

  recordSyncMutation: (
    type:
      | 'favorites'
      | 'continueWatching'
      | 'watchHistory'
      | 'watchProgress'
      | 'searchHistory'
      | 'sharedSettings',
    item: any
  ): void => {
    if (!type || !item) return;
    try {
      // Reconcile pending deletions: remove tombstone if re-adding/updating
      const existingDeletions =
        AppStorage.getObject<Array<{ type: string; key: string; deletedAt: number }>>(
          StorageKeys.SYNC_PENDING_DELETIONS
        );
      if (Array.isArray(existingDeletions) && existingDeletions.length > 0) {
        let tombType: string | null = null;
        let tombKey: string | null = null;
        if (type === 'favorites') {
          tombType = 'favorite';
          tombKey = item.id;
        } else if (type === 'continueWatching') {
          tombType = 'continue_watching';
          tombKey = item.animeId;
        } else if (type === 'watchHistory') {
          tombType = 'watch_history';
          tombKey = `${item.animeId}:${item.episodeNumber}`;
        } else if (type === 'watchProgress') {
          tombType = 'watch_progress';
          tombKey = `${item.animeId}:${item.episodeNumber}`;
        } else if (type === 'searchHistory') {
          tombType = 'search_history';
          tombKey = item.query;
        }
        if (tombType && tombKey) {
          const filteredTombstones = existingDeletions.filter(
            (d) => !(d.type === tombType && d.key.toLowerCase() === tombKey!.toLowerCase())
          );
          if (filteredTombstones.length !== existingDeletions.length) {
            AppStorage.setObject(StorageKeys.SYNC_PENDING_DELETIONS, filteredTombstones);
          }
        }
      }

      const pending =
        AppStorage.getObject<Record<string, any>>(StorageKeys.SYNC_PENDING_MUTATIONS) || {};
      if (type === 'sharedSettings') {
        pending.sharedSettings = { ...(pending.sharedSettings || {}), ...item };
      } else {
        const list = Array.isArray(pending[type]) ? [...pending[type]] : [];
        if (type === 'favorites') {
          const idx = list.findIndex((x) => x.id === item.id);
          if (idx >= 0) list[idx] = item;
          else list.push(item);
        } else if (type === 'continueWatching') {
          const idx = list.findIndex((x) => x.animeId === item.animeId);
          if (idx >= 0) list[idx] = item;
          else list.push(item);
        } else if (type === 'watchHistory' || type === 'watchProgress') {
          const idx = list.findIndex(
            (x) => x.animeId === item.animeId && x.episodeNumber === item.episodeNumber
          );
          if (idx >= 0) list[idx] = item;
          else list.push(item);
        } else if (type === 'searchHistory') {
          const idx = list.findIndex(
            (x) => (x.query || '').toLowerCase() === (item.query || '').toLowerCase()
          );
          if (idx >= 0) list[idx] = item;
          else list.push(item);
        }
        pending[type] = list.slice(-100);
      }
      AppStorage.setObject(StorageKeys.SYNC_PENDING_MUTATIONS, pending);
      notifyMutationListeners(type);
    } catch {
      // Safe fallback
    }
  },

  notifyStorageChanged: (): void => {
    notifySettingsListeners(AppStorage.getSettings());
  },

  getPendingSyncMutations: (): Record<string, any> => {
    const data = AppStorage.getObject<Record<string, any>>(StorageKeys.SYNC_PENDING_MUTATIONS);
    return data && typeof data === 'object' ? data : {};
  },

  clearPendingSyncMutations: (): void => {
    AppStorage.remove(StorageKeys.SYNC_PENDING_MUTATIONS);
  },

  getAllWatchProgress: (): WatchProgressItem[] => {
    const allKeys = storage.getAllKeys();
    const items: WatchProgressItem[] = [];
    for (const key of allKeys) {
      if (key.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX)) {
        const item = AppStorage.getObject<WatchProgressItem>(key);
        if (item && item.animeId) {
          items.push(item);
        }
      }
    }
    return items;
  },

  clearCache: (): void => {
    const allKeys = storage.getAllKeys();
    for (const key of allKeys) {
      if (
        key.startsWith('cache.') ||
        key.startsWith('scraper.') ||
        key.startsWith('kitsu.')
      ) {
        storage.remove(key);
      }
    }
  },
};

// Sincronizza scraperConfig all'avvio dell'applicazione con i valori persistiti
try {
  const initialSettings = AppStorage.getSettings();
  if (initialSettings.customDomain) {
    scraperConfig.setBaseUrl(initialSettings.customDomain);
  } else if (initialSettings.tld) {
    scraperConfig.setTld(initialSettings.tld);
  }
} catch {
  // Ignora in ambienti headless o di test dove lo storage non è ancora configurato
}
