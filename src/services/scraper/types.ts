import type {
  AnimeDetail,
  AnimeHomePage,
  AnimeItem,
  Episode,
  SearchFilter,
} from '@/types';

export interface AnimeSearchResult {
  items: AnimeItem[];
  currentPage?: number;
  totalPages?: number;
}

export interface ResolvedVideoSource {
  url: string;
  headers?: Record<string, string>;
  serverName?: string;
}

export interface AnimeProvider {
  readonly id: string;
  readonly name: string;
  getHome(): Promise<AnimeHomePage>;
  getAnimeDetail(animeId: string): Promise<AnimeDetail | null>;
  search(query: string | SearchFilter, signal?: AbortSignal): Promise<AnimeSearchResult>;
  resolveVideo(episode: Episode, serverId?: string): Promise<ResolvedVideoSource | null>;
}
