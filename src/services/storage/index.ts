import { MMKV } from 'react-native-mmkv';
import type {
  AnimeItem,
  EpisodeMetadata,
  AnimeHomePage,
  AniSkipSettings,
  AniSkipMode,
} from '@/types';
import { DEFAULT_ANISKIP_SETTINGS } from '@/types';
import { scraperConfig } from '../scraper/config';

export type { AniSkipSettings, AniSkipMode };
export { DEFAULT_ANISKIP_SETTINGS };


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
  KITSU_ANIME_MAPPING_PREFIX: 'kitsu.anime.',
  KITSU_EPISODES_PREFIX: 'kitsu.episodes.',
  HOME_DATA: 'cache.homeData',
  ANISKIP_SETTINGS: 'settings.aniSkipSettings',
} as const;

export type ThemeMode = 'oled' | 'light' | 'custom';
export type ThemeFamily = 'default' | 'pikachu' | 'orchid' | 'rainbow' | 'custom';
export type PikachuMode = 'dark' | 'light';
export type OrchidMode = 'dark' | 'light';
export type RainbowMode = 'dark' | 'light';
export type EndingThreshold = 90 | 60 | 30 | 0;
export type PreferredQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
export type HistoryRetentionDays = 30 | 60 | 90 | 180 | 0;
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
  searchMode: SearchMode;
  searchDebounceMs: number;
  searchMinChars: number;
  aniSkipSettings?: AniSkipSettings;
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
  searchMode: 'auto',
  searchDebounceMs: 800,
  searchMinChars: 3,
  aniSkipSettings: DEFAULT_ANISKIP_SETTINGS,
};

export interface WatchProgressItem {
  animeId: string;
  animeTitle: string;
  thumbnail: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number;
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
  totalEpisodes?: number;
  position: number;
  duration: number;
  percentage: number;
  updatedAt: number;
  dataId?: string;
  serverId?: string;
}

export interface SaveProgressPayload {
  animeId: string;
  animeTitle?: string;
  title?: string;
  thumbnail?: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number;
  currentTime?: number;
  position?: number;
  duration: number;
  dataId?: string;
  serverId?: string;
}

export const AppStorage = {
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
    storage.set(key, JSON.stringify(value));
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

  saveSettings: (partial: Partial<AppSettings>): AppSettings => {
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
    if (partial.aniSkipSettings) {
      AppStorage.saveAniSkipSettings(partial.aniSkipSettings);
    }
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
      AppStorage.setObject(StorageKeys.APP_SETTINGS, {
        ...settings,
        tld: cleanTld,
      });
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

  setCustomDomain: (domain: string): void => {
    const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    if (cleanDomain) {
      scraperConfig.setBaseUrl(`https://${cleanDomain}`);
      const settings = AppStorage.getSettings();
      AppStorage.setObject(StorageKeys.APP_SETTINGS, {
        ...settings,
        customDomain: cleanDomain,
        tld: cleanDomain,
      });
    }
  },

  removeCustomDomain: (): void => {
    const settings = AppStorage.getSettings();
    const updated = { ...settings };
    delete updated.customDomain;
    if (updated.tld === settings.customDomain) {
      updated.tld = 'so';
      scraperConfig.setTld('so');
    }
    AppStorage.setObject(StorageKeys.APP_SETTINGS, updated);
  },

  getThemeFamily: (): ThemeFamily => {
    return AppStorage.getSettings().themeFamily || 'default';
  },

  setThemeFamily: (family: ThemeFamily): void => {
    AppStorage.saveSettings({ themeFamily: family });
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
    };
  },

  saveAniSkipSettings: (partial: Partial<AniSkipSettings>): AniSkipSettings => {
    const current = AppStorage.getAniSkipSettings();
    const updated: AniSkipSettings = {
      ...current,
      ...partial,
    };
    AppStorage.setObject(StorageKeys.ANISKIP_SETTINGS, updated);
    return updated;
  },

  setAniSkipSettings: (partial: Partial<AniSkipSettings>): AniSkipSettings => {
    return AppStorage.saveAniSkipSettings(partial);
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
      return false;
    } else {
      favorites.unshift(item);
      AppStorage.setObject(StorageKeys.FAVORITES, favorites);
      return true;
    }
  },

  removeFavorite: (animeId: string): void => {
    if (!animeId) return;
    const favorites = AppStorage.getFavorites().filter((fav) => fav.id !== animeId);
    AppStorage.setObject(StorageKeys.FAVORITES, favorites);
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

  getWatchHistory: (): WatchHistoryItem[] => {
    const data = AppStorage.getObject<unknown>(StorageKeys.WATCH_HISTORY);
    const history = Array.isArray(data) ? (data as WatchHistoryItem[]) : [];
    const retentionDays = AppStorage.getHistoryRetentionDays();
    if (retentionDays <= 0) return history;
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return history.filter((item) => (item.updatedAt || 0) >= cutoffTime);
  },

  getContinueWatching: (): ContinueWatchingItem[] => {
    const saved = AppStorage.getObject<unknown>(StorageKeys.CONTINUE_WATCHING);
    const retentionDays = AppStorage.getHistoryRetentionDays();
    const cutoffTime = retentionDays > 0 ? Date.now() - retentionDays * 24 * 60 * 60 * 1000 : 0;
    if (Array.isArray(saved) && saved.length > 0) {
      return retentionDays > 0
        ? (saved as ContinueWatchingItem[]).filter((item) => (item.updatedAt || 0) >= cutoffTime)
        : (saved as ContinueWatchingItem[]);
    }
    // Fallback: derive from watch history deduplicated by animeId
    const history = AppStorage.getWatchHistory();
    const seen = new Set<string>();
    const derived: ContinueWatchingItem[] = [];
    for (const h of history) {
      if (!seen.has(h.animeId)) {
        seen.add(h.animeId);
        derived.push({
          animeId: h.animeId,
          title: h.title,
          thumbnail: h.thumbnail,
          episodeId: h.episodeId,
          episodeNumber: h.episodeNumber,
          position: h.position,
          duration: h.duration,
          percentage: h.progressPercent,
          updatedAt: h.updatedAt,
          dataId: h.dataId,
          serverId: h.serverId,
        });
      }
    }
    return derived;
  },

  removeContinueWatching: (animeId: string): void => {
    if (!animeId) return;
    const current = AppStorage.getContinueWatching().filter((c) => c.animeId !== animeId);
    AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, current);
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

    const currentTime = Math.max(0, payload.currentTime ?? payload.position ?? 0);
    const duration = Math.max(0, payload.duration || 0);
    const percentage = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const existing = AppStorage.getWatchProgress(payload.animeId, payload.episodeNumber);
    const isCompleted = Boolean(existing?.isCompleted || percentage >= 90);
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
    };
    continueList.unshift(continueItem);
    AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, continueList.slice(0, 50));

    return progressItem;
  },

  clearWatchHistory: (): void => {
    AppStorage.remove(StorageKeys.WATCH_HISTORY);
    AppStorage.remove(StorageKeys.CONTINUE_WATCHING);
    // Remove all episode-level progress keys
    const allKeys = storage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(StorageKeys.WATCH_PROGRESS_PREFIX)) {
        storage.remove(key);
      }
    }
  },

  // ----------------------------------------------------
  // Kitsu Metadata Cache
  // ----------------------------------------------------
  getKitsuAnimeId: (lookupKey: string): string | null => {
    if (!lookupKey) return null;
    return AppStorage.getString(`${StorageKeys.KITSU_ANIME_MAPPING_PREFIX}${lookupKey}`) || null;
  },

  setKitsuAnimeId: (lookupKey: string, kitsuId: string): void => {
    if (!lookupKey || !kitsuId) return;
    AppStorage.setString(`${StorageKeys.KITSU_ANIME_MAPPING_PREFIX}${lookupKey}`, kitsuId);
  },

  getKitsuEpisodes: (kitsuId: string): Record<number, EpisodeMetadata> => {
    if (!kitsuId) return {};
    return (
      AppStorage.getObject<Record<number, EpisodeMetadata>>(
        `${StorageKeys.KITSU_EPISODES_PREFIX}${kitsuId}`,
      ) || {}
    );
  },

  saveKitsuEpisodes: (
    kitsuId: string,
    newEpisodes: Record<number, EpisodeMetadata>,
  ): Record<number, EpisodeMetadata> => {
    if (!kitsuId || !newEpisodes || Object.keys(newEpisodes).length === 0) {
      return AppStorage.getKitsuEpisodes(kitsuId);
    }
    const existing = AppStorage.getKitsuEpisodes(kitsuId);
    const merged = { ...existing, ...newEpisodes };
    AppStorage.setObject(`${StorageKeys.KITSU_EPISODES_PREFIX}${kitsuId}`, merged);
    return merged;
  },

  // ----------------------------------------------------
  // Home Data Cache
  // ----------------------------------------------------
  getHomeData: (): AnimeHomePage | null => {
    return AppStorage.getObject<AnimeHomePage>(StorageKeys.HOME_DATA);
  },

  saveHomeData: (data: AnimeHomePage): void => {
    if (!data) return;
    AppStorage.setObject(StorageKeys.HOME_DATA, data);
  },

  clearCache: (): void => {
    const allKeys = storage.getAllKeys();
    for (const key of allKeys) {
      if (
        key.startsWith('cache.') ||
        key.startsWith('scraper.') ||
        key.startsWith(StorageKeys.KITSU_ANIME_MAPPING_PREFIX) ||
        key.startsWith(StorageKeys.KITSU_EPISODES_PREFIX)
      ) {
        storage.remove(key);
      }
    }
  },
};
