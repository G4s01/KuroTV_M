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
5. **Divieto Assoluto di Chiamate Incrociate `scrollTo` su Eventi Continui `onScroll` (Prevenzione Deadlock & Ping-Pong)**:
   - È severamente vietato invocare `scrollTo` o avviare animazioni programmatiche su una `ScrollView` all'interno dell'evento continuo `onScroll` di un'altra `ScrollView`.
   - La sincronizzazione bi-direzionale tra slider e caroselli (es. Hero Banner e Carosello Raccomandati) deve avvenire tassativamente unicamente all'assestamento della gesture (**settling**) tramite `onMomentumScrollEnd` e `onScrollEndDrag` con verifica di velocità (`Math.abs(velocity) < 0.1`).
   - Gli stati di origine scorrimento (`activeScrollSourceRef`) devono essere protetti da verifiche rigorose di ownership (`if (activeScrollSourceRef.current !== 'source') return`) all'interno di ciascun handler di settling (`settleHeroScroll`, `settleRecommendedScroll`): quando una `ScrollView` completa uno scorrimento programmatico indotto dalla vista partner, l'evento nativo `onMomentumScrollEnd` deve essere categoricamente ignorato, azzerando qualsiasi rischio di loop a rimbalzo (ping-pong) o congelamento del thread UI/JS.
   - Per azzerare re-render massivi durante lo scorrimento inerziale veloce verso i limiti del carosello, gli indici correnti sono protetti da ref sincrono (`currentFocusedIndexRef`): `setFocusedIndex` viene invocato solo in caso di effettivo mutamento dell'indice (`targetIndex !== currentFocusedIndexRef.current`), e l'aggiornamento a 16ms non deve innescare ridisegni del box model.
   - Tutti gli array passati a `snapToOffsets` devono essere rigorosamente memoizzati (`useMemo`) per prevenire la ricreazione dei listener di snapping nativi su Fabric / Android ad ogni re-render.
   - Nessun elemento soggetto a focus dinamico in una lista scorrevole deve mutare il suo `borderWidth` al cambio stato: la geometria del box model deve rimanere fissa (es. 2dp) variando la sola tinta `borderColor`, azzerando le chiamate native a `requestLayout()` nel thread UI durante lo scorrimento inerziale.
6. **Divieto Assoluto di Componenti Monolitici ('God Components') e Separazione Responsabilità**:
   - È vietato accumulare logiche eterogenee, fogli di stile massivi e molteplici sezioni complesse all'interno di un singolo file di rotta (`app/(tabs)/*`, `app/*`) o componente.
   - Tutti i fogli di stile complessi devono essere estratti in file dedicati (`*.styles.ts`).
   - Le sezioni secondarie, le card tematiche, le barre di ricerca e gli overlay devono risiedere in subcomponenti modulari dedicati nelle rispettive cartelle tematiche (`src/components/home/`, `src/components/settings/`, `src/components/player/`, `src/components/anime/`).
   - Tutti gli slider discreti e selettori a scorrimento devono utilizzare la primitiva touch-native unificata `StepSlider` (`src/components/StepSlider.tsx`), azzerando duplicazioni di gesture `PanResponder` e garantendo feedback aptico e snapping coerente.

---

## 🛠️ 2. Stack Tecnologico & Architettura (2026)

- **Framework & Runtime**: Expo SDK 58 (v58.0.23), React Native 0.88.1, React 19.3.0 (Nuova Architettura / TurboModules nativi). `MainActivity.kt` adotta il costruttore moderno `DefaultReactActivityDelegate(this, mainComponentName)` senza flag Fabric obsoleti.
- **Routing & Navigazione**: `expo-router` v58 (file-based routing con Stack e Bottom Tabs).
- **Virtualizzazione Liste**: `@shopify/flash-list` v2 (rendering rapido di griglie e liste infinite).
- **Componenti Modali Touch-Native**: Modali custom touch-safe basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e `animationType="fade"`) con overlay OLED e padding responsivo, con eliminazione definitiva di `@expo/ui` BottomSheet dal bundle per azzerare crash Fabric/Compose in landscape, fullscreen e su scrolling annidato. È severamente vietato combinare `animationType="slide"` con `useBottomSheetDragDismiss`, nonché resettare `translateY` a `0` subito dopo `onClose()`: il reset sincrono deve avvenire esclusivamente alla riapertura (`isVisible: true`), lasciando il foglio fuori schermo (`Math.max(windowHeight, 800)`) durante l'uscita e proteggendo la chiusura con `isDismissingRef` per prevenire doppi slide-out Android e glitch di rimbalzo. Tutti i menù a comparsa integrano `useBottomSheetDragDismiss` con architettura a doppia zona: **striscia drag handle dedicata a tutta larghezza** (`dragStripHandlers`, `onStartShouldSetPanResponder: true`, `minHeight: 44dp`) per cattura immediata al tocco senza figli interattivi, e **header row con fase di cattura** (`headerPanHandlers`, `onMoveShouldSetPanResponderCapture`) per intercettare gesture verticali nette prima che i figli `Pressable` le consumino, il tutto su driver nativo a 60/120 FPS.
- **Primitiva Slider Unificata (`StepSlider`)**: `StepSlider.tsx` gestisce in modo centralizzato e touch-safe il trascinamento (`PanResponder` con `onPanResponderTerminationRequest: () => false` e `pointerEvents="none"` su tracce e thumb), il layout dinamico e il feedback aptico (`Haptics.selectionAsync()`) per `HistorySlider`, `AniSkipSlider` e `AniSkipDurationSlider`.
- **Architettura Componenti Modulare**:
  - `src/components/home/`: isolamento completo di `home.styles.ts`, `HomeSection.tsx`, `ContinueWatchingSection.tsx`, `HomeSearchHeader.tsx`, `SearchFilterChips.tsx`, `SearchResultsGrid.tsx` e `SearchHistoryList.tsx`.
  - `src/components/settings/`: isolamento completo di `settings.styles.ts`, `ThemeSettingsCard.tsx` e `SourceSettingsCard.tsx`.
  - `src/components/anime/` & `src/components/player/`: subcomponenti dedicati per scheda tecnica metadati, backdrop, header, timeline, carosello puntate e controlli OSD.
- **Gestione Sistema Android & Navbar**: `expo-navigation-bar` con modalità immersiva auto-hide (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) per nascondere la barra di sistema ad app aperta e richiamarla con swipe dal basso, e `react-native-safe-area-context` per l'adattamento dinamico con la navbar a 3 pulsanti.
- **Data Fetching & Cache Remota**: `@tanstack/react-query` v5 con stale-time ottimizzato.
- **Storage Locale ad Alte Prestazioni & Sincronizzazione Ibrida Smart**: `react-native-mmkv` v3 (zero-latency key-value store sincrono in `src/services/storage/app-storage.ts` per preferiti, cronologia, configurazioni e preferenze AniSkip/Navbar) con modulo dedicato `continue-watching-sync.ts` per il monitoraggio a basso consumo delle serie in pari e l'avanzamento automatico alle nuove uscite, esposti tramite barrel privo di cicli `src/services/storage/index.ts`.
- **Video & Multimedialità**: `expo-video` v58 con controlli touch personalizzati, OSD immersivo, HUD luminosità/volume, AniSkip (intro, outro, recap con timer 10s e rewind safe), Picture-in-Picture nativo e controlli rapidi in notifica (`MediaSession`/`MediaStyle`).
- **Styling & Temi**: Sistema dinamico reattivo ispirato a `react-native-unistyles` con `ThemeProvider` a clonazione di riferimento per aggiornamento istantaneo al click e `getContrastTextColor` per contrasto dinamico YIQ.
- **Animazioni Skeleton & UX Loading**: Primitive e layout skeleton dedicati in `src/components/skeleton` (`Skeleton`, `AnimeCardSkeleton`, `HomeScreenSkeleton`, `ExploreScreenSkeleton`, `ScheduleScreenSkeleton`, `AnimeDetailScreenSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) con animazione pulsing via driver nativo a 60/120 FPS, sfondo OLED surface (`#161616`) e zero Cumulative Layout Shift (CLS). Cleanup automatico dei loop nativi in unmount e allo scaricamento immagini (`onLoad`) per prevenire battery drain e resource leak.
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
   - La navigazione principale usa schede con sole icone vettoriali (`tabBarShowLabel: false`): **Home** (`home`), **Palinsesto** (`calendar`), **Preferiti** (`heart`), **Cronologia** (`time`), **Impostazioni** (`settings`).
   - La ricerca del catalogo con filtri avanzati è integrata direttamente nell'header della **Home** (icona lente di ingrandimento, debouncing 450ms, griglia FlashList a 2 colonne e supporto al tasto fisico Indietro di Android per chiudere la ricerca senza uscire dall'app).
   - **Gestione Lifecycle `useFocusEffect` del Tasto Indietro (Zero Reset Ricerca al Ritorno dai Dettagli)**:
     - Il listener Android `hardwareBackPress` in `app/(tabs)/index.tsx` è agganciato rigorosamente tramite `useFocusEffect` di `expo-router` anziché `useEffect` standard: quando l'utente apre i dettagli di un anime (`app/anime/[id].tsx`), la Home perde il focus e il listener viene istantaneamente rimosso.
     - Al ritorno indietro (tramite gesture Android, tasto fisico o freccia nell'header con `router.canGoBack() ? router.back() : router.replace('/(tabs)')`), la schermata Home mantiene intatti lo stato `isSearchActive`, il testo `searchQuery`, i filtri `filterState` e i risultati `searchResults`, azzerando qualsiasi chiusura accidentale della ricerca o reset alla home feed.
   - **Cronologia di Ricerca in Stile Google & Filtri Avanzati**:
     - Sostituzione dei vecchi consigliati generici con una **cronologia ricerche touch-native in stile Google**: ciascuna riga presenta l'icona orologio `time-outline`, testo in stampatello maiuscolo monospace, tap diretto per eseguire immediatamente la ricerca, pulsante di eliminazione della singola ricerca (`close-outline`) con area di tocco minima $\ge 44$dp e feedback tattile (`Haptics.impactAsync(Light)`).
     - **Deduplicazione Intelligente dei Prefissi Incompleti (Preservazione Esclusiva della Ricerca Finale)**: `AppStorage.addSearchHistory` e `getSearchHistory` deduplicano e filtrano attivamente qualsiasi prefisso parziale digitato (es. `"ONE"`, `"ONE P"` prima di `"ONE PIECE"`), mantenendo memorizzata unicamente la query finale più completa e rifinita. La registrazione automatica durante la digitazione è regolata da un timer di settling a riposo (2000ms), oltre alla registrazione immediata alla pressione del tasto Cerca (`onSubmitEditing`) o alla selezione di un anime dai risultati (`navigateToAnime`).
     - Pulsante dedicato *CANCELLA TUTTE* protetto dal componente in-app `ConfirmModal`.
     - Configurazione flessibile nelle Impostazioni dell'app tramite `HistorySlider` con passaggi dedicati `SEARCH_RETENTION_STEPS` (`OFF`, `30GG`, `60GG`, `90GG`, `ON` illimitato) e pulsante di svuotamento rapido della cronologia ricerche.
     - **Fix Completo Filtri & Allineamento Scraper AnimeWorld**:
       - **Generi Multipli**: Integrazione di tutti i 46 generi del catalogo con selezione multipla e invio di `genre_mode=and` per filtrare accuratamente le intersezioni tra categorie.
       - **Filtro Audio Doppiati e Sottotitolati**: Supporto dedicato a `DOPPIATI` (`dub: '1'`) e `SOTTOTITOLATI` (`dub: '0'`).
       - **Simmetria Filtri & Rimozione Opzioni 'TUTTI' Ridondanti**: Tutte le opzioni generiche 'TUTTI...' sono state eliminate poiché implicite in assenza di selezione. Disposizione a griglia touch-native perfettamente simmetrica: Audio a 2 colonne (50%/50%), Formato a 2 righe bilanciate (Serie TV e Film al 50%, OAV/ONA/Special al 33.3%), Stato (In Corso/Completato al 50%, Non Rilasciato al 100%), Ordinamento a 3 righe da 2 colonne appaiate semanticamente e Generi in griglia uniforme a 2 colonne (48.8% con `minHeight: 44dp`). Toggle on/off al tap per deselezionare istantaneamente qualsiasi parametro.
       - **Categorie & Formati**: Mappatura corretta conforme ai valori nativi del motore di ricerca AnimeWorld (`0` Serie TV, `4` Film Anime / Movie, `1` OAV, `2` ONA, `3` Special), azzerando la precedente restituzione di 6 titoli spuri.
       - **Ordinamenti**: Mappatura corretta con ordinamento per data reale di uscita delle serie (`5` Più recenti, `1` Ultime aggiunte, `6` Più visti, `7` Meglio valutati, `2` A-Z, `3` Z-A).
       - **Isolamento Risultati nello Scraper**: Selettore in `search.parser.ts` vincolato rigorosamente al contenitore principale (`#main .film-list > .item, .content .film-list > .item`), con esclusione tassativa dei widget di raccomandazione laterale (`.simple-film-list`, `.ranking`, aside), garantendo l'assenza di titoli incoerenti a 6 elementi in caso di risultati vuoti.
   - Colore attivo delle tab agganciato dinamicamente a `theme.colors.primary`.
   - **Nuova Sezione Palinsesto / Programmazione Settimanale (`app/(tabs)/explore.tsx`)**:
     - Integra le uscite settimanali con gli orari previsti da `animeworld.ac/schedule` (`AnimeWorldScraper.getSchedule()` e `parseSchedulePage`).
     - Header dedicato con titolo `PALINSESTO` e sottotitolo della settimana corrente (`SETTIMANA D MESE – D MESE`).
     - Hero card opzionale per la *Prossima Uscita* in evidenza con badge fiammella `PROSSIMA USCITA`, orario programmato / countdown, titolo anime, puntata e locandina (tap diretto a scheda dettaglio).
     - Selettore orizzontale a scorrimento per i giorni della settimana con etichetta compatta e pulita nel formato giorno + numero (es. `SAB 14`, `LUN 9`) senza contatore di uscite, indicatore `OGGI` per auto-selezionare il giorno odierno e touch target $\ge 44$dp.
     - Timeline orizzontale/verticale virtualizzata con `@shopify/flash-list`: pill orario dedicato (`15:00`), locandina ad alta risoluzione con cache, titolo serie (monospace, uppercase), titolo alternativo, badge puntata (`EPISODIO X`) e badge di stato dinamico con codifica cromatica OLED (`USCITO` in verde success, `IN PAUSA` in ambra warning, programmato `ALLE HH:MM` in colore primario).
     - Supporto pull-to-refresh nativo con tint color coordinato e layout skeleton dedicato `ScheduleScreenSkeleton` a zero CLS.
   - **Struttura Sezioni Schermata Home**:
     1. **Banner Hero in Evidenza**: Espone in testa l'anime raccomandato selezionato (di default il primo della top 8 dei raccomandati). Implementato come slider orizzontale a tutta larghezza con `pagingEnabled={true}` e sincronizzazione bi-direzionale protetta da `activeScrollSourceRef`. Mostra banner/artwork, badge `#1 RACCOMANDATO`, titolo (monospace, uppercase), sinossi pulita e pulsanti d'azione dedicati:
        - `RIPRODUCI` (icona `play`, avvio diretto dell'episodio salvato in cronologia/continua a guardare o fetch dell'episodio 1 con feedback visivo di caricamento e fallback sicuro a scheda dettagli);
        - `INFO` (icona `information-circle-outline`, apertura dettagli);
        - Tocco altrove sul banner: navigazione verso i dettagli della serie.
     2. **Carosello Raccomandati**: Subito sotto il banner hero, carosello orizzontale con tutti i raccomandati numerati progressivamente in ordine (`#1` ... `#8`) e intitolato `RACCOMANDATI`. Toccando una scheda o scorrendo orizzontalmente la lista, il focus si sincronizza dinamicamente aggiornando lo slider hero soprastante con bordo primario attivo. Adotta `snapToOffsets` con array memoizzato (`recommendedSnapOffsets`), sincronizzazione allo settling (`onMomentumScrollEnd` e `onScrollEndDrag` per scorrimento lento senza momentum su Android), protezione anti-feedback unidirezionale tramite `activeScrollSourceRef` (`if (activeScrollSourceRef.current !== 'source') return` per bloccare chiamate `scrollTo` incrociate generate dai momentum scroll programmatici) con timeout asincrono per prevenire loop ricorsivi tra scrollview, protezione con clamp dinamico (`maxIndex`) per scorrimenti veloci verso il termine del carosello, e padding destro dinamico (`Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)`) per permettere a tutte le schede di scorrere fino alla posizione di focus senza blocco del clamp. Bordo stabile a 2dp per azzerare layout invalidation (`requestLayout`) su Android.
     3. **Riprendi a Guardare & Gestione Anime in Corso 'IN PARI'**:
        - Visibile in presenza di visioni in corso o serie in pari (`continueWatching.length > 0`), con swipe/pulsante rimozione protetto da `ConfirmModal`.
        - **Stato 'IN PARI' per Serie in Corso (Totale '?' o 'In Corso')**: Quando l'utente completa l'ultimo episodio disponibile di una serie non conclusa (`totalEpisodes` contenente `'?'` o stato ongoing), la card **non viene rimossa** dal carosello: assume lo stato `isCaughtUp: true`, mostrando un badge `IN PARI` verde OLED (`theme.colors.success`), icona centrale `checkmark-done-circle`, progress bar al 100% e sottotitolo `EP. X • IN PARI`. Il tap sulla card apre la scheda tecnica dell'anime (`navigateToAnime`) per consultare dettagli o riprodurre vecchi episodi.
        - **Sincronizzazione Ibrida Smart (Rilevamento Nuovi Episodi)**: L'app verifica automaticamente la disponibilità di nuovi episodi tramite due trigger coordinati:
          1. *Check passivo a costo zero*: ad ogni caricamento della Home o ricezione dati, confronta le serie in pari con gli ultimi episodi usciti (`homeData.newAdded`, `homeData.all`). Se trova una puntata successiva, esegue il fetch mirato dei dettagli e promuove la card in cima al carosello all'Episodio X+1 a minutaggio 0:00 (`percentage: 0`, `isCaughtUp: false`);
          2. *Check remoto periodico (4 ore)*: all'avvio dell'app o al focus della Home (`useFocusEffect`), se sono trascorse almeno 4 ore dall'ultima verifica, interroga AnimeWorld in background per ciascuna serie in pari;
          3. *Pull-to-Refresh forzato*: lo swipe verso il basso nella Home forza istantaneamente il controllo remoto di tutte le serie in pari. Se una serie risulta definitivamente conclusa (totale noto), viene rimossa in automatico.
     4. **Ultimi Episodi Usciti**: Carosello orizzontale delle ultime puntate aggiunte con tasto rapido `VEDI TUTTI`.
     5. **Tendenze**: Carosello orizzontale delle serie più popolari e di tendenza del momento.
     6. **Anime in Corso**: Carosello orizzontale con le serie attualmente in trasmissione ('ongoing').
     7. **Uscite della Stagione Corrente ('upcoming')**: Carosello con le prossime uscite stagionali (`homeData.upcoming` e titolo dinamico es. `USCITE INVERNO 2027` con pulsante `VEDI TUTTI`). Lo scraper (`AnimeWorldScraper.getUpcoming()` e `parseSearchPage`) supporta il contenitore `.film-listnext .item` di AnimeWorld e isola con precisione i titoli escludendo i badge `DUB` o `Special` all'interno di `.poster`.
     8. **Nuove Aggiunte**: Carosello con le ultime serie catalogate (`homeData.newAdded`).
4. **Modal e Menu Contestuali Touch-Native (Zero Jetpack Compose Crashes)**:
   - Tutti i selettori modali (filtri di ricerca `FilterBottomSheet`, batch puntate `BatchBottomSheet`, opzioni download `DownloadOptionsSheet`, elenco puntate scaricate `DownloadedEpisodesSheet`, carosello episodi `PlayerEpisodesCarouselSheet`, scheda info `PlayerInfoSheet`, e opzioni server `ServerBottomSheet`) utilizzano componenti modali touch-native custom basati su React Native `Modal` (`transparent={true}`, `statusBarTranslucent={true}` e `animationType="fade"`) con overlay oscurato OLED, drag handle e padding simmetrico. È severamente vietato l'uso di `@expo/ui` `BottomSheet` (Jetpack Compose) che causa crash nativi non intercettati (`ViewTreeLifecycleOwner` / window detach) su fullscreen landscape, rotazioni o scroll annidati, nonché l'uso di `animationType="slide"` in combinazione con `useBottomSheetDragDismiss` (che provoca un doppio slide-out nativo Android con effetto rimbalzo al termine dello swipe-down).
   - **Chiusura Touch-Native Tramite Scorrimento (Swipe-Down Dismiss)**: Tutti i menù a comparsa (`ServerBottomSheet`, `PlayerInfoSheet`, `PlayerEpisodesCarouselSheet`, `BatchBottomSheet`, `DownloadOptionsSheet`, `DownloadedEpisodesSheet`, `FilterBottomSheet`) integrano l'hook dedicato `useBottomSheetDragDismiss` (`src/components/useBottomSheetDragDismiss.ts`) con architettura a **doppia zona di trascinamento** per garantire la chiusura affidabile da **tutta la larghezza dell'apice** del modale:
     1. **Striscia Drag Handle (`dragStripArea` + `dragStripHandlers`)**: Zona superiore dedicata a tutta larghezza (`width: 100%`, `minHeight: 44dp`) contenente esclusivamente la pillola indicatore drag. Utilizza `onStartShouldSetPanResponder: true` per catturare immediatamente qualsiasi tocco senza competizione con figli interattivi — l'utente può afferrare da **qualsiasi punto orizzontale** dell'apice.
     2. **Header Row con Fase di Cattura (`headerPanHandlers`)**: L'intestazione con titolo e bottone chiudi utilizza `onMoveShouldSetPanResponderCapture` per intercettare gesture verticali nette (dy > 8, rapporto dy/dx > 1.5) nella fase di cattura del responder, *prima* che i figli `Pressable` le consumino, senza bloccare tap singoli sui bottoni.
     - Il driver nativo Fabric (`translateY`) con `useNativeDriver: true` garantisce 60/120 FPS. La chiusura automatica avviene al rilascio oltre la soglia (`dy > 60` o `(dy > 25 && vy > 0.4)`) animando l'uscita oltre lo schermo fino a `Math.max(windowHeight, 800)` in 180ms (protetta da `isDismissingRef` per bloccare doppie chiamate o ri-cattura touch). **Regola critica anti-rimbalzo**: non invocare mai `translateY.setValue(0)` dopo `onClose()` nel callback dell'animazione; il valore resta fuori schermo mentre il `Modal` esegue il fade-out e viene azzerato sincronamente solo alla transizione di riapertura (`isVisible: true`). Se la gesture viene interrotta sotto soglia, `translateY` torna in posizione iniziale con rimbalzo elastico (`bounciness: 4`).
5. **Tipografia Monospace & Caps Lock**:
   - Tutta l'applicazione adotta rigorosamente font monospace di sistema (`'monospace'` su Android, `'Menlo'` su iOS) e testi visualizzati in **CAPS LOCK / STAMPATELLO MAIUSCOLO** (`textTransform: 'uppercase'`).
6. **Feedback Tattile & Pull-to-Refresh**:
   - Integrare feedback aptico (`expo-haptics`) sui tap principali (`ImpactFeedbackStyle.Light`, `Selection`, `NotificationFeedbackType.Success`).
   - `RefreshControl` nativo su tutte le schermate a lista per consentire la ricarica manuale dei dati da remoto con tint color coordinato al tema.
7. **Animazioni Skeleton & Zero Layout Shift (CLS)**:
   - È vietato l'uso di schermate vuote o spinner bloccanti a tutto schermo durante il fetching asincrono del catalogo, del video player o delle schermate principali.
   - Utilizzare rigorosamente i layout skeleton dedicati (`HomeScreenSkeleton`, `ExploreScreenSkeleton`, `ScheduleScreenSkeleton`, `AnimeDetailScreenSkeleton`, `AnimeCardSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) che rispecchiano fedelmente e al pixel le geometrie, proporzioni, paddings e spaziature dei componenti finali (locandine, schede tecniche, pulsanti d'azione simbolici, caroselli e tabelle metadati) per prevenire sfarfallii e scatti di layout (CLS):
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
13. **Adattamento Schermi Larghi, Tablet (sw600dp), Left Navigation Rail & Layout Master-Detail**:
   - **Qualificazione Tablet Affidabile (Android `sw600dp`)**: La discriminazione tra smartphone e tablet avviene tramite `Math.min(windowWidth, windowHeight) >= 600` nel modulo `useResponsiveLayout` (`src/hooks/useResponsiveLayout.ts`). Questo assicura che gli smartphone girati in orizzontale (es. 844x390dp) preservino la classica navigazione inferiore senza commutare erroneamente su layout tablet.
   - **Left Navigation Rail (Expo Router `tabBarPosition: isTablet ? 'left' : 'bottom'`)**: Su tablet e foldable aperti, la barra di navigazione inferiore si sposta automaticamente a sinistra come Navigation Rail compatta icon-only (larghezza fissa 76dp, sfondo `#000000`, `borderRightWidth: 1`). Integra in alto il monogramma di brand `"K"` stilizzato in `tabBarBackground`, touch target $\ge 44$dp e calcolo coordinato di `contentWidth` per evitare overflow orizzontali negli slider o nelle card.
   - **Griglie Responsive (`FlashList`)**: Il numero di colonne dei cataloghi (Preferiti, Ricerca Home, Palinsesto) viene calcolato dinamicamente tramite `useResponsiveLayout()` (da 2 colonne su smartphone fino a 6 colonne su tablet landscape), preservando l'esatto rapporto d'aspetto poster 1:1.45 e azzerando le card sproporzionate.
   - **Scheda Dettaglio Anime Master-Detail (`app/anime/[id].tsx`)**: Su tablet si attiva il layout Master-Detail a due colonne affiancate:
     - *Colonna Sinistra Master (~36%, max 380dp)*: Locandina espandibile a schermo intero al tap, pulsanti primari d'azione (`RIPRODUCI`, `RICOMINCIA`, `PREFERITI`, `CONDIVIDI`) e tabella metadati tecnici (`AnimeInfoTable`).
     - *Colonna Destra Detail (~64%)*: Sinossi narrativa con toggle espandi/comprimi, selettore batch puntate e griglia episodi virtualizzata con `@shopify/flash-list` con 6-8 colonne di chip.
   - **Modali & Bottom Sheets Centrati con Max-Width**: Tutti i menù e selettori (`FilterBottomSheet`, `ServerBottomSheet`, `BatchBottomSheet`, `DownloadOptionsSheet`, `DownloadedEpisodesSheet`, `PlayerInfoSheet`, `PlayerEpisodesCarouselSheet`, `SettingsScreen`) limitano la loro larghezza (`maxWidth: 580-640dp`, o 840dp per Settings) centrandosi orizzontalmente (`alignSelf: 'center'`) con angoli arrotondati, evitando distorsioni visive e preservando l'ergonomia d'uso touch su display ultra-larghi.

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
   - **Impostazioni AniSkip con Slider a Scorrimento, Durata Popup & Auto-Off Fallback**: Selettore della modalità di salto implementato con il componente touch-native `AniSkipSlider` a scorrimento in stile `HistorySlider` tra `OFF` (disattivato), `MANUALE` e `AUTO`, persistito sincronicamente su MMKV con listener reattivo nel player, affiancato dai toggle per cosa saltare (`INTRO`, `RECAP`, `OUTRO`). La descrizione di `AUTO` si adatta dinamicamente agli elementi selezionati (es. "SALTA AUTOMATICAMENTE INTRO E OUTRO..."), deselezionare tutti gli elementi commuta automaticamente la modalità su `OFF`. La sezione di configurazione della durata (`AniSkipDurationSlider`, da 5s a 60s fino a `∞`) compare esclusivamente in modalità `MANUALE` (essendo superflua in `AUTO` o `OFF`), mentre la sezione `COSA SALTARE` è nascosta quando impostata su `OFF`.
   - **Navbar di Sistema Android**: Descrizione snellita ed essenziale tra `NASCONDI (SWIPE)` (a scomparsa, richiamabile con swipe dal basso) e `SEMPRE VISIBILE` (sempre fissa e visibile in-app).
   - **Sorgente**: Selezione rapida dei domini supportati (`.ac`, `.so`, `.tv`) oppure URL digitabile liberamente a mano con pulsante APPLICA.
   - **Impostazioni Cronologia & Slider Reattivo**: Sezione dedicata con `HistorySlider` per la durata di conservazione: `OFF` (disattiva la registrazione e nasconde dinamicamente la tab Cronologia dalla navigazione inferiore via `href: null`), `30gg`, `60gg`, `90gg` e `ON` (conservazione permanente illimitata). Include il pulsante per svuotare l'intera cronologia con modale di conferma in-app.
   - **Informazioni & Updater Unificati**: Sezione con Nome, Stack, Package Name, Versione+Build installata e Architettura APK. In fondo alla sezione è posizionato il pulsante per verificare/aggiornare l'app.
   - **Gestione Affidabile Download & Aggiornamenti Manuali**: `handleStartDownloadUpdate` e `UpdaterService.downloadApk` convalidano rigorosamente che l'oggetto passato sia un `UpdateManifest` reale, neutralizzando argomenti spuri (es. oggetti evento touch `GestureResponderEvent` emessi da bottoni `Pressable`), azzerando l'errore `URL DEL PACCHETTO APK NON DISPONIBILE O NON VALIDO`. Ripristino automatico dello stato `available` al focus della tab se era presente un errore transitorio, e pulsante dedicato `VERIFICA NUOVAMENTE` anche dopo il completamento del download dell'APK.
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
1. `npm test`: Suite di test automatizzata a 21 stadi:
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
   - Palinsesto / Schedule (Parser cheerio/slim & htmlparser2, Scraper AnimeWorldScraper.getSchedule(), Query TanStack scheduleQueryOptions(), Storage MMKV cache.scheduleData, ScheduleScreenSkeleton, Virtualizzazione FlashList, Selettore giorni nel formato 'SAB 14' senza badge uscite, indicatore OGGI e Banner Prossima Uscita) & Fix Download Aggiornamenti Manuali (convalida UpdateManifest ed eliminazione eventi sintetici).
   - Ricerca Avanzata, Cronologia Ricerche Google-Style (icona orologio `time-outline`, tap-to-search, eliminazione singola voce `close-outline`, cancellazione totale protetta da `ConfirmModal`, configurazione retention in Settings con `HistorySlider` e passaggi dedicati `SEARCH_RETENTION_STEPS`), Filtro Multi-Genere (tutti i 46 generi con `genre_mode=and`), Filtro Audio (DOPPIATI/SOTTOTITOLATI con `dub: '1'` e `dub: '0'`), Formati numerici AnimeWorld (`type` per Serie, Film, OAV, ONA, Special), Ordinamento per data reale di uscita (`sort=5`) e Isolamento Scraper Risultati (esclusione categorica di `.simple-film-list`, `.ranking` e widget correlati da 6 elementi).
   - Sincronizzazione Focus Carosello Raccomandati & Simmetria Filtri Touch-Native.
   - Chiusura Menù Player Tramite Scorrimento (Swipe-Down Dismiss a Doppia Zona: Drag Strip + Header Capture).
   - Gestione Anime in Corso 'IN PARI' & Sincronizzazione Ibrida Smart (monitoraggio a basso consumo e promozione a 0:00 al rilascio di nuovi episodi).
   - Supporto Schermi Larghi, Tablet (standard Android `sw600dp`), Left Navigation Rail (Expo Router `tabBarPosition: isTablet ? 'left' : 'bottom'`) con brand monogramma 'K', griglie FlashList responsive (2-6 colonne), Scheda Dettaglio Master-Detail (colonna Master 36% e Detail 64%) e modali centrati con max-width.
   - Sistema di Download Episodi, Storage SAF, Coda Sequenziale & Visione Offline (DownloadService singleton, gestione cartella SAF con fallback a memoria interna, prioritizzazione automatica del file locale nel player con badge OSD, download batch/tutti/intervallo personalizzato nel BatchBottomSheet senza doppia conferma, annullamento pulito sia del singolo episodio sia dell'intero raggruppamento serie/batch tramite `cancelAnimeDownloads` senza warning spuri né rimozione degli episodi completati, storage privo di require cycle, icona e badge download attivi nell'header della Home e DownloadSettingsCard nelle Impostazioni).
2. `npx expo export --platform android`: Verifica dell'assenza di errori di bundle e corretta generazione del bytecode Hermes.

---

## 📥 8. Sistema di Download Episodi, Storage SAF & Visione Offline

1. **Architettura Core & Coda Sequenziale (`DownloadService`)**:
   - Singleton centralizzato `DownloadService` in `src/services/downloads/` basato su `expo-file-system/legacy` (`createDownloadResumable`, `makeDirectoryAsync`, `getInfoAsync`, `deleteAsync`), `expo-network` e `react-native-mmkv` (`kuro_downloads_catalog`, `kuro_download_settings`).
   - **Coda FIFO Sequenziale (1 Download alla Volta)**: Garantisce il minor tempo di attesa possibile per avere il primo episodio pronto alla visione, proteggendo il server da rate limiting e azzerando la saturazione del socket.
   - **Risoluzione Massima Automatica**: Risolve il flusso alla massima risoluzione disponibile (Server 9 AnimeWorld prioritario a 1080p, con fallback automatico a server secondari), senza popup bloccanti di selezione qualità.
   - **Protezione Connessione Dati**: Opzione nelle Impostazioni `wifiOnly` (attiva di default) che verifica lo stato della connessione tramite `expo-network` prima dell'avvio di ciascun download.
2. **Archiviazione & Cartella di Download (Storage Access Framework - SAF)**:
   - **Cartella Predefinita**: Memoria interna protetta dell'applicazione (`${FileSystem.documentDirectory}downloads/${animeId}/ep_${num}.mp4`). Massima velocità I/O, zero permessi richiesti e totale immunità a cancellazioni di app terze.
   - **Cartella Personalizzata (SAF)**: Selezione di una cartella esterna (es. cartella di sistema *Download*, memoria interna o scheda MicroSD) tramite `FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()` configurabile in Impostazioni con pulsante di ripristino immediato alla cartella interna predefinita.
3. **Punti di Avvio Download nelle Interfacce Esistenti**:
   - **Video Player (`PlayerHeader.tsx` & `app/player/[id].tsx`)**:
     - Icona download nell'header OSD per avviare il download dell'episodio in riproduzione con un tap (`cloud-download-outline` -> icona attiva / percentuale progresso -> `checkmark-circle` verde a completamento).
   - **Scheda Anime (`app/anime/[id].tsx`, `DownloadOptionsSheet.tsx`, `EpisodeItem.tsx`, `BatchBottomSheet.tsx`)**:
     - Pulsante download dedicato collocato nell'intestazione fluttuante (`navRight`, 44×44 dp) accanto a Preferiti e Condivisione, per aprire il modale `DownloadOptionsSheet` chiudibile anche tramite swipe-down (`useBottomSheetDragDismiss`).
     - Icona download dedicata e interattiva su ciascun episodio sia in vista griglia (`gridDownloadBtn`) che in vista lista con feedback visivo di stato (`downloadStatus`). Premendo nuovamente sull'icona mentre l'episodio è in coda, in download o in pausa, l'operazione viene annullata istantaneamente (`cancelDownload`) senza warning spuri o stati di errore.
     - **Pre-menù Ordinato, Selezione Multi-Batch & Intervallo in `DownloadOptionsSheet`**:
       - Pre-menù iniziale pulito con tre scelte distinte: **`SCARICA TUTTI`**, **`SCARICA PER BATCH`** (quando `batches.length > 1`) e **`INTERVALLO PERSONALIZZATO`** (quando `totalEpisodesCount > 1`), senza sovrapposizione di pulsanti simultanei né doppie conferme ridondanti.
       - Nella sezione Batch, il tap su una batch ne attiva/disattiva la selezione senza chiudere il modale, permettendo la **selezione multipla simultanea** (con scorciatoia `TUTTE` / `AZZERA`) e posizionando il pulsante primario **`SCARICA BATCH (N EP.)`** direttamente adiacente all'elenco delle batch.
       - Il modale separato `BatchBottomSheet` resta dedicato esclusivamente al cambio rapido di visualizzazione degli episodi nella scheda anime e supporta a sua volta la chiusura swipe-down (`useBottomSheetDragDismiss`).
     - **Zero Flickering Immagini Durante il Download**: `app/anime/[id].tsx` filtra gli aggiornamenti di `downloadMap` ai soli effettivi cambi di stato episodio (ignorando i tick byte-per-byte in `addProgressListener`) e passa gli header `portraitHeaderElement`/`tabletDetailHeaderElement` come elementi JSX memoizzati a `FlashList` insieme alla sorgente memorizzata `cachePolicy="memory-disk"` in `AnimeHeaderBackdrop.tsx`, impedendo ogni smontaggio/ricaricamento continuo delle locandine.
4. **Riproduzione Ibrida Intelligente & Priorità Locale**:
   - Quando l'utente avvia un episodio scaricato (da *Scaricati*, dalla scheda Anime o dalla Home), `app/downloads/index.tsx` passa i parametri completi (`id`, `animeId`, `episodeNumber`, `animeTitle`, `thumbnail`, `position`, `offline`, `localUri`) e `app/player/[id].tsx` risolve e valida su disco l'URI tramite `DownloadService.resolvePlayableLocalUri()` (gestendo anche path Expo Go `%2540` decodificati dai parametri URL) prima di caricare il flusso una sola volta con `player.replaceAsync(...)` su `useVideoPlayer(null)`, esponendo il badge **`LOCALE / OFFLINE`** e mostrando l'eventuale `sourceError` senza mascherarlo.
   - `DownloadService.executeDownload()` valida lo stato HTTP, evita di salvare manifest `.m3u8` HLS dentro file `.mp4` cercando eventuali sorgenti MP4 alternative e verifica l'integrità dimensionale del file salvato prima di marcarlo come completato.
5. **Nuova Sezione Router `'SCARICATI'` (`app/downloads/index.tsx`)**:
   - Schermata Stack dedicata intitolata semplicemente **`SCARICATI`** in monospace CAPS LOCK con estetica OLED surface (`#000000`, surface `#121212`, card `#1A1A1A`) e contenitori protetti da `minWidth: 0` ed `ellipsizeMode="tail"` per azzerare overflow e sovrapposizioni su smartphone compatti.
   - Rimando diretto alle impostazioni di scaricamento tramite parametro `scrollTo: 'downloads'` gestito da `settings.tsx` con misurazione layout esatta.
   - Barra grafica monitoraggio memoria (`StorageUsageBar.tsx`) con spazio occupato da Kuro Mobile e spazio libero sul dispositivo.
   - **Ordine Sezioni & Gerarchia Espandibile Ordinata**:
     - Prima sezione **`EPISODI SALVATI`** con l'elenco delle serie già scaricate (`DownloadedAnimeCard.tsx`, conteggio episodi, peso in MB/GB, tasto *"RIPRODUCI"* e `DownloadedEpisodesSheet.tsx`).
     - Seconda sezione **`IN CORSO & IN CODA`** raggruppata per serie (`ActiveDownloadGroupCard.tsx`): la serie con il download attivo in corso precede le altre serie secondarie (che restano racchiuse ed espandibili al tap); all'interno di ciascuna serie l'episodio attualmente in `downloading` è sempre in cima e i restanti episodi in coda seguono in ordine **crescente di numero episodio** racchiusi in un pannello espandibile dedicato (`ALTRI N EPISODI IN CODA`). L'annullamento dell'intero raggruppamento di episodi attivi/in coda di una serie (tramite **`ANNULLA TUTTI (N EP.)`** o il controllo rapido `44×44dp` sull'header multi-serie) deve passare sempre da `ConfirmModal` (`app/downloads/index.tsx`) ed invocare `DownloadService.cancelAnimeDownloads` lasciando intatti eventuali episodi già completati; `DownloadedEpisodesSheet` deve inoltre sincronizzare la propria chiusura quando `selectedGroup` si svuota.
   - Pulsante di accesso rapido con badge numerico dinamico dei download attivi nell'header della Home (`HomeAppBar`) e link diretto dalla scheda Impostazioni.
6. **Card Impostazioni Minimale `DownloadSettingsCard.tsx` (`app/(tabs)/settings.tsx`)**:
   - Interfaccia compatta e testi essenziali/minimali (*`SCARICATI`*, *`PERCORSO`*, *`RETE`*, *`MEMORIA`*).
   - Gestione cartella SAF (*"CAMBIA"* e *"PREDEFINITA"*).
   - Toggle *"SOLO WI-FI"*.
   - Monitoraggio spazio totale e pulsante *"SVUOTA"* protetto da `ConfirmModal`.
