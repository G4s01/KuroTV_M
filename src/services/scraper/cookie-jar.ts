import { scraperConfig } from "./config";

export interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
}

export class CookieJar {
  private cookies = new Map<string, Map<string, CookieEntry>>();

  public setCookiePair(
    name: string,
    value: string,
    domain?: string,
    path = "/",
  ): void {
    const cleanDomain = this.normalizeDomain(
      domain || scraperConfig.getHostname(),
    );
    if (!this.cookies.has(cleanDomain)) {
      this.cookies.set(cleanDomain, new Map());
    }
    this.cookies.get(cleanDomain)!.set(name.trim(), {
      name: name.trim(),
      value: value.trim(),
      domain: cleanDomain,
      path,
    });
  }

  public setCookie(
    cookieHeader: string | string[] | undefined | null,
    requestUrl?: string,
  ): void {
    if (!cookieHeader) return;

    const cookieStrings = Array.isArray(cookieHeader)
      ? cookieHeader
      : this.splitSetCookieHeader(cookieHeader);

    let defaultDomain = scraperConfig.getHostname();
    if (requestUrl) {
      try {
        defaultDomain = this.normalizeDomain(new URL(requestUrl).hostname);
      } catch {
        defaultDomain = scraperConfig.getHostname();
      }
    }

    for (const raw of cookieStrings) {
      const parsed = this.parseCookieString(raw, defaultDomain);
      if (parsed) {
        const domain = parsed.domain || defaultDomain;
        if (!this.cookies.has(domain)) {
          this.cookies.set(domain, new Map());
        }
        this.cookies.get(domain)!.set(parsed.name, parsed);
      }
    }
  }

  public getCookie(name: string, domain?: string): string | undefined {
    const cleanDomain = this.normalizeDomain(domain || "");
    if (cleanDomain && this.cookies.has(cleanDomain)) {
      const entry = this.cookies.get(cleanDomain)?.get(name);
      if (entry && (!entry.expires || entry.expires > Date.now())) {
        return entry.value;
      }
    }

    // Search across all domains if domain not specified or not found
    for (const [, entries] of this.cookies.entries()) {
      const entry = entries.get(name);
      if (entry && (!entry.expires || entry.expires > Date.now())) {
        return entry.value;
      }
    }

    return undefined;
  }

  public getCookieString(targetUrl: string): string {
    let hostname = "";
    let pathname = "/";
    try {
      const parsed = new URL(targetUrl);
      hostname = this.normalizeDomain(parsed.hostname);
      pathname = parsed.pathname || "/";
    } catch {
      hostname = this.normalizeDomain(targetUrl);
    }

    const matchedCookies: string[] = [];
    const now = Date.now();

    for (const [domain, entries] of this.cookies.entries()) {
      if (this.isDomainMatch(domain, hostname)) {
        for (const entry of entries.values()) {
          if (entry.expires && entry.expires <= now) {
            continue;
          }
          if (entry.path && !pathname.startsWith(entry.path)) {
            continue;
          }
          matchedCookies.push(`${entry.name}=${entry.value}`);
        }
      }
    }

    return matchedCookies.join("; ");
  }

  public clear(): void {
    this.cookies.clear();
  }

  public getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [, entries] of this.cookies.entries()) {
      for (const [name, entry] of entries.entries()) {
        result[name] = entry.value;
      }
    }
    return result;
  }

  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^\.+/, "");
  }

  private isDomainMatch(cookieDomain: string, targetHost: string): boolean {
    if (!cookieDomain || !targetHost) return false;
    const cleanCookie = this.normalizeDomain(cookieDomain);
    const cleanTarget = this.normalizeDomain(targetHost);
    if (cleanCookie === cleanTarget) return true;
    if (cleanTarget.endsWith(`.${cleanCookie}`)) return true;
    return false;
  }

  private parseCookieString(
    raw: string,
    defaultDomain: string,
  ): CookieEntry | null {
    const parts = raw.split(";").map((s) => s.trim());
    if (parts.length === 0 || !parts[0].includes("=")) return null;

    const firstEq = parts[0].indexOf("=");
    const name = parts[0].substring(0, firstEq).trim();
    const value = parts[0].substring(firstEq + 1).trim();

    if (!name) return null;

    const entry: CookieEntry = {
      name,
      value,
      domain: defaultDomain,
      path: "/",
    };

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const eqIdx = part.indexOf("=");
      const key = (eqIdx !== -1 ? part.substring(0, eqIdx) : part)
        .trim()
        .toLowerCase();
      const val = eqIdx !== -1 ? part.substring(eqIdx + 1).trim() : "";

      switch (key) {
        case "domain":
          entry.domain = this.normalizeDomain(val);
          break;
        case "path":
          entry.path = val || "/";
          break;
        case "max-age": {
          const maxAge = parseInt(val, 10);
          if (!isNaN(maxAge)) {
            entry.expires = Date.now() + maxAge * 1000;
          }
          break;
        }
        case "expires": {
          const expTime = Date.parse(val);
          if (!isNaN(expTime)) {
            entry.expires = expTime;
          }
          break;
        }
        case "secure":
          entry.secure = true;
          break;
        case "httponly":
          entry.httpOnly = true;
          break;
      }
    }

    return entry;
  }

  private splitSetCookieHeader(headerStr: string): string[] {
    const cookies: string[] = [];
    let start = 0;

    for (let i = 0; i < headerStr.length; i++) {
      if (headerStr[i] === ",") {
        // Look behind to check if this comma is after a 3-letter weekday (Expires attribute like "Wed,")
        const prefix = headerStr.substring(Math.max(0, i - 4), i).trim();
        const isDayOfWeek = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i.test(prefix);

        // Check if what follows matches a new cookie declaration (e.g. " name=value")
        const suffix = headerStr.substring(i + 1);
        const looksLikeNewCookie = /^\s*[\w.!#$%&'*+`|~-]+=[^;]*/.test(suffix);

        if (!isDayOfWeek && looksLikeNewCookie) {
          cookies.push(headerStr.substring(start, i).trim());
          start = i + 1;
        }
      }
    }

    if (start < headerStr.length) {
      cookies.push(headerStr.substring(start).trim());
    }

    return cookies.filter(Boolean);
  }
}
