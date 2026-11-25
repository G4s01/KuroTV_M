import type { AnimeDetail } from '@/types';
import { AppStorage, StorageKeys } from '../storage/app-storage';
import { notifyMalDataListeners } from './config';
import type {
  MalIdMapStore,
  MalIdMappingByAnimeId,
  MalIdMappingByMalId,
} from './types';

export function parsePositiveTotalEpisodes(total?: number | string | null): number | null {
  if (typeof total === 'number') {
    return Number.isFinite(total) && total > 0 ? Math.floor(total) : null;
  }
  if (typeof total !== 'string') return null;

  const clean = total.trim();
  if (!clean) return null;

  if (clean.includes('/')) {
    const parts = clean.split('/').map((p) => p.trim());
    const rightPart = parts[parts.length - 1] || '';
    if (!rightPart || rightPart.includes('?')) return null;
    const parsed = parseInt(rightPart, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  if (clean.includes('?')) return null;
  const parsed = parseInt(clean, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isOngoingAnimeDetail(detail: Partial<AnimeDetail>): boolean {
  const totalStr = String(detail.totalEpisodes ?? '').trim();
  if (totalStr.includes('?')) return true;
  const statusStr = String(detail.status || detail.state || '').toLowerCase();
  if (!statusStr) return false;
  return (
    statusStr.includes('in corso') ||
    statusStr.includes('ongoing') ||
    statusStr.includes('currently airing') ||
    statusStr.includes('airing')
  );
}

export function detectAnimeWorldAudioVariant(params: {
  id?: string | null;
  title?: string | null;
  audio?: string | null;
}): 'sub' | 'ita' {
  const audioLower = (params.audio || '').toLowerCase().trim();
  if (
    audioLower === 'italiano' ||
    audioLower === 'ita' ||
    audioLower.includes('doppiat')
  ) {
    return 'ita';
  }

  const titleLower = (params.title || '').toLowerCase().trim();
  if (
    /[\(\[]\s*ita\s*[\)\]]|\(audio\s+ita\)|\bdoppiat[oa]\b|\s+ita$/i.test(titleLower) &&
    !/sub[-\s]*ita/i.test(titleLower)
  ) {
    return 'ita';
  }

  const idLower = (params.id || '').toLowerCase().trim();
  if (/(?:^|-)ita(?:\.[^/]+)?$/i.test(idLower) && !/sub-ita/i.test(idLower)) {
    return 'ita';
  }

  return 'sub';
}

export function getMalIdMapStore(): MalIdMapStore {
  const raw = AppStorage.getObject<Partial<MalIdMapStore>>(StorageKeys.MAL_ID_MAP);
  return {
    byAnimeId:
      raw?.byAnimeId && typeof raw.byAnimeId === 'object' && !Array.isArray(raw.byAnimeId)
        ? raw.byAnimeId
        : {},
    byMalId:
      raw?.byMalId && typeof raw.byMalId === 'object' && !Array.isArray(raw.byMalId)
        ? raw.byMalId
        : {},
  };
}

export function saveMalIdMapStore(store: MalIdMapStore): void {
  AppStorage.setObject(StorageKeys.MAL_ID_MAP, store);
  notifyMalDataListeners();
}

export function getMappingByAnimeId(animeId: string): MalIdMappingByAnimeId | null {
  if (!animeId) return null;
  const store = getMalIdMapStore();
  return store.byAnimeId[animeId] || null;
}

export function getMappedMalIdForAnime(animeId: string): number | null {
  const entry = getMappingByAnimeId(animeId);
  return entry && entry.malId > 0 ? entry.malId : null;
}

export function getMappingByMalId(malId: number): MalIdMappingByMalId | null {
  if (!Number.isFinite(malId) || malId <= 0) return null;
  const store = getMalIdMapStore();
  return store.byMalId[malId] || null;
}

/**
 * Passively records a verified AnimeWorld <-> MAL ID mapping.
 * Strictly validates `detail.malId` and NEVER reads `detail.anilistId`.
 */
export function recordAnimeMalMapping(detail: AnimeDetail | null | undefined): void {
  if (!detail || !detail.id) return;
  const malId = detail.malId;
  if (typeof malId !== 'number' || !Number.isFinite(malId) || malId <= 0) {
    return;
  }

  const normalizedMalId = Math.floor(malId);
  const store = getMalIdMapStore();
  const parsedTotal = parsePositiveTotalEpisodes(
    detail.totalEpisodes ?? (Array.isArray(detail.episodes) && detail.episodes.length > 0 && !isOngoingAnimeDetail(detail) ? detail.episodes.length : null)
  );
  const ongoing = isOngoingAnimeDetail(detail);
  const audio = detectAnimeWorldAudioVariant({
    id: detail.id,
    title: detail.title,
    audio: detail.audio,
  });
  const now = Date.now();

  store.byAnimeId[detail.id] = {
    animeId: detail.id,
    malId: normalizedMalId,
    title: detail.title || detail.id,
    totalEpisodes: parsedTotal,
    isOngoingSeries: ongoing,
    isCompletedSeries: !ongoing && (parsedTotal ?? 0) > 0,
    audio,
    updatedAt: now,
  };

  const existingByMal = store.byMalId[normalizedMalId];
  const candidateSet = new Set<string>(existingByMal?.candidateAnimeIds || []);
  candidateSet.add(detail.id);

  store.byMalId[normalizedMalId] = {
    malId: normalizedMalId,
    primaryAnimeId: existingByMal?.primaryAnimeId || '',
    candidateAnimeIds: Array.from(candidateSet),
    title: detail.title || existingByMal?.title || detail.id,
    updatedAt: now,
  };

  saveMalIdMapStore(store);
}

export function setManualAnimeMalMapping(params: {
  malId: number;
  animeId: string;
  title: string;
  totalEpisodes?: number | string | null;
  status?: string;
  state?: string;
  audio?: string;
  isOngoingSeries?: boolean;
}): void {
  const { malId, animeId, title, totalEpisodes, status, state, audio, isOngoingSeries } = params;
  if (!animeId || !Number.isFinite(malId) || malId <= 0) return;

  const normalizedMalId = Math.floor(malId);
  const store = getMalIdMapStore();
  const existingByAnime = store.byAnimeId[animeId];
  const now = Date.now();

  const hasTotalParam = totalEpisodes !== undefined && totalEpisodes !== null;
  const parsedTotal = hasTotalParam
    ? parsePositiveTotalEpisodes(totalEpisodes)
    : (existingByAnime?.totalEpisodes ?? null);

  const hasStatusInfo =
    typeof isOngoingSeries === 'boolean' ||
    Boolean(status && status.trim()) ||
    Boolean(state && state.trim()) ||
    (typeof totalEpisodes === 'string' && totalEpisodes.includes('?'));

  const ongoing =
    typeof isOngoingSeries === 'boolean'
      ? isOngoingSeries
      : hasStatusInfo
      ? isOngoingAnimeDetail({ totalEpisodes: totalEpisodes ?? undefined, status, state })
      : Boolean(existingByAnime?.isOngoingSeries);

  const audioVariant = detectAnimeWorldAudioVariant({
    id: animeId,
    title,
    audio: audio || existingByAnime?.audio,
  });

  store.byAnimeId[animeId] = {
    animeId,
    malId: normalizedMalId,
    title: title || existingByAnime?.title || animeId,
    totalEpisodes: parsedTotal,
    isOngoingSeries: ongoing,
    isCompletedSeries: !ongoing && (parsedTotal ?? 0) > 0,
    audio: audioVariant,
    updatedAt: now,
  };

  const existingByMal = store.byMalId[normalizedMalId];
  const candidateSet = new Set<string>(existingByMal?.candidateAnimeIds || []);
  candidateSet.add(animeId);

  store.byMalId[normalizedMalId] = {
    malId: normalizedMalId,
    primaryAnimeId: animeId,
    candidateAnimeIds: Array.from(candidateSet),
    title: title || existingByMal?.title || animeId,
    updatedAt: now,
  };

  saveMalIdMapStore(store);
}

export function clearMalPrimaryMapping(malId: number): void {
  if (!Number.isFinite(malId) || malId <= 0) return;
  const store = getMalIdMapStore();
  if (store.byMalId[malId]) {
    delete store.byMalId[malId];
    saveMalIdMapStore(store);
  }
}
