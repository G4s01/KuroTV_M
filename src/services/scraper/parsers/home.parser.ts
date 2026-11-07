import * as cheerio from "cheerio/slim";
import type { AnimeHomePage, AnimeItem } from "@/types";
import {
  extractBackgroundUrl,
  extractSlugFromUrl,
  resolveUrl,
  sanitizeText,
} from "../utils";

export function parseHomePage(html: string, baseUrl: string): AnimeHomePage {
  const $ = cheerio.load(html);

  // 1. Slider 16:9 Widescreen
  const sliders: AnimeItem[] = [];
  let sliderElements = $(
    "#swiper-container > div.items.swiper-wrapper > div.item.swiper-slide, #swiper-container .swiper-slide, #slider .swiper-slide, .hero-slider .swiper-slide",
  );
  if (sliderElements.length === 0) {
    sliderElements = $(".swiper-slide");
  }

  sliderElements.each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find("a.name, .title a, a.title").first();
    const title =
      sanitizeText(nameEl.text()) || sanitizeText($el.find(".title").text());
    const rawHref =
      nameEl.attr("href") || $el.find("a").first().attr("href") || "";
    const link = resolveUrl(rawHref, baseUrl);
    const id = extractSlugFromUrl(link);

    const style = $el.attr("style") || "";
    const styleBg = extractBackgroundUrl(style);
    const imgThumb =
      $el.find("img").attr("data-src") || $el.find("img").attr("src") || "";
    const thumbnail = styleBg || imgThumb;

    const synopsis = sanitizeText(
      $el.find(".desc, .story, .synopsis, p").text(),
    );
    const badge = sanitizeText(
      $el.find(".badge, .status, .ep").first().text(),
    );

    if (title && link) {
      sliders.push({
        id: id || title,
        title,
        thumbnail,
        banner: styleBg || thumbnail,
        synopsis: synopsis || undefined,
        link,
        badge: badge || undefined,
        genres: [],
      });
    }
  });

  // Helper for parsing anime list cards
  const parseCardList = (elements: ReturnType<typeof $>): AnimeItem[] => {
    const items: AnimeItem[] = [];
    const seenTitles = new Set<string>();

    elements.each((_, el) => {
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
      if (!title || seenTitles.has(title)) return;
      seenTitles.add(title);

      const rawHref =
        nameEl.attr("href") ||
        $el.find("a.poster, a.thumb, a").first().attr("href") ||
        "";
      const link = resolveUrl(rawHref, baseUrl);
      const id = extractSlugFromUrl(link);
      const thumbnail =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-lazy-src") ||
        $el.find("img").attr("src") ||
        extractBackgroundUrl($el.attr("style"));

      const epText = sanitizeText(
        $el.find(".status .ep, .status .dub, .ep, .badge, .status").first().text(),
      );

      items.push({
        id: id || title,
        title,
        thumbnail: thumbnail || "",
        link,
        badge: epText || undefined,
        genres: [],
      });
    });

    return items;
  };

  // 2. Hot New Tabs: All, Sub ITA, Dubbed, Trending
  const hotNewTabs = $(
    ".hotnew > div.widget-body > div.content, .hotnew .content",
  );
  const all = hotNewTabs.eq(0).length
    ? parseCardList(hotNewTabs.eq(0).find(".item > .inner, .item"))
    : [];
  const subITA = hotNewTabs.eq(1).length
    ? parseCardList(hotNewTabs.eq(1).find(".item > .inner, .item"))
    : [];
  const dubbed = hotNewTabs.eq(2).length
    ? parseCardList(hotNewTabs.eq(2).find(".item > .inner, .item"))
    : [];
  const trending = hotNewTabs.eq(3).length
    ? parseCardList(hotNewTabs.eq(3).find(".item > .inner, .item"))
    : [];

  // 3. Ongoing (In corso)
  let ongoing: AnimeItem[] = [];
  const ongoingWidget = $(".widget").filter((_, el) => {
    const title = $(el).find(".widget-title").text().toLowerCase();
    return title.includes("in corso") || title.includes("ongoing");
  });

  if (ongoingWidget.length > 0) {
    ongoing = parseCardList(
      ongoingWidget.find(
        ".film-list .owl-carousel > .item, .film-list .item, .item",
      ),
    );
  } else {
    // Fallback: 4th widget
    const fourthWidget = $("#main > div.content > div.widget").eq(3);
    if (fourthWidget.length > 0) {
      ongoing = parseCardList(
        fourthWidget.find(
          "div.widget-body > div.film-list > div.owl-carousel > div.item",
        ),
      );
    }
  }

  // 4. New Added (Nuove uscite / Nuove aggiunte)
  const newAdded = parseCardList(
    $(
      ".simple-film-list > div.widget-body > div.item, .simple-film-list .item",
    ),
  );

  // 5. Upcoming (Prossime uscite)
  let upcomingTitle = "Prossime Uscite";
  let upcoming: AnimeItem[] = [];
  const upcomingWidget = $(".widget").filter((_, el) => {
    const title = $(el).find(".widget-title").text().toLowerCase();
    return title.includes("prossime") || title.includes("upcoming");
  });

  if (upcomingWidget.length > 0) {
    const titleText = sanitizeText(
      upcomingWidget.find(".widget-title .title").text(),
    );
    if (titleText) upcomingTitle = titleText;
    upcoming = parseCardList(
      upcomingWidget.find(
        ".film-listnext .inner, div.widget-body > div.film-list .inner, .item",
      ),
    );
  } else {
    // Fallback index 5 widget
    const fifthWidget = $("div.widget").eq(5);
    if (fifthWidget.length > 0) {
      const titleText = sanitizeText(
        fifthWidget.find("div.widget-title > div.title").text(),
      );
      if (titleText) upcomingTitle = titleText;
    }
    const filmLists = $("div.widget-body > div.film-list");
    if (filmLists.length > 1) {
      upcoming = parseCardList(filmLists.eq(1).find(".inner"));
    }
  }

  // 6. Top Anime (Classifiche)
  const topAnime: AnimeItem[][] = [];
  $(".ranking > div.widget-body > div.content, .ranking .content").each(
    (_, section) => {
      const sectionList: AnimeItem[] = [];
      const $sec = $(section);

      // Top 1 anime
      const topItem = $sec.find("div.item-top, .item-top").first();
      if (topItem.length > 0) {
        const nameEl = topItem.find("a.name, .info a.name").first();
        const title = sanitizeText(nameEl.text());
        const rawHref = nameEl.attr("href") || "";
        const link = resolveUrl(rawHref, baseUrl);
        const thumbnail =
          topItem.find("a.thumb > img, img").attr("data-src") ||
          topItem.find("a.thumb > img, img").attr("src") ||
          "";
        const rank = sanitizeText(topItem.find("i.rank, .rank").text()) || "1";

        if (title && link) {
          sectionList.push({
            id: extractSlugFromUrl(link) || title,
            title,
            thumbnail,
            link,
            rank,
            genres: [],
          });
        }
      }

      // Following ranked items
      $sec.find("div.item, .item").each((_, el) => {
        const $el = $(el);
        // Skip top-item if caught in selector
        if ($el.hasClass("item-top")) return;

        const nameEl = $el.find("div.info > a.name, a.name").first();
        const title = sanitizeText(nameEl.text());
        const rawHref = nameEl.attr("href") || "";
        const link = resolveUrl(rawHref, baseUrl);
        const thumbnail =
          $el.find("img").attr("data-src") || $el.find("img").attr("src") || "";
        const rank = sanitizeText($el.find("i.rank, .rank").text());

        if (title && link) {
          sectionList.push({
            id: extractSlugFromUrl(link) || title,
            title,
            thumbnail,
            link,
            rank: rank || undefined,
            genres: [],
          });
        }
      });

      if (sectionList.length > 0) {
        topAnime.push(sectionList);
      }
    },
  );

  return {
    sliders,
    all,
    subITA,
    dubbed,
    trending,
    ongoing,
    newAdded,
    upcoming,
    upcomingTitle,
    topAnime,
  };
}
