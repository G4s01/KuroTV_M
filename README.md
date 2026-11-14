<div align="center">

# 📱 KURO MOBILE

### *Client Android touch-native per lo streaming anime, ad altissime prestazioni e nero assoluto OLED.*

[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000000?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![React 19](https://img.shields.io/badge/React-19-23272F?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Hermes](https://img.shields.io/badge/Engine-Hermes-9B59B6?style=for-the-badge)](https://hermesengine.dev/)
[![FlashList v2](https://img.shields.io/badge/List-FlashList%20v2-2ECC71?style=for-the-badge&logo=shopify&logoColor=white)](https://shopify.github.io/flash-list/)
[![MMKV v3](https://img.shields.io/badge/Storage-MMKV%20v3-E67E22?style=for-the-badge)](https://github.com/mrousavy/react-native-mmkv)
[![Target Android](https://img.shields.io/badge/Arch-arm64--v8a-E50914?style=for-the-badge&logo=android&logoColor=white)](https://android.com)

</div>

---

## ✨ Perché Kuro Mobile?

**Kuro Mobile** è un client mobile moderno per smartphone Android, progettato da zero con un approccio **100% touch-native** e **Zero-TV residue**. Combina l'estetica **OLED puro (`#000000`)** e la **tipografia monospace in CAPS LOCK** con un motore di riproduzione video all'avanguardia a 60/120 FPS.

```
┌────────────────────────────────────────────────────────────────────────┐
│  🎬 LIVE FRAME SCRUBBING  │  ⏭️ ANISKIP PROGRESS  │  🖤 OLED PURE BLACK │
│  ⚡ MMKV ZERO LATENCY     │  📑 FLASHLIST CAROUSEL│  📥 OFFLINE & SAF   │
│  ☁️ KUROSYNC CLOUD & D1   │  📺 TV PAIRING & QR   │  📷 CAMERA SCANNER  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 Caratteristiche Principali

### 🏠 Schermata Home & Hero Swiper Sincronizzato
- **🌟 Hero Swiper Orizzontale a Paging**: In testa alla Home, slider a tutto schermo dei raccomandati (default il #1 della Top 8 di AnimeWorld) con titoli monospace in maiuscolo, badge tematico `#1 RACCOMANDATO`, sinossi pulita e sfondo con gradiente OLED.
- **▶️ Azioni Rapide Esecutive (`RIPRODUCI` & `INFO`)**: Tasto `RIPRODUCI` che riprende all'istante l'episodio in corso o estrae l'episodio 1 dal provider avviando il player con loader integrato, e tasto `INFO` (così come il tocco altrove sul banner) per consultare i dettagli.
- **🔢 Carosello Raccomandati Numerati (`#1` ... `#8`)**: Sincronizzazione bi-direzionale a 60/120 FPS protetta da loop-guard differito (`activeScrollSourceRef`), snapping nativo (`snapToOffsets` con array memoizzato), gestione settling touch-safe e padding destro dinamico per garantire la perfetta focalizzazione anche per le posizioni #7 e #8.
- **📑 Caroselli Tematici Completi**:
  - **Riprendi a Guardare & Stato "IN PARI"**: Visibile in presenza di visioni in corso o serie in pari (`continueWatching.length > 0`). Le serie in corso con totale sconosciuto (`?`) non vengono rimosse all'ultimo episodio ma mostrano il badge OLED `IN PARI` verde (`#10B981`), barra al 100% e tap diretto alla scheda anime. Si aggiornano automaticamente al nuovo Episodio X+1 a 0:00 grazie alla **Sincronizzazione Ibrida Smart** (check passivo continuo su feed Home + check remoto ogni 4 ore o su Pull-to-Refresh). Rimozione sicura protetta da `ConfirmModal`.
  - **Ultimi Episodi Usciti**: Tutte le nuove puntate pubblicate con pulsante rapido `VEDI TUTTI`.
  - **Tendenze**: Le serie più seguite e popolari del momento.
  - **Anime in Corso**: Serie attualmente in trasmissione (`ongoing`).
  - **Uscite della Stagione Corrente (`upcoming`)**: Carosello con le prossime uscite stagionali (oltre 80 serie con scraper arricchito per `.film-listnext` e titoli sanitizzati).
  - **Nuove Aggiunte**: Le ultime novità introdotte nel catalogo AnimeWorld.

### 📅 Palinsesto & Programmazione Settimanale
- **🗓️ Calendario Uscite AnimeWorld**: Scraper touch-native per `animeworld.ac/schedule` che espone la programmazione settimanale completa con gli orari previsti delle puntate.
- **🌟 Hero Card Prossima Uscita**: Card in evidenza con badge fiammella `PROSSIMA USCITA`, orario programmato, titolo, numero di puntata e tap diretto alla scheda anime.
- **👆 Selettore Orizzontale dei Giorni (es. `SAB 14`)**: Scorrimento touch dei giorni con etichetta compatta giorno e numero (es. `SAB 14`, `LUN 9`) senza numero di uscite e indicatore `OGGI` con selezione automatica del giorno odierno.
- **⏱️ Timeline Virtualizzata con FlashList**: Schede episodio ordinate cronologicamente con pill orario dedicato (`15:00`), locandina ad alta risoluzione con cache proattiva, titoli monospace, badge puntata (`EPISODIO X`) e badge di stato con codifica cromatica OLED (`USCITO` in verde, `IN PAUSA` in ambra, programmato in colore primario).

### 🎬 Player Video Touch di Nuova Generazione
- **⚡ Streaming Asincrono (`replaceAsync`)**: Risoluzione del flusso video off-thread (`expo-video`) senza blocchi sincroni sul Main Thread, garantendo caricamento immediato e zero freeze dell'interfaccia.
- **🎞️ Live Real-Frame Scrubbing**: Trascina la timeline per visualizzare in tempo reale i veri fotogrammi video estratti dallo stream (`expo-video`), con cache in memoria e proximity matching a 60 FPS senza lag.
- **⏭️ AniSkip Intelligente (`'SALTA'` / `'PROSSIMO'`) con Durata Configurabile**: Rilevamento automatico delle sigle (`OP`/`ED`/`Recap`) con finestra temporale configurabile (`5s`–`60s` o `∞`) e resilienza al riavvolgimento (rewind). Se la ending coincide con la fine dell'episodio (entro `5s`) il pulsante si trasforma direttamente in `'PROSSIMO'` portando all'episodio successivo; se invece è presente una scena post-ending, mostra `'SALTA'` durante la sigla e poi separatamente `'PROSSIMO'` all'inizio della parte post-ending con la stessa durata impostata in Impostazioni (senza mai sovrapporre o affiancare i due tasti). Configurabile tra `OFF`, `MANUALE` e `AUTO`.
- **⏩ Skip Sequenziale Intelligente**: Doppio tap $\pm 10$s con accumulo cumulativo (`+20s`, `+30s`, `+50s`, `-30s`) e pill di feedback compatto centrato accanto al tasto Play/Pausa.
- **⏮️ Comandi Centrali Bilanciati**: Pulsante Play/Pausa circolare affiancato dai comandi per episodio precedente (`play-skip-back`) e successivo (`play-skip-forward`).
- **📑 Carosello Episodi Virtualizzato**: Drawer modale touch-safe con `@shopify/flash-list` per navigare istantaneamente centinaia di episodi con auto-scroll alla puntata corrente e padding simmetrico.
- **ℹ️ Scheda Info & Trama**: Accesso rapido a locandina, badge puntata formattato rigorosamente come `'EPISODIO X/TOT'`, dettagli della serie e sinossi completa scrollabile con normalizzazione difensiva dei generi.
- **🔄 Feedback Visivo di Caricamento Integrato**: Animazione di caricamento (`ActivityIndicator` con contrasto YIQ) integrata direttamente all'interno del pulsante circolare Play/Pausa (e al centro esatto dello schermo a controlli nascosti), azzerando overlay scuri o box oscuranti che coprono la visione.
- **☀️ Gesture HUD Volume & Luminosità**: Swipe rigorosamente verticali con isolamento asse (`activeOffsetY`, `failOffsetX`, rigetto spostamenti orizzontali) e travel range calibrato per volume (destra) e luminosità (sinistra) con modalità `AUTOMATICA`.
- **📺 Picture-in-Picture & Controlli in Notifica (MediaStyle)**: Supporto nativo PiP, transizione fluida a schermo intero senza pause involontarie tramite `wasPlayingInPiPRef`, titolo notifica compatto `EPISODIO <Num>` con sottotitolo `<TITOLO SERIE>`, controlli rapidi Android MediaSession simmetrici a 5 tasti (`seek -10s`, `precedente`, `play/pausa`, `successivo`, `seek +10s`) con `KuroForwardingPlayer` nativo compilato da sorgente (`buildFromSource: ["expo-video"]`, esponendo permanentemente `COMMAND_SEEK_TO_NEXT` / `COMMAND_SEEK_TO_NEXT_MEDIA_ITEM` e `COMMAND_SEEK_TO_PREVIOUS` / `COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM`), copertina anime serializzata in byte array JPEG per `MediaMetadata.artworkData` nei Quick Settings di Android 13+ e chiusura anti-zombie playback.
- **📑 Menù e Drawer Touch-Safe Senza Tagli Visivi**: Dimensioni responsive in base all'orientamento (portrait/landscape) con troncamento elegante dei testi per azzerare i tagli laterali su smartphone di qualsiasi fattore di forma.
- **👇 Chiusura Menù Tramite Scorrimento (Swipe-Down Dismiss)**: Tutti i bottom sheet touch-native (`ServerBottomSheet`, `PlayerInfoSheet`, `PlayerEpisodesCarouselSheet`, `BatchBottomSheet`, `DownloadOptionsSheet`, `DownloadedEpisodesSheet`, `FilterBottomSheet`) integrano l'hook dedicato `useBottomSheetDragDismiss` su driver nativo Fabric a 60/120 FPS con `Modal animationType="fade"`, consentendo la chiusura fluida senza rimbalzi afferrando e trascinando la maniglia o l'intestazione verso il basso.

### 📋 Scheda Tecnica Dettaglio & Controlli Rapidi
- **🖼️ Header Pulito & Copertina Espandibile a Schermo Intero**: Rimozione del vecchio backdrop ingrandito a favore di uno spacing iniziale protetto al di sotto del tasto Indietro e locandina cliccabile per aprire l'artwork ad alta risoluzione in una card modale OLED.
- **🎞️ Tabella Tecnica & Supporto Totali Incerti**: Cella generi a scorrimento orizzontale e gestione difensiva dei totali episodi incerti o serie in corso (`??`, `?`).
- **▶️ Controlli di Avvio Rapido Simbolici**: Header compatto con pulsanti Play (`play`) e Riavvia da capo (`reload`) a soli simboli ($\ge 44$dp), con eliminazione del tasto ridondante a fondo pagina.
- **📑 Selettore Batch Touch-Native**: Bottom sheet modale basato su React Native `Modal` touch-safe, ripulito da contenuti correlati per garantire selezione istantanea ad ogni tocco e zero crash Fabric/Compose.
- **🌐 Link Esterni con Icone SVG**: Pulsanti rapidi con icone SVG dedicate per Trailer YouTube, MAL e AniList.

### 📥 Download Episodi, Storage SAF & Visione Offline
- **⚡ Coda FIFO Sequenziale & Risoluzione Massima Automatica**: Download gestito dal singleton `DownloadService` con 1 download alla volta per azzerare rate limiting o saturazione di banda e rendere disponibile il primo episodio nel minor tempo possibile. Risoluzione automatica alla massima qualità disponibile (Server 9 a 1080p, con fallback a server secondari) senza modali bloccanti.
- **📁 Storage Flessibile & Storage Access Framework (SAF)**:
  - *Cartella Predefinita*: Memoria interna isolata (`${FileSystem.documentDirectory}downloads/${animeId}/ep_${num}.mp4`), con velocità massima I/O, zero permessi di runtime richiesti e totale immunità a cancellazioni da app terze.
  - *Cartella Personalizzata (SAF)*: Possibilità di selezionare una qualsiasi cartella esterna (cartella di sistema *Download*, memoria utente o scheda MicroSD) tramite `StorageAccessFramework.requestDirectoryPermissionsAsync()` configurabile in Impostazioni con ripristino istantaneo alla cartella predefinita.
- **📶 Protezione Rete Dati (Solo Wi-Fi)**: Opzione in Impostazioni per limitare i download esclusivamente a reti Wi-Fi non a consumo (verifica dinamica dello stato tramite `expo-network`).
- **🎬 Integrazione Video Player & Riproduzione Offline Verificata**:
  - Tasto download rapido nell'header OSD del player con feedback dinamico di avanzamento (`cloud-download-outline` -> percentuale progresso -> `checkmark-circle` verde a completamento).
  - Priorità locale verificata su disco (`DownloadService.resolvePlayableLocalUri()`): avvio istantaneo da `SCARICATI` o dalle altre schermate con passaggio completo dei metadati (`animeId`, `episodeNumber`, progresso, copertina), resilienza ai path Expo Go e badge **`LOCALE / OFFLINE`** nell'header OSD.
- **📋 Download da Intestazione Anime, Pre-Menù & Selezione Multi-Batch**:
  - Pulsante download nell'intestazione della scheda anime accanto a Preferiti e Condivisione, che apre il modale `DownloadOptionsSheet` con chiusura swipe-down (`useBottomSheetDragDismiss`).
  - Icona download interattiva su ogni episodio sia in vista griglia che lista con stato live. Premendo nuovamente sull'icona di un episodio in download, in coda o in pausa, l'operazione viene annullata all'istante in modo pulito.
  - Pre-menù ordinato con scelta tra **`SCARICA TUTTI`**, **`SCARICA PER BATCH`** (con **selezione multipla** di più batch senza uscire dal modale e pulsante **`SCARICA BATCH`** adiacente) e **`INTERVALLO PERSONALIZZATO`** (`DA` – `A` con steppers `-`/`+` e input numerico), lasciando `BatchBottomSheet` dedicato alla sola navigazione tra gruppi di episodi (anch'esso con swipe-down dismiss).
- **📱 Sezione Router `'SCARICATI'` (`app/downloads/index.tsx`)**:
  - Schermata dedicata intitolata semplicemente **`SCARICATI`** con layout anti-overflow e protezione `minWidth: 0` su tutte le card.
  - Scorciatoia impostazioni con navigazione e auto-scroll al punto esatto delle impostazioni di download in `app/(tabs)/settings.tsx`.
  - Barra grafica di monitoraggio memoria (`StorageUsageBar`) con spazio occupato dai download dell'app e spazio libero sul dispositivo.
  - **Prima sezione `EPISODI SALVATI`**: serie già completate raggruppate per anime (`DownloadedAnimeCard`) con locandina, conteggio puntate, peso in MB/GB, tasto rapido *"RIPRODUCI"* e modale swipe-down (`DownloadedEpisodesSheet`).
  - **Seconda sezione `IN CORSO & IN CODA` espandibile (`ActiveDownloadGroupCard` & `ActiveDownloadCard`)**: serie attualmente in download sempre in cima (eventuali serie secondarie racchiuse in elementi espandibili); dentro ciascuna serie, episodio `downloading` in alto e restanti episodi ordinati per **numero crescente** e racchiusi in un pannello espandibile dedicato, con annullamento dell'intero raggruppamento tramite **`ANNULLA TUTTI (N EP.)`** o pulsante rapido sull'header multi-serie (`seriesCancelGroupBtn`) protetto da `ConfirmModal` (`DownloadService.cancelAnimeDownloads`, preservando eventuali episodi già completati).
- **🔔 Badge Notifica Download Attivi in Home**: Icona dedicata nell'header della Home con badge numerico dei download in corso e navigazione diretta a `/downloads`.
- **⚙️ Card Impostazioni Minimale (`DownloadSettingsCard`)**: Testi essenziali e compatti (*`SCARICATI`*, *`PERCORSO`*, *`RETE`*, *`MEMORIA`*), selettore cartella SAF, toggle Wi-Fi e cancellazione rapida protetta da `ConfirmModal`.

### ☁️ Sincronizzazione Self-Hosted KuroSync (KuroTV_S & Android TV)
- **⚡ Client TypeScript Puro Hermes-Safe**: Sincronizzazione multi-dispositivo basata su `@kurosync/sync-client` integrato in `src/services/sync/`, privo di moduli pesanti `node:*` e compilabile al 100% su Hermes.
- **🔄 Bridge MMKV ad Alte Prestazioni**: Sincronizza preferiti (`favorites`), continuazione visioni (`continueWatching` con preservazione dello stato *IN PARI* `isCaughtUp`), cronologia (`watchHistory`), progressi episodio discreti (`watchProgress`), cronologia ricerche e impostazioni condivise (`sharedSettings`).
- **🛡️ Riconciliazione Code & Dominanza Tombstones**: Algoritmo `mergeLocalAndRemote()` con dominanza dei tombstones di eliminazione, pulizia automatica delle mutazioni pendenti in caso di rimozione e cancellazione dei tombstones se un elemento viene ri-aggiunto.
- **⏱️ Rispetto Limiti Cloudflare D1 (Free Tier)**: Debouncing dei progressi video a 45-60s durante la riproduzione continua, con flush immediato all'uscita, alla pausa, al cambio puntata o al completamento ($\ge 90\%$). Pull automatico dei soli delta modificati (`since`) al focus e push al passaggio in background.
- **📱 Nomi Dispositivo Dinamici & Riconoscibili**: Rilevamento automatico del modello reale hardware (`Google Pixel 8 Pro`, `Samsung Galaxy S24 Ultra`, `Xiaomi 13T`) da costanti native Android, scartando stringhe generiche.
- **🍿 Selettore Profili Stile Netflix (QR & Manuale)**: Griglia pulita "CHI STA GUARDANDO?" con avatar colorati personalizzati, nome profilo e centratura adattiva. Supporta sia l'accesso con Master Password sia la scansione QR monouso in due fasi (`prepareQrConnection` $\rightarrow$ selezione profilo $\rightarrow$ finalizzazione).
- **🛡️ Persistenza Indistruttibile con Self-Healing Multi-Livello**: Auto-ripristino trasparente dell'URL del server KuroSync con chiave di backup MMKV secondaria e cache volatile, azzerando qualsiasi perdita o disallineamento durante la riproduzione o in background.
- **📷 Scanner QR Istantaneo Senza Passaggi Intermedi**: Accesso rapido alla scansione fotocamera a schermo intero con un solo tocco, eliminando input testuali grezzi per token o link lunghi.
- **📺 Accoppiamento Android TV Istantaneo**: Schermata dedicata nelle Impostazioni per autorizzare dispositivi Android TV in 1 secondo tramite scansione QR o inserimento del codice numerico a 6 caratteri (`approveTvPairing`).
- **🔒 Zero URL Privati Esposti**: Connessione flessibile a qualsiasi istanza personale Cloudflare Workers + D1 con campo manuale neutro e pulsante di collegamento alla [repository GitHub ufficiale di KuroTV_S](https://github.com/G4s01/KuroTV_S).

### 🖤 Design System & Esperienza Touch
- **Nero Assoluto OLED (`#000000`)**: Spegnimento fisico dei pixel sui display AMOLED per azzerare i consumi energetici e massimizzare il contrasto.
- **Tipografia Monospace & CAPS LOCK**: Identità coerente su tutta l'app con font monospace di sistema e testi in maiuscolo.
- **📱 Compatibilità Navbar di Sistema Android**: Navbar fissa in-app di default con sollevamento dinamico del router dei tab per zero interferenze con i tasti di navigazione fisici/virtuali, commutazione automatica in auto-hide immersivo (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) durante la riproduzione video a schermo intero e switch dedicato con descrizione snellita in Impostazioni (`A SCOMPARSA, RICHIAMABILE CON SWIPE DAL BASSO.` e `SEMPRE FISSA E VISIBILE IN-APP.`).
- **⏭️ Selettore AniSkip a Scorrimento Continuo (`AniSkipSlider`)**: Slider touch-native minimale per la modalità di salto tra `'OFF'`, `'MANUALE'` e `'AUTO'` con feedback aptico e tracciamento continuo in stile `HistorySlider`.
- **🔍 Ricerca Unificata in Home & Cronologia Google-Style**: Catalogo accessibile dalla Home con debouncing 450ms, dismiss tastiera su scroll, tasto indietro hardware per chiusura rapida e griglia FlashList a 2 colonne. Include cronologia ricerche touch-native in stile Google (icona orologio `time-outline`, testo monospace maiuscolo, tap to search, cancellazione della singola ricerca con target $\ge 44$dp e cancellazione massiva protetta da `ConfirmModal`). Ritenzione configurabile nelle Impostazioni con `HistorySlider` (`OFF`, `30GG`, `60GG`, `90GG`, `ON`).
- **🎯 Filtri Catalogo Avanzati & Fix Scraper AnimeWorld**: Filtro modale touch-safe con tutti i 46 generi e selezione multipla (`genre_mode=and`), filtro Audio dedicato per `DOPPIATI (ITA)` e `SOTTOTITOLATI (SUB)`, mappatura corretta dei formati (`type` per Serie TV, Film Anime, OAV, ONA, Special), ordinamento fedele per data di uscita (`sort=5` Più recenti, `1` Ultime aggiunte, `6` Più visti, `7` Meglio valutati, `2` A-Z, `3` Z-A), e isolamento selettori nello scraper escludendo i widget correlati (`.simple-film-list`, `.ranking`) che iniettavano 6 titoli non pertinenti in caso di risultati vuoti.
- **Zero Alert di Sistema & Modal In-App Unificato (`ConfirmModal`)**: Sostituzione integrale degli alert nativi grezzi di Android con modali a tema OLED, contrasto dinamico YIQ, feedback aptico e touch target $\ge 44$dp.
- **Bottom Tabs Solo Icone con Switcher Profilo Rapido**: Barra inferiore a 5 schede (**Home**, **Preferiti**, **Cronologia**, **Profilo**, **Impostazioni**) senza etichette testuali e touch target minimi $\ge 44$dp. Il pulsante **Profilo** (`person-circle` / `person`) permette di cambiare profilo o avviare l'accoppiamento con un tocco da qualsiasi schermata, mentre l'accesso al **Palinsesto** è integrato con freccia Indietro nell'header della Home tra Download e Ricerca.
- **Temi Reattivi al Click**: Quattro palette d'accento (**OLED Puro**, **Pikachu**, **Orchidea**, **Rainbow**) con toggle scuro/chiaro al click e contrasto dinamico YIQ del testo.

### ⚡ Prestazioni Estreme & Architettura Safe
- **Storage Sincrono MMKV v3**: Cronologia, preferiti, impostazioni AniSkip e Navbar memorizzati con letture e scritture a latenza zero.
- **Skeleton Animati a Zero CLS**: Primitive e layout dedicati che rispecchiano al millimetro le geometrie reali (scheda tecnica metadati, pulsanti rapidi, hero spotlight, griglie senza doppio padding e sezioni condizionali sincronizzate) azzerando il Cumulative Layout Shift (CLS).
- **Scraper 100% Hermes Safe**: Web scraper nativo basato su `cheerio/slim` ed `htmlparser2`, privo di moduli pesanti `node:*` incompatibili con il runtime mobile.
- **Architettura Modulare & Primitiva Slider Unificata (`StepSlider`)**: De-monolizzazione completa dei controller di rotta (Home e Impostazioni) con fogli di stile isolati (`*.styles.ts`), subcomponenti dedicati (`src/components/home/`, `src/components/settings/`) e slider touch-safe discreti unificati con `PanResponder`.
- **Updater OTA Integrato con `UpdateModal`**: Notifica in-app all'avvio con changelog, scroll animato e progressivo automatico verso la sezione informazioni/download su click "AGGIORNA ORA" e freccia animata sul tab Impostazioni se differito.

---

## 🛠️ Stack Tecnologico

| Livello | Tecnologia | Descrizione |
|---|---|---|
| **Framework** | **Expo SDK 58** & **React Native 0.88.1** | Nuova architettura TurboModules & Fabric |
| **Linguaggio & Engine** | **TypeScript 5.3** & **Hermes Engine** | Compilazione bytecode nativa ultra-veloce |
| **Routing** | **Expo Router v58** | File-based routing dichiarativo |
| **Virtualizzazione** | **@shopify/flash-list v2** | Rendering ottimizzato per cataloghi infiniti |
| **Componenti Modali** | **Modal Touch-Native** | Drawer custom touch-safe OLED senza crash Fabric |
| **Sistema & Navbar** | **expo-navigation-bar** | Auto-hide immersivo nel player, fissa in-app con layout rialzato |
| **Video & Multimedialità** | **expo-video** & **ScreenOrientation** | Player HLS avanzato, PiP no-pause, MediaStyle notification e rotazione a 180° |
| **Data Fetching** | **@tanstack/react-query v5** | Caching, deduplicazione e reattività |
| **Local Storage** | **react-native-mmkv v3** | Key-value store sincrono C++ ad alta velocità |
| **Download & Storage** | **expo-file-system** & **expo-network** | Download resumable, Storage Access Framework (SAF) e vincolo Wi-Fi |
| **Sincronizzazione Self-Hosted** | **@kurosync/sync-client** & **KuroSync** | Delta sync deterministico con Cloudflare Workers + D1 e TV pairing |
| **Scansione QR Fotocamera** | **expo-camera** | CameraView touch-native senza permessi audio per QR e link |

---

## 🚀 Guida Rapida

### 1. Installazione
```bash
git clone https://github.com/user/KuroM.git
cd KuroM
npm install
```

### 2. Test di Qualità (29 Stadi)
```bash
npm test
```
*Valida SemVer, regole OLED, storage MMKV, batch puntate, intervalli AniSkip (inclusa sostituzione `'PROSSIMO'` a fine episodio e `'PROSSIMO'` sequenziale post-ending), skeleton animation, export delle rotte, touch sheets, updater, compatibilità navbar, gesture verticali, PiP no-pause, dimensioni sheets, AniSkipSlider, loader integrato, media notification, slider hero sincronizzato, parser upcoming, anti-corruzione titoli, palinsesto/schedule, affidabilità aggiornamenti manuali, cronologia ricerche Google-style, filtri multi-genere, audio, isolamento scraper, sincronizzazione focus raccomandati, simmetria filtri, swipe-down dismiss a doppia zona, stato IN PARI & sincronizzazione ibrida smart, supporto schermi larghi/tablet (sw600dp), left navigation rail, master-detail, `Tabs.Protected` su Cronologia, sistema di download episodi con storage SAF & visione offline, sincronizzazione self-hosted KuroSync con KuroTV_S, bridge MMKV, debounce 45-60s, scanner QR ed autorizzazione Android TV, integrazione avanzata KuroSync (nomi dinamici hardware model, selettore profili stile Netflix pre-login su Master Password, switcher in-app dinamico, gestione single-use QR 410 Gone esplicativo in-app, revoca sessione e logout pulito), fix tablet rail (azzeramento doppio contorno, clearance navbar smartphone, avatar iniziale / fallback login icon, navigazione runtime palinsesto e affidabilità back gesture di sistema), e gestione universale gesture indietro su tablet (Xiaomi Mi Pad 6) con retry automatici KuroSync, feedback e auto-logout.*

### 3. Build & Verifica Bytecode Hermes
```bash
npx expo export --platform android
```

### 4. Avvio su Dispositivo Android
```bash
npm run android
```

---

## 📦 Pipeline di Rilascio & Tooling

Gli script operativi in [`scripts/`](./scripts) gestiscono l'intera filiera di build e distribuzione:

```bash
# Compilazione APK release arm64-v8a e pubblicazione OTA su R2 + GitHub Releases
./scripts/build-release.sh

# Finalizzazione rapida di un binario già compilato:
./scripts/build-release.sh --skip-build

# Backup sicuro dei segreti e keystore cifrati con AES-256-CBC su R2:
./scripts/backup-secrets-r2.sh
```

---

## 📚 Documentazione

Approfondimenti e specifiche tecniche complete:
- 🏛️ [**Architettura del Progetto**](./docs/ARCHITECTURE.md)
- 🎬 [**Specifiche Video Player**](./docs/VIDEO_PLAYER.md)
- 🎨 [**Temi & Design System**](./docs/THEMES_AND_STYLING.md)
- 🚀 [**Pipeline OTA & Rilascio**](./docs/OTA_AND_RELEASES.md)
- 📱 [**Regole Architetturali Tassative (AGENTS.md)**](./AGENTS.md)

---

<div align="center">

*Sviluppato con passione per l'ecosistema Kuro • Mobile-First & Touch-Native*

</div>
