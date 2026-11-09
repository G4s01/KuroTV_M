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
   - Reattività istantanea: al passaggio a `'OFF'`, la tab **Cronologia** viene immediatamente nascosta dalla bottom bar (`href: null` in `app/(tabs)/_layout.tsx`).
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
   - Sostituire il `ModalBottomSheet` Compose con un componente modale React Native touch-native (`Modal animationType="slide"`), eliminando le sezioni correlate e garantendo la selezione istantanea ad ogni tocco senza crash in Expo Go o su device.
   - Configurare `maintainVisibleContentPosition={{ disabled: true }}` su `FlashList` degli episodi per prevenire crash su Android con Nuova Architettura Fabric.

---

## 📋 Checklist di Verifica per Ogni Step

Prima di considerare concluso uno step della roadmap, l'agente deve verificare:
1. `npx tsc --noEmit`: 0 errori di tipo.
2. `npm test`: Suite completa a 7 stadi superata con codice 0.
3. `npx expo-doctor`: 20/20 controlli superati.
4. `npx expo export --platform android`: Compilazione Hermes bytecode senza warning o errori di importazione.
5. Aggiornamento contestuale di [`AGENTS.md`](../AGENTS.md) qualora vengano introdotte nuove regole o pattern.
