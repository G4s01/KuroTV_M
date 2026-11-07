import type { ScraperConfig } from '@/types';

export const DEFAULT_TLD = 'so';
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0';
export const DEFAULT_TIMEOUT_MS = 15000;

class ConfigManager {
  private tld = DEFAULT_TLD;
  private customBaseUrl: string | null = null;
  private userAgent = DEFAULT_USER_AGENT;
  private timeout = DEFAULT_TIMEOUT_MS;

  public getTld(): string {
    return this.tld;
  }

  public setTld(newTld: string): void {
    const cleanTld = newTld.replace(/^\.+/, '').trim().toLowerCase();
    if (cleanTld) {
      this.tld = cleanTld;
      this.customBaseUrl = null;
    }
  }

  public getBaseUrl(): string {
    if (this.customBaseUrl) {
      return this.customBaseUrl.replace(/\/+$/, '');
    }
    return `https://www.animeworld.${this.tld}`;
  }

  public setBaseUrl(newBaseUrl: string): void {
    const trimmed = newBaseUrl.trim().replace(/\/+$/, '');
    if (trimmed) {
      this.customBaseUrl = trimmed;
      try {
        const parsed = new URL(trimmed);
        const hostParts = parsed.hostname.split('.');
        if (hostParts.length > 1) {
          this.tld = hostParts[hostParts.length - 1];
        }
      } catch {
        // Keep current tld if URL parse fails
      }
    }
  }

  public getUserAgent(): string {
    return this.userAgent;
  }

  public setUserAgent(ua: string): void {
    if (ua && ua.trim()) {
      this.userAgent = ua.trim();
    }
  }

  public getTimeout(): number {
    return this.timeout;
  }

  public setTimeout(ms: number): void {
    if (ms > 0) {
      this.timeout = ms;
    }
  }

  public getHostname(): string {
    try {
      const parsed = new URL(this.getBaseUrl());
      return parsed.hostname;
    } catch {
      return `www.animeworld.${this.tld}`;
    }
  }

  public getEndpoints() {
    const base = this.getBaseUrl();
    const withSlash = `${base}/`;
    return {
      sitePrefixS: withSlash,
      sitePrefixNoS: base,
      searchPageUrl: `${withSlash}search?keyword=`,
      apiComment: `${withSlash}api/comments/anime/get/`,
      apiEpisode: `${withSlash}api/episode/info?id=`,
      newest: `${withSlash}newest?page=`,
      last: `${withSlash}updated?page=`,
      ongoing: `${withSlash}ongoing?page=`,
      random: `${withSlash}random`,
      anime: `${withSlash}animes?page=`,
      movies: `${withSlash}movies?page=`,
      ova: `${withSlash}ova?page=`,
      ona: `${withSlash}ona?page=`,
      special: `${withSlash}specials?page=`,
      music: `${withSlash}music?page=`,
      filter: `${withSlash}filter?`,
      upcoming: `${withSlash}upcoming/`,
      hostname: this.getHostname(),
    };
  }

  public getConfig(): ScraperConfig {
    return {
      tld: this.tld,
      baseUrl: this.getBaseUrl(),
      userAgent: this.userAgent,
      timeout: this.timeout,
    };
  }
}

export const scraperConfig = new ConfigManager();
