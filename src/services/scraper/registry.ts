import type {
  AnimeDetail,
  AnimeHomePage,
  Episode,
  SearchFilter,
} from '@/types';
import { AnimeWorldScraper, AnimeWorldScraperService } from './animeworld-scraper';
import type { AnimeProvider, AnimeSearchResult, ResolvedVideoSource } from './types';

export class AnimeWorldProvider implements AnimeProvider {
  public readonly id = 'animeworld';
  public readonly name = 'AnimeWorld';

  private scraper: AnimeWorldScraperService;

  constructor(scraperService: AnimeWorldScraperService = AnimeWorldScraper) {
    this.scraper = scraperService;
  }

  public async getHome(): Promise<AnimeHomePage> {
    return this.scraper.getHomePage();
  }

  public async getAnimeDetail(animeId: string): Promise<AnimeDetail | null> {
    try {
      return await this.scraper.getAnimeDetail(animeId);
    } catch {
      return null;
    }
  }

  public async search(
    query: string | SearchFilter,
    signal?: AbortSignal
  ): Promise<AnimeSearchResult> {
    const res = await this.scraper.searchAnime(query, signal);
    return {
      items: res.items,
      currentPage: res.currentPage,
      totalPages: res.totalPages,
    };
  }

  public async resolveVideo(
    episode: Episode,
    serverId = '9'
  ): Promise<ResolvedVideoSource | null> {
    const direct = await this.scraper.resolveEpisodeVideo(episode, serverId);
    if (!direct?.url) return null;
    return {
      url: direct.url,
      headers: direct.headers,
      serverName: direct.serverName,
    };
  }
}

class ProviderRegistryClass {
  private providers = new Map<string, AnimeProvider>();
  private activeProviderId = 'animeworld';

  constructor() {
    this.registerProvider(new AnimeWorldProvider());
  }

  public registerProvider(provider: AnimeProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id?: string): AnimeProvider {
    const targetId = id || this.activeProviderId;
    const found = this.providers.get(targetId);
    if (!found) {
      const fallback = this.providers.get('animeworld');
      if (fallback) return fallback;
      throw new Error(`[ProviderRegistry] Provider not found: ${targetId}`);
    }
    return found;
  }

  public getAllProviders(): AnimeProvider[] {
    return Array.from(this.providers.values());
  }

  public setActiveProvider(id: string): void {
    if (!this.providers.has(id)) {
      console.warn(`[ProviderRegistry] Unknown provider: ${id}, ignoring`);
      return;
    }
    this.activeProviderId = id;
  }

  public getActiveProvider(): AnimeProvider {
    return this.getProvider(this.activeProviderId);
  }

  public hasMultipleProviders(): boolean {
    return this.providers.size > 1;
  }

  public unregisterProvider(id: string): boolean {
    if (id === 'animeworld') {
      console.warn('[ProviderRegistry] Cannot unregister default animeworld provider');
      return false;
    }
    const removed = this.providers.delete(id);
    if (this.activeProviderId === id) {
      this.activeProviderId = 'animeworld';
    }
    return removed;
  }

  public reset(): void {
    this.providers.clear();
    this.activeProviderId = 'animeworld';
    this.registerProvider(new AnimeWorldProvider());
  }

  /**
   * Attempts to resolve episode video through the active provider first,
   * with automatic failover to registered alternative providers if unavailable.
   */
  public async resolveVideoWithFallback(
    episode: Episode,
    serverId?: string
  ): Promise<ResolvedVideoSource | null> {
    const active = this.getActiveProvider();
    try {
      const result = await active.resolveVideo(episode, serverId);
      if (result?.url) return result;
    } catch (err) {
      console.warn(`[ProviderRegistry] Provider ${active.id} failed to resolve video:`, err);
    }

    // Try other registered providers as fallback
    for (const [id, provider] of this.providers) {
      if (id === active.id) continue;
      try {
        const fallbackRes = await provider.resolveVideo(episode, serverId);
        if (fallbackRes?.url) return fallbackRes;
      } catch (err) {
        console.warn(`[ProviderRegistry] Fallback provider ${id} failed:`, err);
      }
    }

    return null;
  }
}

export const ProviderRegistry = new ProviderRegistryClass();
