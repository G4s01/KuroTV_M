import * as cheerio from "cheerio/slim";
import type { AnimeItem, SearchFilter } from "@/types";
import {
  extractBackgroundUrl,
  extractSlugFromUrl,
  resolveUrl,
  sanitizeText,
} from "../utils";

export interface SearchResult {
  items: AnimeItem[];
  currentPage: number;
  totalPages: number;
}

export function parseSearchPage(html: string, baseUrl: string): SearchResult {
  const $ = cheerio.load(html);
  const items: AnimeItem[] = [];
  const seenIds = new Set<string>();

  const cardElements = $(
    ".film-list > .item, .film-list .film-item, .items .item, .simple-film-list .item",
  );

  cardElements.each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find("a.name, .title a, a").first();
    const title =
      sanitizeText(nameEl.text()) ||
      sanitizeText($el.find(".name, .title").text());
    const rawHref =
      nameEl.attr("href") || $el.find("a").first().attr("href") || "";
    const link = resolveUrl(rawHref, baseUrl);
    const id = extractSlugFromUrl(link);

    if (!title || !link || (id && seenIds.has(id))) return;
    if (id) seenIds.add(id);

    const thumbnail =
      $el.find("img").attr("data-src") ||
      $el.find("img").attr("src") ||
      extractBackgroundUrl($el.attr("style")) ||
      "";

    const badge = sanitizeText($el.find(".ep, .status, .badge").text());
    const genres: string[] = [];
    $el.find(".genre a, .genres a").each((_, g) => {
      const genreText = sanitizeText($(g).text());
      if (genreText) genres.push(genreText);
    });

    items.push({
      id: id || title,
      title,
      thumbnail,
      link,
      badge: badge || undefined,
      genres,
    });
  });

  // Pagination extraction
  let totalPages = 1;
  let currentPage = 1;

  const totalEl = $(".paging .total, .pagination .total, .total").first();
  if (totalEl.length > 0) {
    const text = totalEl.text().trim();
    const match = text.match(/(?:di|\/)\s*(\d+)/i) || text.match(/(\d+)\s*$/);
    if (match && match[1]) {
      const parsedTotal = parseInt(match[1], 10);
      if (!isNaN(parsedTotal) && parsedTotal > 0) {
        totalPages = parsedTotal;
      }
    }
  } else {
    // Check page numbers from pagination links
    $(".pagination a, .paging a").each((_, a) => {
      const pageNum = parseInt($(a).text().trim(), 10);
      if (!isNaN(pageNum) && pageNum > totalPages) {
        totalPages = pageNum;
      }
    });
  }

  const activePageEl = $(
    ".pagination .active, .paging .active, .pagination .current",
  ).first();
  if (activePageEl.length > 0) {
    const parsedCurrent = parseInt(activePageEl.text().trim(), 10);
    if (!isNaN(parsedCurrent)) {
      currentPage = parsedCurrent;
    }
  }

  return {
    items,
    currentPage,
    totalPages,
  };
}

export function buildFilterQuery(filter: SearchFilter): string {
  const params = new URLSearchParams();

  const queryTerm = filter.query || filter.keyword;
  if (queryTerm) {
    params.append("keyword", queryTerm.trim());
  }

  if (filter.genre !== undefined && filter.genre !== "") {
    params.append("genre", String(filter.genre));
  }

  if (filter.genreMode) {
    params.append("genre_mode", filter.genreMode);
  }

  if (filter.year) {
    params.append("year", String(filter.year));
  }

  if (filter.order !== undefined && filter.order !== "") {
    params.append("sort", String(filter.order));
  }

  if (filter.status !== undefined && filter.status !== "") {
    params.append("status", String(filter.status));
  }

  if (filter.season !== undefined && filter.season !== "") {
    params.append("season", String(filter.season));
  }

  if (filter.type) {
    params.append("type", String(filter.type));
  }

  if (filter.dub !== undefined && filter.dub !== "") {
    params.append("dub", String(filter.dub));
  }

  if (filter.audio) {
    params.append("audio", String(filter.audio));
  }

  if (filter.page && filter.page > 1) {
    params.append("page", String(filter.page));
  }

  return params.toString();
}
