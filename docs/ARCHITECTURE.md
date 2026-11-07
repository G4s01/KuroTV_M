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
│   │   └── settings.tsx         # Impostazioni: Cambio temi SVG, TLD, stato OTA
│   ├── anime/
│   │   └── [id].tsx             # Scheda Dettaglio Anime (Header, Trama, Server, Griglia Puntate)
│   └── player/
│       └── [id].tsx             # Player Video Touch Mobile (Gesture, OSD, PiP, AniSkip)
├── assets/                      # Risorse statiche
│   ├── icons/                   # Icone SVG dei temi (theme-oled, theme-pikachu, ...)
│   └── images/                  # Icone app Android, Splash screen e banner
├── src/                         # Moduli core dell'applicazione
│   ├── components/              # Componenti UI riutilizzabili (FlashList items, BottomSheets)
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
└── tests/                       # Suite di verifica qualità a 6 stadi
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
