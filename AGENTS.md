# 📱 AGENTS.md — Regole, Standard Architetturali & Linee Guida per Kuro Mobile

Questo documento stabilisce le regole architetturali, i vincoli UX/UI, gli standard di sicurezza e le convenzioni operative per il codebase **Kuro Mobile** (client Android per smartphone).

---

## 🎯 1. Filosofia di Progetto: Mobile-First & Touch Native

Kuro Mobile è un'applicazione concepita **esclusivamente per smartphone Android con interfaccia touch moderna**.

### 🚫 Divieti Tassativi (Anti-Pattern TV)
1. **Nessun Pacchetto TV o D-Pad**:
   - È severamente vietato installare o importare `react-tv-space-navigation`, `@bam.tech/lrud`, `react-native-tvos` o `@react-native-tvos/config-tv`.
   - Nessun listener per telecomandi TV (`TVEventHandler`, `onHWKeyEvent`).
   - Nessun bordo di focus rigido o focus scaling forzato per D-Pad.
2. **Nessuna Disabilitazione della Virtualizzazione**:
   - Su smartphone **è obbligatorio virtualizzare** tutte le liste lunghe (cataloghi anime, cronologia, preferiti, liste episodi) con `@shopify/flash-list` per garantire 60/120 FPS costanti e basso consumo di memoria RAM.
3. **Nessuna Dipendenza Node Standard Library nel Bundle Mobile**:
   - È vietato l'import di moduli `node:*` (`node:stream`, `node:fs`, `node:buffer`, ecc.) nel codice runtime client. Il parsing HTML deve utilizzare rigorosamente `cheerio/slim` con `htmlparser2` per mantenere il bundle 100% compatibile con il motore Hermes.
4. **Divieto Assoluto di Alert di Sistema (`Alert.alert`)**:
   - È tassativamente vietato importare `Alert` da `react-native` o chiamare `Alert.alert(...)` per conferme, avvisi o rimozioni.
   - Ogni richiesta di conferma (cancellazioni, rimozione da *Riprendi a guardare*, svuotamento cronologia, azioni irreversibili) deve utilizzare esclusivamente il componente in-app unificato `ConfirmModal` (`src/components/ConfirmModal.tsx`), preservando l'estetica OLED, il contrasto dinamico YIQ e la tipografia monospace.

---

## 🛠️ 2. Stack Tecnologico & Architettura (2026)

- **Framework & Runtime**: Expo SDK 58 (v58.0.23), React Native 0.88.1, React 19.3.0 (Nuova Architettura / TurboModules nativi). `MainActivity.kt` adotta il costruttore moderno `DefaultReactActivityDelegate(this, mainComponentName)` senza flag Fabric obsoleti.
- **Routing & Navigazione**: `expo-router` v58 (file-based routing con Stack e Bottom Tabs).
- **Virtualizzazione Liste**: `@shopify/flash-list` v2 (rendering rapido di griglie e liste infinite).
- **Componenti Modali Touch-Native**: Modali custom touch-safe basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e slide animation) con overlay OLED e padding responsivo, in sostituzione di `@expo/ui` BottomSheet per azzerare crash Fabric/Compose in landscape, fullscreen e su scrolling annidato.
- **Gestione Sistema Android & Navbar**: `expo-navigation-bar` con modalità immersiva auto-hide (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) per nascondere la barra di sistema ad app aperta e richiamarla con swipe dal basso, e `react-native-safe-area-context` per l'adattamento dinamico con la navbar a 3 pulsanti.
- **Data Fetching & Cache Remota**: `@tanstack/react-query` v5 con stale-time ottimizzato.
- **Storage Locale ad Alte Prestazioni**: `react-native-mmkv` v3 (zero-latency key-value store sincrono per preferiti, cronologia, configurazioni e preferenze AniSkip/Navbar).
- **Video & Multimedialità**: `expo-video` v58 con controlli touch personalizzati, OSD immersivo, HUD luminosità/volume, AniSkip (intro, outro, recap con timer 10s e rewind safe), Picture-in-Picture nativo e controlli rapidi in notifica (`MediaSession`/`MediaStyle`).
- **Styling & Temi**: Sistema dinamico reattivo ispirato a `react-native-unistyles` con `ThemeProvider` a clonazione di riferimento per aggiornamento istantaneo al click e `getContrastTextColor` per contrasto dinamico YIQ.
- **Animazioni Skeleton & UX Loading**: Primitive e layout skeleton dedicati in `src/components/skeleton` (`Skeleton`, `AnimeCardSkeleton`, `HomeScreenSkeleton`, `ExploreScreenSkeleton`, `AnimeDetailScreenSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) con animazione pulsing via driver nativo a 60/120 FPS, sfondo OLED surface (`#161616`) e zero Cumulative Layout Shift (CLS). Cleanup automatico dei loop nativi in unmount e allo scaricamento immagini (`onLoad`) per prevenire battery drain e resource leak.
- **Immagini & Asset SVG**: `expo-image` con cache disco/memoria e supporto SVG integrato.
- **Moduli di Sistema & Font**: `expo-system-ui` per tema di sistema Android automatico, `expo-font` per il rendering dei glifi vettoriali.

---

## 👆 3. UX, Gesture Touch & Layout Mobile

1. **Touch Targets Minimi**:
   - Qualsiasi elemento interattivo (`Pressable`, bottoni, chip, icone) deve rispettare l'area minima di tocco di **almeno 44x44 dp** (usare `hitSlop` per icone graficamente compatte).
2. **Safe Area, Edge-to-Edge & Adattamento Navbar**:
   - Gestire sempre notch, fotocamere punch-hole e barra di navigazione Android tramite `react-native-safe-area-context` e `react-native-edge-to-edge`.
   - Adattamento dinamico della barra inferiore delle tab (`androidBottomInset = Math.max(16, insets.bottom + 8)`): garantisce zero sovrapposizione visiva con la navbar di sistema a 3 pulsanti fissi in-app, sollevando il router dell'app e preservando l'altezza utile dei touch target $\ge 44$dp. In modalità video player, la barra di sistema torna invece automaticamente a scomparsa totale.
3. **Navigazione a Bottom Tabs & Ricerca Unificata in Home**:
   - La navigazione principale usa 4 schede con sole icone vettoriali (`tabBarShowLabel: false`): **Home**, **Preferiti**, **Cronologia**, **Impostazioni**.
   - La ricerca del catalogo con filtri avanzati è integrata direttamente nell'header della **Home** (icona lente di ingrandimento, debouncing 450ms, griglia FlashList a 2 colonne e supporto al tasto fisico Indietro di Android per chiudere la ricerca senza uscire dall'app).
   - Colore attivo delle tab agganciato dinamicamente a `theme.colors.primary`.
   - **Struttura Sezioni Schermata Home**:
     1. **Banner Hero in Evidenza**: Espone in testa l'anime raccomandato selezionato (di default il primo della top 8 dei raccomandati). Implementato come slider orizzontale a tutta larghezza con `pagingEnabled={true}` e sincronizzazione bi-direzionale protetta da `activeScrollSourceRef`. Mostra banner/artwork, badge `#1 RACCOMANDATO`, titolo (monospace, uppercase), sinossi pulita e pulsanti d'azione dedicati:
        - `RIPRODUCI` (icona `play`, avvio diretto dell'episodio salvato in cronologia/continua a guardare o fetch dell'episodio 1 con feedback visivo di caricamento e fallback sicuro a scheda dettagli);
        - `INFO` (icona `information-circle-outline`, apertura dettagli);
        - Tocco altrove sul banner: navigazione verso i dettagli della serie.
     2. **Carosello Top Raccomandati**: Subito sotto il banner hero, carosello orizzontale con tutti i raccomandati numerati progressivamente in ordine (`#1` ... `#8`). Toccando una scheda o scorrendo orizzontalmente la lista, il focus si sincronizza dinamicamente aggiornando lo slider hero soprastante con bordo e badge primario attivo. Adotta `snapToOffsets` e padding destro dinamico (`Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)`) per permettere anche alle schede #7 e #8 di scorrere fino alla posizione di focus senza blocco del clamp.
     3. **Riprendi a Guardare**: Visibile unicamente in presenza di visione in corso (`continueWatching.length > 0`), con swipe/pulsante rimozione sicuro tramite `ConfirmModal`.
     4. **Ultimi Episodi Usciti**: Carosello orizzontale delle ultime puntate aggiunte con tasto rapido `VEDI TUTTI`.
     5. **Tendenze**: Carosello orizzontale delle serie più popolari e di tendenza del momento.
     6. **Anime in Corso**: Carosello orizzontale con le serie attualmente in trasmissione ('ongoing').
     7. **Uscite della Stagione Corrente ('upcoming')**: Carosello con le prossime uscite stagionali (`homeData.upcoming` e titolo dinamico es. `USCITE INVERNO 2027` con pulsante `VEDI TUTTI`). Lo scraper (`AnimeWorldScraper.getUpcoming()` e `parseSearchPage`) supporta il contenitore `.film-listnext .item` di AnimeWorld e isola con precisione i titoli escludendo i badge `DUB` o `Special` all'interno di `.poster`.
     8. **Nuove Aggiunte**: Carosello con le ultime serie catalogate (`homeData.newAdded`).
4. **Modal e Menu Contestuali Touch-Native (Zero Jetpack Compose Crashes)**:
   - Tutti i selettori modali (filtri di ricerca `FilterBottomSheet`, batch puntate `BatchBottomSheet`, carosello episodi `PlayerEpisodesCarouselSheet`, scheda info `PlayerInfoSheet`, e opzioni server `ServerBottomSheet`) utilizzano componenti modali touch-native custom basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e slide animation) con overlay oscurato OLED, drag handle e padding simmetrico. È severamente vietato l'uso di `@expo/ui` `BottomSheet` (Jetpack Compose) che causa crash nativi non intercettati (`ViewTreeLifecycleOwner` / window detach) su fullscreen landscape, rotazioni o scroll annidati.
5. **Tipografia Monospace & Caps Lock**:
   - Tutta l'applicazione adotta rigorosamente font monospace di sistema (`'monospace'` su Android, `'Menlo'` su iOS) e testi visualizzati in **CAPS LOCK / STAMPATELLO MAIUSCOLO** (`textTransform: 'uppercase'`).
6. **Feedback Tattile & Pull-to-Refresh**:
   - Integrare feedback aptico (`expo-haptics`) sui tap principali (`ImpactFeedbackStyle.Light`, `Selection`, `NotificationFeedbackType.Success`).
   - `RefreshControl` nativo su tutte le schermate a lista per consentire la ricarica manuale dei dati da remoto con tint color coordinato al tema.
7. **Animazioni Skeleton & Zero Layout Shift (CLS)**:
   - È vietato l'uso di schermate vuote o spinner bloccanti a tutto schermo durante il fetching asincrono del catalogo, del video player o delle schermate principali.
   - Utilizzare rigorosamente i layout skeleton dedicati (`HomeScreenSkeleton`, `ExploreScreenSkeleton`, `AnimeDetailScreenSkeleton`, `AnimeCardSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) che rispecchiano fedelmente e al pixel le geometrie, proporzioni, paddings e spaziature dei componenti finali (locandine, schede tecniche, pulsanti d'azione simbolici, caroselli e tabelle metadati) per prevenire sfarfallii e scatti di layout (CLS):
     - **Zero Doppio Padding**: Se il contenitore esterno (es. `ScrollView` con `listContent`) possiede già un padding (es. 16dp), il contenitore dello skeleton interno deve avere `padding: 0` (es. `ExploreScreenSkeleton`) per posizionare le card sulle coordinate esatte della `FlashList`.
     - **Sincronizzazione Sezioni Condizionali**: Se una schermata include sezioni dipendenti da cache o stato locale (es. *Riprendi a guardare* su Home recuperata da MMKV), lo skeleton deve supportare la prop (`hasContinueWatching`) per riservare lo spazio ed evitare salti verticali al termine del fetch remoto.
     - **Altezze e Raggi Omogenei**: Le dimensioni degli skeleton devono combaciare al millimetro con i componenti reali (es. chip puntate a 52dp con `radius.md`, backdrop a 260dp, locandina dettaglio a 110x160dp).
     - **Cleanup Loop Nativi**: I cicli di animazione nativa (`Animated.loop`) devono eseguire sul thread UI nativo (`useNativeDriver: true`) e interrompersi tassativamente (`animation?.stop()`) in fase di unmount per evitare memory leak e battery drain.
8. **Reattività Tab, Storage Sincrono (`useFocusEffect`) & Pulizia Automatica**:
   - Le schede principali (`Home`, `Preferiti`, `Cronologia`, `Dettaglio`) devono sincronizzare lo stato locale con MMKV tramite `useFocusEffect` di `expo-router`, assicurando l'aggiornamento istantaneo al cambio tab senza richiedere ricariche manuali forzate.
   - Pulizia automatica periodica (`AppStorage.pruneOldProgress(maxItems, retentionDays)`) in background all'avvio in `app/_layout.tsx`, con protezione assoluta delle serie in *Riprendi a guardare*.
9. **Pre-fetching Proattivo Immagini & Batching Adattivo**:
   - Pre-fetching non bloccante via `Image.prefetch()` delle locandine in evidenza su Home ed Esplora al completamento delle query TanStack.
   - Batching dinamico episodi: batch da 25 puntate per serie standard e da 50 puntate per serie molto lunghe (+500 episodi, es. *One Piece*), con memoization e lookup O(1) progressi per azzerare i calcoli allo scroll.
10. **Gestione Rimozioni, Conferme & Componente In-App `ConfirmModal`**:
   - Ogni scheda nella cronologia di visione dispone di un'icona di rimozione dedicata (`remove-circle-outline`) con area di tocco minima $\ge 44$dp e supporto al gesto di swipe orizzontale (swipe-to-delete) con feedback aptico.
   - **Divieto Assoluto di Dialog di Sistema**: Qualsiasi conferma, cancellazione o operazione irreversibile (singolo anime, intera cronologia, rimozione da *Riprendi a guardare* su Home, o svuotamento da Impostazioni) richiede conferma esplicita tramite il componente unificato `ConfirmModal` (`src/components/ConfirmModal.tsx`). È vietato l'uso di dialog o alert di sistema grezzi (`Alert.alert`).
   - **Requisiti UX `ConfirmModal`**:
     - Estetica OLED surface (`theme.colors.surface`, bordo `theme.colors.border`, raggio `radius.lg`).
     - Tipografia rigorosamente `'monospace'` e testi in **CAPS LOCK**.
     - Contrasto dinamico YIQ (`getContrastTextColor`) sul pulsante di conferma per la massima leggibilità con qualsiasi colore primario.
     - Area di tocco minima $\ge 44$dp per i pulsanti di annulla e conferma (`minHeight: 44`).
     - Feedback tattile dedicato (`Haptics.impactAsync(Light)` su annulla/dismiss e `Haptics.notificationAsync(Success)` su conferma).
     - Overlay edge-to-edge con `statusBarTranslucent={true}` per coprire interamente la status bar Android senza tagli visivi.
11. **Scheda Tecnica Dettaglio & Metadati Estesi (`AnimeInfoTable`, `AnimeHeaderBackdrop`)**:
   - **Header Pulito, Spacing Iniziale & Copertina Espandibile a Schermo Intero**: L'intestazione della schermata anime è ripulita dalla vecchia immagine di backdrop ingrandita. Spacing iniziale protetto (`paddingTop: 68` sia su `AnimeHeaderBackdrop` che su `AnimeDetailScreenSkeleton`) per garantire che la locandina e i pulsanti d'azione inizino sempre al di sotto della barra superiore fluttuante (`topNav`), azzerando sovrapposizioni visive con il tasto fisico/touch "Indietro". La copertina (locandina 110x160dp) è interattiva e cliccabile: aprendo una card modale OLED a schermo intero con l'artwork ad alta risoluzione, dismiss al tocco esterno e pulsante di chiusura $\ge 44$dp.
   - La schermata arricchisce la panoramica con una tabella tecnica ordinata e compatta contenente: Audio, Stato, Data di Uscita, Durata, Studio, Episodi (gestendo con precisione i totali incerti o serie in corso con `??` o `?`), Voto e Genere (con cella scorrevole orizzontalmente via `ScrollView` e `nestedScrollEnabled` per consultare l'intera lista senza tagli).
   - L'header presenta accanto alla copertina i comandi rapidi di avvio: pulsante Play (`play`) e pulsante di riavvio da capo (`reload`), entrambi a soli simboli con target $\ge 44$dp.
   - Il selettore batch (`BatchBottomSheet`) è implementato come Bottom Sheet modale touch-native (senza conflitti di gesture Compose/Fabric e ripulito da sezioni correlate) per garantire selezione istantanea ad ogni tocco, feedback aptico e zero crash in Expo Go e su device fisico.
   - Sotto la tabella sono integrati i pulsanti di consultazione rapida con icone SVG dedicate (`youtube.svg`, `myanimelist.svg`, `anilist.svg`) per Trailer YouTube, MAL (etichetta rinominata `MAL`) e AniList.
   - L'azione di condivisione dell'URL AnimeWorld originale della serie è collocata unicamente nell'header fluttuante in alto a destra, affiancata al pulsante dei preferiti.
12. **Compatibilità Navbar di Sistema Android & Modalità Immersiva**:
   - Comportamento predefinito in-app `'visible'`: la barra di navigazione di sistema resta fissa e accessibile durante l'uso delle schermate dell'app, con il layout dei tab sollevato dinamicamente (`insets.bottom + 8`).
   - Nel player video orizzontale, `expo-navigation-bar` commuta automaticamente in auto-hide immersivo (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) per la massima visione a tutto schermo, ripristinando lo stato in-app alla chiusura.
   - Sincronizzazione dinamica dello stato su `AppState` (ri-applicazione automatica quando l'app torna in stato attivo dopo l'uso di notifiche o app-switcher).
   - Impostazione configurabile dall'utente in Impostazioni tra `SEMPRE VISIBILE` (default consigliato) e `NASCONDI (SWIPE)`.

---

## 🎬 4. Video Player Mobile

1. **Orientamento & Fullscreen**:
   - Apertura predefinita all'avvio in modalità **landscape fullscreen** a schermo intero orizzontale tramite `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)`.
   - Su Android attiva `SENSOR_LANDSCAPE`: se la rotazione automatica del dispositivo è attiva nel pannello di sistema, lo schermo è sensibile e ruota automaticamente a 180° tra landscape sinistro e destro.
   - Barra di navigazione nascosta e modalità immersiva durante la visualizzazione orizzontale (`expo-navigation-bar`).
2. **Gesture Controls Avanzate & Isolamento OSD**:
   - **Doppio Tap con Accumulo Sequenziale**: Skip rapido $\pm 10$ secondi con pill compatto centrato a lato del tasto Play/Pausa centrale. Tap consecutivi entro 900ms sommano il tempo visualizzato (`+20s`, `+30s`, `+50s`, `-30s`) con micro-animazione elastica.
   - **Controlli Centrali Bilanciati**: Pulsante circolare Play/Pausa affiancato da bottoni dedicati per episodio precedente (`play-skip-back`) e successivo (`play-skip-forward`), con spaziatore simmetrico per il primo e l'ultimo episodio.
   - **Swipe Rigorosamente Verticali per Luminosità e Volume**:
     - Controllo luminosità schermo (lato sinistro) e volume multimediale (lato destro) con indicatore HUD a percentuale al centro.
     - Attivazione vincolata ad asse verticale con `activeOffsetY([-18, 18])` e rigetto immediato di scorrimenti orizzontali con `failOffsetX([-14, 14])`.
     - In `onUpdate`, scarto immediato se la componente orizzontale supera quella verticale (`|translationX| > |translationY|`), con corsa calibrata su `travelRange = Math.max(260, windowHeight * 0.7)` per evitare sbalzi o eccessiva sensibilità.
   - **Disabilitazione Gesture su OSD Visibile**: Le pan gesture di volume e luminosità sono vincolate a `panGesture.enabled(!showControls)` e il `GestureDetector` è montato unicamente a controlli nascosti, evitando interferenze accidentali quando si interagisce con l'interfaccia.
   - **Luminosità 'AUTOMATICA'**: Al limite inferiore dello swipe sinistro (soglia $\le 0.08$), il valore viene impostato su `-1` (`'AUTOMATICA'`), l'overlay scuro viene disattivato per affidarsi al sensore/luminosità del sistema Android e l'HUD visualizza l'icona `sunny-outline` con testo `AUTOMATICA`.
   - **Controlli OSD**: Auto-hide automatico dopo 4 secondi di inattività; sospeso temporaneamente durante il trascinamento della timeline (`isScrubbing`).
3. **Picture-in-Picture (PiP), Controlli in Notifica & Zero Zombie Playback**:
   - Supporto nativo per Android Picture-in-Picture (`expo-video`) con flag `staysActiveInBackground = false`.
   - **Controlli Multimediali in Notifica (MediaSession / MediaStyle)**: Configurato `showNowPlayingNotification = true` e metadati completi dello stream (titolo serie con numero puntata `<Titolo> - EPISODIO <Num>`, artista, copertina anime scaricata e serializzata come JPEG byte array in `artworkData` per il controller Android 13+ e bitmap `largeIcon`), e `KuroForwardingPlayer` che garantisce la disponibilità permanente di `COMMAND_SEEK_TO_NEXT` e `COMMAND_SEEK_TO_PREVIOUS` per esporre nel cassetto delle notifiche e nei Quick Settings Android l'intera barra di controlli simmetrici (`seek -10s`, `precedente`, `play/pausa`, `successivo`, `seek +10s`), con ascoltatori dedicati `KuroNotificationNextEpisode` e `KuroNotificationPrevEpisode`.
   - **Feedback Visivo di Caricamento Integrato**: Durante il recupero del flusso video o il buffering, l'animazione di caricamento (`ActivityIndicator` con contrasto YIQ) è integrata direttamente all'interno del pulsante circolare centrale Play/Pausa (e al centro esatto dello schermo a controlli nascosti), azzerando overlay scuri o box oscuranti che coprono la visione.
   - **Rientro a Schermo Intero Senza Pause**: Memorizzazione dello stato di riproduzione PiP (`wasPlayingInPiPRef`). Quando l'utente tocca il pulsante di sistema Android per rientrare a tutto schermo, l'app torna `active` e la riproduzione prosegue/riprende fluidamente con `player.play()` senza mai entrare in pausa.
   - **Chiusura Anti-Zombie Playback**: Alla chiusura esplicita della finestra PiP tramite tasto 'X', un timer a 500ms verifica se l'applicazione è rimasta in background (`AppState.currentState !== 'active'`), mettendo in pausa il flusso solo in tale circostanza e salvando la posizione su MMKV.
4. **AniSkip con Bordo Temporizzato ad Esaurimento & Durata Configurabile**:
   - Rilevamento automatico timestamp intro, outro e recap (`op`, `ed`, `mixed-op`, `mixed-ed`, `recap`) tramite servizio AniSkip.
   - **Testo Unificato 'SALTA'**: Tutti i tipi di salto utilizzano unicamente l'etichetta sintetica e minimale `'SALTA'`.
   - **Finestra Temporizzata & Countdown (5s - 60s o Infinito)**: Il pulsante manuale compare per la durata impostata dall'utente (da 5s a 60s con granularità a 5s o infinito `∞` per la totalità dell'intervallo) con bordo superiore e inferiore che si consuma in tempo reale. Se l'utente esegue un seek indietro (rewind) nella finestra della sigla, il pulsante riappare correttamente.
   - **Salto Automatico**: In modalità automatica (configurabile in Impostazioni), la sezione viene saltata istantaneamente al raggiungimento del timestamp iniziale con reset automatico ad ogni cambio puntata.
   - Colore del testo calcolato dinamicamente con `getContrastTextColor(theme.colors.primary)` per la massima leggibilità su qualsiasi tema.
5. **Timeline con Anteprima Frame Reali (Live Scrubbing)**:
   - Estrazione istantanea dei fotogrammi video tramite `player.generateThumbnailsAsync([targetSec], { maxWidth: 160 })` su gesture touch responder.
   - Cache locale in memoria e matching per prossimità temporale (`getClosestCachedFrame` entro 12s) per garantire feedback visivo fluido a 60 FPS senza sfarfallii o lag.
   - Bolla di anteprima posizionata sopra il cursore con miniatura video, minutaggio formattato e delta tempo relativo (`+15s`, `-30s`), con touch target $\ge 44$dp e rilascio assistito da feedback aptico.
6. **Malleabilità dei Menù & Drawer Touch-Native**:
   - I drawer secondari adottano componenti modali custom basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}`), con padding orizzontale simmetrico `Math.max(16, safeHorizontalInset)` per azzerare sbilanciamenti dovuti a fotocamere o notch in landscape e prevenire tagli orizzontali a sinistra in portrait.
   - Contenitori centrati (`alignSelf: 'center'`) con larghezza massima controllata (680-820dp) e `maxHeight` responsivo in base all'orientamento dello schermo (`Math.min(380, windowHeight * 0.55)` in portrait, 240dp in landscape).
   - **Prevenzione Tagli Visivi in Portrait**:
     - Tutti i titoli degli header e i testi metadati implementano `flexShrink: 1`, `numberOfLines={1}` ed `ellipsizeMode="tail"`.
     - In `PlayerInfoSheet.tsx`, la locandina e il placeholder scalano responsive (`76x108` in portrait, `84x120` in landscape) e le etichette generi sono vincolate su riga singola.
     - In `PlayerEpisodesCarouselSheet.tsx`, la larghezza card è dinamica (`cardWidth = isLandscape ? 170 : 152`) con scorrimento fluido e padding simmetrico.
     - In `ServerBottomSheet.tsx`, il gap dei selettori di velocità scala (`isLandscape ? 8 : 4`) e i nomi server supportano troncamento elegante.
   - **Carosello Episodi Virtualizzato** (`PlayerEpisodesCarouselSheet.tsx`): icona `list-outline`, `@shopify/flash-list` con `contentContainerStyle` a padding simmetrico, `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash Fabric/Hermes, auto-scroll ad episodio attivo e navigazione differita di 60ms.
   - **Scheda Dettagli** (`PlayerInfoSheet.tsx`): icona `information-circle-outline` in header OSD con locandina, titolo, badge episodio formattato rigorosamente come `'EPISODIO X/TOT'` (es. `'EPISODIO 1/170'` o `'EPISODIO 1/??'`, pulito da suffissi titolo) e trama scrollabile protetta da fallback difensivi (`Array.isArray(genres)`).
   - **Opzioni di Riproduzione**: selettori di velocità centrati con `adjustsFontSizeToFit={true}` e `numberOfLines={1}` per prevenire tagli di testo su smartphone stretti in portrait.
7. **Isolamento Re-Render OSD & Rotazione Semantica**:
   - Componenti `PlayerHeader`, `PlayerTimeline` e `PlayerFooter` isolati con `React.memo`.
   - Icona orientamento dinamica: `phone-portrait-outline` in landscape e `phone-landscape-outline` in portrait.
   - L'evento `timeUpdate` a 500ms aggiorna unicamente la timeline e il display orario locale, lasciando il componente root `VideoPlayerScreen` e `VideoView` a zero re-render periodici.
   - Failover automatico TLD scraper (`.so`, `.ac`, `.tv`) con backoff adattivo e User-Agent sincronizzato per Android arm64.
8. **Caricamento Asincrono Flussi Video (`replaceAsync`)**:
   - È obbligatorio utilizzare `player.replaceAsync(url)` invece del metodo deprecato sincrono `player.replace(url)` di `expo-video`.
   - Su iOS e Android, `player.replace()` blocca sincronicamente il thread principale (UI/Main Thread) durante l'ispezione nativa dell'asset multimediale, provocando lag e frame-drop dell'interfaccia.
   - Tutte le chiamate a `replaceAsync` devono essere asincrone, protette con gestione degli errori (`.catch()` o try/catch) per gestire in sicurezza interruzioni causate da switch rapidi di episodio o smontaggio del componente.

---

## 🎨 5. Design System, Temi Dinamici & Impostazioni Minimali

1. **OLED Nero Assoluto (`#000000`)**:
   - Il tema base OLED deve utilizzare `#000000` puro come sfondo base per massimizzare il risparmio energetico e il contrasto sui display AMOLED.
2. **Palette Temi Supportate**:
   - **OLED Puro**: Primario Rosso `#E50914`, Sfondo `#000000`.
   - **Pikachu**: Primario Giallo `#FAD61D`, Sfondo `#000000`.
   - **Orchidea**: Primario Magenta `#E941FB`, Sfondo `#000000`.
   - **Rainbow**: Primario Turchese `#73FEC8`, Sfondo `#000000`.
   - **Personalizzato**: Colore primario configurabile con contrasto garantito.
3. **Reattività al Click & Contrasto Dinamico YIQ**:
   - I componenti devono consumare `useTheme()` da `@/theme` per aggiornare bordi, badge, pulsanti e indicatori di progresso istantaneamente al click nel selettore temi.
   - Tutti i testi o icone renderizzati sopra il colore primario o sfondi accentati devono utilizzare `getContrastTextColor(color)`: garantisce testo nero scuro (`#000000`) per tinte ad elevata luminanza (es. Pikachu, Rainbow) e bianco (`#FFFFFF`) per tinte scure o medie.
4. **Schermata Impostazioni Minimale**:
   - **Tema**: Pulsanti minimalisti con sole icone SVG, senza testo aggiuntivo.
   - **Impostazioni AniSkip con Slider a Scorrimento, Durata Popup & Auto-Off Fallback**: Selettore della modalità di salto implementato con il componente touch-native `AniSkipSlider` a scorrimento in stile `HistorySlider` tra `OFF` (disattivato), `MANUALE` e `AUTO`, persistito sincronicamente su MMKV con listener reattivo nel player, affiancato dai toggle per cosa saltare (`INTRO`, `RECAP`, `OUTRO`). La descrizione di `AUTO` si adatta dinamicamente agli elementi selezionati (es. "SALTA AUTOMATICAMENTE INTRO E OUTRO..."), deselezionare tutti gli elementi commuta automaticamente la modalità su `OFF`, e lo slider `AniSkipDurationSlider` consente di calibrare la permanenza del popup da 5 a 60 secondi (intervalli di 5s all'inizio) fino a `∞` (infinito, per la totalità dell'intervallo).
   - **Navbar di Sistema Android**: Descrizione snellita ed essenziale tra `NASCONDI (SWIPE)` (a scomparsa, richiamabile con swipe dal basso) e `SEMPRE VISIBILE` (sempre fissa e visibile in-app).
   - **Sorgente**: Selezione rapida dei domini supportati (`.ac`, `.so`, `.tv`) oppure URL digitabile liberamente a mano con pulsante APPLICA.
   - **Impostazioni Cronologia & Slider Reattivo**: Sezione dedicata con `HistorySlider` per la durata di conservazione: `OFF` (disattiva la registrazione e nasconde dinamicamente la tab Cronologia dalla navigazione inferiore via `href: null`), `30gg`, `60gg`, `90gg` e `ON` (conservazione permanente illimitata). Include il pulsante per svuotare l'intera cronologia con modale di conferma in-app.
   - **Informazioni & Updater Unificati**: Sezione con Nome, Stack, Package Name, Versione+Build installata e Architettura APK. In fondo alla sezione è posizionato il pulsante per verificare/aggiornare l'app.
   - **Notifica Aggiornamenti all'Avvio & Auto-Scroll Coordinato**: Controllo non-bloccante in background all'avvio con componente modale in-app `UpdateModal` (note di rilascio, "PIÙ TARDI" o "AGGIORNA ORA"). Il tocco su "AGGIORNA ORA" indirizza a `/(tabs)/settings?scrollTo=update`, aziona lo scroll progressivo verso il basso e aggancia l'evento `onContentSizeChange` sulla `ScrollView`: quando la card si espande con la progress bar e i metadati di download, la vista scorre fluidamente fino a mostrare interamente la barra e il tasto per installare l'APK. In caso di differimento ("PIÙ TARDI"), l'icona Impostazioni mostra una freccia in sù (`arrow-up`) animata con rimbalzo continuo per non perdere la notifica visiva.
   - **Endpoint OTA Nascosto**: L'URL tecnico del manifest Cloudflare è rigorosamente nascosto e protetto all'interno del client.

---

## 🚀 6. Pipeline di Release, Sicurezza & OTA

1. **Cloudflare Worker & R2 Isolati**:
   - L'applicazione mobile interroga gli aggiornamenti esclusivamente su:
     `https://kuro-tv.<subdomain>.workers.dev/mobile/manifest.json`
   - Il download dell'APK avviene da `/mobile/latest.apk`.
   - L'URL manifest è bloccato in sola lettura (`READ-ONLY`) all'interno dell'app per prevenire manomissioni o puntamenti errati alla versione TV.
2. **Quarantena di Sicurezza e Credenziali**:
   - È fatto divieto assoluto di committare file `.env`, `.env.local`, file `.keystore`, file `.enc` in chiaro o la directory `credentials/`.
   - La cartella `.gitignore` protegge in modo rigoroso segreti, build locali e cartelle legacy.
3. **Target Architettura Esclusiva (`arm64-v8a`)**:
   - La pipeline di rilascio (`build-release.sh`) compila esclusivamente APK per architettura `arm64-v8a` (`reactNativeArchitectures=arm64-v8a`), standard di tutti gli smartphone Android moderni.
   - Gli artifact di release caricati su Cloudflare R2 sono limitati in sovrascrittura ai soli `mobile/latest.apk` e `mobile/manifest.json`, azzerando lo spreco di storage.
   - I backup cifrati dei segreti e keystore risiedono rigorosamente nel percorso isolato `mobile/secure-backups/` su R2, separati dai backup della versione TV.
   - Il client in-app preserva altrove il sistema di fetch su base architettura OTA (`selectApkForDevice`) con fallback trasparente su `universal` (`latest.apk`).
4. **Tooling & Script di Manutenzione Tracciati (`scripts/`)**:
   - La directory `scripts/` è tracciata nel repository Git e contiene gli strumenti operativi (`build-release.sh`, `backup-secrets-r2.sh`, `upload-r2.mjs`, `upload-github-release.mjs`, `clean-r2-old-versions.mjs`, `apply-patches.mjs` e `patches/`).
   - Gli script consumano segreti solo da variabili d'ambiente (`.env`, `.env.local`), senza alcuna credenziale hardcoded nel codice sorgente.
   - `build-release.sh` supporta la flag `--skip-build` per bypassare la compilazione Gradle e finalizzare/pubblicare un APK già generato senza rieseguire il build completo.
   - **Patching Automatico Moduli Nativi (`scripts/apply-patches.mjs`)**:
     - Eseguito automaticamente al `postinstall` di `npm install`, applica le patch native tracciate in `scripts/patches/` su `expo-video` (`ExpoVideoPlaybackService.kt` e `VideoMediaSessionCallback.kt`).
     - Abilita il pulsante episodio successivo (`COMMAND_SEEK_TO_NEXT`), il caricamento asincrono in background della locandina in formato Bitmap (`largeIcon`) e la formattazione avanzata titolo/puntata nel cassetto delle notifiche Android (`MediaSession` / `MediaStyle`), preservando le modifiche ad ogni installazione di dipendenze.
   - **Gestione SemVer e Build Number (`build-release.sh`)**:
     - L'inserimento manuale di una versione (`1.2.0`, `1.0.0`, `v1.0.0`) **incrementa sempre automaticamente** il `versionCode` (`CURRENT_VERSION_CODE + 1`), garantendo l'accettazione del pacchetto dall'installer Android.
     - Per preservare la build numerica esistente occorre selezionare l'opzione `0` (*"Mantieni vX.Y.Z"*).
     - Supporto per build esplicita con sintassi `X.Y.Z:B` (es. `1.2.0:5`) e flag CLI non-interattive `-v, --version <ver>` e `-b, --build-number <num>`.
   - **Pubblicazione GitHub Release & Sincronizzazione Repository Git**:
     - La fase di pubblicazione GitHub sincronizza l'intero repository locale (`git add -A` e `git push origin <branch>`), garantendo l'allineamento perfetto del repo remoto con tutti i file e componenti modificati o aggiunti.
     - In caso di build consecutive con lo stesso numero di versione ma diversi build code, la release GitHub viene sovrascritta/aggiornata ripulendo automaticamente i vecchi asset APK (`kurotv-v*.apk` con build number differente), lasciando unicamente l'APK e il pacchetto versionato della build attiva.

---

## 🧪 7. Standard di Test & Verifica Qualità

Prima di ogni commit o push è obbligatorio verificare la conformità tramite:
1. `npm test`: Suite di test automatizzata a 14 stadi:
   - SemVer e Updater Service.
   - Regole di Stile Mobile & conformità OLED.
   - Storage MMKV (preferiti, cronologia visione).
   - Logica di batching episodi e griglia puntate.
   - Intervalli AniSkip, Gestione Velocità & Luminosità.
   - Componenti Animazioni Skeleton (OLED compliant, no layout shift, zero Hermes crash) e Componente In-App `ConfirmModal` (divieto assoluto di `Alert.alert` di sistema, touch target >= 44dp e contrasto YIQ).
   - Default export di tutte le rotte Expo Router & sicurezza Hermes.
   - Nuove Feature: UpdateStore, UpdateModal, Tab Arrow, Touch Sheets & PiP Controls.
   - Sheets Cutoff Fixes, AniSkip Settings & FilterBottomSheet Modal.
   - System Navigation Bar Compatibility & Auto-Hide Mode.
   - Gestures Verticali, PiP No-Pause, Sheets Dimensioni & Update Scroll.
   - AniSkipSlider, Player Integrated Loader & Media Notification.
   - AniSkip Dynamic Auto Description, Auto-Off Fallback & Duration Slider.
   - Ridefinizione Schermata Home & Scraper (Hero Swiper, Raccomandati numerati, Snapping, Play/Info, Caroselli, Upcoming `.film-listnext` & Anti-Corruzione Titoli).
2. `npx expo export --platform android`: Verifica dell'assenza di errori di bundle e corretta generazione del bytecode Hermes.
