/**
 * KuroTV In-App OTA Updater Types & Contracts
 */

export interface ManifestApkEntry {
  url: string;
  sha256?: string;
  size?: number;
}

export interface SelectedApk {
  url: string;
  sha256?: string;
  size?: number;
  abi: string;
}

export interface UpdateManifest {
  version: string;
  versionCode: number;
  apkUrl: string;
  apks?: Record<string, ManifestApkEntry | string>;
  releaseNotes: string;
  sha256: string;
  mandatory: boolean;
  publishedAt: string;
}

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percentage: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  currentVersionCode: number;
  manifest?: UpdateManifest;
  selectedApk?: SelectedApk;
  error?: string;
}

export type UpdateModalStatus =
  | 'idle'
  | 'downloading'
  | 'downloaded'
  | 'error';
