import axios from 'axios';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import { AppStorage } from '../storage';
import type {
  UpdateManifest,
  DownloadProgress,
  DownloadProgressCallback,
  UpdateCheckResult,
  SelectedApk,
  ManifestApkEntry,
} from './types';

export const DEFAULT_OTA_WORKER_URL =
  process.env.OTA_WORKER_URL ||
  process.env.EXPO_PUBLIC_OTA_WORKER_URL ||
  'https://kuro-tv.g4s01.workers.dev';
export const DEFAULT_MANIFEST_URL = `${DEFAULT_OTA_WORKER_URL.replace(/\/+$/, '')}/mobile/manifest.json`;
export const DEFAULT_OTA_TOKEN = '';

/**
 * Compare two pre-release segments according to SemVer 2.0.0 specification:
 * - Dot-separated identifiers
 * - Identifiers consisting only of digits are compared numerically
 * - Identifiers with letters are compared lexically
 * - Numeric identifiers have lower precedence than non-numeric
 */
function comparePreRelease(pre1: string, pre2: string): number {
  const parts1 = pre1.split('.');
  const parts2 = pre2.split('.');
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i];
    const p2 = parts2[i];
    if (p1 === undefined) return -1; // shorter pre-release is lower precedence
    if (p2 === undefined) return 1;

    const num1 = parseInt(p1, 10);
    const num2 = parseInt(p2, 10);
    const isNum1 = !isNaN(num1) && String(num1) === p1;
    const isNum2 = !isNaN(num2) && String(num2) === p2;

    if (isNum1 && isNum2) {
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    } else if (isNum1 && !isNum2) {
      return -1; // numeric has lower precedence than non-numeric
    } else if (!isNum1 && isNum2) {
      return 1;
    } else {
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
  }

  return 0;
}

/**
 * Compare two semantic version strings (e.g. "1.0.0" and "1.1.0").
 * Strips build metadata (+...) and complies with SemVer 2.0.0.
 * Returns:
 *  1 if v1 > v2
 *  0 if v1 === v2
 * -1 if v1 < v2
 */
export function compareSemver(v1: string, v2: string): number {
  const cleanV1 = v1.trim().replace(/^[vV]/, '');
  const cleanV2 = v2.trim().replace(/^[vV]/, '');

  // Strip build metadata (+...) before comparing precedence
  const withoutMeta1 = cleanV1.split('+')[0] ?? '';
  const withoutMeta2 = cleanV2.split('+')[0] ?? '';

  const [main1, pre1] = withoutMeta1.split('-');
  const [main2, pre2] = withoutMeta2.split('-');

  const parts1 = (main1 || '').split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = (main2 || '').split('.').map((p) => parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  // Pre-release versions have lower precedence than normal releases (Semver 2.0.0)
  if (!pre1 && pre2) return 1; // v1 has no pre-release (higher)
  if (pre1 && !pre2) return -1; // v1 has pre-release (lower)
  if (pre1 && pre2) {
    return comparePreRelease(pre1, pre2);
  }

  return 0;
}

/**
 * Determine if an update is available based on versionCode and semver.
 */
export function isUpdateAvailable(
  currentVersion: string,
  currentVersionCode: number,
  manifest: UpdateManifest
): boolean {
  if (manifest.versionCode > 0 && currentVersionCode > 0) {
    if (manifest.versionCode > currentVersionCode) return true;
    if (manifest.versionCode < currentVersionCode) return false;
    // Equal versionCode, fallback to semver check
    return compareSemver(manifest.version, currentVersion) > 0;
  }
  return compareSemver(manifest.version, currentVersion) > 0;
}

/**
 * Validate and sanitize update manifest payload.
 */
export function validateManifest(data: unknown): UpdateManifest | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const raw = data as Record<string, unknown>;

  if (typeof raw.version !== 'string' || !raw.version.trim()) {
    return null;
  }

  const rawCode =
    typeof raw.versionCode === 'number'
      ? raw.versionCode
      : parseInt(String(raw.versionCode || '0'), 10);

  const versionCode = Math.floor(rawCode);
  if (isNaN(versionCode) || versionCode < 1) {
    return null;
  }

  const apkUrl = typeof raw.apkUrl === 'string' ? raw.apkUrl.trim() : '';
  if (
    !apkUrl ||
    (!apkUrl.startsWith('http://') &&
      !apkUrl.startsWith('https://') &&
      !apkUrl.startsWith('file://'))
  ) {
    return null;
  }

  let apks: Record<string, ManifestApkEntry | string> | undefined = undefined;
  if (raw.apks && typeof raw.apks === 'object' && !Array.isArray(raw.apks)) {
    const sanitizedApks: Record<string, ManifestApkEntry | string> = {};
    for (const [key, val] of Object.entries(raw.apks as Record<string, unknown>)) {
      if (!val) continue;
      const normalizedKey = key.trim().toLowerCase();
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (
          trimmed.startsWith('http://') ||
          trimmed.startsWith('https://') ||
          trimmed.startsWith('file://')
        ) {
          sanitizedApks[normalizedKey] = trimmed;
        }
      } else if (typeof val === 'object' && val !== null) {
        const entryObj = val as Record<string, unknown>;
        if (typeof entryObj.url === 'string') {
          const trimmedUrl = entryObj.url.trim();
          if (
            trimmedUrl.startsWith('http://') ||
            trimmedUrl.startsWith('https://') ||
            trimmedUrl.startsWith('file://')
          ) {
            sanitizedApks[normalizedKey] = {
              url: trimmedUrl,
              sha256: typeof entryObj.sha256 === 'string' ? entryObj.sha256.trim() : undefined,
              size:
                typeof entryObj.size === 'number' && entryObj.size > 0
                  ? entryObj.size
                  : undefined,
            };
          }
        }
      }
    }
    if (Object.keys(sanitizedApks).length > 0) {
      apks = sanitizedApks;
    }
  }

  return {
    version: raw.version.trim(),
    versionCode,
    apkUrl,
    apks,
    releaseNotes: typeof raw.releaseNotes === 'string' ? raw.releaseNotes.trim() : '',
    sha256: typeof raw.sha256 === 'string' ? raw.sha256.trim() : '',
    mandatory: Boolean(raw.mandatory),
    publishedAt:
      typeof raw.publishedAt === 'string' && raw.publishedAt.trim()
        ? raw.publishedAt.trim()
        : new Date().toISOString(),
  };
}

/**
 * Detect CPU architectures supported by the current device in preference order.
 * - Primary: Native KuroDeviceModule exposing Build.SUPPORTED_ABIS
 * - Secondary: Platform.constants (supportedAbis, SUPPORTED_ABIS, or architecture heuristics)
 * - Fallback: process.env.TEST_DEVICE_ABI for testing or empty list (falls back to universal)
 */
export function getDeviceSupportedAbis(): string[] {
  // 1. KuroDeviceModule native module
  try {
    const kuroDevice = NativeModules?.KuroDeviceModule;
    if (kuroDevice) {
      if (Array.isArray(kuroDevice.supportedAbis) && kuroDevice.supportedAbis.length > 0) {
        return kuroDevice.supportedAbis.map((a: string) => String(a).trim().toLowerCase());
      }
      const constants =
        typeof kuroDevice.getConstants === 'function' ? kuroDevice.getConstants() : null;
      if (
        constants &&
        Array.isArray(constants.supportedAbis) &&
        constants.supportedAbis.length > 0
      ) {
        return constants.supportedAbis.map((a: string) => String(a).trim().toLowerCase());
      }
    }
  } catch (err) {
    console.warn('[UpdaterService] KuroDeviceModule read error:', err);
  }

  // 2. Platform.constants (Android engine / properties)
  try {
    const pc = (Platform.constants || {}) as Record<string, any>;
    if (Array.isArray(pc.supportedAbis) && pc.supportedAbis.length > 0) {
      return pc.supportedAbis.map((a: string) => String(a).trim().toLowerCase());
    }
    if (Array.isArray(pc.SUPPORTED_ABIS) && pc.SUPPORTED_ABIS.length > 0) {
      return pc.SUPPORTED_ABIS.map((a: string) => String(a).trim().toLowerCase());
    }
    const arch = String(pc.cpuArchitecture || pc.arch || '').trim().toLowerCase();
    if (arch === 'arm64' || arch === 'aarch64') {
      return ['arm64-v8a', 'armeabi-v7a'];
    }
    if (arch === 'arm' || arch === 'armeabi' || arch === 'armv7' || arch === 'armv7l') {
      return ['armeabi-v7a'];
    }
    if (arch === 'x86_64' || arch === 'x64' || arch === 'amd64') {
      return ['x86_64'];
    }
    const fp = String(pc.Fingerprint || pc.Model || '').toLowerCase();
    if (fp.includes('x86_64')) {
      return ['x86_64', 'arm64-v8a', 'armeabi-v7a'];
    }
    if (fp.includes('x86')) {
      return ['x86', 'armeabi-v7a'];
    }
  } catch {
    // Ignore error
  }

  // 3. Testing environment overrides
  if (typeof process !== 'undefined' && process.env?.TEST_DEVICE_ABI) {
    return process.env.TEST_DEVICE_ABI.split(',')
      .map((a: string) => a.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

const ABI_ALIASES: Record<string, string> = {
  aarch64: 'arm64-v8a',
  arm64: 'arm64-v8a',
  armv7: 'armeabi-v7a',
  armv7l: 'armeabi-v7a',
  arm: 'armeabi-v7a',
  armeabi: 'armeabi-v7a',
  x64: 'x86_64',
  amd64: 'x86_64',
};

/**
 * Select the optimal APK release asset for the current device:
 * 1. Iterates device supported ABIs in preference order (e.g. arm64-v8a, armeabi-v7a, x86_64)
 * 2. Matches against manifest.apks (with ABI aliases)
 * 3. Falls back to 'universal' in manifest.apks
 * 4. Falls back to manifest.apkUrl (fat universal APK for backward compatibility)
 */
export function selectApkForDevice(
  manifest: UpdateManifest,
  supportedAbis: string[] = getDeviceSupportedAbis()
): SelectedApk {
  const apks = manifest.apks;

  const fallbackUniversal: SelectedApk = {
    url: manifest.apkUrl,
    sha256: manifest.sha256,
    abi: 'universal',
  };

  if (!apks || typeof apks !== 'object' || Object.keys(apks).length === 0) {
    return fallbackUniversal;
  }

  const normalizeEntry = (entry: any, fallbackAbi: string): SelectedApk | null => {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const url = entry.trim();
      return url
        ? {
            url,
            abi: fallbackAbi,
            sha256: fallbackAbi === 'universal' ? manifest.sha256 : undefined,
          }
        : null;
    }
    if (typeof entry === 'object' && typeof entry.url === 'string') {
      const url = entry.url.trim();
      if (!url) return null;
      return {
        url,
        sha256:
          typeof entry.sha256 === 'string'
            ? entry.sha256.trim()
            : fallbackAbi === 'universal'
            ? manifest.sha256
            : undefined,
        size: typeof entry.size === 'number' && entry.size > 0 ? entry.size : undefined,
        abi: fallbackAbi,
      };
    }
    return null;
  };

  // Match in order of device preference (including standard ABI aliases)
  for (const rawAbi of supportedAbis) {
    const abi = rawAbi.trim().toLowerCase();
    const candidateKeys = [abi, ABI_ALIASES[abi]].filter(Boolean) as string[];
    for (const key of candidateKeys) {
      if (apks[key]) {
        const selected = normalizeEntry(apks[key], key);
        if (selected && selected.url) {
          return selected;
        }
      }
    }
  }

  // Fallback to 'universal' in apks map
  if (apks['universal']) {
    const selected = normalizeEntry(apks['universal'], 'universal');
    if (selected && selected.url) {
      return selected;
    }
  }

  // Final fallback to manifest.apkUrl
  return fallbackUniversal;
}

/**
 * Calculate download progress percentage clamped between 0 and 100.
 */
export function calculateDownloadProgress(
  totalBytesWritten: number,
  totalBytesExpectedToWrite: number
): DownloadProgress {
  const written = Math.max(0, isFinite(totalBytesWritten) ? totalBytesWritten : 0);
  const expected = Math.max(0, isFinite(totalBytesExpectedToWrite) ? totalBytesExpectedToWrite : 0);

  let percentage = 0;
  if (expected > 0) {
    percentage = Math.min(100, Math.max(0, Math.round((written / expected) * 100)));
  }

  return {
    totalBytesWritten: written,
    totalBytesExpectedToWrite: expected,
    percentage,
  };
}

/**
 * Format bytes into human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || !isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Get the current app semver string.
 */
export function getCurrentAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0'
  );
}

/**
 * Get the current app versionCode integer.
 */
export function getCurrentAppVersionCode(): number {
  return (
    Constants.expoConfig?.android?.versionCode ||
    (Constants.nativeBuildVersion ? parseInt(Constants.nativeBuildVersion, 10) : 1) ||
    1
  );
}

/**
 * Resolve the active mobile update manifest URL.
 * Manifest URL is fixed from environment and always targets /mobile/manifest.json.
 * It cannot be modified in-app to prevent security misconfigurations.
 */
export function getManifestUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL?.trim();
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    // Ensure the manifest URL strictly targets the mobile manifest
    if (envUrl.endsWith('/manifest.json') && !envUrl.endsWith('/mobile/manifest.json')) {
      return envUrl.replace(/\/manifest\.json$/, '/mobile/manifest.json');
    }
    return envUrl;
  }

  return DEFAULT_MANIFEST_URL;
}

/**
 * Resolve active OTA secret token if configured.
 */
export function getOtaToken(): string {
  const envToken = (
    process.env.EXPO_PUBLIC_OTA_TOKEN ||
    process.env['EXPO_PUBLIC_KURO-TV_SECRET_TOKEN'] ||
    process.env.EXPO_PUBLIC_KURO_TV_SECRET_TOKEN
  )?.trim();
  if (envToken) {
    return envToken;
  }
  return '';
}

class UpdaterServiceImpl {
  private activeDownloadResumable: FileSystem.DownloadResumable | null = null;

  getCurrentVersion(): string {
    return getCurrentAppVersion();
  }

  getCurrentVersionCode(): number {
    return getCurrentAppVersionCode();
  }

  /**
   * Check if a newer version is available.
   */
  async checkForUpdates(manifestUrlOverride?: string): Promise<UpdateCheckResult> {
    const currentVersion = getCurrentAppVersion();
    const currentVersionCode = getCurrentAppVersionCode();
    let url = manifestUrlOverride || getManifestUrl();
    const token = getOtaToken();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-OTA-Token'] = token;
      if (!url.includes('token=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}token=${encodeURIComponent(token)}`;
      }
    }

    // Add timestamp to bypass edge / intermediate caching
    const cacheBuster = `_t=${Date.now()}`;
    url = `${url}${url.includes('?') ? '&' : '?'}${cacheBuster}`;

    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers,
      });

      const manifest = validateManifest(response.data);
      if (!manifest) {
        return {
          isUpdateAvailable: false,
          currentVersion,
          currentVersionCode,
          error: 'Manifest non valido o corrotto',
        };
      }

      const available = isUpdateAvailable(currentVersion, currentVersionCode, manifest);
      const selectedApk = selectApkForDevice(manifest);

      return {
        isUpdateAvailable: available,
        currentVersion,
        currentVersionCode,
        manifest,
        selectedApk,
      };
    } catch (error: any) {
      console.warn('[UpdaterService] Failed to check for updates:', error?.message || error);
      return {
        isUpdateAvailable: false,
        currentVersion,
        currentVersionCode,
        error: error?.message || 'Impossibile verificare gli aggiornamenti',
      };
    }
  }

  /**
   * Download the APK to local app cache and track progress.
   */
  async downloadApk(
    manifest: UpdateManifest,
    onProgress?: DownloadProgressCallback
  ): Promise<string> {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
      throw new Error('Directory cache non disponibile per il download');
    }

    const selectedApk = selectApkForDevice(manifest);
    const targetAbiSuffix =
      selectedApk.abi && selectedApk.abi !== 'universal' ? `-${selectedApk.abi}` : '';
    const cleanCacheDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
    const filename = `kurotv-v${manifest.version}-${manifest.versionCode}${targetAbiSuffix}.apk`;
    const targetUri = `${cleanCacheDir}${filename}`;

    try {
      // If a previous file exists, remove it first
      const fileInfo = await FileSystem.getInfoAsync(targetUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
    } catch (err) {
      console.warn('[UpdaterService] Warning cleaning existing file:', err);
    }

    const token = getOtaToken();
    const downloadHeaders: Record<string, string> = {};
    let finalApkUrl = selectedApk.url || manifest.apkUrl;

    if (token) {
      downloadHeaders['Authorization'] = `Bearer ${token}`;
      downloadHeaders['X-OTA-Token'] = token;
      if (!finalApkUrl.includes('token=')) {
        const separator = finalApkUrl.includes('?') ? '&' : '?';
        finalApkUrl = `${finalApkUrl}${separator}token=${encodeURIComponent(token)}`;
      }
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      finalApkUrl,
      targetUri,
      { headers: downloadHeaders },
      (downloadProgress) => {
        if (onProgress) {
          const progress = calculateDownloadProgress(
            downloadProgress.totalBytesWritten,
            downloadProgress.totalBytesExpectedToWrite
          );
          onProgress(progress);
        }
      }
    );

    this.activeDownloadResumable = downloadResumable;

    const result = await downloadResumable.downloadAsync();
    this.activeDownloadResumable = null;

    if (!result || !result.uri) {
      throw new Error('Download APK fallito');
    }

    return result.uri;
  }

  /**
   * Cancel active download if running.
   */
  async cancelDownload(): Promise<void> {
    if (this.activeDownloadResumable) {
      try {
        await this.activeDownloadResumable.pauseAsync();
      } catch (err) {
        console.warn('[UpdaterService] Error pausing download:', err);
      }
      this.activeDownloadResumable = null;
    }
  }

  /**
   * Launch native Android Package Installer for Leanback TV via ACTION_VIEW Intent.
   */
  async installApk(fileUri: string): Promise<boolean> {
    if (!fileUri) {
      return false;
    }

    if (Platform.OS !== 'android') {
      console.warn('[UpdaterService] Installazione APK supportata solo su piattaforma Android');
      return false;
    }

    try {
      let contentUri = fileUri;
      if (fileUri.startsWith('file://')) {
        contentUri = await FileSystem.getContentUriAsync(fileUri);
      }

      // Flags:
      // FLAG_GRANT_READ_URI_PERMISSION = 0x00000001 (1)
      // FLAG_ACTIVITY_NEW_TASK = 0x10000000 (268435456)
      const flags = 268435456 | 1;

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags,
      });

      return true;
    } catch (error) {
      console.error('[UpdaterService] Errore avvio installazione nativa:', error);
      return false;
    }
  }
}

export const UpdaterService = new UpdaterServiceImpl();
