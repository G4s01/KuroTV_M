# 📘 Specifiche & Architettura — Integrazione MyAnimeList (MAL API v2)

Questo documento descrive l'architettura implementata e verificata dell'integrazione **MyAnimeList API v2** in **Kuro Mobile** (Expo SDK 58 / React Native 0.88.1):

1. **Consultazione e riproduzione di 3 liste MAL**: visualizzazione in-app delle liste **In corso (`watching`)**, **Da guardare (`plan_to_watch`)** e **Completati (`completed`)**, con ricerca locale, ordinamento (`recent` / `title` / `score`), apertura della scheda su AnimeWorld e avvio rapido della riproduzione.
2. **Sincronizzazione unidirezionale `App → MAL` (diff interattivo + auto-sync configurabile)**: invio verso MyAnimeList degli episodi visti e delle serie completate in app senza mai sovrascrivere lo stato di visione locale (`CONTINUE_WATCHING`, `WATCH_HISTORY`, `WATCH_PROGRESS`, `FAVORITES`).
3. **Gestione singola serie nella Scheda Dettagli Anime**: `MalStatusPill` + bottom sheet touch-native `MalEntrySheet` per `Plan to Watch`, avanzamento episodi, stato, voto (`1–10`) e rimozione dalla lista.
4. **Isolamento per Profilo KuroSync & Sync Auth-Only**: credenziali, preferenze, cache, highwater e code pendenti sono isolate per profilo KuroSync (`'local'` se disconnesso, `<profileId>` se connesso). Quando KuroSync è attivo su un backend compatibile (`KuroTV_S` con `0003_mal_auth.sql`), vengono sincronizzate su cloud **esclusivamente** le credenziali OAuth `malAuth` (e i tombstones `'mal_auth'`).

> [!IMPORTANT]
> L'intero modulo rispetta le regole di [`AGENTS.md`](../AGENTS.md): zero dipendenze `node:*` nel bundle Hermes, nessun segreto hardcoded, virtualizzazione con `@shopify/flash-list` v2, divieto di `Alert.alert` (solo `ConfirmModal`), `TextInput` non controllati (`defaultValue`, `key={inputKey}`) nei campi di ricerca, modali touch-native senza `@expo/ui` con `useBottomSheetDragDismiss`, fogli di stile separati (`*.styles.ts`), touch target $\ge 44\times 44\text{ dp}$ e gestione `hardwareBackPress` via `useFocusEffect`.

---

## 🎯 Decisioni Architetturali & Perimetro Funzionale

| Funzionalità | Stato | Comportamento Implementato |
|---|---|---|
| Autenticazione OAuth 2.0 PKCE (`plain`) | **Attivo** | API ufficiali MAL v2 via Chrome Custom Tab (`expo-web-browser` + `plugins/withMalCustomTabs.js`), `Client ID` personale configurabile in-app (con fallback `EXPO_PUBLIC_MAL_CLIENT_ID`) |
| Liste MAL visualizzabili | **Attivo** | 3 tab: **In corso (`watching`)**, **Da guardare (`plan_to_watch`)**, **Completati (`completed`)** con ricerca locale, ordinamento, pull-to-refresh e cache offline MMKV |
| Punti di ingresso UI | **Attivo** | Pulsante **`MAL`** nella destra dell'header di `Preferiti` (`SelectionAppBar` via `rightActions`, nascosto in multi-selezione), riga in `Impostazioni`, card `MalSyncSummaryCard` in `Impostazioni → Sincronia` e `MalStatusPill` in `app/anime/[id].tsx` |
| Apertura su AnimeWorld (`MAL → App`) | **Attivo** | Priorità a slug presenti in cronologia/preferiti locali; altrimenti preferenza audio (`Chiedi` / `SUB` / `ITA`) con `MalMatchPickerModal` e cache bidirezionale `mal.idMap` |
| Sincronizzazione `App → MAL` (batch diff) | **Attivo** | Anteprima diff modificabile (`MalSyncDiffModal`) con conferma esplicita; promozione automatica `plan_to_watch → watching / completed` |
| Auto-sync dal player | **Attivo (Opt-in)** | Selettore `StepSlider` a 3 modalità (**`OFF` di default**, **`EPISODI`**, **`SOLO FINITI` / `completed_only`**) con deduplica per `(scopeId, malId, ep)` e coda offline `MAL_PENDING_UPDATES` |
| Soglia minima *Watching* | **Attivo (Opt-in)** | Toggle + soglia configurabile **`1–24` episodi** (default **`3`**) tramite `StepSlider` + stepper `−`/`+` (44 dp): evita di aggiungere in *Watching* serie appena iniziate; non blocca serie già in `watching` né passaggi a `completed` |
| Isolamento per profilo KuroSync & Sync Auth | **Attivo** | Tutte le chiavi MAL in MMKV usano prefisso scoped per profilo (`.p.<profileId>` / `'local'`). Su `KuroTV_S` sincronizzano **solo** `malAuth` + tombstones `'mal_auth'` tramite capability check (`'malAuth' in remotePull.deltas`) |
| Importazione `MAL → App` / sync Preferiti → PTW | **Escluso** | Nessuna sovrascrittura automatica della cronologia/preferiti locali da MAL |
| Liste `on_hold` / `dropped` nelle tab `/mal` | **Escluso** | Fuori dalle 3 tab principali (modificabili sul singolo titolo tramite `MalEntrySheet`) |

---

## 🔍 Garanzie Critiche nel Codebase

1. **Intercettazione Deep-Link OAuth in `+native-intent.tsx` e `deep-link.ts`**:
   - `isMalAuthCallbackDeepLink(rawUrl)` in `src/services/sync/deep-link.ts` intercetta `kurotv://mal-callback` in `resolveSystemDeepLinkPath`: restituisce `'/'` su cold start (`initial: true`) e `null` su warm start (`initial: false`), prevenendo fallback verso `app/+not-found.tsx`.
   - `app/_layout.tsx` gestisce il fallback su `MalAuthService.handleCallbackUrl(trimmedUrl)` prima del parsing KuroSync se il rientro non avviene direttamente da `WebBrowser.openAuthSessionAsync`.
2. **Invariante `detail.malId` (Mai `anilistId`)**:
   - In `app/player/[id].tsx` (`pureMalIdRef`), `AnimeWorldScraper.getAnimeDetail` e `mapper.ts`, mapping, lookup e auto-sync MAL utilizzano **esclusivamente** `detail.malId` (mai `detail.anilistId`), impedendo scritture su anime errati.
3. **Protezione da `pruneOldProgress` (60gg) & Cap `WATCH_HISTORY` (100)**:
   - `collectLocalCompletedSeries()` in `src/services/mal/sync.ts` calcola il progresso completato prendendo il massimo numero episodio intero positivo tra `WATCH_PROGRESS`, `WATCH_HISTORY` (`isCompleted || percentage >= 90`), `CONTINUE_WATCHING` (`isCaughtUp === true`) e il registro persistente scoped `MAL_WATCHED_HIGHWATER`, aggiornato in `AppStorage.saveWatchProgress()` senza generare mutazioni KuroSync.
4. **Parsing `totalEpisodes` e Protezione Serie Ongoing**:
   - `parsePositiveTotalEpisodes()` in `src/services/mal/id-map-store.ts` normalizza stringhe come `"12 / 12"` → `12` e `"?"` / `"??"` → `null`. La promozione automatica a `completed` scatta solo se `knownTotal > 0`, `targetEpisodes >= knownTotal` e la serie non è ongoing (`currently_airing` / `not_yet_aired`).
5. **Layout Header Mobile-First su Schermi Stretti**:
   - `HomeAppBar` rimane privo di affollamento: l'ingresso primario `MAL` vive nello slot `rightActions` di `SelectionAppBar` dentro `app/(tabs)/favorites.tsx` (nascosto durante la selezione multipla), accompagnato dagli accessi in `app/(tabs)/settings.tsx` e `app/settings/sync.tsx`.

---

## 📦 Configurazione Form MAL & Dipendenze Native

### 1. Registrazione `Client ID` personale su MyAnimeList (`https://myanimelist.net/apiconfig`)
Ogni utente inserisce il proprio `Client ID` direttamente in-app tramite `MalConnectCard` / `MalSettingsModal` (con fallback di build opzionale su `process.env.EXPO_PUBLIC_MAL_CLIENT_ID` e pulsante **"COPIA REDIRECT URL"** per `kurotv://mal-callback`):

- **App Name**: es. `KuroTV Mobile`
- **App Type**: **`Android`** oppure **`other`** (**NON `web`**, per evitare emissione/richiesta di `Client Secret` incompatibile con client pubblici PKCE)
- **App Description**: almeno 50 caratteri alfanumerici senza caratteri speciali
- **App Redirect URL**: **`kurotv://mal-callback`** (senza slash finale)
- **Homepage URL**: URL del repository o pagina personale (es. `https://github.com/G4s01/KuroTV_M`)
- **App Logo / Privacy Policy / Terms of Use URL**: facoltativi
- **Commercial / Non-Commercial**: `non-commercial`
- **Name / Company Name**: proprio nome o nickname
- **Purpose of Use**: `personal` / `hobby` (o `other`)

### 2. Custom Tabs Android (`expo-web-browser` + `plugins/withMalCustomTabs.js`)
- Dipendenza `expo-web-browser` (~58.1.0) configurata in `package.json`.
- Il config plugin Expo `./plugins/withMalCustomTabs.js` (registrato in `app.json`) garantisce la presenza dell'intent `<action android:name="android.support.customtabs.action.CustomTabsService" />` dentro `<queries>` in `AndroidManifest.xml` ad ogni prebuild Android 11+, in aggiunta allo scheme `kurotv`.

---

## 🗺️ Architettura del Modulo MAL

```text
plugins/
└── withMalCustomTabs.js        # Config plugin Android 11+ CustomTabsService <queries>
src/
├── services/
│   ├── mal/
│   │   ├── index.ts            # Barrel export del modulo MAL
│   │   ├── types.ts            # Tipi OAuth, liste (3 stati), MalSettings, MalAutoSyncMode, mapping, diff e coda
│   │   ├── config.ts           # Endpoint MAL v2, scope profilo KuroSync (.p.<profileId> / local), MalSettings, bridge malAuth
│   │   ├── id-map-store.ts     # Persistenza scoped mal.idMap (byAnimeId + byMalId), parser totalEpisodes & isOngoing
│   │   ├── auth.ts             # PKCE plain, state CSRF, token exchange, refresh single-flight, invalid_grant guard, logout tombstones
│   │   ├── client.ts           # Client REST api.myanimelist.net/v2 (axios, paginazione, PATCH/DELETE, retry 401)
│   │   ├── mapper.ts           # Matching bidirezionale malId ↔ animeId, priorità locale & preferenza audio SUB/ITA
│   │   └── sync.ts             # Highwater calc, diff App → MAL, autoSyncMode (off/episodes/completed_only), soglia watching, coda offline
│   ├── storage/
│   │   └── app-storage.ts      # StorageKeys.MAL_*, SYNC_SERVER_SUPPORTS_MAL_AUTH, scoping per profilo & code mutazioni/tombstones mal_auth
│   └── sync/
│       ├── deep-link.ts        # Intercettazione kurotv://mal-callback per +native-intent.tsx
│       ├── types.ts            # MalAuthSyncRecord & tombstone 'mal_auth'
│       ├── merge.ts            # LWW su malAuth.updatedAt & dominanza tombstones ('mal_auth:default'|'malAuth'|'malauth')
│       └── sync-manager.ts     # Capability detection, push/pull malAuth, switchProfile guard & cleanup disconnect()
├── components/
│   ├── SelectionAppBar.tsx     # Slot opzionale `rightActions` per pulsante MAL
│   └── mal/
│       ├── index.ts
│       ├── mal.styles.ts
│       ├── MalConnectCard.tsx      # Input guidato Client ID (scope-aware), copia redirect URI, login Custom Tab
│       ├── MalAnimeCard.tsx        # Card FlashList (poster, stato, ep, badge sync/match)
│       ├── MalSyncDiffModal.tsx    # Anteprima diff App → MAL editabile + serie non mappate + conferma ConfirmModal
│       ├── MalMatchPickerModal.tsx # Disambiguazione SUB vs ITA e ricerca manuale AnimeWorld
│       ├── MalEntrySheet.tsx       # Bottom sheet touch-native su app/anime/[id] (PTW, ep, stato, voto, rimozione)
│       ├── MalSettingsModal.tsx    # Client ID, StepSlider autoSyncMode, soglia Watching 1–24, audio SUB/ITA, logout
│       ├── MalStatusPill.tsx       # Pill compatto stato MAL in scheda dettagli anime (con badge connesso / CTA)
│       └── MalSyncSummaryCard.tsx  # Card riepilogo MAL in app/settings/sync.tsx con profilo attivo e coda pendente
app/
├── mal/
│   └── index.tsx               # Schermata 3 tab MAL (IN CORSO / DA GUARDARE / COMPLETATI) + Sync diff + ricerca
├── _layout.tsx                 # Route `mal/index`, fallback deep-link OAuth & flush coda offline on active
├── (tabs)/
│   ├── favorites.tsx           # Pulsante `MAL` nell'header destro di SelectionAppBar
│   └── settings.tsx            # Accesso rapido MyAnimeList con badge stato
├── settings/
│   └── sync.tsx                # SyncSettingsCard + MalSyncSummaryCard
├── anime/
│   └── [id].tsx                # MalStatusPill interattivo → MalEntrySheet
└── player/
    └── [id].tsx                # Hook auto-sync completamento episodio (solo pureMalIdRef da detail.malId)
tests/
└── mal-verification.test.ts    # Suite completa MAL API v2, diff, threshold, isolamento profili & parità KuroSync _kurosync_ref
```

---

## ⚙️ Dettagli Implementativi Chiave

### 1. Storage MMKV Scoped per Profilo & Isolamento KuroSync (`config.ts`, `app-storage.ts`, `id-map-store.ts`)
- `AppStorage.getActiveMalScopeId()` / `getActiveMalProfileScope()` restituisce `'local'` quando KuroSync è disconnesso, oppure il `profileId` attivo (`SYNC_PROFILE_ID`) quando connesso.
- Tutte le chiavi `MAL_CLIENT_ID`, `MAL_AUTH_SESSION`, `MAL_OAUTH_PENDING`, `MAL_SETTINGS`, `MAL_ID_MAP`, `MAL_WATCHED_HIGHWATER`, `MAL_PENDING_UPDATES`, `MAL_LIST_CACHE`, `MAL_LAST_SYNC_TIME` e `MAL_IGNORED_ANIME_IDS` (così come `byMalId.p.<scopeId>` in `id-map-store.ts`) vengono risolte tramite `getMalScopedKey()` (suffisso `.p.<scopeId>`) e sono **protette** da `AppStorage.clearCache()`.
- Le operazioni locali su liste, highwater, mapping, preferenze e code **non** scrivono mai in `sharedSettings` né emettono mutazioni KuroSync.
- **Cosa sincronizza con KuroSync (`KuroTV_S`)**:
  - Solo `malAuth` (`MalAuthSyncRecord`: `profileId?`, `clientId`, `accessToken`, `refreshToken`, `expiresAt`, `tokenType`, `username?`, `userId?`, `picture?`, `updatedAt`) + deletion tombstones con tipo `'mal_auth'` e chiave `'default'`.
  - **Capability Detection (`SYNC_SERVER_SUPPORTS_MAL_AUTH`)**: rilevato per URL del server tramite `'malAuth' in remotePull.deltas`; server legacy privi di `0003_mal_auth.sql` non ricevono mai `malAuth` né deletions `'mal_auth'`.
  - **`deltas.malAuth === null` & Merge**: interpretato in `mergeLocalAndRemote()` come "assente o invariato dopo `since`", preservando `local.malAuth` salvo presenza di un tombstone `'mal_auth'` (`default` / `malAuth` / `malauth`) con `deletedAt >= malAuth.updatedAt`.
  - **`applyRemoteMalAuthRecordForScope`**: idrata `MAL_CLIENT_ID` e `MAL_AUTH_SESSION` dallo stato remoto **senza** ri-emettere mutazioni push (`no sync loop`), e ripulisce `MAL_AUTH_SESSION` / cache associata quando arriva un tombstone remoto (`null`).
  - **`disconnect()` vs `switchProfile()`**: `disconnect()` invoca `clearSyncedMalProfileData(scopeId)` lasciando intatto lo scope `'local'`; `switchProfile()` protegge eventuali mutazioni `malAuth` pendenti prima dello switch di scope e chiama `MalAuthService.handleSyncScopeChanged()` + `MalSyncService.handleSyncScopeChanged()`.

### 2. Autenticazione OAuth 2.0 PKCE & Resilienza (`src/services/mal/auth.ts`)
- Generazione pure TypeScript (`crypto.getRandomValues` con fallback Hermes-safe) di `codeVerifier` (64 caratteri `[A-Za-z0-9\-._~]`) e `state` CSRF (32 caratteri), con `code_challenge_method=plain`.
- Scambio codice → token in `application/x-www-form-urlencoded` (senza `client_secret`) e rimozione immediata di `MAL_OAUTH_PENDING` per idempotenza tra `openAuthSessionAsync` e `Linking`.
- `saveSession()` emette `recordSyncMutation('malAuth', ...)` al login PKCE, al refresh token (`performTokenRefresh()`) e a `refreshProfile()`, garantendo che i dispositivi dello stesso profilo ricevano sempre il refresh token più recente tramite LWW (`updatedAt`).
- **Policy errori su refresh (`shouldRevokeMalSessionOnRefreshError`)**:
  - Errori offline / DNS / timeout / HTTP `5xx` **non** cancellano mai la sessione locale.
  - Su HTTP `400`/`401` con `error: 'invalid_grant'`, la sessione locale viene revocata **senza** emettere un tombstone `'mal_auth'` distruttivo verso altri device (che potrebbero aver già ruotato il refresh token).
  - Un tombstone `{ type: 'mal_auth', key: 'default', deletedAt }` viene emesso **esclusivamente** su `MalAuthService.logout()` esplicito confermato dall'utente con `ConfirmModal`.

### 3. Client REST & Mapper (`client.ts`, `mapper.ts`)
- `client.ts`: `getCurrentUser()`, `fetchUserAnimeList()` (paginazione fino a 20 pagine via `paging.next`, lettura `num_episodes_watched`), `getAnimeUserStatus()`, `updateAnimeListStatus()` (`PATCH` con `num_watched_episodes`, retry singolo su `401` con refresh forzato) e `deleteAnimeListEntry()` (`DELETE`).
- `mapper.ts`: priorità a `WATCH_HISTORY`, `CONTINUE_WATCHING` e `FAVORITES`; matching per titolo normalizzato (`synonyms`, `en`, `ja`) validato da `detail.malId === malId`; gestione `audioPreference` (`'ask' | 'sub' | 'ita'`) e apertura `MalMatchPickerModal` per disambiguazione o associazione manuale persistita in `byMalId`.

### 4. Auto-Sync Configurabile & Soglia *Watching* (`sync.ts`, `MalSettingsModal.tsx`)
- Struttura `MalSettings` (default in `DEFAULT_MAL_SETTINGS`):
  - `autoSyncMode: 'off' | 'episodes' | 'completed_only'` (default `'off'`) — sincronizzato con compat flag `autoSyncOnComplete`.
  - `watchingThresholdEnabled: boolean` (default `false`).
  - `watchingThresholdEpisodes: number` (`MIN = 1`, `MAX = 24`, default `3`, normalizzato da `clampMalWatchingThresholdEpisodes`).
  - `audioPreference: 'ask' | 'sub' | 'ita'` (default `'ask'`).
- Comportamento `maybeAutoSyncOnEpisodeComplete` / `enqueueOrAutoSyncEpisode`:
  1. Se `autoSyncMode === 'off'` o utente non connesso → nessuna azione.
  2. Se la serie su MAL è già `completed` → `skipped_completed` (non regredisce mai).
  3. Calcola `targetEpisodes = max(ep, cached?.watchedEpisodes || 0)` con clamp su `knownTotal` e valuta `qualifiesCompleted` (`knownTotal > 0 && targetEpisodes >= knownTotal && !isOngoing`).
  4. Se `autoSyncMode === 'completed_only'` e `targetStatus !== 'completed'` → `skipped_completed_only`.
  5. Se `watchingThresholdEnabled` è attivo, `targetStatus === 'watching'`, l'anime non è già in `watching` su MAL e `targetEpisodes < watchingThresholdEpisodes` → `below_watching_threshold`. (Se la serie è già `watching`, continua ad aggiornare normalmente; al raggiungimento della soglia viene aggiunta come `watching` con il conteggio completo `targetEpisodes` accumulato).
  6. Errori di rete / `429` / `5xx` accodano l'update in `MAL_PENDING_UPDATES` per il flush automatico (`flushPendingUpdates()`) al rientro in primo piano o al refresh manuale.

---

## 🧪 Verifica Tecnica & Suite Automatizzata

1. **Comandi di validazione**:
   ```bash
   # Suite dedicata MAL API v2 + parità KuroSync (_kurosync_ref) + static checks
   node --experimental-strip-types --loader ./tests/test-loader.mjs tests/mal-verification.test.ts

   # Suite principale & controllo tipi / lint
   npm test
   npm run typecheck
   npm run lint
   ```
2. **Copertura verificata in `tests/mal-verification.test.ts`**:
   - PKCE `plain`, CSRF `state`, callback routing `+native-intent` / `resolveSystemDeepLinkPath`.
   - Client REST MAL (`num_episodes_watched`, paginazione, retry refresh su `401`, conservazione sessione su rete/`5xx`, revoca senza tombstone su `invalid_grant`).
   - Calcolo `watchedEpisodesCount` anti off-by-one, protezione highwater oltre 60gg, `completed_only`, soglia `watchingThresholdEpisodes` (`1–24`), serie ongoing e consolidamento multi-slug `SUB + ITA`.
   - Parità contrattuale con `_kurosync_ref` (`migrations/0003_mal_auth.sql`, `types.ts`, `merge.ts`, `routes/sync.ts`) e flussi completi `SyncManager` + `MalAuthService`: propagazione login A→B, isolamento multi-profilo (`prof-1` vs `prof-2` vs `'local'`), LWW su refresh token, tombstone `'mal_auth'` su logout, re-login con `updatedAt > deletedAt`, retrocompatibilità server legacy privo di `malAuth`, non-esposizione liste/impostazioni/highwater in payload sync e verifiche statiche anti-leak / zero `node:*` / zero `Alert.alert` / zero `@expo/ui`.

---

## ⚠️ Rischi Noti e Mitigazioni

| Rischio | Impatto | Mitigazione Implementata |
|---|---|---|
| Selezione `App Type: web` sul form MAL | `Client Secret` incompatibile con app pubblica | Guida esplicita in `MalConnectCard` a scegliere `Android` / `other` e copia 1-tap di `kurotv://mal-callback` |
| AnimeWorld priva di `#mal-button` o uso di `anilistId` | Match assente o ID errato su MAL | Divieto di fallback su `anilistId`, segnalazione esplicita nel diff e associazione manuale persistente in `mal.idMap` |
| Schede `SUB` e `ITA` separate con stesso `malId` | Apertura versione errata o proposte duplicate | Priorità cronologia/preferiti + `audioPreference` (`ask`/`sub`/`ita`) + consolidamento per `malId` nel diff |
| `pruneOldProgress` (60gg) o cap `WATCH_HISTORY` | Perdita conteggio episodi vecchi in `App → MAL` | Registro persistente scoped `MAL_WATCHED_HIGHWATER` + calcolo `max` episodio completato |
| Serie in corso su MAL (`currently_airing`) | Marcatura prematura come `completed` | Controllo `mediaStatus` / `!isOngoing` prima di proporre `completed` |
| Cambio profilo KuroSync / device multipli / server legacy | Collisione sessioni, sync loop o 500 server | Scope isolato `.p.<profileId>` vs `'local'`, capability detection `SYNC_SERVER_SUPPORTS_MAL_AUTH`, `applyRemoteMalAuthRecordForScope` no-loop, dominanza tombstones `'mal_auth'` |
