# 🎬 Video Player Mobile — Specifiche & Architettura

Il video player di Kuro Mobile ([`app/player/[id].tsx`](file:///home/g4s/VSCode/KuroM/app/player/[id].tsx)) è il cuore pulsante dell'applicazione, progettato per offrire un'esperienza multimediale touch cinematografica, reattiva e ottimizzata per display AMOLED.

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

### 3. Swipe Rigorosamente Verticali per Luminosità e Volume
- **Isolamento dell'Asse**:
  - Attivazione vincolata con soglia minima verticale `activeOffsetY([-18, 18])` per evitare inneschi accidentali su tocchi leggeri.
  - Rigetto immediato del pan con `failOffsetX([-14, 14])`: se lo swipe è orizzontale la gesture fallisce e non altera volume o luminosità.
  - In `onUpdate`, esclusione dei frame di pan in cui la componente orizzontale domina (`Math.abs(e.translationX) > Math.abs(e.translationY)`).
  - Corsa di regolazione progressiva su travel range calibrato (`Math.max(260, windowHeight * 0.7)`), offrendo sensibilità naturale a 60/120 FPS.
- **Swipe Lato Sinistro**: Regolazione continua della luminosità dello schermo (da 10% a 100%).
- **Luminosità 'AUTOMATICA'**: Al limite inferiore dello swipe ($\le 0.08$), la luminosità passa a modalità `-1` (`'AUTOMATICA'`), l'overlay scuro si disattiva per affidarsi al sensore di sistema Android e l'HUD mostra l'icona solare `sunny-outline`.
- **Swipe Lato Destro**: Regolazione del volume multimediale (da 0% a 100%).
- **Disabilitazione su OSD Attivo**: Le pan gesture di volume e luminosità sono vincolate a `panGesture.enabled(!showControls)` e attive solo a controlli nascosti, evitando interferenze accidentali quando si interagisce con l'interfaccia.
- **Badge HUD Centrale**: Feedback visivo compatto con icone solari, altoparlante o tachimetro con auto-dismiss a 1.2 secondi.

### 4. Ciclo di Vita dell'OSD (On-Screen Display)
- **Singolo Tap**: Mostra o nasconde i controlli OSD (Header, Barra Timeline, Comandi centrali e Footer).
- **Auto-Hide a 4 Secondi**: A controlli inattivi, l'OSD si dissolve automaticamente.
- **Congelamento durante lo Scrub**: Durante il trascinamento della timeline (`isScrubbing`), il timer di auto-hide viene sospeso per non chiudere l'interfaccia a metà operazione.

---

## 🎞️ Timeline con Anteprima dei Frame Reali (Live Scrubbing)

La barra di avanzamento ([`src/components/player/PlayerTimeline.tsx`](file:///home/g4s/VSCode/KuroM/src/components/player/PlayerTimeline.tsx)) include un sistema di anteprima reattiva a 60 FPS:

1. **Estrazione Fotogrammi Video**: Durante lo scrub, il player interroga le API native di decodifica `player.generateThumbnailsAsync([targetSecond], { maxWidth: 160 })`.
2. **Cache in Memoria & Proximity Matching**: I frame decodificati vengono memorizzati in una `thumbnailCache` locale. L'algoritmo `getClosestCachedFrame` individua istantaneamente il fotogramma più vicino (entro 12 secondi), garantendo una risposta visiva immediata durante lo scorrimento continuo delle dita.
3. **Card Fluttuante**: La bolla di preview sovrasta il cursore, mostrando la miniatura del frame reale, il minutaggio esatto formattato e il delta temporale relativo (`+15s`, `-30s`).
4. **Target Touch $\ge 44$dp & Haptics**: Wrapper touch con altezza minima 44dp e feedback aptico `Haptics.selectionAsync()` al rilascio del cursore.

---

## ⏭️ Integrazione AniSkip con Bordo Temporizzato ad Esaurimento (10s & Recap)

Il player si interfaccia in background con il servizio **AniSkip** ([`src/components/AniSkipButton.tsx`](file:///home/g4s/VSCode/KuroM/src/components/AniSkipButton.tsx)):

1. **Recupero Timestamp & Tipi Supportati**: Rilevamento automatico degli intervalli per sigla d'apertura (`op`, `mixed-op`), chiusura (`ed`, `mixed-ed`) e `recap`.
2. **Etichetta Unificata 'SALTA'**: Tutti i tipi di skip utilizzano la stringa minimale `'SALTA'`.
3. **Timer di Esposizione a 10 Secondi**:
   - In modalità manuale, il pulsante viene mostrato per massimo **10 secondi** dall'inizio dell'intervallo (o per l'intera durata della sezione se inferiore a 10s), dopodiché si dissolve automaticamente (`onTimeout`).
   - Se l'utente torna indietro nel video (rewind) all'interno dei primi 10s della sezione, il pulsante 'SALTA' riappare immediatamente con il tempo residuo.
   - Bordo superiore e inferiore animato a consumo in tempo reale proporzionale ai 10s:
     $$\text{ratio} = \frac{\text{maxDuration} - \text{elapsed}}{\text{maxDuration}}$$
4. **Modalità Automatica**: In modalità auto (configurabile dall'utente in Impostazioni), l'intervallo viene saltato all'istante al raggiungimento del timestamp iniziale.
5. **Isolamento Tocco & Contrasto YIQ**: `zIndex: 10` ed elevazione nativa, con colore del testo calcolato dinamicamente con `getContrastTextColor(theme.colors.primary)` per la massima leggibilità.

---

## 📑 Drawer & Modali Touch-Native (Zero Crash Fabric/Compose & No Cutoff)

Tutti i menù secondari sfruttano modali touch-native basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e animazione a scorrimento `slide`), eliminando le fragilità e i crash nativi di Jetpack Compose (`@expo/ui`) su layout fullscreen landscape e rotazioni:

- **Centratura Ottica & Dimensioni Responsive (Nessun Taglio ai Lati)**:
  - Applicato padding orizzontale simmetrico `horizontalPadding = Math.max(16, safeHorizontalInset)` su entrambi i lati.
  - Testi degli header e sottotitoli vincolati con `flexShrink: 1`, `numberOfLines={1}` ed `ellipsizeMode="tail"` per prevenire sbordamenti o tagli visivi a destra e a sinistra su display verticali o stretti.
- **Carosello Episodi Virtualizzato** ([`PlayerEpisodesCarouselSheet.tsx`](file:///home/g4s/VSCode/KuroM/src/components/player/PlayerEpisodesCarouselSheet.tsx)):
  - Icona intuitiva `list-outline` nel footer del player.
  - Virtualizzazione orizzontale con `@shopify/flash-list` (`FlashList`), layout stabile con `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash nativi Fabric/Hermes.
  - Larghezza card scalata su orientamento (`cardWidth = isLandscape ? 170 : 152`) con padding simmetrico direttamente su `contentContainerStyle`.
  - Scorrimento programmatico sicuro all'episodio attivo (`initialScrollIndex` e `scrollToIndex` protetto da try/catch).
  - Navigazione asincrona differita di 60ms alla selezione per concedere al Dialog nativo Android il tempo di chiusura.
- **Scheda Dettagli & Trama** ([`PlayerInfoSheet.tsx`](file:///home/g4s/VSCode/KuroM/src/components/player/PlayerInfoSheet.tsx)):
  - Tasto `information-circle-outline` nell'header OSD.
  - Badge episodio formattato rigorosamente come `'EPISODIO X/TOT'` (es. `'EPISODIO 1/170'`, `'EPISODIO 1/??'`), pulito da suffissi titolo puntata ridondanti.
  - Normalizzazione difensiva di generi (`Array.isArray(genres)`), etichette con `numberOfLines={1}` e testi maiuscoli.
  - Locandina anime e placeholder ridimensionati dinamicamente (`76x108` in portrait, `84x120` in landscape), metadati con `minWidth: 0` e sinossi completa in un riquadro scrollabile.
- **Opzioni di Riproduzione & Velocità** ([`ServerBottomSheet.tsx`](file:///home/g4s/VSCode/KuroM/src/components/ServerBottomSheet.tsx)):
  - Centratura ottica dei selettori di velocità ($0.75\times, 1.0\times, 1.25\times, 1.5\times, 2.0\times$) con gap responsive (`isLandscape ? 8 : 4`) e selezione server video con troncamento automatico del testo lungo.
  - `maxHeight` responsivo in base all'orientamento dello schermo (`Math.min(380, windowHeight * 0.55)` in portrait, 240dp in landscape).

---

## 🔄 Orientamento, Fullscreen & Picture-in-Picture con Controlli in Notifica

- **Avvio Automatico in Landscape**: Il player si apre per default in modalità orizzontale a tutto schermo con `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)`.
- **Sensore Landscape Android**: Con rotazione automatica attiva nel sistema, lo schermo è sensibile e ruota liberamente a 180° tra landscape sinistro e destro.
- **Barra di Navigazione Nascosta**: All'interno del player, la navbar di sistema Android è rigorosamente nascosta per la massima immersione cinematografica e ripristina la modalità utente solo all'uscita.
- **Picture-in-Picture (PiP) Senza Pause & Controlli Rapidi MediaStyle**:
  - Tasto PiP dedicato nell'header (`open-outline`).
  - `player.showNowPlayingNotification = true` e metadati completi dello stream (titolo serie con numero puntata `<Titolo> - EPISODIO <Num>`, locandina artwork caricata via bitmap asincrono in `largeIcon`, pulsante dedicato per episodio successivo `nextEpisodeButton` / `COMMAND_SEEK_TO_NEXT`, abilitati via patch native `scripts/apply-patches.mjs`).
  - Overlay di caricamento minimale (`loadingOverlay`) con badge circolare compatto (56x56 dp) contenente unicamente `ActivityIndicator` (senza scritte testuali) per garantire un feedback continuo e pulito durante buffering o cambio puntata.
  - **Rientro a Tutto Schermo Fluido**: Memorizzazione in tempo reale di `wasPlayingInPiPRef`. Quando l'utente tocca il pulsante Android per rientrare a schermo intero dal PiP, l'Activity torna in primo piano (`AppState === 'active'`) e `player.play()` riprende istantaneamente la riproduzione senza pause o scatti.
  - **Chiusura Volontaria con la 'X'**: In `onPictureInPictureStop`, un timer di tolleranza di 500ms attende l'eventuale riattivazione dell'Activity; solo se l'app rimane effettivamente in background lo stream viene messo in pausa, salvando i progressi di visione su MMKV.

---

## ⚡ Caricamento Asincrono dello Stream (`replaceAsync`)

Per azzerare i blocchi dell'interfaccia utente durante la risoluzione e l'avvio della riproduzione, il player adotta rigorosamente il pattern asincrono introdotto in `expo-video` v58:

1. **Eliminazione del Blocco Sincrono sul Main Thread**:
   - Il metodo standard sincrono `player.replace(url)` effettua l'inizializzazione dell'asset (`AVPlayerItem` / ExoPlayer) direttamente sul thread UI principale, causando micro-freeze dell'interfaccia (warning ufficiale: *`WARN On iOS VideoPlayer.replace loads the asset data synchronously on the main thread, which can lead to UI freezes and will be deprecated in a future release`*).
   - Kuro Mobile adotta `await player.replaceAsync(directUrl)`, spostando la risoluzione dell'asset nativo e il buffering su background thread.
2. **Resilienza ai Cambi Rapidi di Episodio**:
   - In [`app/player/[id].tsx`](file:///home/g4s/VSCode/KuroM/app/player/[id].tsx), la chiamata asincrona è incapsulata con protezione dagli errori:
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
