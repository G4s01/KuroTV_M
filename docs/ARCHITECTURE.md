# 🏛️ Architettura del Progetto — Kuro Mobile

Kuro Mobile è costruito con un'architettura modulare e moderna, progettata per offrire le massime prestazioni native su Android sfruttando **Expo SDK 58** e la **Nuova Architettura di React Native (TurboModules / Fabric)**.

---

## 📁 Struttura delle Directory

```
KuroM/
├── app/                         # Routing File-Based (Expo Router v58)
│   ├── _layout.tsx              # Root Layout: ThemeProvider, QueryClient, GestureHandler
│   ├── (tabs)/                  # Navigazione a schede inferiori
│   │   ├── _layout.tsx          # Configurazione TabBar con tinte reattive
│   │   ├── index.tsx            # Home: Hero Spotlight, Continua a guardare, Ultime uscite, ricerca unificata & filtri
│   │   ├── explore.tsx          # Palinsesto: Programmazione uscite settimanali con orari previsti, selettore giorni & serie senza data
│   │   ├── favorites.tsx        # Preferiti: Griglia anime salvati in locale
│   │   ├── history.tsx          # Cronologia: Storico di visione e ripresa episodio
│   │   └── settings.tsx         # Impostazioni: Temi SVG, AniSkip, Navbar Android, sorgente (.ac, .so, .tv), info & updater
│   ├── anime/
│   │   └── [id].tsx             # Scheda Dettaglio Anime (Header, Trama, Server, Griglia Puntate)
│   └── player/
│       └── [id].tsx             # Player Video Touch Mobile (Gesture, OSD, PiP, MediaStyle notification, AniSkip)
├── assets/                      # Risorse statiche
│   ├── icons/                   # Icone SVG (temi, youtube, myanimelist, anilist)
│   └── images/                  # Icone app Android, Splash screen e banner
├── src/                         # Moduli core dell'applicazione
│   ├── components/              # Componenti UI riutilizzabili (FlashList items, Modali touch-native)
│   │   ├── anime/               # Moduli dettaglio anime (Backdrop, Synopsis, AnimeInfoTable, Controls)
│   │   ├── player/              # Moduli isolati video player (Header, Timeline, Footer, Carousel, Info)
│   │   ├── skeleton/            # Primitive e layout skeleton animati (Zero CLS, OLED #161616)
│   │   ├── FilterBottomSheet.tsx# Modale filtri di ricerca touch-safe
│   │   ├── UpdateModal.tsx      # Modale notifica aggiornamento in-app all'avvio
│   │   ├── HistorySlider.tsx    # Slider discreto retention cronologia (OFF, 30g, 60g, 90g, ON)
│   │   └── AniSkipSlider.tsx    # Slider modalità salto sigle (OFF, MANUALE, AUTO)
│   ├── services/
│   │   ├── anilist/             # Integrazione metadata AniList GraphQL
│   │   ├── aniskip/             # Servizio timestamp per skip intro/outro/recap
│   │   ├── kitsu/               # Metadata e trending Kitsu API
│   │   ├── queries/             # QueryOptions TanStack React Query v5
│   │   ├── scraper/             # Web Scraper AnimeWorld con cheerio/slim
│   │   ├── storage/             # Storage locale a zero-latenza MMKV v3
│   │   └── updater/             # Client OTA manifest, update store reattivo e download APK
│   ├── theme/                   # Sistema di stili reattivo e ThemeProvider
│   └── types/                   # Definizioni TypeScript condivise
├── workers/                     # Cloudflare Worker unificato per OTA
├── scripts/                     # Tooling DevOps, release pipeline & patch native (apply-patches, build-release)
└── tests/                       # Suite di verifica qualità a 15 stadi
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
Tutti i dati persistenti lato client (preferiti, avanzamento episodi, cronologia di riproduzione, server preferito e impostazioni) risiedono in istanze sincrone di **MMKV**:
- Nessun tempo di attesa o promise asincrona per leggere lo stato dei preferiti.
- Salvataggio dello stato di riproduzione (tempo corrente, percentuale di avanzamento e data ultimo accesso) ad ogni aggiornamento della timeline video.

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
- **Bi-directional Focus Sync**:
  - Scorrendo il carosello dei raccomandati numerati (`#1` ... `#8`), l'evento `handleRecommendedScroll` calcola l'indice di destinazione e anima lo slider Hero (`heroScrollRef.current.scrollTo`).
  - Scorrendo lo slider Hero a swipe orizzontale, l'evento `handleHeroScroll` calcola la pagina corrente e sincronizza il carosello compatto sottostante (`recommendedScrollRef.current.scrollTo`).
- **Loop-Guard contro Feedback Loop Infiniti**:
  - Un riferimento mutabile `activeScrollSourceRef` (`'hero' | 'recommended' | 'tap' | null`) traccia l'origine della gesture in tempo reale, azzerando qualsiasi scatto, jitter o re-triggering incrociato degli eventi di scroll.
- **Snapping Touch Nativo & Dynamic Right Padding**:
  - Il carosello numerato adotta `snapToOffsets` calcolato sulla larghezza di ciascun blocco (`124dp = 112 + 12`).
  - Il padding destro del contenitore è calcolato dinamicamente con `Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)`, permettendo alle ultime due schede (#7 e #8) di scorrere liberamente fino al punto di focus senza essere respinte dal limite dello scroll.

### 3. Organizzazione delle Sezioni & Scraper Stagionale (`/upcoming`)
- **Sezioni Verticali**:
  1. Hero Banner Spotlight (Top 8).
  2. Carosello Raccomandati numerati progressivamente (`#1` ... `#8`).
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

## 📅 Palinsesto & Programmazione Settimanale (`app/(tabs)/explore.tsx`)

La schermata Palinsesto visualizza la programmazione delle uscite anime settimanali con gli orari previsti da AnimeWorld (`animeworld.ac/schedule`):

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
- **Selettore Giorni Orizzontale**: Scorrimento touch dei giorni (`LUN` ... `DOM`) con badge del numero uscite e pill `OGGI` attivo con auto-selezione della data odierna. Include la tab per le serie `SENZA DATA`.
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
   - Quando impostato su `'OFF'`, la registrazione dei progressi viene bloccata e la tab **Cronologia** scompare istantaneamente dalla barra di navigazione inferiore (`href: null` in `app/(tabs)/_layout.tsx`) tramite listener di storage sincrono.
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
   - Implementato come Bottom Sheet modale basato su React Native `Modal` (`animationType="slide"`), risolvendo alla radice le interferenze di touch/gesture del `ModalBottomSheet` nativo di Compose su Android/Expo Go.
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
- **Controlli Multimediali in Notifica & Patch Native (`scripts/apply-patches.mjs`)**: Espone `showNowPlayingNotification = true` e metadati completi dello stream (titolo `<Titolo> - EPISODIO <Num>`, artista, locandina artwork scaricata e serializzata come JPEG byte array in `artworkData` per i Quick Settings di Android 13+ e bitmap `largeIcon`), e `KuroForwardingPlayer` che garantisce la disponibilità permanente di `COMMAND_SEEK_TO_NEXT` e `COMMAND_SEEK_TO_PREVIOUS` per esporre nel cassetto delle notifiche e nei controlli di sistema Android l'intera barra simmetrica (`seek -10s`, `precedente`, `play/pausa`, `successivo`, `seek +10s`), con ascoltatori dedicati `KuroNotificationNextEpisode` e `KuroNotificationPrevEpisode`.
- **Scheda Dettagli Player (`PlayerInfoSheet.tsx`)**: Badge puntata formattato rigorosamente come `'EPISODIO X/TOT'` (es. `'EPISODIO 1/170'`, `'EPISODIO 1/??'`), pulito da suffissi titolo puntata ridondanti.
- **AniSkip con Slider a Scorrimento**: Rileva sigle d'apertura (`op`), chiusura (`ed`) e recap (`recap`) con pulsante unico 'SALTA', timer ad esaurimento limitato a 10s, e configurazione in Impostazioni tramite il componente a scorrimento `AniSkipSlider` (`OFF`, `MANUALE`, `AUTO`).

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
