export interface AnimeItem {
  id: string;
  title: string;
  japaneseTitle?: string;
  thumbnail: string;
  image?: string;
  banner?: string;
  synopsis?: string;
  description?: string;
  type?: 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special' | string;
  releaseYear?: number;
  status?: 'Ongoing' | 'Completed' | 'Upcoming' | string;
  state?: string;
  score?: number;
  totalEpisodes?: number | string;
  episode?: number | string;
  subOrDub?: string;
  genres: string[];
  link: string;
  rank?: string;
  audio?: string;
  badge?: string;
}

export interface VideoServer {
  id: string;
  name: string;
  url?: string;
  quality?: string;
  canDownload?: boolean;
  episodes?: Episode[];
  dataId?: string;
  referer?: string;
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string;
  servers?: VideoServer[];
  dataId?: string;
  commentId?: string;
  referer?: string;
  isFinal?: boolean;
}

export interface AnimeDetail extends AnimeItem {
  episodes: Episode[];
  servers?: VideoServer[];
  serverList?: VideoServer[];
  rating?: string;
  duration?: string;
  studio?: string;
  studios?: string[];
  related?: AnimeItem[];
  similar?: AnimeItem[];
  category?: string;
  season?: string;
  releaseDate?: string;
  views?: string;
  nextEpisode?: string;
  anilistId?: number;
  anilistLink?: string;
  malId?: number;
  myanimelistLink?: string;
  trailer?: string;
  trailerUrl?: string;
  commentInfo?: {
    token: string;
    commentId: string;
    referer: string;
  };
}

export interface SearchFilter {
  query?: string;
  keyword?: string;
  genre?: string | number;
  genreMode?: 'and' | 'or';
  year?: number;
  order?: number | string;
  status?: number | string;
  season?: number | string;
  type?: 'music' | 'movie' | 'ova' | 'ona' | 'special' | 'anime' | string;
  dub?: number | string;
  audio?: 'jap' | 'china' | 'ita' | 'korea' | 'eng' | string;
  page?: number;
}

export interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

export interface AniListCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: AniListTitle;
  bannerImage?: string | null;
  coverImage: AniListCoverImage;
  description?: string | null;
  genres: string[];
  averageScore?: number | null;
  meanScore?: number | null;
  studios: string[];
  episodes?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  duration?: number | null;
}

export interface EpisodeMetadata {
  episodeNumber: number;
  title?: string;
  synopsis?: string;
  thumbnail?: string;
  airdate?: string;
  length?: number;
}
