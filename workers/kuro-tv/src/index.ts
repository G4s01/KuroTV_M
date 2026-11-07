/**
 * Cloudflare Worker: kuro-tv (Multi-Platform OTA Updater & R2 Gatekeeper)
 *
 * Serves OTA update manifests and APK binaries for both:
 * 1. KuroTV (Android TV Client)
 *    - GET /manifest.json
 *    - GET /latest.apk, /latest-arm64-v8a.apk, /kurotv-v*.apk
 * 2. KuroTV Mobile (Android Touch Client)
 *    - GET /mobile/manifest.json
 *    - GET /mobile/latest.apk, /mobile/latest-*.apk, /mobile/kurotv-mobile-v*.apk
 *
 * Security:
 * - Positive Whitelist: only valid .apk and manifest.json files are served.
 * - Explicit 403 Forbidden on secure-backups/ or any unknown file paths.
 * - Optional token authentication via OTA_SECRET_TOKEN (Bearer token, X-OTA-Token, or ?token=).
 */

export interface Env {
  R2_BUCKET: R2Bucket;
  OTA_SECRET_TOKEN?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-OTA-Token, Content-Type',
};

// Positive Whitelist Regex
const ALLOWED_TV_PATH = /^(\/manifest\.json|\/[a-zA-Z0-9_\-\.]+\.apk)$/;
const ALLOWED_MOBILE_PATH = /^(\/mobile\/manifest\.json|\/mobile\/[a-zA-Z0-9_\-\.]+\.apk)$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health' || pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: 'kuro-tv-ota' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Security Gate 1: Reject secure-backups/ or any attempt to traverse
    if (pathname.includes('secure-backups') || pathname.includes('..')) {
      return new Response('Forbidden', { status: 403, headers: CORS_HEADERS });
    }

    // Security Gate 2: Whitelist verification
    const isTvMatch = ALLOWED_TV_PATH.test(pathname);
    const isMobileMatch = ALLOWED_MOBILE_PATH.test(pathname);

    if (!isTvMatch && !isMobileMatch) {
      return new Response('Not Found or Forbidden', { status: 404, headers: CORS_HEADERS });
    }

    // Security Gate 3: Optional OTA Secret Token verification
    if (env.OTA_SECRET_TOKEN && env.OTA_SECRET_TOKEN.trim().length > 0) {
      const authHeader = request.headers.get('Authorization') || '';
      const customToken = request.headers.get('X-OTA-Token') || '';
      const queryToken = url.searchParams.get('token') || '';

      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const providedToken = bearerToken || customToken || queryToken;

      if (providedToken !== env.OTA_SECRET_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid OTA Token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    // Strip leading slash for R2 object key
    const r2Key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    // Fetch object from R2
    const object = await env.R2_BUCKET.get(r2Key, {
      range: request.headers,
      onlyIf: request.headers,
    });

    if (!object) {
      return new Response('Object Not Found', { status: 404, headers: CORS_HEADERS });
    }

    const headers = new Headers(CORS_HEADERS);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    if (r2Key.endsWith('.apk')) {
      headers.set('Content-Type', 'application/vnd.android.package-archive');
      const filename = r2Key.split('/').pop() || 'kurotv.apk';
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Cache-Control', 'public, max-age=3600');
    } else if (r2Key.endsWith('.json')) {
      headers.set('Content-Type', 'application/json');
      headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    }

    return new Response(object.body, {
      status: object.range ? 206 : 200,
      headers,
    });
  },
};
