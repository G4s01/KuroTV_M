import { AppStorage, StorageKeys } from '../storage/app-storage';
import { MalAuthService } from './auth';
import { MalApiError, MalClient } from './client';
import {
  findEntryInMalListCache,
  getActiveMalProfileScope,
  getMalIgnoredAnimeIds,
  getMalListCache,
  getMalScopedKey,
  getMalSettings,
  notifyMalDataListeners,
  setMalLastSyncTime,
} from './config';
import {
  getMalIdMapStore,
  getMappingByAnimeId,
  parsePositiveTotalEpisodes,
} from './id-map-store';
import { resolveMissingAnimeMalMappings } from './mapper';
import type {
  MalAnimeListEntry,
  MalAutoSyncResult,
  MalDiffResult,
  MalListCache,
  MalListStatusValue,
  MalPendingUpdate,
  MalSyncApplyResult,
  MalSyncProposal,
  MalUnmappedLocalSeries,
} from './types';

interface LocalWatchedSeriesSummary {
  animeId: string;
  title: string;
  thumbnail?: string;
  watchedEpisodes: number;
  totalEpisodes?: number | string;
  isOngoingSeries: boolean;
  latestUpdatedAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Collects completed episode counts per AnimeWorld animeId from local storage sources
 * without mutating local state or touching KuroSync.
 *
 * Anti-off-by-one rules:
 * - Only positive integer episode numbers (> 0) qualify (ignores Ep. 0 and .5 recaps).
 * - Only completed episodes (`isCompleted === true` or `>= 90%`) qualify.
 * - `CONTINUE_WATCHING` contributes ONLY when `isCaughtUp === true` (because otherwise
 *   it holds the *next* unwatched episode at 0:00).
 * - `MAL_WATCHED_HIGHWATER` preserves completed counts beyond the 60-day prune window.
 */
export function collectLocalCompletedSeries(): Map<string, LocalWatchedSeriesSummary> {
  const byAnimeId = new Map<string, LocalWatchedSeriesSummary>();

  const ensureRecord = (animeId: string): LocalWatchedSeriesSummary => {
    let rec = byAnimeId.get(animeId);
    if (!rec) {
      rec = {
        animeId,
        title: animeId,
        watchedEpisodes: 0,
        isOngoingSeries: false,
        latestUpdatedAt: 0,
      };
      byAnimeId.set(animeId, rec);
    }
    return rec;
  };

  // 1. Discrete watch progress keys (`user.progress.*`)
  const allProgress = AppStorage.getAllWatchProgress();
  for (const item of allProgress) {
    if (!item?.animeId) continue;
    const isComp = Boolean(item.isCompleted || (typeof item.percentage === 'number' && item.percentage >= 90));
    const ep = item.episodeNumber;
    if (!isComp || !Number.isInteger(ep) || ep <= 0) continue;

    const rec = ensureRecord(item.animeId);
    if (ep > rec.watchedEpisodes) rec.watchedEpisodes = ep;
    if (item.animeTitle && rec.title === rec.animeId) rec.title = item.animeTitle;
    if (item.thumbnail && !rec.thumbnail) rec.thumbnail = item.thumbnail;
    const itemTs = item.updatedAt || 0;
    if (item.totalEpisodes !== undefined && (rec.totalEpisodes === undefined || itemTs >= rec.latestUpdatedAt)) {
      rec.totalEpisodes = item.totalEpisodes;
      rec.isOngoingSeries = String(item.totalEpisodes).includes('?');
    }
    if (itemTs > rec.latestUpdatedAt) {
      rec.latestUpdatedAt = itemTs;
      if (item.animeTitle) rec.title = item.animeTitle;
      if (item.thumbnail) rec.thumbnail = item.thumbnail;
    }
  }

  // 2. Watch history (`user.history`, up to 100 items)
  const history = AppStorage.getWatchHistory();
  for (const item of history) {
    if (!item?.animeId) continue;
    const isComp = Boolean(
      item.isCompleted || (typeof item.progressPercent === 'number' && item.progressPercent >= 90)
    );
    const ep = item.episodeNumber;
    if (!isComp || !Number.isInteger(ep) || ep <= 0) continue;

    const rec = ensureRecord(item.animeId);
    if (ep > rec.watchedEpisodes) rec.watchedEpisodes = ep;
    if ((item.updatedAt || 0) >= rec.latestUpdatedAt) {
      rec.latestUpdatedAt = item.updatedAt || 0;
      if (item.title) rec.title = item.title;
      if (item.thumbnail) rec.thumbnail = item.thumbnail;
    }
  }

  // 3. Continue watching (`user.continueWatching`) - ONLY when isCaughtUp === true
  const continueWatching = AppStorage.getContinueWatching();
  for (const item of continueWatching) {
    if (!item?.animeId) continue;
    const ep = item.episodeNumber;
    if (item.isCaughtUp !== true || !Number.isInteger(ep) || ep <= 0) continue;

    const rec = ensureRecord(item.animeId);
    if (ep > rec.watchedEpisodes) rec.watchedEpisodes = ep;
    if (item.totalEpisodes !== undefined) {
      rec.totalEpisodes = item.totalEpisodes;
      if (String(item.totalEpisodes).includes('?')) rec.isOngoingSeries = true;
    }
    if ((item.updatedAt || 0) >= rec.latestUpdatedAt) {
      rec.latestUpdatedAt = item.updatedAt || 0;
      if (item.title) rec.title = item.title;
      if (item.thumbnail) rec.thumbnail = item.thumbnail;
    }
  }

  // 4. Persistent MAL watched highwater (`mal.watchedHighwater`)
  const highwater = AppStorage.getMalWatchedHighwater();
  for (const [animeId, ep] of Object.entries(highwater)) {
    if (!animeId || !Number.isInteger(ep) || ep <= 0) continue;
    const rec = ensureRecord(animeId);
    if (ep > rec.watchedEpisodes) rec.watchedEpisodes = ep;
  }

  // Enrich titles from Favorites/ContinueWatching/IdMap if still slug-only
  const favs = AppStorage.getFavorites();
  const favMap = new Map(favs.map((f) => [f.id, f]));
  const cwMap = new Map(continueWatching.map((c) => [c.animeId, c]));
  const idMap = getMalIdMapStore();

  for (const [animeId, rec] of byAnimeId.entries()) {
    if (rec.watchedEpisodes <= 0) {
      byAnimeId.delete(animeId);
      continue;
    }
    const cw = cwMap.get(animeId);
    const fav = favMap.get(animeId);
    const mapEntry = idMap.byAnimeId[animeId];
    if (rec.title === animeId) {
      rec.title = cw?.title || fav?.title || mapEntry?.title || rec.title;
    }
    if (!rec.thumbnail) {
      rec.thumbnail = cw?.thumbnail || fav?.thumbnail || fav?.image;
    }
    if (rec.totalEpisodes === undefined && (cw?.totalEpisodes !== undefined || fav?.totalEpisodes !== undefined)) {
      rec.totalEpisodes = cw?.totalEpisodes ?? fav?.totalEpisodes;
      rec.isOngoingSeries = String(rec.totalEpisodes ?? '').includes('?');
    }
  }

  return byAnimeId;
}

export function getLocalCompletedEpisodesForAnime(animeId: string, malId?: number | null): number {
  const localMap = collectLocalCompletedSeries();
  let maxEp = localMap.get(animeId)?.watchedEpisodes || 0;

  if (typeof malId === 'number' && Number.isFinite(malId) && malId > 0) {
    const store = getMalIdMapStore();
    for (const [mappedAnimeId, mapping] of Object.entries(store.byAnimeId)) {
      if (mapping.malId === malId) {
        const count = localMap.get(mappedAnimeId)?.watchedEpisodes || 0;
        if (count > maxEp) maxEp = count;
      }
    }
  }

  return maxEp;
}

function buildMalEntryMap(lists?: MalListCache | MalAnimeListEntry[] | null): Map<number, MalAnimeListEntry> {
  const map = new Map<number, MalAnimeListEntry>();
  if (!lists) return map;

  const entries: MalAnimeListEntry[] = Array.isArray(lists)
    ? lists
    : [...(lists.watching || []), ...(lists.plan_to_watch || []), ...(lists.completed || [])];

  for (const entry of entries) {
    if (entry && entry.malId > 0) {
      const existing = map.get(entry.malId);
      if (!existing) {
        map.set(entry.malId, entry);
      } else if (existing.status !== 'completed' && entry.status === 'completed') {
        map.set(entry.malId, entry);
      }
    }
  }
  return map;
}

export function computeLocalAppToMalDiffSnapshot(
  malListsInput?: MalListCache | MalAnimeListEntry[] | null
): MalDiffResult {
  const localSeries = collectLocalCompletedSeries();
  const idMap = getMalIdMapStore();
  const ignoredSet = new Set(getMalIgnoredAnimeIds());
  const lists = malListsInput !== undefined ? malListsInput : getMalListCache();
  const malById = buildMalEntryMap(lists);

  const unmapped: MalUnmappedLocalSeries[] = [];
  const groupedByMalId = new Map<
    number,
    {
      malId: number;
      items: LocalWatchedSeriesSummary[];
      mappingTotalEpisodes: number | null;
      isOngoingSeries: boolean;
    }
  >();

  for (const summary of localSeries.values()) {
    if (summary.watchedEpisodes <= 0) continue;
    if (ignoredSet.has(summary.animeId)) continue;

    const mapping = idMap.byAnimeId[summary.animeId];
    if (!mapping || !mapping.malId || mapping.malId <= 0) {
      unmapped.push({
        animeId: summary.animeId,
        title: summary.title,
        thumbnail: summary.thumbnail,
        watchedEpisodes: summary.watchedEpisodes,
      });
      continue;
    }

    let group = groupedByMalId.get(mapping.malId);
    if (!group) {
      group = {
        malId: mapping.malId,
        items: [],
        mappingTotalEpisodes: null,
        isOngoingSeries: false,
      };
      groupedByMalId.set(mapping.malId, group);
    }

    group.items.push(summary);
    const mapTotal = mapping.totalEpisodes ?? parsePositiveTotalEpisodes(summary.totalEpisodes);
    if (mapTotal && mapTotal > 0) {
      group.mappingTotalEpisodes = Math.max(group.mappingTotalEpisodes || 0, mapTotal);
    }
    if (
      mapping.isOngoingSeries ||
      (typeof mapping.isOngoingSeries !== 'boolean' && summary.isOngoingSeries)
    ) {
      group.isOngoingSeries = true;
    }
  }

  const proposals: MalSyncProposal[] = [];
  let alreadySyncedCount = 0;

  for (const group of groupedByMalId.values()) {
    const malEntry = malById.get(group.malId);
    const rawWatched = Math.max(...group.items.map((i) => i.watchedEpisodes));
    if (rawWatched <= 0) continue;

    const sortedItems = [...group.items].sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
    const preferredSlug = idMap.byMalId[group.malId]?.primaryAnimeId;
    const primaryItem =
      sortedItems.find((it) => it.animeId === preferredSlug) || sortedItems[0];

    const knownTotalEpisodes =
      malEntry && malEntry.numEpisodes > 0
        ? malEntry.numEpisodes
        : group.mappingTotalEpisodes && group.mappingTotalEpisodes > 0
        ? group.mappingTotalEpisodes
        : null;

    const isOngoingOnMalOrApp = malEntry?.mediaStatus
      ? malEntry.mediaStatus === 'currently_airing' || malEntry.mediaStatus === 'not_yet_aired'
      : group.isOngoingSeries;

    const clampedAppEpisodes =
      knownTotalEpisodes && knownTotalEpisodes > 0
        ? Math.min(rawWatched, knownTotalEpisodes)
        : rawWatched;

    const qualifiesAsCompleted = Boolean(
      knownTotalEpisodes &&
        knownTotalEpisodes > 0 &&
        clampedAppEpisodes >= knownTotalEpisodes &&
        !isOngoingOnMalOrApp
    );

    const targetStatus: MalListStatusValue = qualifiesAsCompleted ? 'completed' : 'watching';

    if (malEntry) {
      if (malEntry.status === 'completed') {
        alreadySyncedCount++;
        continue;
      }

      if (malEntry.status === 'plan_to_watch') {
        let targetEpisodes = Math.max(clampedAppEpisodes, malEntry.watchedEpisodes);
        if (knownTotalEpisodes && knownTotalEpisodes > 0) {
          targetEpisodes = Math.min(targetEpisodes, knownTotalEpisodes);
        }
        proposals.push({
          malId: group.malId,
          animeId: primaryItem.animeId,
          animeIds: sortedItems.map((i) => i.animeId),
          title: malEntry.title || primaryItem.title,
          thumbnail: malEntry.mainPicture?.medium || malEntry.mainPicture?.large || primaryItem.thumbnail,
          currentMalStatus: 'plan_to_watch',
          currentMalEpisodes: malEntry.watchedEpisodes,
          targetStatus,
          targetEpisodes,
          totalEpisodes: knownTotalEpisodes,
          reason: targetStatus === 'completed' ? 'complete_series' : 'promote_ptw',
          selected: true,
        });
        continue;
      }

      if (malEntry.status === 'watching') {
        if (targetStatus === 'completed') {
          let targetEpisodes = Math.max(clampedAppEpisodes, malEntry.watchedEpisodes);
          if (knownTotalEpisodes && knownTotalEpisodes > 0) {
            targetEpisodes = Math.min(targetEpisodes, knownTotalEpisodes);
          }
          proposals.push({
            malId: group.malId,
            animeId: primaryItem.animeId,
            animeIds: sortedItems.map((i) => i.animeId),
            title: malEntry.title || primaryItem.title,
            thumbnail: malEntry.mainPicture?.medium || malEntry.mainPicture?.large || primaryItem.thumbnail,
            currentMalStatus: 'watching',
            currentMalEpisodes: malEntry.watchedEpisodes,
            targetStatus: 'completed',
            targetEpisodes,
            totalEpisodes: knownTotalEpisodes,
            reason: 'complete_series',
            selected: true,
          });
          continue;
        }

        if (clampedAppEpisodes > malEntry.watchedEpisodes) {
          proposals.push({
            malId: group.malId,
            animeId: primaryItem.animeId,
            animeIds: sortedItems.map((i) => i.animeId),
            title: malEntry.title || primaryItem.title,
            thumbnail: malEntry.mainPicture?.medium || malEntry.mainPicture?.large || primaryItem.thumbnail,
            currentMalStatus: 'watching',
            currentMalEpisodes: malEntry.watchedEpisodes,
            targetStatus: 'watching',
            targetEpisodes: clampedAppEpisodes,
            totalEpisodes: knownTotalEpisodes,
            reason: 'advance_episodes',
            selected: true,
          });
          continue;
        }

        alreadySyncedCount++;
        continue;
      }

      // on_hold / dropped if somehow supplied in malEntries
      if (clampedAppEpisodes > malEntry.watchedEpisodes || targetStatus === 'completed') {
        const targetEpisodes = Math.max(clampedAppEpisodes, malEntry.watchedEpisodes);
        proposals.push({
          malId: group.malId,
          animeId: primaryItem.animeId,
          animeIds: sortedItems.map((i) => i.animeId),
          title: malEntry.title || primaryItem.title,
          thumbnail: malEntry.mainPicture?.medium || malEntry.mainPicture?.large || primaryItem.thumbnail,
          currentMalStatus: malEntry.status,
          currentMalEpisodes: malEntry.watchedEpisodes,
          targetStatus,
          targetEpisodes:
            knownTotalEpisodes && knownTotalEpisodes > 0
              ? Math.min(targetEpisodes, knownTotalEpisodes)
              : targetEpisodes,
          totalEpisodes: knownTotalEpisodes,
          reason: targetStatus === 'completed' ? 'complete_series' : 'advance_episodes',
          selected: true,
        });
      } else {
        alreadySyncedCount++;
      }
      continue;
    }

    // Not present in watching / plan_to_watch / completed on MAL
    proposals.push({
      malId: group.malId,
      animeId: primaryItem.animeId,
      animeIds: sortedItems.map((i) => i.animeId),
      title: primaryItem.title,
      thumbnail: primaryItem.thumbnail,
      currentMalStatus: 'not_in_list',
      currentMalEpisodes: 0,
      targetStatus,
      targetEpisodes: clampedAppEpisodes,
      totalEpisodes: knownTotalEpisodes,
      reason: targetStatus === 'completed' ? 'complete_series' : 'add_to_list',
      selected: true,
    });
  }

  proposals.sort((a, b) => a.title.localeCompare(b.title));
  unmapped.sort((a, b) => a.title.localeCompare(b.title));

  return {
    proposals,
    unmapped,
    alreadySyncedCount,
  };
}

class MalSyncServiceClass {
  private sessionAutoSyncedKeys = new Set<string>();
  private flushInFlight: Promise<{ flushed: number; remaining: number }> | null = null;

  clearSessionAutoSyncCacheForTest(): void {
    this.sessionAutoSyncedKeys.clear();
  }

  handleSyncScopeChanged(): void {
    this.sessionAutoSyncedKeys.clear();
    this.flushInFlight = null;
  }

  getPendingUpdates(scopeId?: string): MalPendingUpdate[] {
    const raw = AppStorage.getObject<unknown>(
      getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, scopeId)
    );
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is MalPendingUpdate =>
        Boolean(item && typeof item.malId === 'number' && item.malId > 0 && typeof item.watchedEpisodes === 'number')
    );
  }

  getPendingUpdatesCount(scopeId?: string): number {
    return this.getPendingUpdates(scopeId).length;
  }

  private savePendingUpdates(items: MalPendingUpdate[], scopeId?: string): void {
    const key = getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, scopeId);
    if (items.length === 0) {
      AppStorage.remove(key);
    } else {
      AppStorage.setObject(key, items);
    }
    notifyMalDataListeners();
  }

  private enqueuePendingUpdate(update: MalPendingUpdate): void {
    const current = this.getPendingUpdates();
    const idx = current.findIndex((item) => item.malId === update.malId);
    if (idx >= 0) {
      const prev = current[idx];
      current[idx] = {
        ...prev,
        ...update,
        watchedEpisodes: Math.max(prev.watchedEpisodes, update.watchedEpisodes),
        status:
          prev.status === 'completed' || update.status === 'completed'
            ? 'completed'
            : update.status,
        updatedAt: Math.max(prev.updatedAt, update.updatedAt),
      };
    } else {
      current.push(update);
    }
    this.savePendingUpdates(current);
  }

  private removeSatisfiedPendingUpdates(applied: Array<{ malId: number; watchedEpisodes: number }>): void {
    if (applied.length === 0) return;
    const current = this.getPendingUpdates();
    if (current.length === 0) return;

    const appliedMap = new Map<number, number>();
    for (const a of applied) {
      const prev = appliedMap.get(a.malId) || 0;
      if (a.watchedEpisodes > prev) appliedMap.set(a.malId, a.watchedEpisodes);
    }

    const remaining = current.filter((item) => {
      const doneEp = appliedMap.get(item.malId);
      return doneEp === undefined || item.watchedEpisodes > doneEp;
    });

    this.savePendingUpdates(remaining);
  }

  async computeAppToMalDiff(options?: {
    resolveMissingMappings?: boolean;
    malLists?: MalListCache | MalAnimeListEntry[] | null;
    onMappingProgress?: (completed: number, total: number) => void;
  }): Promise<MalDiffResult> {
    if (options?.resolveMissingMappings !== false) {
      const localSeries = collectLocalCompletedSeries();
      const ignored = new Set(getMalIgnoredAnimeIds());
      const candidateIds = Array.from(localSeries.keys()).filter((id) => !ignored.has(id));
      await resolveMissingAnimeMalMappings(candidateIds, {
        concurrency: 2,
        onProgress: options?.onMappingProgress,
      });
    }

    return computeLocalAppToMalDiffSnapshot(options?.malLists);
  }

  async applyAppToMalProposals(proposals: MalSyncProposal[]): Promise<MalSyncApplyResult> {
    const active = proposals.filter((p) => p.selected);
    if (active.length === 0) {
      return { total: 0, succeeded: 0, failed: 0, errors: [] };
    }

    let succeeded = 0;
    const errors: Array<{ malId: number; title: string; message: string }> = [];
    const satisfied: Array<{ malId: number; watchedEpisodes: number }> = [];

    const concurrency = 2;
    for (let i = 0; i < active.length; i += concurrency) {
      const batch = active.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (p) => {
          try {
            const cached = findEntryInMalListCache(p.malId);
            await MalClient.updateAnimeListStatus(p.malId, {
              status: p.targetStatus,
              numWatchedEpisodes: p.targetEpisodes,
              animeSnapshot: cached || {
                malId: p.malId,
                title: p.title,
                numEpisodes: p.totalEpisodes ?? 0,
                mainPicture: p.thumbnail ? { medium: p.thumbnail } : undefined,
              },
            });
            succeeded++;
            satisfied.push({ malId: p.malId, watchedEpisodes: p.targetEpisodes });
          } catch (err: any) {
            errors.push({
              malId: p.malId,
              title: p.title,
              message: err?.message || 'Errore aggiornamento MyAnimeList',
            });
          }
        })
      );
      if (i + concurrency < active.length) {
        await sleep(150);
      }
    }

    this.removeSatisfiedPendingUpdates(satisfied);
    if (succeeded > 0) {
      setMalLastSyncTime(Date.now());
    }

    return {
      total: active.length,
      succeeded,
      failed: errors.length,
      errors,
    };
  }

  async maybeAutoSyncOnEpisodeComplete(params: {
    animeId: string;
    malId?: number | null;
    episodeNumber: number;
    title?: string;
    totalEpisodes?: number | string | null;
    isOngoingSeries?: boolean;
  }): Promise<MalAutoSyncResult> {
    return this.enqueueOrAutoSyncEpisode(params);
  }

  async enqueueOrAutoSyncEpisode(params: {
    animeId: string;
    malId?: number | null;
    episodeNumber: number;
    title?: string;
    totalEpisodes?: number | string | null;
    isOngoingSeries?: boolean;
  }): Promise<MalAutoSyncResult> {
    const settings = getMalSettings();
    if (settings.autoSyncMode === 'off') {
      return { status: 'disabled' };
    }

    if (!MalAuthService.isConnected()) {
      return { status: 'not_connected' };
    }

    const malId = params.malId;
    const ep = params.episodeNumber;
    if (
      typeof malId !== 'number' ||
      !Number.isFinite(malId) ||
      malId <= 0 ||
      !Number.isInteger(ep) ||
      ep <= 0
    ) {
      return { status: 'invalid' };
    }

    const scopeId = getActiveMalProfileScope();
    const normalizedMalId = Math.floor(malId);
    const dedupKey = `${scopeId}:${normalizedMalId}:${ep}`;
    if (this.sessionAutoSyncedKeys.has(dedupKey)) {
      return { status: 'deduped' };
    }

    const cached = findEntryInMalListCache(normalizedMalId);
    if (cached?.status === 'completed') {
      this.sessionAutoSyncedKeys.add(dedupKey);
      return { status: 'skipped_completed' };
    }

    const mapping = getMappingByAnimeId(params.animeId);

    const knownTotal =
      cached && cached.numEpisodes > 0
        ? cached.numEpisodes
        : parsePositiveTotalEpisodes(params.totalEpisodes) ?? mapping?.totalEpisodes ?? null;

    const isOngoing = cached?.mediaStatus
      ? cached.mediaStatus === 'currently_airing' || cached.mediaStatus === 'not_yet_aired'
      : Boolean(params.isOngoingSeries) || Boolean(mapping?.isOngoingSeries);

    const baseTargetEpisodes =
      knownTotal && knownTotal > 0 ? Math.min(ep, knownTotal) : ep;
    const rawTargetEpisodes = Math.max(baseTargetEpisodes, cached?.watchedEpisodes || 0);
    const targetEpisodes =
      knownTotal && knownTotal > 0 ? Math.min(rawTargetEpisodes, knownTotal) : rawTargetEpisodes;

    const qualifiesCompleted = Boolean(
      knownTotal && knownTotal > 0 && targetEpisodes >= knownTotal && !isOngoing
    );

    const targetStatus: MalListStatusValue = qualifiesCompleted ? 'completed' : 'watching';

    if (settings.autoSyncMode === 'completed_only' && targetStatus !== 'completed') {
      return { status: 'skipped_completed_only', targetStatus, targetEpisodes };
    }

    const isAlreadyWatching = cached?.status === 'watching';
    if (
      settings.watchingThresholdEnabled &&
      targetStatus === 'watching' &&
      !isAlreadyWatching &&
      targetEpisodes < settings.watchingThresholdEpisodes
    ) {
      return { status: 'below_watching_threshold', targetStatus, targetEpisodes };
    }

    if (
      isAlreadyWatching &&
      cached.watchedEpisodes >= targetEpisodes &&
      targetStatus !== 'completed'
    ) {
      this.sessionAutoSyncedKeys.add(dedupKey);
      return { status: 'skipped_already_ahead' };
    }

    this.sessionAutoSyncedKeys.add(dedupKey);

    try {
      await MalClient.updateAnimeListStatus(normalizedMalId, {
        status: targetStatus,
        numWatchedEpisodes: targetEpisodes,
        animeSnapshot: cached || {
          malId: normalizedMalId,
          title: params.title || `Anime #${normalizedMalId}`,
          numEpisodes: knownTotal ?? 0,
        },
      });
      this.removeSatisfiedPendingUpdates([{ malId: normalizedMalId, watchedEpisodes: targetEpisodes }]);
      setMalLastSyncTime(Date.now());
      return { status: 'synced', targetStatus, targetEpisodes };
    } catch (err: any) {
      if (err instanceof MalApiError && err.isAuthError) {
        return { status: 'auth_error' };
      }

      // Network, timeout, 429, or 5xx -> enqueue offline without clearing session
      this.enqueuePendingUpdate({
        malId: normalizedMalId,
        animeId: params.animeId,
        title: params.title || cached?.title,
        status: targetStatus,
        watchedEpisodes: targetEpisodes,
        totalEpisodes: knownTotal,
        isOngoingSeries: isOngoing,
        updatedAt: Date.now(),
      });
      return { status: 'queued', targetStatus, targetEpisodes };
    }
  }

  async flushPendingUpdates(): Promise<{ flushed: number; remaining: number }> {
    if (!MalAuthService.isConnected()) {
      return { flushed: 0, remaining: this.getPendingUpdatesCount() };
    }

    const queue = this.getPendingUpdates();
    if (queue.length === 0) {
      return { flushed: 0, remaining: 0 };
    }

    if (this.flushInFlight) {
      return await this.flushInFlight;
    }

    this.flushInFlight = this.executeFlush(queue).finally(() => {
      this.flushInFlight = null;
    });

    return await this.flushInFlight;
  }

  private async executeFlush(
    queue: MalPendingUpdate[]
  ): Promise<{ flushed: number; remaining: number }> {
    let flushed = 0;
    const satisfied: Array<{ malId: number; watchedEpisodes: number }> = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const cached = findEntryInMalListCache(item.malId);
        if (
          cached?.status === 'completed' ||
          (cached?.status === 'watching' &&
            cached.watchedEpisodes >= item.watchedEpisodes &&
            item.status !== 'completed')
        ) {
          flushed++;
          satisfied.push({ malId: item.malId, watchedEpisodes: item.watchedEpisodes });
          continue;
        }
        await MalClient.updateAnimeListStatus(item.malId, {
          status: item.status,
          numWatchedEpisodes: item.watchedEpisodes,
          animeSnapshot: cached || {
            malId: item.malId,
            title: item.title || `Anime #${item.malId}`,
            numEpisodes: item.totalEpisodes ?? 0,
          },
        });
        flushed++;
        satisfied.push({ malId: item.malId, watchedEpisodes: item.watchedEpisodes });
        if (i + 1 < queue.length) {
          await sleep(150);
        }
      } catch (err: any) {
        if (err instanceof MalApiError && err.isAuthError) {
          break;
        }
      }
    }

    this.removeSatisfiedPendingUpdates(satisfied);
    if (flushed > 0) {
      setMalLastSyncTime(Date.now());
    }

    return {
      flushed,
      remaining: this.getPendingUpdatesCount(),
    };
  }
}

export const MalSyncService = new MalSyncServiceClass();
