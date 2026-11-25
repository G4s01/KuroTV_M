import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { MalAuthError, MalAuthService } from './auth';
import {
  MAL_API_BASE_URL,
  findEntryInMalListCache,
  removeEntryFromMalListCache,
  saveMalListCache,
  saveMalStatusListToCache,
  upsertEntryInMalListCache,
} from './config';
import type {
  MalAnimeListEntry,
  MalAnimeStatusDetails,
  MalEditableStatus,
  MalListCache,
  MalListStatusValue,
  MalUserProfile,
} from './types';

const MAX_LIST_PAGES = 20;

export class MalApiError extends Error {
  status?: number;
  isRateLimit: boolean;
  isNetworkError: boolean;
  isAuthError: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      isRateLimit?: boolean;
      isNetworkError?: boolean;
      isAuthError?: boolean;
    }
  ) {
    super(message);
    this.name = 'MalApiError';
    this.status = options?.status;
    this.isRateLimit = Boolean(options?.isRateLimit);
    this.isNetworkError = Boolean(options?.isNetworkError);
    this.isAuthError = Boolean(options?.isAuthError);
  }
}

function normalizeListNodeEntry(
  rawNode: any,
  rawListStatus: any,
  fallbackStatus: MalEditableStatus = 'watching'
): MalAnimeListEntry | null {
  const malId = Number(rawNode?.id);
  if (!Number.isFinite(malId) || malId <= 0) return null;

  const rawStatus = rawListStatus?.status;
  const status: MalEditableStatus =
    rawStatus === 'watching' ||
    rawStatus === 'plan_to_watch' ||
    rawStatus === 'completed' ||
    rawStatus === 'on_hold' ||
    rawStatus === 'dropped'
      ? rawStatus
      : fallbackStatus;

  const watchedRaw =
    typeof rawListStatus?.num_episodes_watched === 'number'
      ? rawListStatus.num_episodes_watched
      : typeof rawListStatus?.num_watched_episodes === 'number'
      ? rawListStatus.num_watched_episodes
      : 0;

  return {
    malId,
    title: typeof rawNode?.title === 'string' && rawNode.title.trim() ? rawNode.title.trim() : `Anime #${malId}`,
    mainPicture: rawNode?.main_picture
      ? {
          medium: rawNode.main_picture.medium,
          large: rawNode.main_picture.large,
        }
      : undefined,
    status,
    score: typeof rawListStatus?.score === 'number' ? rawListStatus.score : 0,
    watchedEpisodes: Math.max(0, Math.floor(watchedRaw)),
    numEpisodes: typeof rawNode?.num_episodes === 'number' && rawNode.num_episodes > 0 ? rawNode.num_episodes : 0,
    mediaStatus: typeof rawNode?.status === 'string' ? rawNode.status : undefined,
    mediaType: typeof rawNode?.media_type === 'string' ? rawNode.media_type : undefined,
    mean: typeof rawNode?.mean === 'number' ? rawNode.mean : undefined,
    alternativeTitles: rawNode?.alternative_titles
      ? {
          synonyms: Array.isArray(rawNode.alternative_titles.synonyms)
            ? rawNode.alternative_titles.synonyms
            : undefined,
          en: typeof rawNode.alternative_titles.en === 'string' ? rawNode.alternative_titles.en : undefined,
          ja: typeof rawNode.alternative_titles.ja === 'string' ? rawNode.alternative_titles.ja : undefined,
        }
      : undefined,
    updatedAt: typeof rawListStatus?.updated_at === 'string' ? rawListStatus.updated_at : undefined,
  };
}

class MalClientClass {
  private http: AxiosInstance = axios.create({
    baseURL: MAL_API_BASE_URL,
    timeout: 15000,
  });

  setAxiosInstanceForTest(instance?: AxiosInstance | null): void {
    this.http =
      instance ||
      axios.create({
        baseURL: MAL_API_BASE_URL,
        timeout: 15000,
      });
  }

  private async requestWithAuth<T = any>(config: AxiosRequestConfig, retried = false): Promise<T> {
    let token: string;
    try {
      token = await MalAuthService.getValidAccessToken(retried);
    } catch (err: any) {
      if (err instanceof MalAuthError) {
        throw new MalApiError(err.message, {
          status: err.status,
          isAuthError: err.status === 401 || err.status === 403 || err.isRevoked,
          isNetworkError: !err.status,
        });
      }
      throw err;
    }

    try {
      const response = await this.http.request<T>({
        ...config,
        headers: {
          Accept: 'application/json',
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (err: any) {
      const status: number | undefined =
        typeof err?.response?.status === 'number' ? err.response.status : err?.status;

      if (status === 401 && !retried) {
        // Single forced-refresh retry
        return await this.requestWithAuth<T>(config, true);
      }

      if (status === 401 || status === 403) {
        if (retried) {
          MalAuthService.revokeSessionOnAuthFailure();
        }
        throw new MalApiError('Autorizzazione MyAnimeList non valida o scaduta.', {
          status,
          isAuthError: true,
        });
      }

      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Errore richiesta MyAnimeList';

      if (status === 429) {
        throw new MalApiError('Troppe richieste verso MyAnimeList (rate limit). Riprova tra poco.', {
          status,
          isRateLimit: true,
        });
      }

      throw new MalApiError(String(apiMsg), {
        status,
        isNetworkError: !status,
      });
    }
  }

  async getCurrentUser(): Promise<MalUserProfile> {
    const data = await this.requestWithAuth<any>({
      method: 'GET',
      url: `${MAL_API_BASE_URL}/users/@me?fields=id,name,picture`,
    });
    return {
      id: Number(data?.id) || 0,
      name: typeof data?.name === 'string' ? data.name : 'Utente MAL',
      picture: typeof data?.picture === 'string' ? data.picture : undefined,
    };
  }

  async fetchUserAnimeList(status: MalListStatusValue): Promise<MalAnimeListEntry[]> {
    const fields =
      'list_status,num_episodes,alternative_titles,media_type,status,main_picture,mean';
    let nextUrl: string | null =
      `${MAL_API_BASE_URL}/users/@me/animelist?status=${encodeURIComponent(status)}&limit=1000&sort=list_updated_at&nsfw=true&fields=${fields}`;

    const dedupMap = new Map<number, MalAnimeListEntry>();
    let pageCount = 0;

    while (nextUrl && pageCount < MAX_LIST_PAGES) {
      pageCount++;
      const data: { data?: any[]; paging?: { next?: string } } = await this.requestWithAuth({
        method: 'GET',
        url: nextUrl,
      });

      const items = Array.isArray(data?.data) ? data.data : [];
      for (const row of items) {
        const entry = normalizeListNodeEntry(row?.node, row?.list_status, status);
        if (entry && !dedupMap.has(entry.malId)) {
          dedupMap.set(entry.malId, entry);
        }
      }

      const rawNext: unknown = data?.paging?.next;
      if (
        typeof rawNext === 'string' &&
        rawNext.trim().startsWith('https://api.myanimelist.net/')
      ) {
        nextUrl = rawNext.trim();
      } else {
        nextUrl = null;
      }
    }

    const entries = Array.from(dedupMap.values());
    saveMalStatusListToCache(status, entries);
    return entries;
  }

  async fetchAllTrackedLists(): Promise<MalListCache> {
    const watching = await this.fetchUserAnimeList('watching');
    const plan_to_watch = await this.fetchUserAnimeList('plan_to_watch');
    const completed = await this.fetchUserAnimeList('completed');

    const cache: MalListCache = {
      watching,
      plan_to_watch,
      completed,
      updatedAt: Date.now(),
    };
    saveMalListCache(cache);
    return cache;
  }

  async getAnimeUserStatus(malId: number): Promise<MalAnimeStatusDetails> {
    const fields =
      'id,title,num_episodes,status,my_list_status,main_picture,mean,media_type,alternative_titles';
    const data = await this.requestWithAuth<any>({
      method: 'GET',
      url: `${MAL_API_BASE_URL}/anime/${Math.floor(malId)}?fields=${fields}`,
    });

    const listEntry = data?.my_list_status
      ? normalizeListNodeEntry(data, data.my_list_status, data.my_list_status.status || 'watching')
      : null;

    if (listEntry) {
      upsertEntryInMalListCache(listEntry);
    } else if (findEntryInMalListCache(Math.floor(malId))) {
      removeEntryFromMalListCache(Math.floor(malId));
    }

    return {
      malId: Number(data?.id) || malId,
      title: typeof data?.title === 'string' ? data.title : `Anime #${malId}`,
      numEpisodes: typeof data?.num_episodes === 'number' && data.num_episodes > 0 ? data.num_episodes : 0,
      mediaStatus: typeof data?.status === 'string' ? data.status : undefined,
      mediaType: typeof data?.media_type === 'string' ? data.media_type : undefined,
      mean: typeof data?.mean === 'number' ? data.mean : undefined,
      mainPicture: data?.main_picture
        ? {
            medium: data.main_picture.medium,
            large: data.main_picture.large,
          }
        : undefined,
      alternativeTitles: data?.alternative_titles,
      listEntry,
    };
  }

  async updateAnimeListStatus(
    malId: number,
    payload: {
      status?: MalEditableStatus;
      numWatchedEpisodes?: number;
      score?: number;
      animeSnapshot?: Partial<MalAnimeListEntry>;
    }
  ): Promise<{
    status: MalEditableStatus;
    score: number;
    watchedEpisodes: number;
    updatedAt?: string;
  }> {
    const form = new URLSearchParams();
    if (payload.status) {
      form.set('status', payload.status);
    }
    if (typeof payload.numWatchedEpisodes === 'number' && Number.isFinite(payload.numWatchedEpisodes)) {
      form.set('num_watched_episodes', String(Math.max(0, Math.floor(payload.numWatchedEpisodes))));
    }
    if (typeof payload.score === 'number' && Number.isFinite(payload.score)) {
      form.set('score', String(Math.max(0, Math.min(10, Math.round(payload.score)))));
    }

    const data = await this.requestWithAuth<any>({
      method: 'PATCH',
      url: `${MAL_API_BASE_URL}/anime/${Math.floor(malId)}/my_list_status`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: form.toString(),
    });

    const resolvedStatus: MalEditableStatus =
      data?.status === 'watching' ||
      data?.status === 'plan_to_watch' ||
      data?.status === 'completed' ||
      data?.status === 'on_hold' ||
      data?.status === 'dropped'
        ? data.status
        : payload.status || 'watching';

    const resolvedWatched =
      typeof data?.num_episodes_watched === 'number'
        ? data.num_episodes_watched
        : typeof payload.numWatchedEpisodes === 'number'
        ? Math.max(0, Math.floor(payload.numWatchedEpisodes))
        : 0;

    const resolvedScore =
      typeof data?.score === 'number'
        ? data.score
        : typeof payload.score === 'number'
        ? Math.max(0, Math.min(10, Math.round(payload.score)))
        : 0;

    const updatedAt = typeof data?.updated_at === 'string' ? data.updated_at : new Date().toISOString();

    if (payload.animeSnapshot?.title || resolvedStatus) {
      upsertEntryInMalListCache({
        malId: Math.floor(malId),
        title: payload.animeSnapshot?.title || `Anime #${malId}`,
        mainPicture: payload.animeSnapshot?.mainPicture,
        status: resolvedStatus,
        score: resolvedScore,
        watchedEpisodes: resolvedWatched,
        numEpisodes: payload.animeSnapshot?.numEpisodes ?? 0,
        mediaStatus: payload.animeSnapshot?.mediaStatus,
        mediaType: payload.animeSnapshot?.mediaType,
        mean: payload.animeSnapshot?.mean,
        alternativeTitles: payload.animeSnapshot?.alternativeTitles,
        updatedAt,
      });
    }

    return {
      status: resolvedStatus,
      score: resolvedScore,
      watchedEpisodes: resolvedWatched,
      updatedAt,
    };
  }

  async deleteAnimeListEntry(malId: number): Promise<void> {
    try {
      await this.requestWithAuth({
        method: 'DELETE',
        url: `${MAL_API_BASE_URL}/anime/${Math.floor(malId)}/my_list_status`,
      });
    } catch (err: any) {
      if (err instanceof MalApiError && err.status === 404) {
        // Already removed on MAL
      } else {
        throw err;
      }
    }
    removeEntryFromMalListCache(Math.floor(malId));
  }
}

export const MalClient = new MalClientClass();
