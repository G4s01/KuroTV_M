import axios from "axios";
import type { AniListMedia } from "@/types";
import { cleanSynopsis, sanitizeTitleForSearch } from "../scraper/utils";

export const ANILIST_GRAPHQL_ENDPOINT = "https://graphql.anilist.co";

export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
  };
}

interface RawAniListStudioEdge {
  isMain?: boolean | null;
  node?: {
    name: string;
  } | null;
}

interface RawAniListStudioNode {
  name: string;
}

interface RawAniListMedia {
  id: number;
  idMal?: number | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  };
  bannerImage?: string | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
  };
  description?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  meanScore?: number | null;
  studios?: {
    edges?: RawAniListStudioEdge[] | null;
    nodes?: RawAniListStudioNode[] | null;
  } | null;
  episodes?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  duration?: number | null;
}

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  bannerImage
  coverImage {
    extraLarge
    large
    medium
  }
  description(asHtml: false)
  genres
  averageScore
  meanScore
  studios {
    edges {
      isMain
      node {
        name
      }
    }
    nodes {
      name
    }
  }
  episodes
  status
  season
  seasonYear
  format
  duration
`;

const QUERY_BY_ID = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
    }
  }
`;

const QUERY_BY_SEARCH = `
  query ($search: String) {
    Media(search: $search, type: ANIME) {
      ${MEDIA_FIELDS}
    }
  }
`;

function mapAniListMedia(data: RawAniListMedia): AniListMedia {
  const mainStudios: string[] = [];
  const allStudios: string[] = [];

  if (data.studios?.edges && data.studios.edges.length > 0) {
    for (const edge of data.studios.edges) {
      const name = edge.node?.name;
      if (name) {
        if (edge.isMain) {
          mainStudios.push(name);
        }
        allStudios.push(name);
      }
    }
  } else if (data.studios?.nodes && data.studios.nodes.length > 0) {
    for (const node of data.studios.nodes) {
      if (node.name) allStudios.push(node.name);
    }
  }

  const studios = mainStudios.length > 0 ? mainStudios : allStudios;

  return {
    id: data.id,
    idMal: data.idMal ?? null,
    title: {
      romaji: data.title?.romaji ?? null,
      english: data.title?.english ?? null,
      native: data.title?.native ?? null,
      userPreferred: data.title?.userPreferred ?? null,
    },
    bannerImage: data.bannerImage ?? null,
    coverImage: {
      extraLarge: data.coverImage?.extraLarge ?? null,
      large: data.coverImage?.large ?? null,
      medium: data.coverImage?.medium ?? null,
    },
    description: data.description ? cleanSynopsis(data.description) : null,
    genres: data.genres || [],
    averageScore: data.averageScore ?? null,
    meanScore: data.meanScore ?? null,
    studios,
    episodes: data.episodes ?? null,
    status: data.status ?? null,
    season: data.season ?? null,
    seasonYear: data.seasonYear ?? null,
    format: data.format ?? null,
    duration: data.duration ?? null,
  };
}

export const AniListService = {
  /**
   * Primary lookup: Fetches media details by exact AniList ID
   */
  async fetchMediaById(id: number): Promise<AniListMedia | null> {
    try {
      if (!id || id <= 0) return null;

      const response = await axios.post<{ data?: { Media?: RawAniListMedia } }>(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: QUERY_BY_ID,
          variables: { id },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        },
      );

      const raw = response.data?.data?.Media;
      return raw ? mapAniListMedia(raw) : null;
    } catch (error) {
      console.warn(`[AniListService] fetchMediaById(${id}) error:`, error);
      return null;
    }
  },

  /**
   * Search media by sanitized title
   */
  async fetchMediaByTitle(title: string): Promise<AniListMedia | null> {
    try {
      const sanitized = sanitizeTitleForSearch(title);
      if (!sanitized) return null;

      const response = await axios.post<{ data?: { Media?: RawAniListMedia } }>(
        ANILIST_GRAPHQL_ENDPOINT,
        {
          query: QUERY_BY_SEARCH,
          variables: { search: sanitized },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        },
      );

      const raw = response.data?.data?.Media;
      return raw ? mapAniListMedia(raw) : null;
    } catch (error) {
      console.warn(
        `[AniListService] fetchMediaByTitle("${title}") error:`,
        error,
      );
      return null;
    }
  },

  /**
   * Intelligent fallback strategy:
   * 1. Try ID lookup (e.g. from #anilist-button)
   * 2. Fall back to title search if ID is missing or not found
   */
  async fetchMediaWithFallback(
    anilistId?: number | null,
    title?: string | null,
  ): Promise<AniListMedia | null> {
    if (anilistId && anilistId > 0) {
      const result = await this.fetchMediaById(anilistId);
      if (result) return result;
    }

    if (title && title.trim()) {
      const result = await this.fetchMediaByTitle(title);
      if (result) return result;

      // Secondary fallback: if title has punctuation or subtitle, try base title before colon/dash
      const baseTitle = title.split(/[:\-\–\—]/)[0].trim();
      if (baseTitle && baseTitle.length > 2 && baseTitle !== title) {
        return await this.fetchMediaByTitle(baseTitle);
      }
    }

    return null;
  },

  /**
   * Authenticated user profile lookup
   */
  async fetchUserProfile(token: string): Promise<AniListUser | null> {
    try {
      const query = `
        query {
          Viewer {
            id
            name
            avatar {
              large
            }
          }
        }
      `;

      const res = await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        { query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        },
      );

      return res.data?.data?.Viewer ?? null;
    } catch (error) {
      console.warn("[AniListService] fetchUserProfile error:", error);
      return null;
    }
  },

  /**
   * Authenticated anime progress update
   */
  async updateProgress(
    token: string,
    mediaId: number,
    progress: number,
  ): Promise<boolean> {
    try {
      const mutation = `
        mutation ($mediaId: Int, $progress: Int) {
          SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: CURRENT) {
            id
            progress
            status
          }
        }
      `;

      await axios.post(
        ANILIST_GRAPHQL_ENDPOINT,
        { query: mutation, variables: { mediaId, progress } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      return true;
    } catch (error) {
      console.warn("[AniListService] updateProgress error:", error);
      return false;
    }
  },
};
