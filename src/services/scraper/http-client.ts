import { create } from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { CookieJar } from "./cookie-jar";
import { scraperConfig } from "./config";
import { resolveUrl } from "./utils";

export interface HttpClientOptions {
  cookieJar?: CookieJar;
  timeout?: number;
  maxRedirects?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  public readonly cookieJar: CookieJar;
  private maxRedirects: number;

  constructor(options: HttpClientOptions = {}) {
    this.cookieJar = options.cookieJar || new CookieJar();
    this.maxRedirects = options.maxRedirects ?? 5;

    this.client = create({
      timeout: options.timeout ?? scraperConfig.getTimeout(),
      // Custom redirect handling to ensure cookies are captured at every redirect step
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  public async getPage(
    url: string,
    customHeaders?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await this.request<string>(url, {
      method: "GET",
      headers: customHeaders,
      responseType: "text",
      signal,
    });
    return response.data;
  }


  public async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: "GET" });
  }

  public async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: "POST", data });
  }

  public async request<T = unknown>(
    initialUrl: string,
    config: AxiosRequestConfig = {},
    redirectCount = 0,
  ): Promise<AxiosResponse<T>> {
    let currentUrl = initialUrl;
    if (
      !currentUrl.startsWith("http://") &&
      !currentUrl.startsWith("https://")
    ) {
      currentUrl = resolveUrl(currentUrl, scraperConfig.getBaseUrl());
    }

    if (redirectCount > this.maxRedirects) {
      throw new Error(
        `[HttpClient] Too many redirects (max: ${this.maxRedirects})`,
      );
    }

    const cookieString = this.cookieJar.getCookieString(currentUrl);

    const mergedHeaders: Record<string, string> = {
      "User-Agent": scraperConfig.getUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
      DNT: "1",
      Connection: "keep-alive",
      ...(config.headers as Record<string, string> | undefined),
    };

    if (cookieString) {
      mergedHeaders["Cookie"] = cookieString;
    }

    let response: AxiosResponse<T>;
    try {
      response = await this.client.request<T>({
        ...config,
        url: currentUrl,
        headers: mergedHeaders,
      });
    } catch (err: unknown) {
      // If axios threw on 3xx redirect status code when validateStatus isn't applied
      const axiosErr = err as { response?: AxiosResponse<T> };
      if (
        axiosErr.response &&
        axiosErr.response.status >= 300 &&
        axiosErr.response.status < 400
      ) {
        response = axiosErr.response;
      } else {
        throw err;
      }
    }

    // Capture cookies from Set-Cookie header
    this.extractAndSaveCookies(response, currentUrl);

    // 1. Handle HTTP 3xx Redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers["location"] as string | undefined;
      if (location) {
        let nextUrl = resolveUrl(location, currentUrl);
        if (
          nextUrl.startsWith("http://www.animeworld.") ||
          nextUrl.startsWith("http://animeworld.")
        ) {
          nextUrl = nextUrl.replace(/^http:/i, "https:");
        }
        const nextConfig: AxiosRequestConfig = { ...config };
        if (
          response.status === 301 ||
          response.status === 302 ||
          response.status === 303
        ) {
          nextConfig.method = "GET";
          nextConfig.data = undefined;
        }
        return this.request<T>(nextUrl, nextConfig, redirectCount + 1);
      }
    }

    // 2. Handle AnimeWorld JavaScript Challenge Bypass
    // When AnimeWorld returns a small HTML payload with document.cookie and location.href redirect
    if (
      typeof response.data === "string" &&
      response.data.length < 800 &&
      response.data.includes("document.cookie")
    ) {
      const bypassed = await this.handleJsChallenge<T>(
        response.data,
        currentUrl,
        config,
        redirectCount,
      );
      if (bypassed) {
        return bypassed;
      }
    }

    return response;
  }

  private extractAndSaveCookies(
    response: AxiosResponse,
    currentUrl: string,
  ): void {
    const rawSetCookie =
      response.headers["set-cookie"] ||
      (response.headers["Set-Cookie"] as string[] | string | undefined);
    if (rawSetCookie) {
      this.cookieJar.setCookie(rawSetCookie, currentUrl);
    }
  }

  private async handleJsChallenge<T>(
    html: string,
    currentUrl: string,
    config: AxiosRequestConfig,
    redirectCount: number,
  ): Promise<AxiosResponse<T> | null> {
    // Matches patterns like:
    // document.cookie="cookieName=cookieValue; path=/; domain=.animeworld.so"; location.href="/";
    // document.cookie = "cookieName=cookieValue; ..."; window.location.href = "https://...";
    const cookieRegex = /document\.cookie\s*=\s*["']([^"']+)["'];?/i;
    const locationRegex =
      /(?:window\.)?location(?:\.href|\.replace)?\s*(?:=|\()\s*["']([^"'\)]+)["']/i;

    const cookieMatch = html.match(cookieRegex);
    const locationMatch = html.match(locationRegex);

    if (cookieMatch && cookieMatch[1]) {
      const rawCookie = cookieMatch[1].trim();
      this.cookieJar.setCookie(rawCookie, currentUrl);

      const targetPathOrUrl =
        locationMatch && locationMatch[1]
          ? locationMatch[1].trim()
          : currentUrl;
      const redirectUrl = resolveUrl(targetPathOrUrl, currentUrl);

      const nextConfig: AxiosRequestConfig = {
        ...config,
        method: "GET",
        data: undefined,
      };

      return this.request<T>(redirectUrl, nextConfig, redirectCount + 1);
    }

    return null;
  }
}

export const defaultHttpClient = new HttpClient();
