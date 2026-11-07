const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&eacute;": "é",
  "&egrave;": "è",
  "&agrave;": "à",
  "&igrave;": "ì",
  "&ograve;": "ò",
  "&ugrave;": "ù",
  "&bull;": "•",
};

export function unescapeHtml(str: string): string {
  if (!str) return "";

  let result = str.replace(
    /&(?:amp|lt|gt|quot|#039|apos|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip|eacute|egrave|agrave|igrave|ograve|ugrave|bull);/gi,
    (entity) => HTML_ENTITIES[entity.toLowerCase()] || entity,
  );

  // Decimal entities: &#123;
  result = result.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCharCode(parseInt(dec, 10));
    } catch {
      return "";
    }
  });

  // Hexadecimal entities: &#x1f44d;
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  return result;
}

export function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";
  const decoded = unescapeHtml(text);
  return (
    decoded
      // Remove invisible control characters (preserve normal whitespace \n, \t, etc.)
      .replace(
        /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\uFEFF]/g,
        "",
      )
      // Collapse multiple horizontal spaces and tabs into a single space
      .replace(/[^\S\r\n]+/g, " ")
      .trim()
  );
}

export function cleanSynopsis(synopsis: string | null | undefined): string {
  if (!synopsis || !synopsis.trim()) return "Nessuna sinossi disponibile.";

  let text = synopsis;
  // Strip markdown spoiler syntax ~!...text...!~
  text = text.replace(/~!(.*?)!~/gs, "$1");

  // Replace <br>, <br/>, </p>, </div> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Unescape entities
  text = unescapeHtml(text);

  // Filter out disclaimer lines
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .filter(
      (line) =>
        !/^(?:Trama tratta da|Fonte trama|Fonte\b|Source:|\[Written by|\(Source:)/i.test(
          line,
        ) && !/\(Source:\s*[^)]+\)$/i.test(line),
    );

  // Collapse 3+ consecutive newlines to 2
  const cleaned = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || "Nessuna sinossi disponibile.";
}

export function extractBackgroundUrl(style: string | null | undefined): string {
  if (!style) return "";

  // Match url("...") or url('...') or url(...)
  const match = style.match(
    /background(?:-image)?\s*:\s*url\(\s*['"]?([^'"()]+)['"]?\s*\)/i,
  );
  let rawUrl = "";
  if (match && match[1]) {
    rawUrl = match[1].trim();
  } else {
    // Fallback: match any http/https URL within the style string
    const fallbackMatch = style.match(/https?:\/\/[^\s'"()]+/i);
    if (fallbackMatch) {
      rawUrl = fallbackMatch[0].trim();
    }
  }

  if (!rawUrl) return "";

  // Protocol-relative URL
  if (rawUrl.startsWith("//")) {
    return `https:${rawUrl}`;
  }

  return rawUrl;
}

export function sanitizeTitleForSearch(
  title: string | null | undefined,
): string {
  if (!title) return "";

  let sanitized = title;

  // Remove Italian audio tags: (ITA), (SUB ITA), [SUB-ITA], [ITA], (Doppiato/a), (Serie Doppiata), etc.
  sanitized = sanitized.replace(
    /\s*[\(\[]\s*(?:SUB[-\s]*ITA|ITA|(?:SERIE\s+)?DOPPIAT[OA]|AUDIO[-\s]*ITA|SUBBED)\s*[\)\]]/gi,
    "",
  );
  sanitized = sanitized.replace(
    /\s+(?:SUB[-\s]*ITA|ITA|(?:SERIE\s+)?DOPPIAT[OA])$/gi,
    "",
  );

  // Remove common format tags: (TV), (Movie), (OVA), (ONA), (Special), (Uncensored)
  sanitized = sanitized.replace(
    /\s*[\(\[]\s*(?:TV|MOVIE|OVA|ONA|SPECIAL|UNCENSORED|CENSORED)\s*[\)\]]/gi,
    "",
  );

  // Normalize spaces
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized;
}

export function extractAniListId(
  url: string | null | undefined,
): number | undefined {
  if (!url) return undefined;
  const match = url.match(/anilist\.co\/anime\/(\d+)/i);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? undefined : id;
  }
  return undefined;
}

export function extractMalId(
  url: string | null | undefined,
): number | undefined {
  if (!url) return undefined;
  const match = url.match(/myanimelist\.net\/anime\/(\d+)/i);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? undefined : id;
  }
  return undefined;
}

export function extractSlugFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  const clean = url.split("?")[0].replace(/\/+$/, "");
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return "";

  // If url is like /play/<anime-slug>/<episode-id>
  const playIdx = segments.indexOf("play");
  if (playIdx !== -1 && playIdx + 1 < segments.length) {
    return segments[playIdx + 1];
  }

  // If url is like /anime/<anime-slug>
  const animeIdx = segments.indexOf("anime");
  if (animeIdx !== -1 && animeIdx + 1 < segments.length) {
    return segments[animeIdx + 1];
  }

  const last = segments[segments.length - 1];
  // If last segment is purely numeric (e.g. episode number /play/slug/1) or ep-1, take anime slug before it
  if (/^(?:ep-)?\d+$/i.test(last) && segments.length > 1) {
    return segments[segments.length - 2];
  }
  return last;
}

export function resolveUrl(
  relativeOrAbsolute: string,
  baseUrl: string,
): string {
  if (!relativeOrAbsolute) return "";
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    if (/^https?:\/\//i.test(relativeOrAbsolute)) {
      return relativeOrAbsolute;
    }
    if (relativeOrAbsolute.startsWith("//")) {
      return `https:${relativeOrAbsolute}`;
    }
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const cleanPath = relativeOrAbsolute.startsWith("/")
      ? relativeOrAbsolute
      : `/${relativeOrAbsolute}`;
    return `${cleanBase}${cleanPath}`;
  }
}
