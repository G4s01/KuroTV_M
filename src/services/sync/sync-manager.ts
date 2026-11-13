import { AppStorage, StorageKeys } from '../storage/app-storage';
import { KuroSyncClient } from './client';
import { mergeLocalAndRemote } from './merge';
import type {
  DeltaPushRequest,
  LocalStorageState,
  ProfileItem,
  WatchProgressItem,
} from './types';
import type { SaveProgressPayload } from '../storage/app-storage';

export const DEFAULT_SYNC_SERVER_URL = '';
export const KUROSYNC_GITHUB_REPO_URL = 'https://github.com/G4s01/KuroTV_S';

export interface SyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  serverUrl: string;
  profileName: string;
  profileId: string;
  lastSyncTime: number | null;
  lastError: string | null;
  pendingCount: number;
}

export function parseKuroSyncDeepLink(deepLink: string): {
  url?: string;
  token?: string;
  profile?: string;
  code?: string;
} | null {
  if (!deepLink) return null;
  const cleanLink = deepLink.trim();

  // 1. Support JSON payloads from QR codes
  if (cleanLink.startsWith('{') && cleanLink.endsWith('}')) {
    try {
      const data = JSON.parse(cleanLink);
      if (data && typeof data === 'object') {
        const url = (data.url || data.serverUrl || data.baseUrl || '')?.trim() || undefined;
        const token = (data.token || data.deviceToken || '')?.trim() || undefined;
        const profile = (data.profile || data.profileId || '')?.trim() || undefined;
        const rawCode = (data.code || data.pairCode || '')?.trim();
        const code = rawCode ? rawCode.toUpperCase() : undefined;
        if (url || token || code || profile) {
          return { url, token, profile, code };
        }
      }
    } catch {
      // Ignore JSON error and proceed to URL parsing
    }
  }

  // 2. Validate prefix or query parameters
  const isCustomScheme = cleanLink.startsWith('kurosync://') || cleanLink.startsWith('kurotv://');
  const hasKnownParams =
    cleanLink.includes('url=') ||
    cleanLink.includes('token=') ||
    cleanLink.includes('code=') ||
    cleanLink.includes('/pair') ||
    cleanLink.includes('/connect');

  if (!isCustomScheme && !hasKnownParams) {
    return null;
  }

  try {
    const isStandardUrl = cleanLink.startsWith('http://') || cleanLink.startsWith('https://');
    const urlToParse = isStandardUrl
      ? cleanLink
      : cleanLink.replace(/^[a-zA-Z0-9_-]+:\/\//, 'https://dummy.local/');

    const parsed = new URL(urlToParse);
    let url = parsed.searchParams.get('url')
      ? decodeURIComponent(parsed.searchParams.get('url')!)
      : undefined;

    // Infer server URL from origin if standard HTTP/HTTPS URL and no explicit url param was given
    if (!url && isStandardUrl && parsed.origin && parsed.origin !== 'null') {
      url = parsed.origin;
    }

    const token = parsed.searchParams.get('token')
      ? decodeURIComponent(parsed.searchParams.get('token')!)
      : undefined;
    const profile = parsed.searchParams.get('profile')
      ? decodeURIComponent(parsed.searchParams.get('profile')!)
      : undefined;
    const code = parsed.searchParams.get('code')
      ? decodeURIComponent(parsed.searchParams.get('code')!).toUpperCase()
      : undefined;

    return { url, token, profile, code };
  } catch {
    // Fallback regex parsing
    let url: string | undefined;
    const urlMatch = cleanLink.match(/[?&]url=([^&]+)/);
    if (urlMatch) {
      url = decodeURIComponent(urlMatch[1]);
    } else if (cleanLink.startsWith('http://') || cleanLink.startsWith('https://')) {
      const originMatch = cleanLink.match(/^(https?:\/\/[^/?#]+)/i);
      if (originMatch) url = originMatch[1];
    }

    const tokenMatch = cleanLink.match(/[?&]token=([^&]+)/);
    const profileMatch = cleanLink.match(/[?&]profile=([^&]+)/);
    const codeMatch = cleanLink.match(/[?&]code=([^&]+)/i);

    return {
      url,
      token: tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined,
      profile: profileMatch ? decodeURIComponent(profileMatch[1]) : undefined,
      code: codeMatch ? decodeURIComponent(codeMatch[1]).toUpperCase() : undefined,
    };
  }
}

class SyncManagerClass {
  private client: KuroSyncClient;
  private isSyncing = false;
  private lastError: string | null = null;
  private listeners = new Set<(status: SyncStatus) => void>();

  // Playback debounce tracking (45-60s)
  private lastPlaybackPushTime = 0;
  private lastPlaybackPos = 0;
  private pendingPlaybackPayload: (SaveProgressPayload & {
    currentTime: number;
    duration: number;
    isCompleted?: boolean;
  }) | null = null;

  constructor() {
    const savedUrl = AppStorage.getString(StorageKeys.SYNC_SERVER_URL);
    if (savedUrl && savedUrl.includes('g4s01.workers.dev')) {
      AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
    }

    const serverUrl = AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || DEFAULT_SYNC_SERVER_URL;
    const deviceToken = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);

    this.client = new KuroSyncClient({
      baseUrl: serverUrl,
      deviceToken: deviceToken || undefined,
    });
  }

  private ensureClientConfigured(): void {
    const serverUrl = AppStorage.getString(StorageKeys.SYNC_SERVER_URL);
    if (serverUrl && this.client.getBaseUrl() !== serverUrl) {
      this.client.setBaseUrl(serverUrl);
    }
    const token = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);
    if (token && this.client.getDeviceToken() !== token) {
      this.client.setDeviceToken(token);
    }
  }

  private notify(): void {
    const currentStatus = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(currentStatus);
      } catch {
        // Safe listener catch
      }
    }
  }

  addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    // Call immediately with current state
    try {
      listener(this.getStatus());
    } catch {
      // Safe fallback
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): SyncStatus {
    const deviceToken = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);
    const serverUrl = AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || DEFAULT_SYNC_SERVER_URL;
    const profileName = AppStorage.getString(StorageKeys.SYNC_PROFILE_NAME) || 'Principale';
    const profileId = AppStorage.getString(StorageKeys.SYNC_PROFILE_ID) || '';
    const lastSyncTime = AppStorage.getNumber(StorageKeys.SYNC_LAST_TIME) || null;

    const pendingDeletions = AppStorage.getPendingSyncDeletions();
    const pendingMutations = AppStorage.getPendingSyncMutations();
    let pendingCount = pendingDeletions.length;
    for (const key of Object.keys(pendingMutations)) {
      const val = pendingMutations[key];
      if (Array.isArray(val)) pendingCount += val.length;
      else if (val && typeof val === 'object') pendingCount += 1;
    }

    return {
      isConnected: Boolean(deviceToken && deviceToken.trim().length > 0),
      isSyncing: this.isSyncing,
      serverUrl,
      profileName,
      profileId,
      lastSyncTime,
      lastError: this.lastError,
      pendingCount,
    };
  }

  isConnected(): boolean {
    const token = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);
    return Boolean(token && token.trim().length > 0);
  }

  getClient(): KuroSyncClient {
    return this.client;
  }

  // --------------------------------------------------------------------------
  // Connection Methods
  // --------------------------------------------------------------------------

  async connectFromDeepLink(deepLink: string): Promise<{ ok: boolean; message?: string }> {
    const parsed = parseKuroSyncDeepLink(deepLink);
    if (!parsed || !parsed.token) {
      return { ok: false, message: 'URL o token non validi nel deep-link di KuroSync' };
    }

    const serverUrl = parsed.url || AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || DEFAULT_SYNC_SERVER_URL;
    if (!serverUrl || !serverUrl.trim()) {
      return { ok: false, message: 'URL del server KuroSync mancante nel link o QR' };
    }
    const rawToken = parsed.token;
    const profileId = parsed.profile;

    return this.connectWithToken(serverUrl, rawToken, profileId);
  }

  async connectWithToken(
    serverUrl: string,
    token: string,
    profileId?: string,
    profileName?: string
  ): Promise<{ ok: boolean; message?: string }> {
    if (!token || !token.trim()) {
      return { ok: false, message: 'Token non valido o vuoto' };
    }

    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      return { ok: false, message: 'URL del server KuroSync non specificato' };
    }
    this.client.setBaseUrl(cleanUrl);
    this.client.setDeviceToken(token.trim());

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      // Attempt token exchange to register as a separate mobile device
      let finalToken = token.trim();
      let activeProfileId = profileId;
      let activeProfileName = profileName;

      try {
        const exchangeRes = await this.client.exchangeToken({
          token: finalToken,
          deviceName: 'KuroTV Mobile',
          deviceType: 'mobile',
          platform: 'android',
        });
        if (exchangeRes.ok && exchangeRes.deviceToken) {
          finalToken = exchangeRes.deviceToken;
          this.client.setDeviceToken(finalToken);
          if (exchangeRes.profileId) {
            activeProfileId = exchangeRes.profileId;
          }
        }
      } catch {
        // If exchange fails, the token may already be a direct deviceToken. Keep it.
      }

      // Fetch profile list to verify and retrieve profile name
      let profiles: ProfileItem[] = [];
      try {
        profiles = await this.client.listProfiles();
      } catch {
        // Non-blocking
      }

      if (profiles.length > 0) {
        if (activeProfileId) {
          const match = profiles.find((p) => p.id === activeProfileId);
          if (match) activeProfileName = match.name;
        } else {
          activeProfileId = profiles[0].id;
          activeProfileName = profiles[0].name;
        }
      }

      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
      AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, finalToken);
      if (activeProfileId) AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, activeProfileId);
      if (activeProfileName) AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeProfileName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);

      // Trigger initial full sync
      await this.performFullSync();

      this.isSyncing = false;
      this.notify();
      return { ok: true };
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Connessione al server fallita';
      this.notify();
      return { ok: false, message: this.lastError || undefined };
    }
  }

  async connectWithPassword(
    serverUrl: string,
    password: string,
    profileId?: string
  ): Promise<{ ok: boolean; profile?: any; message?: string }> {
    if (!password || !password.trim()) {
      return { ok: false, message: 'La master password è richiesta' };
    }

    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      return { ok: false, message: "L'URL del server KuroSync è richiesto" };
    }
    this.client.setBaseUrl(cleanUrl);
    this.client.setDeviceToken(undefined);

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      let loginRes: any;
      if (profileId) {
        loginRes = await this.client.loginDevice({
          password: password.trim(),
          profileId,
          deviceName: 'KuroTV Mobile',
          deviceType: 'mobile',
          platform: 'android',
        });
      } else {
        loginRes = await this.client.loginWithPassword(password.trim());
      }

      const token = loginRes.deviceToken || loginRes.token;
      if (!token) {
        throw new Error('Nessun token restituito dal server');
      }

      const activeProfileId = loginRes.profile?.id || loginRes.profileId || profileId;
      const activeProfileName = loginRes.profile?.name || 'Principale';

      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
      AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, token);
      AppStorage.setString(StorageKeys.SYNC_MASTER_PASSWORD, password.trim());
      if (activeProfileId) AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, activeProfileId);
      if (activeProfileName) AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeProfileName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);

      this.client.setDeviceToken(token);

      // Initial full sync
      await this.performFullSync();

      this.isSyncing = false;
      this.notify();
      return { ok: true, profile: loginRes.profile };
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Autenticazione fallita';
      this.notify();
      return { ok: false, message: this.lastError || undefined };
    }
  }

  disconnect(): void {
    AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
    AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
    AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
    AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
    AppStorage.remove(StorageKeys.SYNC_LAST_TIMESTAMP);
    AppStorage.remove(StorageKeys.SYNC_LAST_TIME);
    AppStorage.remove(StorageKeys.SYNC_IS_ENABLED);
    AppStorage.remove(StorageKeys.SYNC_MASTER_PASSWORD);

    this.client.setDeviceToken(undefined);
    this.lastError = null;
    this.isSyncing = false;
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Profile Management
  // --------------------------------------------------------------------------

  async listProfiles(): Promise<ProfileItem[]> {
    if (!this.isConnected()) return [];
    return this.client.listProfiles();
  }

  async switchProfile(profileId: string, profileName?: string): Promise<boolean> {
    if (!this.isConnected() || !profileId) return false;

    const savedPassword = AppStorage.getString(StorageKeys.SYNC_MASTER_PASSWORD);
    if (savedPassword) {
      try {
        const loginRes = await this.client.loginDevice({
          password: savedPassword,
          profileId,
          deviceName: 'KuroTV Mobile',
          deviceType: 'mobile',
          platform: 'android',
        });
        if (loginRes.deviceToken) {
          this.client.setDeviceToken(loginRes.deviceToken);
          AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, loginRes.deviceToken);
        }
      } catch {
        // Fallback
      }
    }

    AppStorage.clearPendingSyncMutations();
    AppStorage.clearPendingSyncDeletions();
    AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, profileId);
    if (profileName) {
      AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, profileName);
    }
    // Reset last timestamp to pull all deltas for the target profile
    AppStorage.setNumber(StorageKeys.SYNC_LAST_TIMESTAMP, 0);

    const res = await this.performFullSync();
    return res.ok;
  }

  // --------------------------------------------------------------------------
  // TV Simple-Login Pairing Approval
  // --------------------------------------------------------------------------

  async approveTvPairing(
    code: string,
    profileId?: string,
    deviceLabel?: string
  ): Promise<{ ok: boolean; deviceId?: string; message?: string }> {
    if (!this.isConnected()) {
      return { ok: false, message: 'Collega prima KuroSync sullo smartphone' };
    }

    this.ensureClientConfigured();

    let cleanCode = (code || '').trim().toUpperCase();
    // If the user pasted a verify URL like https://server/pair?code=K7X9P2
    if (code && (code.startsWith('http://') || code.startsWith('https://'))) {
      try {
        const parsed = new URL(code);
        if (parsed.origin && !this.client.getBaseUrl()) {
          this.client.setBaseUrl(parsed.origin);
        }
      } catch {
        // ignore
      }
    }
    if (cleanCode.includes('CODE=')) {
      const match = cleanCode.match(/CODE=([A-Z0-9]+)/i);
      if (match && match[1]) cleanCode = match[1].toUpperCase();
    }

    if (!cleanCode || cleanCode.length < 4) {
      return { ok: false, message: 'Codice di accoppiamento TV non valido' };
    }

    const currentProfileId =
      profileId || AppStorage.getString(StorageKeys.SYNC_PROFILE_ID) || 'prof-1';

    try {
      this.isSyncing = true;
      this.notify();

      const res = await this.client.approveTvPairing({
        code: cleanCode,
        profileId: currentProfileId,
        deviceLabel: deviceLabel || 'Android TV',
      });

      this.isSyncing = false;
      this.notify();
      return { ok: true, deviceId: res.deviceId };
    } catch (err: any) {
      this.isSyncing = false;
      const message = err?.message || 'Autorizzazione TV fallita';
      this.lastError = message;
      this.notify();
      return { ok: false, message };
    }
  }

  // --------------------------------------------------------------------------
  // Synchronization Core (Pull + Merge + Push)
  // --------------------------------------------------------------------------

  async performFullSync(): Promise<{
    ok: boolean;
    upserts: number;
    deletions: number;
    error?: string;
  }> {
    if (!this.isConnected()) {
      return { ok: false, upserts: 0, deletions: 0, error: 'KuroSync non collegato' };
    }

    this.ensureClientConfigured();

    if (this.isSyncing) {
      return { ok: true, upserts: 0, deletions: 0 };
    }

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      const since = AppStorage.getNumber(StorageKeys.SYNC_LAST_TIMESTAMP) || 0;

      // 1. Pull deltas from server
      const remotePull = await this.client.pullDelta(since);

      // 2. Read local MMKV state
      const settings = AppStorage.getSettings();
      const aniSkip = AppStorage.getAniSkipSettings();
      const sharedSettings: Record<string, any> = {
        aniSkipSettings: aniSkip,
        endingThresholdSeconds: settings.endingThresholdSeconds,
        preferredQuality: settings.preferredQuality,
        autoplayNext: settings.autoplayNext,
        defaultServer: settings.defaultServer,
        tld: settings.tld,
        customDomain: settings.customDomain,
        historyRetentionDays: settings.historyRetentionDays,
        searchHistoryRetentionDays: settings.searchHistoryRetentionDays,
      };

      const localState: LocalStorageState = {
        favorites: AppStorage.getFavorites(),
        continueWatching: AppStorage.getContinueWatching(),
        watchHistory: AppStorage.getWatchHistory(),
        watchProgress: AppStorage.getAllWatchProgress(),
        sharedSettings,
        searchHistory: AppStorage.getSearchHistory(),
      };

      // 3. Merge local and remote
      const { state: mergedState, appliedDeletions, appliedUpserts } = mergeLocalAndRemote(
        localState,
        remotePull
      );

      // 4. Save merged results atomically back to MMKV
      AppStorage.setObject(StorageKeys.FAVORITES, mergedState.favorites);
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, mergedState.continueWatching);
      AppStorage.setObject(StorageKeys.WATCH_HISTORY, mergedState.watchHistory.slice(0, 100));

      // Purge deleted watch progress and save updated progress
      for (const t of remotePull.tombstones || []) {
        if (t.type === 'watch_progress') {
          const parts = t.key.split(':');
          if (parts.length === 2) {
            AppStorage.remove(`${StorageKeys.WATCH_PROGRESS_PREFIX}${parts[0]}.${parts[1]}`);
          }
        }
      }
      for (const p of mergedState.watchProgress) {
        AppStorage.setObject(`${StorageKeys.WATCH_PROGRESS_PREFIX}${p.animeId}.${p.episodeNumber}`, p);
      }

      AppStorage.setObject(StorageKeys.SEARCH_HISTORY, mergedState.searchHistory.slice(0, 50));

      if (mergedState.sharedSettings) {
        AppStorage.saveSettings(mergedState.sharedSettings);
      }
      AppStorage.notifyStorageChanged();

      // 5. Gather and push pending local changes
      const pendingDeletions = AppStorage.getPendingSyncDeletions();
      const pendingMutations = AppStorage.getPendingSyncMutations();

      const hasPending =
        pendingDeletions.length > 0 || Object.keys(pendingMutations).length > 0;

      // If initial bootstrap (since === 0), also push current local data to populate the profile
      let pushPayload: DeltaPushRequest;
      if (since === 0) {
        pushPayload = {
          favorites: mergedState.favorites,
          continueWatching: mergedState.continueWatching,
          watchHistory: mergedState.watchHistory,
          watchProgress: mergedState.watchProgress,
          sharedSettings: mergedState.sharedSettings,
          searchHistory: mergedState.searchHistory,
          deletions: pendingDeletions,
        };
      } else if (hasPending) {
        pushPayload = {
          ...pendingMutations,
          deletions: pendingDeletions,
        };
      } else {
        pushPayload = {};
      }

      let newServerTime = remotePull.serverTime;
      if (since === 0 || hasPending) {
        const pushRes = await this.client.pushDelta(pushPayload);
        if (pushRes.serverTime) {
          newServerTime = pushRes.serverTime;
        }
        AppStorage.clearPendingSyncDeletions();
        AppStorage.clearPendingSyncMutations();
      }

      AppStorage.setNumber(StorageKeys.SYNC_LAST_TIMESTAMP, newServerTime);
      AppStorage.setNumber(StorageKeys.SYNC_LAST_TIME, Date.now());

      this.isSyncing = false;
      this.notify();

      return {
        ok: true,
        upserts: appliedUpserts,
        deletions: appliedDeletions,
      };
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Sincronizzazione fallita';
      this.notify();
      return { ok: false, upserts: 0, deletions: 0, error: this.lastError || undefined };
    }
  }

  async pullDelta(): Promise<{ ok: boolean; upserts: number; deletions: number; error?: string }> {
    return this.performFullSync();
  }

  private commitPlaybackPayload(): void {
    if (!this.pendingPlaybackPayload) return;

    const p = this.pendingPlaybackPayload;
    this.pendingPlaybackPayload = null;
    this.lastPlaybackPushTime = Date.now();
    this.lastPlaybackPos = p.currentTime;

    const watchProgressItem: WatchProgressItem = {
      animeId: p.animeId,
      animeTitle: p.animeTitle || p.title || 'Anime',
      thumbnail: p.thumbnail || '',
      episodeId: p.episodeId,
      episodeNumber: p.episodeNumber,
      totalEpisodes: p.totalEpisodes,
      currentTime: p.currentTime,
      duration: p.duration,
      percentage:
        p.duration > 0 ? Math.min(100, Math.round((p.currentTime / p.duration) * 100)) : 0,
      isCompleted: Boolean(p.isCompleted || (p.duration > 0 && p.currentTime / p.duration >= 0.9)),
      updatedAt: Date.now(),
      dataId: p.dataId,
      serverId: p.serverId,
    };

    AppStorage.recordSyncMutation('watchProgress', watchProgressItem);
  }

  async pushPending(force = false): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConnected()) return { ok: false, error: 'Non collegato' };

    // Atomically commit any pending playback progress into pending mutations
    if (this.pendingPlaybackPayload) {
      this.commitPlaybackPayload();
    }

    const pendingDeletions = AppStorage.getPendingSyncDeletions();
    const pendingMutations = AppStorage.getPendingSyncMutations();

    if (!force && pendingDeletions.length === 0 && Object.keys(pendingMutations).length === 0) {
      return { ok: true };
    }

    try {
      const pushRes = await this.client.pushDelta({
        ...pendingMutations,
        deletions: pendingDeletions,
      });

      AppStorage.clearPendingSyncDeletions();
      AppStorage.clearPendingSyncMutations();
      if (pushRes.serverTime) {
        AppStorage.setNumber(StorageKeys.SYNC_LAST_TIMESTAMP, pushRes.serverTime);
      }
      AppStorage.setNumber(StorageKeys.SYNC_LAST_TIME, Date.now());
      this.notify();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }

  // --------------------------------------------------------------------------
  // Playback Debouncing (45-60s) & Immediate Flush
  // --------------------------------------------------------------------------

  async recordPlaybackProgress(
    payload: SaveProgressPayload & {
      currentTime: number;
      duration: number;
      isCompleted?: boolean;
    },
    immediate = false
  ): Promise<void> {
    if (!this.isConnected()) return;

    this.pendingPlaybackPayload = payload;
    const now = Date.now();
    const pos = payload.currentTime;

    if (this.lastPlaybackPushTime === 0) {
      this.lastPlaybackPushTime = now;
      this.lastPlaybackPos = pos;
    }

    const posChanged = Math.abs(pos - this.lastPlaybackPos) >= 2;
    const timeSinceLastPush = now - this.lastPlaybackPushTime;

    if (immediate || payload.isCompleted || (posChanged && timeSinceLastPush >= 45000)) {
      await this.flushPlaybackProgress();
    }
  }

  async flushPlaybackProgress(): Promise<void> {
    if (!this.isConnected() || !this.pendingPlaybackPayload) return;
    this.commitPlaybackPayload();
    await this.pushPending(true);
  }
}

export const SyncManager = new SyncManagerClass();
