import axios, { type AxiosInstance } from 'axios';
import * as WebBrowser from 'expo-web-browser';
import { AppStorage, StorageKeys } from '../storage/app-storage';
import {
  MAL_API_BASE_URL,
  MAL_OAUTH_AUTHORIZE_URL,
  MAL_OAUTH_TOKEN_URL,
  MAL_REDIRECT_URI,
  clearMalListCache,
  getActiveKuroSyncProfileInfo,
  getActiveMalProfileScope,
  getEffectiveMalClientId,
  getMalAuthSyncRecordForScope,
  getMalScopedKey,
  isValidMalClientId,
  normalizeMalClientId,
  notifyMalDataListeners,
  setStoredMalClientId,
} from './config';
import type { MalAuthSession, MalOAuthPending, MalUserProfile } from './types';

const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const STATE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export class MalAuthError extends Error {
  status?: number;
  code?: string;
  isRevoked: boolean;

  constructor(message: string, options?: { status?: number; code?: string; isRevoked?: boolean }) {
    super(message);
    this.name = 'MalAuthError';
    this.status = options?.status;
    this.code = options?.code;
    this.isRevoked = Boolean(options?.isRevoked);
  }
}

export interface MalAuthLoginResult {
  ok: boolean;
  cancelled?: boolean;
  alreadyHandled?: boolean;
  session?: MalAuthSession;
  error?: string;
}

export interface MalAuthStatus {
  isConnected: boolean;
  username?: string;
  userId?: number;
  picture?: string;
  clientId: string;
  hasClientId: boolean;
  profileScopeId: string;
  kuroSyncProfileName?: string;
  isKuroSyncLinked: boolean;
}

type MalAuthListener = (status: MalAuthStatus) => void;

function generateSecureRandomString(length: number, charset: string): string {
  const charsetLen = charset.length;
  const maxValidByte = 256 - (256 % charsetLen);
  let result = '';

  const cryptoObj =
    typeof globalThis !== 'undefined' && (globalThis as any).crypto
      ? (globalThis as any).crypto
      : null;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    while (result.length < length) {
      const buf = new Uint8Array(Math.max(16, length * 2));
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < buf.length && result.length < length; i++) {
        if (buf[i] < maxValidByte) {
          result += charset[buf[i] % charsetLen];
        }
      }
    }
    return result;
  }

  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * charsetLen);
    result += charset[idx];
  }
  return result;
}

export function generatePkceCodeVerifier(length = 64): string {
  const clamped = Math.max(43, Math.min(128, Math.floor(length)));
  return generateSecureRandomString(clamped, PKCE_CHARSET);
}

export function generateOAuthState(length = 32): string {
  const clamped = Math.max(16, Math.min(64, Math.floor(length)));
  return generateSecureRandomString(clamped, STATE_CHARSET);
}

export function buildMalAuthorizeUrl(params: {
  clientId: string;
  codeVerifier: string;
  state: string;
  redirectUri?: string;
}): string {
  const url = new URL(MAL_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('state', params.state);
  url.searchParams.set('redirect_uri', params.redirectUri || MAL_REDIRECT_URI);
  url.searchParams.set('code_challenge', params.codeVerifier);
  url.searchParams.set('code_challenge_method', 'plain');
  return url.toString();
}

export function parseMalCallbackUrl(rawUrl: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : trimmed.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/\/*/, 'https://dummy.local/');
    const parsed = new URL(normalized);
    const code = parsed.searchParams.get('code')?.trim() || undefined;
    const state = parsed.searchParams.get('state')?.trim() || undefined;
    const error = parsed.searchParams.get('error')?.trim() || undefined;
    const errorDescription = parsed.searchParams.get('error_description')?.trim() || undefined;

    if (!code && !state && !error) return null;
    return { code, state, error, errorDescription };
  } catch {
    const codeMatch = trimmed.match(/[?&]code=([^&#]+)/i);
    const stateMatch = trimmed.match(/[?&]state=([^&#]+)/i);
    const errorMatch = trimmed.match(/[?&]error=([^&#]+)/i);
    const decode = (v?: string) => {
      if (!v) return undefined;
      try {
        return decodeURIComponent(v.replace(/\+/g, ' '));
      } catch {
        return v;
      }
    };
    const code = decode(codeMatch?.[1]);
    const state = decode(stateMatch?.[1]);
    const error = decode(errorMatch?.[1]);
    if (!code && !state && !error) return null;
    return { code, state, error };
  }
}

export function shouldRevokeMalSessionOnRefreshError(
  status?: number,
  errorCode?: string | null
): boolean {
  if (status === 401 || status === 403) return true;
  if (status === 400 && errorCode) {
    const normalized = errorCode.toLowerCase().trim();
    return normalized === 'invalid_grant' || normalized === 'invalid_client';
  }
  return false;
}

function extractHttpErrorInfo(err: any): {
  status?: number;
  errorCode?: string;
  message: string;
} {
  const status = typeof err?.response?.status === 'number' ? err.response.status : err?.status;
  const data = err?.response?.data;
  const errorCode =
    typeof data?.error === 'string'
      ? data.error
      : typeof err?.code === 'string'
      ? err.code
      : undefined;
  const message =
    (typeof data?.message === 'string' && data.message) ||
    (typeof data?.error_description === 'string' && data.error_description) ||
    (typeof data?.error === 'string' && data.error) ||
    (typeof err?.message === 'string' && err.message) ||
    'Errore di rete MyAnimeList';
  return { status, errorCode, message };
}

class MalAuthServiceClass {
  private http: AxiosInstance = axios.create({ timeout: 15000 });
  private listeners = new Set<MalAuthListener>();
  private refreshInFlight: Promise<string> | null = null;
  private loginInFlight = false;
  private inFlightCallbackKey: string | null = null;
  private inFlightCallbackPromise: Promise<MalAuthLoginResult> | null = null;
  private handledCallbackResults = new Map<string, { result: MalAuthLoginResult; ts: number }>();
  private lastLoginCallbackResult: { state: string; result: MalAuthLoginResult } | null = null;

  setHttpClientForTest(client?: AxiosInstance | null): void {
    this.http = client || axios.create({ timeout: 15000 });
  }

  isLoginInFlight(): boolean {
    return this.loginInFlight;
  }

  getSession(scopeId?: string): MalAuthSession | null {
    const raw = AppStorage.getObject<Partial<MalAuthSession>>(
      getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, scopeId)
    );
    if (!raw || typeof raw.accessToken !== 'string' || !raw.accessToken.trim()) {
      return null;
    }
    return {
      accessToken: raw.accessToken,
      refreshToken: typeof raw.refreshToken === 'string' ? raw.refreshToken : '',
      expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : 0,
      tokenType: typeof raw.tokenType === 'string' ? raw.tokenType : 'Bearer',
      username: typeof raw.username === 'string' ? raw.username : undefined,
      userId: typeof raw.userId === 'number' ? raw.userId : undefined,
      picture: typeof raw.picture === 'string' ? raw.picture : undefined,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
    };
  }

  isConnected(): boolean {
    return Boolean(this.getSession()?.accessToken);
  }

  getStatus(): MalAuthStatus {
    const profileInfo = getActiveKuroSyncProfileInfo();
    const session = this.getSession(profileInfo.profileId);
    const clientId = getEffectiveMalClientId(profileInfo.profileId);
    return {
      isConnected: Boolean(session?.accessToken),
      username: session?.username,
      userId: session?.userId,
      picture: session?.picture,
      clientId,
      hasClientId: isValidMalClientId(clientId),
      profileScopeId: profileInfo.profileId,
      kuroSyncProfileName: profileInfo.profileName,
      isKuroSyncLinked: profileInfo.isConnected,
    };
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // Safe listener catch
      }
    }
    notifyMalDataListeners();
  }

  addAuthListener(listener: MalAuthListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getStatus());
    } catch {
      // Safe fallback
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private saveSession(session: MalAuthSession, scopeId?: string): void {
    const targetScope = (scopeId ?? getActiveMalProfileScope()).trim() || 'local';
    const nextSession: MalAuthSession = {
      ...session,
      updatedAt: typeof session.updatedAt === 'number' && session.updatedAt > 0 ? session.updatedAt : Date.now(),
    };
    AppStorage.setObject(getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, targetScope), nextSession);
    if (targetScope !== 'local' && targetScope === getActiveMalProfileScope()) {
      const syncRecord = getMalAuthSyncRecordForScope(targetScope);
      if (syncRecord) {
        AppStorage.recordSyncMutation('malAuth', syncRecord);
      }
    }
    this.notify();
  }

  private clearSessionInternal(
    clearLists = false,
    options?: { scopeId?: string; recordDeletion?: boolean }
  ): void {
    const targetScope = (options?.scopeId ?? getActiveMalProfileScope()).trim() || 'local';
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_AUTH_SESSION, targetScope));
    AppStorage.remove(getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, targetScope));
    if (clearLists) {
      clearMalListCache(targetScope);
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_PENDING_UPDATES, targetScope));
      AppStorage.remove(getMalScopedKey(StorageKeys.MAL_LAST_SYNC_TIME, targetScope));
    }
    if (options?.recordDeletion && targetScope !== 'local' && targetScope === getActiveMalProfileScope()) {
      AppStorage.recordSyncDeletion('mal_auth', 'default');
    }
    this.notify();
  }

  handleSyncScopeChanged(): void {
    this.refreshInFlight = null;
    this.loginInFlight = false;
    this.inFlightCallbackKey = null;
    this.inFlightCallbackPromise = null;
    this.handledCallbackResults.clear();
    this.lastLoginCallbackResult = null;
    this.notify();
  }

  async startLogin(overrideClientId?: string): Promise<MalAuthLoginResult> {
    const targetScope = getActiveMalProfileScope();
    const candidateClientId =
      normalizeMalClientId(overrideClientId) || getEffectiveMalClientId(targetScope);
    if (!isValidMalClientId(candidateClientId)) {
      return {
        ok: false,
        error: 'INSERISCI UN CLIENT ID MYANIMELIST VALIDO (ALMENO 16 CARATTERI ALFANUMERICI).',
      };
    }

    if (overrideClientId) {
      setStoredMalClientId(candidateClientId, targetScope);
    }

    const codeVerifier = generatePkceCodeVerifier(64);
    const state = generateOAuthState(32);

    const pending: MalOAuthPending = {
      codeVerifier,
      state,
      clientId: candidateClientId,
      createdAt: Date.now(),
    };
    const pendingKey = getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, targetScope);
    AppStorage.setObject(pendingKey, pending);

    const authUrl = buildMalAuthorizeUrl({
      clientId: candidateClientId,
      codeVerifier,
      state,
      redirectUri: MAL_REDIRECT_URI,
    });

    this.lastLoginCallbackResult = null;
    this.loginInFlight = true;
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, MAL_REDIRECT_URI);

      if (result.type === 'success' && 'url' in result && result.url) {
        return await this.handleCallbackUrl(result.url);
      }

      // If Android Linking event arrived concurrently and started/completed token exchange
      if (this.inFlightCallbackPromise) {
        return await this.inFlightCallbackPromise;
      }

      const callbackOutcome = this.lastLoginCallbackResult as {
        state: string;
        result: MalAuthLoginResult;
      } | null;
      if (callbackOutcome && callbackOutcome.state === state) {
        return callbackOutcome.result;
      }

      const activePending = AppStorage.getObject<MalOAuthPending>(pendingKey);
      if (!activePending && this.isConnected()) {
        return {
          ok: true,
          alreadyHandled: true,
          session: this.getSession(targetScope)!,
        };
      }

      AppStorage.remove(pendingKey);
      return {
        ok: false,
        cancelled: true,
      };
    } catch (err: any) {
      if (this.inFlightCallbackPromise) {
        return await this.inFlightCallbackPromise;
      }
      const callbackOutcome = this.lastLoginCallbackResult as {
        state: string;
        result: MalAuthLoginResult;
      } | null;
      if (callbackOutcome && callbackOutcome.state === state) {
        return callbackOutcome.result;
      }
      AppStorage.remove(pendingKey);
      return {
        ok: false,
        error: err?.message || 'IMPOSSIBILE APRIRE IL BROWSER PER IL LOGIN MYANIMELIST.',
      };
    } finally {
      this.loginInFlight = false;
    }
  }

  async handleCallbackUrl(callbackUrl: string): Promise<MalAuthLoginResult> {
    const targetScope = getActiveMalProfileScope();
    const pendingKey = getMalScopedKey(StorageKeys.MAL_OAUTH_PENDING, targetScope);
    const parsed = parseMalCallbackUrl(callbackUrl);
    if (!parsed) {
      return { ok: false, error: 'URL DI RITORNO MYANIMELIST NON VALIDO.' };
    }

    const callbackKey = `${targetScope}:${parsed.code || parsed.error || ''}:${parsed.state || ''}`;
    if (this.inFlightCallbackKey === callbackKey && this.inFlightCallbackPromise) {
      return await this.inFlightCallbackPromise;
    }

    // Prune stale handled keys (> 60s)
    const now = Date.now();
    for (const [k, entry] of this.handledCallbackResults.entries()) {
      if (now - entry.ts > 60_000) {
        this.handledCallbackResults.delete(k);
      }
    }

    if (!callbackKey.endsWith(':')) {
      const cached = this.handledCallbackResults.get(callbackKey);
      if (cached) {
        return {
          ...cached.result,
          alreadyHandled: true,
        };
      }
    }

    const pending = AppStorage.getObject<MalOAuthPending>(pendingKey);
    if (!pending) {
      return {
        ok: false,
        error: 'SESSIONE OAUTH SCADUTA O GIÀ COMPLETATA. RIPROVA IL LOGIN.',
      };
    }

    if (parsed.error) {
      AppStorage.remove(pendingKey);
      const errRes: MalAuthLoginResult = {
        ok: false,
        cancelled: parsed.error === 'access_denied',
        error: parsed.errorDescription || `AUTORIZZAZIONE RIFIUTATA (${parsed.error.toUpperCase()}).`,
      };
      if (!callbackKey.endsWith(':')) {
        this.handledCallbackResults.set(callbackKey, { result: errRes, ts: Date.now() });
      }
      this.lastLoginCallbackResult = { state: pending.state, result: errRes };
      return errRes;
    }

    if (!parsed.state || parsed.state !== pending.state) {
      AppStorage.remove(pendingKey);
      const csrfRes: MalAuthLoginResult = {
        ok: false,
        error: 'VERIFICA DI SICUREZZA (STATE CSRF) FALLITA. LOGIN ANNULLATO.',
      };
      this.lastLoginCallbackResult = { state: pending.state, result: csrfRes };
      return csrfRes;
    }

    if (!parsed.code) {
      AppStorage.remove(pendingKey);
      const codeErrRes: MalAuthLoginResult = {
        ok: false,
        error: 'CODICE DI AUTORIZZAZIONE MANCANTE NEL CALLBACK.',
      };
      this.lastLoginCallbackResult = { state: pending.state, result: codeErrRes };
      return codeErrRes;
    }

    // Delete pending state immediately before exchange for idempotency
    AppStorage.remove(pendingKey);

    const exchangePromise = this.exchangeAuthorizationCode({
      code: parsed.code,
      clientId: pending.clientId,
      codeVerifier: pending.codeVerifier,
      scopeId: targetScope,
    }).finally(() => {
      if (this.inFlightCallbackKey === callbackKey) {
        this.inFlightCallbackKey = null;
        this.inFlightCallbackPromise = null;
      }
    });

    this.inFlightCallbackKey = callbackKey;
    this.inFlightCallbackPromise = exchangePromise;

    const res = await exchangePromise;
    if (!callbackKey.endsWith(':')) {
      this.handledCallbackResults.set(callbackKey, { result: res, ts: Date.now() });
    }
    this.lastLoginCallbackResult = { state: pending.state, result: res };
    return res;
  }

  private async exchangeAuthorizationCode(params: {
    code: string;
    clientId: string;
    codeVerifier: string;
    scopeId?: string;
  }): Promise<MalAuthLoginResult> {
    try {
      const form = new URLSearchParams();
      form.set('client_id', params.clientId);
      form.set('code', params.code);
      form.set('code_verifier', params.codeVerifier);
      form.set('grant_type', 'authorization_code');
      form.set('redirect_uri', MAL_REDIRECT_URI);

      const tokenRes = await this.http.post(MAL_OAUTH_TOKEN_URL, form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const data = tokenRes?.data || {};
      if (!data.access_token || typeof data.access_token !== 'string') {
        return {
          ok: false,
          error: 'RISPOSTA TOKEN MYANIMELIST NON VALIDA.',
        };
      }

      const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
      const session: MalAuthSession = {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : '',
        expiresAt: Date.now() + expiresIn * 1000,
        tokenType: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
        updatedAt: Date.now(),
      };

      // Best-effort fetch user profile before persisting final session
      try {
        const profile = await this.fetchProfileWithToken(session.accessToken);
        if (profile) {
          session.username = profile.name;
          session.userId = profile.id;
          session.picture = profile.picture;
        }
      } catch {
        // Non-blocking: session tokens are already valid
      }

      this.saveSession(session, params.scopeId);
      return { ok: true, session };
    } catch (err: any) {
      const info = extractHttpErrorInfo(err);
      return {
        ok: false,
        error: `SCAMBIO TOKEN MAL FALLITO: ${info.message.toUpperCase()}`,
      };
    }
  }

  private async fetchProfileWithToken(accessToken: string): Promise<MalUserProfile | null> {
    const res = await this.http.get(`${MAL_API_BASE_URL}/users/@me?fields=id,name,picture`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    const d = res?.data;
    if (d && typeof d.name === 'string') {
      return {
        id: Number(d.id) || 0,
        name: d.name,
        picture: typeof d.picture === 'string' ? d.picture : undefined,
      };
    }
    return null;
  }

  async refreshProfile(): Promise<MalUserProfile | null> {
    const scopeId = getActiveMalProfileScope();
    const token = await this.getValidAccessToken();
    const profile = await this.fetchProfileWithToken(token);
    if (profile) {
      const current = this.getSession(scopeId);
      if (current) {
        this.saveSession(
          {
            ...current,
            username: profile.name,
            userId: profile.id,
            picture: profile.picture,
            updatedAt: Date.now(),
          },
          scopeId
        );
      }
    }
    return profile;
  }

  async getValidAccessToken(forceRefresh = false): Promise<string> {
    const scopeId = getActiveMalProfileScope();
    const session = this.getSession(scopeId);
    if (!session || !session.accessToken) {
      throw new MalAuthError('Account MyAnimeList non connesso', { status: 401, isRevoked: false });
    }

    if (!forceRefresh && session.expiresAt > 0 && Date.now() < session.expiresAt - 60_000) {
      return session.accessToken;
    }

    if (!session.refreshToken) {
      if (!forceRefresh && session.expiresAt === 0) {
        return session.accessToken;
      }
      throw new MalAuthError('Refresh token MyAnimeList non disponibile', { status: 401, isRevoked: true });
    }

    if (this.refreshInFlight) {
      return await this.refreshInFlight;
    }

    this.refreshInFlight = this.performTokenRefresh(session, scopeId).finally(() => {
      this.refreshInFlight = null;
    });

    return await this.refreshInFlight;
  }

  private async performTokenRefresh(session: MalAuthSession, scopeId: string): Promise<string> {
    const clientId = getEffectiveMalClientId(scopeId);
    if (!isValidMalClientId(clientId)) {
      throw new MalAuthError('Client ID MyAnimeList mancante o non valido', {
        status: 400,
        isRevoked: false,
      });
    }

    try {
      const form = new URLSearchParams();
      form.set('client_id', clientId);
      form.set('grant_type', 'refresh_token');
      form.set('refresh_token', session.refreshToken);

      const res = await this.http.post(MAL_OAUTH_TOKEN_URL, form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const data = res?.data || {};
      if (!data.access_token || typeof data.access_token !== 'string') {
        throw new MalAuthError('Risposta refresh token non valida', { status: 500, isRevoked: false });
      }

      const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
      const updatedSession: MalAuthSession = {
        ...session,
        accessToken: data.access_token,
        refreshToken:
          typeof data.refresh_token === 'string' && data.refresh_token.trim()
            ? data.refresh_token
            : session.refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        tokenType: typeof data.token_type === 'string' ? data.token_type : session.tokenType || 'Bearer',
        updatedAt: Date.now(),
      };

      this.saveSession(updatedSession, scopeId);
      return updatedSession.accessToken;
    } catch (err: any) {
      if (err instanceof MalAuthError) throw err;

      const info = extractHttpErrorInfo(err);
      const shouldRevoke = shouldRevokeMalSessionOnRefreshError(info.status, info.errorCode);
      if (shouldRevoke) {
        this.clearSessionInternal(false, { scopeId, recordDeletion: false });
        throw new MalAuthError(
          `Sessione MyAnimeList scaduta o revocata (${info.status || info.errorCode})`,
          { status: info.status, code: info.errorCode, isRevoked: true }
        );
      }

      // Network / timeout / 5xx / 429: NEVER wipe local MAL session
      throw new MalAuthError(info.message, {
        status: info.status,
        code: info.errorCode,
        isRevoked: false,
      });
    }
  }

  revokeSessionOnAuthFailure(): void {
    this.clearSessionInternal(false, { recordDeletion: false });
  }

  logout(): void {
    this.refreshInFlight = null;
    this.loginInFlight = false;
    this.inFlightCallbackKey = null;
    this.inFlightCallbackPromise = null;
    this.handledCallbackResults.clear();
    this.lastLoginCallbackResult = null;
    this.clearSessionInternal(true, { recordDeletion: true });
  }
}

export const MalAuthService = new MalAuthServiceClass();
