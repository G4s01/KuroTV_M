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
│   │   ├── index.tsx            # Home: Hero Spotlight, Continua a guardare, Ultime uscite
│   │   ├── explore.tsx          # Esplora: Ricerca istantanea e filtri generi
│   │   ├── favorites.tsx        # Preferiti: Griglia anime salvati in locale
│   │   ├── history.tsx          # Cronologia: Storico di visione e ripresa episodio
│   │   └── settings.tsx         # Impostazioni: Temi iconici SVG, sorgente scraping (.ac, .so, .tv o URL), info app e updater unificato
│   ├── anime/
│   │   └── [id].tsx             # Scheda Dettaglio Anime (Header, Trama, Server, Griglia Puntate)
│   └── player/
│       └── [id].tsx             # Player Video Touch Mobile (Gesture, OSD, PiP, AniSkip)
├── assets/                      # Risorse statiche
│   ├── icons/                   # Icone SVG dei temi (theme-oled, theme-pikachu, ...)
│   └── images/                  # Icone app Android, Splash screen e banner
├── src/                         # Moduli core dell'applicazione
│   ├── components/              # Componenti UI riutilizzabili (FlashList items, BottomSheets)
│   │   ├── anime/               # Moduli dettaglio anime (Backdrop, Synopsis, AnimeInfoTable, Controls)
│   │   ├── player/              # Moduli isolati video player (Header, Timeline, Footer, Carousel, Info)
│   │   ├── skeleton/            # Primitive e layout skeleton animati (Zero CLS, OLED #161616)
│   │   └── HistorySlider.tsx    # Slider discreto retention cronologia (OFF, 30g, 60g, 90g, ON)
│   ├── services/
│   │   ├── anilist/             # Integrazione metadata AniList GraphQL
│   │   ├── aniskip/             # Servizio timestamp per skip intro/outro
│   │   ├── kitsu/               # Metadata e trending Kitsu API
│   │   ├── queries/             # QueryOptions TanStack React Query v5
│   │   ├── scraper/             # Web Scraper AnimeWorld con cheerio/slim
│   │   ├── storage/             # Storage locale a zero-latenza MMKV v3
│   │   └── updater/             # Client OTA manifest e download APK
│   ├── theme/                   # Sistema di stili reattivo e ThemeProvider
│   └── types/                   # Definizioni TypeScript condivise
├── workers/                     # Cloudflare Worker unificato per OTA
├── scripts/                     # Tooling DevOps & pipeline di release (build-release.sh, backup R2, upload)
└── tests/                       # Suite di verifica qualità a 7 stadi
```

---

## 🔄 Flusso dei Dati & Data Fetching

### 1. TanStack React Query v5
Il data fetching remoto sfrutta `@tanstack/react-query` v5 per garantire caching intelligente, deduplicazione delle richieste e gestione trasparente degli stati di caricamento/errore:

- **Dettagli Anime**: `['anime', 'detail', animeId]` — stale time a 10 minuti.
- **Home & Trending**: `['home', 'feed']` — stale time a 5 minuti con supporto a `RefreshControl`.
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
   - `HomeScreenSkeleton`: modella l'Hero Banner Spotlight (280dp) privo di margini verticali divergenti, supporta la sezione condizionale *Riprendi a guardare* (`hasContinueWatching`) con card a 160x96dp per preservare lo spazio prima del fetch remoto, e allinea il padding orizzontale a `paddingLeft: 16, paddingRight: 4` per combaciare perfettamente con il carosello reale.
   - `ExploreScreenSkeleton`: griglia a 2 colonne sincronizzata con la larghezza schermo `(windowWidth - 44) / 2` con `padding: 0` interno per eliminare il doppio padding rispetto a `styles.listContent` (16dp).
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

## 📋 Scheda Tecnica & Metadati Estesi Anime (`AnimeInfoTable`)

La schermata Dettaglio Anime arricchisce la consultazione con il componente [`AnimeInfoTable`](file:///home/g4s/VSCode/KuroM/src/components/anime/AnimeInfoTable.tsx):

1. **Tabella Tecnica a 4 Righe con Generi Scorrevoli**:
   - Visualizza in griglia compatta: **Audio**, **Stato**, **Uscita**, **Durata**, **Studio**, **Episodi**, **Voto** e **Genere**.
   - La cella *Genere* adotta uno `ScrollView` orizzontale con `nestedScrollEnabled={true}` e `showsHorizontalScrollIndicator={false}`, consentendo la consultazione dell'elenco completo dei generi senza tagli o espansioni verticali anomale.
   - Tutti i valori sono estratti con fallback sicuri su Hermes dallo scraper HTML AnimeWorld.
2. **Controlli di Avvio Rapido nell'Header (`AnimeHeaderBackdrop`)**:
   - I generi testuali sotto il titolo sono stati rimossi a favore di una riga di comandi touch dedicati: pulsante di riproduzione continua (**Play** `play`) e pulsante di riavvio dall'episodio 1 (**Restart** `reload`), entrambi a soli simboli con target $\ge 44$dp.
   - Eliminato il pulsante play ridondante a fondo schermata, offrendo un layout compatto e focalizzato.
3. **Selettore Batch Puntate Touch-Native (`BatchBottomSheet`)**:
   - Implementato come Bottom Sheet modale basato su React Native `Modal` (`animationType="slide"`), risolvendo alla radice le interferenze di touch/gesture del `ModalBottomSheet` nativo di Compose su Android/Expo Go.
   - Rimosse le sezioni correlate non pertinenti per focalizzare la visualizzazione esclusivamente sulle batch numeriche delle puntate.
   - FlashList degli episodi configurata con `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash nativi Fabric/Hermes allo scroll rapido.
4. **Link Esterni & Condivisione Intelligente**:
   - Pulsanti dedicati per l'apertura rapida di **Trailer YouTube** ufficiale, scheda **MyAnimeList** e scheda **AniList**.
   - Il pulsante di condivisione (`Share.share`) dell'URL AnimeWorld originale è posizionato nell'header superiore accanto al cuore dei preferiti, garantendo un'interfaccia pulita e minimale sotto la tabella.

---

## 🎬 Video Player & Streaming Asincrono (`replaceAsync`)

Il sottosistema video ([`app/player/[id].tsx`](file:///home/g4s/VSCode/KuroM/app/player/[id].tsx)) adotta la gestione asincrona delle sorgenti multimediali:
- **`replaceAsync` off-thread**: Sostituisce il metodo deprecato `player.replace` per prevenire il blocco del Main Thread durante l'inizializzazione dei formati video su iOS e Android.
- **Gestione Stream & Ripresa**: Mantiene sincronizzato il `playbackRate` e applica il punto di ripresa memorizzato in MMKV al completamento della risoluzione della risorsa, senza glitch visivi.
