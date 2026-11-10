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

export interface ScheduleItem {
  id: string;
  title: string;
  japaneseTitle?: string;
  poster: string;
  episode?: string;
  time: string;
  timestamp?: number;
  status: string;
  isDone?: boolean;
  isPause?: boolean;
  link: string;
}

export interface ScheduleDay {
  dayId: string;
  dayName: string;
  dayLabel: string;
  count: number;
  isToday: boolean;
  items: ScheduleItem[];
}

export interface ScheduleHero {
  id: string;
  title: string;
  japaneseTitle?: string;
  poster: string;
  episode?: string;
  timeLabel?: string;
  countdownTimestamp?: number;
  link: string;
}

export interface ScheduleUnscheduledItem {
  id: string;
  title: string;
  japaneseTitle?: string;
  poster: string;
  episode?: string;
  tag?: string;
  link: string;
}

export interface SchedulePageData {
  weekLabel: string;
  hero?: ScheduleHero;
  days: ScheduleDay[];
  unscheduled: ScheduleUnscheduledItem[];
}
