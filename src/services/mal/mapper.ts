import type { AnimeDetail, AnimeItem } from '@/types';
import { AnimeWorldScraper } from '../scraper/animeworld-scraper';
import { sanitizeTitleForSearch } from '../scraper/utils';
import { AppStorage } from '../storage/app-storage';
import { getMalSettings } from './config';
import {
  detectAnimeWorldAudioVariant,
  getMalIdMapStore,
  recordAnimeMalMapping,
  setManualAnimeMalMapping,
} from './id-map-store';
import type { MalAnimeListEntry } from './types';

export interface MalScraperAdapter {
  searchAnime: (query: string) => Promise<{ items: AnimeItem[] }>;
  getAnimeDetail: (id: string) => Promise<AnimeDetail>;
}

let scraperAdapterOverride: MalScraperAdapter | null = null;

export function setMalScraperAdapterForTest(adapter?: MalScraperAdapter | null): void {
  scraperAdapterOverride = adapter || null;
}

function getScraper(): MalScraperAdapter {
  return scraperAdapterOverride || AnimeWorldScraper;
}

export function normalizeTitleForMatching(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = sanitizeTitleForSearch(raw);
  try {
    cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    // Ignore normalize fallback
  }
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeTitleSimilarity(a?: string | null, b?: string | null): number {
  const na = normalizeTitleForMatching(a);
  const nb = normalizeTitleForMatching(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.78 + ratio * 0.2;
  }

  const tokensA = new Set(na.split(' ').filter(Boolean));
  const tokensB = new Set(nb.split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 0;
  return (intersection / union) * 0.77;
}

function computeBestEntrySimilarity(entry: MalAnimeListEntry, candidateTitle: string): number {
  const references = [
    entry.title,
    entry.alternativeTitles?.en,
    entry.alternativeTitles?.ja,
    ...(entry.alternativeTitles?.synonyms || []),
  ].filter((t): t is string => Boolean(t && t.trim()));

  let best = 0;
  for (const ref of references) {
    const score = computeTitleSimilarity(ref, candidateTitle);
    if (score > best) best = score;
  }
  return best;
}

export interface MalPickerCandidate {
  id: string;
  title: string;
  thumbnail: string;
  audio: 'sub' | 'ita';
  malId?: number;
  totalEpisodes?: number | string;
  status?: string;
  state?: string;
  exactMalMatch: boolean;
}

export type ResolveMalToAnimeWorldResult =
  | {
      status: 'resolved';
      animeId: string;
      source: 'cache' | 'local_history' | 'scraper_exact' | 'audio_preference';
    }
  | {
      status: 'needs_picker';
      reason: 'multiple_variants' | 'no_exact_match';
      candidates: MalPickerCandidate[];
    };

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function resolveMissingAnimeMalMappings(
  animeIds: string[],
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{ resolved: number; unmappedIds: string[] }> {
  const uniqueIds = Array.from(new Set(animeIds.filter((id) => Boolean(id && id.trim()))));
  const store = getMalIdMapStore();
  const missing = uniqueIds.filter((id) => !store.byAnimeId[id]);

  if (missing.length === 0) {
    return { resolved: 0, unmappedIds: [] };
  }

  const scraper = getScraper();
  const concurrency = Math.max(1, Math.min(3, options?.concurrency ?? 2));
  let completed = 0;
  let resolved = 0;
  const unmappedIds: string[] = [];

  await runWithConcurrency(missing, concurrency, async (animeId) => {
    try {
      const detail = await scraper.getAnimeDetail(animeId);
      if (detail && typeof detail.malId === 'number' && Number.isFinite(detail.malId) && detail.malId > 0) {
        recordAnimeMalMapping(detail);
        resolved++;
      } else {
        unmappedIds.push(animeId);
      }
    } catch {
      unmappedIds.push(animeId);
    } finally {
      completed++;
      options?.onProgress?.(completed, missing.length);
    }
  });

  return { resolved, unmappedIds };
}

function getLocalCandidateIdsInPriorityOrder(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const c of AppStorage.getContinueWatching()) {
    if (c?.animeId && !seen.has(c.animeId)) {
      seen.add(c.animeId);
      ordered.push(c.animeId);
    }
  }
  for (const h of AppStorage.getWatchHistory()) {
    if (h?.animeId && !seen.has(h.animeId)) {
      seen.add(h.animeId);
      ordered.push(h.animeId);
    }
  }
  for (const f of AppStorage.getFavorites()) {
    if (f?.id && !seen.has(f.id)) {
      seen.add(f.id);
      ordered.push(f.id);
    }
  }

  return ordered;
}

export async function resolveMalToAnimeWorld(
  entry: MalAnimeListEntry,
  options?: { forcePicker?: boolean }
): Promise<ResolveMalToAnimeWorldResult> {
  const forcePicker = Boolean(options?.forcePicker);
  const store = getMalIdMapStore();
  const settings = getMalSettings();

  // 1. Cached primary AnimeWorld slug for this MAL ID
  const cachedByMal = store.byMalId[entry.malId];
  if (!forcePicker && cachedByMal?.primaryAnimeId) {
    return {
      status: 'resolved',
      animeId: cachedByMal.primaryAnimeId,
      source: 'cache',
    };
  }

  // 2. Priority check against local Continue Watching, Watch History, Favorites
  const localIds = getLocalCandidateIdsInPriorityOrder();
  const localMatches = localIds
    .map((id) => store.byAnimeId[id])
    .filter((m): m is NonNullable<typeof m> => Boolean(m && m.malId === entry.malId));

  if (!forcePicker && localMatches.length > 0) {
    let chosen = localMatches[0];
    if (
      localMatches.length > 1 &&
      (settings.audioPreference === 'sub' || settings.audioPreference === 'ita')
    ) {
      const preferredLocal = localMatches.find((m) => m.audio === settings.audioPreference);
      if (preferredLocal) {
        chosen = preferredLocal;
      }
    }

    setManualAnimeMalMapping({
      malId: entry.malId,
      animeId: chosen.animeId,
      title: chosen.title,
      totalEpisodes: chosen.totalEpisodes,
      audio: chosen.audio,
      isOngoingSeries: chosen.isOngoingSeries,
    });

    return {
      status: 'resolved',
      animeId: chosen.animeId,
      source: 'local_history',
    };
  }

  // 3. Search AnimeWorld using MAL title, then alternativeTitles.en / alternativeTitles.ja
  const scraper = getScraper();
  const queryCandidates: string[] = [];
  const pushQuery = (q?: string | null) => {
    if (!q || !q.trim()) return;
    const sanitized = sanitizeTitleForSearch(q);
    if (sanitized && !queryCandidates.includes(sanitized)) {
      queryCandidates.push(sanitized);
    }
    const trimmed = q.trim();
    if (trimmed && !queryCandidates.includes(trimmed)) {
      queryCandidates.push(trimmed);
    }
  };

  pushQuery(entry.title);
  pushQuery(entry.alternativeTitles?.en);
  pushQuery(entry.alternativeTitles?.ja);

  const dedupedItemsMap = new Map<string, AnimeItem>();
  const inspectedIds = new Set<string>();
  const inspectedDetails: AnimeDetail[] = [];

  for (const query of queryCandidates) {
    let items: AnimeItem[] = [];
    try {
      const res = await scraper.searchAnime(query);
      items = Array.isArray(res?.items) ? res.items : [];
    } catch {
      continue;
    }
    if (items.length === 0) continue;

    for (const item of items) {
      if (item?.id && !dedupedItemsMap.has(item.id)) {
        dedupedItemsMap.set(item.id, item);
      }
    }

    const batchCandidates = [...items]
      .filter((it) => it?.id && !inspectedIds.has(it.id))
      .sort((a, b) => computeBestEntrySimilarity(entry, b.title) - computeBestEntrySimilarity(entry, a.title))
      .slice(0, 5);

    for (const cand of batchCandidates) {
      inspectedIds.add(cand.id);
    }

    await runWithConcurrency(batchCandidates, 2, async (cand) => {
      try {
        const detail = await scraper.getAnimeDetail(cand.id);
        if (detail) {
          if (typeof detail.malId === 'number' && Number.isFinite(detail.malId) && detail.malId > 0) {
            recordAnimeMalMapping(detail);
          }
          inspectedDetails.push(detail);
        }
      } catch {
        // Ignore single candidate scrape error
      }
    });

    const hasExactMatch = inspectedDetails.some(
      (d) => typeof d.malId === 'number' && Number.isFinite(d.malId) && d.malId === entry.malId
    );
    if (hasExactMatch) {
      break;
    }
  }

  const sortedSearchItems = Array.from(dedupedItemsMap.values()).sort(
    (a, b) => computeBestEntrySimilarity(entry, b.title) - computeBestEntrySimilarity(entry, a.title)
  );

  const exactMatches = inspectedDetails.filter(
    (d) => typeof d.malId === 'number' && Number.isFinite(d.malId) && d.malId === entry.malId
  );

  // 4b. Re-check priority against local history/favorites now that details have been inspected
  if (!forcePicker && exactMatches.length > 1) {
    const exactById = new Map(exactMatches.map((d) => [d.id, d]));
    const localExactMatches = localIds
      .map((id) => exactById.get(id))
      .filter((d): d is AnimeDetail => Boolean(d));

    if (localExactMatches.length > 0) {
      let chosen = localExactMatches[0];
      if (
        localExactMatches.length > 1 &&
        (settings.audioPreference === 'sub' || settings.audioPreference === 'ita')
      ) {
        const preferredLocal = localExactMatches.find(
          (d) =>
            detectAnimeWorldAudioVariant({ id: d.id, title: d.title, audio: d.audio }) ===
            settings.audioPreference
        );
        if (preferredLocal) {
          chosen = preferredLocal;
        }
      }

      setManualAnimeMalMapping({
        malId: entry.malId,
        animeId: chosen.id,
        title: chosen.title,
        totalEpisodes: chosen.totalEpisodes,
        status: chosen.status,
        state: chosen.state,
        audio: chosen.audio,
      });

      return {
        status: 'resolved',
        animeId: chosen.id,
        source: 'local_history',
      };
    }
  }

  // 5. Unique exact match -> save & open immediately (unless forcePicker)
  if (exactMatches.length === 1 && !forcePicker) {
    const match = exactMatches[0];
    setManualAnimeMalMapping({
      malId: entry.malId,
      animeId: match.id,
      title: match.title,
      totalEpisodes: match.totalEpisodes,
      status: match.status,
      state: match.state,
      audio: match.audio,
    });
    return {
      status: 'resolved',
      animeId: match.id,
      source: 'scraper_exact',
    };
  }

  // 6. Multiple exact matches (e.g. SUB + ITA sharing the same MAL ID)
  if (exactMatches.length > 1) {
    const variantCandidates: MalPickerCandidate[] = exactMatches.map((d) => ({
      id: d.id,
      title: d.title,
      thumbnail: d.thumbnail || d.image || '',
      audio: detectAnimeWorldAudioVariant({ id: d.id, title: d.title, audio: d.audio }),
      malId: d.malId,
      totalEpisodes: d.totalEpisodes,
      status: d.status,
      state: d.state,
      exactMalMatch: true,
    }));

    if (!forcePicker && (settings.audioPreference === 'sub' || settings.audioPreference === 'ita')) {
      const matchingAudio = variantCandidates.filter((c) => c.audio === settings.audioPreference);
      if (matchingAudio.length === 1) {
        const chosen = matchingAudio[0];
        setManualAnimeMalMapping({
          malId: entry.malId,
          animeId: chosen.id,
          title: chosen.title,
          totalEpisodes: chosen.totalEpisodes,
          status: chosen.status,
          state: chosen.state,
          audio: chosen.audio,
        });
        return {
          status: 'resolved',
          animeId: chosen.id,
          source: 'audio_preference',
        };
      }
    }

    return {
      status: 'needs_picker',
      reason: 'multiple_variants',
      candidates: variantCandidates,
    };
  }

  // 7. Fallback picker (forcePicker with 1 exact match or 0 exact matches)
  const exactMap = new Map<string, AnimeDetail>(exactMatches.map((d) => [d.id, d]));
  const pickerCandidates: MalPickerCandidate[] =
    exactMatches.length === 1 && forcePicker
      ? [
          {
            id: exactMatches[0].id,
            title: exactMatches[0].title,
            thumbnail: exactMatches[0].thumbnail || exactMatches[0].image || '',
            audio: detectAnimeWorldAudioVariant({
              id: exactMatches[0].id,
              title: exactMatches[0].title,
              audio: exactMatches[0].audio,
            }),
            malId: exactMatches[0].malId,
            totalEpisodes: exactMatches[0].totalEpisodes,
            status: exactMatches[0].status,
            state: exactMatches[0].state,
            exactMalMatch: true,
          },
          ...sortedSearchItems
            .filter((it) => it.id !== exactMatches[0].id)
            .slice(0, 9)
            .map((it) => ({
              id: it.id,
              title: it.title,
              thumbnail: it.thumbnail || it.image || '',
              audio: detectAnimeWorldAudioVariant({ id: it.id, title: it.title, audio: it.audio }),
              totalEpisodes: it.totalEpisodes,
              status: it.status,
              state: it.state,
              exactMalMatch: false,
            })),
        ]
      : sortedSearchItems.slice(0, 12).map((it) => {
          const d = exactMap.get(it.id);
          return {
            id: it.id,
            title: d?.title || it.title,
            thumbnail: d?.thumbnail || it.thumbnail || it.image || '',
            audio: detectAnimeWorldAudioVariant({
              id: it.id,
              title: d?.title || it.title,
              audio: d?.audio || it.audio,
            }),
            malId: d?.malId,
            totalEpisodes: d?.totalEpisodes ?? it.totalEpisodes,
            status: d?.status ?? it.status,
            state: d?.state ?? it.state,
            exactMalMatch: Boolean(d),
          };
        });

  return {
    status: 'needs_picker',
    reason: exactMatches.length > 0 ? 'multiple_variants' : 'no_exact_match',
    candidates: pickerCandidates,
  };
}

export async function searchAnimeWorldCandidatesForMalPicker(
  query: string
): Promise<MalPickerCandidate[]> {
  const clean = query.trim();
  if (!clean) return [];
  const scraper = getScraper();
  const res = await scraper.searchAnime(clean);
  const items = Array.isArray(res?.items) ? res.items : [];
  return items.slice(0, 15).map((it) => ({
    id: it.id,
    title: it.title,
    thumbnail: it.thumbnail || it.image || '',
    audio: detectAnimeWorldAudioVariant({ id: it.id, title: it.title, audio: it.audio }),
    totalEpisodes: it.totalEpisodes,
    status: it.status,
    state: it.state,
    exactMalMatch: false,
  }));
}

