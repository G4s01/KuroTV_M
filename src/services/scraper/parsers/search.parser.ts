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

  // Select only main catalog cards, strictly excluding sidebar widgets (.simple-film-list, .ranking, aside, etc.)
  const cardElements = $(
    "#main .film-list > .item, .content .film-list > .item, .film-list > .item, #main .film-listnext > .item, .content .film-listnext > .item, .film-listnext .item, .film-list .film-item",
  ).not(
    ".simple-film-list .item, .ranking .item, aside .item, .widget.ranking .item, .widget.simple-film-list .item, .widget-body .simple-film-list .item",
  );

  cardElements.each((_, el) => {
    const $el = $(el);
    let nameEl = $el.find("a.name, .title a, a.title, .name a").first();
    if (nameEl.length === 0) {
      nameEl = $el.find("a").not(".poster, .thumb").first();
    }
    if (nameEl.length === 0) {
      nameEl = $el.find("a").first();
    }

    const title =
      sanitizeText(nameEl.text()) ||
      sanitizeText(nameEl.attr("title")) ||
      sanitizeText($el.find(".name, .title").text());
    const rawHref =
      nameEl.attr("href") ||
      $el.find("a.poster, a.thumb, a").first().attr("href") ||
      "";
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

  // Multi-genre & single genre support
  const rawGenres = filter.genres || (Array.isArray(filter.genre) ? filter.genre : (filter.genre !== undefined && filter.genre !== "" ? [filter.genre] : []));
  if (rawGenres.length > 0) {
    for (const g of rawGenres) {
      if (g !== undefined && g !== "") {
        params.append("genre", String(g));
      }
    }
    if (rawGenres.length > 1) {
      params.append("genre_mode", filter.genreMode || "and");
    }
  }

  if (filter.year) {
    params.append("year", String(filter.year));
  }

  // Sort / Order resolution with numeric & string aliases
  const rawSort = filter.sort !== undefined && filter.sort !== "" ? filter.sort : filter.order;
  if (rawSort !== undefined && rawSort !== "") {
    let resolvedSort = String(rawSort);
    switch (resolvedSort.toLowerCase()) {
      case "recent":
      case "recenti":
      case "release_date":
      case "release_date:desc":
        resolvedSort = "5"; // AnimeWorld: Più recenti (data uscita)
        break;
      case "latest":
      case "post_date":
      case "post_date:desc":
      case "updated":
        resolvedSort = "1"; // AnimeWorld: Ultime aggiunte
        break;
      case "popular":
      case "views":
      case "views:desc":
        resolvedSort = "6"; // AnimeWorld: Più visti
        break;
      case "rating":
      case "vote":
      case "vote:desc":
        resolvedSort = "7"; // AnimeWorld: Meglio valutati
        break;
      case "az":
      case "title:asc":
        resolvedSort = "2"; // AnimeWorld: A-Z
        break;
      case "za":
      case "title:desc":
        resolvedSort = "3"; // AnimeWorld: Z-A
        break;
    }
    params.append("sort", resolvedSort);
  }

  // Status resolution
  if (filter.status !== undefined && filter.status !== "") {
    let resolvedStatus = String(filter.status);
    switch (resolvedStatus.toLowerCase()) {
      case "ongoing":
      case "airing":
        resolvedStatus = "0"; // In corso
        break;
      case "completed":
      case "finished":
        resolvedStatus = "1"; // Finito
        break;
      case "upcoming":
        resolvedStatus = "2"; // Non rilasciato
        break;
      case "dropped":
        resolvedStatus = "3"; // Droppato
        break;
    }
    params.append("status", resolvedStatus);
  }

  if (filter.season !== undefined && filter.season !== "") {
    params.append("season", String(filter.season));
  }

  // Type / Formato resolution
  if (filter.type) {
    let resolvedType = String(filter.type);
    switch (resolvedType.toLowerCase()) {
      case "tv":
      case "anime":
      case "series":
        resolvedType = "0"; // Serie TV / Anime
        break;
      case "movie":
      case "movies":
      case "film":
        resolvedType = "4"; // Movie / Film
        break;
      case "ova":
        resolvedType = "1"; // OVA
        break;
      case "ona":
        resolvedType = "2"; // ONA
        break;
      case "special":
      case "specials":
        resolvedType = "3"; // Special
        break;
      case "music":
        resolvedType = "5"; // Music
        break;
    }
    params.append("type", resolvedType);
  }

  // Audio / Dub resolution: '1' = Doppiato (ITA), '0' = Subbato (SUB)
  if (filter.dub !== undefined && filter.dub !== "") {
    let resolvedDub = String(filter.dub);
    switch (resolvedDub.toLowerCase()) {
      case "dub":
      case "dubbed":
      case "ita":
      case "1":
        resolvedDub = "1";
        break;
      case "sub":
      case "subbed":
      case "jap":
      case "0":
        resolvedDub = "0";
        break;
    }
    params.append("dub", resolvedDub);
  } else if (filter.audio) {
    const audioVal = String(filter.audio).toLowerCase();
    if (audioVal === "ita" || audioVal === "dub") {
      params.append("dub", "1");
    } else if (audioVal === "jap" || audioVal === "sub") {
      params.append("dub", "0");
    } else {
      params.append("audio", String(filter.audio));
    }
  }

  if (filter.page && filter.page > 1) {
    params.append("page", String(filter.page));
  }

  return params.toString();
}
