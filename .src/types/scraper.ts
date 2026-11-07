import type { AnimeItem, Episode } from "./anime";

export interface AnimeHomePage {
  sliders: AnimeItem[];
  all: AnimeItem[];
  subITA: AnimeItem[];
  dubbed: AnimeItem[];
  trending: AnimeItem[];
  ongoing: AnimeItem[];
  newAdded: AnimeItem[];
  upcoming: AnimeItem[];
  upcomingTitle: string;
  topAnime: AnimeItem[][];
}

export interface AnimeWorldServer {
  id: string;
  name: string;
  canDownload: boolean;
  episodes: Episode[];
}

export interface DirectVideoQuality {
  quality: string;
  url: string;
}

export interface DirectVideoSource {
  url: string;
  format: "mp4" | "hls";
  headers: Record<string, string>;
  serverName: string;
  serverId: string;
  qualities?: DirectVideoQuality[];
  masterUrl?: string;
}

export interface ScraperConfig {
  tld: string;
  baseUrl: string;
  userAgent: string;
  timeout: number;
}

export interface EpisodeInfoApiResponse {
  grabber?: string;
  target?: string;
  [key: string]: unknown;
}
