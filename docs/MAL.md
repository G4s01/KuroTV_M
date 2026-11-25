# 📘 Piano di Implementazione — Integrazione MyAnimeList (MAL)

Questo documento definisce il piano operativo a step per integrare **MyAnimeList API v2** in **Kuro Mobile** (Expo SDK 58 / React Native 0.88.1) con due obiettivi precisi:

1. **Sincronizzazione manuale unidirezionale `App → MAL`**: inviare a MyAnimeList gli anime guardati e completati nell'app senza mai alterare o sovrascrivere lo stato locale (`CONTINUE_WATCHING`, `WATCH_HISTORY`, `WATCH_PROGRESS`) né generare conflitti con KuroSync.
2. **Consultazione e riproduzione delle liste MAL**: visualizzare all'interno dell'app i propri titoli salvati su MyAnimeList come **In corso (`watching`)** e **Completati (`completed`)**, potendo aprire qualsiasi scheda su AnimeWorld e avviare la riproduzione con un tap.

> [!IMPORTANT]
> Ogni step deve rispettare integralmente le regole architetturali di [`AGENTS.md`](../AGENTS.md): nessuna dipendenza `node:*` nel bundle Hermes, lista virtualizzata con `@shopify/flash-list`, nessun `Alert.alert` (solo `ConfirmModal`), `TextInput` non controllati (`defaultValue`) per campi di ricerca, modali touch-native senza `@expo/ui`, fogli di stile separati (`*.styles.ts`) e gestione `hardwareBackPress` tramite `useFocusEffect`.

---

## 🎯 Perimetro Funzionale (Incluso vs Escluso)

| Funzionalità | Stato | Note |
|---|---|---|
| Login OAuth 2.0 PKCE su MyAnimeList | **Incluso** | Client pubblico Android (`plain` PKCE) + Chrome Custom Tab |
| Lettura liste MAL `watching` e `completed` | **Incluso** | Con paginazione, cache TanStack Query e ricerca locale |
| Apertura/riproduzione di titoli dalle liste MAL | **Incluso** | Risoluzione `malId → animeId` su AnimeWorld on-demand + disambiguazione SUB/ITA |
| Sincronizzazione manuale `App → MAL` (batch + singolo anime) | **Incluso** | Anteprima diff e conferma utente prima di inviare `PATCH` a MAL |
| Importazione `MAL → App` / sovrascrittura cronologia locale | **Escluso** | Sincronizzazione strettamente unidirezionale `App → MAL` |
| Sincronizzazione automatica silenziosa in background | **Escluso** | Solo manuale su iniziativa esplicita dell'utente |
| Scrittura su liste `plan_to_watch`, `on_hold`, `dropped` | **Escluso** | Fuori perimetro (solo `watching` e `completed`) |

---

## 📦 Prerequisiti & Configurazione Ambiente

- **Expo SDK**: v58 (`~58.0.25`), progetto Android con directory nativa `android/` (prebuild).
- **Registrazione App su MyAnimeList**:
  1. Accedere a `https://myanimelist.net/apiconfig` e creare un client API.
  2. Impostare **App Type** su `Android` (oppure `Other` pubblico senza `client_secret`).
  3. Registrare l'**App Redirect URL**: `kurotv://mal-callback` (lo scheme `kurotv` è già configurato in `app.json`).
  4. Annotare il `Client ID` generato ed esporlo tramite variabile d'ambiente `EXPO_PUBLIC_MAL_CLIENT_ID` (con supporto opzionale a override in-app o fallback di configurazione).
- **Nuova dipendenza Expo** (da installare rigorosamente con Expo CLI):
  ```bash
  npx expo install expo-web-browser
  ```
  *Motivazione*: apre il flusso OAuth in Chrome Custom Tabs restando contestuali all'app e gestendo il rientro su `kurotv://mal-callback` senza uscire completamente dal task Android.

---

## 🗺️ Architettura Target (File da Creare / Aggiornare)

```text
src/
├── services/
│   ├── mal/
│   │   ├── index.ts          # Barrel export del modulo MAL
│   │   ├── types.ts          # Tipi OAuth, liste MAL, mapping e diff App → MAL
│   │   ├── config.ts         # Costanti endpoint MAL, redirect URI, client ID
│   │   ├── auth.ts           # PKCE plain, OAuth session, refresh token, stato connessione
│   │   ├── client.ts         # Chiamate REST api.myanimelist.net/v2 (axios)
│   │   ├── mapper.ts         # Cache bidirezionale malId <-> animeId & lookup on-demand
│   │   └── sync.ts           # Calcolo episodi completati locali, diff e push App → MAL
│   └── storage/
│       └── app-storage.ts    # Nuove chiavi StorageKeys.MAL_* e helper lettura/scrittura
├── components/
│   └── mal/
│       ├── index.ts
│       ├── mal.styles.ts
│       ├── MalConnectCard.tsx      # Stato account MAL, login/logout, pulsante sync
│       ├── MalAnimeCard.tsx        # Card riga lista MAL (poster, progresso, badge sync)
│       ├── MalSyncDiffModal.tsx    # Anteprima diff App → MAL con selezione e conferma
│       └── MalMatchPickerModal.tsx # Scelta manuale slug AnimeWorld (SUB/ITA o omonimi)
app/
├── mal/
│   └── index.tsx             # Schermata principale liste MAL (IN CORSO / COMPLETATI + Sync)
├── _layout.tsx               # Registrazione rotta `mal/index` + gestione callback OAuth
├── (tabs)/
│   ├── _layout.tsx           # Accesso rapido dal modale Profilo (opzionale)
│   └── settings.tsx          # Voce MyAnimeList nella schermata Impostazioni
├── settings/
│   └── sync.tsx              # Collegamento / card rapida MAL accanto a KuroSync
└── anime/
    └── [id].tsx              # Badge stato MAL + aggiornamento manuale singola serie
```

---

## 🛠️ Piano Operativo Step-by-Step

### Step 0 — Dipendenze e Chiavi Storage in MMKV
**Obiettivo**: preparare l'infrastruttura di configurazione e persistenza locale senza introdurre cicli né moduli `node:*`.

1. Installare `expo-web-browser` con:
   ```bash
   npx expo install expo-web-browser
   ```
2. Aggiungere in `src/services/storage/app-storage.ts` le nuove chiavi dentro `StorageKeys`:
   - `MAL_AUTH_SESSION: 'mal.authSession'` (JSON: `accessToken`, `refreshToken`, `expiresAt`, `tokenType`, `username`, `userId`, `picture`).
   - `MAL_OAUTH_PENDING: 'mal.oauthPending'` (JSON temporaneo: `codeVerifier`, `state`, `createdAt` per il callback deep-link).
   - `MAL_ID_MAP: 'mal.idMap'` (cache persistente `animeId <-> malId`, titoli e conteggio episodi).
   - `MAL_LAST_SYNC_TIME: 'mal.lastSyncTime'`.
   - `MAL_IGNORED_ANIME_IDS: 'mal.ignoredAnimeIds'` (elenco opzionale di `animeId` che l'utente sceglie di non proporre più nel diff `App → MAL`).
3. **Regola KuroSync**: non inserire `MAL_AUTH_SESSION` in `sharedSettings` di KuroSync (`src/services/sync/`), perché i token OAuth MAL devono restare isolati per singolo dispositivo per evitare invalidazioni incrociate del `refresh_token`.

**Criterio di verifica**: `npm run typecheck` passa e nessun import `node:*` è presente nel layer storage.

---

### Step 1 — Tipi, Autenticazione OAuth 2.0 PKCE & Gestione Sessione (`src/services/mal/`)
**Obiettivo**: implementare autenticazione sicura su MyAnimeList v2, persistente offline e immune a CSRF su deep-link.

1. **`src/services/mal/types.ts`**:
   - Definire `MalAuthSession`, `MalUserProfile`, `MalListStatusValue` (`'watching' | 'completed'`), `MalAnimeNode`, `MalAnimeListEntry`, `MalIdMappingEntry`, `MalSyncProposal`, `MalSyncApplyResult`.
2. **`src/services/mal/config.ts`**:
   - `MAL_OAUTH_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize'`
   - `MAL_OAUTH_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'`
   - `MAL_API_BASE_URL = 'https://api.myanimelist.net/v2'`
   - `MAL_REDIRECT_URI = 'kurotv://mal-callback'`
   - `getMalClientId()`: legge `process.env.EXPO_PUBLIC_MAL_CLIENT_ID` (eventualmente integrabile con override locale se utile per test).
3. **`src/services/mal/auth.ts`**:
   - Generatore puro TypeScript/Hermes-safe di `codeVerifier` (64–96 caratteri `[A-Za-z0-9\-._~]`) e `state` casuale (32 caratteri), senza `node:crypto`.
   - Costruzione URL OAuth con `response_type=code`, `client_id`, `state`, `redirect_uri=kurotv://mal-callback`, `code_challenge=codeVerifier`, `code_challenge_method=plain`.
   - Salvataggio temporaneo in `MAL_OAUTH_PENDING` prima di aprire `WebBrowser.openAuthSessionAsync(url, MAL_REDIRECT_URI)`.
   - Scambio codice → token (`POST /v1/oauth2/token` in `application/x-www-form-urlencoded` con `grant_type=authorization_code`, `client_id`, `code`, `code_verifier`, `redirect_uri`).
   - Verifica rigorosa dello `state` ricevuto rispetto a `MAL_OAUTH_PENDING.state` (protezione CSRF; se mancante o diverso, annullare il flusso con errore esplicito).
   - Supporto fallback in `app/_layout.tsx` nel listener `Linking` per `kurotv://mal-callback` nel caso in cui il browser Android restituisca il callback fuori da `openAuthSessionAsync`, validando sempre `state` contro `MAL_OAUTH_PENDING`.
   - `getValidAccessToken()`: se `Date.now() < session.expiresAt - 60_000` restituisce il token corrente; altrimenti esegue `refresh_token` in modo serializzato (single-flight promise per evitare refresh paralleli simultanei).
   - **Gestione errori offline (regola #8 `AGENTS.md`)**: errori di rete/timeout/DNS/5xx **non** cancellano `MAL_AUTH_SESSION`; il logout locale avviene solo su `401`/`403` o `invalid_grant` esplicito in fase di refresh, oppure su logout manuale confermato con `ConfirmModal`.

**Criterio di verifica**: test unitari su generazione PKCE `plain` (`[A-Za-z0-9-._~]`, lunghezza valida 43–128), validazione `state` CSRF, e non-cancellazione della sessione su errori di rete simulati.

---

### Step 2 — Client REST MyAnimeList API v2 (`src/services/mal/client.ts`)
**Obiettivo**: incapsulare tutte le comunicazioni HTTP con MAL v2 tramite `axios` e gestione paginazione/errori.

1. **`getCurrentUser()`**: `GET /users/@me?fields=id,name,picture` per salvare username e avatar nel profilo locale.
2. **`fetchUserAnimeList(status: 'watching' | 'completed')`**:
   - Chiamata iniziale:
     `GET /users/@me/animelist?status=${status}&limit=1000&sort=list_updated_at&nsfw=true&fields=list_status,num_episodes,alternative_titles,media_type,status,main_picture`
   - Scorrere automaticamente `response.data.paging?.next` fino a esaurimento delle pagine (proteggendo da loop con un limite massimo di pagine e deduplicazione per `node.id`).
   - Normalizzare le voci in `MalAnimeListEntry[]`.
3. **`getAnimeUserStatus(malId: number)`**:
   - `GET /anime/${malId}?fields=id,title,num_episodes,status,my_list_status,main_picture` per il controllo rapido dalla scheda dettagli `app/anime/[id].tsx`.
4. **`updateAnimeListStatus(malId: number, payload)`**:
   - `PATCH /anime/${malId}/my_list_status` con header `Authorization: Bearer <token>` e body `application/x-www-form-urlencoded`:
     - `status`: `'watching' | 'completed'`
     - `num_watched_episodes`: intero $\ge 0$
   - Gestire retry automatico una sola volta su `401` forzando il refresh token, e propagare errori leggibili su `429` (rate limit) / `5xx`.

**Criterio di verifica**: parsing corretto delle risposte paginate MAL v2 e serializzazione `x-www-form-urlencoded` verificati con test unitari.

---

### Step 3 — Cache Mapping Bidirezionale `malId ↔ animeId` (`src/services/mal/mapper.ts`)
**Obiettivo**: associare in modo affidabile e senza scraping massivo gli slug AnimeWorld (`animeId`) agli ID MyAnimeList (`malId`).

1. **Struttura cache `mal.idMap` in MMKV**:
   - `byAnimeId: Record<string, { animeId: string; malId: number; title: string; totalEpisodes?: number; isCompletedSeries?: boolean; updatedAt: number }>`
   - `byMalId: Record<number, { malId: number; primaryAnimeId: string; candidateAnimeIds: string[]; title: string; updatedAt: number }>`
2. **Popolamento passivo automatico**:
   - Esportare `recordAnimeMalMapping(detail: AnimeDetail)` e invocarlo quando `AnimeWorldScraper.getAnimeDetail` o `app/anime/[id].tsx` / `app/player/[id].tsx` ricevono un `AnimeDetail` con `detail.malId` valido.
   - In questo modo qualsiasi serie aperta almeno una volta in app è già mappata a costo zero.
3. **Risoluzione `animeId → malId` (per `App → MAL`)**:
   - Leggere prima da `mal.idMap.byAnimeId[animeId]`.
   - Solo per gli `animeId` locali mancanti in cache (che sono tipicamente pochi titoli visti in app), eseguire `AnimeWorldScraper.getAnimeDetail(animeId)` con concorrenza limitata (es. 2 richieste parallele) per estrarre `detail.malId` e salvarlo in cache.
   - Se una scheda AnimeWorld non ha `#mal-button` (`malId === undefined`), segnalarla nel diff come **"Non associato a MAL"** invece di fallire silenziosamente.
4. **Risoluzione `malId → animeId` on-demand (al tap su un titolo nelle liste MAL)**:
   - Se `mal.idMap.byMalId[malId]` ha già un `primaryAnimeId`, aprire direttamente `/anime/[id]`.
   - Altrimenti, al tap sulla card:
     1. Cercare su AnimeWorld con `AnimeWorldScraper.searchAnime(entry.title)` (e fallback su `entry.alternativeTitles?.en` se la prima ricerca dà 0 risultati).
     2. Filtrare e ordinare i candidati per similarità normalizzata del titolo (rimuovendo punteggiatura, suffissi `(ITA)` / `(TV)`), quindi verificare i primi **3–5 candidati** tramite `AnimeWorldScraper.getAnimeDetail(cand.id)` confrontando `detail.malId === malId`.
     3. **Esito univoco** (1 match confermato da `malId`): salvare in `mal.idMap` e aprire `/anime/[id]`.
     4. **Esito multiplo** (es. scheda `SUB` e scheda `ITA` con lo stesso `malId`): dare priorità automatica a un eventuale slug già presente in `CONTINUE_WATCHING`/`WATCH_HISTORY`, altrimenti aprire `MalMatchPickerModal` per scegliere `SUB` vs `ITA` e salvare la preferenza.
     5. **Nessun match automatico per `malId`**: aprire `MalMatchPickerModal` mostrando i risultati testuali trovati su AnimeWorld (con campo di ricerca manuale) così l'utente può associare la scheda una volta per tutte.

**Criterio di verifica**: test unitari su `recordAnimeMalMapping`, selezione prioritaria SUB/cronologia in presenza di duplicati `malId`, e normalizzazione titoli per ordinamento candidati.

---

### Step 4 — Motore di Diff & Sincronizzazione Unidirezionale `App → MAL` (`src/services/mal/sync.ts`)
**Obiettivo**: determinare con precisione quali serie locali devono aggiornare MyAnimeList ed eseguire l'aggiornamento manuale su conferma.

1. **Raccolta progressi locali per singolo `animeId`**:
   - Scansionare `AppStorage.getAllWatchProgress()`, `AppStorage.getWatchHistory()` e `AppStorage.getContinueWatching()`.
   - **Regola anti-off-by-one fondamentale**: in `AppStorage.saveWatchProgress`, quando l'episodio `N` viene completato, `CONTINUE_WATCHING` avanza automaticamente a `episodeNumber: N + 1` con `position: 0` (oppure `isCaughtUp: true` su `N`). Pertanto, il numero di episodi completati da inviare a MAL (`watchedEpisodesCount`) deve essere calcolato esclusivamente dagli episodi con `isCompleted === true` (prendendo il massimo `episodeNumber` completato o il conteggio reale degli episodi completati, con clamping $\ge 0$ e $\le \text{totalEpisodes}$ se noto).
   - Gestire anche serie iniziate ma con nessun episodio ancora completato (`watchedEpisodesCount === 0`): escluderle di default dalle proposte automatiche (o contrassegnarle come opzionali se `percentage > 0`), così non si sporca MAL aprendo per sbaglio 5 secondi dell'episodio 1.
2. **Determinazione stato target su MAL (`targetStatus`)**:
   - Dato `knownTotalEpisodes = malEntry?.numEpisodes || mapping?.totalEpisodes`:
   - Se la serie è conclusa (`!isOngoing`, `knownTotalEpisodes > 0`, e `watchedEpisodesCount >= knownTotalEpisodes`) → `targetStatus = 'completed'`, `targetEpisodes = knownTotalEpisodes`.
   - Altrimenti (`watchedEpisodesCount >= 1`) → `targetStatus = 'watching'`, `targetEpisodes = watchedEpisodesCount`.
3. **Confronto non regressivo contro le liste scaricate da MAL**:
   - Costruire mappa `malById` unendo `watching` + `completed` già scaricati da MAL.
   - Per ciascun anime locale con `malId` noto (e non in `MAL_IGNORED_ANIME_IDS`):
     - Se su MAL è **`completed`**: **non proporre aggiornamenti** (non retrocedere mai da `completed` a `watching`).
     - Se su MAL è **`watching`**:
       - Se `targetStatus === 'completed'` → proponi aggiornamento (`watching → completed`, `targetEpisodes`).
       - Else if `targetEpisodes > malEntry.watchedEpisodes` → proponi aggiornamento (`Ep mal → Ep app`).
       - Else (`malEntry.watchedEpisodes >= targetEpisodes`) → **già allineato / MAL più avanti**, nessuna azione.
     - Se **non presente** in `watching` né in `completed` su MAL:
       - Proponi aggiunta/aggiornamento con `targetStatus` e `targetEpisodes`.
4. **Esecuzione manuale `applyAppToMalProposals(selectedProposals)`**:
   - Esegue sequenzialmente (o con concorrenza 2 e piccolo delay anti-429) `client.updateAnimeListStatus(p.malId, { status: p.targetStatus, numWatchedEpisodes: p.targetEpisodes })`.
   - Aggiorna la cache locale delle liste MAL (TanStack Query cache + `MAL_LAST_SYNC_TIME`) e restituisce un riepilogo dettagliato (`updatedCount`, `failedItems[]`).

**Criterio di verifica**: test unitari completi in `tests/core-verification.test.ts` per tutti i casi limite:
- Episodio 3 completato + `ContinueWatching` su Episodio 4 a `0:00` → propone `3` episodi (non `4`).
- Serie conclusa 12/12 con Ep 12 completato → propone `completed` con `12` episodi.
- Serie su MAL già `completed` mentre in locale c'è solo Ep 2 → `0` proposte (nessuna regressione).
- Serie su MAL a Ep 8 mentre in locale è a Ep 5 → `0` proposte (nessuna regressione).
- Serie locale con solo Ep 1 al 20% (`isCompleted: false`) → nessuna proposta di push su MAL.

---

### Step 5 — UI Touch-Native: Liste MAL (`IN CORSO` / `COMPLETATI`) & Diff Preview (`src/components/mal/` & `app/mal/index.tsx`)
**Obiettivo**: offrire un'interfaccia OLED fluida a 60/120 FPS per sfogliare i titoli `watching` e `completed`, aprirli su AnimeWorld e avviare la sincronizzazione `App → MAL`.

1. **Schermata `app/mal/index.tsx`** (registrata nello `<Stack>` in `app/_layout.tsx` con `animation: 'slide_from_right'`):
   - **Header** con freccia indietro (`router.canGoBack() ? router.back() : router.replace('/(tabs)')`), titolo `MYANIMELIST`, avatar/username MAL e pulsante azione **`SINCRONIZZA`** (con badge numerico delle voci pronte per `App → MAL` se disponibili).
   - **Stato disconnesso**: `MalConnectCard` con spiegazione chiara ("Consulta le tue liste In corso e Completati e aggiorna MAL da ciò che guardi nell'app") e pulsante touch $\ge 44\text{ dp}$ `CONNETTI MYANIMELIST`.
   - **Stato connesso**:
     - **Segmented Tabs** (`IN CORSO (N)` | `COMPLETATI (M)`), con touch target $\ge 44\text{ dp}$ e contrasto YIQ dinamico (`getContrastTextColor(theme.colors.primary)`).
     - **Barra di filtro locale**: `TextInput` non controllato (`defaultValue`, `key={inputKey}`, zero re-render per battitura come da regola #9 di `AGENTS.md`) per filtrare istantaneamente su titolo principale e `alternative_titles`.
     - **Lista virtualizzata `@shopify/flash-list` v2**: renderizza `MalAnimeCard` (copertina `expo-image` con `cachePolicy="memory-disk"`, titolo, chip `EP. X / Y`, indicatore `ASSOCIAZIONE PRONTA` o badge `+N EP DA INVIARE`).
     - **Loading iniziale**: `Skeleton` OLED (`#161616`) senza CLS; pull-to-refresh per ricaricare le liste MAL.
     - **Tap sulla card**: avvia `resolveMalToAnimeWorld(entry)` con feedback loading discreto sulla card stessa; apre `app/anime/[id]` o `MalMatchPickerModal` in caso di ambiguità/mancato match.
     - **`hardwareBackPress`**: gestito con `useFocusEffect` (chiude ricerca/modali se aperti, altrimenti torna indietro).
2. **`MalSyncDiffModal.tsx` (Anteprima `App → MAL`)**:
   - Modale custom touch-safe (`Modal` con `transparent={true}`, `statusBarTranslucent={true}`, `animationType="fade"`, `useBottomSheetDragDismiss` sulla barra superiore/handle).
   - Elenca le proposte calcolate da `computeAppToMalDiff()` con checkbox/toggle touch per includere o escludere singole serie e bottone `INVIA A MAL (N)`.
   - Conferma finale tramite `ConfirmModal` prima di eseguire i `PATCH` (o conferma diretta se l'utente ha già esplicitamente premuto `CONFERMA E AGGIORNA N TITOLI` dopo aver visionato la preview).
3. **`MalMatchPickerModal.tsx`**:
   - Modale con campo di ricerca manuale (`defaultValue`) su `AnimeWorldScraper.searchAnime` per associare un titolo MAL quando il match automatico fallisce o ha duplicati `SUB`/`ITA`.
4. **Foglio stili separato**: `src/components/mal/mal.styles.ts` (regola #6 di `AGENTS.md`).

**Criterio di verifica**: nessuna importazione di `Alert` o `@expo/ui`, nessun `TextInput` controllato su ricerca, tutte le liste lunghe su `@shopify/flash-list`, tutti i bottoni $\ge 44\times44\text{ dp}$.

---

### Step 6 — Punti di Ingresso in App & Azione Rapida in Dettaglio Anime
**Obiettivo**: rendere immediato sia il raggiungimento delle liste MAL per scegliere cosa guardare, sia l'aggiornamento manuale di una singola serie.

1. **Impostazioni (`app/(tabs)/settings.tsx` e `app/settings/sync.tsx`)**:
   - Aggiungere una categoria dedicata **MYANIMELIST** (icona/stato: `CONNESSO • @username` oppure `NON CONNESSO`) che apre `/mal`.
   - In `app/settings/sync.tsx`, mantenere separati chiaramente **KuroSync** (sync multi-device interno) e **MyAnimeList** (export unidirezionale & liste personali MAL).
2. **Accesso rapido per "guardare da MAL"** (consigliato):
   - Aggiungere un pulsante rapido `LISTE MYANIMELIST` nel `SyncProfileModal` (o nella hero card / header di `favorites.tsx` o `HomeAppBar`), in modo che l'utente non debba entrare ogni volta nelle Impostazioni per aprire la propria lista `watching`/`completed`.
3. **Scheda Dettagli Anime (`app/anime/[id].tsx`)**:
   - Quando `anime.malId` è presente e MAL è connesso:
     - Mostrare una riga compatta o badge interattivo sotto la tabella info / header azioni con lo stato MAL attuale della serie (es. `MAL: IN CORSO (EP. 4/12)` o `MAL: NON IN LISTA`).
     - Al tap (se i progressi locali sono avanti o l'utente vuole segnare la serie): aprire `ConfirmModal` per aggiornare manualmente su MAL solo quell'anime (`App → MAL`) allo stato e conteggio episodi calcolati dall'app, oppure aprire la scheda web su MAL se già allineato.

**Criterio di verifica**: navigazione fluida verso `/mal` e ritorno senza regressioni su tablet/smartphone e nessun reset di ricerca nella Home.

---

### Step 7 — Verifica Tecnica, Test & Checklist Finale
**Obiettivo**: validare correttezza funzionale, compatibilità Hermes e conformità a tutte le regole di `AGENTS.md`.

1. **Test automatici in `tests/core-verification.test.ts`**:
   - Generazione PKCE `plain` e verifica `state` anti-CSRF.
   - Calcolo `watchedEpisodesCount` senza errore `+1` su `ContinueWatching`.
   - Regole di non-regressione `App → MAL` (`completed` intoccabile, `E_mal >= E_app` invariato, `E_app === 0` ignorato).
   - Cache `mal.idMap` (popolamento, priorità `SUB` / cronologia locale su `malId` duplicato).
   - Verifiche statiche sui nuovi file (`@shopify/flash-list`, assenza `Alert.alert`, assenza `node:*`, `useFocusEffect` + `BackHandler`, `defaultValue` sui `TextInput` di ricerca).
2. **Comandi di validazione**:
   ```bash
   npm test
   npm run lint
   npx expo export --platform android
   ```
3. **Test manuale su dispositivo Android**:
   - Login OAuth MAL tramite Custom Tab e rientro automatico su `kurotv://mal-callback`.
   - Caricamento liste `IN CORSO` e `COMPLETATI` (anche con 200+ titoli), filtro ricerca con tastiera Android IME e apertura scheda AnimeWorld al tap.
   - Modifica episodio completato in app → apertura diff `App → MAL` → conferma → verifica aggiornamento effettivo sul profilo `myanimelist.net`.
   - Verifica comportamento offline (apertura lista/app senza connessione **non** deve scollegare l'account MAL).

---

## ⚠️ Rischi Noti e Mitigazioni

| Rischio | Impatto | Mitigazione nel Piano |
|---|---|---|
| Scheda AnimeWorld priva di `#mal-button` (`malId` assente) | Impossibilità di match automatico | Segnalazione esplicita nel diff + `MalMatchPickerModal` per associazione manuale persistente in `mal.idMap` |
| Schede `SUB` e `ITA` separate con stesso `malId` | Apertura della versione sbagliata | Priorità automatica allo slug già presente nella cronologia/preferiti locali, altrimenti picker `SUB`/`ITA` salvato in cache |
| Episodi speciali (`Ep. 0`, `13.5`) su AnimeWorld | Scostamento di 1 nel conteggio episodi verso MAL | Contare solo episodi interi positivi completati (`Number.isInteger(ep.number) && ep.number > 0`) e mostrare sempre l'anteprima editabile prima dell'invio |
| Split-cour su MAL vs stagione unica su AnimeWorld | Conteggio totale episodi diverso | Confronto non distruttivo su `ConfirmModal` + possibilità di ignorare una serie dalla coda diff (`MAL_IGNORED_ANIME_IDS`) |
| Rate-limit AnimeWorld durante risoluzione `malId` | Errori 429/temporanei | Risoluzione lazy al tap per la lista MAL + concorrenza max 2 per i soli anime locali mancanti in `mal.idMap` |
