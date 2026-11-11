export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadItem {
  id: string; // `${animeId}-ep-${episodeNumber}`
  animeId: string;
  animeTitle: string;
  animeThumbnail: string;
  episodeNumber: number;
  episodeTitle: string;
  fileUri: string; // Local destination URI (file://...)
  remoteUrl: string;
  format: 'mp4' | 'hls';
  totalBytes: number;
  downloadedBytes: number;
  progress: number; // 0 - 100
  status: DownloadStatus;
  error?: string;
  createdAt: number;
  completedAt?: number;
  resumableState?: string;
}

export interface DownloadSettings {
  customDirectoryUri: string | null; // null = use FileSystem.documentDirectory + 'downloads/'
  wifiOnly: boolean;                 // default true
}

export interface DownloadedAnimeGroup {
  animeId: string;
  animeTitle: string;
  animeThumbnail: string;
  episodesCount: number;
  totalBytes: number;
  episodes: DownloadItem[];
  lastDownloadedAt: number;
}

export interface StorageUsageInfo {
  appDownloadsBytes: number;
  appDownloadsFormatted: string;
  freeDiskBytes?: number;
  freeDiskFormatted?: string;
}

export type DownloadProgressListener = (item: DownloadItem) => void;
export type DownloadListListener = (items: DownloadItem[]) => void;
export type DownloadSettingsListener = (settings: DownloadSettings) => void;
