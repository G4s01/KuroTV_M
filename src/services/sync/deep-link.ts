export interface ParsedKuroSyncDeepLink {
  url?: string;
  token?: string;
  profile?: string;
  code?: string;
}

const CUSTOM_SCHEME_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/\/*/;
const ACTION_HOSTS_AND_SEGMENTS = new Set(['sync', 'connect', 'pair', 'kurosync']);

function safeDecodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function getSchemeName(rawUrl: string): string | null {
  const match = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  return match ? match[1].toLowerCase() : null;
}

function normalizeUrlForRouteExtraction(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '/';

  if (/^exps?:\/\//i.test(trimmed)) {
    const expoGoMatch = trimmed.match(/^exps?:\/\/[^/]*\/--\/(.*)$/i);
    if (expoGoMatch) {
      return `/${expoGoMatch[1].replace(/^\/+/, '')}`;
    }
    const queryIdx = trimmed.indexOf('?');
    return queryIdx !== -1 ? `/${trimmed.slice(queryIdx)}` : '/';
  }

  const scheme = getSchemeName(trimmed);
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    const stripped = trimmed.replace(CUSTOM_SCHEME_REGEX, '');
    return stripped ? `/${stripped}` : '/';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(/^https?:\/\/[^/?#]+(.*)$/i);
    const tail = match?.[1] || '/';
    return tail.startsWith('/') ? tail : `/${tail}`;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getFirstRouteSegment(normalizedRoutePath: string): string {
  const pathOnly = normalizedRoutePath.split(/[?#]/)[0] || '';
  const cleaned = pathOnly.replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned.split('/')[0].toLowerCase();
}

/**
 * Parses deep links, Web Console links, and QR JSON payloads for KuroSync & Android TV pairing.
 * Pure Hermes-safe implementation with zero native or storage imports.
 */
export function parseKuroSyncDeepLink(deepLink: string): ParsedKuroSyncDeepLink | null {
  if (!deepLink) return null;
  const cleanLink = deepLink.trim();
  if (!cleanLink || cleanLink.includes('expo-development-client')) return null;

  // 1. Support JSON payloads from QR codes
  if (cleanLink.startsWith('{') && cleanLink.endsWith('}')) {
    try {
      const data = JSON.parse(cleanLink);
      if (data && typeof data === 'object') {
        const url = (data.url || data.serverUrl || data.baseUrl || '')?.trim() || undefined;
        const token = (data.token || data.deviceToken || '')?.trim() || undefined;
        const profile = (data.profile || data.profileId || '')?.trim() || undefined;
        const rawCode = (data.code || data.pairCode || '')?.trim();
        const code = rawCode ? rawCode.toUpperCase() : undefined;
        if (url || token || code || profile) {
          return { url, token, profile, code };
        }
      }
    } catch {
      // Ignore JSON error and proceed to URL parsing
    }
  }

  // 2. Validate prefix or query parameters
  const scheme = getSchemeName(cleanLink);
  const isCustomScheme = scheme === 'kurosync' || scheme === 'kurotv';
  const lower = cleanLink.toLowerCase();
  const hasKnownParams =
    lower.includes('url=') ||
    lower.includes('endpoint=') ||
    lower.includes('server=') ||
    lower.includes('serverurl=') ||
    lower.includes('baseurl=') ||
    lower.includes('token=') ||
    lower.includes('qrtoken=') ||
    lower.includes('exchangetoken=') ||
    lower.includes('code=') ||
    lower.includes('paircode=') ||
    lower.includes('/pair') ||
    lower.includes('/connect');

  if (!isCustomScheme && !hasKnownParams) {
    return null;
  }

  try {
    const isStandardUrl = /^https?:\/\//i.test(cleanLink);
    const urlToParse = isStandardUrl
      ? cleanLink
      : cleanLink.replace(CUSTOM_SCHEME_REGEX, 'https://dummy.local/');

    const parsed = new URL(urlToParse);
    let url =
      (
        parsed.searchParams.get('url') ??
        parsed.searchParams.get('endpoint') ??
        parsed.searchParams.get('server') ??
        parsed.searchParams.get('serverUrl') ??
        parsed.searchParams.get('baseUrl') ??
        ''
      ).trim() || undefined;

    // Infer server URL from origin if standard HTTP/HTTPS URL and no explicit url param was given
    if (!url && isStandardUrl && parsed.origin && parsed.origin !== 'null') {
      url = parsed.origin;
    }

    const token =
      (
        parsed.searchParams.get('token') ??
        parsed.searchParams.get('qrToken') ??
        parsed.searchParams.get('exchangeToken') ??
        ''
      ).trim() || undefined;
    const profile =
      (parsed.searchParams.get('profile') ?? parsed.searchParams.get('profileId') ?? '').trim() ||
      undefined;
    const rawCode = (
      parsed.searchParams.get('code') ??
      parsed.searchParams.get('pairCode') ??
      ''
    ).trim();
    const code = rawCode ? rawCode.toUpperCase() : undefined;

    if (!url && !token && !profile && !code) {
      return null;
    }

    return { url, token, profile, code };
  } catch {
    // Fallback regex parsing
    let url: string | undefined;
    const urlMatch = cleanLink.match(/[?&](?:url|endpoint|server|baseUrl|serverUrl)=([^&]+)/i);
    if (urlMatch) {
      url = safeDecodeParam(urlMatch[1]).trim() || undefined;
    } else if (/^https?:\/\//i.test(cleanLink)) {
      const originMatch = cleanLink.match(/^(https?:\/\/[^/?#]+)/i);
      if (originMatch) url = originMatch[1];
    }

    const tokenMatch = cleanLink.match(/[?&](?:token|qrToken|exchangeToken)=([^&]+)/i);
    const profileMatch = cleanLink.match(/[?&](?:profile|profileId)=([^&]+)/i);
    const codeMatch = cleanLink.match(/[?&](?:code|pairCode)=([^&]+)/i);

    const token = tokenMatch ? safeDecodeParam(tokenMatch[1]).trim() || undefined : undefined;
    const profile = profileMatch
      ? safeDecodeParam(profileMatch[1]).trim() || undefined
      : undefined;
    const rawCode = codeMatch ? safeDecodeParam(codeMatch[1]).trim() : '';
    const code = rawCode ? rawCode.toUpperCase() : undefined;

    if (!url && !token && !profile && !code) {
      return null;
    }

    return { url, token, profile, code };
  }
}

/**
 * Determines whether an incoming URL is an OAuth callback deep link for MyAnimeList
 * (`kurotv://mal-callback?code=...&state=...`).
 */
export function isMalAuthCallbackDeepLink(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('expo-development-client')) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('kurotv://mal-callback') || lower.startsWith('kurotv:///mal-callback')) {
    return true;
  }

  const routePath = normalizeUrlForRouteExtraction(trimmed).toLowerCase();
  return /^\/mal-callback(?:[/?#]|$)/.test(routePath);
}

/**
 * Determines whether an incoming URL is an action deep link for KuroSync / TV pairing
 * (handled via RootNavigation's ConfirmModal flow rather than Expo Router screen navigation).
 */
export function isKuroSyncActionDeepLink(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('expo-development-client')) {
    return false;
  }

  if (parseKuroSyncDeepLink(trimmed) !== null) {
    return true;
  }

  const scheme = getSchemeName(trimmed);
  if (scheme === 'kurosync') {
    return true;
  }

  const routePath = normalizeUrlForRouteExtraction(trimmed);
  const firstSegment = getFirstRouteSegment(routePath);
  if (ACTION_HOSTS_AND_SEGMENTS.has(firstSegment)) {
    return true;
  }

  return trimmed.toLowerCase().includes('kurosync');
}

/**
 * Resolves incoming OS/system URLs for Expo Router `+native-intent.tsx`.
 * - KuroSync action links (`kurosync://connect`, `kurosync://pair`, `kurotv://sync`, etc.):
 *   redirect cold starts to `'/'` (so RootLayout mounts instead of Unmatched Route) and return
 *   `null` on warm starts so Expo Router stays on the active screen while `RootNavigation`
 *   presents the confirmation `ConfirmModal`.
 * - Standard navigation deep links (`kurotv://anime/...`, `kurotv://downloads`, etc.):
 *   normalize to clean internal app routes.
 */
export function resolveSystemDeepLinkPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null {
  try {
    if (!path || typeof path !== 'string') {
      return initial ? '/' : null;
    }

    const trimmed = path.trim();
    if (!trimmed) {
      return initial ? '/' : null;
    }

    // Preserve Expo Dev Launcher deep links cleanly
    if (trimmed.includes('expo-development-client')) {
      return path;
    }

    if (isMalAuthCallbackDeepLink(trimmed)) {
      return initial ? '/' : null;
    }

    if (isKuroSyncActionDeepLink(trimmed)) {
      return initial ? '/' : null;
    }

    return normalizeUrlForRouteExtraction(trimmed);
  } catch {
    return initial ? '/' : null;
  }
}
