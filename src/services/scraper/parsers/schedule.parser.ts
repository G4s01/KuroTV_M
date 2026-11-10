import * as cheerio from "cheerio/slim";
import type {
  SchedulePageData,
  ScheduleDay,
  ScheduleItem,
  ScheduleHero,
  ScheduleUnscheduledItem,
} from "@/types";
import { extractSlugFromUrl, resolveUrl, sanitizeText } from "../utils";

export function parseSchedulePage(html: string, baseUrl: string): SchedulePageData {
  const $ = cheerio.load(html);

  // 1. Week Label (e.g. "Settimana 9 nov – 15 nov")
  const weekRaw = $(".sch-wk").text();
  const weekLabel = sanitizeText(weekRaw) || "SETTIMANA IN CORSO";

  // 2. Hero Section (Prossima Uscita in rilievo)
  let hero: ScheduleHero | undefined = undefined;
  const heroSection = $("section.sch-hero");
  if (heroSection.length > 0) {
    const title = sanitizeText(heroSection.find("a.sch-ht").text());
    if (title) {
      const rawHref =
        heroSection.find("a.sch-ht").attr("href") ||
        heroSection.find("a.sch-hp").attr("href") ||
        "";
      const link = resolveUrl(rawHref, baseUrl);
      const id = extractSlugFromUrl(link);
      const posterRaw =
        heroSection.find("img.sch-hbg").attr("src") ||
        heroSection.find(".sch-hp img").attr("src") ||
        heroSection.find("img").attr("src") ||
        "";
      const poster = resolveUrl(posterRaw, baseUrl);
      const episode = sanitizeText(heroSection.find(".sch-ep").text());
      const timeLabel = sanitizeText(heroSection.find(".sch-hwt").text());
      const cdRaw = heroSection.attr("data-at") || heroSection.find(".sch-cd").attr("data-cd");
      const countdownTimestamp = cdRaw ? Number(cdRaw) : undefined;
      const jtitle = sanitizeText(heroSection.find("a.sch-ht").attr("data-jtitle"));

      hero = {
        id,
        title,
        japaneseTitle: jtitle || undefined,
        poster,
        episode: episode || undefined,
        timeLabel: timeLabel || undefined,
        countdownTimestamp,
        link,
      };
    }
  }

  // 3. Days (Lunedì - Domenica)
  const days: ScheduleDay[] = [];
  $("section.sch-day").each((_, el) => {
    const $day = $(el);
    const dayId = $day.attr("data-day") || "";
    const dayName =
      sanitizeText($day.attr("data-name")) ||
      sanitizeText($day.find(".sch-hx").clone().children().remove().end().text()) ||
      dayId.toUpperCase();
    const dayLabel =
      sanitizeText($day.attr("data-label")) ||
      sanitizeText($day.find(".sch-hx span").text());
    const isToday = $day.hasClass("is-today");

    const items: ScheduleItem[] = [];
    $day.find("li.sch-row").each((__, row) => {
      const $row = $(row);
      const a = $row.find("a.sch-item");
      const rawHref = a.attr("href") || $row.find("a").first().attr("href") || "";
      const link = resolveUrl(rawHref, baseUrl);
      const id = extractSlugFromUrl(link);

      const title = sanitizeText($row.find(".sch-ct").text());
      if (!title && !id) return;

      const jtitle = sanitizeText($row.find(".sch-ct").attr("data-jtitle"));
      const time = sanitizeText($row.find(".sch-time").text()) || $row.attr("data-time") || "";
      const atRaw = $row.attr("data-at");
      const timestamp = atRaw ? Number(atRaw) : undefined;
      const isDone = $row.hasClass("is-done");
      const isPause = $row.hasClass("is-pause") || $row.attr("data-paused") === "1";

      const posterRaw =
        $row.find(".sch-po img").attr("src") ||
        $row.find(".sch-po img").attr("data-src") ||
        $row.find("img").attr("src") ||
        "";
      const poster = resolveUrl(posterRaw, baseUrl);
      const episode = sanitizeText($row.find(".sch-ep").text());
      const status = sanitizeText($row.find(".sch-st").text()) || (isDone ? "USCITO" : time ? `ALLE ${time}` : "");

      items.push({
        id,
        title,
        japaneseTitle: jtitle || undefined,
        poster,
        episode: episode || undefined,
        time,
        timestamp,
        status,
        isDone,
        isPause,
        link,
      });
    });

    days.push({
      dayId,
      dayName,
      dayLabel,
      count: items.length,
      isToday,
      items,
    });
  });

  // 4. Unscheduled / Senza data fissa
  const unscheduled: ScheduleUnscheduledItem[] = [];
  $("section.sch-unk ul.sch-ul li").each((_, li) => {
    const $li = $(li);
    const a = $li.find("a.sch-u, a").first();
    const rawHref = a.attr("href") || "";
    const link = resolveUrl(rawHref, baseUrl);
    const id = extractSlugFromUrl(link);

    const title = sanitizeText($li.find(".sch-ut").text());
    if (!title && !id) return;

    const jtitle = sanitizeText($li.find(".sch-ut").attr("data-jtitle"));
    const posterRaw =
      $li.find(".sch-uq img").attr("src") ||
      $li.find(".sch-uq img").attr("data-src") ||
      $li.find("img").attr("src") ||
      "";
    const poster = resolveUrl(posterRaw, baseUrl);
    const episode = sanitizeText($li.find(".sch-uep").text());
    const tag = sanitizeText($li.find(".sch-tag").text());

    unscheduled.push({
      id,
      title,
      japaneseTitle: jtitle || undefined,
      poster,
      episode: episode || undefined,
      tag: tag || undefined,
      link,
    });
  });

  return {
    weekLabel,
    hero,
    days,
    unscheduled,
  };
}
