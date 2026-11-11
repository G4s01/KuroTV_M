# 🗺️ Roadmap: Potenziali Ottimizzazioni, Refactor & Migliorie Architetturali

> **Nota per i futuri agenti**: Questo documento raccoglie in modo ordinato e modulare le ottimizzazioni, i refactor e le migliorie architetturali identificate sulla codebase **Kuro Mobile**. Ogni step è progettato per essere affrontato in modo indipendente, garantendo il rispetto tassativo delle regole di [`AGENTS.md`](../AGENTS.md) (OLED puro `#000000`, Mobile-First, Virtualizzazione obbligatoria, Typography Monospace & CAPS LOCK, Zero regressioni).

---

## 📌 Indice degli Step Operativi

- [Step 1: Isolamento del Re-Render nel Video Player (OSD & Timeline)](#-step-1-isolamento-del-re-render-nel-video-player-osd--timeline)
- [Step 2: Pre-fetching Proattivo delle Immagini con `expo-image`](#-step-2-pre-fetching-proattivo-delle-immagini-con-expo-image)
- [Step 3: Architettura Multi-Scraper & Registro dei Provider](#-step-3-architettura-multi-scraper--registro-dei-provider)
- [Step 4: Pulizia Automatica Storage MMKV (LRU / TTL Progressi)](#-step-4-pulizia-automatica-storage-mmkv-lru--ttl-progressi)
- [Step 5: Modularizzazione Dettaglio Anime & Batching Episodi](#-step-5-modularizzazione-dettaglio-anime--batching-episodi)
- [Step 6: Ottimizzazioni di Rete, Resilienza Scraper & Retry Adattivo](#-step-6-ottimizzazioni-di-rete-resilienza-scraper--retry-adattivo)
- [Step 7: Gestione Cronologia Touch, Retention Slider & Rimozione In-App](#-step-7-gestione-cronologia-touch-retention-slider--rimozione-in-app)
- [Step 8: Scheda Tecnica Dettaglio & Metadati Estesi (`AnimeInfoTable`)](#-step-8-scheda-tecnica-dettaglio--metadati-estesi-animeinfotable)
- [Step 9: Streaming Asincrono (`replaceAsync`) & Rifinitura UX Dettaglio](#-step-9-streaming-asincrono-replaceasync--rifinitura-ux-dettaglio)
- [Step 10: Ridefinizione Schermata Home, Hero Swiper Sincronizzato & Scraper Stagionali (`/upcoming`)](#-step-10-ridefinizione-schermata-home-hero-swiper-sincronizzato--scraper-stagionali-upcoming)
- [Step 11: Palinsesto Settimanale (`animeworld.ac/schedule`), AniSkip Condizionale & Hardening Aggiornamenti Manuali](#-step-11-palinsesto-settimanale-animeworldacschedule-aniskip-condizionale--hardening-aggiornamenti-manuali)
- [Step 12: Ottimizzazione Carosello Raccomandati, Risoluzione Scroll Deadlock & Layout Stabile](#-step-12-ottimizzazione-carosello-raccomandati-risoluzione-scroll-deadlock--layout-stabile)
- [Step 13: Rifacimento Ricerca, Cronologia Google-Style, Filtri Multipli & Hardening Scraper](#-step-13-rifacimento-ricerca-cronologia-google-style-filtri-multipli--hardening-scraper)
- [Step 14: De-monolizzazione Schermate Home/Impostazioni, Unificazione Slider & Pulizia Codice Morto](#-step-14-de-monolizzazione-schermate-homeimpostazioni-unificazione-slider--pulizia-codice-morto)

---

## ⚡ Step 1: Isolamento del Re-Render nel Video Player (OSD & Timeline)

### 🎯 Obiettivo
Eliminare i re-render periodici dell'intero albero del video player durante la riproduzione a controlli OSD visibili.

### 🔍 Stato Attuale
In [`app/player/[id].tsx`](../app/player/[id].tsx), l'evento `timeUpdate` di `expo-video` emette un aggiornamento ogni $500$ms (`timeUpdateEventInterval = 0.5`).
L'aggiornamento imposta lo state `currentTime`:
```tsx
setCurrentTime(time);
```
Quando l'interfaccia OSD è visibile (`showControls === true`), l'intero componente root della schermata `VideoPlayerScreen` esegue un re-render ogni $0.5$ secondi per ridisegnare la barra di progresso e il testo `MM:SS / MM:SS`.

### 🛠️ Piano di Refactor
1. **Estrazione di `PlayerTimeline` & `PlayerTimeDisplay`**:
   - Creare [`src/components/player/PlayerTimeline.tsx`](../src/components/player/PlayerTimeline.tsx) e [`src/components/player/PlayerHeader.tsx`](../src/components/player/PlayerHeader.tsx).
   - Gestire l'avanzamento della timeline tramite uno store locale leggero o callback mirato, lasciando il container principale e `VideoView` liberi da re-render di frequenza.
2. **Memoization dei Controlli Header & Footer**:
   - Avvolgere l'header e i pulsanti azione dell'OSD in `React.memo` con comparazione mirata sulle sole prop di stato (`isPlaying`, `playbackSpeed`, `animeTitle`).

### 🧪 Criteri di Accettazione
- La riproduzione e lo scrubbing rimangono reattivi a 60/120 FPS costanti.
- Le gesture pan (volume e luminosità) rimangono disabilitate quando l'OSD è visibile (`panGesture.enabled(!showControls)`).
- `npm test` ed `npx expo export --platform android` completati con successo.

---

## 🖼️ Step 2: Pre-fetching Proattivo delle Immagini con `expo-image`

### 🎯 Obiettivo
Eliminare qualsiasi latenza visiva di caricamento delle locandine durante il primo scroll nelle schede **Home** ed **Esplora**.

### 🔍 Stato Attuale
Le locandine (`AnimeCard`) caricano le immagini al momento del montaggio nel viewport. Gli skeleton (`AnimeCardSkeleton`, `HomeScreenSkeleton`) mascherano ottimamente il caricamento, ma la rete richiede comunque alcuni millisecondi per scaricare i byte remoti di AnimeWorld.

### 🛠️ Piano di Refactor
1. **Pre-fetching in Background post-query**:
   - In [`app/(tabs)/index.tsx`](../app/(tabs)/index.tsx), appena `homeData` è disponibile, estrarre gli URL dei primi 6 elementi delle liste *"In Tendenza"* e *"Nuove Aggiunte"*.
   - Invocare `Image.prefetch(urls)` in un effetto non bloccante.
2. **Pre-fetching Risultati di Ricerca**:
   - In [`app/(tabs)/explore.tsx`](../app/(tabs)/explore.tsx), eseguire il prefetch dei primi 4 risultati di ricerca quando la query TanStack Query va a buon fine.

### 🧪 Criteri di Accettazione
- Le locandine principali appaiono istantaneamente già calde in cache memoria/disco.
- Nessun incremento anomalo della memoria heap di Hermes.

---

## 🌐 Step 3: Architettura Multi-Scraper & Registro dei Provider

### 🎯 Obiettivo
Rendere Kuro Mobile estendibile per supportare sorgenti di streaming alternative ad AnimeWorld (es. AnimeUnity, provider terzi) mantenendo l'interfaccia utente totalmente disaccoppiata.

### 🔍 Stato Attuale
In [`src/components/ServerBottomSheet.tsx`](../src/components/ServerBottomSheet.tsx) la selezione server è stata disabilitata con la prop:
```tsx
showServerSelection={false}
```
Questa architettura è già predisposta per non mostrare selettori finché non esistono fonti multiple stabili.

### 🛠️ Piano di Refactor
1. **Definizione dell'Interfaccia Unificata**:
   - Creare [`src/services/scraper/types.ts`](../src/services/scraper/types.ts):
     ```ts
     export interface AnimeProvider {
       readonly id: string;
       readonly name: string;
       getHome(): Promise<AnimeHomePage>;
       getAnimeDetail(animeId: string): Promise<AnimeDetail | null>;
       search(query: string | SearchFilter): Promise<AnimeSearchResult>;
       resolveVideo(episode: Episode, serverId?: string): Promise<{ url: string } | null>;
     }
     ```
2. **Creazione di un Provider Registry**:
   - Implementare `ProviderRegistry` per gestire i provider registrati con provider primario predefinito (`AnimeWorldScraper`) e fallback automatico in caso di downtime o blocchi Cloudflare.
3. **Riattivazione della Selezione Server**:
   - Impostare `showServerSelection={true}` nel Bottom Sheet del player non appena un provider secondario è operativo.

### 🧪 Criteri di Accettazione
- Zero dipendenze Node Standard Library (`cheerio/slim` + `htmlparser2` obbligatorio).
- Switch sorgente trasparente senza riavvio dell'applicazione.

---

## 🧹 Step 4: Pulizia Automatica Storage MMKV (LRU / TTL Progressi)

### 🎯 Obiettivo
Prevenire l'accumulo infinito di dati di watch progress nello storage MMKV per utenti che guardano centinaia di serie ed episodi.

### 🔍 Stato Attuale
In [`src/services/storage/index.ts`](../src/services/storage/index.ts), `saveWatchProgress` memorizza un oggetto per ogni episodio visto. Con anni di utilizzo continuo, le chiavi potrebbero crescere senza limite.

### 🛠️ Piano di Refactor
1. **Metodo `pruneOldProgress(maxItems = 200)`**:
   - Aggiungere a `AppStorage` una funzione di manutenzione leggera che ordina per `updatedAt` i progressi salvati ed elimina le puntate completate (`isCompleted === true`) più vecchie di 60/90 giorni se il totale supera una soglia definita.
2. **Esecuzione Non Bloccante**:
   - Invocare la pulizia in background una sola volta all'avvio dell'applicazione all'interno di [`app/_layout.tsx`](../app/_layout.tsx).

### 🧪 Criteri di Accettazione
- Le serie attualmente in corso in *"Riprendi a guardare"* non vengono mai eliminate.
- Mantenimento della latenza zero tipica di MMKV sincrono.

---

## 📑 Step 5: Modularizzazione Dettaglio Anime & Batching Episodi

### 🎯 Obiettivo
Snellire [`app/anime/[id].tsx`](../app/anime/[id].tsx) (attualmente oltre 700 righe di codice) estraendo sezioni visive indipendenti.

### 🛠️ Piano di Refactor
1. **Estrazione Sezioni in Componenti Dedicati**:
   - `AnimeHeaderBackdrop.tsx`: Immagine backdrop con gradient overlay, rating, titolo e pulsanti di condivisione/preferiti.
   - `AnimeSynopsis.tsx`: Testo trama con toggle "Leggi di più / Mostra meno".
   - `AnimeControlsBar.tsx`: Selettore modalità lista/griglia e apertura `BatchBottomSheet`.
2. **Miglioramento Batching per Serie Lunghissime (+500 Episodi)**:
   - Per anime come *One Piece*, calcolare i batch da 50 puntate con memoization pura per evitare ricalcoli inutili al cambio filtro o scroll.

### 🧪 Criteri di Accettazione
- Identico aspetto grafico e zero Cumulative Layout Shift (CLS).
- Mantenimento degli skeleton dedicati ([`AnimeDetailScreenSkeleton`](../src/components/skeleton/AnimeDetailScreenSkeleton.tsx)).

---

## 🛡️ Step 6: Ottimizzazioni di Rete, Resilienza Scraper & Retry Adattivo

### 🎯 Obiettivo
Migliorare la gestione di rate-limiting e failover automatico verso i domini mirror di AnimeWorld (`.ac`, `.so`, `.tv`).

### 🛠️ Piano di Refactor
1. **Fallback Automatico del TLD in Scraper**:
   - Se una richiesta restituisce errore HTTP 502/503 o timeout di connessione su un TLD (es. `.ac`), tentare automaticamente con backoff esponenziale sui domini alternativi configurati (`.so`, `.tv`) aggiornando `scraperConfig`.
2. **Header User-Agent Dinamico**:
   - Sincronizzare lo User-Agent dello scraper con l'architettura reale dello smartphone (Android 14/15/16 arm64) per evitare blocchi bot o risposte anomale.

---

## 📜 Step 7: Gestione Cronologia Touch, Retention Slider & Rimozione In-App

### 🎯 Obiettivo
Fornire all'utente pieno controllo sulla conservazione della cronologia di visione tramite slider interattivo nelle impostazioni e consentire la rimozione rapida dei singoli elementi con gesture touch native e conferme integrate nello stile dell'app.

### 🛠️ Piano di Refactor & Implementazione
1. **Componente Slider Retention (`HistorySlider.tsx`)**:
   - Selettore a 5 posizioni discrete: `'OFF'` (`-1`), `30gg`, `60gg`, `90gg` e `'ON'` (`0`, conservazione illimitata).
   - Reattività istantanea: al passaggio a `'OFF'`, la tab **Cronologia** viene immediatamente nascosta dalla barra di navigazione e protetta da accessi diretti tramite `<Tabs.Protected guard={isHistoryEnabled}>` in `app/(tabs)/_layout.tsx`.
2. **Eliminazione Touch e Swipe-to-Delete**:
   - Pulsante dedicato con icona `remove-circle-outline` su ciascuna card con area di tocco minima $\ge 44$dp.
   - Gesture swipe orizzontale per cancellazione rapida con feedback aptico.
3. **Modale di Conferma Integrato**:
   - Sostituzione di qualsiasi allarme nativo grezzo (`Alert.alert`) con un modale coerente con il design system (`theme.colors.surface`, monospace, contrasto YIQ).

---

## 📋 Step 8: Scheda Tecnica Dettaglio & Metadati Estesi (`AnimeInfoTable`)

### 🎯 Obiettivo
Arricchire la scheda dettaglio anime con metadati tecnici strutturati, link multimediali rapidi e condivisione ottimizzata.

### 🛠️ Piano di Refactor & Implementazione
1. **Estrazione Metadati da Scraper (`detail.parser.ts`)**:
   - Parsing ed estrazione di: Audio, Uscita, Studio, Genere, Voto, Durata, Episodi, Stato, Trailer YouTube, ID/Link MyAnimeList e AniList.
2. **Componente `AnimeInfoTable`**:
   - Tabella ordinata a 4 righe e 2 colonne su superficie OLED ad alto contrasto.
   - Pulsanti esterni dedicati per Trailer YouTube, MyAnimeList e AniList.
3. **Condivisione Pulita nell'Header**:
   - Rimozione di pulsanti ridondanti sotto la tabella; collocazione dell'azione di condivisione (`Share.share`) nell'header superiore accanto al cuore dei preferiti.

---

## 🚀 Step 9: Streaming Asincrono (`replaceAsync`) & Rifinitura UX Dettaglio

### 🎯 Obiettivo
Eliminare i blocchi sincroni sul Main Thread durante la risoluzione del flusso video nel player ed eliminare qualsiasi collisione di gesture o crash nei dialoghi modali e nelle liste della schermata Dettaglio Anime.

### 🛠️ Piano di Refactor & Implementazione
1. **Adozione di `player.replaceAsync` nel Player Video**:
   - Sostituire il metodo deprecato `player.replace(url)` di `expo-video` con `await player.replaceAsync(url)` protetto da fallback e catch degli errori per evitare blocchi nativi dell'interfaccia UI.
2. **Scorrimento Orizzontale dei Generi in `AnimeInfoTable`**:
   - Integrare uno `ScrollView` orizzontale con `nestedScrollEnabled={true}` nella cella 'Genere' per visualizzare tutti i generi senza troncamenti grafici o alterazione delle proporzioni della tabella.
3. **Pulsanti di Avvio Rapido Simbolici in `AnimeHeaderBackdrop`**:
   - Rimuovere i generi testuali sotto il titolo; inserire una riga con il pulsante **Play** (`play`) per continuare la visione e il pulsante di **Riavvio da capo** (`reload`) per partire dall'episodio 1, entrambi a soli simboli e touch target $\ge 44$dp. Rimuovere il tasto play ridondante a fondo schermata.
4. **Modalità Batch Touch-Native (`BatchBottomSheet`)**:
   - Sostituire il `ModalBottomSheet` Compose con un componente modale React Native touch-native (`Modal`, successivamente consolidato con `animationType="fade"` e `useBottomSheetDragDismiss` per evitare doppi slide-out Android allo swipe-down), eliminando le sezioni correlate e garantendo la selezione istantanea ad ogni tocco senza crash in Expo Go o su device.
   - Configurare `maintainVisibleContentPosition={{ disabled: true }}` su `FlashList` degli episodi per prevenire crash su Android con Nuova Architettura Fabric.

---

## 🏠 Step 10: Ridefinizione Schermata Home, Hero Swiper Sincronizzato & Scraper Stagionali (`/upcoming`)

### 🎯 Obiettivo
Allineare l'interfaccia Home agli standard del sito AnimeWorld moderno con una presentazione in evidenza (#1 della top 8 dei raccomandati), carosello compatto numerato con focus bi-direzionale continuo, supporto alle uscite stagionali (`/upcoming`) con scraper arricchito ed estrazione titoli robusta anti-corruzione.

### 🛠️ Piano di Refactor & Implementazione
1. **Hero Swiper Orizzontale a Paging**:
   - `ScrollView` orizzontale a tutta larghezza con `pagingEnabled={true}` e `heroScrollRef`.
   - Pulsanti integrati `RIPRODUCI` (con feedback visivo, ripresa da cronologia o fetch ep. 1 con `serverId`) e `INFO` (navigazione a `/anime/[id]`), attivabile anche al tocco del banner.
2. **Carosello Numerato & Sincronizzazione Bi-direzionale**:
   - Sincronizzazione fluida tra Hero Swiper e Carosello Numerato (`#1` ... `#8`).
   - Gestione `activeScrollSourceRef` (`'hero' | 'recommended' | 'tap'`) per eliminare loop di scroll o jitter.
   - Snapping nativo (`snapToOffsets`) e padding destro dinamico per permettere a schede #7 e #8 di raggiungere la posizione di focus.
3. **Scraper Stagionale & Isolamento Titoli**:
   - Supporto per `.film-listnext .item` in `search.parser.ts` per recuperare tutti gli oltre 80 anime della sezione `/upcoming`.
   - Isolamento stringente dei titoli testuali per escludere badge `DUB`/`Special` collocati nei tag `<a class="poster">`.
4. **Zero Cumulative Layout Shift (CLS)**:
   - Aggiornamento di `HomeScreenSkeleton` a 320dp con repliche dei pulsanti Play/Info e del carosello numerato.

---

## 📅 Step 11: Palinsesto Settimanale (`animeworld.ac/schedule`), AniSkip Condizionale & Hardening Aggiornamenti Manuali

### 🎯 Obiettivo
Esporre la programmazione settimanale completa delle uscite con gli orari previsti da AnimeWorld nella tab Palinsesto (`app/(tabs)/explore.tsx`), rifinire l'interfaccia delle impostazioni AniSkip mostrando i controlli accessori unicamente quando pertinenti, e correggere il crash/errore transitorio dell'updater manuale legato alla cattura di eventi sintetici.

### 🛠️ Piano di Refactor & Implementazione
1. **Scraper & Parser Palinsesto (`schedule.parser.ts` & `animeworld-scraper.ts`)**:
   - Estrazione con `cheerio/slim` ed engine `htmlparser2` di settimana, prossima uscita in evidenza (`.sch-hero`), timeline dei 7 giorni della settimana (`.sch-days > section.sch-day`), stati episodio (`is-done` -> `released`, `is-pause` -> `paused`) e serie in corso senza giorno fisso (`.sch-unk` -> `unscheduled`).
   - Caching sincrono su MMKV (`cache.scheduleData`) e opzioni query `scheduleQueryOptions()` con stale time a 10 minuti.
2. **Interfaccia Touch-Native Palinsesto (`app/(tabs)/explore.tsx`)**:
   - Re-integrazione della rotta `explore` come tab principale **Palinsesto** con icona `calendar`.
   - Banner Hero opzionale *Prossima Uscita* con pill fiammella e countdown/orario programmato.
   - Selettore orizzontale a scorrimento per i giorni della settimana con etichetta compatta giorno e numero (es. `SAB 14`, `LUN 9`) senza numero di uscite e con indicatore `OGGI`.
   - Timeline virtualizzata con `@shopify/flash-list` e card orario dedicate.
   - Skeleton loading dedicato `ScheduleScreenSkeleton` a zero Cumulative Layout Shift (CLS).
3. **Visibilità Condizionale Controlli AniSkip (`settings.tsx`)**:
   - Sezione slider durata popup visibile esclusivamente quando la modalità è impostata su `'MANUALE'`.
   - Sezione chip `COSA SALTARE` nascosta quando la modalità è impostata su `'OFF'`.
4. **Hardening Updater Manuale & Guard Sintetici (`settings.tsx` & `updater-service.ts`)**:
   - Protezione di `handleStartDownloadUpdate` contro il passaggio di oggetti evento `GestureResponderEvent` emessi da bottoni touch `Pressable`.
   - Convalida rigorosa `isManifest` che verifica la presenza delle proprietà essenziali di `UpdateManifest`.
   - Ripristino automatico dello stato `available` al rientro in focus della schermata impostazioni se era presente un errore transitorio, e opzione di nuova verifica dopo il download.

---

---

## 🏎️ Step 12: Ottimizzazione Carosello Raccomandati, Risoluzione Scroll Deadlock & Layout Stabile

### 🎯 Obiettivo
Risolvere il blocco e crash immediato dell'applicazione durante lo scorrimento del carosello nella schermata Home, ridenominare la sezione da `TOP RACCOMANDATI` a `RACCOMANDATI`, stabilizzare la sincronizzazione bi-direzionale tramite settling differito ed eliminare il layout thrashing su Android Fabric.

### 🛠️ Piano di Refactor & Implementazione
1. **Ridenominazione Sezione `RACCOMANDATI`**:
   - Aggiornamento dell'intestazione grafica da `TOP RACCOMANDATI` a `RACCOMANDATI` in `app/(tabs)/index.tsx`, e aggiornamento degli assert nei test di integrazione (`tests/core-verification.test.ts`).
2. **Sincronizzazione allo Settling (Anti Ping-Pong Loop)**:
   - Eliminazione dell'animazione incrociata a 60 FPS durante `onScroll`: `heroScrollRef` non viene più forzato a scorrere a ogni fotogramma intermedio del trascinamento del carosello.
   - Introduzione di `settleRecommendedScroll` e `settleHeroScroll`, invocati unicamente quando il movimento si ferma (gestione combinata di `onMomentumScrollEnd` e `onScrollEndDrag` con verifica di velocità per Android).
   - Estensione del lock `activeScrollSourceRef` con timeout protetto a 450ms (`resetSourceTimeoutRef`) per coprire l'intera durata dell'animazione programmata ed evitare rimbalzi inversi.
   - Pulizia dei timer pendenti in `useEffect` in fase di unmount.
3. **Memoizzazione Stabile `snapToOffsets`**:
   - Creazione di `recommendedSnapOffsets` con `useMemo` per azzerare il re-istanziamento dell'array di snapping su React Native Fabric.
4. **Bordo Stabile a 2dp & Zero `requestLayout`**:
   - `styles.recommendedCard` fissa `borderWidth: 2` a livello statico, variando esclusivamente `borderColor` al cambio focus per eliminare le invalidazioni di layout del motore Android durante lo scroll inerziale.

---

## 🔍 Step 13: Rifacimento Ricerca, Cronologia Google-Style, Filtri Multipli & Hardening Scraper

### 🎯 Obiettivo
Rinnovare completamente l'esperienza di ricerca rimuovendo i vecchi consigliati statici, introducendo una cronologia ricerche touch-native in stile Google con eliminazione singola e massiva protetta da `ConfirmModal`, configurazione della ritenzione nelle Impostazioni con `HistorySlider`, supporto completo a tutti i 46 generi con selezione multipla e logica AND (`genre_mode=and`), filtro Audio per doppiati e sottotitolati, risoluzione della mappatura dei formati/categorie e isolamento rigoroso dello scraper per eliminare i 6 titoli non pertinenti iniettati da AnimeWorld in caso di zero risultati.

### 🛠️ Piano di Refactor & Implementazione
1. **Cronologia Ricerche Touch-Native in Stile Google (`index.tsx`)**:
   - Eliminazione dei vecchi consigliati generici.
   - Ogni elemento recente mostra l'icona `time-outline`, testo maiuscolo monospace, tap diretto per eseguire immediatamente la ricerca, e tasto di rimozione singolo (`close-outline`) con area di tocco minima $\ge 44$dp e feedback tattile (`Haptics.impactAsync(Light)`).
   - Tasto *CANCELLA TUTTE* con modale di conferma in-app unificato `ConfirmModal`.
2. **Storage Sincrono MMKV & Retention Policy (`AppStorage`, `settings.tsx`, `HistorySlider.tsx`)**:
   - Aggiunta della chiave `user.searchHistory` (`SearchHistoryItem`: `term`, `timestamp`).
   - Gestione `searchHistoryRetentionDays` in `AppSettings` (default 90 giorni).
   - Estensione di `HistorySlider` con prop `steps` e preset dedicato `SEARCH_RETENTION_STEPS` (`OFF`, `30GG`, `60GG`, `90GG`, `ON`). Alla disattivazione (`OFF`), la cronologia viene svuotata istantaneamente.
   - Pulizia automatica periodica delle ricerche scadute all'avvio dell'app in background (`AppStorage.cleanupExpiredSearchHistory()`).
3. **Filtri Catalogo Avanzati (`FilterBottomSheet.tsx`, `anime.ts`)**:
   - Supporto a tutti i 46 generi AnimeWorld con selezione multipla.
   - Sezione Audio dedicata: `TUTTI GLI AUDIO`, `DOPPIATI (ITA)` (`dub: '1'`), `SOTTOTITOLATI (SUB)` (`dub: '0'`).
   - Sezione Categoria & Formato con mapping numerico nativo AnimeWorld: `0` Serie TV, `4` Film Anime, `1` OAV, `2` ONA, `3` Special.
   - Ordinamento: aggiunta di `sort: '5'` per ordinare fedelmente in base alla data reale di uscita delle serie (`release_date:desc`), oltre a ultime aggiunte (`1`), più visti (`6`), meglio valutati (`7`), A-Z (`2`) e Z-A (`3`).
4. **Hardening Scraper Risultati & Isolamento Widget Spuri (`search.parser.ts`)**:
   - `buildFilterQuery`: serializzazione corretta dei parametri query, gestione array generi con aggiunta automatica di `genre_mode=and`.
   - `parseSearchPage`: selettore limitato ai soli container primari dei risultati (`#main .film-list > .item, .content .film-list > .item, .film-list > .item, #main .film-listnext > .item, .content .film-listnext > .item, .film-listnext .item`) ed esclusione esplicita di `.simple-film-list .item, .ranking .item, aside .item`. In questo modo, quando una categoria (es. Film) non produce risultati, il widget laterale da 6 titoli consigliati non viene più scambiato per risultati di ricerca.

### 🧪 Criteri di Accettazione
- Cronologia ricerche perfettamente funzionante con persistenza sincrona in MMKV.
- Modale filtri reattivo con reset rapido, conteggio filtri attivi nell'header e chip rimovibili individualmente.
- Zero titoli spuri in caso di ricerche o filtri privi di risultati.
- Suite completa di test superata a 16 stadi (`npm test`).

---

## 🏗️ Step 14: De-monolizzazione Schermate Home/Impostazioni, Unificazione Slider & Pulizia Codice Morto

### 🎯 Obiettivo
Eliminare l'accumulo di codice monolitico nei controller di rotta (`app/(tabs)/index.tsx` e `app/(tabs)/settings.tsx`), unificare i tre slider discreti duplicati in una primitiva touch-native riutilizzabile (`StepSlider.tsx`), ed eliminare servizi legacy non utilizzati (Kitsu, AniList GraphQL) e dipendenze superflue (`@expo/ui`).

### 🛠️ Piano di Refactor & Implementazione
1. **Fase 1 — Pulizia Codice Morto & Dipendenze**:
   - Rimozione di `src/services/kitsu/` e `src/services/anilist/` (servizi metadata deprecati e non richiamati dall'app).
   - Pulizia query hook orfani in `anime-queries.ts` e tipi inutilizzati in `navigation.ts`.
   - Rimozione definitiva di `@expo/ui` da `package.json` a favore dei modali touch-safe React Native `Modal`.
2. **Fase 2 — Unificazione Slider Discreti (`StepSlider.tsx`)**:
   - Creazione della primitiva generica `StepSlider.tsx` con `PanResponder` touch-safe (`onPanResponderTerminationRequest: () => false`, `pointerEvents="none"` su track e thumb), calcolo layout a larghezza dinamica, snapping a intervalli discreti e feedback aptico (`Haptics.selectionAsync()`).
   - Refactor di `HistorySlider.tsx`, `AniSkipSlider.tsx` e `AniSkipDurationSlider.tsx` come wrapper leggeri su `StepSlider`.
3. **Fase 3 — De-monolizzazione Impostazioni (`settings.tsx`)**:
   - Estrazione di `settings.styles.ts` (480 righe di stili).
   - Estrazione di `ThemeSettingsCard.tsx` (selezione temi OLED/Pikachu/Orchidea/Rainbow e toggle scuro/chiaro) e `SourceSettingsCard.tsx` (domini rapidi `.ac`, `.so`, `.tv` e URL personalizzato).
   - Riduzione di `settings.tsx` da 1571 a 972 righe (-600 righe, ~38% snellimento).
4. **Fase 4 — De-monolizzazione Home & Scorporo Ricerca (`index.tsx`)**:
   - Estrazione di `home.styles.ts` (600 righe di stili).
   - Estrazione di `HomeSection.tsx` (caroselli unificati) e `ContinueWatchingSection.tsx` (sezione continua a guardare con rimozione sicura).
   - Scorporo del modulo di ricerca: `HomeSearchHeader.tsx` (con `HomeAppBar`), `SearchFilterChips.tsx`, `SearchResultsGrid.tsx` e `SearchHistoryList.tsx`.
   - Riduzione di `index.tsx` da 2104 a 1134 righe (-970 righe, ~46% snellimento).

### 🧪 Criteri di Accettazione
- `npm run typecheck` completato con 0 errori.
- Suite di test automatizzata a 16 stadi (`npm test`) superata al 100%.
- Generazione pulita del bundle Android Hermes bytecode con `npx expo export --platform android`.

---

## 📋 Checklist di Verifica per Ogni Step

Prima di considerare concluso uno step della roadmap, l'agente deve verificare:
1. `npx tsc --noEmit`: 0 errori di tipo.
2. `npm test`: Suite completa a 16 stadi superata con codice 0.
3. `npx expo export --platform android`: Compilazione Hermes bytecode senza warning o errori di importazione.
4. Aggiornamento contestuale di [`AGENTS.md`](../AGENTS.md) qualora vengano introdotte nuove regole o pattern.
