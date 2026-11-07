import * as cheerio from "cheerio";
import type { AnimeDetail, AnimeItem, Episode, VideoServer } from "@/types";
import {
  cleanSynopsis,
  extractAniListId,
  extractMalId,
  extractSlugFromUrl,
  resolveUrl,
  sanitizeText,
} from "../utils";

const SERVER_NAMES: Record<string, string> = {
  "9": "AnimeWorld Server",
  "8": "Streamtape",
  "6": "Server 2",
  "2": "DoodStream",
  "3": "VVVVID",
  "4": "YouTube",
  "17": "Userload",
  "18": "VUP",
  "25": "Streamlare",
};

export function parseDetailPage(
  html: string,
  pageUrl: string,
  baseUrl: string,
): AnimeDetail {
  const $ = cheerio.load(html);

  // 1. Title
  const title =
    sanitizeText(
      $("h2.title, h1.title, .anime-title, .title").first().text(),
    ) || "Anime Senza Titolo";

  // 2. Poster / Thumbnail
  const thumbnail =
    $("#thumbnail-watch > img, .poster img, .thumb img")
      .first()
      .attr("data-src") ||
    $("#thumbnail-watch > img, .poster img, .thumb img").first().attr("src") ||
    "";

  // 3. Synopsis
  const rawSynopsis =
    $("div.desc, .synopsis, .description").first().html() ||
    $("div.desc, .synopsis, .description").first().text();
  const synopsis = cleanSynopsis(rawSynopsis);

  // 4. Anime ID & Link
  const animeIdAttr = $("#animeId").attr("data-id");
  const slugFromUrl = extractSlugFromUrl(pageUrl);
  const animeId = slugFromUrl || animeIdAttr || title;
  const link = resolveUrl(pageUrl, baseUrl);

  // 5. Metadata extraction (both via DT labels and fallback dd index)
  let category = "";
  let audio = "";
  let releaseDate = "";
  let season = "";
  const studios: string[] = [];
  const genres: string[] = [];
  let rating = "";
  let duration = "";
  let totalEpisodesStr = "";
  let status = "";
  let views = "";

  const infoRow = $(
    "#main > div > div.widget.info > div > div > div.info.col-md-9 > div.row, .widget.info .info .row, .widget.info",
  );

  const dtElements = infoRow.find("dt");
  const ddElements = infoRow.find("dd");

  if (dtElements.length > 0) {
    dtElements.each((i, dt) => {
      const $dt = $(dt);
      const dtText = $dt.text().toLowerCase().trim();
      let dd = $dt.next("dd");
      if (dd.length === 0) {
        dd = $dt.parent().find("dd");
      }
      if (dd.length === 0 && ddElements.length > i) {
        dd = ddElements.eq(i);
      }
      const ddText = sanitizeText(dd.text());

      if (dtText.includes("categoria")) category = ddText;
      else if (dtText.includes("audio")) audio = ddText;
      else if (dtText.includes("data")) releaseDate = ddText;
      else if (dtText.includes("stagione")) season = ddText;
      else if (dtText.includes("studio")) {
        dd.find("a").each((_, a) => {
          const s = sanitizeText($(a).text());
          if (s) studios.push(s);
        });
        if (studios.length === 0 && ddText) studios.push(ddText);
      } else if (dtText.includes("gener")) {
        dd.find("a").each((_, a) => {
          const g = sanitizeText($(a).text());
          if (g) genres.push(g);
        });
        if (genres.length === 0 && ddText) genres.push(ddText);
      } else if (dtText.includes("voto")) rating = ddText;
      else if (dtText.includes("durata")) duration = ddText;
      else if (dtText.includes("episod")) totalEpisodesStr = ddText;
      else if (dtText.includes("stato")) status = ddText;
      else if (dtText.includes("visualizzazion")) views = ddText;
    });
  }

  // Fallback: index-based mapping matching the Dart scraper if DT didn't populate category
  if (!category && ddElements.length > 0) {
    category = sanitizeText(ddElements.eq(0).text());
    audio = sanitizeText(ddElements.eq(1).text());
    releaseDate = sanitizeText(ddElements.eq(2).text());
    season = sanitizeText(ddElements.eq(3).text());

    ddElements
      .eq(4)
      .find("a")
      .each((_, a) => {
        const s = sanitizeText($(a).text());
        if (s) studios.push(s);
      });
    if (studios.length === 0 && ddElements.eq(4).text()) {
      studios.push(sanitizeText(ddElements.eq(4).text()));
    }

    ddElements
      .eq(5)
      .find("a")
      .each((_, a) => {
        const g = sanitizeText($(a).text());
        if (g) genres.push(g);
      });
    if (genres.length === 0 && ddElements.eq(5).text()) {
      genres.push(sanitizeText(ddElements.eq(5).text()));
    }

    rating = sanitizeText(ddElements.eq(6).text());
    duration = sanitizeText(ddElements.eq(7).text());
    totalEpisodesStr = sanitizeText(ddElements.eq(8).text());
    status = sanitizeText(ddElements.eq(9).text());
    views = sanitizeText(ddElements.eq(10).text());
  }

  // 6. External Links & IDs
  const anilistEl = $("#anilist-button");
  const anilistHref =
    anilistEl.attr("href") || anilistEl.find("a").attr("href") || undefined;
  const anilistDataId =
    anilistEl.attr("data-id") || anilistEl.attr("data-anilist-id");
  const anilistId = anilistDataId
    ? parseInt(anilistDataId, 10)
    : extractAniListId(anilistHref);

  const malEl = $("#mal-button");
  const malHref =
    malEl.attr("href") || malEl.find("a").attr("href") || undefined;
  const malDataId = malEl.attr("data-id") || malEl.attr("data-mal-id");
  const malId = malDataId ? parseInt(malDataId, 10) : extractMalId(malHref);

  // 7. Next Episode Calendar Info
  const nextEpEl = $("#next-episode");
  let nextEpisode: string | undefined = undefined;
  if (nextEpEl.length > 0) {
    const calDate = nextEpEl.attr("data-calendar-date") || "";
    const calTime = nextEpEl.attr("data-calendar-time") || "";
    if (calDate || calTime) {
      nextEpisode = `${calDate} ${calTime}`.trim();
    }
  }

  // 8. Comment Info
  const commentToken = $("meta#csrf-token").attr("content") || "";
  const commentId =
    $("#player").attr("data-anime-id") ||
    $("#loveButton").attr("data-id") ||
    animeIdAttr ||
    animeId;
  const commentInfo = commentToken
    ? {
        token: commentToken,
        commentId,
        referer: link,
      }
    : undefined;

  // 9. Servers and Episode List
  const servers: VideoServer[] = [];
  const totalEpCount = parseInt(totalEpisodesStr, 10);

  const serverContainers = $("div.server");

  serverContainers.each((_, serverEl) => {
    const $server = $(serverEl);
    const serverId = $server.attr("data-name") || "";
    if (!serverId) return;

    const serverName = SERVER_NAMES[serverId] || `Server ${serverId}`;
    const canDownload = serverId !== "4"; // Server 4 is YouTube

    const serverEpisodes: Episode[] = [];

    $server.find("a").each((i, epEl) => {
      const attribs = (epEl as any).attribs || {};
      const $ep = $(epEl);
      const epTitle = sanitizeText($ep.text());
      const epAttrNum =
        attribs["data-episode-num"] ||
        attribs["data-episode"] ||
        attribs["data-num"] ||
        $ep.attr("data-episode-num") ||
        $ep.attr("data-episode") ||
        $ep.attr("data-num");
      let epNumber = epAttrNum ? parseInt(epAttrNum, 10) : NaN;
      if (isNaN(epNumber)) {
        const match = epTitle.match(/\b\d+\b/);
        epNumber = match ? parseInt(match[0], 10) : i + 1;
      }

      const dataId = attribs["data-id"] || $ep.attr("data-id") || "";
      const commentEpId = attribs["data-episode-id"] || $ep.attr("data-episode-id") || "";
      const epHref = attribs["href"] || $ep.attr("href") || "";
      const epReferer = resolveUrl(epHref, baseUrl);
      const isFinal = !isNaN(totalEpCount) && totalEpCount === epNumber;

      const episode: Episode = {
        id: dataId || `${animeId}-ep-${epNumber}`,
        number: epNumber,
        title: epTitle || `Episodio ${epNumber}`,
        dataId,
        commentId: commentEpId,
        referer: epReferer,
        isFinal,
        servers: [
          {
            id: serverId,
            name: serverName,
            canDownload,
            dataId,
            referer: epReferer,
          },
        ],
      };

      serverEpisodes.push(episode);
    });

    servers.push({
      id: serverId,
      name: serverName,
      canDownload,
      episodes: serverEpisodes,
    });
  });

  // Sort servers so Server 9 is first (priority)
  servers.sort((a, b) => {
    if (a.id === "9") return -1;
    if (b.id === "9") return 1;
    return 0;
  });

  // Build unified primary episode list in O(E * S) using Map lookup
  // Pre-index servers by episode number to eliminate O(E^2 * S) nested iterations on long series
  const episodeServersMap = new Map<number, VideoServer[]>();
  for (const s of servers) {
    if (!s.episodes) continue;
    for (const ep of s.episodes) {
      let list = episodeServersMap.get(ep.number);
      if (!list) {
        list = [];
        episodeServersMap.set(ep.number, list);
      }
      list.push({
        id: s.id,
        name: s.name,
        canDownload: s.canDownload,
        dataId: ep.dataId,
        referer: ep.referer,
      });
    }
  }

  const primaryServer = servers.find((s) => s.id === "9") || servers[0];
  const primaryEpisodes: Episode[] = [];

  if (primaryServer && primaryServer.episodes) {
    for (const ep of primaryServer.episodes) {
      const allEpServers = episodeServersMap.get(ep.number);
      primaryEpisodes.push({
        ...ep,
        servers: allEpServers && allEpServers.length > 0 ? allEpServers : ep.servers,
      });
    }
  }

  // 10. Similar (Simili) & Related (Correlati)
  const parseRelatedList = (selector: string): AnimeItem[] => {
    const list: AnimeItem[] = [];
    $(selector).each((_, el) => {
      const $el = $(el);
      const nameEl = $el.find("a.name, .title a, a").first();
      const relTitle = sanitizeText(nameEl.text());
      const relHref = nameEl.attr("href") || "";
      const relLink = resolveUrl(relHref, baseUrl);
      const relThumb =
        $el.find("img").attr("data-src") || $el.find("img").attr("src") || "";
      const relId = extractSlugFromUrl(relLink);

      if (relTitle && relLink) {
        list.push({
          id: relId || relTitle,
          title: relTitle,
          thumbnail: relThumb,
          link: relLink,
          genres: [],
        });
      }
    });
    return list;
  };

  const similar = parseRelatedList("div.film-list > div.item");
  const related = parseRelatedList("div.related > div.item");

  // Parse release year
  let releaseYear: number | undefined = undefined;
  const yearMatch = releaseDate.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    releaseYear = parseInt(yearMatch[1], 10);
  }

  // Parse total episodes
  const totalEpisodes = !isNaN(totalEpCount) ? totalEpCount : undefined;

  return {
    id: animeId,
    title,
    thumbnail,
    synopsis,
    link,
    genres,
    episodes: primaryEpisodes,
    servers,
    serverList: servers,
    rating: rating || undefined,
    duration: duration || undefined,
    studio: studios[0] || undefined,
    studios,
    category: category || undefined,
    audio: audio || undefined,
    season: season || undefined,
    releaseDate: releaseDate || undefined,
    releaseYear,
    status: status || undefined,
    views: views || undefined,
    totalEpisodes,
    nextEpisode,
    anilistId,
    anilistLink: anilistHref,
    malId,
    myanimelistLink: malHref,
    commentInfo,
    similar,
    related,
  };
}
