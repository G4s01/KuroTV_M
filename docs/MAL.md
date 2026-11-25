# 📘 Piano di Implementazione — Integrazione MyAnimeList (MAL)

Questo documento definisce il piano operativo aggiornato e verificato sul codebase per integrare **MyAnimeList API v2** in **Kuro Mobile** (Expo SDK 58 / React Native 0.88.1) con i seguenti obiettivi:

1. **Consultazione e riproduzione di 3 liste MAL**: visualizzare all'interno dell'app i propri titoli salvati su MyAnimeList come **In corso (`watching`)**, **Da guardare (`plan_to_watch`)** e **Completati (`completed`)**, potendo aprire qualsiasi scheda su AnimeWorld e avviare la riproduzione con un tap.
2. **Sincronizzazione unidirezionale `App → MAL` (manuale con diff + opt-in auto-sync)**: inviare a MyAnimeList gli episodi completati e le serie concluse nell'app senza mai alterare o sovrascrivere lo stato locale (`CONTINUE_WATCHING`, `WATCH_HISTORY`, `WATCH_PROGRESS`, `FAVORITES`) né interferire con KuroSync.
3. **Gestione singola serie nella Scheda Dettagli Anime**: visualizzare lo stato MAL corrente dell'anime e gestire manualmente `Plan to Watch`, avanzamento episodi, stato e voto (1–10) tramite un bottom sheet touch-native dedicato (`MalEntrySheet`).

> [!IMPORTANT]
> Ogni step rispetta integralmente le regole di [`AGENTS.md`](../AGENTS.md): zero dipendenze `node:*` nel bundle Hermes, virtualizzazione con `@shopify/flash-list` v2, divieto di `Alert.alert` (solo `ConfirmModal`), `TextInput` non controllati (`defaultValue`, `key={inputKey}`) nei campi di ricerca, modali touch-native senza `@expo/ui` con `useBottomSheetDragDismiss`, fogli di stile separati (`*.styles.ts`), touch target $\ge 44\times 44\text{ dp}$ e gestione `hardwareBackPress` via `useFocusEffect`.

---

## 🎯 Decisioni Architetturali & Perimetro Funzionale

| Funzionalità | Stato | Decisione & Comportamento |
|---|---|---|
| Autenticazione OAuth 2.0 PKCE (`plain`) | **Incluso** | API ufficiali MAL v2 via Chrome Custom Tab (`expo-web-browser`), `Client ID` personale inserito in-app (con guida al form e fallback `EXPO_PUBLIC_MAL_CLIENT_ID`) |
| Liste MAL visualizzabili | **Incluso** | 3 tab: **In corso (`watching`)**, **Da guardare (`plan_to_watch`)**, **Completati (`completed`)** con ricerca locale, ordinamento, pull-to-refresh e cache offline MMKV |
| Punto di ingresso UI principale | **Incluso** | Pulsante **`MAL`** nella parte destra dell'header di `Preferiti` (`SelectionAppBar` via slot opzionale `rightActions`, nascosto in multi-selezione) + riga dedicata in `Impostazioni` e `Sincronia` |
| Apertura su AnimeWorld (`MAL → App`) | **Incluso** | Priorità a slug già presenti in cronologia/preferiti locali; altrimenti preferenza audio configurabile (`Chiedi` / `SUB` / `ITA`) con `MalMatchPickerModal` e cache `mal.idMap` |
| Sincronizzazione `App → MAL` (batch diff) | **Incluso** | Anteprima diff modificabile (`MalSyncDiffModal`) con conferma esplicita; promozione automatica `plan_to_watch → watching / completed` quando inizi a guardare in app |
| Auto-sync al completamento episodio nel player | **Incluso (Opt-in)** | Toggle in impostazioni MAL (**`OFF` di default**): se attivo, aggiorna MAL al completamento episodio (`isCompleted`) con deduplica di sessione e coda offline `MAL_PENDING_UPDATES` |
| Gestione singola serie in `app/anime/[id].tsx` | **Incluso** | Badge stato MAL + `MalEntrySheet`: aggiungi/sposta in `Plan to Watch`, allinea episodi locali, cambia stato (`watching` / `plan_to_watch` / `completed`), assegna voto `1–10` o rimuovi dalla lista |
| Separazione totale da KuroSync | **Incluso** | Tutti i dati MAL (`Client ID`, token OAuth, preferenze, `mal.idMap`, coda offline) restano **strettamente locali al dispositivo**, senza toccare `sharedSettings` né `KuroTV_S` |
| Importazione `MAL → App` / sync Preferiti → PTW | **Escluso** | Nessuna sovrascrittura automatica della cronologia/preferiti locali da MAL |
| Liste `on_hold` / `dropped` nelle tab dedicate | **Escluso** | Fuori dalle 3 tab di `/mal` (rimane possibile impostarle/leggerle opzionalmente se già presenti su un singolo titolo) |

---

## 🔍 Correzioni Critiche Individuate nel Codebase

Dall'analisi del codice esistente emergono **5 punti critici** che questo piano risolve in modo esplicito:

1. **Intercettazione Deep-Link OAuth in `+native-intent.tsx` e `deep-link.ts`**:
   - Attualmente `resolveSystemDeepLinkPath` in `src/services/sync/deep-link.ts` inoltra qualsiasi link non KuroSync a `normalizeUrlForRouteExtraction`, trasformando `kurotv://mal-callback?code=...` in `/mal-callback` e provocando la schermata `Unmatched Route` (`app/+not-found.tsx`) in caso di rientro fuori da `WebBrowser.openAuthSessionAsync`.
   - **Correzione**: introdurre `isMalAuthCallbackDeepLink(rawUrl)` in `deep-link.ts` (intercettando `kurotv://mal-callback`) con lo stesso pattern protettivo di KuroSync (`initial ? '/' : null`), e gestirne il fallback in `app/_layout.tsx` prima di `parseKuroSyncDeepLink`.
2. **Bug `anilistId` vs `malId` in `app/player/[id].tsx`**:
   - Alla riga 1063 di `app/player/[id].tsx`, `const malId = detail.malId || detail.anilistId` usa erroneamente `anilistId` come fallback (valido solo come ripiego estremo o bug per AniSkip, ma **pericolosissimo** per MAL API v2 perché gli ID AniList non coincidono con gli ID MyAnimeList).
   - **Correzione**: qualsiasi operazione di mapping o sync MAL deve leggere **esclusivamente** `detail.malId` (mai `detail.anilistId`).
3. **Effetto di `pruneOldProgress` (60 giorni) & `WATCH_HISTORY` (cap 100) sul conteggio episodi**:
   - In `src/services/storage/app-storage.ts`, `AppStorage.pruneOldProgress(200, 60)` rimuove le chiavi `user.progress.<animeId>.<ep>` completate più vecchie di 60 giorni se la serie non è in `CONTINUE_WATCHING`, e `WATCH_HISTORY` è limitato a 100 elementi.
   - Se si contasse semplicemente il numero di chiavi `user.progress.*` residue, una serie con Ep 1–11 potati e Ep 12 completato oggi risulterebbe a `1` episodio invece di `12`.
   - **Correzione**: per ogni `animeId`, calcolare il progresso completato usando il **massimo `episodeNumber` intero positivo completato** tra `WATCH_PROGRESS`, `WATCH_HISTORY` (`isCompleted || progressPercent >= 90`) e `CONTINUE_WATCHING` quando `isCaughtUp === true` (che in `app-storage.ts` conserva l'ultimo episodio completato con `percentage: 100`), mantenendo anche un registro compatto locale `MAL_WATCHED_HIGHWATER` aggiornato al completamento per non perdere lo storico oltre i 60 giorni.
4. **Parsing robusto di `totalEpisodes` e stato serie ongoing**:
   - In `AnimeDetail`, `totalEpisodes` può arrivare come `"12 / 12"`, `"?"`, `"??"`, `"12"` o numero; inoltre `malEntry.numEpisodes` può essere `0` (sconosciuto) mentre una serie è ancora `currently_airing`.
   - **Correzione**: normalizzare `totalEpisodes` con parser dedicato (`"12 / 12"` → `12`, `"?"`/`"??"` → `null`) e promuovere automaticamente a `completed` solo quando l'anime su MAL risulta `finished_airing` (o non ongoing su AnimeWorld con totale certo > 0) e `targetEpisodes >= knownTotalEpisodes`.
5. **Spazio Header su Telefoni Stretti & Slot su `SelectionAppBar`**:
   - `HomeAppBar` in `src/components/home/HomeSearchHeader.tsx` occupa già ~310 dp (`KUROTV MOBILE` + 3 bottoni da 44 dp): aggiungere un 4° pulsante in alto causerebbe collisioni sui display da 320–360 dp.
   - **Correzione**: estendere `SelectionAppBar` (`src/components/SelectionAppBar.tsx`) con la prop opzionale `rightActions?: React.ReactNode` (visibile solo fuori dalla modalità multi-selezione) e collocare lì il pulsante **`MAL`** in `app/(tabs)/favorites.tsx`, dove tutta la metà destra è attualmente libera su qualsiasi larghezza schermo.

---

## 📦 Prerequisiti, Configurazione Form MAL & Dipendenze

### 1. Registrazione `Client ID` personale su MyAnimeList (`https://myanimelist.net/apiconfig`)
Poiché ogni utente utilizza il proprio `Client ID` personale inserito in-app (con eventuale fallback di build da `EXPO_PUBLIC_MAL_CLIENT_ID`), l'app includerà una guida integrata con pulsante **"COPIA REDIRECT URL"** (`kurotv://mal-callback`).

Parametri corretti per compilare il form su `https://myanimelist.net/apiconfig`:
- **App Name**: es. `KuroTV Mobile` (univoco/descrittivo)
- **App Type**: selezionare **`Android`** oppure **`other`** (**NON `web`**, così MAL non emette né richiede un `Client Secret` nel client mobile)
- **App Description**: almeno 50 caratteri alfanumerici, **senza caratteri speciali** (es. `Personal Android anime tracker client to view and sync MyAnimeList lists`)
- **App Redirect URL**: **`kurotv://mal-callback`** (deve combaciare al carattere con il codice, senza slash finale)
- **Homepage URL**: URL del repository o pagina personale (es. `https://github.com/G4s01/KuroTV_M`)
- **App Logo / Privacy Policy / Terms of Use URL**: facoltativi (lasciare vuoti)
- **Commercial / Non-Commercial**: `non-commercial`
- **Name / Company Name**: proprio nome o nickname
- **Purpose of Use**: `personal` / `hobby` (o `other`, evitando `professional` se per uso personale)

### 2. Dipendenze & Configurazione Android (`expo-web-browser`)
- Installare rigorosamente tramite Expo CLI:
  ```bash
  npx expo install expo-web-browser
  ```
- **Verifica Android 11+ `<queries>`**: in `android/app/src/main/AndroidManifest.xml`, la sezione `<queries>` attualmente dichiara solo `https`. Verificare (o aggiungere tramite prebuild / config plugin) l'intent query per Chrome Custom Tabs affinché `WebBrowser.openAuthSessionAsync` rilevi sempre il browser Custom Tabs su Android 11+:
  ```xml
  <intent>
    <action android:name="android.support.customtabs.action.CustomTabsService" />
  </intent>
  ```
- Lo scheme `kurotv` è già registrato in `app.json` e `AndroidManifest.xml` (`<data android:scheme="kurotv"/>`).

---

## 🗺️ Architettura Target (File da Creare / Aggiornare)

```text
src/
├── services/
│   ├── mal/
│   │   ├── index.ts          # Barrel export del modulo MAL
│   │   ├── types.ts          # Tipi OAuth, liste MAL (3 stati), settings, mapping, diff e coda
│   │   ├── config.ts         # Costanti endpoint MAL v2, redirect URI, lettura Client ID
│   │   ├── auth.ts           # PKCE plain, state CSRF, token exchange, refresh single-flight
│   │   ├── client.ts         # Client REST api.myanimelist.net/v2 (axios, paginazione, PATCH/DELETE)
│   │   ├── mapper.ts         # Cache bidirezionale malId <-> animeId, priorità locale & audio pref
│   │   └── sync.ts           # Calcolo max episodio completato, diff App → MAL, coda offline & auto-sync
│   ├── storage/
│   │   └── app-storage.ts    # Nuove chiavi StorageKeys.MAL_* (isolate da KuroSync & clearCache)
│   └── sync/
│       └── deep-link.ts      # Intercettazione kurotv://mal-callback per +native-intent.tsx
├── components/
│   ├── SelectionAppBar.tsx   # Nuova prop opzionale `rightActions` in modalità normale
│   └── mal/
│       ├── index.ts
│       ├── mal.styles.ts
│       ├── MalConnectCard.tsx      # Input guidato Client ID, copia redirect URI, login Custom Tab
│       ├── MalAnimeCard.tsx        # Card lista virtualizzata (poster, stato, ep, badge sync/match)
│       ├── MalSyncDiffModal.tsx    # Anteprima diff App → MAL editabile + selezione voci
│       ├── MalMatchPickerModal.tsx # Picker manuale/disambiguazione SUB vs ITA su AnimeWorld
│       ├── MalEntrySheet.tsx       # Bottom sheet touch-native in app/anime/[id] (PTW, ep, stato, voto)
│       └── MalSettingsModal.tsx    # Preferenze rapide (Client ID, auto-sync player, audio SUB/ITA, logout)
app/
├── mal/
│   └── index.tsx             # Schermata 3 tab MAL (IN CORSO / DA GUARDARE / COMPLETATI) + Sync
├── _layout.tsx               # Registrazione rotta `mal/index` + fallback callback + flush coda offline
├── (tabs)/
│   ├── favorites.tsx         # Pulsante `MAL` nell'header destro di SelectionAppBar
│   └── settings.tsx          # Riga categoria / stato rapido MyAnimeList
├── settings/
│   └── sync.tsx              # Card secondaria MyAnimeList sotto KuroSync (stato + apri /mal)
├── anime/
│   └── [id].tsx              # Badge stato MAL interattivo → apre MalEntrySheet
└── player/
    └── [id].tsx              # Hook opt-in auto-sync su completamento episodio (solo detail.malId)
```

---

## 🛠️ Piano Operativo Step-by-Step

### Step 0 — Dipendenze, Manifest & Storage MMKV Locale
**Obiettivo**: predisporre pacchetto browser OAuth, query Android e chiavi persistenti in MMKV isolate da KuroSync.

1. Installare `expo-web-browser` con `npx expo install expo-web-browser` e verificare in `android/app/src/main/AndroidManifest.xml` la presenza di `CustomTabsService` dentro `<queries>`.
2. Aggiungere in `src/services/storage/app-storage.ts` dentro `StorageKeys` le seguenti chiavi (tutte **escluse** da `sharedSettings` / `recordSyncMutation` di KuroSync e **protette** da `AppStorage.clearCache()`):
   - `MAL_CLIENT_ID: 'mal.clientId'` (stringa `Client ID` personale inserita dall'utente).
   - `MAL_AUTH_SESSION: 'mal.authSession'` (JSON: `accessToken`, `refreshToken`, `expiresAt`, `tokenType`, `username`, `userId`, `picture`).
   - `MAL_OAUTH_PENDING: 'mal.oauthPending'` (JSON temporaneo: `codeVerifier`, `state`, `clientId`, `createdAt`).
   - `MAL_SETTINGS: 'mal.settings'` (JSON: `{ autoSyncOnComplete: boolean; audioPreference: 'ask' | 'sub' | 'ita' }`, default `{ autoSyncOnComplete: false, audioPreference: 'ask' }`).
   - `MAL_ID_MAP: 'mal.idMap'` (cache bidirezionale persistente `animeId ↔ malId`, titoli, totale episodi, audio preferito).
   - `MAL_WATCHED_HIGHWATER: 'mal.watchedHighwater'` (mappa compatta `Record<string, number>` con l'ultimo `episodeNumber` intero completato per `animeId`, così `pruneOldProgress(200, 60)` non cancella mai lo storico utile a MAL).
   - `MAL_PENDING_UPDATES: 'mal.pendingUpdates'` (coda persistente offline per aggiornamenti auto-sync falliti per assenza rete).
   - `MAL_LIST_CACHE: 'mal.listCache'` (snapshot opzionale delle 3 liste per render immediato offline con TanStack `initialData`).
   - `MAL_LAST_SYNC_TIME: 'mal.lastSyncTime'`.
   - `MAL_IGNORED_ANIME_IDS: 'mal.ignoredAnimeIds'`.
3. Aggiornare `AppStorage.saveWatchProgress()` in modo da aggiornare `MAL_WATCHED_HIGHWATER` ogni volta che `progressItem.isCompleted === true` con `episodeNumber` intero positivo (senza generare mutazioni KuroSync).

**Criterio di verifica**: `npm run typecheck` passa e nessun import `node:*` è presente nel layer storage.

---

### Step 1 — Tipi, Autenticazione OAuth 2.0 PKCE & Deep-Link Routing (`src/services/mal/`)
**Obiettivo**: garantire autenticazione ufficiale MAL v2 senza `client_secret`, protezione CSRF e zero regressioni deep-link su Expo Router.

1. **`src/services/mal/types.ts`**:
   - Definire `MalListStatusValue = 'watching' | 'plan_to_watch' | 'completed'` (e `MalEditableStatus = MalListStatusValue | 'on_hold' | 'dropped'`).
   - Definire `MalAuthSession`, `MalSettings`, `MalUserProfile`, `MalAnimeListEntry` (con `score`, `watchedEpisodes`, `numEpisodes`, `mediaStatus`, `alternativeTitles`, `mean`, `mediaType`, `updatedAt`), `MalIdMappingEntry`, `MalSyncProposal`, `MalPendingUpdate`, `MalSyncApplyResult`.
2. **`src/services/mal/config.ts`**:
   - `MAL_OAUTH_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize'`
   - `MAL_OAUTH_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'`
   - `MAL_API_BASE_URL = 'https://api.myanimelist.net/v2'`
   - `MAL_REDIRECT_URI = 'kurotv://mal-callback'`
   - `getEffectiveMalClientId()`: legge prima `MAL_CLIENT_ID` salvato dall'utente in MMKV (trimmed, alfanumerico), con fallback su `process.env.EXPO_PUBLIC_MAL_CLIENT_ID` se presente.
3. **`src/services/mal/auth.ts`**:
   - Generatore puro TypeScript/Hermes-safe (usando `crypto.getRandomValues` se disponibile o fallback sicuro) per `codeVerifier` (64–96 caratteri nell'alfabeto `[A-Za-z0-9\-._~]`) e `state` casuale (32 caratteri), zero `node:crypto`.
   - Costruzione URL OAuth con `response_type=code`, `client_id`, `state`, `redirect_uri=kurotv://mal-callback`, `code_challenge=codeVerifier`, `code_challenge_method=plain` (obbligatorio su MAL API v2, che rifiuta `S256`).
   - Salvataggio atomico in `MAL_OAUTH_PENDING` prima di aprire `WebBrowser.openAuthSessionAsync(url, MAL_REDIRECT_URI)`.
   - Scambio codice → token (`POST /v1/oauth2/token` in `application/x-www-form-urlencoded` con `grant_type=authorization_code`, `client_id`, `code`, `code_verifier`, `redirect_uri` — senza `client_secret`).
   - **Verifica CSRF & Idempotenza**: validare che `state` corrisponda esattamente a `MAL_OAUTH_PENDING.state` (rifiutando stati assenti o errati) ed eliminare subito `MAL_OAUTH_PENDING` prima dello scambio per rendere idempotente l'eventuale doppio evento tra `openAuthSessionAsync` e `Linking`.
   - **`getValidAccessToken()`**: se `Date.now() < session.expiresAt - 60_000` restituisce il token corrente; altrimenti esegue `grant_type=refresh_token` in modo serializzato (**single-flight promise**) usando il `clientId` salvato.
   - **Resilienza offline (regola #8 `AGENTS.md`)**: errori di rete/DNS/timeout/5xx **non** cancellano `MAL_AUTH_SESSION`; il logout locale avviene solo su HTTP `401`/`403` o `invalid_grant` esplicito in fase di refresh, oppure su disconnessione manuale confermata con `ConfirmModal`.
4. **Fix Deep-Link in `src/services/sync/deep-link.ts` e `app/_layout.tsx`**:
   - Aggiungere `isMalAuthCallbackDeepLink(rawUrl)` (match su `kurotv://mal-callback` / `/mal-callback`) in `deep-link.ts` e gestirlo in `resolveSystemDeepLinkPath`: restituisce `'/'` su `initial: true` e `null` su `initial: false`, impedendo la rotta `+not-found`.
   - In `app/_layout.tsx`, intercettare `isMalAuthCallbackDeepLink(trimmedUrl)` dentro `processDeepLink` e inoltrare l'URL a `MalAuthService.handleCallbackUrl(trimmedUrl)` come fallback nel caso il browser Android non rientri tramite `openAuthSessionAsync`.

**Criterio di verifica**: test unitari su PKCE `plain`, validazione `state` CSRF, gestione `kurotv://mal-callback` in `resolveSystemDeepLinkPath`, single-flight refresh e preservazione sessione su errori di rete.

---

### Step 2 — Client REST MyAnimeList API v2 (`src/services/mal/client.ts`)
**Obiettivo**: incapsulare tutte le chiamate HTTP verso `api.myanimelist.net/v2` tramite `axios` con gestione corretta dei campi API, paginazione e rate limit.

1. **`getCurrentUser()`**: `GET /users/@me?fields=id,name,picture`.
2. **`fetchUserAnimeList(status: 'watching' | 'plan_to_watch' | 'completed')`**:
   - Endpoint:
     `GET /users/@me/animelist?status=${status}&limit=1000&sort=list_updated_at&nsfw=true&fields=list_status,num_episodes,alternative_titles,media_type,status,main_picture,mean`
   - Nota sui nomi dei campi MAL API v2: la risposta `list_status` restituisce `num_episodes_watched` (lettura), mentre le chiamate di scrittura `PATCH` inviano `num_watched_episodes`.
   - Scorrere automaticamente `response.data.paging?.next` con tetto di sicurezza pagine (es. max 20 pagine = 20.000 voci) e deduplicazione per `node.id`.
   - Salvare lo snapshot normalizzato in `MAL_LIST_CACHE` per fruizione offline istantanea.
3. **`getAnimeUserStatus(malId: number)`**:
   - `GET /anime/${malId}?fields=id,title,num_episodes,status,my_list_status,main_picture,mean,media_type` per leggere lo stato aggiornato nella scheda dettagli `app/anime/[id].tsx`.
4. **`updateAnimeListStatus(malId: number, payload)`**:
   - `PATCH /anime/${malId}/my_list_status` con `Authorization: Bearer <token>` e body `application/x-www-form-urlencoded`:
     - `status` (opzionale): `'watching' | 'plan_to_watch' | 'completed' | 'on_hold' | 'dropped'`
     - `num_watched_episodes` (opzionale, intero $\ge 0$)
     - `score` (opzionale, intero `0..10`)
   - Retry singolo su `401` con refresh forzato del token; propagazione chiara su `429` / `5xx` / errori di rete.
5. **`deleteAnimeListEntry(malId: number)`**:
   - `DELETE /anime/${malId}/my_list_status` per consentire la rimozione dalla propria lista MAL tramite `MalEntrySheet` (protetto da `ConfirmModal`).

**Criterio di verifica**: test unitari su normalizzazione `list_status.num_episodes_watched`, paginazione `paging.next` e serializzazione `x-www-form-urlencoded` per `PATCH`.

---

### Step 3 — Cache Mapping Bidirezionale `malId ↔ animeId` & Risoluzione `SUB`/`ITA` (`src/services/mal/mapper.ts`)
**Obiettivo**: associare gli slug AnimeWorld (`animeId`) agli ID MyAnimeList (`malId`) senza scraping massivo e rispettando le preferenze `SUB`/`ITA`.

1. **Struttura cache `mal.idMap` in MMKV**:
   - `byAnimeId: Record<string, { animeId: string; malId: number; title: string; totalEpisodes?: number | null; isCompletedSeries?: boolean; audio?: 'sub' | 'ita'; updatedAt: number }>`
   - `byMalId: Record<number, { malId: number; primaryAnimeId: string; candidateAnimeIds: string[]; title: string; updatedAt: number }>`
2. **Popolamento passivo sicuro (solo `detail.malId`)**:
   - Esportare `recordAnimeMalMapping(detail: AnimeDetail)` e invocarlo in `AnimeWorldScraper.getAnimeDetail` / `app/anime/[id].tsx` / `app/player/[id].tsx` esclusivamente quando `typeof detail.malId === 'number' && detail.malId > 0`. (**Mai usare `detail.anilistId`**).
3. **Risoluzione `animeId → malId` (per diff `App → MAL`)**:
   - Leggere prima `mal.idMap.byAnimeId[animeId]`.
   - Per i soli anime guardati in locale privi di entry in `mal.idMap`, interrogare `AnimeWorldScraper.getAnimeDetail(animeId)` con concorrenza limitata a 2 richieste alla volta e salvare il risultato in `mal.idMap`.
   - Se una scheda AnimeWorld non espone `#mal-button` (`malId` assente), mostrarla nel modale diff nella sezione informativa **"Non associati a MAL"** (con link rapido a ricerca/associazione manuale), evitando errori silenziosi.
4. **Risoluzione `malId → animeId` on-demand (al tap su una card in `/mal`)**:
   - Se `mal.idMap.byMalId[malId]?.primaryAnimeId` esiste → apri direttamente `/anime/[id]`.
   - Altrimenti, al tap sulla card:
     1. Verifica se uno degli anime già in `WATCH_HISTORY`, `CONTINUE_WATCHING` o `FAVORITES` corrisponde al `malId` in `byAnimeId`: se sì, selezionalo subito con priorità assoluta.
     2. Altrimenti cerca su AnimeWorld con `AnimeWorldScraper.searchAnime(entry.title)` (e fallback su `alternativeTitles.en` o `alternativeTitles.ja` se la prima ricerca restituisce 0 risultati).
     3. Ordina i candidati per similarità normalizzata del titolo e verifica i primi **4–5 candidati** via `AnimeWorldScraper.getAnimeDetail(cand.id)` confrontando `detail.malId === malId`.
     4. **Esito univoco** (1 match esatto per `malId`) → salva in `mal.idMap` e apri `/anime/[id]`.
     5. **Esito multiplo** (`SUB` + `ITA` con lo stesso `malId`):
        - Se `mal.settings.audioPreference === 'sub'` o `'ita'`, identifica automaticamente il candidato corrispondente (`!title.includes('(ita)')` / `detail.audio` vs `ITA`) e salvalo in `mal.idMap`;
        - Se `audioPreference === 'ask'` (default) o ambiguo, apri `MalMatchPickerModal` per scegliere `SUB` vs `ITA` salvando la scelta in `primaryAnimeId`.
     6. **Nessun match automatico per `malId`** → apri `MalMatchPickerModal` pre-popolato con i risultati testuali (e campo ricerca manuale `defaultValue`) per associare manualmente lo slug.
   - **Cambio associazione manuale**: long-press su una card in `/mal` consente di cambiare o resettare lo slug AnimeWorld associato a quel `malId` tramite `MalMatchPickerModal`.

**Criterio di verifica**: test unitari su priorità cronologia/preferiti, applicazione `audioPreference` (`ask`/`sub`/`ita`), normalizzazione titoli e rifiuto di `anilistId`.

---

### Step 4 — Motore di Diff, `Plan to Watch`, Non-Regressione & Auto-Sync Opt-In (`src/services/mal/sync.ts`)
**Obiettivo**: calcolare con esattezza matematica gli episodi visti, gestire la promozione da `plan_to_watch` senza mai retrocedere né sporcare MAL e supportare la coda offline per l'auto-sync.

1. **Raccolta progressi locali per singolo `animeId`**:
   - Aggregare tre fonti locali in sola lettura: `AppStorage.getAllWatchProgress()`, `AppStorage.getWatchHistory()`, `AppStorage.getContinueWatching()` (solo elementi con `isCaughtUp === true`, che rappresentano l'ultimo episodio completato), più il registro persistente `MAL_WATCHED_HIGHWATER`.
   - **Regola anti-off-by-one & episodi speciali**: considerare **esclusivamente** episodi con `isCompleted === true` (o `percentage >= 90`) e numero intero positivo (`Number.isInteger(ep) && ep > 0`, escludendo `Ep. 0` o recap `.5`). Calcolare `watchedEpisodesCount = Math.max(...completedEpisodeNumbers)` con clamping `<= malTotalEpisodes` (se noto e `> 0`).
   - Serie iniziate con `watchedEpisodesCount === 0` (es. visti solo 10 secondi dell'episodio 1) vengono escluse automaticamente dalle proposte per non sporcare MAL.
2. **Normalizzazione totale episodi & regola `completed`**:
   - Estrarre `knownTotalEpisodes = malEntry?.numEpisodes || parsePositiveTotalEpisodes(mapping?.totalEpisodes)`.
   - Una serie va proposta come **`completed`** solo se:
     - `knownTotalEpisodes > 0`, **E**
     - `watchedEpisodesCount >= knownTotalEpisodes`, **E**
     - su MAL la serie non è `currently_airing` (`malEntry?.mediaStatus !== 'currently_airing'`, e se `malEntry` è assente, `!mapping?.isOngoingSeries`).
   - Altrimenti (`watchedEpisodesCount >= 1`) → `targetStatus = 'watching'`, `targetEpisodes = watchedEpisodesCount`.
3. **Confronto non regressivo contro `watching` + `plan_to_watch` + `completed`**:
   - Costruire mappa `malById` unendo tutte e 3 le liste scaricate da MAL.
   - Per ciascun anime locale con `malId` noto e non presente in `MAL_IGNORED_ANIME_IDS`:
     - Se su MAL è **`completed`**: **nessuna proposta** (mai retrocedere da `completed`).
     - Se su MAL è **`plan_to_watch`**: proporre sempre promozione (`plan_to_watch → targetStatus`, `targetEpisodes` episodi) purché `watchedEpisodesCount >= 1`.
     - Se su MAL è **`watching`**:
       - Se `targetStatus === 'completed'` → proponi (`watching → completed`, `targetEpisodes`).
       - Else if `targetEpisodes > malEntry.watchedEpisodes` → proponi (`Ep mal → Ep app`).
       - Else → già allineato o più avanti su MAL, nessuna azione.
     - Se **non presente** nelle 3 liste su MAL → proponi aggiunta con `targetStatus` e `targetEpisodes`.
     - *(Nota sui casi multi-slug SUB/ITA verso lo stesso `malId`)*: se l'utente ha guardato sia versione SUB che ITA dello stesso `malId`, accorpare prendendo il massimo tra i progressi per evitare proposte duplicate sullo stesso `malId`.
4. **Esecuzione manuale & Coda Offline Auto-Sync**:
   - `applyAppToMalProposals(proposals)`: invia le `PATCH` con concorrenza 2 e piccolo delay anti-`429`, aggiorna la cache TanStack + `MAL_LIST_CACHE` + `MAL_LAST_SYNC_TIME`, e rimuove eventuali voci già soddisfatte da `MAL_PENDING_UPDATES`.
   - `enqueueOrAutoSyncEpisode({ animeId, malId, episodeNumber, totalEpisodes, isOngoingSeries })`: invocato da `app/player/[id].tsx` **solo** se `malSettings.autoSyncOnComplete === true`, utente connesso, `malId > 0`, `episodeNumber` intero positivo, e solo una volta per `(malId, episodeNumber)` (deduplica in memoria + verifica non-regressiva contro `MAL_LIST_CACHE`). Se la richiesta fallisce per rete/timeout/`429`/`5xx`, salva in `MAL_PENDING_UPDATES` per il flush automatico al ritorno online/active in `app/_layout.tsx`.

**Criterio di verifica**: test unitari completi su off-by-one (`ContinueWatching` su Ep 4 a `0:00` → propone `3`), `isCaughtUp` (`Ep 12 • IN PARI` → propone `12`), promozione `plan_to_watch → watching / completed`, protezione contro `currently_airing`, consolidamento duplicati `SUB+ITA` su stesso `malId`, protezione anti-pruning tramite `MAL_WATCHED_HIGHWATER`, ed enqueue offline su fallimento rete.

---

### Step 5 — UI Touch-Native: Schermata 3 Liste MAL, Diff Modal & Entry Sheet (`src/components/mal/` & `app/mal/index.tsx`)
**Obiettivo**: offrire un'interfaccia OLED fluida a 60/120 FPS per sfogliare `IN CORSO`, `DA GUARDARE` e `COMPLETATI`, avviare AnimeWorld e gestire manualmente singoli anime o batch sync.

1. **Schermata `app/mal/index.tsx`** (registrata in `app/_layout.tsx` nello `<Stack>` con `animation: 'slide_from_right'`):
   - **Header (`60dp`)**: freccia indietro (`router.canGoBack() ? router.back() : router.replace('/(tabs)')`), titolo `MYANIMELIST`, username/avatar compatto, pulsante ingranaggio (`MalSettingsModal`) e pulsante **`SINCRONIZZA`** (con badge conteggio proposte pronte da `computeAppToMalDiff()`).
   - **Stato disconnesso (`MalConnectCard`)**: guida chiara per ottenere il `Client ID` da `myanimelist.net/apiconfig` (con toggle rapido per espandere le istruzioni campo-per-campo e tasto `COPIA REDIRECT URI: kurotv://mal-callback`), `TextInput` non controllato per incollare il `Client ID` (validazione immediata) e pulsante $\ge 44\text{ dp}$ `CONNETTI MYANIMELIST`.
   - **Stato connesso**:
     - **3 Segmented Tabs**: `IN CORSO (N)` | `DA GUARDARE (P)` | `COMPLETATI (M)` (`minHeight: 44dp`, contrasto YIQ dinamico con `getContrastTextColor(theme.colors.primary)`).
     - **Barra di filtro locale + chip ordinamento**: `TextInput` non controllato (`defaultValue`, `key={inputKey}`, zero re-render per battitura come da regola #9 `AGENTS.md`) per filtrare su titolo e titoli alternativi, affiancato da chip compatto ciclo ordinamento (`RECENTI` / `A-Z` / `VOTO`).
     - **Lista virtualizzata `@shopify/flash-list` v2**: renderizza `MalAnimeCard` (poster `expo-image` `cachePolicy="memory-disk"`, titolo monospace, chip progresso `EP. X / Y`, voto eventuale `★ 8`, stato mapping `PRONTO` o `+N EP DA INVIARE`).
     - **Loading iniziale**: `Skeleton` OLED (`#161616`) senza CLS; `RefreshControl` per ricaricare le liste (e svuotare eventuale `MAL_PENDING_UPDATES`).
     - **Tap sulla card**: avvia `resolveMalToAnimeWorld(entry)` con spinner discreto sulla card; **Long-press**: apre `MalMatchPickerModal` per cambiare manualmente associazione `SUB`/`ITA`.
     - **`hardwareBackPress`**: gestito tramite `useFocusEffect` (chiude ricerca/modali aperti, altrimenti torna indietro).
2. **`MalSyncDiffModal.tsx`**:
   - Modale custom touch-safe (`Modal` `transparent`, `statusBarTranslucent`, `animationType="fade"`, `useBottomSheetDragDismiss` doppia zona).
   - Mostra le proposte `App → MAL` (evidenziando promozioni `DA GUARDARE → IN CORSO`, avanzamenti episodi e completamenti `→ COMPLETATI`), toggle touch per escludere/includere voci o ignorare permanentemente un titolo (`MAL_IGNORED_ANIME_IDS`), eventuale sezione separata per serie locali senza `#mal-button`, e conferma protetta da `ConfirmModal`.
3. **`MalEntrySheet.tsx` (per la scheda Anime `app/anime/[id].tsx`)**:
   - Modale custom touch-safe con `useBottomSheetDragDismiss` per modificare al volo il singolo anime su MAL:
     - Selettore rapido stato (`IN CORSO`, `DA GUARDARE`, `COMPLETATI`, `IN PAUSA`, `ABBANDONATO`);
     - Stepper episodi `−` / `+` + pulsante diretto **`ALLINEA DA APP (EP. X)`** se i progressi locali sono disponibili;
     - Selettore voto `1–10` (opzionale con tap singolo o clear);
     - Bottone `SALVA SU MAL` e azione secondaria `RIMUOVI DA LISTA MAL` protetta da `ConfirmModal`.
4. **`MalMatchPickerModal.tsx` & `MalSettingsModal.tsx`**:
   - `MalMatchPickerModal`: disambiguazione `SUB` / `ITA` e ricerca manuale AnimeWorld (`defaultValue`, zero `Alert.alert`).
   - `MalSettingsModal`: modifica `Client ID`, switch `AUTO-SYNC AL COMPLETAMENTO` (`OFF` di default), selettore preferenza audio (`CHIEDI` / `SUB` / `ITA`), e `DISCONNETTI ACCOUNT` protetto da `ConfirmModal`.
5. **Foglio stili dedicato**: `src/components/mal/mal.styles.ts`.

**Criterio di verifica**: zero import `Alert` o `@expo/ui`, zero `TextInput` controllati, liste su `@shopify/flash-list` v2, tutti i controlli $\ge 44\times 44\text{ dp}$.

---

### Step 6 — Punti di Ingresso in App, Preferiti Header & Hook Player
**Obiettivo**: integrare il punto di ingresso MAL senza affollare `HomeAppBar` o la bottom tab bar, collegare le impostazioni e attivare l'hook opt-in nel player.

1. **`SelectionAppBar.tsx` & `app/(tabs)/favorites.tsx`**:
   - Aggiungere prop opzionale `rightActions?: React.ReactNode` a `SelectionAppBar` (renderizzata a destra del titolo quando `selectedCount === 0`).
   - In `app/(tabs)/favorites.tsx`, passare tramite `rightActions` il pulsante touch-native **`MAL`** (`minWidth: 44, minHeight: 44`, icona `assets/icons/myanimelist.svg` + label `MAL` e piccolo pallino verde se connesso) che naviga a `/mal`. Su qualsiasi smartphone (inclusi 320–360 dp) rimane ampio spazio tra `I MIEI PREFERITI` e il tasto `MAL`, e in modalità selezione multipla sparisce lasciando spazio a `SELEZIONA TUTTI` + `CESTINO`.
2. **Impostazioni (`app/(tabs)/settings.tsx` e `app/settings/sync.tsx`)**:
   - In `app/(tabs)/settings.tsx` (sotto `SINCRONIA`, oppure aggiornando il sottotitolo/sezione): aggiungere accesso rapido o card dedicata per raggiungere `/mal`.
   - In `app/settings/sync.tsx`: aggiungere sotto `SyncSettingsCard` una card compatta **`MYANIMELIST`** completamente separata da **KuroSync**, con stato (`CONNESSO • @username` / `NON CONNESSO`), riepilogo auto-sync (`ON`/`OFF`) e pulsante `APRI LISTE MAL`.
3. **Scheda Dettagli Anime (`app/anime/[id].tsx`)**:
   - Quando `anime.malId` è valido:
     - Mostrare sopra/vicino a `AnimeInfoTable` (o nella barra azioni) un pill compatto **`STATO MAL`**: se MAL è connesso mostra es. `MAL: DA GUARDARE`, `MAL: IN CORSO • EP. 4/12`, `MAL: COMPLETATO`, oppure `MAL: AGGIUNGI A LISTA`; al tap apre `MalEntrySheet`.
     - Il pulsante `MAL` dentro `AnimeInfoTable.tsx` resta invariato per aprire la pagina web su `myanimelist.net`.
4. **Hook Opt-In Player (`app/player/[id].tsx`)**:
   - Aggiornare `loadMetadataAndAniSkip` in `app/player/[id].tsx` per invocare `recordAnimeMalMapping(detail)` solo quando `detail.malId` è valido.
   - In `saveProgress()`, leggere il risultato restituito da `AppStorage.saveWatchProgress(...)`: se `savedItem?.isCompleted === true` e `detail.malId` (memorizzato in un `pureMalIdRef` separato da `anilistId`) è presente, invocare `MalSync.maybeAutoSyncOnEpisodeComplete(...)` (che non fa nulla se il toggle opt-in è `OFF`, e deduplica per `(malId, episodeNumber)` evitando chiamate ripetute durante gli ultimi minuti dell'episodio).
5. **Flush Coda Offline (`app/_layout.tsx`)**:
   - All'evento `AppState === 'active'`, se MAL è connesso ed esistono voci in `MAL_PENDING_UPDATES`, eseguire un flush leggero in background (senza mai forzare auto-logout su errori di rete).

**Criterio di verifica**: nessuna collisione visiva su display 320 dp in `HomeAppBar` o `FavoritesScreen`, nessun reset della ricerca in Home, nessuna mutazione su `KuroSync` al salvataggio token/dati MAL.

---

### Step 7 — Verifica Tecnica, Test & Checklist Finale
**Obiettivo**: validare correttezza funzionale, compatibilità Hermes e conformità alle regole di `AGENTS.md`.

1. **Test automatici in `tests/core-verification.test.ts`**:
   - PKCE `plain` (`[A-Za-z0-9-._~]`, 43–128 char), verifica `state` CSRF, non-cancellazione sessione su errori di rete/timeout/5xx.
   - Deep-link `resolveSystemDeepLinkPath` per `kurotv://mal-callback?code=...&state=...` (ritorno `/` su cold start, `null` su warm start).
   - Calcolo `watchedEpisodesCount`: `ContinueWatching` su Ep 4 a `0:00` → `3`; `isCaughtUp` su Ep 12 → `12`; pruning oltre 60 giorni compensato da `MAL_WATCHED_HIGHWATER`; esclusione episodi `0` / `13.5` / `percentage < 90` non completati.
   - Regole di diff & `plan_to_watch`: promozione `plan_to_watch → watching / completed`, blocco `completed` se serie `currently_airing`, consolidamento duplicati `SUB + ITA` sullo stesso `malId`, nessuna regressione su `completed` o `E_mal >= E_app`.
   - Risoluzione `malId → animeId`: priorità cronologia/preferiti, preferenza `audioPreference` (`ask`/`sub`/`ita`), rifiuto categorico di `anilistId`.
   - Verifiche statiche sui nuovi file: `@shopify/flash-list`, assenza `Alert.alert`, assenza `@expo/ui`, assenza `node:*`, `useFocusEffect` + `BackHandler`, `defaultValue` sui `TextInput` di ricerca, assenza chiavi MAL in `sharedSettings`.
2. **Comandi di validazione**:
   ```bash
   npm test
   npm run lint
   npx expo export --platform android
   ```
3. **Checklist test manuale su dispositivo Android (incluso schermo stretto ~360 dp)**:
   - Compilazione `Client ID` su `myanimelist.net/apiconfig` con `App Type: Android`/`other` e `kurotv://mal-callback`, inserimento in-app e login Custom Tab.
   - Verifica layout pulsante `MAL` nell'header di `Preferiti` su display stretto e durante selezione multipla.
   - Navigazione delle 3 tab `IN CORSO`, `DA GUARDARE`, `COMPLETATI`, filtro ricerca con tastiera Android IME e apertura scheda `SUB`/`ITA`.
   - Da scheda anime: aggiunta in `Plan to Watch`, cambio stato, voto `1–10`, e promozione automatica nel diff dopo visione episodio.
   - Verifica toggle opt-in auto-sync in player (con verifica coda offline in modalità aereo e invio al ripristino rete).

---

## ⚠️ Rischi Noti e Mitigazioni

| Rischio | Impatto | Mitigazione nel Piano |
|---|---|---|
| Utente seleziona `App Type: web` sul form MAL | Generazione `Client Secret` incompatibile con app pubblica | Guida esplicita in `MalConnectCard` a scegliere `Android` / `other` e copia 1-tap di `kurotv://mal-callback` |
| AnimeWorld priva di `#mal-button` o uso errato di `anilistId` | Match assente o ID sbagliato su MAL | Divieto di fallback su `anilistId`, segnalazione esplicita nel diff e associazione manuale persistente in `mal.idMap` |
| Schede `SUB` e `ITA` separate con stesso `malId` | Apertura versione sbagliata o proposte duplicate | Priorità a cronologia/preferiti + preferenza audio (`Ask`/`SUB`/`ITA`) + accorpamento progressi per `malId` nel diff |
| `pruneOldProgress` (60gg) o `WATCH_HISTORY` (100 item) | Perdita conteggio episodi vecchi in `App → MAL` | Registro persistente compatto `MAL_WATCHED_HIGHWATER` + calcolo basato su `max` episodio completato |
| Serie in corso su MAL (`currently_airing`) | Marcatura prematura come `completed` | Controllo `mediaStatus !== 'currently_airing'` prima di proporre `completed` |
| Chiamate ripetute durante auto-sync player | Rate-limit HTTP `429` su MAL | Deduplica per `(malId, episodeNumber)` nella sessione + coda offline persistente `MAL_PENDING_UPDATES` |
