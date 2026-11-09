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
- **Componenti Nativi UI**: `@expo/ui` per BottomSheet con Jetpack Compose nativo su Android.
- **Data Fetching & Cache Remota**: `@tanstack/react-query` v5 con stale-time ottimizzato.
- **Storage Locale ad Alte Prestazioni**: `react-native-mmkv` v3 (zero-latency key-value store sincrono per preferiti, cronologia e configurazioni).
- **Video & Multimedialità**: `expo-video` v58 con controlli touch personalizzati, OSD immersivo, HUD luminosità/volume, AniSkip e Picture-in-Picture nativo.
- **Styling & Temi**: Sistema dinamico reattivo ispirato a `react-native-unistyles` con `ThemeProvider` a clonazione di riferimento per aggiornamento istantaneo al click e `getContrastTextColor` per contrasto dinamico YIQ.
- **Animazioni Skeleton & UX Loading**: Primitive e layout skeleton dedicati in `src/components/skeleton` (`Skeleton`, `AnimeCardSkeleton`, `HomeScreenSkeleton`, `ExploreScreenSkeleton`, `AnimeDetailScreenSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) con animazione pulsing via driver nativo a 60/120 FPS, sfondo OLED surface (`#161616`) e zero Cumulative Layout Shift (CLS). Cleanup automatico dei loop nativi in unmount e allo scaricamento immagini (`onLoad`) per prevenire battery drain e resource leak.
- **Immagini & Asset SVG**: `expo-image` con cache disco/memoria e supporto SVG integrato.
- **Moduli di Sistema & Font**: `expo-system-ui` per tema di sistema Android automatico, `expo-font` per il rendering dei glifi vettoriali.

---

## 👆 3. UX, Gesture Touch & Layout Mobile

1. **Touch Targets Minimi**:
   - Qualsiasi elemento interattivo (`Pressable`, bottoni, chip, icone) deve rispettare l'area minima di tocco di **almeno 44x44 dp** (usare `hitSlop` per icone graficamente compatte).
2. **Safe Area & Edge-to-Edge**:
   - Gestire sempre notch, fotocamere punch-hole e barra di navigazione gestuale di Android tramite `react-native-safe-area-context` e `react-native-edge-to-edge`.
3. **Navigazione a Bottom Tabs**:
   - La navigazione principale usa `<Tabs>` in basso: **Home**, **Esplora**, **Preferiti**, **Cronologia**, **Impostazioni**.
   - **Solo Icone**: Le tabs mostrano esclusivamente le icone vettoriali (`tabBarShowLabel: false`), senza testo, per un look minimale ed ergonomico.
   - Colore attivo delle tab agganciato dinamicamente a `theme.colors.primary`.
4. **Modal e Menu Contestuali via Bottom Sheets**:
   - Usare i Bottom Sheet nativi (`@expo/ui`) per selettori server video, filtri di ricerca, cambio velocità e batch puntate.
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
11. **Scheda Tecnica Dettaglio & Metadati Estesi (`AnimeInfoTable`)**:
   - La schermata Dettaglio Anime arricchisce la panoramica con una tabella tecnica ordinata e compatta contenente: Audio, Stato, Data di Uscita, Durata, Studio, Episodi, Voto e Genere (con cella scorrevole orizzontalmente via `ScrollView` e `nestedScrollEnabled` per consultare l'intera lista senza tagli), estratti in sicurezza dallo scraper.
   - L'header presenta accanto alla copertina i comandi rapidi di avvio: pulsante Play (`play`) e pulsante di riavvio da capo (`reload`), entrambi a soli simboli con target $\ge 44$dp.
   - Il selettore batch (`BatchBottomSheet`) è implementato come Bottom Sheet modale touch-native (senza conflitti di gesture Compose/Fabric e ripulito da sezioni correlate) per garantire selezione istantanea ad ogni tocco, feedback aptico e zero crash in Expo Go e su device fisico.
   - Sotto la tabella sono integrati i pulsanti di consultazione rapida a trailer YouTube, MyAnimeList e AniList.
   - L'azione di condivisione dell'URL AnimeWorld originale della serie è collocata unicamente nell'header fluttuante in alto a destra, affiancata al pulsante dei preferiti.

---

## 🎬 4. Video Player Mobile

1. **Orientamento & Fullscreen**:
   - Apertura predefinita all'avvio in modalità **landscape fullscreen** a schermo intero orizzontale tramite `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)`.
   - Su Android attiva `SENSOR_LANDSCAPE`: se la rotazione automatica del dispositivo è attiva nel pannello di sistema, lo schermo è sensibile e ruota automaticamente a 180° tra landscape sinistro e destro.
   - Barra di navigazione nascosta e modalità immersiva durante la visualizzazione orizzontale (`expo-navigation-bar`).
2. **Gesture Controls Avanzate & Isolamento OSD**:
   - **Doppio Tap con Accumulo Sequenziale**: Skip rapido $\pm 10$ secondi con pill compatto centrato a lato del tasto Play/Pausa centrale. Tap consecutivi entro 900ms sommano il tempo visualizzato (`+20s`, `+30s`, `+50s`, `-30s`) con micro-animazione elastica.
   - **Controlli Centrali Bilanciati**: Pulsante circolare Play/Pausa affiancato da bottoni dedicati per episodio precedente (`play-skip-back`) e successivo (`play-skip-forward`), con spaziatore simmetrico per il primo e l'ultimo episodio.
   - **Swipe Verticali**: Controllo luminosità schermo (lato sinistro) e volume multimediale (lato destro) con indicatore HUD a percentuale al centro.
   - **Disabilitazione Gesture su OSD Visibile**: Le pan gesture di volume e luminosità sono vincolate a `panGesture.enabled(!showControls)` e il `GestureDetector` è montato unicamente a controlli nascosti, evitando interferenze accidentali quando si interagisce con l'interfaccia.
   - **Luminosità 'AUTOMATICA'**: Al limite inferiore dello swipe sinistro (soglia $\le 0.08$), il valore viene impostato su `-1` (`'AUTOMATICA'`), l'overlay scuro viene disattivato per affidarsi al sensore/luminosità del sistema Android e l'HUD visualizza l'icona `sunny-outline` con testo `AUTOMATICA`.
   - **Controlli OSD**: Auto-hide automatico dopo 4 secondi di inattività; sospeso temporaneamente durante il trascinamento della timeline (`isScrubbing`).
3. **Picture-in-Picture (PiP) & Zero Zombie Playback**:
   - Supporto nativo per Android Picture-in-Picture (`expo-video`) con flag `staysActiveInBackground = false`.
   - Alla chiusura della finestra PiP tramite pulsante 'X', il listener `onPictureInPictureStop` verifica che l'applicazione sia in stato di background (`AppState.currentState !== 'active'`) mettendo immediatamente in pausa il flusso e salvando i progressi di riproduzione su MMKV, azzerando qualsiasi riproduzione fantasma in background.
4. **AniSkip con Bordo Temporizzato ad Esaurimento**:
   - Rilevamento automatico timestamp intro/outro (servizio AniSkip) e pulsante fluttuante a schermo ("SALTA INTRO" / "SALTA RECAP" / "SALTA OUTRO") con `zIndex: 10` ed elevazione esplicita per gestire il tocco direttamente senza attivare i dismiss dell'overlay OSD sottostante.
   - Bordo animato (superiore e inferiore) che si consuma in tempo reale proporzionalmente all'intervallo residuo, con calcolo istantaneo del progresso iniziale al montaggio.
   - Colore del testo calcolato dinamicamente con `getContrastTextColor(theme.colors.primary)` per la massima leggibilità su qualsiasi tema.
5. **Timeline con Anteprima Frame Reali (Live Scrubbing)**:
   - Estrazione istantanea dei fotogrammi video tramite `player.generateThumbnailsAsync([targetSec], { maxWidth: 160 })` su gesture touch responder.
   - Cache locale in memoria e matching per prossimità temporale (`getClosestCachedFrame` entro 12s) per garantire feedback visivo fluido a 60 FPS senza sfarfallii o lag.
   - Bolla di anteprima posizionata sopra il cursore con miniatura video, minutaggio formattato e delta tempo relativo (`+15s`, `-30s`), con touch target $\ge 44$dp e rilascio assistito da feedback aptico.
6. **Malleabilità dei Menù & Bottom Sheets Nativi**:
   - I Bottom Sheet nativi (`@expo/ui`) adottano `contentPadding={0}` e padding orizzontale simmetrico calcolato con `Math.max(insets.left, insets.right)` per azzerare sbilanciamenti dovuti a fotocamere o notch in landscape.
   - Contenitori centrati (`alignSelf: 'center'`) con larghezza massima controllata e `maxHeight` responsivo in base all'orientamento.
   - **Carosello Episodi Virtualizzato** (`PlayerEpisodesCarouselSheet.tsx`): icona `list-outline`, `@shopify/flash-list` con `maintainVisibleContentPosition={{ disabled: true }}` per azzerare i crash Fabric/Hermes, auto-scroll ad episodio attivo e navigazione differita di 80ms.
   - **Scheda Dettagli** (`PlayerInfoSheet.tsx`): icona `information-circle-outline` in header OSD con locandina, titolo, badge episodio e trama scrollabile.
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
   - **Sorgente**: Selezione rapida dei domini supportati (`.ac`, `.so`, `.tv`) oppure URL digitabile liberamente a mano con pulsante APPLICA.
   - **Impostazioni Cronologia & Slider Reattivo**: Sezione dedicata con `HistorySlider` per la durata di conservazione: `OFF` (disattiva la registrazione e nasconde dinamicamente la tab Cronologia dalla navigazione inferiore via `href: null`), `30gg`, `60gg`, `90gg` e `ON` (conservazione permanente illimitata). Include il pulsante per svuotare l'intera cronologia con modale di conferma in-app.
   - **Informazioni & Updater Unificati**: Sezione con Nome, Stack, Package Name, Versione+Build installata e Architettura APK. In fondo alla sezione è posizionato il pulsante per verificare/aggiornare l'app.
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
   - La directory `scripts/` è tracciata nel repository Git e contiene gli strumenti operativi (`build-release.sh`, `backup-secrets-r2.sh`, `upload-r2.mjs`, `upload-github-release.mjs`, `clean-r2-old-versions.mjs`).
   - Gli script consumano segreti solo da variabili d'ambiente (`.env`, `.env.local`), senza alcuna credenziale hardcoded nel codice sorgente.
   - `build-release.sh` supporta la flag `--skip-build` per bypassare la compilazione Gradle e finalizzare/pubblicare un APK già generato senza rieseguire il build completo.
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
1. `npm test`: Suite di test automatizzata a 7 stadi:
   - SemVer e Updater Service.
   - Regole di Stile Mobile & conformità OLED.
   - Storage MMKV (preferiti, cronologia visione).
   - Logica di batching episodi e griglia puntate.
   - Intervalli AniSkip.
   - Componenti Animazioni Skeleton (OLED compliant, no layout shift, zero Hermes crash) e Componente In-App `ConfirmModal` (divieto assoluto di `Alert.alert` di sistema, touch target >= 44dp e contrasto YIQ).
   - Default export di tutte le rotte Expo Router & sicurezza Hermes.
2. `npx expo export --platform android`: Verifica dell'assenza di errori di bundle e corretta generazione del bytecode Hermes.
