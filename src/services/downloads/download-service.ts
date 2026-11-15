import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import { AppStorage } from '../storage';
import { AnimeWorldScraper, ProviderRegistry } from '../scraper';
import type { Episode } from '@/types';
import type {
  DownloadItem,
  DownloadSettings,
  DownloadedAnimeGroup,
  StorageUsageInfo,
  DownloadProgressListener,
  DownloadListListener,
  DownloadSettingsListener,
  DownloadStatus,
} from './types';

const STORAGE_KEY_CATALOG = 'kuro_downloads_catalog';
const STORAGE_KEY_SETTINGS = 'kuro_download_settings';

export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  customDirectoryUri: null,
  wifiOnly: true,
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function sanitizeFileName(name: string): string {
  let sanitized = (name || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  sanitized = sanitized.replace(/\.{2,}/g, '_');
  sanitized = sanitized.replace(/^\.+/, '');
  sanitized = sanitized.slice(0, 80);
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'unknown';
  }
  return sanitized;
}

class DownloadManager {
  private items: Map<string, DownloadItem> = new Map();
  private settings: DownloadSettings = { ...DEFAULT_DOWNLOAD_SETTINGS };

  private activeDownloadId: string | null = null;
  private activeResumable: FileSystem.DownloadResumable | null = null;
  private activeExecutionToken: symbol | null = null;
  private isProcessingQueue = false;
  private cancelledItems: WeakSet<DownloadItem> = new WeakSet();
  private pausedItems: WeakSet<DownloadItem> = new WeakSet();

  private progressListeners: Set<DownloadProgressListener> = new Set();
  private listListeners: Set<DownloadListListener> = new Set();
  private settingsListeners: Set<DownloadSettingsListener> = new Set();

  constructor() {
    this.loadSettings();
    this.loadCatalog();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadSettings(): void {
    const saved = AppStorage.getObject<DownloadSettings>(STORAGE_KEY_SETTINGS);
    if (saved) {
      this.settings = { ...DEFAULT_DOWNLOAD_SETTINGS, ...saved };
    }
  }

  private saveSettings(): void {
    AppStorage.setObject(STORAGE_KEY_SETTINGS, this.settings);
    this.notifySettingsListeners();
  }

  private loadCatalog(): void {
    const saved = AppStorage.getObject<DownloadItem[]>(STORAGE_KEY_CATALOG);
    if (Array.isArray(saved)) {
      this.items.clear();
      for (const item of saved) {
        // If app crashed while downloading, revert status to queued or paused
        if (item.status === 'downloading') {
          item.status = 'paused';
        }
        this.items.set(item.id, item);
      }
    }
  }

  private saveCatalog(): void {
    const list = Array.from(this.items.values());
    AppStorage.setObject(STORAGE_KEY_CATALOG, list);
    this.notifyListListeners();
  }

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------

  public addProgressListener(listener: DownloadProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  public addListListener(listener: DownloadListListener): () => void {
    this.listListeners.add(listener);
    // Notify immediately with current snapshot
    listener(this.getAllDownloads());
    return () => this.listListeners.delete(listener);
  }

  public addSettingsListener(listener: DownloadSettingsListener): () => void {
    this.settingsListeners.add(listener);
    listener(this.getSettings());
    return () => this.settingsListeners.delete(listener);
  }

  private notifyProgressListeners(item: DownloadItem): void {
    for (const listener of this.progressListeners) {
      try {
        listener(item);
      } catch {
        // Ignore listener failures
      }
    }
  }

  private notifyListListeners(): void {
    const list = this.getAllDownloads();
    for (const listener of this.listListeners) {
      try {
        listener(list);
      } catch {
        // Ignore listener failures
      }
    }
  }

  private notifySettingsListeners(): void {
    const s = this.getSettings();
    for (const listener of this.settingsListeners) {
      try {
        listener(s);
      } catch {
        // Ignore listener failures
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Getters & Settings
  // ---------------------------------------------------------------------------

  public getSettings(): DownloadSettings {
    return { ...this.settings };
  }

  public setWifiOnly(wifiOnly: boolean): void {
    this.settings.wifiOnly = wifiOnly;
    this.saveSettings();
    if (!wifiOnly) {
      this.processQueue().catch(() => {});
    }
  }

  public setCustomDirectoryUri(uri: string | null): void {
    this.settings.customDirectoryUri = uri;
    this.saveSettings();
  }

  public async requestCustomDirectoryPermissions(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    try {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        this.setCustomDirectoryUri(permissions.directoryUri);
        return permissions.directoryUri;
      }
      return null;
    } catch (err) {
      console.warn('[DownloadService] SAF directory request error:', err);
      return null;
    }
  }

  public getBaseDownloadDirectory(): string {
    const docDir = FileSystem.documentDirectory || '';
    return `${docDir}downloads/`;
  }

  public getAnimeDirectory(animeId: string): string {
    const safeId = sanitizeFileName(animeId);
    return `${this.getBaseDownloadDirectory()}${safeId}/`;
  }

  public getDownloadFileUri(animeId: string, episodeNumber: number): string {
    return `${this.getAnimeDirectory(animeId)}ep_${episodeNumber}.mp4`;
  }

  public getAllDownloads(): DownloadItem[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getDownloadItem(id: string): DownloadItem | undefined {
    return this.items.get(id);
  }

  public isEpisodeDownloaded(animeId: string, episodeNumber: number): boolean {
    const id = `${animeId}-ep-${episodeNumber}`;
    const item = this.items.get(id);
    return item?.status === 'completed';
  }

  public getEpisodeDownloadStatus(
    animeId: string,
    episodeNumber: number
  ): DownloadStatus | 'none' {
    const id = `${animeId}-ep-${episodeNumber}`;
    const item = this.items.get(id);
    return item ? item.status : 'none';
  }

  public getDownloadedEpisodeUri(
    animeId: string,
    episodeNumber: number
  ): string | null {
    const id = `${animeId}-ep-${episodeNumber}`;
    const item = this.items.get(id);
    if (item && item.status === 'completed' && item.fileUri) {
      return item.fileUri;
    }
    return null;
  }

  /**
   * Resolves a verified local file URI that actually exists on disk with a valid non-trivial size.
   * Handles Expo Go sandbox container shifts and double-encoded URL param paths cleanly.
   */
  public async resolvePlayableLocalUri(
    animeId: string,
    episodeNumber: number,
    fallbackUri?: string
  ): Promise<string | null> {
    const id = `${animeId}-ep-${episodeNumber}`;
    const item = animeId ? this.items.get(id) : undefined;

    const candidates: string[] = [];
    const pushUnique = (uri?: string | null) => {
      if (uri && typeof uri === 'string' && !candidates.includes(uri)) {
        candidates.push(uri);
      }
    };

    if (item && item.status === 'completed') {
      pushUnique(item.fileUri);
    }

    if (animeId && Number.isFinite(episodeNumber) && episodeNumber > 0) {
      pushUnique(this.getDownloadFileUri(animeId, episodeNumber));
    }

    if (fallbackUri) {
      pushUnique(fallbackUri);
      // Expo Router URL params may decode %2540 -> %40 inside Expo Go documentDirectory paths
      if (fallbackUri.includes('/%40') && FileSystem.documentDirectory?.includes('%2540')) {
        pushUnique(fallbackUri.replace('/%40', '/%2540'));
      }
    }

    for (const candidate of candidates) {
      try {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info.exists && (info.size === undefined || info.size > 16384)) {
          if (item && item.status === 'completed' && item.fileUri !== candidate) {
            item.fileUri = candidate;
            this.saveCatalog();
          }
          return candidate;
        }
      } catch {
        // Ignore invalid or inaccessible candidate URI and check next
      }
    }

    return null;
  }

  public getDownloadedAnimeList(): DownloadedAnimeGroup[] {
    const groupsMap = new Map<string, DownloadedAnimeGroup>();

    for (const item of this.items.values()) {
      if (item.status !== 'completed') continue;

      let group = groupsMap.get(item.animeId);
      if (!group) {
        group = {
          animeId: item.animeId,
          animeTitle: item.animeTitle,
          animeThumbnail: item.animeThumbnail,
          episodesCount: 0,
          totalBytes: 0,
          episodes: [],
          lastDownloadedAt: 0,
        };
        groupsMap.set(item.animeId, group);
      }

      group.episodesCount += 1;
      group.totalBytes += item.totalBytes || item.downloadedBytes || 0;
      group.episodes.push(item);
      if (item.completedAt && item.completedAt > group.lastDownloadedAt) {
        group.lastDownloadedAt = item.completedAt;
      }
    }

    // Sort episodes within each group ascending by episode number
    for (const group of groupsMap.values()) {
      group.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    }

    // Sort groups descending by most recent download
    return Array.from(groupsMap.values()).sort(
      (a, b) => b.lastDownloadedAt - a.lastDownloadedAt
    );
  }

  public getActiveDownloadsCount(): number {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.status === 'downloading' || item.status === 'queued') {
        count++;
      }
    }
    return count;
  }

  public async getStorageUsage(): Promise<StorageUsageInfo> {
    let appDownloadsBytes = 0;
    for (const item of this.items.values()) {
      if (item.status === 'completed') {
        appDownloadsBytes += item.totalBytes || item.downloadedBytes || 0;
      }
    }

    let freeDiskBytes: number | undefined = undefined;
    try {
      if (FileSystem.documentDirectory) {
        const free = await FileSystem.getFreeDiskStorageAsync();
        if (typeof free === 'number' && !isNaN(free)) {
          freeDiskBytes = free;
        }
      }
    } catch {
      // Free storage lookup may not be supported on all environments
    }

    return {
      appDownloadsBytes,
      appDownloadsFormatted: formatBytes(appDownloadsBytes),
      freeDiskBytes,
      freeDiskFormatted: freeDiskBytes !== undefined ? formatBytes(freeDiskBytes) : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Download Actions
  // ---------------------------------------------------------------------------

  public async startDownload(
    anime: { id: string; title: string; thumbnail?: string },
    episode: Episode,
    preferredServerId = '9'
  ): Promise<DownloadItem> {
    const id = `${anime.id}-ep-${episode.number}`;
    const existing = this.items.get(id);

    if (existing && existing.status === 'completed') {
      return existing;
    }

    const fileUri = this.getDownloadFileUri(anime.id, episode.number);

    const item: DownloadItem = {
      id,
      animeId: anime.id,
      animeTitle: anime.title,
      animeThumbnail: anime.thumbnail || '',
      episodeNumber: episode.number,
      episodeTitle: episode.title || `Episodio ${episode.number}`,
      fileUri,
      remoteUrl: (episode as any).remoteUrl || '',
      format: 'mp4',
      totalBytes: 0,
      downloadedBytes: 0,
      progress: 0,
      status: 'queued',
      createdAt: Date.now(),
    };

    this.items.set(id, item);
    this.saveCatalog();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Kick off queue processing
    this.processQueue().catch((err) => {
      console.warn('[DownloadService] processQueue error:', err);
    });

    return item;
  }

  public async startBatchDownload(
    anime: { id: string; title: string; thumbnail?: string },
    episodes: Episode[],
    preferredServerId = '9'
  ): Promise<number> {
    let queuedCount = 0;

    for (const ep of episodes) {
      const id = `${anime.id}-ep-${ep.number}`;
      const existing = this.items.get(id);
      if (existing && (existing.status === 'completed' || existing.status === 'downloading' || existing.status === 'queued')) {
        continue;
      }

      const fileUri = this.getDownloadFileUri(anime.id, ep.number);
      const item: DownloadItem = {
        id,
        animeId: anime.id,
        animeTitle: anime.title,
        animeThumbnail: anime.thumbnail || '',
        episodeNumber: ep.number,
        episodeTitle: ep.title || `Episodio ${ep.number}`,
        fileUri,
        remoteUrl: (ep as any).remoteUrl || '',
        format: 'mp4',
        totalBytes: 0,
        downloadedBytes: 0,
        progress: 0,
        status: 'queued',
        createdAt: Date.now() + queuedCount,
      };

      this.items.set(id, item);
      queuedCount++;
    }

    if (queuedCount > 0) {
      this.saveCatalog();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      this.processQueue().catch((err) => {
        console.warn('[DownloadService] processQueue error:', err);
      });
    }

    return queuedCount;
  }

  public async pauseDownload(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    this.pausedItems.add(item);
    item.status = 'paused';
    item.error = undefined;

    const resumableToPause = this.activeDownloadId === id ? this.activeResumable : null;
    if (this.activeDownloadId === id) {
      this.activeDownloadId = null;
      this.activeResumable = null;
      this.activeExecutionToken = null;
    }

    this.saveCatalog();
    this.notifyProgressListeners(item);

    if (resumableToPause) {
      try {
        const snapshot = await resumableToPause.pauseAsync();
        if (snapshot) {
          item.resumableState = JSON.stringify(snapshot);
          this.saveCatalog();
        }
      } catch {
        // Ignore expected pause/abort noise when native request is already settling
      }
    }

    // Process next item in queue
    this.processQueue().catch(() => {});
  }

  public async resumeDownload(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item || item.status === 'completed') return;

    this.pausedItems.delete(item);
    this.cancelledItems.delete(item);
    item.status = 'queued';
    item.error = undefined;
    this.saveCatalog();
    this.notifyProgressListeners(item);

    this.processQueue().catch(() => {});
  }

  public async cancelDownload(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    this.cancelledItems.add(item);

    const resumableToStop = this.activeDownloadId === id ? this.activeResumable : null;
    if (this.activeDownloadId === id) {
      this.activeDownloadId = null;
      this.activeResumable = null;
      this.activeExecutionToken = null;
    }

    this.items.delete(id);
    this.saveCatalog();

    if (resumableToStop) {
      try {
        await resumableToStop.pauseAsync();
      } catch {
        // ignore
      }
    }

    // Remove partially downloaded file
    try {
      const info = await FileSystem.getInfoAsync(item.fileUri);
      if (info.exists) {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
      }
    } catch {
      // ignore
    }

    this.processQueue().catch(() => {});
  }

  /**
   * Cancels all active, queued, paused, or errored downloads for a given anime
   * without touching any already-completed episodes on disk.
   */
  public async cancelAnimeDownloads(animeId: string): Promise<number> {
    const itemsToCancel = Array.from(this.items.values()).filter(
      (item) => item.animeId === animeId && item.status !== 'completed'
    );
    if (itemsToCancel.length === 0) return 0;

    let resumableToStop: FileSystem.DownloadResumable | null = null;
    for (const item of itemsToCancel) {
      this.cancelledItems.add(item);
      this.pausedItems.delete(item);
      if (this.activeDownloadId === item.id) {
        resumableToStop = this.activeResumable;
        this.activeDownloadId = null;
        this.activeResumable = null;
        this.activeExecutionToken = null;
      }
      this.items.delete(item.id);
    }

    this.saveCatalog();

    if (resumableToStop) {
      try {
        await resumableToStop.pauseAsync();
      } catch {
        // Ignore expected pause/abort noise when native request is already settling
      }
    }

    for (const item of itemsToCancel) {
      try {
        const info = await FileSystem.getInfoAsync(item.fileUri);
        if (info.exists) {
          await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
        }
      } catch {
        // ignore
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    this.processQueue().catch(() => {});

    return itemsToCancel.length;
  }

  public async deleteDownload(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    this.cancelledItems.add(item);

    const resumableToStop = this.activeDownloadId === id ? this.activeResumable : null;
    if (this.activeDownloadId === id) {
      this.activeDownloadId = null;
      this.activeResumable = null;
      this.activeExecutionToken = null;
    }

    this.items.delete(id);
    this.saveCatalog();

    if (resumableToStop) {
      try {
        await resumableToStop.pauseAsync();
      } catch {
        // ignore
      }
    }

    try {
      const info = await FileSystem.getInfoAsync(item.fileUri);
      if (info.exists) {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
      }
    } catch (err) {
      console.warn('[DownloadService] Error deleting file:', err);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  public async deleteAnimeDownloads(animeId: string): Promise<void> {
    const itemsToDelete = Array.from(this.items.values()).filter(
      (item) => item.animeId === animeId
    );

    let resumableToStop: FileSystem.DownloadResumable | null = null;
    for (const item of itemsToDelete) {
      this.cancelledItems.add(item);
      if (this.activeDownloadId === item.id) {
        resumableToStop = this.activeResumable;
        this.activeDownloadId = null;
        this.activeResumable = null;
        this.activeExecutionToken = null;
      }
      this.items.delete(item.id);
    }

    this.saveCatalog();

    if (resumableToStop) {
      try {
        await resumableToStop.pauseAsync();
      } catch {}
    }

    try {
      const animeDir = this.getAnimeDirectory(animeId);
      const info = await FileSystem.getInfoAsync(animeDir);
      if (info.exists) {
        await FileSystem.deleteAsync(animeDir, { idempotent: true });
      }
    } catch (err) {
      console.warn('[DownloadService] Error deleting anime directory:', err);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  public async clearAllDownloads(): Promise<void> {
    const resumableToStop = this.activeResumable;
    for (const item of this.items.values()) {
      this.cancelledItems.add(item);
    }
    this.activeDownloadId = null;
    this.activeResumable = null;
    this.activeExecutionToken = null;

    this.items.clear();
    this.saveCatalog();

    if (resumableToStop) {
      try {
        await resumableToStop.pauseAsync();
      } catch {}
    }

    try {
      const baseDir = this.getBaseDownloadDirectory();
      const info = await FileSystem.getInfoAsync(baseDir);
      if (info.exists) {
        await FileSystem.deleteAsync(baseDir, { idempotent: true });
      }
    } catch (err) {
      console.warn('[DownloadService] Error clearing all downloads directory:', err);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Queue Processor
  // ---------------------------------------------------------------------------

  private async canDownloadOnCurrentNetwork(): Promise<boolean> {
    if (!this.settings.wifiOnly) return true;

    try {
      const state = await Network.getNetworkStateAsync();
      if (!state.isConnected) return false;
      if (state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[DownloadService] Network state check error:', err);
      // Fallback: allow download if check fails
      return true;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    if (this.activeDownloadId) return;

    this.isProcessingQueue = true;

    try {
      // Find the next queued item
      const queuedItem = Array.from(this.items.values()).find(
        (item) => item.status === 'queued'
      );

      if (!queuedItem) {
        this.isProcessingQueue = false;
        return;
      }

      // Check Wi-Fi constraint
      const networkAllowed = await this.canDownloadOnCurrentNetwork();
      if (!networkAllowed) {
        queuedItem.error = 'IN ATTESA DI RETE WI-FI';
        this.saveCatalog();
        this.notifyProgressListeners(queuedItem);
        this.isProcessingQueue = false;
        return;
      }

      // Start downloading this item
      await this.executeDownload(queuedItem);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private hasQueuedDownloads(): boolean {
    for (const item of this.items.values()) {
      if (item.status === 'queued') return true;
    }
    return false;
  }

  private async executeDownload(item: DownloadItem): Promise<void> {
    const runToken = Symbol(item.id);
    this.activeDownloadId = item.id;
    this.activeExecutionToken = runToken;

    const wasCancelled = (): boolean =>
      this.cancelledItems.has(item) ||
      this.items.get(item.id) !== item;

    const wasPaused = (): boolean =>
      this.pausedItems.has(item) || item.status === 'paused';

    const wasIntentionallyInterrupted = (): boolean =>
      wasCancelled() || wasPaused() || this.activeExecutionToken !== runToken;

    item.status = 'downloading';
    item.error = undefined;
    this.saveCatalog();
    this.notifyProgressListeners(item);

    let nextQueueDelayMs: number | null = null;

    try {
      // Ensure target directory exists
      const animeDir = this.getAnimeDirectory(item.animeId);
      await FileSystem.makeDirectoryAsync(animeDir, { intermediates: true });

      if (wasIntentionallyInterrupted()) return;

      // 1. Resolve direct video stream if not already resolved
      let directUrl = item.remoteUrl;
      let headers: Record<string, string> = {};

      if (!directUrl) {
        // Fetch anime detail to get server dataId for this episode
        const detail = await AnimeWorldScraper.getAnimeDetail(item.animeId);
        if (wasIntentionallyInterrupted()) return;

        const matchedEp = detail.episodes?.find((e) => e.number === item.episodeNumber);

        if (!matchedEp) {
          throw new Error('Episodio non trovato nel catalogo');
        }

        const source = await AnimeWorldScraper.resolveEpisodeVideo(matchedEp, '9');
        if (wasIntentionallyInterrupted()) return;

        let resolvedHeaders: Record<string, string> = {};
        let resolvedFormat: 'mp4' | 'hls' = 'mp4';

        if (source && source.url) {
          directUrl =
            source.qualities && source.qualities.length > 0
              ? source.qualities[0].url
              : source.url;
          resolvedHeaders = source.headers || {};
          resolvedFormat =
            source.format ||
            (directUrl.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
        } else {
          const fallbackSource = await ProviderRegistry.resolveVideoWithFallback(
            matchedEp,
            '9'
          );
          if (wasIntentionallyInterrupted()) return;
          if (!fallbackSource || !fallbackSource.url) {
            throw new Error('Sorgente video non disponibile per questo episodio');
          }
          directUrl = fallbackSource.url;
          resolvedHeaders = fallbackSource.headers || {};
          resolvedFormat = directUrl.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4';
        }

        const isHlsStream =
          resolvedFormat === 'hls' ||
          (typeof directUrl === 'string' && directUrl.toLowerCase().includes('.m3u8'));

        if (isHlsStream) {
          // Search for an alternate MP4 server so local .mp4 playback never saves a text .m3u8 playlist
          const altServers = (matchedEp.servers || []).filter(
            (s) => s.id !== (source?.serverId || '9')
          );
          let foundMp4Fallback = false;
          for (const alt of altServers) {
            const candidateEp = {
              ...matchedEp,
              dataId: alt.dataId || matchedEp.dataId,
            };
            const altSource = await AnimeWorldScraper.resolveEpisodeVideo(
              candidateEp,
              alt.id
            );
            if (wasIntentionallyInterrupted()) return;
            const altUrl = altSource?.qualities?.[0]?.url || altSource?.url || '';
            if (
              altSource &&
              altUrl &&
              altSource.format !== 'hls' &&
              !altUrl.toLowerCase().includes('.m3u8')
            ) {
              directUrl = altUrl;
              resolvedHeaders = altSource.headers || {};
              resolvedFormat = altSource.format || 'mp4';
              foundMp4Fallback = true;
              break;
            }
          }

          if (!foundMp4Fallback) {
            throw new Error('Streaming HLS (.m3u8) non compatibile con il salvataggio MP4');
          }
        }

        item.remoteUrl = directUrl;
        item.format = resolvedFormat;
        headers = resolvedHeaders;
      }

      if (wasIntentionallyInterrupted()) return;

      // 2. Create DownloadResumable
      const downloadCallback = (progressData: FileSystem.DownloadProgressData) => {
        if (wasIntentionallyInterrupted() || this.activeDownloadId !== item.id) return;

        const total = progressData.totalBytesExpectedToWrite;
        const written = progressData.totalBytesWritten;
        const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((written / total) * 100))) : 0;

        item.downloadedBytes = written;
        if (total > 0) {
          item.totalBytes = total;
        }
        item.progress = pct;

        this.notifyProgressListeners(item);
      };

      const downloadResumable = FileSystem.createDownloadResumable(
        directUrl,
        item.fileUri,
        { headers },
        downloadCallback
      );

      this.activeResumable = downloadResumable;

      const result = await downloadResumable.downloadAsync();

      // If cancelled or paused intentionally (e.g. via pauseAsync()), exit cleanly without warnings
      if (wasIntentionallyInterrupted()) {
        if (wasCancelled()) {
          try {
            const partialInfo = await FileSystem.getInfoAsync(item.fileUri);
            if (partialInfo.exists) {
              await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
            }
          } catch {}
        }
        if (this.hasQueuedDownloads()) {
          nextQueueDelayMs = 250;
        }
        return;
      }

      if (!result || !result.uri) {
        throw new Error('Download interrotto o non completato');
      }

      if (typeof result.status === 'number' && (result.status < 200 || result.status >= 400)) {
        try {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch {}
        throw new Error(`Errore server download (HTTP ${result.status})`);
      }

      // Verify file size and completion
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (wasIntentionallyInterrupted()) {
        if (wasCancelled()) {
          try {
            await FileSystem.deleteAsync(result.uri, { idempotent: true });
          } catch {}
        }
        if (this.hasQueuedDownloads()) {
          nextQueueDelayMs = 250;
        }
        return;
      }

      if (!fileInfo.exists) {
        throw new Error('File salvato non trovato');
      }

      if (typeof fileInfo.size === 'number' && fileInfo.size < 16384) {
        try {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch {}
        throw new Error('File video scaricato non valido o incompleto');
      }

      item.status = 'completed';
      item.progress = 100;
      item.downloadedBytes = fileInfo.size || item.totalBytes;
      item.totalBytes = fileInfo.size || item.totalBytes;
      item.completedAt = Date.now();
      item.error = undefined;
      item.resumableState = undefined;

      this.saveCatalog();
      this.notifyProgressListeners(item);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (this.hasQueuedDownloads()) {
        nextQueueDelayMs = 500;
      }
    } catch (err: any) {
      if (wasIntentionallyInterrupted()) {
        if (wasCancelled()) {
          try {
            const partialInfo = await FileSystem.getInfoAsync(item.fileUri);
            if (partialInfo.exists) {
              await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
            }
          } catch {}
        }
        if (this.hasQueuedDownloads()) {
          nextQueueDelayMs = 250;
        }
        return;
      }

      console.warn(`[DownloadService] Download failed for ${item.id}:`, err);

      // Only mark error if still downloading and not paused/cancelled
      if (item.status === 'downloading') {
        item.status = 'error';
        item.error = err?.message || 'Errore durante il download';
        this.saveCatalog();
        this.notifyProgressListeners(item);
      }

      if (this.hasQueuedDownloads()) {
        nextQueueDelayMs = 1500;
      }
    } finally {
      if (this.activeExecutionToken === runToken) {
        this.activeDownloadId = null;
        this.activeResumable = null;
        this.activeExecutionToken = null;
      }

      if (nextQueueDelayMs !== null) {
        setTimeout(() => {
          this.processQueue().catch(() => {});
        }, nextQueueDelayMs);
      }
    }
  }
}

export const DownloadService = new DownloadManager();
