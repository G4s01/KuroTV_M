import axios from "axios";
import type { EpisodeMetadata } from "@/types";
import { AppStorage } from "../storage";
import { cleanSynopsis, sanitizeTitleForSearch } from "../scraper/utils";

export const KITSU_API_BASE = "https://kitsu.io/api/edge";

interface RawKitsuMappingItem {
  id: string;
  type: string;
  relationships?: {
    item?: {
      data?: {
        id: string;
        type: string;
      };
    };
  };
}

interface RawKitsuAnimeIncluded {
  id: string;
  type: string;
}

interface RawKitsuEpisodeItem {
  id: string;
  type: string;
  attributes?: {
    number?: number;
    synopsis?: string;
    description?: string;
    canonicalTitle?: string;
    titles?: Record<string, string>;
    airdate?: string;
    length?: number;
    thumbnail?: {
      original?: string;
      medium?: string;
      tiny?: string;
    };
  };
}

export const KitsuService = {
  /**
   * Discovers the Kitsu Anime ID using prioritized fallback:
   * 1. Cache check in MMKV
   * 2. MyAnimeList ID mapping (`myanimelist/anime`)
   * 3. AniList ID mapping (`anilist/anime`)
   * 4. Text title search (`filter[text]=...`)
   */
  async findKitsuAnimeId(params: {
    malId?: number | null;
    anilistId?: number | null;
    title?: string | null;
  }): Promise<string | null> {
    const { malId, anilistId, title } = params;

    // 1. Check MMKV cache
    if (malId && malId > 0) {
      const cached = AppStorage.getKitsuAnimeId(`mal:${malId}`);
      if (cached) return cached;
    }
    if (anilistId && anilistId > 0) {
      const cached = AppStorage.getKitsuAnimeId(`anilist:${anilistId}`);
      if (cached) return cached;
    }
    const cleanTitle = title ? sanitizeTitleForSearch(title) : "";
    const titleKey = cleanTitle ? cleanTitle.toLowerCase() : "";
    if (titleKey) {
      const cached = AppStorage.getKitsuAnimeId(`title:${titleKey}`);
      if (cached) return cached;
    }

    const headers = {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    };

    // 2. Lookup via MyAnimeList ID mapping
    if (malId && malId > 0) {
      try {
        const url = `${KITSU_API_BASE}/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item`;
        const res = await axios.get<{
          data?: RawKitsuMappingItem[];
          included?: RawKitsuAnimeIncluded[];
        }>(url, { headers, timeout: 10000 });

        const mappedId =
          res.data?.data?.[0]?.relationships?.item?.data?.id ||
          res.data?.included?.find((i) => i.type === "anime")?.id;

        if (mappedId) {
          AppStorage.setKitsuAnimeId(`mal:${malId}`, mappedId);
          if (anilistId && anilistId > 0) {
            AppStorage.setKitsuAnimeId(`anilist:${anilistId}`, mappedId);
          }
          if (titleKey) {
            AppStorage.setKitsuAnimeId(`title:${titleKey}`, mappedId);
          }
          return mappedId;
        }
      } catch (err) {
        console.warn(`[KitsuService] MAL mapping lookup failed for malId=${malId}:`, err);
      }
    }

    // 3. Lookup via AniList ID mapping
    if (anilistId && anilistId > 0) {
      try {
        const url = `${KITSU_API_BASE}/mappings?filter[externalSite]=anilist/anime&filter[externalId]=${anilistId}&include=item`;
        const res = await axios.get<{
          data?: RawKitsuMappingItem[];
          included?: RawKitsuAnimeIncluded[];
        }>(url, { headers, timeout: 10000 });

        const mappedId =
          res.data?.data?.[0]?.relationships?.item?.data?.id ||
          res.data?.included?.find((i) => i.type === "anime")?.id;

        if (mappedId) {
          AppStorage.setKitsuAnimeId(`anilist:${anilistId}`, mappedId);
          if (titleKey) {
            AppStorage.setKitsuAnimeId(`title:${titleKey}`, mappedId);
          }
          return mappedId;
        }
      } catch (err) {
        console.warn(`[KitsuService] AniList mapping lookup failed for anilistId=${anilistId}:`, err);
      }
    }

    // 4. Fallback: text search on Kitsu anime catalog
    if (cleanTitle) {
      try {
        const searchUrl = `${KITSU_API_BASE}/anime?filter[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`;
        const res = await axios.get<{ data?: { id: string }[] }>(searchUrl, {
          headers,
          timeout: 10000,
        });

        const foundId = res.data?.data?.[0]?.id;
        if (foundId) {
          if (titleKey) {
            AppStorage.setKitsuAnimeId(`title:${titleKey}`, foundId);
          }
          return foundId;
        }

        // Secondary fallback: title before punctuation / colon / dash
        const baseTitle = cleanTitle.split(/[:\-\–\—]/)[0].trim();
        if (baseTitle && baseTitle.length > 2 && baseTitle !== cleanTitle) {
          const subSearchUrl = `${KITSU_API_BASE}/anime?filter[text]=${encodeURIComponent(baseTitle)}&page[limit]=1`;
          const subRes = await axios.get<{ data?: { id: string }[] }>(subSearchUrl, {
            headers,
            timeout: 10000,
          });
          const subFoundId = subRes.data?.data?.[0]?.id;
          if (subFoundId) {
            if (titleKey) {
              AppStorage.setKitsuAnimeId(`title:${titleKey}`, subFoundId);
            }
            return subFoundId;
          }
        }
      } catch (err) {
        console.warn(`[KitsuService] Text search failed for title="${cleanTitle}":`, err);
      }
    }

    return null;
  },

  /**
   * Fetches metadata for a list of episode numbers for a given Kitsu Anime ID.
   * Leverages MMKV caching and respects Kitsu's strict limit of page[limit]=20.
   */
  async fetchEpisodesBatch(
    kitsuId: string,
    episodeNumbers: number[],
  ): Promise<Record<number, EpisodeMetadata>> {
    if (!kitsuId || !episodeNumbers || episodeNumbers.length === 0) {
      return {};
    }

    const uniqueNumbers = Array.from(
      new Set(episodeNumbers.filter((n) => typeof n === "number" && n >= 0)),
    );

    // 1. Read MMKV cache
    const cached = AppStorage.getKitsuEpisodes(kitsuId);
    const missing = uniqueNumbers.filter((n) => !cached[n]);

    if (missing.length === 0) {
      const result: Record<number, EpisodeMetadata> = {};
      for (const num of uniqueNumbers) {
        if (cached[num]) result[num] = cached[num];
      }
      return result;
    }

    // 2. Fetch missing episodes in chunks of max 20 (enforced by Kitsu)
    const newlyFetched: Record<number, EpisodeMetadata> = {};
    const headers = {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    };

    const chunks: number[][] = [];
    for (let i = 0; i < missing.length; i += 20) {
      chunks.push(missing.slice(i, i + 20));
    }

    for (const chunk of chunks) {
      try {
        const url = `${KITSU_API_BASE}/anime/${kitsuId}/episodes?filter[number]=${chunk.join(",")}&page[limit]=20&sort=number`;
        const res = await axios.get<{ data?: RawKitsuEpisodeItem[] }>(url, {
          headers,
          timeout: 10000,
        });

        const items = res.data?.data || [];
        for (const item of items) {
          const num = item.attributes?.number;
          if (typeof num === "number" && num >= 0) {
            const rawSynopsis =
              item.attributes?.synopsis || item.attributes?.description || "";
            const synopsis = rawSynopsis ? cleanSynopsis(rawSynopsis) : undefined;
            const thumbnail =
              item.attributes?.thumbnail?.original ||
              item.attributes?.thumbnail?.medium ||
              item.attributes?.thumbnail?.tiny ||
              undefined;
            const title =
              item.attributes?.canonicalTitle ||
              item.attributes?.titles?.en_us ||
              item.attributes?.titles?.en_jp ||
              item.attributes?.titles?.ja_jp ||
              (item.attributes?.titles
                ? Object.values(item.attributes.titles)[0]
                : undefined);

            newlyFetched[num] = {
              episodeNumber: num,
              title,
              synopsis,
              thumbnail,
              airdate: item.attributes?.airdate || undefined,
              length: item.attributes?.length || undefined,
            };
          }
        }

        // Cache empty entry for requested chunk numbers that Kitsu does not catalog
        // to prevent repetitive redundant network calls on subsequent renders
        for (const reqNum of chunk) {
          if (!newlyFetched[reqNum]) {
            newlyFetched[reqNum] = {
              episodeNumber: reqNum,
            };
          }
        }
      } catch (err) {
        console.warn(
          `[KitsuService] Failed to fetch episodes chunk [${chunk.join(",")}] for kitsuId=${kitsuId}:`,
          err,
        );
      }
    }

    // 3. Persist new episodes to MMKV
    if (Object.keys(newlyFetched).length > 0) {
      AppStorage.saveKitsuEpisodes(kitsuId, newlyFetched);
    }

    // 4. Return merged map for requested numbers
    const merged = { ...cached, ...newlyFetched };
    const finalResult: Record<number, EpisodeMetadata> = {};
    for (const num of uniqueNumbers) {
      if (merged[num]) {
        finalResult[num] = merged[num];
      }
    }
    return finalResult;
  },
};
