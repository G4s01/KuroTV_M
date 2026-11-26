import { AppStorage, StorageKeys } from '../storage/app-storage';
import { KuroSyncClient } from './client';
import { mergeLocalAndRemote } from './merge';
import { getDeviceName } from './device-info';
import {
  parseKuroSyncDeepLink,
  type ParsedKuroSyncDeepLink,
} from './deep-link';
import {
  applyRemoteMalAuthRecordForScope,
  clearSyncedMalProfileData,
  getActiveMalProfileScope,
  getMalAuthSyncRecordForScope,
} from '../mal/config';
import { MalAuthService } from '../mal/auth';
import { MalSyncService } from '../mal/sync';
import type {
  DeltaPushRequest,
  LocalStorageState,
  ProfileItem,
  WatchProgressItem,
  AnimeItem,
  ContinueWatchingItem,
  WatchHistoryItem,
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

export function isSyncAuthError(err?: string | null, status?: number): boolean {
  if (status === 401 || status === 403) return true;
  if (!err) return false;
  const lower = err.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('token non valido') ||
    lower.includes('sessione scaduta')
  );
}

export { parseKuroSyncDeepLink, type ParsedKuroSyncDeepLink };

function sanitizePushPayload(
  payload: DeltaPushRequest,
  includeMalAuth = AppStorage.getSyncServerSupportsMalAuth()
): DeltaPushRequest {
  const sanitized: DeltaPushRequest = { ...payload };

  if (includeMalAuth && sanitized.malAuth) {
    const ma = sanitized.malAuth;
    if (ma.clientId && ma.accessToken && ma.refreshToken) {
      sanitized.malAuth = {
        profileId: ma.profileId,
        clientId: ma.clientId.trim(),
        accessToken: ma.accessToken,
        refreshToken: ma.refreshToken,
        expiresAt: typeof ma.expiresAt === 'number' ? ma.expiresAt : 0,
        tokenType: ma.tokenType || 'Bearer',
        username: ma.username,
        userId: ma.userId,
        picture: ma.picture,
        updatedAt: typeof ma.updatedAt === 'number' && ma.updatedAt > 0 ? ma.updatedAt : Date.now(),
      };
    } else {
      delete sanitized.malAuth;
    }
  } else {
    delete sanitized.malAuth;
  }

  if (Array.isArray(sanitized.favorites)) {
    sanitized.favorites = sanitized.favorites.map((f) => ({
      ...f,
      title: f.title || 'Anime',
      thumbnail: f.thumbnail || '',
      link: f.link || '',
      genres: Array.isArray(f.genres) ? f.genres : [],
      updatedAt: f.updatedAt || Date.now(),
    }));
  }

  if (Array.isArray(sanitized.continueWatching)) {
    sanitized.continueWatching = sanitized.continueWatching.map((c) => ({
      ...c,
      title: c.title || 'Anime',
      thumbnail: c.thumbnail || '',
      episodeId: c.episodeId || '',
      episodeNumber: typeof c.episodeNumber === 'number' ? c.episodeNumber : 1,
      position: typeof c.position === 'number' ? c.position : 0,
      duration: typeof c.duration === 'number' ? c.duration : 0,
      percentage: typeof c.percentage === 'number' ? c.percentage : 0,
      isCaughtUp: Boolean(c.isCaughtUp),
      updatedAt: c.updatedAt || Date.now(),
    }));
  }

  if (Array.isArray(sanitized.watchHistory)) {
    sanitized.watchHistory = sanitized.watchHistory.map((h) => ({
      ...h,
      title: h.title || 'Anime',
      thumbnail: h.thumbnail || '',
      episodeId: h.episodeId || '',
      episodeNumber: typeof h.episodeNumber === 'number' ? h.episodeNumber : 1,
      position: typeof h.position === 'number' ? h.position : 0,
      duration: typeof h.duration === 'number' ? h.duration : 0,
      progressPercent: typeof h.progressPercent === 'number' ? h.progressPercent : 0,
      isCompleted: Boolean(h.isCompleted),
      updatedAt: h.updatedAt || Date.now(),
    }));
  }

  if (Array.isArray(sanitized.watchProgress)) {
    sanitized.watchProgress = sanitized.watchProgress.map((p) => ({
      ...p,
      animeTitle: p.animeTitle || 'Anime',
      thumbnail: p.thumbnail || '',
      episodeId: p.episodeId || '',
      episodeNumber: typeof p.episodeNumber === 'number' ? p.episodeNumber : 1,
      currentTime: typeof p.currentTime === 'number' ? p.currentTime : 0,
      duration: typeof p.duration === 'number' ? p.duration : 0,
      percentage: typeof p.percentage === 'number' ? p.percentage : 0,
      isCompleted: Boolean(p.isCompleted),
      updatedAt: p.updatedAt || Date.now(),
    }));
  }

  if (Array.isArray(sanitized.searchHistory)) {
    sanitized.searchHistory = sanitized.searchHistory
      .filter((s) => s && typeof s.query === 'string' && s.query.trim().length > 0)
      .map((s) => ({
        query: s.query.trim(),
        timestamp: typeof s.timestamp === 'number' && s.timestamp > 0 ? s.timestamp : Date.now(),
      }));
  }

  if (Array.isArray(sanitized.deletions)) {
    const validTypes = new Set([
      'favorite',
      'continue_watching',
      'watch_history',
      'watch_progress',
      'shared_settings',
      'search_history',
    ]);
    if (includeMalAuth) {
      validTypes.add('mal_auth');
    }
    sanitized.deletions = sanitized.deletions
      .filter((d) => d && typeof d.key === 'string' && validTypes.has(d.type))
      .map((d) => ({
        type: d.type,
        key: d.key,
        deletedAt: typeof d.deletedAt === 'number' && d.deletedAt > 0 ? d.deletedAt : Date.now(),
      }));
  }

  return sanitized;
}

class SyncManagerClass {
  private client: KuroSyncClient;
  private isSyncing = false;
  private lastError: string | null = null;
  private listeners = new Set<(status: SyncStatus) => void>();
  private lastKnownServerUrl = '';

  // Auto-sync debouncing & periodic poll
  private autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;

  // Playback debounce tracking (45-60s)
  private lastPlaybackPushTime = 0;
  private lastPlaybackPos = 0;
  private pendingPlaybackPayload: (SaveProgressPayload & {
    currentTime: number;
    duration: number;
    isCompleted?: boolean;
  }) | null = null;

  constructor() {
    let serverUrl = (AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || '').trim();
    if (!serverUrl) {
      serverUrl = (AppStorage.getString('sync.server_url_backup') || DEFAULT_SYNC_SERVER_URL).trim();
      if (serverUrl) {
        AppStorage.setString(StorageKeys.SYNC_SERVER_URL, serverUrl);
      }
    }
    const deviceToken = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);

    if (serverUrl) {
      this.lastKnownServerUrl = serverUrl;
      AppStorage.setString('sync.server_url_backup', serverUrl);
    }

    this.client = new KuroSyncClient({
      baseUrl: serverUrl,
      deviceToken: deviceToken || undefined,
    });

    // Auto-sync on local storage mutations (Favorites, History, Searches, AniSkip, Settings)
    AppStorage.addMutationListener((type) => {
      // Playback progress mutations are debounced 45-60s during video playback
      if (type === 'watchProgress') return;
      if (
        this.pendingPlaybackPayload !== null &&
        (type === 'watchHistory' || type === 'continueWatching')
      ) {
        return;
      }
      this.scheduleAutoSync(1500);
    });
  }

  scheduleAutoSync(delayMs = 1500): void {
    if (!this.isConnected()) return;
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }
    this.autoSyncTimer = setTimeout(() => {
      this.autoSyncTimer = null;
      if (this.isConnected() && !this.isSyncing) {
        this.pushPending(false).catch(() => {});
      }
    }, delayMs);
  }

  cancelAutoSync(): void {
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  startPeriodicSync(intervalMs = 60000): void {
    this.stopPeriodicSync();
    this.periodicSyncTimer = setInterval(() => {
      if (this.isConnected() && !this.isSyncing) {
        this.pullDelta().catch(() => {});
      }
    }, intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = null;
    }
  }

  private persistServerUrl(url: string): void {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl) return;
    this.lastKnownServerUrl = cleanUrl;
    this.client.setBaseUrl(cleanUrl);
    AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
    AppStorage.setString('sync.server_url_backup', cleanUrl);
  }

  private ensureClientConfigured(): void {
    let serverUrl = (AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || '').trim();
    if (!serverUrl) {
      serverUrl = (AppStorage.getString('sync.server_url_backup') || '').trim();
      if (serverUrl) {
        AppStorage.setString(StorageKeys.SYNC_SERVER_URL, serverUrl);
      }
    }
    if (!serverUrl && this.lastKnownServerUrl) {
      serverUrl = this.lastKnownServerUrl;
      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, serverUrl);
      AppStorage.setString('sync.server_url_backup', serverUrl);
    }
    if (!serverUrl && this.client.getBaseUrl()) {
      serverUrl = this.client.getBaseUrl();
      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, serverUrl);
      AppStorage.setString('sync.server_url_backup', serverUrl);
    }

    if (serverUrl) {
      this.lastKnownServerUrl = serverUrl;
      if (this.client.getBaseUrl() !== serverUrl) {
        this.client.setBaseUrl(serverUrl);
      }
    }

    const token = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN)?.trim();
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
    this.ensureClientConfigured();
    const deviceToken = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);
    const serverUrl =
      (AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
      this.lastKnownServerUrl ||
      this.client.getBaseUrl() ||
      DEFAULT_SYNC_SERVER_URL).trim();
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

    const isConnected = Boolean(
      deviceToken &&
      deviceToken.trim().length > 0 &&
      serverUrl &&
      serverUrl.length > 0
    );

    return {
      isConnected,
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
    this.ensureClientConfigured();
    const token = AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN);
    const serverUrl =
      AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
      this.lastKnownServerUrl ||
      this.client.getBaseUrl();
    return Boolean(
      token &&
      token.trim().length > 0 &&
      serverUrl &&
      serverUrl.trim().length > 0
    );
  }

  getServerUrl(): string {
    this.ensureClientConfigured();
    return (
      AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
      this.lastKnownServerUrl ||
      this.client.getBaseUrl() ||
      DEFAULT_SYNC_SERVER_URL
    ).trim();
  }

  getClient(): KuroSyncClient {
    this.ensureClientConfigured();
    return this.client;
  }

  // --------------------------------------------------------------------------
  // Profile-Scoped Sync Cursor Management
  // --------------------------------------------------------------------------

  getLastSyncTimestamp(profileId?: string): number {
    const targetId = profileId || AppStorage.getString(StorageKeys.SYNC_PROFILE_ID) || '';
    return AppStorage.getProfileLastSyncTimestamp(targetId);
  }

  setLastSyncTimestamp(timestamp: number, profileId?: string): void {
    const targetId = profileId || AppStorage.getString(StorageKeys.SYNC_PROFILE_ID) || '';
    AppStorage.setProfileLastSyncTimestamp(targetId, timestamp);
  }

  resetLastSyncTimestamp(profileId?: string): void {
    const targetId = profileId || AppStorage.getString(StorageKeys.SYNC_PROFILE_ID) || '';
    AppStorage.clearProfileLastSyncTimestamp(targetId);
  }

  // --------------------------------------------------------------------------
  // Connection Methods
  // --------------------------------------------------------------------------

  /**
   * Prepares connection from a scanned QR code or deep link.
   * Exchanges the ephemeral QR token for a device token and fetches available profiles
   * so the user can select their profile (Netflix-style) before initial sync.
   */
  async prepareQrConnection(deepLinkOrRaw: string): Promise<{
    ok: boolean;
    isExpiredQr?: boolean;
    message?: string;
    serverUrl?: string;
    deviceToken?: string;
    deviceId?: string;
    currentProfileId?: string;
    profiles?: ProfileItem[];
  }> {
    const raw = deepLinkOrRaw?.trim();
    if (!raw) {
      return { ok: false, message: 'Codice QR o link mancante' };
    }

    const parsed = parseKuroSyncDeepLink(raw);
    let serverUrl: string | undefined;
    let rawToken: string | undefined;
    let explicitProfileId: string | undefined;

    if (parsed && (parsed.token || parsed.url)) {
      serverUrl =
        parsed.url ||
        AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
        this.lastKnownServerUrl ||
        this.client.getBaseUrl() ||
        DEFAULT_SYNC_SERVER_URL;
      rawToken = parsed.token;
      explicitProfileId = parsed.profile;
    } else {
      serverUrl =
        AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
        this.lastKnownServerUrl ||
        this.client.getBaseUrl() ||
        DEFAULT_SYNC_SERVER_URL;
      rawToken = raw;
    }

    if (!serverUrl || !serverUrl.trim()) {
      return { ok: false, message: 'URL del server KuroSync mancante nel QR code' };
    }
    if (!rawToken || !rawToken.trim()) {
      return { ok: false, message: 'Token non valido nel QR code' };
    }

    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    this.persistServerUrl(cleanUrl);

    const isExplicitQr = rawToken.trim().startsWith('qr_');

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      let finalToken = rawToken.trim();
      let activeDeviceId: string | undefined;
      let activeProfileId = explicitProfileId;

      try {
        const exchangeRes = await this.client.exchangeToken({
          token: finalToken,
          deviceName: getDeviceName(),
          deviceType: 'mobile',
          platform: 'android',
        });
        if (exchangeRes.ok && exchangeRes.deviceToken) {
          finalToken = exchangeRes.deviceToken;
          activeDeviceId = exchangeRes.deviceId;
          this.client.setDeviceToken(finalToken);
          if (exchangeRes.profileId) {
            activeProfileId = exchangeRes.profileId;
          }
        }
      } catch (err: any) {
        const status = err?.status;
        const msg = String(err?.message || '').toLowerCase();
        const isExpiredOrConsumed =
          status === 410 ||
          msg.includes('410') ||
          msg.includes('scaduto') ||
          msg.includes('expired') ||
          msg.includes('già utilizzato') ||
          msg.includes('already consumed') ||
          (status === 404 && isExplicitQr);

        if (isExpiredOrConsumed) {
          this.isSyncing = false;
          this.lastError =
            'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.';
          this.notify();
          return {
            ok: false,
            isExpiredQr: true,
            message: this.lastError,
          };
        }

        if (isExplicitQr) {
          this.isSyncing = false;
          this.lastError = err?.message || 'Scambio token QR fallito';
          this.notify();
          return {
            ok: false,
            message: this.lastError || undefined,
          };
        }
        // Direct device token fallback
        this.client.setDeviceToken(finalToken);
      }

      // Fetch profile list from server using authenticated device token
      let profiles: ProfileItem[] = [];
      try {
        profiles = await this.client.listProfiles();
      } catch {
        // Fallback
      }

      if (profiles.length === 0) {
        profiles = [{ id: activeProfileId || 'default', name: 'Principale', avatarColor: '#E50914' }];
      }

      this.isSyncing = false;
      this.notify();

      return {
        ok: true,
        serverUrl: cleanUrl,
        deviceToken: finalToken,
        deviceId: activeDeviceId,
        currentProfileId: activeProfileId,
        profiles,
      };
    } catch (err: any) {
      this.ensureClientConfigured();
      this.isSyncing = false;
      this.lastError = err?.message || 'Errore durante la scansione QR';
      this.notify();
      return { ok: false, message: this.lastError || undefined };
    }
  }

  /**
   * Finalizes QR connection after the user selects their profile from the Netflix-style picker.
   */
  async completeQrConnection(params: {
    serverUrl: string;
    deviceToken: string;
    deviceId?: string;
    profileId: string;
    profileName?: string;
  }): Promise<{ ok: boolean; message?: string }> {
    const { serverUrl, deviceToken, deviceId, profileId, profileName } = params;
    const cleanUrl = serverUrl?.trim().replace(/\/+$/, '');
    if (!cleanUrl || !deviceToken || !profileId) {
      return { ok: false, message: 'Parametri di connessione non validi' };
    }

    this.persistServerUrl(cleanUrl);
    this.client.setDeviceToken(deviceToken);

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      let activeName = profileName || 'Principale';
      try {
        const switchRes = await this.client.switchProfile(profileId);
        if (switchRes.profile?.name) {
          activeName = switchRes.profile.name;
        }
      } catch {
        // Non-blocking: profile may already be active or single-profile instance
      }

      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
      AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, deviceToken);
      if (deviceId) {
        AppStorage.setString(StorageKeys.SYNC_DEVICE_ID, deviceId);
      }
      AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, profileId);
      AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);
      this.resetLastSyncTimestamp(profileId);
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();

      // Trigger initial full sync
      const syncRes = await this.performFullSync(0, true);
      if (!syncRes.ok && syncRes.error && (syncRes.error.includes('401') || syncRes.error.toLowerCase().includes('unauthorized'))) {
        AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
        AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
        AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, false);
        this.client.setDeviceToken(undefined);
        MalAuthService.handleSyncScopeChanged();
        MalSyncService.handleSyncScopeChanged();
        this.isSyncing = false;
        this.lastError = syncRes.error;
        this.notify();
        return { ok: false, message: syncRes.error };
      }

      this.isSyncing = false;
      this.notify();
      return { ok: true };
    } catch (err: any) {
      this.ensureClientConfigured();
      this.isSyncing = false;
      this.lastError = err?.message || 'Finalizzazione connessione fallita';
      this.notify();
      return { ok: false, message: this.lastError || undefined };
    }
  }

  async connectFromDeepLink(deepLink: string): Promise<{ ok: boolean; isExpiredQr?: boolean; message?: string }> {
    const parsed = parseKuroSyncDeepLink(deepLink);
    if (!parsed || !parsed.token) {
      return { ok: false, message: 'URL o token non validi nel deep-link di KuroSync' };
    }

    const serverUrl =
      parsed.url ||
      AppStorage.getString(StorageKeys.SYNC_SERVER_URL) ||
      this.lastKnownServerUrl ||
      this.client.getBaseUrl() ||
      DEFAULT_SYNC_SERVER_URL;
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
  ): Promise<{ ok: boolean; isExpiredQr?: boolean; message?: string }> {
    if (!token || !token.trim()) {
      return { ok: false, message: 'Token non valido o vuoto' };
    }

    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      return { ok: false, message: 'URL del server KuroSync non specificato' };
    }
    this.persistServerUrl(cleanUrl);
    this.client.setDeviceToken(token.trim());

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      // Attempt token exchange to register as a separate mobile device
      let finalToken = token.trim();
      let activeDeviceId: string | undefined;
      let activeProfileId = profileId;
      let activeProfileName = profileName;

      const isExplicitQr = finalToken.startsWith('qr_');

      try {
        const exchangeRes = await this.client.exchangeToken({
          token: finalToken,
          deviceName: getDeviceName(),
          deviceType: 'mobile',
          platform: 'android',
        });
        if (exchangeRes.ok && exchangeRes.deviceToken) {
          finalToken = exchangeRes.deviceToken;
          activeDeviceId = exchangeRes.deviceId;
          this.client.setDeviceToken(finalToken);
          if (exchangeRes.profileId) {
            activeProfileId = exchangeRes.profileId;
          }
        }
      } catch (err: any) {
        const status = err?.status;
        const msg = String(err?.message || '').toLowerCase();
        const isExpiredOrConsumed =
          status === 410 ||
          msg.includes('410') ||
          msg.includes('scaduto') ||
          msg.includes('expired') ||
          msg.includes('già utilizzato') ||
          msg.includes('already consumed') ||
          (status === 404 && isExplicitQr);

        if (isExpiredOrConsumed) {
          this.isSyncing = false;
          this.lastError =
            'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.';
          this.notify();
          return {
            ok: false,
            isExpiredQr: true,
            message: this.lastError,
          };
        }

        // If this was an explicit QR token and exchange failed, do not proceed as direct device token
        if (isExplicitQr) {
          this.isSyncing = false;
          this.lastError = err?.message || 'Scambio token QR fallito';
          this.notify();
          return {
            ok: false,
            message: this.lastError || undefined,
          };
        }
        // If exchange fails for other reasons and not a qr_ token, it may already be a direct deviceToken. Keep it.
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
      if (activeDeviceId) AppStorage.setString(StorageKeys.SYNC_DEVICE_ID, activeDeviceId);
      if (activeProfileId) AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, activeProfileId);
      if (activeProfileName) AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeProfileName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);
      this.resetLastSyncTimestamp(activeProfileId);
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();

      // Trigger initial full sync
      const syncRes = await this.performFullSync(0, true);
      if (!syncRes.ok && syncRes.error && (syncRes.error.includes('401') || syncRes.error.toLowerCase().includes('unauthorized'))) {
        AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
        AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
        AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, false);
        this.client.setDeviceToken(undefined);
        MalAuthService.handleSyncScopeChanged();
        MalSyncService.handleSyncScopeChanged();
        this.isSyncing = false;
        this.lastError = syncRes.error;
        this.notify();
        return { ok: false, message: syncRes.error };
      }

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

  /**
   * Retrieves profiles for Netflix-style profile selector prior to login
   */
  async listProfilesWithPassword(serverUrl: string, password: string): Promise<ProfileItem[]> {
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      throw new Error("L'URL del server KuroSync è richiesto");
    }
    if (!password || !password.trim()) {
      throw new Error('La master password è richiesta');
    }
    this.persistServerUrl(cleanUrl);
    return this.client.listProfilesWithPassword(password.trim());
  }

  /**
   * Performs direct device login with a selected profile ID (Netflix-style flow)
   */
  async loginDeviceWithProfile(params: {
    serverUrl: string;
    password: string;
    profileId: string;
    profileName?: string;
  }): Promise<{ ok: boolean; message?: string }> {
    const { serverUrl, password, profileId, profileName } = params;
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      return { ok: false, message: "L'URL del server KuroSync è richiesto" };
    }
    if (!password || !password.trim()) {
      return { ok: false, message: 'La master password è richiesta' };
    }
    if (!profileId) {
      return { ok: false, message: 'Il profilo è richiesto' };
    }

    this.persistServerUrl(cleanUrl);
    this.client.setDeviceToken(undefined);

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      const loginRes = await this.client.loginDevice({
        password: password.trim(),
        profileId,
        deviceName: getDeviceName(),
        deviceType: 'mobile',
        platform: 'android',
      });

      const token = loginRes.deviceToken;
      if (!token) {
        throw new Error('Nessun token restituito dal server');
      }

      const activeProfileId = loginRes.profile?.id || profileId;
      const activeProfileName = loginRes.profile?.name || profileName || 'Principale';

      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
      AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, token);
      if (loginRes.deviceId) {
        AppStorage.setString(StorageKeys.SYNC_DEVICE_ID, loginRes.deviceId);
      }
      AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, activeProfileId);
      AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeProfileName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);
      this.resetLastSyncTimestamp(activeProfileId);
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();

      this.client.setDeviceToken(token);

      // Initial full sync with pullDelta(0)
      const syncRes = await this.performFullSync(0, true);
      if (!syncRes.ok && syncRes.error && (syncRes.error.includes('401') || syncRes.error.toLowerCase().includes('unauthorized'))) {
        AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
        AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
        AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, false);
        this.client.setDeviceToken(undefined);
        MalAuthService.handleSyncScopeChanged();
        MalSyncService.handleSyncScopeChanged();
        this.isSyncing = false;
        this.lastError = syncRes.error;
        this.notify();
        return { ok: false, message: syncRes.error };
      }

      this.isSyncing = false;
      this.notify();
      return { ok: true };
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Autenticazione fallita';
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
    this.persistServerUrl(cleanUrl);
    this.client.setDeviceToken(undefined);

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      let targetProfileId = profileId;
      let targetProfileName = 'Principale';

      // If no profileId was specified, fetch profiles first
      if (!targetProfileId) {
        try {
          const profiles = await this.client.listProfilesWithPassword(password.trim());
          if (profiles && profiles.length > 0) {
            targetProfileId = profiles[0].id;
            targetProfileName = profiles[0].name;
          }
        } catch {
          // Fallback if endpoint not supported
        }
      }

      let loginRes: any;
      if (targetProfileId) {
        loginRes = await this.client.loginDevice({
          password: password.trim(),
          profileId: targetProfileId,
          deviceName: getDeviceName(),
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

      const activeProfileId = loginRes.profile?.id || loginRes.profileId || targetProfileId;
      const activeProfileName = loginRes.profile?.name || targetProfileName;

      AppStorage.setString(StorageKeys.SYNC_SERVER_URL, cleanUrl);
      AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, token);
      if (activeProfileId) AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, activeProfileId);
      if (activeProfileName) AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeProfileName);
      AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, true);
      this.resetLastSyncTimestamp(activeProfileId);
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();

      this.client.setDeviceToken(token);

      // Initial full sync
      const syncRes = await this.performFullSync(0, true);
      if (!syncRes.ok && isSyncAuthError(syncRes.error, (syncRes as any).status)) {
        AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
        AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
        AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
        AppStorage.setBoolean(StorageKeys.SYNC_IS_ENABLED, false);
        this.client.setDeviceToken(undefined);
        MalAuthService.handleSyncScopeChanged();
        MalSyncService.handleSyncScopeChanged();
        this.isSyncing = false;
        this.lastError = syncRes.error || 'Autenticazione fallita';
        this.notify();
        return { ok: false, message: this.lastError };
      }

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

  async disconnect(): Promise<void> {
    try {
      this.ensureClientConfigured();
      if (this.client.getDeviceToken()) {
        await this.client.logout();
      }
    } catch {
      // Invalida credenziali locali anche se offline o token già revocato
    } finally {
      const disconnectingProfileId = AppStorage.getString(StorageKeys.SYNC_PROFILE_ID)?.trim();
      if (disconnectingProfileId) {
        clearSyncedMalProfileData(disconnectingProfileId);
      }
      this.cancelAutoSync();
      this.stopPeriodicSync();
      AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
      AppStorage.remove(StorageKeys.SYNC_DEVICE_ID);
      AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
      AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
      this.resetLastSyncTimestamp();
      AppStorage.clearKnownTombstones();
      AppStorage.remove(StorageKeys.SYNC_LAST_TIME);
      AppStorage.remove(StorageKeys.SYNC_IS_ENABLED);
      AppStorage.remove('sync.master_password');
      AppStorage.clearPendingSyncMutations();
      AppStorage.clearPendingSyncDeletions();

      this.client.setDeviceToken(undefined);
      this.lastError = null;
      this.isSyncing = false;
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();
      this.notify();
    }
  }

  // --------------------------------------------------------------------------
  // Profile Management
  // --------------------------------------------------------------------------

  async listProfiles(): Promise<ProfileItem[]> {
    if (!this.isConnected()) return [];
    this.ensureClientConfigured();
    return this.client.listProfiles();
  }

  /**
   * Retrieves profiles with automated retries and visual feedback.
   * In case of persistent failure, automatically logs out and signals the caller
   * to propose a re-login (QR or manual).
   */
  async listProfilesWithRetries(
    maxRetries = 2,
    onRetry?: (attempt: number, maxRetries: number, error: string) => void
  ): Promise<{
    ok: boolean;
    profiles: ProfileItem[];
    error?: string;
    wasLoggedOut?: boolean;
  }> {
    if (!this.isConnected()) {
      return { ok: false, profiles: [], error: 'KuroSync non collegato' };
    }

    this.ensureClientConfigured();

    let lastError = '';
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        if (onRetry) {
          onRetry(attempt, maxRetries, lastError);
        }
        this.lastError = `Tentativo ${attempt}/${maxRetries}: ${lastError}`;
        this.notify();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      try {
        const profiles = await this.client.listProfiles();
        this.lastError = null;
        this.notify();
        return { ok: true, profiles };
      } catch (err: any) {
        lastError = err?.message || 'Impossibile recuperare i profili';
        lastStatus = err?.status;
        if (isSyncAuthError(lastError, lastStatus)) {
          break;
        }
      }
    }

    if (isSyncAuthError(lastError, lastStatus)) {
      await this.disconnect();
      return {
        ok: false,
        profiles: [],
        error: lastError || 'Sessione o token KuroSync non autorizzati',
        wasLoggedOut: true,
      };
    }

    return {
      ok: false,
      profiles: [],
      error: lastError || 'Connessione a KuroSync fallita dopo diversi tentativi',
      wasLoggedOut: false,
    };
  }

  async switchProfile(profileId: string, profileName?: string): Promise<boolean> {
    if (!this.isConnected() || !profileId) return false;

    this.ensureClientConfigured();

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      this.cancelAutoSync();

      // Best-effort flush of pending changes for the previous profile before switching
      if (this.pendingPlaybackPayload) {
        this.commitPlaybackPayload();
      }
      const prevPendingDeletions = AppStorage.getPendingSyncDeletions();
      const prevPendingMutations = AppStorage.getPendingSyncMutations();
      if (prevPendingDeletions.length > 0 || Object.keys(prevPendingMutations).length > 0) {
        try {
          const prevSupportsMalAuth = AppStorage.getSyncServerSupportsMalAuth();
          const preSwitchPayload = sanitizePushPayload(
            {
              ...prevPendingMutations,
              deletions: prevPendingDeletions,
            },
            prevSupportsMalAuth
          );
          if (
            Array.isArray(prevPendingMutations.searchHistory) ||
            prevPendingDeletions.some((d) => d.type === 'search_history')
          ) {
            preSwitchPayload.searchHistory = AppStorage.getSearchHistory();
          }
          const hasPreSwitchData = Boolean(
            (preSwitchPayload.favorites && preSwitchPayload.favorites.length > 0) ||
              (preSwitchPayload.continueWatching && preSwitchPayload.continueWatching.length > 0) ||
              (preSwitchPayload.watchHistory && preSwitchPayload.watchHistory.length > 0) ||
              (preSwitchPayload.watchProgress && preSwitchPayload.watchProgress.length > 0) ||
              (preSwitchPayload.sharedSettings && Object.keys(preSwitchPayload.sharedSettings).length > 0) ||
              (preSwitchPayload.searchHistory && preSwitchPayload.searchHistory.length > 0) ||
              preSwitchPayload.malAuth ||
              (preSwitchPayload.deletions && preSwitchPayload.deletions.length > 0)
          );
          if (hasPreSwitchData) {
            await this.client.pushDelta(preSwitchPayload);
            AppStorage.removePendingSyncDeletions(preSwitchPayload.deletions || []);
            AppStorage.removePendingSyncMutations(preSwitchPayload);
          }
        } catch {
          // Non-blocking: continue switching profile safely
        }
      }

      // 1. Switch device binding on backend (POST /api/auth/switch-profile)
      const switchRes = await this.client.switchProfile(profileId);
      const activeName = profileName || switchRes.profile?.name || 'Profilo';

      // 2. Perform complete pull (since = 0) to load fresh state for the new profile
      // Safe order: pull BEFORE clearing/mutating local MMKV state so that network failures do not corrupt data
      const pullRes = await this.client.pullDelta(0);
      const serverSupportsMalAuth = Boolean(pullRes?.deltas && 'malAuth' in pullRes.deltas);
      AppStorage.setSyncServerSupportsMalAuth(serverSupportsMalAuth);

      const existingTargetMalAuth = serverSupportsMalAuth
        ? getMalAuthSyncRecordForScope(profileId)
        : undefined;

      // 3. Clear pending mutations, deletions and known tombstones from previous profile
      AppStorage.clearPendingSyncMutations();
      AppStorage.clearPendingSyncDeletions();
      AppStorage.clearKnownTombstones();
      if (Array.isArray(pullRes.tombstones) && pullRes.tombstones.length > 0) {
        AppStorage.recordKnownTombstones(pullRes.tombstones);
      }

      // 4. Update local MMKV storage profile binding
      AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, profileId);
      AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, activeName);

      // 5. Merge into an empty local state so only the new profile's items exist
      const emptyLocalState: LocalStorageState = {
        favorites: [],
        continueWatching: [],
        watchHistory: [],
        watchProgress: [],
        sharedSettings: {},
        searchHistory: [],
        ...(serverSupportsMalAuth ? { malAuth: existingTargetMalAuth } : {}),
      };
      const { state: mergedState } = mergeLocalAndRemote(emptyLocalState, pullRes);

      // 6. Save newly active profile's library to MMKV
      AppStorage.setObject(StorageKeys.FAVORITES, mergedState.favorites);
      AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, mergedState.continueWatching);
      AppStorage.setObject(StorageKeys.WATCH_HISTORY, mergedState.watchHistory.slice(0, 100));

      // Clear previous watch progress entries and save new ones
      const oldProgress = AppStorage.getAllWatchProgress();
      for (const op of oldProgress) {
        AppStorage.remove(`${StorageKeys.WATCH_PROGRESS_PREFIX}${op.animeId}.${op.episodeNumber}`);
      }
      for (const p of mergedState.watchProgress) {
        AppStorage.setObject(`${StorageKeys.WATCH_PROGRESS_PREFIX}${p.animeId}.${p.episodeNumber}`, p);
      }

      AppStorage.setObject(StorageKeys.SEARCH_HISTORY, mergedState.searchHistory.slice(0, 50));
      if (mergedState.sharedSettings && Object.keys(mergedState.sharedSettings).length > 0) {
        AppStorage.saveSettings(mergedState.sharedSettings);
      }
      if (serverSupportsMalAuth) {
        applyRemoteMalAuthRecordForScope(profileId, mergedState.malAuth ?? null, { notify: false });
      }

      this.setLastSyncTimestamp(pullRes.serverTime, profileId);
      AppStorage.setNumber(StorageKeys.SYNC_LAST_TIME, Date.now());
      AppStorage.notifyStorageChanged();
      MalAuthService.handleSyncScopeChanged();
      MalSyncService.handleSyncScopeChanged();

      this.isSyncing = false;
      this.notify();
      return true;
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Cambio profilo fallito';
      this.notify();
      return false;
    }
  }

  /**
   * Switches profile with automated retries and visual feedback.
   * In case of persistent failure, automatically logs out and signals caller
   * to propose a re-login (QR or manual).
   */
  async switchProfileWithRetries(
    profileId: string,
    profileName?: string,
    maxRetries = 2,
    onRetry?: (attempt: number, maxRetries: number, error: string) => void
  ): Promise<{
    ok: boolean;
    error?: string;
    wasLoggedOut?: boolean;
  }> {
    if (!this.isConnected() || !profileId) {
      return { ok: false, error: 'KuroSync non collegato o profilo non valido' };
    }

    let lastError = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        if (onRetry) {
          onRetry(attempt, maxRetries, lastError);
        }
        this.lastError = `Tentativo ${attempt}/${maxRetries}: ${lastError}`;
        this.notify();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const success = await this.switchProfile(profileId, profileName);
      if (success) {
        return { ok: true };
      }
      lastError = this.getStatus().lastError || 'Passaggio al profilo fallito';
    }

    // All retries failed -> auto-logout
    await this.disconnect();
    return {
      ok: false,
      error: lastError || 'Passaggio al profilo fallito dopo diversi tentativi',
      wasLoggedOut: true,
    };
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
          this.persistServerUrl(parsed.origin);
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

  async performFullSync(
    forcedSince?: number,
    allowNestedSync = false
  ): Promise<{
    ok: boolean;
    upserts: number;
    deletions: number;
    error?: string;
  }> {
    if (!this.isConnected()) {
      return { ok: false, upserts: 0, deletions: 0, error: 'KuroSync non collegato' };
    }

    this.ensureClientConfigured();

    if (this.isSyncing && !allowNestedSync) {
      return { ok: true, upserts: 0, deletions: 0 };
    }

    try {
      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      if (this.pendingPlaybackPayload) {
        this.commitPlaybackPayload();
      }

      const since =
        forcedSince !== undefined
          ? forcedSince
          : this.getLastSyncTimestamp();

      // 1. Pull deltas from server
      const remotePull = await this.client.pullDelta(since);
      const serverSupportsMalAuth = Boolean(remotePull?.deltas && 'malAuth' in remotePull.deltas);
      AppStorage.setSyncServerSupportsMalAuth(serverSupportsMalAuth);

      // Record incoming remote tombstones and prune superseded local mutations
      if (Array.isArray(remotePull.tombstones) && remotePull.tombstones.length > 0) {
        AppStorage.recordKnownTombstones(remotePull.tombstones);
        AppStorage.prunePendingMutationsAgainstTombstones(remotePull.tombstones);
      }

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

      const activeScopeId = getActiveMalProfileScope();
      const localMalAuth = serverSupportsMalAuth
        ? getMalAuthSyncRecordForScope(activeScopeId)
        : undefined;

      const localState: LocalStorageState = {
        favorites: AppStorage.getFavorites(),
        continueWatching: AppStorage.getContinueWatching(),
        watchHistory: AppStorage.getWatchHistory(),
        watchProgress: AppStorage.getAllWatchProgress(),
        sharedSettings,
        searchHistory: AppStorage.getSearchHistory(),
        ...(serverSupportsMalAuth ? { malAuth: localMalAuth } : {}),
      };

      // 3. Merge local and remote
      const pendingDeletionsBeforeMerge = AppStorage.getPendingSyncDeletions();
      const pendingMutationsBeforeMerge = AppStorage.getPendingSyncMutations();
      const knownTombstones = AppStorage.getKnownTombstones();

      const { state: mergedState, appliedDeletions, appliedUpserts } = mergeLocalAndRemote(
        localState,
        remotePull,
        pendingDeletionsBeforeMerge,
        pendingMutationsBeforeMerge,
        knownTombstones
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
        AppStorage.saveSettings(mergedState.sharedSettings, true);
      }
      if (serverSupportsMalAuth && activeScopeId !== 'local') {
        const malAuthChanged = applyRemoteMalAuthRecordForScope(
          activeScopeId,
          mergedState.malAuth ?? null,
          { notify: false }
        );
        if (malAuthChanged) {
          MalAuthService.handleSyncScopeChanged();
        }
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
        const shouldBootstrapPushMalAuth = Boolean(
          serverSupportsMalAuth &&
            mergedState.malAuth &&
            (!remotePull.deltas?.malAuth ||
              (mergedState.malAuth.updatedAt || 0) > (remotePull.deltas.malAuth.updatedAt || 0) ||
              Boolean(pendingMutations.malAuth))
        );
        pushPayload = sanitizePushPayload(
          {
            favorites: mergedState.favorites,
            continueWatching: mergedState.continueWatching,
            watchHistory: mergedState.watchHistory,
            watchProgress: mergedState.watchProgress,
            sharedSettings: mergedState.sharedSettings,
            searchHistory: mergedState.searchHistory,
            ...(shouldBootstrapPushMalAuth ? { malAuth: mergedState.malAuth } : {}),
            deletions: pendingDeletions,
          },
          serverSupportsMalAuth
        );
      } else if (hasPending) {
        const hasSearchChanges =
          Array.isArray(pendingMutations.searchHistory) ||
          pendingDeletions.some((d) => d.type === 'search_history');

        pushPayload = sanitizePushPayload(
          {
            ...pendingMutations,
            deletions: pendingDeletions,
          },
          serverSupportsMalAuth
        );
        if (hasSearchChanges) {
          pushPayload.searchHistory = mergedState.searchHistory;
        }
      } else {
        pushPayload = {};
      }

      const hasSanitizedPushData = Boolean(
        (pushPayload.favorites && pushPayload.favorites.length > 0) ||
          (pushPayload.continueWatching && pushPayload.continueWatching.length > 0) ||
          (pushPayload.watchHistory && pushPayload.watchHistory.length > 0) ||
          (pushPayload.watchProgress && pushPayload.watchProgress.length > 0) ||
          (pushPayload.sharedSettings && Object.keys(pushPayload.sharedSettings).length > 0) ||
          (pushPayload.searchHistory && pushPayload.searchHistory.length > 0) ||
          pushPayload.malAuth ||
          (pushPayload.deletions && pushPayload.deletions.length > 0)
      );

      let newServerTime = remotePull.serverTime;
      if (since === 0 || hasSanitizedPushData) {
        const pushRes = await this.client.pushDelta(pushPayload);
        if (pushRes.serverTime) {
          newServerTime = pushRes.serverTime;
        }
        AppStorage.removePendingSyncDeletions(pushPayload.deletions || []);
        AppStorage.removePendingSyncMutations(pushPayload);
      }

      this.setLastSyncTimestamp(newServerTime);
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
      const status = err?.status;
      return { ok: false, upserts: 0, deletions: 0, error: this.lastError || undefined, status } as any;
    }
  }

  /**
   * Performs full synchronization with retries and visual feedback.
   * In case of persistent failure, automatically logs out and signals caller
   * to propose a re-login (QR or manual).
   */
  async performFullSyncWithRetries(
    maxRetries = 2,
    onRetry?: (attempt: number, maxRetries: number, error: string) => void
  ): Promise<{
    ok: boolean;
    upserts: number;
    deletions: number;
    error?: string;
    wasLoggedOut?: boolean;
  }> {
    if (!this.isConnected()) {
      return { ok: false, upserts: 0, deletions: 0, error: 'KuroSync non collegato' };
    }

    let syncRes = await this.performFullSync();
    if (syncRes.ok) {
      return syncRes;
    }

    let lastError = syncRes.error || 'Errore di sincronizzazione';
    let lastStatus: number | undefined = (syncRes as any).status;

    // If initial sync failed due to authentication / revoked token, disconnect immediately without useless retries
    if (isSyncAuthError(lastError, lastStatus)) {
      await this.disconnect();
      return {
        ok: false,
        upserts: 0,
        deletions: 0,
        error: lastError,
        wasLoggedOut: true,
      };
    }

    // If initial sync failed due to network / transient error, retry up to maxRetries times with visual feedback and delay
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (onRetry) {
        onRetry(attempt, maxRetries, lastError);
      }
      this.lastError = `Tentativo ${attempt}/${maxRetries}: ${lastError}`;
      this.notify();

      // Short delay between retries for network / server settling
      await new Promise((resolve) => setTimeout(resolve, 1200));

      syncRes = await this.performFullSync();
      if (syncRes.ok) {
        return syncRes;
      }
      lastError = syncRes.error || lastError;
      lastStatus = (syncRes as any).status;

      if (isSyncAuthError(lastError, lastStatus)) {
        await this.disconnect();
        return {
          ok: false,
          upserts: 0,
          deletions: 0,
          error: lastError,
          wasLoggedOut: true,
        };
      }
    }

    // After all retries failed due to network / offline / 500 error, preserve local credentials and token!
    return {
      ok: false,
      upserts: 0,
      deletions: 0,
      error: lastError || 'Impossibile connettersi a KuroSync dopo diversi tentativi',
      wasLoggedOut: false,
    };
  }

  private lastPullDeltaTime = 0;

  async pullDelta(): Promise<{ ok: boolean; upserts: number; deletions: number; error?: string }> {
    this.lastPullDeltaTime = Date.now();
    return this.performFullSync();
  }

  async pullDeltaIfNeeded(
    minIntervalMs = 15000
  ): Promise<{ ok: boolean; upserts: number; deletions: number; error?: string }> {
    if (!this.isConnected()) {
      return { ok: false, upserts: 0, deletions: 0, error: 'Non collegato' };
    }
    const now = Date.now();
    if (now - this.lastPullDeltaTime < minIntervalMs) {
      return { ok: true, upserts: 0, deletions: 0 };
    }
    return this.pullDelta();
  }

  private commitPlaybackPayload(): void {
    if (!this.pendingPlaybackPayload) return;

    const p = this.pendingPlaybackPayload;
    this.pendingPlaybackPayload = null;
    this.lastPlaybackPushTime = Date.now();
    this.lastPlaybackPos = p.currentTime;

    const now = Date.now();
    const isCompleted = Boolean(
      p.isCompleted || (p.duration > 0 && p.currentTime / p.duration >= 0.9)
    );
    const percentage =
      p.duration > 0 ? Math.min(100, Math.round((p.currentTime / p.duration) * 100)) : 0;

    const watchProgressItem: WatchProgressItem = {
      animeId: p.animeId,
      animeTitle: p.animeTitle || p.title || 'Anime',
      thumbnail: p.thumbnail || '',
      episodeId: p.episodeId || '',
      episodeNumber: p.episodeNumber,
      totalEpisodes: p.totalEpisodes,
      currentTime: p.currentTime,
      duration: p.duration,
      percentage,
      isCompleted,
      updatedAt: now,
      dataId: p.dataId,
      serverId: p.serverId,
    };
    AppStorage.recordSyncMutation('watchProgress', watchProgressItem);

    const historyItem: WatchHistoryItem = {
      animeId: p.animeId,
      title: p.animeTitle || p.title || 'Anime',
      thumbnail: p.thumbnail || '',
      episodeId: p.episodeId || '',
      episodeNumber: p.episodeNumber,
      position: p.currentTime,
      duration: p.duration,
      progressPercent: percentage,
      isCompleted,
      updatedAt: now,
      dataId: p.dataId,
      serverId: p.serverId,
    };
    AppStorage.recordSyncMutation('watchHistory', historyItem);

    const isConcluded = Boolean(isCompleted && !p.nextEpisode && !p.isOngoing);
    if (isConcluded) {
      AppStorage.recordSyncDeletion('continue_watching', p.animeId);
    } else {
      const currentCw = AppStorage.getContinueWatching().find((c) => c.animeId === p.animeId);
      if (currentCw) {
        AppStorage.recordSyncMutation('continueWatching', currentCw);
      }
    }
  }

  async pushPending(force = false): Promise<{ ok: boolean; error?: string }> {
    this.cancelAutoSync();
    this.ensureClientConfigured();
    if (!this.isConnected()) return { ok: false, error: 'Non collegato' };
    if (this.isSyncing) return { ok: true };

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
      this.isSyncing = true;
      this.notify();

      const hasSearchChanges =
        Array.isArray(pendingMutations.searchHistory) ||
        pendingDeletions.some((d) => d.type === 'search_history');

      const serverSupportsMalAuth = AppStorage.getSyncServerSupportsMalAuth();
      const pushPayload: DeltaPushRequest = sanitizePushPayload(
        {
          ...pendingMutations,
          deletions: pendingDeletions,
        },
        serverSupportsMalAuth
      );

      if (hasSearchChanges) {
        pushPayload.searchHistory = AppStorage.getSearchHistory();
      }

      const hasSanitizedContent = Boolean(
        (pushPayload.favorites && pushPayload.favorites.length > 0) ||
          (pushPayload.continueWatching && pushPayload.continueWatching.length > 0) ||
          (pushPayload.watchHistory && pushPayload.watchHistory.length > 0) ||
          (pushPayload.watchProgress && pushPayload.watchProgress.length > 0) ||
          (pushPayload.sharedSettings && Object.keys(pushPayload.sharedSettings).length > 0) ||
          (pushPayload.searchHistory && pushPayload.searchHistory.length > 0) ||
          pushPayload.malAuth ||
          (pushPayload.deletions && pushPayload.deletions.length > 0)
      );

      if (!force && !hasSanitizedContent) {
        return { ok: true };
      }

      await this.client.pushDelta(pushPayload);

      AppStorage.removePendingSyncDeletions(pushPayload.deletions || []);
      AppStorage.removePendingSyncMutations(pushPayload);
      AppStorage.setNumber(StorageKeys.SYNC_LAST_TIME, Date.now());
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    } finally {
      this.isSyncing = false;
      this.notify();
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
