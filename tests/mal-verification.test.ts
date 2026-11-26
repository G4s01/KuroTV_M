import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as WebBrowser from 'expo-web-browser';
import { AppStorage, StorageKeys } from '../src/services/storage/app-storage';
import {
  MalAuthError,
  MalAuthService,
  MalClient,
  MalSyncService,
  addMalIgnoredAnimeIds,
  applyRemoteMalAuthRecordForScope,
  buildMalAuthorizeUrl,
  clearMalIgnoredAnimeIds,
  clearMalListCache,
  clearSyncedMalProfileData,
  computeLocalAppToMalDiffSnapshot,
  detectAnimeWorldAudioVariant,
  generateOAuthState,
  generatePkceCodeVerifier,
  getActiveMalProfileScope,
  getEffectiveMalClientId,
  getLocalCompletedEpisodesForAnime,
  getMalAuthSyncRecordForScope,
  getMalIdMapStore,
  getMalIgnoredAnimeIds,
  getMalListCache,
  getMalScopedKey,
  getMalSettings,
  getMappingByAnimeId,
  getMappingByMalId,
  isOngoingAnimeDetail,
  isValidMalClientId,
  parseMalCallbackUrl,
  parsePositiveTotalEpisodes,
  recordAnimeMalMapping,
  resolveMalToAnimeWorld,
  resolveMissingAnimeMalMappings,
  saveMalListCache,
  saveMalSettings,
  setMalScraperAdapterForTest,
  setManualAnimeMalMapping,
  setStoredMalClientId,
  shouldRevokeMalSessionOnRefreshError,
} from '../src/services/mal';
import { mergeLocalAndRemote } from '../src/services/sync/merge';
import { isMalAuthCallbackDeepLink, resolveSystemDeepLinkPath } from '../src/services/sync/deep-link';
import { redirectSystemPath } from '../app/+native-intent';
import type { AnimeDetail } from '../src/types';

const TEST_CLIENT_ID = 'testclientid1234567890abcdef1234';

function resetMalTestEnvironment(): void {
  MalAuthService.setHttpClientForTest(null);
  MalClient.setAxiosInstanceForTest(null);
  setMalScraperAdapterForTest(null);
  if (typeof (WebBrowser as any).setMockOpenAuthSessionHandler === 'function') {
    (WebBrowser as any).setMockOpenAuthSessionHandler(null);
  }
  MalSyncService.clearSessionAutoSyncCacheForTest();
  MalAuthService.logout();

  AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
  AppStorage.remove('sync.server_url_backup');
  AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
  AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
  AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
  AppStorage.remove(StorageKeys.SYNC_IS_ENABLED);
  AppStorage.remove(StorageKeys.SYNC_SERVER_SUPPORTS_MAL_AUTH);
  AppStorage.clearKnownTombstones();

  for (const scope of ['local', 'prof-1', 'prof-2', 'prof-sync']) {
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_CLIENT_ID, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_SETTINGS, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_IGNORED_ANIME_IDS, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_WATCHED_HIGHWATER, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LIST_CACHE, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, scope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, scope));
    if (scope !== 'local') {
      AppStorage.remove(`${StorageKeys.MAL_ID_MAP}.byMalId.p.${scope}`);
    }
  }
  AppStorage.remove(StorageKeys.MAL_ID_MAP);

  AppStorage.clearWatchHistory();
  AppStorage.setObject(StorageKeys.FAVORITES, []);
  AppStorage.remove(StorageKeys.SYNC_PENDING_MUTATIONS);
  AppStorage.remove(StorageKeys.SYNC_PENDING_DELETIONS);
  MalAuthService.handleSyncScopeChanged();
  MalSyncService.handleSyncScopeChanged();
}

function makeFakeMalEntry(overrides: {
  malId: number;
  title: string;
  status?: 'watching' | 'plan_to_watch' | 'completed' | 'on_hold' | 'dropped';
  watchedEpisodes?: number;
  numEpisodes?: number;
  mediaStatus?: string;
  score?: number;
}) {
  return {
    malId: overrides.malId,
    title: overrides.title,
    status: overrides.status ?? 'watching',
    watchedEpisodes: overrides.watchedEpisodes ?? 0,
    numEpisodes: overrides.numEpisodes ?? 0,
    mediaStatus: overrides.mediaStatus,
    score: overrides.score ?? 0,
  };
}

function makeFakeDetail(overrides: Partial<AnimeDetail> & { id: string; title: string }): AnimeDetail {
  return {
    id: overrides.id,
    title: overrides.title,
    image: overrides.image || 'https://example.com/poster.jpg',
    thumbnail: overrides.thumbnail || 'https://example.com/poster.jpg',
    description: overrides.description || '',
    genres: overrides.genres || [],
    link: overrides.link || `https://example.com/play/${overrides.id}`,
    episodes: overrides.episodes || [],
    malId: overrides.malId,
    anilistId: overrides.anilistId,
    totalEpisodes: overrides.totalEpisodes,
    status: overrides.status,
    state: overrides.state,
    audio: overrides.audio,
  };
}

export async function runMalVerificationTests(): Promise<void> {
  console.log('\n[38/38] Verifica Integrazione MyAnimeList (OAuth PKCE, Client, Mapper, Sync Diff, Auto-Sync Offline, Isolamento KuroSync & UI)...');

  try {
    // -------------------------------------------------------------------------
    // 1. Client ID config & zero hardcoding
    // -------------------------------------------------------------------------
    resetMalTestEnvironment();
    assert.strictEqual(
      getEffectiveMalClientId(),
      process.env.EXPO_PUBLIC_MAL_CLIENT_ID ? process.env.EXPO_PUBLIC_MAL_CLIENT_ID.trim() : '',
      'Nessun Client ID hardcoded di default quando MMKV è vuoto'
    );
    assert.strictEqual(isValidMalClientId('short123'), false);
    assert.strictEqual(isValidMalClientId('invalid space client id 12345'), false);
    assert.strictEqual(isValidMalClientId(TEST_CLIENT_ID), true);

    setStoredMalClientId(`  ${TEST_CLIENT_ID}  `);
    assert.strictEqual(getEffectiveMalClientId(), TEST_CLIENT_ID, 'Client ID salvato deve essere trimmato');

    // -------------------------------------------------------------------------
    // 2. PKCE 'plain', CSRF state, happy-path OAuth, idempotenza & race Linking
    // -------------------------------------------------------------------------
    const verifier = generatePkceCodeVerifier(64);
    assert.strictEqual(verifier.length, 64);
    assert.match(verifier, /^[A-Za-z0-9\-._~]+$/);

    const state = generateOAuthState(32);
    assert.strictEqual(state.length, 32);
    assert.match(state, /^[A-Za-z0-9]+$/);

    const authUrlStr = buildMalAuthorizeUrl({
      clientId: TEST_CLIENT_ID,
      codeVerifier: verifier,
      state,
    });
    const parsedAuthUrl = new URL(authUrlStr);
    assert.strictEqual(parsedAuthUrl.searchParams.get('response_type'), 'code');
    assert.strictEqual(parsedAuthUrl.searchParams.get('client_id'), TEST_CLIENT_ID);
    assert.strictEqual(parsedAuthUrl.searchParams.get('code_challenge'), verifier, 'MAL richiede PKCE plain');
    assert.strictEqual(parsedAuthUrl.searchParams.get('code_challenge_method'), 'plain');
    assert.strictEqual(parsedAuthUrl.searchParams.get('state'), state);
    assert.strictEqual(parsedAuthUrl.searchParams.get('redirect_uri'), 'kurotv://mal-callback');

    assert.strictEqual(parseMalCallbackUrl('not-a-valid-url://??'), null);
    const parsedCb = parseMalCallbackUrl('kurotv://mal-callback?code=abc123&state=xyz789');
    assert.deepStrictEqual(parsedCb, {
      code: 'abc123',
      state: 'xyz789',
      error: undefined,
      errorDescription: undefined,
    });

    AppStorage.remove(StorageKeys.MAL_CLIENT_ID);
    const noIdRes = await MalAuthService.startLogin('bad');
    assert.strictEqual(noIdRes.ok, false);

    let tokenExchangeCalls = 0;
    let lastTokenPostBody = '';
    MalAuthService.setHttpClientForTest({
      post: async (_url: string, body: string) => {
        tokenExchangeCalls++;
        lastTokenPostBody = body;
        return {
          data: {
            access_token: 'mal_access_token_1',
            refresh_token: 'mal_refresh_token_1',
            expires_in: 3600,
            token_type: 'Bearer',
          },
        };
      },
      get: async () => ({
        data: { id: 777, name: 'KuroReviewer', picture: 'https://cdn.myanimelist.net/u/777.jpg' },
      }),
    } as any);

    let capturedCallbackUrl = '';
    (WebBrowser as any).setMockOpenAuthSessionHandler(async (openUrl: string) => {
      const u = new URL(openUrl);
      assert.strictEqual(u.searchParams.get('code_challenge_method'), 'plain');
      const sentState = u.searchParams.get('state');
      const sentVerifier = u.searchParams.get('code_challenge');
      assert(sentState && sentState.length >= 16);
      assert(sentVerifier && sentVerifier.length >= 43);
      capturedCallbackUrl = `kurotv://mal-callback?code=auth_code_999&state=${sentState}`;
      return { type: 'success', url: capturedCallbackUrl };
    });

    const loginRes = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(loginRes.ok, true, 'OAuth PKCE happy path deve riuscire');
    assert.strictEqual(tokenExchangeCalls, 1);
    const tokenParams = new URLSearchParams(lastTokenPostBody);
    assert.strictEqual(tokenParams.get('grant_type'), 'authorization_code');
    assert.strictEqual(tokenParams.get('client_id'), TEST_CLIENT_ID);
    assert.strictEqual(tokenParams.get('code'), 'auth_code_999');
    assert.strictEqual(tokenParams.get('redirect_uri'), 'kurotv://mal-callback');
    assert.strictEqual(MalAuthService.isConnected(), true);
    assert.strictEqual(MalAuthService.getStatus().username, 'KuroReviewer');
    assert.strictEqual(AppStorage.getObject(StorageKeys.MAL_OAUTH_PENDING), null, 'Pending OAuth pulito post-login');

    const dupRes = await MalAuthService.handleCallbackUrl(capturedCallbackUrl);
    assert.strictEqual(dupRes.ok, true);
    assert.strictEqual(dupRes.alreadyHandled, true);
    assert.strictEqual(tokenExchangeCalls, 1, 'Callback duplicato non deve ripetere POST /token');

    MalAuthService.logout();
    (WebBrowser as any).setMockOpenAuthSessionHandler(async () => {
      return { type: 'success', url: 'kurotv://mal-callback?code=evil_code&state=WRONG_STATE' };
    });
    const csrfRes = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(csrfRes.ok, false);
    assert.match(csrfRes.error || '', /CSRF/i);
    assert.strictEqual(MalAuthService.isConnected(), false);

    (WebBrowser as any).setMockOpenAuthSessionHandler(async (openUrl: string) => {
      const s = new URL(openUrl).searchParams.get('state');
      return { type: 'success', url: `kurotv://mal-callback?error=access_denied&state=${s}` };
    });
    const deniedRes = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(deniedRes.ok, false);
    assert.strictEqual(deniedRes.cancelled, true);

    tokenExchangeCalls = 0;
    (WebBrowser as any).setMockOpenAuthSessionHandler(async (openUrl: string) => {
      const s = new URL(openUrl).searchParams.get('state');
      await MalAuthService.handleCallbackUrl(
        `kurotv://mal-callback?code=race_code&state=${s}`
      );
      return { type: 'dismiss' };
    });
    const raceLoginRes = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(raceLoginRes.ok, true, 'Se Linking ha completato il login, dismiss del browser non deve segnalare cancellazione');
    assert.strictEqual(tokenExchangeCalls, 1);

    // Failed concurrent Linking + openAuthSessionAsync race MUST return real error (not false expiry/cancel)
    MalAuthService.logout();
    MalAuthService.setHttpClientForTest({
      post: async () => {
        const err: any = new Error('Invalid Client');
        err.response = { status: 401, data: { error: 'invalid_client', message: 'Invalid client ID' } };
        throw err;
      },
    } as any);
    (WebBrowser as any).setMockOpenAuthSessionHandler(async (openUrl: string) => {
      const s = new URL(openUrl).searchParams.get('state');
      await MalAuthService.handleCallbackUrl(
        `kurotv://mal-callback?code=fail_code&state=${s}`
      );
      return { type: 'success', url: `kurotv://mal-callback?code=fail_code&state=${s}` };
    });
    const failedRaceRes = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(failedRaceRes.ok, false);
    assert(!/SCADUTA/i.test(failedRaceRes.error || ''), 'Errore reale dello scambio token non deve essere mascherato da SESSIONE SCADUTA');
    assert.match(failedRaceRes.error || '', /INVALID CLIENT/i);

    // -------------------------------------------------------------------------
    // 3. Single-flight Refresh & Offline Resilience vs Auth Revocation
    // -------------------------------------------------------------------------
    AppStorage.setObject(StorageKeys.MAL_AUTH_SESSION, {
      accessToken: 'expired_access_token',
      refreshToken: 'mal_refresh_token_1',
      expiresAt: Date.now() - 5000,
      tokenType: 'Bearer',
      username: 'KuroReviewer',
    });

    let refreshPostCount = 0;
    MalAuthService.setHttpClientForTest({
      post: async (_url: string, body: string) => {
        const p = new URLSearchParams(body);
        assert.strictEqual(p.get('grant_type'), 'refresh_token');
        refreshPostCount++;
        await new Promise((r) => setTimeout(r, 15));
        return {
          data: {
            access_token: 'mal_access_token_refreshed',
            refresh_token: 'mal_refresh_token_2',
            expires_in: 3600,
          },
        };
      },
      get: async () => ({ data: { id: 777, name: 'KuroReviewer' } }),
    } as any);

    const currentSess = MalAuthService.getSession()!;
    assert.strictEqual(currentSess.username, 'KuroReviewer');

    const [t1, t2, t3] = await Promise.all([
      MalAuthService.getValidAccessToken(),
      MalAuthService.getValidAccessToken(),
      MalAuthService.getValidAccessToken(),
    ]);
    assert.strictEqual(t1, 'mal_access_token_refreshed');
    assert.strictEqual(t2, 'mal_access_token_refreshed');
    assert.strictEqual(t3, 'mal_access_token_refreshed');
    assert.strictEqual(refreshPostCount, 1, 'Refresh concorrenti devono condividere un solo single-flight POST');

    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(undefined, 'ECONNRESET'), false);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(500, undefined), false);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(503, undefined), false);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(429, undefined), false);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(400, 'invalid_request'), false);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(401, undefined), true);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(403, undefined), true);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(400, 'invalid_grant'), true);
    assert.strictEqual(shouldRevokeMalSessionOnRefreshError(400, 'invalid_client'), true);

    MalAuthService.setHttpClientForTest({
      post: async () => {
        const err: any = new Error('Network Error');
        err.code = 'ECONNRESET';
        throw err;
      },
    } as any);
    await assert.rejects(
      () => MalAuthService.getValidAccessToken(true),
      (err: any) => err instanceof MalAuthError && err.isRevoked === false
    );
    assert.strictEqual(MalAuthService.isConnected(), true, 'Errore di rete offline non deve disconnettere sessione MAL');

    MalAuthService.setHttpClientForTest({
      post: async () => {
        const err: any = new Error('Service Unavailable');
        err.response = { status: 503, data: {} };
        throw err;
      },
    } as any);
    await assert.rejects(
      () => MalAuthService.getValidAccessToken(true),
      (err: any) => err instanceof MalAuthError && err.isRevoked === false
    );
    assert.strictEqual(MalAuthService.isConnected(), true, 'HTTP 503 non deve disconnettere sessione MAL');

    MalAuthService.setHttpClientForTest({
      post: async () => {
        const err: any = new Error('Bad Request');
        err.response = { status: 400, data: { error: 'invalid_grant' } };
        throw err;
      },
    } as any);
    await assert.rejects(
      () => MalAuthService.getValidAccessToken(true),
      (err: any) => err instanceof MalAuthError && err.isRevoked === true
    );
    assert.strictEqual(MalAuthService.isConnected(), false, 'invalid_grant deve revocare sessione MAL');

    // -------------------------------------------------------------------------
    // 4. Deep-Link Routing (+native-intent & deep-link.ts)
    // -------------------------------------------------------------------------
    assert.strictEqual(isMalAuthCallbackDeepLink('kurotv://mal-callback?code=abc&state=123'), true);
    assert.strictEqual(isMalAuthCallbackDeepLink('kurotv://mal'), false);
    assert.strictEqual(
      resolveSystemDeepLinkPath({ path: 'kurotv://mal-callback?code=abc&state=123', initial: true }),
      '/'
    );
    assert.strictEqual(
      resolveSystemDeepLinkPath({ path: 'kurotv://mal-callback?code=abc&state=123', initial: false }),
      null
    );
    assert.strictEqual(resolveSystemDeepLinkPath({ path: 'kurotv://mal', initial: false }), '/mal');
    assert.strictEqual(
      redirectSystemPath({ path: 'kurotv://mal-callback?code=abc&state=123', initial: true }),
      '/'
    );
    assert.strictEqual(
      redirectSystemPath({ path: 'kurotv://mal-callback?code=abc&state=123', initial: false }),
      null
    );
    assert.strictEqual(redirectSystemPath({ path: 'kurotv://mal', initial: false }), '/mal');

    // -------------------------------------------------------------------------
    // 5. MalClient: GET list pagination, GET status, PATCH form-urlencoded, DELETE, 401 retry
    // -------------------------------------------------------------------------
    resetMalTestEnvironment();
    setStoredMalClientId(TEST_CLIENT_ID);
    AppStorage.setObject(StorageKeys.MAL_AUTH_SESSION, {
      accessToken: 'initial_token',
      refreshToken: 'valid_refresh',
      expiresAt: Date.now() + 3600_000,
      tokenType: 'Bearer',
      username: 'TestUser',
    });

    let authRefreshHitInClientTest = 0;
    MalAuthService.setHttpClientForTest({
      post: async () => {
        authRefreshHitInClientTest++;
        return {
          data: {
            access_token: 'fresh_token_after_401',
            refresh_token: 'valid_refresh_2',
            expires_in: 3600,
          },
        };
      },
    } as any);

    const requestLog: Array<{ method: string; url: string; data?: any; authHeader?: string; contentType?: string }> = [];
    let forceSingle401OnMe = true;
    MalClient.setAxiosInstanceForTest({
      request: async (cfg: any) => {
        const method = String(cfg.method || 'GET').toUpperCase();
        const url = String(cfg.url || '');
        const authHeader = cfg.headers?.Authorization;
        const contentType = cfg.headers?.['Content-Type'];
        requestLog.push({ method, url, data: cfg.data, authHeader, contentType });

        if (url.includes('/users/@me') && !url.includes('/animelist')) {
          if (forceSingle401OnMe) {
            forceSingle401OnMe = false;
            const e: any = new Error('Unauthorized');
            e.response = { status: 401, data: { error: 'invalid_token' } };
            throw e;
          }
          return { data: { id: 101, name: 'RefreshedUser' } };
        }

        if (url.includes('/users/@me/animelist') && url.includes('status=watching')) {
          if (!url.includes('offset=2')) {
            return {
              data: {
                data: [
                  {
                    node: {
                      id: 52991,
                      title: 'Sousou no Frieren',
                      num_episodes: 28,
                      status: 'finished_airing',
                    },
                    list_status: {
                      status: 'watching',
                      score: 9,
                      num_episodes_watched: 10,
                    },
                  },
                ],
                paging: {
                  next: 'https://api.myanimelist.net/v2/users/@me/animelist?status=watching&offset=2',
                },
              },
            };
          }
          return {
            data: {
              data: [
                {
                  node: { id: 52991, title: 'Sousou no Frieren Duplicate', num_episodes: 28 },
                  list_status: { status: 'watching', num_episodes_watched: 10 },
                },
                {
                  node: { id: 21, title: 'One Piece', num_episodes: 0, status: 'currently_airing' },
                  list_status: { status: 'watching', num_episodes_watched: 1120 },
                },
              ],
              paging: {
                next: 'https://evil.example.com/steal-token',
              },
            },
          };
        }

        if (url.includes('/users/@me/animelist')) {
          return { data: { data: [], paging: {} } };
        }

        if (url.endsWith('/my_list_status') && method === 'PATCH') {
          return {
            data: {
              status: 'watching',
              num_episodes_watched: 14,
              score: 9,
              updated_at: '2026-11-25T18:00:00Z',
            },
          };
        }

        if (url.endsWith('/my_list_status') && method === 'DELETE') {
          return { data: {} };
        }

        if (url.includes('/anime/52991')) {
          return {
            data: {
              id: 52991,
              title: 'Sousou no Frieren',
              num_episodes: 28,
              status: 'finished_airing',
              my_list_status: { status: 'watching', num_episodes_watched: 14, score: 9 },
            },
          };
        }

        return { data: {} };
      },
    } as any);

    const me = await MalClient.getCurrentUser();
    assert.strictEqual(me.name, 'RefreshedUser');
    assert.strictEqual(authRefreshHitInClientTest, 1, '401 singolo deve eseguire refresh automatico e retry');

    const lists = await MalClient.fetchAllTrackedLists();
    assert.strictEqual(lists.watching.length, 2, 'Paginazione & dedup devono produrre 2 entry');
    assert.strictEqual(lists.watching[0].watchedEpisodes, 10, 'Deve leggere num_episodes_watched dalle GET MAL');
    assert(
      !requestLog.some((r) => r.url.includes('evil.example.com')),
      'URL paging.next esterni non MAL devono essere ignorati'
    );

    const patchResult = await MalClient.updateAnimeListStatus(52991, {
      status: 'watching',
      numWatchedEpisodes: 14,
      score: 9,
      animeSnapshot: { malId: 52991, title: 'Sousou no Frieren', numEpisodes: 28 },
    });
    assert.strictEqual(patchResult.watchedEpisodes, 14);
    const patchReq = requestLog.find((r) => r.method === 'PATCH');
    assert(patchReq, 'Deve inviare richiesta PATCH');
    assert.strictEqual(patchReq!.contentType, 'application/x-www-form-urlencoded');
    const patchBody = new URLSearchParams(patchReq!.data);
    assert.strictEqual(patchBody.get('num_watched_episodes'), '14', 'PATCH MAL deve usare num_watched_episodes');
    assert.strictEqual(patchBody.get('num_episodes_watched'), null);

    const cachedWatching = getMalListCache()?.watching || [];
    assert.strictEqual(
      cachedWatching.find((e) => e.malId === 52991)?.watchedEpisodes,
      14,
      'Cache locale aggiornata subito dopo PATCH'
    );

    const details = await MalClient.getAnimeUserStatus(52991);
    assert.strictEqual(details.numEpisodes, 28);
    assert.strictEqual(details.listEntry?.watchedEpisodes, 14);

    await MalClient.deleteAnimeListEntry(52991);
    assert.strictEqual(
      getMalListCache()?.watching.find((e) => e.malId === 52991),
      undefined,
      'Entry rimossa dalla cache dopo DELETE'
    );

    // getAnimeUserStatus returning my_list_status: null MUST prune stale cache entry
    saveMalListCache({
      watching: [makeFakeMalEntry({ malId: 52991, title: 'Stale Entry', status: 'watching', watchedEpisodes: 5 })],
      plan_to_watch: [],
      completed: [],
      updatedAt: Date.now(),
    });
    MalClient.setAxiosInstanceForTest({
      request: async () => ({
        data: { id: 52991, title: 'Sousou no Frieren', num_episodes: 28, status: 'finished_airing' },
      }),
    } as any);
    const removedRemoteStatus = await MalClient.getAnimeUserStatus(52991);
    assert.strictEqual(removedRemoteStatus.listEntry, null);
    assert.strictEqual(
      getMalListCache()?.watching.find((e) => e.malId === 52991),
      undefined,
      'getAnimeUserStatus senza my_list_status deve rimuovere la voce obsoleta da MAL_LIST_CACHE'
    );

    // -------------------------------------------------------------------------
    // 6. Bidirectional Mapper & Strict Rejection of anilistId
    // -------------------------------------------------------------------------
    resetMalTestEnvironment();

    assert.strictEqual(parsePositiveTotalEpisodes(12), 12);
    assert.strictEqual(parsePositiveTotalEpisodes('12/24'), 24);
    assert.strictEqual(parsePositiveTotalEpisodes('12/?'), null);
    assert.strictEqual(parsePositiveTotalEpisodes('??'), null);
    assert.strictEqual(parsePositiveTotalEpisodes(0), null);

    assert.strictEqual(detectAnimeWorldAudioVariant({ id: 'frieren-ita.abc', title: 'Frieren (ITA)' }), 'ita');
    assert.strictEqual(detectAnimeWorldAudioVariant({ id: 'frieren.abc', title: 'Frieren (Sub ITA)' }), 'sub');
    assert.strictEqual(isOngoingAnimeDetail({ totalEpisodes: '??', status: 'In corso' }), true);

    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'anilist-only-slug',
        title: 'AniList Only Anime',
        anilistId: 123456,
        malId: undefined,
      })
    );
    assert.strictEqual(getMalIdMapStore().byAnimeId['anilist-only-slug'], undefined, 'anilistId non deve mai popolare la mappa MAL');
    assert.strictEqual(getMalIdMapStore().byMalId[123456], undefined, 'anilistId non deve essere indicizzato per MAL ID');

    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'frieren-sub.111',
        title: 'Sousou no Frieren',
        malId: 52991,
        audio: 'Giapponese',
      })
    );
    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'frieren-ita.222',
        title: 'Sousou no Frieren (ITA)',
        malId: 52991,
        audio: 'Italiano',
      })
    );

    const storeTemp = getMalIdMapStore();
    delete storeTemp.byMalId[52991];
    AppStorage.setObject(StorageKeys.MAL_ID_MAP, storeTemp);

    AppStorage.toggleFavorite({
      id: 'frieren-ita.222',
      title: 'Sousou no Frieren (ITA)',
      image: 'img',
      thumbnail: 'img',
      genres: [],
      link: '/play/frieren-ita.222',
    });
    const localPriorityRes = await resolveMalToAnimeWorld(
      makeFakeMalEntry({ malId: 52991, title: 'Sousou no Frieren' })
    );
    assert.strictEqual(localPriorityRes.status, 'resolved');
    if (localPriorityRes.status === 'resolved') {
      assert.strictEqual(localPriorityRes.animeId, 'frieren-ita.222');
      assert.strictEqual(localPriorityRes.source, 'local_history');
    }

    resetMalTestEnvironment();
    let searchCount = 0;
    setMalScraperAdapterForTest({
      searchAnime: async (q: string) => {
        searchCount++;
        if (q.toLowerCase().includes('frieren')) {
          return {
            items: [
              { id: 'frieren-sub.1', title: 'Sousou no Frieren', image: '', thumbnail: '', audio: 'Giapponese', genres: [], link: '/play/frieren-sub.1' },
              { id: 'frieren-ita.2', title: 'Sousou no Frieren (ITA)', image: '', thumbnail: '', audio: 'Italiano', genres: [], link: '/play/frieren-ita.2' },
              { id: 'fake-anilist-match.3', title: 'Sousou no Frieren Special', image: '', thumbnail: '', genres: [], link: '/play/fake-anilist-match.3' },
            ],
          };
        }
        return { items: [] };
      },
      getAnimeDetail: async (id: string) => {
        if (id === 'frieren-sub.1') {
          return makeFakeDetail({ id, title: 'Sousou no Frieren', malId: 52991, totalEpisodes: 28 });
        }
        if (id === 'frieren-ita.2') {
          return makeFakeDetail({ id, title: 'Sousou no Frieren (ITA)', malId: 52991, totalEpisodes: 28, audio: 'Italiano' });
        }
        if (id === 'batch-mapped.1') {
          return makeFakeDetail({ id, title: 'Batch Mapped Show', malId: 44444, totalEpisodes: 12 });
        }
        if (id === 'batch-missing.2') {
          return makeFakeDetail({ id, title: 'Batch Missing Show', anilistId: 777777, malId: undefined });
        }
        return makeFakeDetail({ id, title: 'Sousou no Frieren Special', anilistId: 52991, malId: undefined });
      },
    });

    const batchRes = await resolveMissingAnimeMalMappings(['batch-mapped.1', 'batch-missing.2']);
    assert.strictEqual(batchRes.resolved, 1);
    assert.deepStrictEqual(batchRes.unmappedIds, ['batch-missing.2']);
    assert.strictEqual(getMalIdMapStore().byAnimeId['batch-mapped.1']?.malId, 44444);

    saveMalSettings({ audioPreference: 'ask' });
    const askRes = await resolveMalToAnimeWorld(makeFakeMalEntry({ malId: 52991, title: 'Sousou no Frieren' }));
    assert.strictEqual(askRes.status, 'needs_picker');
    if (askRes.status === 'needs_picker') {
      assert.strictEqual(askRes.reason, 'multiple_variants');
      assert.strictEqual(askRes.candidates.length, 2);
      assert(askRes.candidates.every((c) => c.malId === 52991 && c.exactMalMatch === true));
    }

    saveMalSettings({ audioPreference: 'ita' });
    const itaRes = await resolveMalToAnimeWorld(makeFakeMalEntry({ malId: 52991, title: 'Sousou no Frieren' }));
    assert.strictEqual(itaRes.status, 'resolved');
    if (itaRes.status === 'resolved') {
      assert.strictEqual(itaRes.animeId, 'frieren-ita.2');
      assert.strictEqual(itaRes.source, 'audio_preference');
    }
    assert(searchCount >= 1);

    // setManualAnimeMalMapping without totalEpisodes/status MUST preserve existing isOngoingSeries/totalEpisodes
    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'ongoing-preserve.1',
        title: 'Ongoing Show',
        malId: 77771,
        totalEpisodes: 24,
        status: 'In corso',
      })
    );
    setManualAnimeMalMapping({
      malId: 77771,
      animeId: 'ongoing-preserve.1',
      title: 'Ongoing Show',
      audio: 'sub',
    });
    const preservedMap = getMappingByAnimeId('ongoing-preserve.1');
    assert.strictEqual(preservedMap?.isOngoingSeries, true, 'setManualAnimeMalMapping deve preservare isOngoingSeries');
    assert.strictEqual(preservedMap?.totalEpisodes, 24, 'setManualAnimeMalMapping deve preservare totalEpisodes');

    // Local favorites priority even when byAnimeId was NOT pre-cached before tap
    resetMalTestEnvironment();
    AppStorage.toggleFavorite({
      id: 'kuro-fav-ita.9',
      title: 'Kuro Imported Fav (ITA)',
      image: 'img',
      thumbnail: 'img',
      genres: [],
      link: '/play/kuro-fav-ita.9',
    });
    saveMalSettings({ audioPreference: 'ask' });
    setMalScraperAdapterForTest({
      searchAnime: async () => ({
        items: [
          { id: 'kuro-fav-sub.8', title: 'Kuro Imported Fav', image: '', thumbnail: '', audio: 'Giapponese', genres: [], link: '/play/kuro-fav-sub.8' },
          { id: 'kuro-fav-ita.9', title: 'Kuro Imported Fav (ITA)', image: '', thumbnail: '', audio: 'Italiano', genres: [], link: '/play/kuro-fav-ita.9' },
        ],
      }),
      getAnimeDetail: async (id: string) =>
        makeFakeDetail({ id, title: id, malId: 66661, audio: id.includes('ita') ? 'Italiano' : 'Giapponese' }),
    });
    const uncachedLocalFavRes = await resolveMalToAnimeWorld(
      makeFakeMalEntry({ malId: 66661, title: 'Kuro Imported Fav' })
    );
    assert.strictEqual(uncachedLocalFavRes.status, 'resolved');
    if (uncachedLocalFavRes.status === 'resolved') {
      assert.strictEqual(uncachedLocalFavRes.animeId, 'kuro-fav-ita.9');
      assert.strictEqual(uncachedLocalFavRes.source, 'local_history');
    }

    // -------------------------------------------------------------------------
    // 7. Anti-Off-by-One, 60-Day Prune Protection, Diff Engine & Edge Cases
    // -------------------------------------------------------------------------
    resetMalTestEnvironment();

    // Case A: Watched Ep 1..3 + nextEpisode Ep 4 at 0:00 -> ContinueWatching isCaughtUp=false -> MUST yield 3
    for (const ep of [1, 2]) {
      AppStorage.saveWatchProgress({
        animeId: 'dandadan.1',
        episodeId: `dandadan-ep-${ep}`,
        episodeNumber: ep,
        animeTitle: 'Dandadan',
        currentTime: 1400,
        duration: 1440,
        totalEpisodes: 12,
      });
    }
    AppStorage.saveWatchProgress({
      animeId: 'dandadan.1',
      episodeId: 'dandadan-ep-3',
      episodeNumber: 3,
      animeTitle: 'Dandadan',
      currentTime: 1400,
      duration: 1440,
      totalEpisodes: 12,
      nextEpisode: { id: 'dandadan-ep-4', number: 4 },
    });

    // Ep 0, Ep 3.5, and incomplete Ep 5 (42%) MUST be excluded
    AppStorage.saveWatchProgress({
      animeId: 'dandadan.1',
      episodeId: 'dandadan-ep-0',
      episodeNumber: 0,
      currentTime: 500,
      duration: 500,
    });
    AppStorage.saveWatchProgress({
      animeId: 'dandadan.1',
      episodeId: 'dandadan-ep-3.5',
      episodeNumber: 3.5,
      currentTime: 500,
      duration: 500,
    });
    AppStorage.saveWatchProgress({
      animeId: 'dandadan.1',
      episodeId: 'dandadan-ep-5',
      episodeNumber: 5,
      currentTime: 600,
      duration: 1440,
    });

    assert.strictEqual(
      getLocalCompletedEpisodesForAnime('dandadan.1'),
      3,
      'ContinueWatching a Ep 4 non deve contare Ep 4 come visto'
    );

    // Case B: isCaughtUp === true at Ep 12 (no nextEpisode, ongoing) -> MUST yield 12
    AppStorage.saveWatchProgress({
      animeId: 'bocchi.1',
      episodeId: 'bocchi-ep-12',
      episodeNumber: 12,
      animeTitle: 'Bocchi the Rock!',
      currentTime: 1420,
      duration: 1440,
      totalEpisodes: 12,
      isOngoing: true,
    });
    assert.strictEqual(
      AppStorage.getContinueWatching().find((c) => c.animeId === 'bocchi.1')?.isCaughtUp,
      true
    );
    assert.strictEqual(
      getLocalCompletedEpisodesForAnime('bocchi.1'),
      12,
      'isCaughtUp=true deve contare Ep 12 completato'
    );

    // Case C: 60-day pruneOldProgress MUST preserve completed highwater in MAL_WATCHED_HIGHWATER
    const seventyDaysAgo = Date.now() - 70 * 24 * 60 * 60 * 1000;
    AppStorage.saveWatchProgress({
      animeId: 'old-classic.1',
      episodeId: 'old-ep-10',
      episodeNumber: 10,
      animeTitle: 'Old Classic',
      currentTime: 1400,
      duration: 1420,
      totalEpisodes: 24,
    });
    // Backdate progress key and simulate removal from continueWatching / watchHistory
    const oldProgKey = `${StorageKeys.WATCH_PROGRESS_PREFIX}old-classic.1.10`;
    const oldProgObj = AppStorage.getObject<any>(oldProgKey);
    AppStorage.setObject(oldProgKey, { ...oldProgObj, updatedAt: seventyDaysAgo });
    AppStorage.setObject(
      StorageKeys.CONTINUE_WATCHING,
      AppStorage.getContinueWatching().filter((c) => c.animeId !== 'old-classic.1')
    );
    AppStorage.setObject(
      StorageKeys.WATCH_HISTORY,
      AppStorage.getWatchHistory().filter((h) => h.animeId !== 'old-classic.1')
    );

    AppStorage.pruneOldProgress();
    assert.strictEqual(
      AppStorage.getWatchProgress('old-classic.1', 10),
      undefined,
      'pruneOldProgress deve eliminare chiave progress oltre 60 giorni'
    );
    assert.strictEqual(
      getLocalCompletedEpisodesForAnime('old-classic.1'),
      10,
      'MAL_WATCHED_HIGHWATER deve preservare gli episodi completati oltre i 60 giorni'
    );

    // Case D: Diff proposals (PTW promote, Completed promotion, Ongoing protection, SUB+ITA consolidation, Non-regression, Ignore list)
    recordAnimeMalMapping(makeFakeDetail({ id: 'dandadan.1', title: 'Dandadan', malId: 57334, totalEpisodes: 12 }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'bocchi.1', title: 'Bocchi the Rock!', malId: 47917, totalEpisodes: 12 }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'one-piece-sub.1', title: 'One Piece', malId: 21, totalEpisodes: '??', status: 'In corso' }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'frieren-sub.1', title: 'Sousou no Frieren', malId: 52991, totalEpisodes: 28 }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'frieren-ita.2', title: 'Sousou no Frieren (ITA)', malId: 52991, totalEpisodes: 28, audio: 'Italiano' }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'ahead-show.1', title: 'Already Ahead', malId: 8888, totalEpisodes: 24 }));
    recordAnimeMalMapping(makeFakeDetail({ id: 'completed-show.1', title: 'Already Completed', malId: 9999, totalEpisodes: 12 }));

    AppStorage.saveWatchProgress({
      animeId: 'frieren-sub.1',
      episodeId: 'fr-sub-10',
      episodeNumber: 10,
      currentTime: 1400,
      duration: 1420,
    });
    AppStorage.saveWatchProgress({
      animeId: 'frieren-ita.2',
      episodeId: 'fr-ita-14',
      episodeNumber: 14,
      currentTime: 1400,
      duration: 1420,
    });

    AppStorage.saveWatchProgress({
      animeId: 'one-piece-sub.1',
      episodeId: 'op-24',
      episodeNumber: 24,
      currentTime: 1400,
      duration: 1420,
      isOngoing: true,
    });

    AppStorage.saveWatchProgress({
      animeId: 'ahead-show.1',
      episodeId: 'ahead-5',
      episodeNumber: 5,
      currentTime: 1400,
      duration: 1420,
    });

    AppStorage.saveWatchProgress({
      animeId: 'completed-show.1',
      episodeId: 'comp-12',
      episodeNumber: 12,
      currentTime: 1400,
      duration: 1420,
    });

    AppStorage.saveWatchProgress({
      animeId: 'unmapped-show.1',
      episodeId: 'unm-2',
      episodeNumber: 2,
      animeTitle: 'Unmapped Show',
      currentTime: 1300,
      duration: 1400,
    });
    AppStorage.saveWatchProgress({
      animeId: 'ignored-show.1',
      episodeId: 'ign-2',
      episodeNumber: 2,
      animeTitle: 'Ignored Show',
      currentTime: 1300,
      duration: 1400,
    });
    addMalIgnoredAnimeIds(['ignored-show.1']);
    assert(getMalIgnoredAnimeIds().includes('ignored-show.1'));

    const diffInput = {
      watching: [
        makeFakeMalEntry({ malId: 47917, title: 'Bocchi the Rock!', status: 'watching', watchedEpisodes: 10, numEpisodes: 12, mediaStatus: 'finished_airing' }),
        makeFakeMalEntry({ malId: 21, title: 'One Piece', status: 'watching', watchedEpisodes: 20, numEpisodes: 24, mediaStatus: 'currently_airing' }),
        makeFakeMalEntry({ malId: 52991, title: 'Sousou no Frieren', status: 'watching', watchedEpisodes: 9, numEpisodes: 28 }),
        makeFakeMalEntry({ malId: 8888, title: 'Already Ahead', status: 'watching', watchedEpisodes: 10, numEpisodes: 24 }),
      ],
      plan_to_watch: [
        makeFakeMalEntry({ malId: 57334, title: 'Dandadan', status: 'plan_to_watch', watchedEpisodes: 0, numEpisodes: 12 }),
      ],
      completed: [
        makeFakeMalEntry({ malId: 9999, title: 'Already Completed', status: 'completed', watchedEpisodes: 12, numEpisodes: 12 }),
      ],
      updatedAt: Date.now(),
    };
    saveMalListCache(diffInput);

    const diff = computeLocalAppToMalDiffSnapshot(diffInput);

    const pDandadan = diff.proposals.find((p) => p.malId === 57334);
    assert(pDandadan, 'Dandadan PTW deve essere proposto');
    assert.strictEqual(pDandadan!.reason, 'promote_ptw');
    assert.strictEqual(pDandadan!.targetStatus, 'watching');
    assert.strictEqual(pDandadan!.targetEpisodes, 3);

    const pBocchi = diff.proposals.find((p) => p.malId === 47917);
    assert(pBocchi, 'Bocchi 12/12 deve essere proposto a completed');
    assert.strictEqual(pBocchi!.reason, 'complete_series');
    assert.strictEqual(pBocchi!.targetStatus, 'completed');
    assert.strictEqual(pBocchi!.targetEpisodes, 12);

    const pOnePiece = diff.proposals.find((p) => p.malId === 21);
    assert(pOnePiece, 'One Piece deve avanzare a 24');
    assert.strictEqual(pOnePiece!.targetStatus, 'watching', 'currently_airing non deve mai diventare completed');
    assert.strictEqual(pOnePiece!.targetEpisodes, 24);

    const pFrieren = diff.proposals.find((p) => p.malId === 52991);
    assert(pFrieren, 'SUB+ITA devono consolidarsi in un unica proposta');
    assert.strictEqual(pFrieren!.targetEpisodes, 14);
    assert.strictEqual(pFrieren!.animeIds.length, 2);

    assert.strictEqual(diff.proposals.find((p) => p.malId === 8888), undefined, 'E_mal >= E_app non deve regredire');
    assert.strictEqual(diff.proposals.find((p) => p.malId === 9999), undefined, 'completed su MAL non deve mai essere sovrascritto');
    assert.strictEqual(diff.unmapped.some((u) => u.animeId === 'unmapped-show.1'), true);
    assert.strictEqual(diff.unmapped.some((u) => u.animeId === 'ignored-show.1'), false, 'Anime ignorato escluso da unmapped');
    clearMalIgnoredAnimeIds();

    // -------------------------------------------------------------------------
    // 8. Opt-in Player Auto-Sync (OFF default) + Offline Queue + Flush
    // -------------------------------------------------------------------------
    assert.strictEqual(getMalSettings().autoSyncOnComplete, false, 'Auto-sync player deve essere OFF per default');

    AppStorage.setObject(StorageKeys.MAL_AUTH_SESSION, {
      accessToken: 'sync_token',
      refreshToken: 'sync_refresh',
      expiresAt: Date.now() + 3600_000,
      tokenType: 'Bearer',
    });

    let autoSyncPatchCount = 0;
    let shouldFailOffline = false;
    MalClient.setAxiosInstanceForTest({
      request: async (cfg: any) => {
        if (shouldFailOffline) {
          const e: any = new Error('Offline timeout');
          e.code = 'ETIMEDOUT';
          throw e;
        }
        autoSyncPatchCount++;
        const form = new URLSearchParams(cfg.data);
        return {
          data: {
            status: form.get('status') || 'watching',
            num_episodes_watched: Number(form.get('num_watched_episodes') || 0),
            score: 0,
            updated_at: new Date().toISOString(),
          },
        };
      },
    } as any);

    const disabledRes = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'dandadan.1',
      malId: 57334,
      episodeNumber: 4,
      totalEpisodes: 12,
    });
    assert.strictEqual(disabledRes.status, 'disabled');
    assert.strictEqual(autoSyncPatchCount, 0);

    saveMalSettings({ autoSyncOnComplete: true });
    const syncedRes = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'dandadan.1',
      malId: 57334,
      episodeNumber: 4,
      title: 'Dandadan',
      totalEpisodes: 12,
    });
    assert.strictEqual(syncedRes.status, 'synced');
    assert.strictEqual(syncedRes.targetStatus, 'watching');
    assert.strictEqual(syncedRes.targetEpisodes, 4);
    assert.strictEqual(autoSyncPatchCount, 1);

    const dedupedRes = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'dandadan.1',
      malId: 57334,
      episodeNumber: 4,
      totalEpisodes: 12,
    });
    assert.strictEqual(dedupedRes.status, 'deduped');
    assert.strictEqual(autoSyncPatchCount, 1);

    shouldFailOffline = true;
    const queuedRes = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'dandadan.1',
      malId: 57334,
      episodeNumber: 5,
      title: 'Dandadan',
      totalEpisodes: 12,
    });
    assert.strictEqual(queuedRes.status, 'queued');
    assert.strictEqual(MalAuthService.isConnected(), true, 'Errore offline in auto-sync non deve disconnettere');
    assert.strictEqual(MalSyncService.getPendingUpdatesCount(), 1);
    assert.strictEqual(MalSyncService.getPendingUpdates()[0].watchedEpisodes, 5);

    shouldFailOffline = false;
    const flushRes = await MalSyncService.flushPendingUpdates();
    assert.strictEqual(flushRes.flushed, 1);
    assert.strictEqual(flushRes.remaining, 0);
    assert.strictEqual(MalSyncService.getPendingUpdatesCount(), 0);
    assert.strictEqual(autoSyncPatchCount, 2);

    // Also test applyAppToMalProposals respecting selected/deselected proposals
    const applyRes = await MalSyncService.applyAppToMalProposals([
      { ...pDandadan!, selected: true },
      { ...pBocchi!, selected: false },
    ]);
    assert.strictEqual(applyRes.total, 1);
    assert.strictEqual(applyRes.succeeded, 1);
    assert.strictEqual(applyRes.failed, 0);

    // Edge cases: offline auto-sync must respect byAnimeId.isOngoingSeries & PTW non-regression & flush non-regression
    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'airing-offline.1',
        title: 'Airing Offline',
        malId: 71234,
        totalEpisodes: 12,
        status: 'In corso',
      })
    );
    const offlineOngoingRes = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'airing-offline.1',
      malId: 71234,
      episodeNumber: 12,
      title: 'Airing Offline',
      totalEpisodes: 12,
      isOngoingSeries: false,
    });
    assert.strictEqual(offlineOngoingRes.status, 'synced');
    assert.strictEqual(
      offlineOngoingRes.targetStatus,
      'watching',
      'Mapping byAnimeId.isOngoingSeries=true deve evitare completamento prematuro offline'
    );

    saveMalListCache({
      watching: [makeFakeMalEntry({ malId: 72001, title: 'Ahead Watching', status: 'watching', watchedEpisodes: 10, numEpisodes: 24 })],
      plan_to_watch: [makeFakeMalEntry({ malId: 71235, title: 'PTW With Eps', status: 'plan_to_watch', watchedEpisodes: 5, numEpisodes: 12 })],
      completed: [],
      updatedAt: Date.now(),
    });
    const ptwNonRegress = await MalSyncService.maybeAutoSyncOnEpisodeComplete({
      animeId: 'ptw-eps.1',
      malId: 71235,
      episodeNumber: 2,
      title: 'PTW With Eps',
      totalEpisodes: 12,
    });
    assert.strictEqual(ptwNonRegress.status, 'synced');
    assert.strictEqual(ptwNonRegress.targetStatus, 'watching');
    assert.strictEqual(ptwNonRegress.targetEpisodes, 5, 'PTW con 5 ep già su MAL non deve regredire a 2');

    // Queued older update for malId=72001 (watched=6) when cache is already watching=10 must skip PATCH
    AppStorage.setObject(StorageKeys.MAL_PENDING_UPDATES, [
      {
        malId: 72001,
        animeId: 'ahead-watch.1',
        title: 'Ahead Watching',
        status: 'watching',
        watchedEpisodes: 6,
        updatedAt: Date.now(),
      },
    ]);
    const prevPatchCount = autoSyncPatchCount;
    const flushAheadRes = await MalSyncService.flushPendingUpdates();
    assert.strictEqual(flushAheadRes.flushed, 1);
    assert.strictEqual(flushAheadRes.remaining, 0);
    assert.strictEqual(autoSyncPatchCount, prevPatchCount, 'Flush coda offline non deve inviare PATCH regressivo');

    // Old '??' progress key overridden when fresh AnimeDetail mapping marks series finished
    AppStorage.saveWatchProgress({
      animeId: 'finished-now.1',
      episodeId: 'fn-ep-12',
      episodeNumber: 12,
      currentTime: 1400,
      duration: 1420,
      totalEpisodes: '??',
      isOngoing: true,
    });
    recordAnimeMalMapping(
      makeFakeDetail({
        id: 'finished-now.1',
        title: 'Finished Now',
        malId: 73001,
        totalEpisodes: 12,
        status: 'Finito',
      })
    );
    const finishedDiff = computeLocalAppToMalDiffSnapshot({
      watching: [],
      plan_to_watch: [],
      completed: [],
      updatedAt: Date.now(),
    });
    const fnProp = finishedDiff.proposals.find((p) => p.malId === 73001);
    assert.strictEqual(fnProp?.targetStatus, 'completed', 'Mapping fresco non-ongoing deve prevalere su vecchio totalEpisodes="??"');

    // -------------------------------------------------------------------------
    // 9. Isolamento Assoluto da KuroSync & Protezione da AppStorage.clearCache()
    // -------------------------------------------------------------------------
    AppStorage.remove(StorageKeys.SYNC_PENDING_MUTATIONS);
    AppStorage.remove(StorageKeys.SYNC_PENDING_DELETIONS);

    // Pure MAL mutations must generate ZERO KuroSync mutations or tombstones
    setStoredMalClientId(TEST_CLIENT_ID);
    AppStorage.setObject(StorageKeys.MAL_SETTINGS, { autoSyncOnComplete: true, audioPreference: 'ita' });
    recordAnimeMalMapping(makeFakeDetail({ id: 'iso-test.1', title: 'Isolation Test', malId: 65432 }));
    addMalIgnoredAnimeIds(['iso-ign.1']);
    AppStorage.recordMalWatchedHighwater('iso-test.1', 7);
    await MalClient.updateAnimeListStatus(65432, { status: 'watching', numWatchedEpisodes: 7 });

    assert.strictEqual(
      Object.keys(AppStorage.getPendingSyncMutations()).length,
      0,
      'Nessuna operazione MAL deve generare mutazioni pendenti su KuroSync'
    );
    assert.strictEqual(
      AppStorage.getPendingSyncDeletions().length,
      0,
      'Nessuna operazione MAL deve generare tombstones su KuroSync'
    );

    AppStorage.clearCache();
    assert.strictEqual(MalAuthService.isConnected(), true, 'clearCache non deve toccare sessione MAL');
    assert.strictEqual(getEffectiveMalClientId(), TEST_CLIENT_ID, 'clearCache non deve toccare Client ID MAL');
    assert.strictEqual(getMalSettings().audioPreference, 'ita', 'clearCache non deve toccare preferenze MAL');
    assert(
      AppStorage.getMalWatchedHighwaterForAnime('old-classic.1') >= 10,
      'clearCache non deve cancellare MAL_WATCHED_HIGHWATER'
    );
    clearMalListCache();
    assert.strictEqual(getMalListCache(), null);

    // -------------------------------------------------------------------------
    // 10. Verifiche Statiche Architetturali (AGENTS.md & MAL.md & Zero Leak)
    // -------------------------------------------------------------------------
    const projectRoot = process.cwd();
    const malRuntimeFiles = [
      'src/services/mal/types.ts',
      'src/services/mal/config.ts',
      'src/services/mal/id-map-store.ts',
      'src/services/mal/auth.ts',
      'src/services/mal/client.ts',
      'src/services/mal/mapper.ts',
      'src/services/mal/sync.ts',
      'src/services/mal/index.ts',
      'src/components/mal/mal.styles.ts',
      'src/components/mal/MalConnectCard.tsx',
      'src/components/mal/MalAnimeCard.tsx',
      'src/components/mal/MalSyncDiffModal.tsx',
      'src/components/mal/MalMatchPickerModal.tsx',
      'src/components/mal/MalEntrySheet.tsx',
      'src/components/mal/MalSettingsModal.tsx',
      'src/components/mal/MalStatusPill.tsx',
      'src/components/mal/MalSyncSummaryCard.tsx',
      'src/components/mal/index.ts',
      'app/mal/index.tsx',
    ];

    const appJsonSrc = fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf-8');
    assert(appJsonSrc.includes('expo-web-browser'), 'app.json deve includere il plugin expo-web-browser');
    assert(appJsonSrc.includes('./plugins/withMalCustomTabs.js'), 'app.json deve registrare ./plugins/withMalCustomTabs.js per Expo prebuild');

    const customTabsPluginSrc = fs.readFileSync(path.join(projectRoot, 'plugins/withMalCustomTabs.js'), 'utf-8');
    assert(customTabsPluginSrc.includes('android.support.customtabs.action.CustomTabsService'), 'withMalCustomTabs deve iniettare CustomTabsService');

    const require = createRequire(import.meta.url);
    const { ensureCustomTabsQuery } = require('../plugins/withMalCustomTabs.js');
    const mockManifest: any = { manifest: { queries: [{ intent: [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }] }] }] } };
    ensureCustomTabsQuery(mockManifest);
    ensureCustomTabsQuery(mockManifest);
    assert.strictEqual(mockManifest.manifest.queries[0].intent.length, 2, 'ensureCustomTabsQuery deve essere idempotente');
    assert.strictEqual(
      mockManifest.manifest.queries[0].intent[1].action[0].$['android:name'],
      'android.support.customtabs.action.CustomTabsService'
    );

    const manifestSrc = fs.readFileSync(
      path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml'),
      'utf-8'
    );
    assert(
      manifestSrc.includes('android.support.customtabs.action.CustomTabsService'),
      'AndroidManifest.xml deve dichiarare CustomTabsService dentro <queries>'
    );

    const configSrc = fs.readFileSync(path.join(projectRoot, 'src/services/mal/config.ts'), 'utf-8');
    assert(
      !/['"][0-9a-f]{32}['"]/i.test(configSrc),
      'config.ts non deve contenere nessun Client ID 32-hex hardcoded'
    );

    for (const rel of malRuntimeFiles) {
      const content = fs.readFileSync(path.join(projectRoot, rel), 'utf-8');
      assert(!content.includes('Alert.alert'), `${rel} non deve usare Alert.alert`);
      assert(!content.includes('@expo/ui'), `${rel} non deve importare @expo/ui`);
      assert(!/from\s+['"]node:/.test(content), `${rel} non deve importare moduli node:*`);
      assert(!/docs\//.test(content), `${rel} non deve referenziare file docs/`);
    }

    const malScreenSrc = fs.readFileSync(path.join(projectRoot, 'app/mal/index.tsx'), 'utf-8');
    assert(malScreenSrc.includes('FlashList'), 'app/mal/index.tsx deve usare FlashList v2');
    assert(malScreenSrc.includes('useFocusEffect'), 'app/mal/index.tsx deve agganciare BackHandler con useFocusEffect');
    assert(malScreenSrc.includes('BackHandler'), 'app/mal/index.tsx deve gestire il tasto Indietro Android');
    assert(malScreenSrc.includes('MalSettingsModal'), 'app/mal/index.tsx deve integrare MalSettingsModal');
    assert(malScreenSrc.includes('MalEntrySheet'), 'app/mal/index.tsx deve integrare MalEntrySheet');
    assert(!/\bvalue=\{/.test(malScreenSrc), 'app/mal/index.tsx deve usare TextInput non controllato (defaultValue)');
    assert(malScreenSrc.includes('defaultValue='), 'app/mal/index.tsx deve usare defaultValue per ricerca IME-safe');

    const malSettingsModalSrc = fs.readFileSync(path.join(projectRoot, 'src/components/mal/MalSettingsModal.tsx'), 'utf-8');
    assert(malSettingsModalSrc.includes('ConfirmModal'), 'MalSettingsModal deve usare ConfirmModal per logout');
    const malEntrySheetSrc = fs.readFileSync(path.join(projectRoot, 'src/components/mal/MalEntrySheet.tsx'), 'utf-8');
    assert(malEntrySheetSrc.includes('ConfirmModal'), 'MalEntrySheet deve usare ConfirmModal per rimozione voce');
    assert(
      malEntrySheetSrc.includes('}, [isVisible, animeId, malId, totalEpisodesHint]);'),
      'MalEntrySheet useEffect non deve dipendere da initialEntry (previene loop infinito con MalStatusPill)'
    );
    assert(
      malEntrySheetSrc.includes('alternativeTitles: meta?.alternativeTitles'),
      'MalEntrySheet deve preservare alternativeTitles/metadati nella cache MAL'
    );

    const pickerSrc = fs.readFileSync(path.join(projectRoot, 'src/components/mal/MalMatchPickerModal.tsx'), 'utf-8');
    assert(pickerSrc.includes('ListEmptyComponent'), 'MalMatchPickerModal deve mostrare stato vuoto nella FlashList');

    assert(malScreenSrc.includes('syncCacheIntoQuery'), 'app/mal/index.tsx deve sincronizzare MAL_LIST_CACHE in TanStack Query');
    assert(malScreenSrc.includes('isNarrow'), 'app/mal/index.tsx deve adattare header e tab su smartphone stretti');

    for (const sheetFile of [
      'src/components/mal/MalSyncDiffModal.tsx',
      'src/components/mal/MalMatchPickerModal.tsx',
      'src/components/mal/MalEntrySheet.tsx',
      'src/components/mal/MalSettingsModal.tsx',
    ]) {
      const sSrc = fs.readFileSync(path.join(projectRoot, sheetFile), 'utf-8');
      assert(sSrc.includes('useBottomSheetDragDismiss'), `${sheetFile} deve usare useBottomSheetDragDismiss`);
      assert(sSrc.includes('dragStripHandlers'), `${sheetFile} deve esporre dragStripHandlers`);
      assert(sSrc.includes('headerPanHandlers'), `${sheetFile} deve esporre headerPanHandlers`);
      assert(sSrc.includes('animationType="fade"'), `${sheetFile} deve usare animationType="fade"`);
      assert(!sSrc.includes('animationType="slide"'), `${sheetFile} non deve combinare slide con drag dismiss`);
      const textInputTags = sSrc.match(/<TextInput[\s\S]*?\/>/g) || [];
      for (const tiTag of textInputTags) {
        assert(!/\bvalue=\{/.test(tiTag), `${sheetFile} deve usare TextInput non controllato (defaultValue)`);
      }
    }

    assert(
      malSettingsModalSrc.includes('StepSlider') &&
        malSettingsModalSrc.includes('completed_only') &&
        malSettingsModalSrc.includes('watchingThresholdEnabled'),
      'MalSettingsModal deve usare StepSlider per modalità auto-sync e controlli threshold'
    );

    const connectCardSrc = fs.readFileSync(path.join(projectRoot, 'src/components/mal/MalConnectCard.tsx'), 'utf-8');
    assert(!/\bvalue=\{/.test(connectCardSrc), 'MalConnectCard deve usare TextInput non controllato (defaultValue)');
    assert(connectCardSrc.includes('defaultValue='), 'MalConnectCard deve usare defaultValue');

    const favSrc = fs.readFileSync(path.join(projectRoot, 'app/(tabs)/favorites.tsx'), 'utf-8');
    assert(favSrc.includes('rightActions='), 'FavoritesScreen deve passare rightActions a SelectionAppBar');
    assert(favSrc.includes("router.push('/mal'"), 'Pulsante MAL in Preferiti deve navigare a /mal');

    const selBarSrc = fs.readFileSync(path.join(projectRoot, 'src/components/SelectionAppBar.tsx'), 'utf-8');
    assert(selBarSrc.includes('rightActions'), 'SelectionAppBar deve supportare rightActions');

    const detailSrc = fs.readFileSync(path.join(projectRoot, 'app/anime/[id].tsx'), 'utf-8');
    assert(detailSrc.includes('MalStatusPill'), 'AnimeDetailScreen deve integrare MalStatusPill');
    const malPillSrc = fs.readFileSync(path.join(projectRoot, 'src/components/mal/MalStatusPill.tsx'), 'utf-8');
    assert(malPillSrc.includes('MalEntrySheet'), 'MalStatusPill deve integrare MalEntrySheet');

    const settingsTabSrc = fs.readFileSync(path.join(projectRoot, 'app/(tabs)/settings.tsx'), 'utf-8');
    assert(settingsTabSrc.includes('/mal'), 'SettingsScreen deve contenere la voce secondaria MYANIMELIST');
    const syncSettingsSrc = fs.readFileSync(path.join(projectRoot, 'app/settings/sync.tsx'), 'utf-8');
    assert(syncSettingsSrc.includes('MalSyncSummaryCard'), 'app/settings/sync.tsx deve integrare MalSyncSummaryCard');

    const playerSrc = fs.readFileSync(path.join(projectRoot, 'app/player/[id].tsx'), 'utf-8');
    assert(playerSrc.includes('pureMalIdRef'), 'VideoPlayer deve tracciare malId puro separato da anilistId');
    assert(playerSrc.includes('maybeAutoSyncOnEpisodeComplete'), 'VideoPlayer deve chiamare maybeAutoSyncOnEpisodeComplete al completamento episodio');

    const rootLayoutSrc = fs.readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf-8');
    assert(rootLayoutSrc.includes('isMalAuthCallbackDeepLink'), '_layout.tsx deve gestire kurotv://mal-callback');
    assert(rootLayoutSrc.includes('flushPendingUpdates'), '_layout.tsx deve svuotare la coda offline MAL su foreground');

    const kuroSyncMgrSrc = fs.readFileSync(path.join(projectRoot, 'src/services/sync/sync-manager.ts'), 'utf-8');
    assert(
      !kuroSyncMgrSrc.includes('MAL_LIST_CACHE') &&
        !kuroSyncMgrSrc.includes('MAL_PENDING_UPDATES') &&
        !kuroSyncMgrSrc.includes('MAL_WATCHED_HIGHWATER') &&
        !kuroSyncMgrSrc.includes('MAL_SETTINGS') &&
        !kuroSyncMgrSrc.includes('MAL_ID_MAP'),
      'KuroSync sync-manager deve sincronizzare esclusivamente malAuth e mai liste/impostazioni/highwater MAL'
    );
    assert(
      kuroSyncMgrSrc.includes('getMalAuthSyncRecordForScope') &&
        kuroSyncMgrSrc.includes('applyRemoteMalAuthRecordForScope') &&
        kuroSyncMgrSrc.includes('clearSyncedMalProfileData'),
      'KuroSync sync-manager deve gestire malAuth per-profilo con capability detection'
    );

    // -------------------------------------------------------------------------
    // 11. Nuove Modalità Auto-Sync (completed_only & threshold) + Profili KuroSync
    // -------------------------------------------------------------------------
    resetMalTestEnvironment();

    // 11a. Legacy settings migration (autoSyncOnComplete: true -> autoSyncMode: 'episodes')
    AppStorage.setObject(StorageKeys.MAL_SETTINGS, {
      autoSyncOnComplete: true,
      audioPreference: 'sub',
    });
    const migratedSettings = getMalSettings();
    assert.strictEqual(migratedSettings.autoSyncMode, 'episodes', 'Migrazione legacy autoSyncOnComplete=true -> episodes');
    assert.strictEqual(migratedSettings.autoSyncOnComplete, true);
    assert.strictEqual(migratedSettings.watchingThresholdEnabled, false);
    assert.strictEqual(migratedSettings.watchingThresholdEpisodes, 3);

    // Setup authenticated mock MAL client for mode & threshold behavioral tests
    let modePatchCalls: Array<{ malId: number; status?: string; numWatched?: number }> = [];
    setStoredMalClientId(TEST_CLIENT_ID);
    AppStorage.setObject(StorageKeys.MAL_AUTH_SESSION, {
      accessToken: 'mode-access-tok',
      refreshToken: 'mode-refresh-tok',
      expiresAt: Date.now() + 3600_000,
      tokenType: 'Bearer',
      username: 'mode_user',
      updatedAt: Date.now(),
    });
    MalClient.setAxiosInstanceForTest({
      request: async (cfg: any) => {
        const malId = Number(String(cfg.url || '').match(/anime\/(\d+)/)?.[1] || 0);
        const form = new URLSearchParams(cfg.data);
        const status = form.get('status') || undefined;
        const numWatched = Number(form.get('num_watched_episodes') || 0);
        modePatchCalls.push({ malId, status, numWatched });
        return {
          data: {
            status,
            score: 0,
            num_episodes_watched: numWatched,
            updated_at: new Date().toISOString(),
          },
        };
      },
    } as any);

    // 11b. autoSyncMode === 'completed_only'
    saveMalSettings({ autoSyncMode: 'completed_only', watchingThresholdEnabled: false });
    saveMalListCache({ watching: [], plan_to_watch: [], completed: [], updatedAt: Date.now() });

    const coEp5 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'completed-only.1',
      malId: 80001,
      episodeNumber: 5,
      title: 'Completed Only Anime',
      totalEpisodes: 12,
      isOngoingSeries: false,
    });
    assert.strictEqual(coEp5.status, 'skipped_completed_only', 'completed_only deve saltare episodi intermedi');
    assert.strictEqual(modePatchCalls.length, 0);

    const coOngoing = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'completed-only-ongoing.1',
      malId: 80002,
      episodeNumber: 12,
      title: 'Ongoing Anime',
      totalEpisodes: 12,
      isOngoingSeries: true,
    });
    assert.strictEqual(coOngoing.status, 'skipped_completed_only', 'completed_only non deve segnare completed le serie ongoing');
    assert.strictEqual(modePatchCalls.length, 0);

    const coEp12 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'completed-only.1',
      malId: 80001,
      episodeNumber: 12,
      title: 'Completed Only Anime',
      totalEpisodes: 12,
      isOngoingSeries: false,
    });
    assert.strictEqual(coEp12.status, 'synced', 'completed_only deve sincronizzare al completamento serie');
    assert.strictEqual(coEp12.targetStatus, 'completed');
    assert.strictEqual(coEp12.targetEpisodes, 12);
    assert.strictEqual(modePatchCalls.length, 1);

    // 11c. autoSyncMode === 'episodes' with watchingThresholdEnabled = true (default 3)
    modePatchCalls = [];
    MalSyncService.clearSessionAutoSyncCacheForTest();
    saveMalSettings({
      autoSyncMode: 'episodes',
      watchingThresholdEnabled: true,
      watchingThresholdEpisodes: 3,
    });
    saveMalListCache({
      watching: [
        makeFakeMalEntry({ malId: 80020, title: 'Already Watching', status: 'watching', watchedEpisodes: 1, numEpisodes: 12 }),
      ],
      plan_to_watch: [
        makeFakeMalEntry({ malId: 80011, title: 'PTW Show', status: 'plan_to_watch', watchedEpisodes: 0, numEpisodes: 12 }),
      ],
      completed: [],
      updatedAt: Date.now(),
    });

    const thNewEp1 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'binge-test.1',
      malId: 80010,
      episodeNumber: 1,
      totalEpisodes: 12,
    });
    const thNewEp2 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'binge-test.1',
      malId: 80010,
      episodeNumber: 2,
      totalEpisodes: 12,
    });
    const thPtwEp2 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'ptw-threshold.1',
      malId: 80011,
      episodeNumber: 2,
      totalEpisodes: 12,
    });
    assert.strictEqual(thNewEp1.status, 'below_watching_threshold', 'Ep 1 non in lista deve rispettare threshold 3');
    assert.strictEqual(thNewEp2.status, 'below_watching_threshold', 'Ep 2 non in lista deve rispettare threshold 3');
    assert.strictEqual(thPtwEp2.status, 'below_watching_threshold', 'PTW Ep 2 deve rispettare threshold 3');
    assert.strictEqual(modePatchCalls.length, 0);

    // Ep 3 reaches threshold -> syncs as watching
    const thNewEp3 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'binge-test.1',
      malId: 80010,
      episodeNumber: 3,
      totalEpisodes: 12,
    });
    assert.strictEqual(thNewEp3.status, 'synced');
    assert.strictEqual(thNewEp3.targetStatus, 'watching');
    assert.strictEqual(thNewEp3.targetEpisodes, 3);

    // Already watching at ep 1 -> advancing to ep 2 MUST still sync despite threshold 3
    const thAlreadyWatchingEp2 = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'already-watching.1',
      malId: 80020,
      episodeNumber: 2,
      totalEpisodes: 12,
    });
    assert.strictEqual(thAlreadyWatchingEp2.status, 'synced', 'Serie già in watching deve aggiornarsi anche sotto threshold');
    assert.strictEqual(thAlreadyWatchingEp2.targetStatus, 'watching');
    assert.strictEqual(thAlreadyWatchingEp2.targetEpisodes, 2);

    // Short 1-ep movie / 2-ep OVA reaching completion MUST NOT be blocked by threshold 3
    const thShortMovie = await MalSyncService.enqueueOrAutoSyncEpisode({
      animeId: 'short-movie.1',
      malId: 80030,
      episodeNumber: 1,
      totalEpisodes: 1,
      isOngoingSeries: false,
    });
    assert.strictEqual(thShortMovie.status, 'synced', 'Film 1 episodio completato non deve essere bloccato dal threshold');
    assert.strictEqual(thShortMovie.targetStatus, 'completed');
    assert.strictEqual(thShortMovie.targetEpisodes, 1);

    // 11d. Per-KuroSync-Profile Isolation & Auth-Only Sync Preparation
    resetMalTestEnvironment();

    // Local (disconnected) MAL setup
    setStoredMalClientId(TEST_CLIENT_ID);
    AppStorage.setObject(StorageKeys.MAL_AUTH_SESSION, {
      accessToken: 'local-tok',
      refreshToken: 'local-ref',
      expiresAt: Date.now() + 3600_000,
      tokenType: 'Bearer',
      username: 'local_user',
      updatedAt: 1000,
    });
    AppStorage.recordMalWatchedHighwater('shared-anime.1', 4);
    assert.strictEqual(getActiveMalProfileScope(), 'local');
    assert.strictEqual(MalAuthService.getStatus().username, 'local_user');

    // Connect KuroSync on prof-1 ("Marco") -> scope switches cleanly without leaking 'local'
    AppStorage.setString(StorageKeys.SYNC_SERVER_URL, 'https://sync.example');
    AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, 'sync-dev-tok-1');
    AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, 'prof-1');
    AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, 'Marco');
    MalAuthService.handleSyncScopeChanged();

    assert.strictEqual(getActiveMalProfileScope(), 'prof-1');
    assert.strictEqual(MalAuthService.isConnected(), false, 'prof-1 non deve ereditare sessione MAL locale');
    assert.strictEqual(AppStorage.getMalWatchedHighwaterForAnime('shared-anime.1'), 0, 'Highwater deve essere isolato per profilo');

    // Shared catalog byAnimeId vs per-profile byMalId pick
    recordAnimeMalMapping(makeFakeDetail({ id: 'hero-sub.1', title: 'Hero Academia', malId: 90001 }));
    setManualAnimeMalMapping({ malId: 90001, animeId: 'hero-ita.1', title: 'Hero Academia (ITA)', audio: 'ITA' });
    assert.strictEqual(getMappingByMalId(90001)?.primaryAnimeId, 'hero-ita.1');

    // Link MAL on prof-1 via callback -> emits malAuth sync mutation (tokens + clientId ONLY)
    setStoredMalClientId(TEST_CLIENT_ID);
    MalAuthService.setHttpClientForTest({
      post: async () => ({
        data: { access_token: 'p1-acc', refresh_token: 'p1-ref', expires_in: 3600, token_type: 'Bearer' },
      }),
      get: async () => ({
        data: { id: 101, name: 'marco_mal', picture: 'https://cdn.example/marco.png' },
      }),
    } as any);
    (WebBrowser as any).setMockOpenAuthSessionHandler(async (authUrl: string) => {
      const stateParam = new URL(authUrl).searchParams.get('state');
      return { type: 'success', url: `kurotv://mal-callback?code=c1&state=${stateParam}` };
    });
    const loginP1 = await MalAuthService.startLogin(TEST_CLIENT_ID);
    assert.strictEqual(loginP1.ok, true);
    assert.strictEqual(MalAuthService.getStatus().profileScopeId, 'prof-1');
    assert.strictEqual(MalAuthService.getStatus().kuroSyncProfileName, 'Marco');

    const pendingMutP1 = AppStorage.getPendingSyncMutations();
    assert(pendingMutP1.malAuth, 'Login MAL su profilo KuroSync deve preparare pendingMutations.malAuth');
    assert.strictEqual(pendingMutP1.malAuth.username, 'marco_mal');
    assert.strictEqual(pendingMutP1.malAuth.clientId, TEST_CLIENT_ID);

    // Switch to prof-2 ("Giulia")
    AppStorage.clearPendingSyncMutations();
    AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, 'prof-2');
    AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, 'Giulia');
    MalAuthService.handleSyncScopeChanged();

    assert.strictEqual(getActiveMalProfileScope(), 'prof-2');
    assert.strictEqual(MalAuthService.isConnected(), false, 'prof-2 deve essere disconnesso indipendentemente da prof-1');
    assert.strictEqual(getMappingByMalId(90001)?.primaryAnimeId || '', '', 'Scelta ITA su prof-1 non deve sovrascrivere prof-2');
    assert.strictEqual(getMappingByAnimeId('hero-sub.1')?.malId, 90001, 'byAnimeId catalogo rimane condiviso');

    // Remote malAuth applied for prof-2 without triggering redundant push mutation
    const appliedP2 = applyRemoteMalAuthRecordForScope('prof-2', {
      profileId: 'prof-2',
      clientId: 'remoteclientid1234567890abcdef12',
      accessToken: 'p2-remote-acc',
      refreshToken: 'p2-remote-ref',
      expiresAt: Date.now() + 7200_000,
      tokenType: 'Bearer',
      username: 'giulia_mal',
      updatedAt: 5000,
    });
    assert.strictEqual(appliedP2, true);
    MalAuthService.handleSyncScopeChanged();
    assert.strictEqual(MalAuthService.isConnected(), true);
    assert.strictEqual(MalAuthService.getStatus().username, 'giulia_mal');
    assert.strictEqual(Object.keys(AppStorage.getPendingSyncMutations()).length, 0, 'applyRemoteMalAuth non deve ri-emettere mutazioni push');

    // Logout on prof-2 records 'mal_auth' deletion tombstone
    MalAuthService.logout();
    assert.strictEqual(MalAuthService.isConnected(), false);
    const delP2 = AppStorage.getPendingSyncDeletions();
    assert(delP2.some((d) => d.type === 'mal_auth' && d.key === 'default'), 'Logout su profilo KuroSync deve registrare tombstone mal_auth');

    // Switch back to prof-1 -> marco_mal still preserved!
    AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, 'prof-1');
    AppStorage.setString(StorageKeys.SYNC_PROFILE_NAME, 'Marco');
    MalAuthService.handleSyncScopeChanged();
    assert.strictEqual(MalAuthService.isConnected(), true);
    assert.strictEqual(MalAuthService.getStatus().username, 'marco_mal');

    // mergeLocalAndRemote LWW + 'mal_auth' tombstone dominance checks
    const baseLocalSync = {
      favorites: [],
      continueWatching: [],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [],
      malAuth: getMalAuthSyncRecordForScope('prof-1'),
    };
    const remoteNewerToken = mergeLocalAndRemote(
      baseLocalSync,
      {
        serverTime: 9000,
        deltas: {
          favorites: [],
          continueWatching: [],
          watchHistory: [],
          watchProgress: [],
          sharedSettings: {},
          searchHistory: [],
          malAuth: {
            clientId: TEST_CLIENT_ID,
            accessToken: 'refreshed-remote-acc',
            refreshToken: 'refreshed-remote-ref',
            expiresAt: 9999999999,
            tokenType: 'Bearer',
            username: 'marco_mal',
            updatedAt: (baseLocalSync.malAuth?.updatedAt || 0) + 5000,
          },
        },
        tombstones: [],
      }
    );
    assert.strictEqual(remoteNewerToken.state.malAuth?.accessToken, 'refreshed-remote-acc', 'Token remoto più recente deve vincere via LWW');

    const remoteLogoutTombstone = mergeLocalAndRemote(
      baseLocalSync,
      {
        serverTime: 9999,
        deltas: {
          favorites: [],
          continueWatching: [],
          watchHistory: [],
          watchProgress: [],
          sharedSettings: {},
          searchHistory: [],
          malAuth: null,
        },
        tombstones: [
          {
            type: 'mal_auth',
            key: 'default',
            deletedAt: (baseLocalSync.malAuth?.updatedAt || 0) + 10000,
          },
        ],
      }
    );
    assert.strictEqual(remoteLogoutTombstone.state.malAuth, null, 'Tombstone mal_auth più recente deve sloggare il profilo');

    // Disconnecting KuroSync purges synced profile tokens & reverts cleanly to 'local' scope
    clearSyncedMalProfileData('prof-1');
    AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
    AppStorage.remove(StorageKeys.SYNC_PROFILE_ID);
    AppStorage.remove(StorageKeys.SYNC_PROFILE_NAME);
    MalAuthService.handleSyncScopeChanged();
    assert.strictEqual(getActiveMalProfileScope(), 'local');
    assert.strictEqual(MalAuthService.getStatus().username, 'local_user', 'Scollando KuroSync si ritorna intatti allo scope locale');

    console.log('✓ Integrazione MyAnimeList (OAuth PKCE, Client, Mapper, Sync Diff, Auto-Sync Mode/Threshold, Profili KuroSync & UI) verificata con successo.');
  } finally {
    resetMalTestEnvironment();
  }
}

const isEntryScript =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryScript) {
  runMalVerificationTests()
    .then(() => {
      console.log('\n🎉 TUTTI I TEST MAL SONO PASSATI CON SUCCESSO! 🎉');
    })
    .catch((err) => {
      console.error('❌ Test MAL fallito:', err);
      process.exit(1);
    });
}
