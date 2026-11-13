# 🏛️ Architettura del Progetto — Kuro Mobile

Kuro Mobile è costruito con un'architettura modulare e moderna, progettata per offrire le massime prestazioni native su Android sfruttando **Expo SDK 58** e la **Nuova Architettura di React Native (TurboModules / Fabric)**.

---

## 📁 Struttura delle Directory

```
KuroM/
├── app/                         # Routing File-Based (Expo Router v58)
│   ├── _layout.tsx              # Root Layout: ThemeProvider, QueryClient, GestureHandler
│   ├── (tabs)/                  # Navigazione a schede inferiori
│   │   ├── _layout.tsx          # Configurazione TabBar con tinte reattive & pulsante Profilo rapido
│   │   ├── index.tsx            # Home: Hero Spotlight, Continua a guardare, Ultime uscite, ricerca unificata & pulsante Palinsesto
│   │   ├── explore.tsx          # Palinsesto: Programmazione uscite settimanali con orari previsti, selettore giorni & freccia indietro (href: null)
│   │   ├── favorites.tsx        # Preferiti: Griglia anime salvati in locale
│   │   ├── history.tsx          # Cronologia: Storico di visione e ripresa episodio
│   │   ├── profile.tsx          # Profilo: Route di sicurezza con redirect automatico (gestita tramite tabPress / custom button)
│   │   └── settings.tsx         # Impostazioni: Temi SVG, AniSkip, Navbar Android, sorgente (.ac, .so, .tv), info & updater
│   ├── anime/
│   │   └── [id].tsx             # Scheda Dettaglio Anime (Header, Trama, Server, Griglia Puntate)
│   ├── downloads/
│   │   └── index.tsx            # Sezione Offline: Monitoraggio storage, download attivi e serie scaricate
│   └── player/
│       └── [id].tsx             # Player Video Touch Mobile (Gesture, OSD, PiP, MediaStyle notification, AniSkip)
├── assets/                      # Risorse statiche
│   ├── icons/                   # Icone SVG (temi, youtube, myanimelist, anilist)
│   └── images/                  # Icone app Android, Splash screen e banner
├── src/                         # Moduli core dell'applicazione
│   ├── components/              # Componenti UI riutilizzabili (FlashList items, Modali touch-native)
│   │   ├── anime/               # Moduli dettaglio anime (Backdrop, Synopsis, AnimeInfoTable, Controls)
│   │   ├── downloads/           # Moduli Sezione Download (StorageUsageBar, ActiveDownloadCard, DownloadedAnimeCard, DownloadedEpisodesSheet)
│   │   ├── home/                # Moduli Home Screen (home.styles, HomeSection, ContinueWatching, Search)
│   │   ├── player/              # Moduli isolati video player (Header, Timeline, Footer, Carousel, Info)
│   │   ├── settings/            # Moduli Impostazioni (settings.styles, ThemeSettings, SourceSettings, DownloadSettings, SyncSettingsCard, SyncConnectModal, AuthorizeTvModal, SyncProfileModal, QrScannerModal)
│   │   ├── skeleton/            # Primitive e layout skeleton animati (Zero CLS, OLED #161616)
│   │   ├── FilterBottomSheet.tsx# Modale filtri di ricerca touch-safe
│   │   ├── UpdateModal.tsx      # Modale notifica aggiornamento in-app all'avvio
│   │   ├── ConfirmModal.tsx     # Modale in-app unificato di conferma (Zero Alert.alert)
│   │   ├── StepSlider.tsx       # Primitiva touch-native slider discreto unificata
│   │   ├── HistorySlider.tsx    # Slider retention cronologia (OFF, 30g, 60g, 90g, ON)
│   │   ├── AniSkipSlider.tsx    # Slider modalità salto sigle (OFF, MANUALE, AUTO)
│   │   └── AniSkipDurationSlider.tsx # Slider durata pulsante salto (5s - 60s, ∞)
│   ├── services/
│   │   ├── aniskip/             # Servizio timestamp per skip intro/outro/recap
│   │   ├── downloads/           # Gestore download offline, coda sequenziale, SAF e persistenza MMKV
│   │   ├── queries/             # QueryOptions TanStack React Query v5
│   │   ├── scraper/             # Web Scraper AnimeWorld con cheerio/slim
│   │   ├── storage/             # Storage locale MMKV v3 (app-storage.ts, continue-watching-sync.ts, barrel privo di cicli)
│   │   ├── sync/                # Sincronizzazione KuroSync self-hosted (client.ts, merge.ts, sync-manager.ts, types.ts)
│   │   └── updater/             # Client OTA manifest, update store reattivo e download APK
│   ├── theme/                   # Sistema di stili reattivo e ThemeProvider
│   └── types/                   # Definizioni TypeScript condivise
├── workers/                     # Cloudflare Worker unificato per OTA
├── scripts/                     # Tooling DevOps, release pipeline & patch native (apply-patches, build-release)
└── tests/                       # Suite di verifica qualità a 25 stadi
```

---

## 🔄 Flusso dei Dati & Data Fetching

### 1. TanStack React Query v5
Il data fetching remoto sfrutta `@tanstack/react-query` v5 per garantire caching intelligente, deduplicazione delle richieste e gestione trasparente degli stati di caricamento/errore:

- **Dettagli Anime**: `['anime', 'detail', animeId]` — stale time a 10 minuti.
- **Home & Trending**: `['home', 'feed']` — stale time a 5 minuti con supporto a `RefreshControl`.
- **Palinsesto Settimanale**: `['schedule']` — stale time a 10 minuti con persistenza sincrona su MMKV e supporto a `RefreshControl`.
- **Ricerca & Filtri**: `['anime', 'search', query, filters]` — debounce integrato sul campo di input.

### 2. Storage Locale ad Alte Prestazioni (`react-native-mmkv`)
Tutti i dati persistenti lato client (preferiti, avanzamento episodi, cronologia di riproduzione, cronologia di ricerca, server preferito e impostazioni) risiedono in istanze sincrone di **MMKV**:
- Nessun tempo di attesa o promise asincrona per leggere lo stato dei preferiti o delle ricerche recenti.
- Salvataggio dello stato di riproduzione (tempo corrente, percentuale di avanzamento e data ultimo accesso) ad ogni aggiornamento della timeline video.
- Gestione della cronologia delle ricerche (`user.searchHistory`) con memorizzazione timestamp e pulizia automatica in base al periodo di ritenzione configurato.

---

## 🕷️ Architettura dello Scraper (Hermes-Safe)

L'applicazione estrae i flussi video e le informazioni dal provider AnimeWorld tramite uno scraper proprietario ottimizzato:

### 🚫 Eliminazione del Vincolo Node.js (`cheerio/slim`)
Nel runtime mobile Hermes non sono disponibili le API native di Node (`node:stream`, `node:buffer`). Per questo motivo:
1. **Parser Leggero**: Utilizzo di `cheerio/slim` con engine `htmlparser2` (puramente JavaScript).
2. **Intercettore Metro**: In `metro.config.js`, qualsiasi tentativo di risoluzione verso `node:*` viene reindirizzato su moduli vuoti o compatibili con React Native.

```typescript
// Esempio import sicuro in src/services/scraper/parsers/
import * as cheerio from 'cheerio/slim';

export function parseAnimeDetail(html: string): AnimeDetail {
  const $ = cheerio.load(html);
  // Parsing del DOM sicuro su Hermes
  ...
}
```

---

## 🏠 Architettura della Schermata Home & Slider Sincronizzato

La schermata Home (`app/(tabs)/index.tsx`) è strutturata per replicare fedelmente l'esperienza ufficiale del portale anime, arricchita con interazioni touch a 60/120 FPS:

### 1. Banner Hero Spotlight Orizzontale a Paging
- **Slider a Schermo Intero**: Implementato tramite `ScrollView` orizzontale a piena larghezza con `pagingEnabled={true}` e `decelerationRate="fast"`.
- **Predefinito #1 della Top 8**: All'avvio dell'applicazione espone il primo elemento dei raccomandati AnimeWorld (`homeData.sliders[0]`).
- **Controlli d'Azione Integrati**:
  - `RIPRODUCI`: Avvio rapido che verifica prioritariamente se l'anime possiede una sessione in corso in cronologia; in caso negativo, interroga le API per il primo episodio (`serverId` automatico) e naviga direttamente al player video con indicatore di caricamento integrato. In caso di errore di rete temporaneo, scatta il fallback sicuro alla scheda dettagli (`/anime/[id]`).
  - `INFO`: Navigazione diretta alla scheda tecnica e trama completa (`/anime/[id]`), attivabile anche toccando qualsiasi area libera del banner.

### 2. Sincronizzazione Bi-direzionale Hero Banner ⇄ Carosello Raccomandati
- **Sincronizzazione allo Settling (Zero Ping-Pong & Zero Deadlock)**:
  - Per evitare loop ricorsivi tra scrollview, scatti e saturazione del thread JS/UI, la sincronizzazione non avviene a ogni tick continuo di `onScroll`, bensì unicamente all'assestamento dello scorrimento (**settling**):
    - **Scorrimento Carosello Raccomandati**: quando il carosello si arresta (`onMomentumScrollEnd` o `onScrollEndDrag` con `|velocity| < 0.1` per rilasci lenti senza inerzia su Android), viene invocato `settleRecommendedScroll`, aggiornato l'indice e animato lo slider Hero (`heroScrollRef.current.scrollTo`).
    - **Scorrimento Slider Hero**: quando la pagina si arresta, viene invocato `settleHeroScroll`, aggiornato l'indice e sincronizzato il carosello raccomandati (`recommendedScrollRef.current.scrollTo`).
    - **Selezione Rapida (Tap)**: toccando direttamente una scheda in `RACCOMANDATI` (`handleSelectRecommended`), entrambe le viste animano fluidamente all'indice selezionato.
- **Protezione Anti-Loop Differita via `activeScrollSourceRef` & Timeout Safe**:
  - Il lock `activeScrollSourceRef` (`'hero' | 'recommended' | 'tap' | null`) blocca qualsiasi re-triggering durante la gesture.
  - Per prevenire che i fotogrammi dell'animazione nativa innescata sull'altra scrollview scatenino a loro volta una risposta inversa non appena terminata la gesture dell'utente, lo sblocco di `activeScrollSourceRef.current = null` è differito tramite un timeout protetto a 450ms (`resetSourceTimeoutRef`), con cleanup automatico in unmount.
- **Snapping Nativo Memoizzato (`snapToOffsets`) & Dynamic Right Padding**:
  - `snapToOffsets` adotta l'array stabile memoizzato `recommendedSnapOffsets` (`useMemo`), eliminando la ricreazione dell'istanza dell'array ad ogni re-render e proteggendo i listener nativi Fabric di Android.
  - Il padding destro del contenitore è calcolato dinamicamente con `Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)`, permettendo alle ultime due schede (#7 e #8) di scorrere liberamente fino al punto di focus senza blocco del clamp.
- **Bordo Fisso a 2dp (Zero Layout Invalidation / Zero `requestLayout`)**:
  - `styles.recommendedCard` adotta `borderWidth: 2` fisso. Al variare dello stato `isFocused`, varia unicamente la tinta `borderColor`, preservando le dimensioni esatte del box model e azzerando le chiamate native a `requestLayout()` durante lo scorrimento.

### 3. Organizzazione delle Sezioni & Scraper Stagionale (`/upcoming`)
- **Sezioni Verticali**:
  1. Hero Banner Spotlight (Top 8).
  2. Carosello `RACCOMANDATI` numerati progressivamente (`#1` ... `#8`).
  3. *Riprendi a Guardare* (condizionale, sincronizzato con MMKV).
  4. *Ultimi Episodi Usciti* (con pulsante `VEDI TUTTI`).
  5. *Tendenze*.
  6. *Anime in Corso* (`ongoing`).
  7. *Uscite della Stagione Corrente* (`upcoming` / stagionali con pulsante `VEDI TUTTI`).
  8. *Nuove Aggiunte*.
- **Supporto Scraper per `.film-listnext` & Sanitizzazione Titoli**:
  - `parseSearchPage` in `src/services/scraper/parsers/search.parser.ts` include il selettore `.film-listnext .item` per estrarre la totalità delle uscite stagionali da `animeworld.ac/upcoming`.
  - Isola con precisione i titoli testuali (`nameEl`), prevenendo la contaminazione da badge accessori (es. `DUB`, `Special`, `ONA`) collocati dentro l'elemento locandina `<a class="poster">`.

---

## 🔍 Ricerca Unificata, Cronologia Google-Style & Filtri Avanzati (`app/(tabs)/index.tsx`, `FilterBottomSheet.tsx`)

La ricerca catalogo è integrata direttamente nell'header della schermata Home:

### 1. Cronologia Ricerche in Stile Google & Privacy
- **Sostituzione dei Consigliati**: I vecchi suggerimenti statici sono sostituiti da una cronologia di ricerca recente touch-native.
- **Interfaccia Touch-Native**: Ciascuna ricerca passata presenta l'icona orologio `time-outline`, testo maiuscolo monospace, tap-to-search immediato per eseguire la ricerca e pulsante `close-outline` dedicato con area di tocco $\ge 44$dp per rimuovere la singola voce con feedback tattile (`Haptics.ImpactFeedbackStyle.Light`).
- **Cancellazione Globale Protetta**: Pulsante `CANCELLA TUTTE` protetto dal componente modale in-app unificato `ConfirmModal`.
- **Retention Policy Flessibile (`HistorySlider.tsx`)**: Configurazione nelle Impostazioni tramite `HistorySlider` e step dedicati `SEARCH_RETENTION_STEPS` (`OFF`, `30GG`, `60GG`, `90GG`, `ON` illimitato). Alla disattivazione (`OFF`), la cronologia viene svuotata e la memorizzazione interrotta. La pulizia dei record scaduti (`AppStorage.cleanupExpiredSearchHistory`) viene eseguita all'avvio in background.

### 2. Filtri Catalogo Avanzati & Risoluzione 6 Titoli Spuri
- **Supporto 46 Generi & Logica AND**: Interfaccia a chip con selezione multipla di tutti i 46 generi AnimeWorld e invio del parametro `genre_mode=and` per intersezioni accurate.
- **Filtro Audio Dedicato**: Supporto completo per `TUTTI GLI AUDIO`, `DOPPIATI (ITA)` (`dub: '1'`) e `SOTTOTITOLATI (SUB)` (`dub: '0'`).
- **Mappatura Categorie & Formati Nativi**: Mappatura corretta con codici numerici AnimeWorld (`0` Serie TV, `4` Film Anime, `1` OAV, `2` ONA, `3` Special).
- **Ordinamento Reale per Data di Uscita**: Selezione di `sort: '5'` per ordinare in base alla vera data di rilascio (`release_date:desc`), affiancato da `1` Ultime aggiunte, `6` Più visti, `7` Meglio valutati, `2` A-Z, `3` Z-A.
- **Isolamento del Contenitore nello Scraper (`search.parser.ts`)**:
  - Il selettore di parsing è circoscritto ai soli contenitori dei risultati effettivi (`#main .film-list > .item, .content .film-list > .item, .film-list > .item, #main .film-listnext > .item, .content .film-listnext > .item, .film-listnext .item`).
  - Esclusione categorica di `.simple-film-list .item, .ranking .item, aside .item, .widget.ranking .item, .widget.simple-film-list .item`: quando una ricerca non produce risultati (es. categorie particolari senza match), AnimeWorld visualizza un widget laterale/inferiore con esattamente 6 titoli consigliati. Il filtro rigoroso evita che questi 6 elementi vengano erroneamente restituiti come risultati della ricerca.

---

## 📅 Palinsesto & Programmazione Settimanale (`app/(tabs)/explore.tsx`)

La schermata Palinsesto visualizza la programmazione delle uscite anime settimanali con gli orari previsti da AnimeWorld (`animeworld.ac/schedule`). È accessibile direttamente dall'header della Home (`HomeAppBar`, posizionato tra il pulsante Download e la Ricerca) con rotta tab dedicata (`href: null`) e integra una freccia Indietro touch-native (`arrow-back`, $44 \times 44$dp) per un ritorno fluido alla schermata principale:

### 1. Scraper & Parsing Dati (`schedule.parser.ts`)
- **Estrazione Strutturata con `cheerio/slim` & `htmlparser2`**:
  - `week`: Intestazione della settimana di riferimento (es. `SETTIMANA 9 MARZO – 15 MARZO`).
  - `hero`: Card della prossima uscita in arrivo (`.sch-hero`), con orario previsto/countdown, titolo, puntata e locandina.
  - `days`: 7 sezioni giornaliere (`LUN` ... `DOM`), ciascuna con data formattata (es. `9 MARZO`), lista episodi ordinata cronologicamente (`time`, `title`, `episode`, `state`), conteggio totale uscite e marcatura `isToday`.
  - `unscheduled`: Sezione `.sch-unk` con le serie in trasmissione prive di giorno fisso stabilito.
  - **Stati di Uscita**: Rilevamento automatico di `.is-done` (`'released'`), `.is-pause` (`'paused'`) o programmato (`'scheduled'`).

### 2. Architettura & Storage Sincrono
- **Cache Istantanea MMKV**: Chiave `cache.scheduleData` per azzerare i tempi di caricamento al cambio tab o all'avvio dell'app.
- **Query TanStack**: `scheduleQueryOptions()` con `initialData` da MMKV e stale time a 10 minuti.

### 3. Interfaccia Touch-Native & Virtualizzazione
- **Selettore Giorni Orizzontale**: Scorrimento touch dei giorni della settimana con etichetta compatta giorno e numero (es. `SAB 14`, `LUN 9`) senza numero di uscite e con pill `OGGI` attivo per l'auto-selezione della data odierna.
- **Virtualizzazione con `@shopify/flash-list`**: Timeline fluida a 60/120 FPS senza crash o allocazioni superflue di memoria RAM.
- **Hero Card Prossima Uscita**: In evidenza con badge fiammella `PROSSIMA USCITA`, orario programmato, titolo, numero di puntata e navigazione diretta alla scheda dettaglio.
- **Skeleton Dedicato**: `ScheduleScreenSkeleton` replica al millimetro hero banner, day switcher e timeline a zero Cumulative Layout Shift (CLS).

---

## 🎨 Motore dei Temi & Reattività Istantanea

Il motore dei temi (in [`src/theme/unistyles.ts`](file:///home/g4s/VSCode/KuroM/src/theme/unistyles.ts)) combina le specifiche di un design token moderno con la reattività immediata di React Context:

1. **Clonazione dell'Oggetto Tema**: Quando l'utente seleziona un nuovo tema, `ThemeProvider` clona l'oggetto tema `{ ...newTheme, colors: { ...newTheme.colors } }`. Questo genera una nuova referenza in memoria, forzando il re-render istantaneo di tutti i componenti registrati con `useTheme()`.
2. **Hook Flessibile `useTheme()`**: Supporta sia l'accesso diretto (`theme.colors.primary`) che la destrutturazione (`const { theme } = useTheme()`).

---

## 💀 Sistema di Animazioni Skeleton & Zero Layout Shift (CLS)

Il sistema di skeleton loading in [`src/components/skeleton/`](file:///home/g4s/VSCode/KuroM/src/components/skeleton) sostituisce completamente gli spinner generici bloccanti con placeholder animati fedeli alle geometrie native dei componenti reali:

1. **Primitiva `Skeleton`**:
   - Gestisce un loop infinito di opacità (tra $0.35$ e $0.85$, frequenza 850ms) eseguito sul thread UI nativo tramite `useNativeDriver: true`.
   - Adotta sfondi OLED surface scuri (`#161616`) e bordi ad alto contrasto (`#262626`) per display AMOLED.
2. **Layout Skeleton Specializzati**:
   - `AnimeCardSkeleton`: replica l'aspect ratio (1.45) e le dimensioni esatte (130x190 o responsive) di `AnimeCard`, con badge posizionato a (6, 6) e linee titolo duplicate (`marginTop: 6`).
   - `HomeScreenSkeleton`: modella l'Hero Banner Spotlight a 320dp con i due pulsanti d'azione (Play e Info), il carosello compatto dei raccomandati numerati con card a 112x140dp, supporta la sezione condizionale *Riprendi a guardare* (`hasContinueWatching`) con card a 160x96dp per preservare lo spazio prima del fetch remoto, e allinea il padding orizzontale per combaciare perfettamente con i caroselli reali a zero Cumulative Layout Shift (CLS).
   - `ExploreScreenSkeleton`: griglia a 2 colonne sincronizzata con la larghezza schermo `(windowWidth - 44) / 2` con `padding: 0` interno per eliminare il doppio padding rispetto a `styles.listContent` (16dp).
   - `ScheduleScreenSkeleton`: modella il banner Hero Prossima Uscita (108dp), la barra orizzontale dei giorni della settimana con chip a 58x52dp e le card della timeline con colonna orario dedicata (44x20dp), locandina (56x80dp), titolo e badge metadati/stato a zero Cumulative Layout Shift (CLS).
   - `AnimeDetailScreenSkeleton`: scheletro completo fedele al 100% che modella il backdrop (260dp), poster (110x160dp), pulsanti d'azione rapidi circolari di avvio/riavvio (`play` e `reload` $\ge 44$dp), sinossi a 3 righe, scheda tecnica a 4 righe (`tableCard`), 3 pulsanti link esterni (`linksRow` $\ge 44$dp), barra controlli con switch vista e chip episodi a 52dp.
   - `EpisodeItemSkeleton`: chip quadrati per vista griglia (altezza a 52dp e raggio `radius.md` conformi a `EpisodeItem`) o barre orizzontali per vista lista con badge numerico 32x32 e pulsante play circolare 24x24.
   - `PlayerSkeleton`: scheletro dell'interfaccia OSD del video player con 3 pulsanti azione circolari in header ($\ge 44$dp), controlli centrali con skip e play 64dp, e 3 controlli inferiori nel footer (episodi, velocità e orientamento) durante la connessione allo stream.
3. **Prevenzione del Cumulative Layout Shift (CLS) & Ottimizzazione Batteria**:
   - Ogni skeleton occupa il medesimo ingombro verticale e orizzontale del componente reale, azzerando qualsiasi scatto o riposizionamento della UI al completamento delle query TanStack.
   - I loop nativi di animazione vengono arrestati automaticamente via cleanup di `useEffect` e smontati non appena le copertine o lo stream video scatenano l'evento `onLoad`, liberando memoria RAM e cicli CPU sui dispositivi mobili.

---

## 🛡️ Componente Unificato `ConfirmModal` & Divieto Assoluto di `Alert.alert`

Per eliminare qualsiasi discontinuità visiva tra Android nativo e l'interfaccia dell'applicazione, il codebase adotta il componente unificato [`ConfirmModal`](file:///home/g4s/VSCode/KuroM/src/components/ConfirmModal.tsx):

1. **Divieto Assoluto di Alert di Sistema**:
   - È severamente vietato l'import di `Alert` da `react-native` e l'uso di `Alert.alert(...)`.
   - Tutte le conferme distruttive o critiche (rimozione da *Riprendi a guardare*, svuotamento della cronologia da History o Settings, eliminazione di un singolo elemento) passano per `ConfirmModal`.
2. **Standard Visivo & Ergonomico**:
   - **Superficie OLED**: Card modale scura in `theme.colors.surface`, bordo `theme.colors.border`, raggio `radius.lg`.
   - **Tipografia Monospace**: Titolo e corpo in maiuscolo (`textTransform: 'uppercase'`), font di sistema `'monospace'`.
   - **Contrasto Dinamico YIQ**: Calcolo del colore testo del pulsante conferma via `getContrastTextColor(confirmColor)` per garantire leggibilità ottimale su ogni tema.
   - **Touch Target $\ge 44$dp**: Pulsanti di annulla e conferma con `minHeight: 44` e hitSlop.
   - **Feedback Aptico Integrato**: `Haptics.ImpactFeedbackStyle.Light` su dismiss/annulla, `Haptics.NotificationFeedbackType.Success` su conferma.
   - **Status Bar Trasparente**: `statusBarTranslucent={true}` per garantire che l'overlay `rgba(0, 0, 0, 0.75)` copra l'intero schermo edge-to-edge.

---

## 📜 Gestione Cronologia, Retention Policy Dinamica & Eliminazione Touch

La gestione dello storico di visione in [`app/(tabs)/history.tsx`](file:///home/g4s/VSCode/KuroM/app/(tabs)/history.tsx) e [`src/services/storage/`](file:///home/g4s/VSCode/KuroM/src/services/storage/index.ts) offre il massimo controllo sulla privacy e sull'ergonomia touch:

1. **Retention Slider Reattivo in Impostazioni (`HistorySlider.tsx`)**:
   - Slider a 5 livelli discreti: `'OFF'` (valore `-1`), `30gg`, `60gg`, `90gg` e `'ON'` (`0`, illimitato).
   - Quando impostato su `'OFF'`, la registrazione dei progressi viene bloccata e la tab **Cronologia** scompare istantaneamente dalla barra di navigazione (`<Tabs.Protected guard={isHistoryEnabled}>` in `app/(tabs)/_layout.tsx`), proteggendo anche la rotta diretta tramite listener di storage sincrono.
   - Svuotamento rapido tramite il tasto *"CANCELLA CRONOLOGIA"* con modale di conferma in-app.
2. **Rimozione Singola con Gesture Touch & Modale Integrato**:
   - Ogni scheda cronologia possiede un pulsante di eliminazione (`remove-circle-outline`) conforme ai requisiti touch ($\ge 44$dp) e gesti swipe-to-delete orizzontali.
   - La conferma di eliminazione usa un componente modale OLED nativo a tutto contrasto (`theme.colors.surface`, monospace), evitando alert di sistema intrusivi.

---

## 📋 Scheda Tecnica & Metadati Estesi Anime (`AnimeInfoTable`, `AnimeHeaderBackdrop`)

La schermata Dettaglio Anime arricchisce la consultazione con i componenti [`AnimeInfoTable`](file:///home/g4s/VSCode/KuroM/src/components/anime/AnimeInfoTable.tsx) e [`AnimeHeaderBackdrop`](file:///home/g4s/VSCode/KuroM/src/components/anime/AnimeHeaderBackdrop.tsx):

1. **Header Pulito, Spacing Iniziale & Copertina Espandibile a Schermo Intero**:
   - Intestazione ripulita dalla vecchia immagine di backdrop ingrandita a 260dp.
   - Spacing iniziale protetto (`paddingTop: 68` sia su `AnimeHeaderBackdrop` che su `AnimeDetailScreenSkeleton`) per garantire che la locandina e i pulsanti d'azione inizino sempre al di sotto della barra superiore fluttuante (`topNav`), azzerando le sovrapposizioni visive con il tasto fisico/touch "Indietro".
   - La copertina (locandina 110x160dp) è interattiva e cliccabile: apre una card modale OLED a schermo intero con l'artwork ad alta risoluzione, dismiss al tocco esterno e pulsante di chiusura $\ge 44$dp.
2. **Tabella Tecnica con Generi Scorrevoli & Totali Incerti**:
   - Visualizza in griglia compatta: **Audio**, **Stato**, **Uscita**, **Durata**, **Studio**, **Episodi**, **Voto** e **Genere**.
   - Supporto completo ai totali episodi incerti o serie in corso con punti di domanda (`??`, `?`, `12 / ??`) tipici di AnimeWorld, estratti in sicurezza dallo scraper e propagati nello storage.
   - La cella *Genere* adotta uno `ScrollView` orizzontale con `nestedScrollEnabled={true}` e `showsHorizontalScrollIndicator={false}`, consentendo la consultazione dell'elenco completo dei generi senza tagli o espansioni verticali anomale.
3. **Controlli di Avvio Rapido nell'Header**:
   - Comandi touch dedicati accanto alla copertina: pulsante di riproduzione continua (**Play** `play`) e pulsante di riavvio dall'episodio 1 (**Restart** `reload`), entrambi a soli simboli con target $\ge 44$dp.
   - Eliminato il pulsante play ridondante a fondo schermata, offrendo un layout compatto e focalizzato.
4. **Selettore Batch Puntate Touch-Native (`BatchBottomSheet`)**:
   - Implementato come Bottom Sheet modale basato su React Native `Modal` (`animationType="fade"`) combinato con `useBottomSheetDragDismiss`, risolvendo alla radice le interferenze di touch/gesture del `ModalBottomSheet` nativo di Compose su Android/Expo Go ed evitando il doppio slide-out Android alla chiusura tramite scorrimento.
   - Rimosse le sezioni correlate non pertinenti per focalizzare la visualizzazione esclusivamente sulle batch numeriche delle puntate.
   - FlashList degli episodi configurata con `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash nativi Fabric/Hermes allo scroll rapido.
5. **Link Esterni con Icone SVG & Condivisione Intelligente**:
   - Pulsanti dedicati con icone SVG per l'apertura rapida di **Trailer YouTube** (`youtube.svg`), scheda **MAL** (`myanimelist.svg`, etichetta unificata) e scheda **AniList** (`anilist.svg`).
   - Il pulsante di condivisione (`Share.share`) dell'URL AnimeWorld originale è posizionato nell'header superiore accanto al cuore dei preferiti, garantendo un'interfaccia pulita e minimale sotto la tabella.

---

## 🎬 Video Player & Streaming Asincrono (`replaceAsync`)

Il sottosistema video ([`app/player/[id].tsx`](file:///home/g4s/VSCode/KuroM/app/player/[id].tsx)) adotta la gestione asincrona delle sorgenti multimediali:
- **`replaceAsync` off-thread**: Sostituisce il metodo deprecato `player.replace` per prevenire il blocco del Main Thread durante l'inizializzazione dei formati video su iOS e Android.
- **Gestione Stream & Ripresa**: Mantiene sincronizzato il `playbackRate` e applica il punto di ripresa memorizzato in MMKV al completamento della risoluzione della risorsa, senza glitch visivi.
- **Feedback Visivo di Caricamento Integrato**: Durante il recupero del flusso o il buffering, l'animazione di caricamento (`ActivityIndicator` con contrasto YIQ) è integrata direttamente all'interno del pulsante circolare Play/Pausa (e al centro dello schermo a controlli nascosti), azzerando overlay scuri o box oscuranti che coprono la visione.
- **Controlli Multimediali in Notifica & Patch Native (`scripts/apply-patches.mjs` + `buildFromSource`)**: Espone `showNowPlayingNotification = true` con titolo principale `EPISODIO <Num>` (immune ai tagli dei nomi lunghi), sottotitolo/artista `<TITOLO SERIE>` e locandina artwork scaricata e serializzata come JPEG byte array in `artworkData` per i Quick Settings di Android 13+ e bitmap `largeIcon`. Grazie a `"buildFromSource": ["expo-video"]` in `package.json` (`expo.autolinking.android`), Gradle compila `KuroForwardingPlayer` anziché collegare l'AAR precompilato, preservando `COMMAND_SEEK_TO_NEXT` / `COMMAND_SEEK_TO_NEXT_MEDIA_ITEM` e `COMMAND_SEEK_TO_PREVIOUS` / `COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM` (anche attraverso `onAvailableCommandsChanged`) per esporre l'intera barra simmetrica a 5 tasti (`seek -10s`, `precedente`, `play/pausa`, `successivo`, `seek +10s`) e gli eventi `KuroNotificationNextEpisode` / `KuroNotificationPrevEpisode`.
- **Scheda Dettagli Player (`PlayerInfoSheet.tsx`)**: Badge puntata formattato rigorosamente come `'EPISODIO X/TOT'` (es. `'EPISODIO 1/170'`, `'EPISODIO 1/??'`), pulito da suffissi titolo puntata ridondanti.
- **AniSkip Intelligente (`'SALTA'` / `'PROSSIMO'`)**: Rileva sigle d'apertura (`op`, `mixed-op`), chiusura (`ed`, `mixed-ed`) e `recap` con finestra configurabile (`5s`–`60s` o `∞` via `AniSkipDurationSlider`) e modalità (`OFF`, `MANUALE`, `AUTO`) via `AniSkipSlider`. Quando una ending coincide con la fine episodio (`≤ 5s`) trasforma `'SALTA'` in `'PROSSIMO'`, mentre in presenza di scene post-ending mantiene `'SALTA'` sulla sigla e propone separatamente `'PROSSIMO'` all'avvio della sezione post-ending (senza coesistenza dei due pulsanti).

---

## 📱 Gestione Navbar di Sistema Android & Modalità Immersiva

Per massimizzare la resa visiva sui display AMOLED ed eliminare sovrapposizioni grafiche con i pulsanti di sistema:
1. **Modalità Immersiva Auto-Hide (`expo-navigation-bar`)**:
   - `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`: la navbar di sistema Android viene nascosta automaticamente all'apertura dell'app.
   - Può essere richiamata in qualsiasi momento con un semplice swipe verso l'alto dal bordo inferiore e scompare nuovamente in automatico dopo l'uso.
   - Sincronizzazione dinamica dello stato su `AppState` (ripristino automatico al ritorno da background).
2. **Adattamento Dinamico Safe Area sui Tab**:
   - `tabBarStyle` in [`app/(tabs)/_layout.tsx`](file:///home/g4s/VSCode/KuroM/app/(tabs)/_layout.tsx) calcola l'altezza come `56 + insets.bottom` e il padding inferiore come `insets.bottom`.
   - Se la navbar a 3 pulsanti è visibile o l'utente seleziona la modalità `SEMPRE VISIBILE` in Impostazioni, la barra delle tab espande un cuscinetto inferiore OLED evitando qualsiasi collisione con le icone.
3. **Configurazione Utente in Impostazioni**:
   - Selezione istantanea tra `NASCONDI (SWIPE)` (default consigliato, a scomparsa con swipe dal basso) e `SEMPRE VISIBILE` (sempre fissa e visibile in-app), con descrizione snellita ed essenziale, persistita in MMKV (`AppStorage.setNavBarMode`).

---

## 🔄 Updater Reattivo & Notifica all'Avvio (`UpdateModal`)

L'applicazione include un sistema di notifica e aggiornamento in-app progettato per non essere invasivo:
1. **Controllo Asincrono all'Avvio**: 1200ms dopo il montaggio iniziale, `UpdaterService.checkForUpdates()` verifica in background la presenza di nuove build sul manifest Cloudflare R2.
2. **Modale In-App `UpdateModal`**: Se è disponibile una nuova versione, visualizza un modale OLED con versione, codice build e note di rilascio scrollabili.
3. **Flusso Diretto o Differito**:
   - **Tasto "AGGIORNA ORA"**: Chiude il modale, naviga alla sezione Impostazioni e avvia immediatamente il download con progress bar.
   - **Tasto "PIÙ TARDI" / Dismiss**: Chiude il modale e attiva una **freccia in sù (`arrow-up`) animata** con rimbalzo continuo (`Animated.loop`) sopra l'icona Impostazioni del router Expo, lasciando un promemoria visivo discreto ma visibile.
4. **Resilienza Aggiornamenti Manuali & Event Guard**:
   - Convalida rigorosa dell'oggetto manifest in `handleStartDownloadUpdate` e `UpdaterService.downloadApk` per neutralizzare eventi touch (`GestureResponderEvent`) emessi dai bottoni `Pressable`, azzerando l'errore `URL DEL PACCHETTO APK NON DISPONIBILE O NON VALIDO`.
   - Ripristino automatico dello stato `available` al rientro in focus della schermata Impostazioni in caso di errore transitorio, con pulsante per rieseguire la verifica anche a download completato.

---

## 📥 Sistema di Download Episodi, Storage SAF & Visione Offline

Il sottosistema di download e visione offline (`src/services/downloads/` e `app/downloads/index.tsx`) permette di scaricare qualsiasi puntata o intera serie per la riproduzione in locale senza connessione di rete:

### 1. Architettura del Servizio Singleton (`DownloadService`)
- **Coda FIFO Sequenziale (1 Download alla Volta)**: Per evitare il rate limiting dai server di streaming, non saturare la banda dell'utente e avere il primo episodio pronto nel minor tempo possibile, i download vengono accodati sequenzialmente.
- **Risoluzione Automatica alla Massima Risoluzione (Server 9 a 1080p)**: Il servizio interroga lo scraper ed estrae automaticamente il flusso alla massima qualità disponibile (1080p -> 720p -> 480p), con fallback automatico a server secondari in caso di mancata disponibilità dello stream primario.
- **Gestione Stato Reattivo**: Il pattern a sottoscrizione con `subscribe((event) => ...)` garantisce aggiornamenti in tempo reale di progresso percentuale, byte scaricati e velocità a tutti i componenti UI montati.
- **Persistenza Zero-Latency con MMKV**: Il catalogo degli episodi scaricati (`kuro_downloads_catalog`) e le impostazioni (`kuro_download_settings`) risiedono su MMKV per letture e scritture sincrone a latenza zero.

### 2. Archiviazione & Storage Access Framework (SAF)
- **Cartella Predefinita Interna**: Di default, i file vengono archiviati nello storage sandbox protetto dell'applicazione (`${FileSystem.documentDirectory}downloads/${animeId}/ep_${num}.mp4`). Questa soluzione offre massima velocità di I/O, totale assenza di permessi di runtime Android ed è immune da cancellazioni accidentali di app terze.
- **Cartella Personalizzata (SAF)**: L'utente può scegliere una cartella esterna personalizzata (es. memoria interna, cartella di sistema *Download* o scheda MicroSD) tramite Android Storage Access Framework (`FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()`).
- **Protezione Connessione Dati**: L'opzione `wifiOnly` (attiva per impostazione predefinita) verifica lo stato della connessione tramite `expo-network` (`Network.getNetworkStateAsync()`), sospendendo o impedendo il download su rete dati cellulare a consumo.
- **Monitoraggio Spazio Disco**: `getStorageUsage()` aggrega le dimensioni effettive su disco tramite `FileSystem.getInfoAsync` per mostrare l'esatto spazio occupato dai file di Kuro Mobile e lo spazio totale residuo sul dispositivo.

### 3. Integrazione con i Componenti Esistenti
- **Video Player (`app/player/[id].tsx` & `PlayerHeader.tsx`)**:
  - Icona download nell'header OSD per scaricare l'episodio in riproduzione con un singolo tocco.
  - Prioritizzazione automatica del file locale: al caricamento (`loadStream`), `app/player/[id].tsx` verifica l'integrità su disco tramite `DownloadService.resolvePlayableLocalUri()` ed esegue un singolo caricamento su `useVideoPlayer(null)` senza race condition, mostrando il badge **`LOCALE / OFFLINE`** nell'header OSD.
- **Scheda Dettaglio Anime (`app/anime/[id].tsx`, `DownloadOptionsSheet.tsx`, `EpisodeItem.tsx`, `BatchBottomSheet.tsx`)**:
  - Pulsante download nell'intestazione (`navRight`, 44×44 dp) accanto a Preferiti e Condivisione, con modale dedicato `DownloadOptionsSheet` dotato di chiusura swipe-down (`useBottomSheetDragDismiss`).
  - Icona di download e stato visuale su ciascuna card o riga episodio sia in vista griglia (`gridDownloadBtn`) che lista. Premendo nuovamente l'icona durante il download, la coda o la pausa, il download viene annullato all'istante (`cancelDownload`) senza warning o stati di errore.
  - Pre-menù ordinato (*"SCARICA TUTTI"*, *"SCARICA PER BATCH"* con selezione multipla persistente e pulsante **`SCARICA BATCH`** adiacente, *"INTERVALLO PERSONALIZZATO"* `DA` – `A` con steppers e input numerico); `BatchBottomSheet.tsx` resta dedicato esclusivamente al filtro visivo delle batch e integra `useBottomSheetDragDismiss`.
  - Stabilità visiva durante download: gli header della `FlashList` sono passati come elementi JSX memoizzati (`portraitHeaderElement` / `tabletDetailHeaderElement`), `downloadMap` aggiorna lo stato solo alle transizioni effettive di status e `AnimeHeaderBackdrop.tsx` memorizza la `posterSource` con cache `memory-disk` per eliminare ogni refresh/flickering della copertina.
- **Home Header & Impostazioni**:
  - Badge numerico dinamico dei download attivi nell'header della Home con accesso rapido alla schermata dei download.
  - Sezione minimale `DownloadSettingsCard.tsx` nelle Impostazioni con supporto allo scroll automatico (`scrollTo: 'downloads'`) per cambio cartella SAF, toggle Wi-Fi e svuotamento archivio.

### 4. Schermata Offline Dedicata `'SCARICATI'` (`app/downloads/index.tsx`)
- Intitolata **`SCARICATI`** con layout protetto da `minWidth: 0` e troncamento controllato per eliminare overflow e sovrapposizioni su display compatti, presentando per prima la sezione **`EPISODI SALVATI`** seguita da **`IN CORSO & IN CODA`**.
- **`StorageUsageBar.tsx`**: Barra OLED con visualizzazione grafica della quota disco utilizzata dai download rispetto allo spazio libero totale del dispositivo.
- **`ActiveDownloadGroupCard.tsx` & `ActiveDownloadCard.tsx`**: Raggruppamento per serie espandibile (serie attiva in download espansa in cima, altre serie racchiuse di default); all'interno l'episodio in `downloading` rimane sempre in testa seguito in ordine crescente di numero episodio dagli altri episodi in coda racchiusi in un pannello espandibile dedicato. Supporta l'annullamento in blocco di tutti gli episodi attivi/in coda della serie tramite il pulsante **`ANNULLA TUTTI (N EP.)`** (`cancelGroupBtn`) o il controllo rapido sull'header multi-serie (`seriesCancelGroupBtn`, 44×44dp), protetti da `ConfirmModal` in `app/downloads/index.tsx` e collegati a `DownloadService.cancelAnimeDownloads` (preservando gli episodi già completati).
- **`DownloadedAnimeCard.tsx`**: Lista delle serie scaricate raggruppate per anime con locandina, conteggio puntate, peso in MB/GB e tasto rapido *"RIPRODUCI"*.
- **`DownloadedEpisodesSheet.tsx`**: Modale touch-safe a scorrimento (`animationType="fade"`) con `useBottomSheetDragDismiss` a doppia zona e chiusura sincronizzata se il gruppo selezionato si svuota, per consultare l'elenco delle puntate scaricate ed eliminarle singolarmente con aggiornamento istantaneo dello spazio disco.

---

## ☁️ Sincronizzazione Self-Hosted KuroSync (KuroTV_S), MMKV Bridge & Android TV Pairing

Kuro Mobile integra un'architettura completa di sincronizzazione self-hosted multi-dispositivo (**KuroSync**), progettata per dialogare con il backend serverless **KuroTV_S** (eseguito su Cloudflare Workers con database relazionale SQLite D1):

### 1. Architettura Modulare Client (`src/services/sync/`)
- **`device-info.ts`**: Rilevamento dinamico e non generico del modello reale del dispositivo hardware (`getDeviceName()`, `getDeviceMetadata()`), interrogando le costanti native Android (`Manufacturer` e `Model`), scartando identificativi generici e popolando `deviceType: 'mobile'` e `platform: 'android'`.
- **`types.ts`**: Modelli di dati condivisi per record di sincronizzazione, mutazioni, tombstones (`DeltaTombstoneItem`), profili utente (`ProfileItem`), richieste delta pull/push e stati locali (`LocalStorageState`).
- **`client.ts` (`KuroSyncClient`)**: Client HTTP leggero in TypeScript puro basato su API `fetch` e `URL` standard (zero librerie esterne o moduli `node:*`, totale conformità con Hermes). Espone metodi per health check (`checkHealth`), login con master password (`loginWithPassword` / `loginDevice`), scambio token (`exchangeToken`), recupero profili (`listProfiles`), sincronizzazione delta (`pullDelta`, `pushDelta`), cambio profilo (`switchProfile`), revoca sessione (`logout`) e approvazione accoppiamento TV (`approveTvPairing`).
- **`merge.ts` (`mergeLocalAndRemote`)**: Motore di riconciliazione deterministico puro:
  - *Dominanza dei Tombstones*: Se un'entità è stata cancellata (timestamp tombstone $\ge$ timestamp aggiornamento locale/remoto), la rimozione prevale sempre.
  - *Preservazione Stato "IN PARI"*: Quando l'utente ha completato una serie in corso (`isCaughtUp: true`), il merge remoto non retrocede lo stato dell'anime.
  - *Progressione Temporale*: L'avanzamento dei minuti e delle percentuali di visione (`watchProgress`, `continueWatching`) accetta solo progressioni temporali coerenti.
  - *Ordinamento Cronologico Decrescente*: Tutte le collezioni (`favorites`, `continueWatching`, `watchHistory`, `searchHistory`) vengono tassativamente ordinate per `updatedAt` o `timestamp` decrescente, rispettando i contratti di visualizzazione e troncamento dell'app.
- **`sync-manager.ts` (`SyncManager`)**: Orchestratore singleton dello stato di sincronizzazione:
  - **Persistenza Indistruttibile con Self-Healing**: Metodo centralizzato `persistServerUrl` che scrive simultaneamente su `SYNC_SERVER_URL`, sulla chiave di backup persistente MMKV `sync.server_url_backup`, sulla cache volatile `lastKnownServerUrl` e sull'istanza `client`. Catena di fallback a 4 livelli in `ensureClientConfigured()` e vincolo di `isConnected()` a token + serverUrl validi.
  - Gestione credenziali e token su MMKV (`SYNC_DEVICE_TOKEN`, `SYNC_DEVICE_ID`, `SYNC_SERVER_URL`, `SYNC_PROFILE_ID`, `SYNC_PROFILE_NAME`, `SYNC_LAST_TIMESTAMP`).
  - Parsing universale dei deep-link e QR code tramite `parseKuroSyncDeepLink()`: supporta schemi `kurosync://`, link HTTPS della web console, percorsi `/connect` e `/pair`, parametri alternativi (`endpoint=`, `server=`, `serverUrl=`, `baseUrl=`), e payload JSON grezzi.
  - Gestione errori QR con rilevamento HTTP 410 Gone / 404 e messaggio chiaro tramite `ConfirmModal`.

### 2. Strategia di Efficienza per Cloudflare Free-Tier
- **Debounce Playback a 45-60s**: Durante la visione video in `app/player/[id].tsx`, i progressi vengono salvati localmente a ogni secondo, ma l'aggiornamento remoto verso Cloudflare D1 viene accorpato da `recordPlaybackProgress` e inviato solo dopo **almeno 45 secondi** di riproduzione continuativa o a rilevante scostamento di minutaggio.
- **Flush Immediato**: Lo scarico del progresso in sospeso avviene all'istante:
  - Alla messa in pausa del video (`!playing`);
  - Al raggiungimento della soglia di fine episodio ($\ge 90\%$ o soglia ending);
  - Al cambio episodio (`handleNavigateToEpisode`);
  - Allo smontaggio del player video o chiusura dell'app.
- **Pull on Focus & Push on Blur**:
  - In `app/_layout.tsx`, al passaggio in stato `active` viene eseguito `SyncManager.pullDelta()` inviando il timestamp `since` dell'ultimo sync;
  - Al passaggio in stato `background` o `inactive`, viene eseguito `SyncManager.pushPending(true)` per flushare atomicamente mutazioni e delezioni pendenti.

### 3. Storage Bridge con MMKV (`app-storage.ts`) & Riconciliazione
- Tutte le modifiche locali ai Preferiti, Continua a guardare, Cronologia, Ricerche e Impostazioni invocano automaticamente `recordSyncMutation` o `recordSyncDeletion`.
- **Riconciliazione Automatica delle Code**:
  - L'aggiunta di una mutation rimuove l'eventuale tombstone pendente per la medesima chiave;
  - L'aggiunta di una deletion rimuove l'eventuale mutation pendente;
  - La rimozione wildcard dell'intera cronologia di una serie genera tombstones `watch_progress` dedicati per ciascuna puntata memorizzata su MMKV (`user.progress.<animeId>.<ep>`).
- Al completamento del merge delta, `AppStorage.notifyStorageChanged()` risveglia in tempo reale i listener registrati nelle schermate attive (es. Preferiti) senza ricaricamenti manuali.

### 4. UI Impostazioni, Selettore Profili Netflix & Tab Profilo Rapido
- **`SyncSettingsCard.tsx`**: Card principale nelle Impostazioni con pill di stato OLED, URL server, riga interattiva `PROFILO` con pulsante `CAMBIA` (touch target $\ge 44$dp), riga simmetrica su singola riga con *SINCRONIZZA*, *AUTORIZZA TV* e pulsante compatto di disconnessione touch-safe con sola icona `log-out-outline` ($44 \times 44$dp) protetto da `ConfirmModal`.
- **`SyncConnectModal.tsx`**: Modale di connessione snellito con sole due modalità: `QR CODE` (apre istantaneamente la fotocamera a schermo intero) e `MANUALE` (URL + Master Password). Entrambe le modalità conducono alla schermata/selettore profili stile Netflix per finalizzare il bootstrap.
- **`SyncProfileModal.tsx`**: Selettore profili touch-native con transizione atomica protetta (pull delta remoto prima della mutazione MMKV locale).
- **Pulsante Profilo Rapido nella Tab Bar (`app/(tabs)/_layout.tsx`)**: Pulsante dedicato posizionato tra Cronologia e Impostazioni con icona contestuale (`person-circle` / `person`) che permette di cambiare profilo o avviare l'accoppiamento con un solo tap da qualsiasi schermata.
- **`QrScannerModal.tsx`**: Scanner fotocamera basato su `CameraView` di `expo-camera` (v17 / SDK 58, `recordAudioAndroid: false`), mirino centrale OLED, torcia e gestione permessi con redirect a `Linking.openSettings()` se bloccati. Montato come frammento disaccoppiato per azzerare crash di finestre modali annidate su Android Fabric.
- **`AuthorizeTvModal.tsx`**: Modale per autorizzare un dispositivo Android TV inquadrando il QR mostrato sul televisore o digitando il codice a 6 cifre (es. `K7X9P2`) tramite `client.approveTvPairing`.
