# 🎬 Video Player Mobile — Specifiche & Architettura

Il video player di Kuro Mobile ([`app/player/[id].tsx`](../app/player/[id].tsx)) è il cuore pulsante dell'applicazione, progettato per offrire un'esperienza multimediale touch cinematografica, reattiva e ottimizzata per display AMOLED.

---

## 👆 Gesture Touch & Controlli OSD

Il player integra gesture native ad altissima fluidità tramite `react-native-gesture-handler`:

### 1. Salto Rapido con Doppio Tap & Accumulo Sequenziale
- **Metà Sinistra**: Salto all'indietro rapido di 10 secondi.
- **Metà Destra**: Salto in avanti rapido di 10 secondi.
- **Pill di Feedback Centrale**: Il feedback visivo non è invasivo; è un compatto pill posizionato al centro dello schermo immediatamente a lato del tasto centrale Play/Pausa (`marginRight: 64` a sinistra, `marginLeft: 64` a destra).
- **Accumulo Sequenziale Intelligente**: Tap consecutivi entro 900ms sommano il tempo complessivo di skip visualizzato (`+20s`, `+30s`, `+50s`, `-30s`, ecc.) con una micro-animazione elastica di rimbalzo invece di resettare l'animazione.

### 2. Controlli Centrali OSD
- **Tris di Pulsanti Principali**: Il pulsante centrale circolare Play/Pausa è affiancato dai pulsanti per passare direttamente all'**Episodio Precedente** (`play-skip-back`) e all'**Episodio Successivo** (`play-skip-forward`).
- **Bilanciamento Dinamico**: Quando la puntata corrente è la prima o l'ultima della serie, uno spaziatore trasparente simmetrico mantiene il pulsante Play/Pausa perfettamente centrato al pixel.

### 3. Swipe Rigorosamente Verticali per Luminosità e Volume (Controllo Nativo di Sistema)
- **Isolamento dell'Asse**:
  - Attivazione vincolata con soglia minima verticale `activeOffsetY([-18, 18])` per evitare inneschi accidentali su tocchi leggeri.
  - Rigetto immediato del pan con `failOffsetX([-14, 14])`: se lo swipe è orizzontale la gesture fallisce e non altera volume o luminosità.
  - In `onUpdate`, esclusione dei frame di pan in cui la componente orizzontale domina (`Math.abs(e.translationX) > Math.abs(e.translationY)`).
- **Escursione Adattiva sullo Spazio Disponibile (`computeVerticalGestureTravelRange`)**:
  - La corsa verticale `travelRange` viene calibrata dinamicamente sull'altezza utile del player (`windowHeight - insets.top - insets.bottom`, `safeHeight * 0.50 - 18dp`, compresa tra `130dp` e `260dp`) anziché su una soglia fissa troppo ampia.
  - Ciò garantisce il passaggio completo **da `100%` a `0%` o `AUTOMATICA` in un singolo swipe** confortevole sia su smartphone in landscape sia in portrait o su tablet.
- **Swipe Lato Sinistro — Luminosità Hardware Confinata al Player (`KuroDeviceControls.setWindowBrightness`)**:
  - Regola la luminosità reale della finestra corrente (`WindowManager.LayoutParams.screenBrightness`, range `0%`–`100%` con soglia minima sicura `0.005f`) senza richiedere permessi di sistema globali.
  - **Luminosità `'AUTOMATICA'`**: Al limite inferiore dello swipe (`raw <= -0.04`), il valore passa a `-1` (`BRIGHTNESS_OVERRIDE_NONE`) ripristinando la luminosità adattiva del sistema (`sunny-outline`). Alla ripartenza verso l'alto da `'AUTOMATICA'`, lo swipe legge la luminosità di sistema corrente (`getSystemBrightness`) per una progressione fluida senza salti visivi.
  - **Isolamento Stretto al Solo Player**: La modifica resta attiva esclusivamente durante la visione nel player; alla chiusura, al cambio schermata (`useFocusEffect` blur/unmount), all'ingresso in PiP o al passaggio in background, `restoreSystemBrightness()` ripristina immediatamente la luminosità di sistema (`-1.0f`) così da non alterare mai le altre schermate dell'app o il sistema operativo.
- **Swipe Lato Destro — Volume Multimediale Reale di Sistema (`AudioManager.STREAM_MUSIC`)**:
  - Modula direttamente l'intero range reale del volume multimediale Android (`0%`–`100%` mappato su `0..getStreamMaxVolume(STREAM_MUSIC)` via `KuroDeviceControls.setSystemVolume`, con `player.volume` mantenuto a `1.0` per evitare doppie attenuazioni).
  - Alla partenza della gesture (`onStart`), legge lo step hardware reale corrente (`getSystemVolumeInfo`), rimanendo sempre sincronizzato anche con i tasti fisici del dispositivo e senza mostrare il toast nativo Android sopra l'HUD OLED.
- **Disabilitazione su OSD Attivo**: Le pan gesture di volume e luminosità sono vincolate a `panGesture.enabled(!showControls)` e attive solo a controlli nascosti, evitando interferenze accidentali quando si interagisce con l'interfaccia.
- **Badge HUD Centrale**: Feedback visivo compatto con icone solari, altoparlante o tachimetro con auto-dismiss a 1.2 secondi.

### 4. Ciclo di Vita dell'OSD (On-Screen Display)
- **Singolo Tap**: Mostra o nasconde i controlli OSD (Header, Barra Timeline, Comandi centrali e Footer).
- **Auto-Hide a 4 Secondi**: A controlli inattivi, l'OSD si dissolve automaticamente.
- **Congelamento durante lo Scrub**: Durante il trascinamento della timeline (`isScrubbing`), il timer di auto-hide viene sospeso per non chiudere l'interfaccia a metà operazione.

---

## 🎞️ Timeline con Anteprima dei Frame Reali (Live Scrubbing) & Segmentazione Capitoli YouTube

La barra di avanzamento ([`src/components/player/PlayerTimeline.tsx`](../src/components/player/PlayerTimeline.tsx)) include un sistema di anteprima reattiva a 60 FPS con segmentazione a capitoli in stile YouTube:

1. **Segmentazione Capitoli in Stile YouTube**:
   - Ripartizione visiva dinamica dell'intera durata video in segmenti logici separati da gap discreti (`gap: 2.5` a riposo, `3` durante lo scrub a 6dp): `[EPISODIO]` (colore primario tema), `[SIGLA INIZIALE]` (ambra `#FBBF24`), `[SIGLA FINALE]` (viola `#A78BFA`), `[RECAP]` (azzurro `#38BDF8`) e `[POST-CREDITS]` (verde smeraldo `#34D399`).
   - Sfondo delle porzioni non ancora riprodotte pre-tinteggiato con opacità OLED dedicata per riconoscere a colpo d'occhio la posizione di intro, outro e scene post-credit anche a player fermo.
   - Fallback immediato alla barra continua classica (`timelineTrack`) in assenza di metadati AniSkip o su stream senza intervalli registrati.
2. **Estrazione Fotogrammi Video & Time-Scrubbing HUD OLED**: Durante lo scrub, il player interroga le API native di decodifica `player.generateThumbnailsAsync([targetSecond], { maxWidth: 160 })` con quantizzazione a bucket di 5 secondi per sole sorgenti locali scaricate.
3. **Cache in Memoria & Proximity Matching**: I frame decodificati vengono memorizzati in una `thumbnailCache` locale (fino a 50 item con logica LRU). L'algoritmo `getClosestCachedFrame` individua istantaneamente il fotogramma più vicino (entro 15 secondi), garantendo una risposta visiva immediata durante lo scorrimento continuo delle dita.
4. **Card Fluttuante & Cursore Adattivo**: La bolla di preview OLED sovrasta il cursore, mostrando la miniatura del frame reale, il minutaggio esatto, il delta temporale relativo (`+02:45` verde `#4ADE80`, `-01:10` rosso `#F87171`) e il badge capitolo attivo. Il thumb di scorrimento adotta dinamicamente il colore coordinato del capitolo puntato.
5. **Target Touch $\ge 44$dp, Haptics & Accessibilità**: Wrapper touch con altezza minima 44dp, feedback aptico leggero (`Haptics.impactAsync(Light)`) protetto da debounce anti-jitter a 100ms al passaggio tra capitoli durante il trascinamento (`findChapterAtTime`), feedback di rilascio `Haptics.selectionAsync()`, e supporto completo per TalkBack (`accessibilityValue` e `accessibilityActions` a incrementi/decrementi di 10 secondi).

---

## ⏭️ Integrazione AniSkip con Bordo Temporizzato, Durata Configurabile & Passaggio a `'PROSSIMO'`

Il player si interfaccia in background con il servizio **AniSkip** ([`src/services/aniskip/index.ts`](../src/services/aniskip/index.ts), [`src/components/AniSkipButton.tsx`](../src/components/AniSkipButton.tsx)):

1. **Recupero Timestamp & Tipi Supportati**: Rilevamento automatico degli intervalli per sigla d'apertura (`op`, `mixed-op`), chiusura (`ed`, `mixed-ed`) e `recap`.
2. **Etichette `'SALTA'` e `'PROSSIMO'`**:
   - I salti interni (`op`, `mixed-op`, `recap`, ed ending con contenuto successivo o sull'ultimo episodio) mostrano `'SALTA'` (icona `play-forward`).
   - Quando è richiesto il passaggio diretto alla puntata successiva viene mostrata la variante `'PROSSIMO'` (icona `play-skip-forward`), che salva lo stato di completamento della puntata corrente (`markCurrentCompleted: true`) prima di aprire l'episodio successivo.
3. **Ending a Fine Episodio vs. Scene Post-Ending (`computeAniSkipOverlayState`, senza coesistenza)**:
   - I pulsanti `'SALTA'` e `'PROSSIMO'` non vengono mai mostrati contemporaneamente.
   - **Coincidenza con la fine (`≤ 5s`)**: Se l'intervallo di ending termina entro `5` secondi dalla durata effettiva dell'episodio ed esiste un episodio successivo, `'SALTA'` viene sostituito direttamente da **`'PROSSIMO'`** (prevenendo il salto inutile alla fine dello stream già concluso). Sull'ultimo episodio resta sempre `'SALTA'`.
   - **Presenza di sezione post-ending (`> 5s` dalla fine)**: Durante la sigla di chiusura, in modalità `MANUALE` compare unicamente `'SALTA'` (che salta alla fine della sigla); solo **dopo** la fine della ending (raggiungendone il termine oppure subito dopo lo skip manuale/automatico) compare separatamente **`'PROSSIMO'`** per la durata configurata dall'utente.
4. **Durata Configurabile (`5s` – `60s` / `∞`) & Resilienza al Rewind**:
   - In modalità manuale (e per il pulsante `'PROSSIMO'` post-ending), entrambi i pulsanti utilizzano `buttonDuration` configurato in Impostazioni (`5s`, `10s`, `15s`, `20s`, `30s`, `45s`, `60s`, `∞`), dopodiché si dissolvono (`onTimeout`).
   - Se l'utente torna indietro nel video (rewind) all'interno della finestra attiva, il pulsante riappare immediatamente con il tempo residuo proporzionale alla durata configurata:
     $$\text{ratio} = \frac{\text{maxDuration} - \text{elapsed}}{\text{maxDuration}}$$
5. **Modalità Automatica**: In modalità `AUTO` (configurabile dall'utente in Impostazioni), l'intervallo viene saltato all'istante al raggiungimento del timestamp iniziale (oppure naviga automaticamente all'episodio successivo se la ending coincide con la fine entro `5s` ed esiste un episodio seguente). Se la ending ha una scena post-ending, subito dopo il salto automatico viene comunque proposto `'PROSSIMO'` per la durata impostata.
6. **Isolamento Tocco & Contrasto**: `zIndex: 10`, elevazione nativa e rendering esclusivo del solo pulsante attivo, con contrasto OLED elevato.

---

## 📑 Drawer & Modali Touch-Native (Zero Crash Fabric/Compose & No Cutoff)

Tutti i menù secondari sfruttano modali touch-native basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e `animationType="fade"`) combinati con `useBottomSheetDragDismiss` per la chiusura fluida tramite swipe-down (senza doppio slide-out o rimbalzo Android al rilascio), eliminando le fragilità e i crash nativi di Jetpack Compose (`@expo/ui`) su layout fullscreen landscape e rotazioni:

- **Centratura Ottica & Dimensioni Responsive (Nessun Taglio ai Lati)**:
  - Applicato padding orizzontale simmetrico `horizontalPadding = Math.max(16, safeHorizontalInset)` su entrambi i lati.
  - Testi degli header e sottotitoli vincolati con `flexShrink: 1`, `numberOfLines={1}` ed `ellipsizeMode="tail"` per prevenire sbordamenti o tagli visivi a destra e a sinistra su display verticali o stretti.
- **Carosello Episodi Virtualizzato** ([`PlayerEpisodesCarouselSheet.tsx`](../src/components/player/PlayerEpisodesCarouselSheet.tsx)):
  - Icona intuitiva `list-outline` nel footer del player.
  - Virtualizzazione orizzontale con `@shopify/flash-list` (`FlashList`), layout stabile con `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash nativi Fabric/Hermes.
  - Larghezza card scalata su orientamento (`cardWidth = isLandscape ? 170 : 152`) con padding simmetrico direttamente su `contentContainerStyle`.
  - Scorrimento programmatico sicuro all'episodio attivo (`initialScrollIndex` e `scrollToIndex` protetto da try/catch).
  - Navigazione asincrona differita di 60ms alla selezione per concedere al Dialog nativo Android il tempo di chiusura.
- **Scheda Dettagli & Trama** ([`PlayerInfoSheet.tsx`](../src/components/player/PlayerInfoSheet.tsx)):
  - Tasto `information-circle-outline` nell'header OSD.
  - Badge episodio formattato rigorosamente come `'EPISODIO X/TOT'` (es. `'EPISODIO 1/170'`, `'EPISODIO 1/??'`), pulito da suffissi titolo puntata ridondanti.
  - Normalizzazione difensiva di generi (`Array.isArray(genres)`), etichette con `numberOfLines={1}` e testi maiuscoli.
  - Locandina anime e placeholder ridimensionati dinamicamente (`76x108` in portrait, `84x120` in landscape), metadati con `minWidth: 0` e sinossi completa in un riquadro scrollabile.
- **Opzioni di Riproduzione & Velocità** ([`ServerBottomSheet.tsx`](../src/components/ServerBottomSheet.tsx)):
  - Centratura ottica dei selettori di velocità ($0.75\times, 1.0\times, 1.25\times, 1.5\times, 2.0\times$) con gap responsive (`isLandscape ? 8 : 4`) e selezione server video con troncamento automatico del testo lungo.
  - `maxHeight` responsivo in base all'orientamento dello schermo (`Math.min(380, windowHeight * 0.55)` in portrait, 240dp in landscape).

---

## 🔄 Orientamento, Fullscreen & Picture-in-Picture con Controlli in Notifica

- **Avvio Automatico in Landscape**: Il player si apre per default in modalità orizzontale a tutto schermo con `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)`.
- **Sensore Landscape Android**: Con rotazione automatica attiva nel sistema, lo schermo è sensibile e ruota liberamente a 180° tra landscape sinistro e destro.
- **Barra di Navigazione Nascosta**: All'interno del player, la navbar di sistema Android è rigorosamente nascosta per la massima immersione cinematografica e ripristina la modalità utente solo all'uscita.
- **Picture-in-Picture (PiP) Senza Pause & Controlli Rapidi MediaStyle**:
  - Tasto PiP dedicato nell'header (`open-outline`).
  - `player.showNowPlayingNotification = true` e metadati ottimizzati per la compattezza della notifica Android: titolo principale `EPISODIO <Num>` (sempre leggibile senza troncamenti), sottotitolo/artista con il titolo della serie in maiuscolo (fallback `'KURO MOBILE'`), e locandina artwork scaricata e serializzata come JPEG byte array in `artworkData` per i Quick Settings di Android 13+ e bitmap `largeIcon`.
  - `KuroForwardingPlayer` nativo (`scripts/patches/expo-video/ExpoVideoPlaybackService.kt` + `VideoMediaSessionCallback.kt`, compilato da sorgente tramite `expo.autolinking.android.buildFromSource: ["expo-video"]` in `package.json` anziché tramite l'AAR precompilato di `local-maven-repo`) garantisce la disponibilità permanente di `COMMAND_SEEK_TO_NEXT`, `COMMAND_SEEK_TO_NEXT_MEDIA_ITEM`, `COMMAND_SEEK_TO_PREVIOUS` e `COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM` (anche su `onAvailableCommandsChanged` tramite wrapper listener), per esporre nel cassetto delle notifiche l'intera barra simmetrica a 5 tasti (`seek -10s`, `precedente`, `play/pausa`, `successivo`, `seek +10s`), con emissione singola su `KuroNotificationNextEpisode` e `KuroNotificationPrevEpisode`.
  - **Feedback Visivo di Caricamento & Recovery da Stall**: Durante il recupero del flusso, il buffering iniziale o gli stalli di rete/background (`playback-state.ts`), l'animazione di caricamento (`ActivityIndicator` con contrasto YIQ) è integrata direttamente nel pulsante centrale Play/Pausa e al centro dello schermo. La state machine distingue pause esterne (`AudioFocusManager` / notifica / background) dal buffering reale (`status === 'loading'`) e risincronizza lo stato al rientro in foreground (`syncPlayerStateFromNative`), applicando un recupero progressivo (`soft_kick` a `5s`, pulsante manuale `RICARICA STREAM` a `6s`, ricaricamento stream alla posizione corrente `loadStream(currentTime)` a `11s`) e purgando i socket HTTP idle al foreground tramite patch native `expo-video` (`DataSourceUtils.kt` + `VideoManager.kt`).
  - **Rientro a Tutto Schermo Fluido**: Memorizzazione in tempo reale di `wasPlayingInPiPRef`. Quando l'utente tocca il pulsante Android per rientrare a schermo intero dal PiP, l'Activity torna in primo piano (`AppState === 'active'`) e `player.play()` riprende istantaneamente la riproduzione senza pause o scatti.
  - **Chiusura Volontaria con la 'X'**: In `onPictureInPictureStop`, un timer di tolleranza di 500ms attende l'eventuale riattivazione dell'Activity; solo se l'app rimane effettivamente in background lo stream viene messo in pausa, salvando i progressi di visione su MMKV.

---

## ⚡ Caricamento Asincrono dello Stream (`replaceAsync`)

Per azzerare i blocchi dell'interfaccia utente durante la risoluzione e l'avvio della riproduzione, il player adotta rigorosamente il pattern asincrono introdotto in `expo-video` v58:

1. **Eliminazione del Blocco Sincrono sul Main Thread**:
   - Il metodo standard sincrono `player.replace(url)` effettua l'inizializzazione dell'asset (`AVPlayerItem` / ExoPlayer) direttamente sul thread UI principale, causando micro-freeze dell'interfaccia (warning ufficiale: *`WARN On iOS VideoPlayer.replace loads the asset data synchronously on the main thread, which can lead to UI freezes and will be deprecated in a future release`*).
   - Kuro Mobile adotta `await player.replaceAsync(directUrl)`, spostando la risoluzione dell'asset nativo e il buffering su background thread.
2. **Resilienza ai Cambi Rapidi di Episodio**:
   - In [`app/player/[id].tsx`](../app/player/[id].tsx), la chiamata asincrona è incapsulata con protezione dagli errori:
     ```tsx
     if (typeof player.replaceAsync === 'function') {
       await player.replaceAsync(directUrl).catch((err) => {
         console.warn('[VideoPlayer] replaceAsync error:', err);
       });
     } else {
       player.replace(directUrl);
     }
     ```
   - Questo previene unhandled promise rejections se l'utente cambia episodio velocemente o smonta il player prima del completamento dell'operazione.

---

## 📥 Download in Riproduzione & Visione Offline

Il player video integra il supporto nativo alla visione offline e al download immediato della puntata in corso di visione:

1. **Pulsante Download Rapido nell'Header OSD (`PlayerHeader.tsx`)**:
   - Posizionato tra l'indicatore di qualità e il pulsante info, consente di accodare il download dell'episodio corrente con un singolo tocco.
   - Mostra lo stato dinamico in tempo reale: icona `cloud-download-outline` se non scaricato, percentuale di avanzamento durante il download, spunta `checkmark-circle` verde a operazione completata.
2. **Prioritizzazione Automatica del File Locale (Offline-First Playback)**:
   - In `app/player/[id].tsx`, la funzione `loadStream` controlla prioritariamente se l'episodio è presente nella libreria locale (`DownloadService.isEpisodeDownloaded(animeId, episodeNum)`).
   - Se il file è presente su disco, assegna istantaneamente la sorgente locale `file://` (`source = { uri: fileUri }`), bypassando interamente le chiamate di rete allo scraper e ai server di streaming.
   - Azzeramento totale del tempo di caricamento (buffering a 0ms) e consumo nullo di traffico dati.
3. **Badge OSD `LOCALE / OFFLINE`**:
   - Quando l'episodio è riprodotto da disco, l'header OSD espone il badge visivo verde **`LOCALE / OFFLINE`**, informando l'utente dello stato di visione offline garantita anche in totale assenza di connessione internet.
