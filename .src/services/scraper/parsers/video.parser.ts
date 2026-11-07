import type { DirectVideoQuality, DirectVideoSource, Episode } from "@/types";
import { HttpClient } from "../http-client";
import { scraperConfig } from "../config";
import { resolveUrl } from "../utils";

export function cleanGrabberUrl(grabber: string): string {
  if (!grabber) return "";

  let cleaned = grabber.trim();

  // Strip prefixes like /raw/link= or link=
  const linkIndex = cleaned.indexOf("link=");
  if (linkIndex !== -1) {
    cleaned = cleaned.substring(linkIndex + 5);
  }

  // Only decode if the entire protocol scheme is URL-encoded (e.g. https%3A%2F%2F...)
  if (/^https?%3A%2F%2F/i.test(cleaned)) {
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // Keep as-is if malformed
    }
  }

  // Protocol-relative URLs (e.g. //domain.com/path)
  if (cleaned.startsWith("//")) {
    cleaned = `https:${cleaned}`;
  }

  // Normalize duplicate slashes in the URL path while preserving https:// and query params
  cleaned = cleaned.replace(/(https?:\/\/)\/+/g, "$1");
  const [urlBase, ...queryParts] = cleaned.split("?");
  const normalizedBase = urlBase.replace(/([^:])\/\/+/g, "$1/");
  cleaned =
    queryParts.length > 0
      ? `${normalizedBase}?${queryParts.join("?")}`
      : normalizedBase;

  return cleaned.trim();
}

export function parseHlsMasterPlaylist(
  playlistText: string,
  masterPlaylistUrl: string,
): DirectVideoQuality[] {
  const qualities: DirectVideoQuality[] = [];
  const lines = playlistText.split(/\r?\n/);

  let currentQuality = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
      const nameMatch = line.match(/NAME="?([^",]+)"?/i);

      if (resMatch && resMatch[1]) {
        currentQuality = `${resMatch[1]}p`;
      } else if (nameMatch && nameMatch[1]) {
        currentQuality = nameMatch[1];
      } else {
        currentQuality = "Auto";
      }
    } else if (line && !line.startsWith("#")) {
      // Resolve the stream URL against the master playlist URL (handles ./, relative, and root-relative)
      const streamUrl = resolveUrl(line, masterPlaylistUrl);

      qualities.push({
        quality: currentQuality || "Default",
        url: streamUrl,
      });

      currentQuality = "";
    }
  }

  // Sort qualities descending by resolution (1080p -> 720p -> 480p -> 360p)
  qualities.sort((a, b) => {
    const aNum = parseInt(a.quality.replace(/\D+/g, ""), 10) || 0;
    const bNum = parseInt(b.quality.replace(/\D+/g, ""), 10) || 0;
    return bNum - aNum;
  });

  return qualities;
}

export async function resolveVideoSource(
  grabber: string,
  serverId: string,
  episode: Episode,
  httpClient: HttpClient,
): Promise<DirectVideoSource | null> {
  if (!grabber) return null;

  const defaultHeaders: Record<string, string> = {
    Referer: episode.referer || scraperConfig.getBaseUrl(),
    "User-Agent": scraperConfig.getUserAgent(),
  };

  const cleanedUrl = cleanGrabberUrl(grabber);

  // 1. Priority: Server 9 (AnimeWorld Server)
  if (serverId === "9" || (!serverId && cleanedUrl.includes("animeworld"))) {
    const isM3u8 = cleanedUrl.includes(".m3u8");
    const format = isM3u8 ? "hls" : "mp4";

    let qualities: DirectVideoQuality[] = [];
    if (isM3u8) {
      try {
        const response = await httpClient.getPage(cleanedUrl, defaultHeaders);
        qualities = parseHlsMasterPlaylist(response, cleanedUrl);
      } catch (err) {
        // If master playlist fetch fails, still return master URL directly
        console.warn(
          "[VideoParser] Failed to parse HLS qualities from master playlist:",
          err,
        );
      }
    }

    return {
      url: cleanedUrl,
      format,
      headers: defaultHeaders,
      serverName: "AnimeWorld Server",
      serverId: "9",
      qualities: qualities.length > 0 ? qualities : undefined,
      masterUrl: isM3u8 ? cleanedUrl : undefined,
    };
  }

  // 2. Server 6 (Server 2)
  if (serverId === "6") {
    const isM3u8 = cleanedUrl.includes(".m3u8");
    return {
      url: cleanedUrl,
      format: isM3u8 ? "hls" : "mp4",
      headers: defaultHeaders,
      serverName: "Server 2",
      serverId: "6",
    };
  }

  // 3. Server 8 (Streamtape)
  if (serverId === "8" || cleanedUrl.includes("streamtape.com")) {
    try {
      const pageHtml = await httpClient.getPage(cleanedUrl, {
        Referer: episode.referer || scraperConfig.getBaseUrl(),
      });
      // Extract robotlink
      // Pattern: ('robotlink').innerHTML = '...' + ('...').substring(4)
      const robotMatch = pageHtml.match(
        /\('robotlink'\)\.innerHTML\s*=\s*['"](.*?)['"]\s*\+\s*\(?['"](.*?)['"]/,
      );
      if (robotMatch && robotMatch[1] && robotMatch[2]) {
        const part1 = robotMatch[1];
        const part2 = robotMatch[2].startsWith("indexOf")
          ? robotMatch[2].substring(4)
          : robotMatch[2];
        const directUrl = `https:${part1}${part2}`;
        return {
          url: directUrl,
          format: "mp4",
          headers: defaultHeaders,
          serverName: "Streamtape",
          serverId: "8",
        };
      }
    } catch (err) {
      console.warn("[VideoParser] Streamtape resolution failed:", err);
    }
  }

  // 4. Server 2 (DoodStream)
  if (serverId === "2" || cleanedUrl.includes("dood.")) {
    try {
      const pageHtml = await httpClient.getPage(cleanedUrl);
      const md5Match = pageHtml.match(/\$\.get\('(\/pass_md5[^']+)'/);
      if (md5Match && md5Match[1]) {
        const host =
          cleanedUrl.match(/https?:\/\/[^\/]+/)?.[0] || "https://dood.so";
        const md5Url = `${host}${md5Match[1]}`;
        const md5Token = md5Url.split("/").pop() || "";

        const partialLinkRes = await httpClient.get<string>(md5Url, {
          headers: {
            Referer: cleanedUrl,
            "X-Requested-With": "XMLHttpRequest",
          },
          responseType: "text",
        });

        const partialLink = String(partialLinkRes.data);
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let randomLetters = "";
        for (let i = 0; i < 10; i++) {
          randomLetters += chars.charAt(
            Math.floor(Math.random() * chars.length),
          );
        }
        const now = Date.now();
        const streamUrl = `${partialLink}${randomLetters}?token=${md5Token}&expiry=${now}`;

        return {
          url: streamUrl,
          format: "mp4",
          headers: {
            Referer: `${host}/`,
            "User-Agent": scraperConfig.getUserAgent(),
          },
          serverName: "DoodStream",
          serverId: "2",
        };
      }
    } catch (err) {
      console.warn("[VideoParser] DoodStream resolution failed:", err);
    }
  }

  // 5. Fallback for any other valid stream URL
  if (cleanedUrl.startsWith("http://") || cleanedUrl.startsWith("https://")) {
    const isM3u8 = cleanedUrl.includes(".m3u8");
    return {
      url: cleanedUrl,
      format: isM3u8 ? "hls" : "mp4",
      headers: defaultHeaders,
      serverName: `Server ${serverId || "Unknown"}`,
      serverId: serverId || "0",
    };
  }

  return null;
}
