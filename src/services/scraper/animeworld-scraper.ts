import type {
  AnimeDetail,
  AnimeHomePage,
  AnimeItem,
  DirectVideoSource,
  Episode,
  EpisodeInfoApiResponse,
  SchedulePageData,
  ScraperConfig,
  SearchFilter,
} from "@/types";
import { HttpClient, defaultHttpClient } from "./http-client";
import { scraperConfig } from "./config";
import { parseHomePage } from "./parsers/home.parser";
import { parseDetailPage } from "./parsers/detail.parser";
import { parseSchedulePage } from "./parsers/schedule.parser";
import { buildFilterQuery, parseSearchPage } from "./parsers/search.parser";
import type { SearchResult } from "./parsers/search.parser";
import { resolveVideoSource } from "./parsers/video.parser";
import { resolveUrl } from "./utils";

export class AnimeWorldScraperService {
  private httpClient: HttpClient;

  constructor(client: HttpClient = defaultHttpClient) {
    this.httpClient = client;
  }

  public getHttpClient(): HttpClient {
    return this.httpClient;
  }

  public setTld(tld: string): void {
    scraperConfig.setTld(tld);
  }

  public getTld(): string {
    return scraperConfig.getTld();
  }

  public setBaseUrl(url: string): void {
    scraperConfig.setBaseUrl(url);
  }

  public getBaseUrl(): string {
    return scraperConfig.getBaseUrl();
  }

  public getConfig(): ScraperConfig {
    return scraperConfig.getConfig();
  }

  /**
   * Fetches and parses the AnimeWorld Home Page (Hero slider 16:9, tabs, ranking, upcoming)
   */
  public async getHomePage(): Promise<AnimeHomePage> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      const html = await this.httpClient.getPage(endpoints.sitePrefixNoS);
      return parseHomePage(html, endpoints.sitePrefixNoS);
    } catch (error) {
      console.warn("[AnimeWorldScraper] getHomePage error:", error);
      throw error;
    }
  }

  /**
   * Fetches latest updated episodes page
   */
  public async getLatestEpisodes(page = 1): Promise<AnimeItem[]> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      const url = `${endpoints.last}${page}`;
      const html = await this.httpClient.getPage(url);
      const result = parseSearchPage(html, endpoints.sitePrefixNoS);
      return result.items;
    } catch (error) {
      console.warn("[AnimeWorldScraper] getLatestEpisodes error:", error);
      throw error;
    }
  }

  /**
   * Fetches seasonal upcoming anime from /upcoming
   */
  public async getUpcoming(page = 1): Promise<AnimeItem[]> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      const url = `${endpoints.sitePrefixNoS}/upcoming${page > 1 ? `?page=${page}` : ""}`;
      const html = await this.httpClient.getPage(url);
      const result = parseSearchPage(html, endpoints.sitePrefixNoS);
      return result.items;
    } catch (error) {
      console.warn("[AnimeWorldScraper] getUpcoming error:", error);
      throw error;
    }
  }

  /**
   * Fetches weekly anime schedule/palinsesto from /schedule
   */
  public async getSchedule(): Promise<SchedulePageData> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      const url = endpoints.schedule || `${endpoints.sitePrefixNoS}/schedule`;
      const html = await this.httpClient.getPage(url);
      return parseSchedulePage(html, endpoints.sitePrefixNoS);
    } catch (error) {
      console.warn("[AnimeWorldScraper] getSchedule error:", error);
      throw error;
    }
  }

  /**
   * Searches anime by keyword or advanced filter options
   */
  public async searchAnime(
    filter: SearchFilter | string,
    signal?: AbortSignal,
  ): Promise<SearchResult> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      let url = "";

      if (typeof filter === "string") {
        url = `${endpoints.searchPageUrl}${encodeURIComponent(filter.trim())}`;
      } else {
        const queryParams = buildFilterQuery(filter);
        url = `${endpoints.filter}${queryParams}`;
      }

      const html = await this.httpClient.getPage(url, undefined, signal);
      return parseSearchPage(html, endpoints.sitePrefixNoS);
    } catch (error) {
      console.warn("[AnimeWorldScraper] searchAnime error:", error);
      throw error;
    }
  }


  /**
   * Fetches and parses Anime Detail page
   */
  public async getAnimeDetail(
    animeIdOrUrl: string,
  ): Promise<AnimeDetail> {
    if (!animeIdOrUrl || !animeIdOrUrl.trim()) {
      throw new Error("[AnimeWorldScraper] getAnimeDetail: animeIdOrUrl is required");
    }

    const endpoints = scraperConfig.getEndpoints();
    let targetUrl = animeIdOrUrl.trim();

    if (
      !targetUrl.startsWith("http://") &&
      !targetUrl.startsWith("https://")
    ) {
      let cleanPath = targetUrl;
      if (!cleanPath.startsWith("/")) {
        cleanPath = cleanPath.startsWith("play/")
          ? `/${cleanPath}`
          : `/play/${cleanPath}`;
      }
      targetUrl = resolveUrl(cleanPath, endpoints.sitePrefixNoS);
    }

    try {
      const html = await this.httpClient.getPage(targetUrl);
      const detail = parseDetailPage(html, targetUrl, endpoints.sitePrefixNoS);
      if (!detail) {
        throw new Error(
          `[AnimeWorldScraper] Failed to parse anime detail from: ${targetUrl}`,
        );
      }
      return detail;
    } catch (error) {
      console.warn("[AnimeWorldScraper] getAnimeDetail error:", error);
      throw error;
    }
  }

  /**
   * Resolves direct playable video URL for an episode with Server 9 priority and fallback
   */
  public async resolveEpisodeVideo(
    episode: Episode,
    preferredServerId = "9",
  ): Promise<DirectVideoSource | null> {
    try {
      // 1. Build server candidates list: preferred server first, followed by remaining available servers
      const candidateServers: {
        serverId: string;
        dataId: string;
        referer?: string;
      }[] = [];

      if (episode.servers && episode.servers.length > 0) {
        const preferred = episode.servers.find(
          (s) => s.id === preferredServerId,
        );
        if (preferred && preferred.dataId) {
          candidateServers.push({
            serverId: preferred.id,
            dataId: preferred.dataId,
            referer: preferred.referer || episode.referer,
          });
        }
        for (const s of episode.servers) {
          if (s.id !== preferredServerId && s.dataId) {
            candidateServers.push({
              serverId: s.id,
              dataId: s.dataId,
              referer: s.referer || episode.referer,
            });
          }
        }
      }

      // If no candidates found from episode.servers, fall back to top-level episode dataId
      if (candidateServers.length === 0 && episode.dataId) {
        candidateServers.push({
          serverId: preferredServerId,
          dataId: episode.dataId,
          referer: episode.referer,
        });
      }

      if (candidateServers.length === 0) {
        console.warn(
          "[AnimeWorldScraper] Episode missing dataId for video resolution",
        );
        return null;
      }

      const endpoints = scraperConfig.getEndpoints();

      // 2. Attempt resolution with candidate servers in order (preferred first, then fallback)
      for (const candidate of candidateServers) {
        try {
          const apiUrl = `${endpoints.apiEpisode}${candidate.dataId}`;
          const res = await this.httpClient.get<EpisodeInfoApiResponse>(
            apiUrl,
            {
              headers: {
                "X-Requested-With": "XMLHttpRequest",
                Referer: candidate.referer || endpoints.sitePrefixS,
              },
            },
          );

          const data = res.data;
          if (data && data.grabber) {
            const candidateEpisode: Episode = {
              ...episode,
              dataId: candidate.dataId,
              referer: candidate.referer || episode.referer,
            };

            const source = await resolveVideoSource(
              data.grabber,
              candidate.serverId,
              candidateEpisode,
              this.httpClient,
            );

            if (source && source.url) {
              return source;
            }
          }
        } catch (candidateError) {
          console.warn(
            `[AnimeWorldScraper] Video resolution failed for server ${candidate.serverId}:`,
            candidateError,
          );
        }
      }

      return null;
    } catch (error) {
      console.warn("[AnimeWorldScraper] resolveEpisodeVideo error:", error);
      return null;
    }
  }

  /**
   * Fetches a random anime URL redirect
   */
  public async getRandomAnime(): Promise<string> {
    try {
      const endpoints = scraperConfig.getEndpoints();
      const res = await this.httpClient.get<string>(endpoints.random, {
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const location = res.headers["location"] as string | undefined;
      if (location) {
        return resolveUrl(location, endpoints.sitePrefixNoS);
      }
      return endpoints.sitePrefixNoS;
    } catch (error) {
      console.warn("[AnimeWorldScraper] getRandomAnime error:", error);
      return scraperConfig.getBaseUrl();
    }
  }
}

export const AnimeWorldScraper = new AnimeWorldScraperService();
