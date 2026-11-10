import {
  QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  AnimeDetail,
  AnimeHomePage,
  AnimeItem,
  AniListMedia,
  AniSkipResult,
  DirectVideoSource,
  Episode,
  EpisodeMetadata,
  SearchFilter,
} from "@/types";
import { AnimeWorldScraper } from "../scraper";
import type { SearchResult } from "../scraper/parsers/search.parser";
import { AniListService } from "../anilist";
import { KitsuService } from "../kitsu";
import { AniSkipService } from "../aniskip";
import { AppStorage } from "../storage";

export const animeQueryKeys = {
  all: ["anime"] as const,
  home: () => [...animeQueryKeys.all, "home"] as const,
  latest: (page = 1) => [...animeQueryKeys.all, "latest", page] as const,
  upcoming: (page = 1) => [...animeQueryKeys.all, "upcoming", page] as const,
  detail: (id: string) => [...animeQueryKeys.all, "detail", id] as const,
  search: (filter: SearchFilter | string) =>
    [...animeQueryKeys.all, "search", filter] as const,
  video: (episodeDataId: string, serverId = "9") =>
    [...animeQueryKeys.all, "video", episodeDataId, serverId] as const,
  anilist: (id?: number | null, title?: string | null) =>
    [...animeQueryKeys.all, "anilist", id ?? null, title ?? null] as const,
  kitsuId: (malId?: number | null, anilistId?: number | null, title?: string | null) =>
    [...animeQueryKeys.all, "kitsu", "id", malId ?? null, anilistId ?? null, title ?? null] as const,
  kitsuEpisodes: (kitsuId?: string | null, numbersKey?: string | null) =>
    [...animeQueryKeys.all, "kitsu", "episodes", kitsuId ?? null, numbersKey ?? null] as const,
  aniskip: (malId?: number | null, episodeNumber?: number | null) =>
    [...animeQueryKeys.all, "aniskip", malId ?? null, episodeNumber ?? null] as const,
};

// 1. Home Page Query Options
export const homeQueryOptions = () =>
  queryOptions({
    queryKey: animeQueryKeys.home(),
    queryFn: async () => {
      try {
        const data = await AnimeWorldScraper.getHomePage();
        if (data) {
          AppStorage.saveHomeData(data);
        }
        return data;
      } catch (err) {
        const cached = AppStorage.getHomeData();
        if (cached) {
          return cached;
        }
        throw err;
      }
    },
    initialData: () => AppStorage.getHomeData() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });

// 2. Latest Episodes Query Options
export const latestEpisodesQueryOptions = (page = 1) =>
  queryOptions({
    queryKey: animeQueryKeys.latest(page),
    queryFn: () => AnimeWorldScraper.getLatestEpisodes(page),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

// 2b. Upcoming Anime Query Options
export const upcomingAnimeQueryOptions = (page = 1) =>
  queryOptions({
    queryKey: animeQueryKeys.upcoming(page),
    queryFn: () => AnimeWorldScraper.getUpcoming(page),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

// 3. Anime Detail Query Options
export const animeDetailQueryOptions = (id: string, client?: QueryClient) =>
  queryOptions({
    queryKey: animeQueryKeys.detail(id),
    queryFn: async () => {
      if (!id || !id.trim()) {
        throw new Error("ID anime non specificato");
      }
      return AnimeWorldScraper.getAnimeDetail(id);
    },
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      if (!id) return undefined;

      // 1. Check in-memory queryClient Home cache
      if (client) {
        const homeData = client.getQueryData<AnimeHomePage>(animeQueryKeys.home());
        if (homeData) {
          const allHome = [
            ...(homeData.sliders || []),
            ...(homeData.all || []),
            ...(homeData.trending || []),
            ...(homeData.subITA || []),
            ...(homeData.dubbed || []),
            ...(homeData.ongoing || []),
            ...(homeData.newAdded || []),
            ...(homeData.upcoming || []),
            ...((homeData.topAnime || []).flat()),
          ];
          const match = allHome.find((item) => item.id === id);
          if (match) {
            return {
              id: match.id,
              title: match.title,
              thumbnail: match.thumbnail || "",
              banner: match.banner || match.thumbnail || "",
              synopsis: "",
              genres: match.genres || [],
              score: match.score,
              rating: match.score,
              status: match.status,
              releaseYear: match.releaseYear,
              link: match.link || `/play/${match.id}`,
              episodes: [],
              servers: [],
            } as AnimeDetail;
          }
        }
      }

      // 2. Check MMKV Home cache
      const cachedHome = AppStorage.getHomeData();
      if (cachedHome) {
        const allHome = [
          ...(cachedHome.sliders || []),
          ...(cachedHome.all || []),
          ...(cachedHome.trending || []),
          ...(cachedHome.subITA || []),
          ...(cachedHome.dubbed || []),
          ...(cachedHome.ongoing || []),
          ...(cachedHome.newAdded || []),
          ...(cachedHome.upcoming || []),
          ...((cachedHome.topAnime || []).flat()),
        ];
        const match = allHome.find((item) => item.id === id);
        if (match) {
          return {
            id: match.id,
            title: match.title,
            thumbnail: match.thumbnail || "",
            banner: match.banner || match.thumbnail || "",
            synopsis: "",
            genres: match.genres || [],
            score: match.score,
            rating: match.score,
            status: match.status,
            releaseYear: match.releaseYear,
            link: match.link || `/play/${match.id}`,
            episodes: [],
            servers: [],
          } as AnimeDetail;
        }
      }

      // 3. Check MMKV Favorites
      const favorites = AppStorage.getFavorites();
      const fav = favorites.find((f) => f.id === id);
      if (fav) {
        return {
          id: fav.id,
          title: fav.title,
          thumbnail: fav.thumbnail || "",
          banner: fav.banner || fav.thumbnail || "",
          synopsis: "",
          genres: fav.genres || [],
          score: fav.score,
          rating: fav.score,
          status: fav.status,
          releaseYear: fav.releaseYear,
          link: fav.link || `/play/${fav.id}`,
          episodes: [],
          servers: [],
        } as AnimeDetail;
      }

      // 4. Check MMKV Continue Watching
      const continueWatching = AppStorage.getContinueWatching();
      const cw = continueWatching.find((c) => c.animeId === id);
      if (cw) {
        return {
          id: cw.animeId,
          title: cw.title,
          thumbnail: cw.thumbnail || "",
          banner: cw.thumbnail || "",
          synopsis: "",
          genres: [],
          link: `/play/${cw.animeId}`,
          episodes: [],
          servers: [],
        } as AnimeDetail;
      }

      return undefined;
    },
    enabled: Boolean(id && id.trim().length > 0),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

// 4. Search Query Options
export const animeSearchQueryOptions = (filter: SearchFilter | string) =>
  queryOptions({
    queryKey: animeQueryKeys.search(filter),
    queryFn: ({ signal }) => AnimeWorldScraper.searchAnime(filter, signal),
    staleTime: 5 * 60 * 1000,
  });


// 5. Episode Video Stream Query Options
export const episodeVideoQueryOptions = (
  episode: Episode | null | undefined,
  serverId = "9",
) =>
  queryOptions({
    queryKey: animeQueryKeys.video(episode?.dataId || "", serverId),
    queryFn: () =>
      episode ? AnimeWorldScraper.resolveEpisodeVideo(episode, serverId) : null,
    enabled: Boolean(episode?.dataId),
    staleTime: 5 * 60 * 1000, // 5 minutes (stream tokens/URLs expire)
    gcTime: 10 * 60 * 1000,
  });

// 6. AniList Media Metadata Query Options
export const aniListMediaQueryOptions = (
  anilistId?: number | null,
  fallbackTitle?: string | null,
) =>
  queryOptions({
    queryKey: animeQueryKeys.anilist(anilistId, fallbackTitle),
    queryFn: () =>
      AniListService.fetchMediaWithFallback(anilistId, fallbackTitle),
    enabled: Boolean(
      (anilistId && anilistId > 0) ||
      (fallbackTitle && fallbackTitle.trim().length > 0),
    ),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000,
  });

// 7. Kitsu Anime ID Query Options
export const kitsuAnimeIdQueryOptions = (
  malId?: number | null,
  anilistId?: number | null,
  fallbackTitle?: string | null,
) =>
  queryOptions({
    queryKey: animeQueryKeys.kitsuId(malId, anilistId, fallbackTitle),
    queryFn: () =>
      KitsuService.findKitsuAnimeId({
        malId,
        anilistId,
        title: fallbackTitle,
      }),
    enabled: Boolean(
      (malId && malId > 0) ||
      (anilistId && anilistId > 0) ||
      (fallbackTitle && fallbackTitle.trim().length > 0),
    ),
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000,
  });

// 8. Kitsu Episode Metadata Query Options
export const kitsuEpisodesQueryOptions = (
  kitsuId?: string | null,
  episodeNumbers?: number[],
) => {
  const sortedNumbers = episodeNumbers ? [...episodeNumbers].sort((a, b) => a - b) : [];
  const numbersKey = sortedNumbers.join(",");

  return queryOptions({
    queryKey: animeQueryKeys.kitsuEpisodes(kitsuId, numbersKey),
    queryFn: () =>
      kitsuId && sortedNumbers.length > 0
        ? KitsuService.fetchEpisodesBatch(kitsuId, sortedNumbers)
        : ({} as Record<number, EpisodeMetadata>),
    enabled: Boolean(kitsuId && sortedNumbers.length > 0),
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000,
  });
};

// 9. AniSkip Skip Times Query Options
export const aniSkipQueryOptions = (
  malId?: number | null,
  episodeNumber?: number | null,
  episodeLength = 0,
  enabled = true,
) =>
  queryOptions({
    queryKey: animeQueryKeys.aniskip(malId, episodeNumber),
    queryFn: ({ signal }) =>
      malId && malId > 0 && episodeNumber !== undefined && episodeNumber !== null
        ? AniSkipService.getSkipTimes({
            malId,
            episodeNumber,
            episodeLength,
            signal,
          })
        : Promise.resolve([]),
    enabled: Boolean(
      enabled &&
      malId &&
      malId > 0 &&
      episodeNumber !== undefined &&
      episodeNumber !== null &&
      episodeNumber >= 0,
    ),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000,
  });

// React Query Custom Hooks

export function useAnimeHome(): UseQueryResult<AnimeHomePage, Error> {
  return useQuery(homeQueryOptions());
}

export function useAnimeLatest(page = 1): UseQueryResult<AnimeItem[], Error> {
  return useQuery(latestEpisodesQueryOptions(page));
}

export function useAnimeDetail(
  id: string,
): UseQueryResult<AnimeDetail, Error> {
  const client = useQueryClient();
  return useQuery(animeDetailQueryOptions(id, client));
}

export function useAnimeSearch(
  filter: SearchFilter | string,
  options?: { enabled?: boolean },
): UseQueryResult<SearchResult, Error> {
  const hasFilter =
    typeof filter === "string"
      ? filter.trim().length > 0
      : Boolean(
          (filter.query && filter.query.trim().length > 0) ||
          (filter.keyword && filter.keyword.trim().length > 0) ||
          filter.genre !== undefined ||
          filter.year !== undefined ||
          filter.type !== undefined,
        );

  return useQuery({
    ...animeSearchQueryOptions(filter),
    enabled: options?.enabled ?? hasFilter,
  });
}

export function useEpisodeVideo(
  episode: Episode | null | undefined,
  serverId = "9",
  options?: { enabled?: boolean },
): UseQueryResult<DirectVideoSource | null, Error> {
  return useQuery({
    ...episodeVideoQueryOptions(episode, serverId),
    enabled: Boolean(options?.enabled !== false && episode?.dataId),
  });
}

export function useAniListMedia(
  anilistId?: number | null,
  fallbackTitle?: string | null,
): UseQueryResult<AniListMedia | null, Error> {
  return useQuery(aniListMediaQueryOptions(anilistId, fallbackTitle));
}

export function useKitsuAnimeId(
  malId?: number | null,
  anilistId?: number | null,
  fallbackTitle?: string | null,
  options?: { enabled?: boolean },
): UseQueryResult<string | null, Error> {
  const baseOptions = kitsuAnimeIdQueryOptions(malId, anilistId, fallbackTitle);
  return useQuery({
    ...baseOptions,
    enabled:
      options?.enabled !== undefined
        ? Boolean(options.enabled && baseOptions.enabled)
        : baseOptions.enabled,
  });
}

export function useKitsuEpisodes(
  kitsuId?: string | null,
  episodeNumbers?: number[],
  options?: { enabled?: boolean },
): UseQueryResult<Record<number, EpisodeMetadata>, Error> {
  const baseOptions = kitsuEpisodesQueryOptions(kitsuId, episodeNumbers);
  return useQuery({
    ...baseOptions,
    enabled:
      options?.enabled !== undefined
        ? Boolean(options.enabled && baseOptions.enabled)
        : baseOptions.enabled,
  });
}

export function useAnimeEpisodeMetadata({
  malId,
  anilistId,
  title,
  episodeNumbers,
  enabled = true,
}: {
  malId?: number | null;
  anilistId?: number | null;
  title?: string | null;
  episodeNumbers?: number[];
  enabled?: boolean;
}): {
  kitsuId: string | null | undefined;
  metadataMap: Record<number, EpisodeMetadata>;
  isLoading: boolean;
} {
  const { data: kitsuId, isLoading: isIdLoading } = useKitsuAnimeId(
    malId,
    anilistId,
    title,
    { enabled },
  );
  const { data: episodesData, isLoading: isEpisodesLoading } = useKitsuEpisodes(
    kitsuId,
    episodeNumbers,
    {
      enabled: Boolean(
        enabled && kitsuId && (episodeNumbers?.length ?? 0) > 0,
      ),
    },
  );

  return {
    kitsuId,
    metadataMap: episodesData || {},
    isLoading: isIdLoading || isEpisodesLoading,
  };
}

export function useAniSkipTimes(params: {
  malId?: number | null;
  episodeNumber?: number | null;
  episodeLength?: number;
  enabled?: boolean;
}): UseQueryResult<AniSkipResult[], Error> {
  const { malId, episodeNumber, episodeLength = 0, enabled = true } = params;
  return useQuery(aniSkipQueryOptions(malId, episodeNumber, episodeLength, enabled));
}

// Prefetch helpers for fast TV remote navigation
export async function prefetchAnimeDetail(
  queryClient: QueryClient,
  id: string,
): Promise<void> {
  if (!id) return;
  await queryClient.prefetchQuery(animeDetailQueryOptions(id));
}

export async function prefetchEpisodeVideo(
  queryClient: QueryClient,
  episode: Episode,
  serverId = "9",
): Promise<void> {
  if (!episode?.dataId) return;
  await queryClient.prefetchQuery(episodeVideoQueryOptions(episode, serverId));
}
