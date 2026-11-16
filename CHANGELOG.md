# Changelog

Tutte le modifiche degne di nota a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Aggiunto
- **Sincronizzazione Automatica Reattiva KuroSync per Preferiti, Cronologia, Ricerche Recenti & AniSkip**:
  - `StorageMutationListener` in `AppStorage` (`src/services/storage/app-storage.ts`): notifica istantaneamente ogni mutazione o rimozione di Preferiti, Cronologia, Ricerche, Preferenze AniSkip e Impostazioni condivise.
  - Debounce Auto-Sync (1.5s) e Polling Periodico (60s) in `SyncManager` (`src/services/sync/sync-manager.ts`): quando l'utente modifica preferiti, cronologia, ricerche o impostazioni, viene schedulato automaticamente l'invio push a KuroSync (`pushPending`) raggruppando eventuali azioni rapide multiple entro 1500ms, senza bloccare la UI e senza dipendere dall'uscita dall'app (`AppState` blur). In fase di utilizzo attivo, `startPeriodicSync(60000)` sincronizza periodicamente le novità da altri dispositivi (es. Android TV, Web).
  - Pull-to-Refresh Sincronizzato in `FavoritesScreen` (`favorites.tsx`), `HistoryScreen` (`history.tsx`) e `HomeScreen` (`index.tsx`): lo scorrimento verso il basso forza la sincronizzazione delta completa con il server KuroSync prima di ricaricare le viste.
- **Suite di Test Estesa a 30 Stadi**:
  - Aggiunto lo stadio `[30/30]` in `tests/core-verification.test.ts` per validare l'auto-sync reattivo, i listener delle mutazioni di storage, l'accodamento di `sharedSettings` per AniSkip, la potatura con tombstones dei prefissi di ricerca, la protezione da resurrezione per le delezioni locali e la preservazione del watermark delta.

### Risolto
- **Risoluzione Desincronizzazione Automatica Preferiti, Cronologia, Ricerche & AniSkip**:
  - Risolto il mancato tracciamento delle modifiche alle impostazioni AniSkip (`saveAniSkipSettings`) e impostazioni condivise (`saveSettings`): ora accodano regolarmente la mutazione in `SYNC_PENDING_MUTATIONS` sotto `sharedSettings`.
  - Risolto il bug di sovrascrittura di AniSkip durante il merge remoto: `mergeLocalAndRemote` protegge e preserva le mutazioni locali pendenti di `sharedSettings` impedendo che i delta remoti obsoleti ripristinino i vecchi valori.
  - Risolto il bug di distruzione/troncamento delle ricerche recenti: il push di `searchHistory` invia l'elenco completo aggiornato anziché un delta parziale a singolo elemento (rispettando lo schema D1 di KuroTV_S) e `addSearchHistory` genera tombstones dedicati per i prefissi parziali potati evitando che resuscitino al pull.
  - Risolto il bug di resurrezione dei preferiti e della cronologia: `mergeLocalAndRemote` include i tombstones di eliminazione locali pendenti (`pendingDeletions`), impedendo che un pull delta prima del push resusciti elementi appena rimossi dall'utente.
  - Corretto il timestamp di aggiunta ai preferiti (`Date.now()`): azzera il rischio che un timestamp obsoleto del catalogo venga respinto dal server perché inferiore a un tombstone precedente.
  - Preservazione del watermark `SYNC_LAST_TIMESTAMP`: `pushPending` aggiorna unicamente `SYNC_LAST_TIME` lasciando intatto il watermark delta che deve avanzare unicamente al completamento di un pull remoto.
- **Resilienza Connessione KuroSync con Retry Automatici, Feedback di Caricamento & Auto-Logout**:
  - Implementati `performFullSyncWithRetries`, `listProfilesWithRetries` e `switchProfileWithRetries` in `SyncManager` (`src/services/sync/sync-manager.ts`) che gestiscono fino a 2 tentativi di riconnessione automatica (3 tentativi totali con backoff progressivo) con callback per il feedback visivo di stato.
  - Feedback contestuale di caricamento sia all'avvio dell'app in `app/_layout.tsx` (con banner/HUD fluttuante OLED a comparsa durante la sincronizzazione) sia all'apertura o cambio profilo in `SyncProfileModal.tsx` (`"Connessione a KuroSync... (tentativo X di 2)"`).
  - In caso di fallimento persistente al termine dei retry, l'app esegue l'auto-logout pulito (`await this.disconnect()`), azzera lo stato inconsistente in MMKV e propone immediatamente il nuovo accesso all'utente tramite `ConfirmModal` all'avvio o aprendo direttamente `SyncConnectModal` (accesso rapido QR o manuale) da `SyncProfileModal` e `SyncSettingsCard`.
- **Suite di Test Estesa a 29 Stadi**:
  - Aggiunto lo stadio `[29/29]` in `tests/core-verification.test.ts` per validare le gesture indietro su tutte le schede secondarie (`favorites`, `history`, `settings`), la configurazione `backBehavior="initialRoute"` su `<Tabs>`, la logica di retry progressivo con auto-logout e la proposta di login in-app.

### Risolto
- **Risoluzione Back Gesture su Tablet (Xiaomi Mi Pad 6 & Grandi Schermi)**:
  - Risolto il problema per cui su tablet Xiaomi Mi Pad 6 (e in generale con gesture di navigazione Android a schermo intero) la back gesture nelle tab secondarie (`Preferiti`, `Cronologia`, `Impostazioni`) mandava l'applicazione direttamente in background anziché tornare alla Home.
  - Integrato listener `hardwareBackPress` con `useFocusEffect` di Expo Router in `favorites.tsx`, `history.tsx` e `settings.tsx` per intercettare la gesture e reindirizzare a `router.replace('/(tabs)')` quando non vi sono modalità di selezione attive.
  - Aggiunta la proprietà `backBehavior="initialRoute"` al componente `<Tabs>` in `app/(tabs)/_layout.tsx` per standardizzare il comportamento della cronologia di navigazione secondo le convenzioni Android.
- **Azzeramento Doppio Contorno su Tablet Rail**:
  - Introdotto `styles.tabletTabIconWrapper` per evitare che `BottomTabIcon` e `SettingsTabIcon` aggiungano un secondo contorno interno a quello già disegnato da `tabItemActive` sulla sidebar tablet.
- **Allineamento Linea Separatore della Sidebar a 60dp**:
  - Impostato `paddingTop: insets.top` su `railContainer` e `height: 60` su `topSection` con `borderBottomWidth: 1`, armonizzando tutte le intestazioni delle viste (`HomeAppBar`, `SelectionAppBar`, `ExploreScreen`, `DownloadsScreen`, `SettingsScreen`) ad altezza fissa 60dp (`height: 60, minHeight: 60`), garantendo che la linea orizzontale scorra continua e uniforme dal bordo sinistro all'intera larghezza dello schermo.
- **Fix Apertura Palinsesto (`router.navigate`)**:
  - Rimosso `href: null` dalle opzioni della scheda `explore` in `app/(tabs)/_layout.tsx` (che causava il redirect automatico o mancata apertura su Expo Router v58) sostituendolo con `tabBarItemStyle: { display: 'none' }` e `tabBarButton: () => null`.
  - Freccia Indietro nel Palinsesto resa sempre visibile con fallback sicuro `router.canGoBack() ? router.back() : router.replace('/(tabs)')`.
- **Distanziamento Card Selezionate dal Bordo Superiore della Navbar**:
  - Aggiunto `paddingTop: 6` su `tabBarStyle` e ridotta l'altezza delle pill card selezionate a 38dp (`width: 50, height: 38, borderRadius: 14`), garantendo ~12dp di clearance dal bordo superiore (`borderTopWidth: 1`).
- **Ritorno alla Home con Gesture di Sistema da Scaricati e Ricerca**:
  - Migrata la gestione di `BackHandler` a `useFocusEffect` con ref sincroni in `app/(tabs)/index.tsx` e `app/downloads/index.tsx`: la gesture di sistema Android da bordo schermo chiude prioritariamente i modali secondari aperti (foglio filtri ricerca o lista puntate scaricate) prima di riportare alla Home feed, evitando categoricamente l'uscita accidentale dall'applicazione.

### Migliorato
- **AniSkip Intelligente per Ending & Scene Post-Ending (`'SALTA'` / `'PROSSIMO'`)**:
  - Introdotto `computeAniSkipOverlayState`, `doesEndingCoincideWithEnd` e soglia `ENDING_COINCIDE_END_THRESHOLD_SECONDS` (5s) in `src/services/aniskip/index.ts`: quando la sigla di chiusura (`ed` / `mixed-ed`) termina entro `5s` dalla durata dell'episodio ed è disponibile l'episodio successivo, il pulsante `'SALTA'` diventa automaticamente **`'PROSSIMO'`** per evitare di ritrovarsi alla fine della puntata già conclusa (e in modalità `AUTO` naviga direttamente alla puntata seguente). Sull'ultimo episodio resta sempre `'SALTA'`.
  - In presenza di scene post-ending (`effectiveDuration - endTime > 5s`) ed episodio successivo disponibile, durante la sigla rimane il solo pulsante `'SALTA'` (in `MANUALE`) oppure scatta lo skip automatico (in `AUTO`); all'inizio della sezione post-ending (anche subito dopo il salto automatico o manuale della sigla) compare separatamente **`'PROSSIMO'`** (`AniSkipButton` `variant="next"`, icona `play-skip-forward`) usando la stessa durata configurata dall'utente (`5s`–`60s` o `∞`), senza mai mostrare `'SALTA'` e `'PROSSIMO'` insieme.
  - La navigazione avviata dal pulsante AniSkip `'PROSSIMO'` marca l'episodio corrente come completato in cronologia MMKV (`{ markCurrentCompleted: true }`).
  - Aggiornata la dicitura della durata nelle Impostazioni (`DURATA PULSANTI ANISKIP`, `AniSkipSlider` e `AniSkipDurationSlider`) per riflettere entrambi i pulsanti `'SALTA'` e `'PROSSIMO'`, oltre al nuovo stadio `[24/24]` in `tests/core-verification.test.ts`.

## [1.0.4] - 2026-11-11

### Aggiunto
- **Annullamento Intero Raggruppamento Download in `SCARICATI`**:
  - Aggiunto `DownloadService.cancelAnimeDownloads(animeId)` (`src/services/downloads/download-service.ts`) per annullare in blocco tutti gli episodi attivi o in coda di una serie (interrompendo eventuale trasferimento attivo, rimuovendo i file parziali non completati, lasciando intatti gli episodi già salvati e riavviando la coda FIFO).
  - Esposti in `ActiveDownloadGroupCard` il pulsante dedicato **`ANNULLA TUTTI (N EP.)`** (quando una serie ha più episodi in coda/attivi) e il pulsante rapido `44×44dp` (`seriesCancelGroupBtn`) sull'header delle serie multiple, entrambi protetti da `ConfirmModal` in `app/downloads/index.tsx` (`handleCancelGroup`).
  - Sincronizzata la chiusura automatica di `DownloadedEpisodesSheet` quando `selectedGroup` diventa vuoto e aggiunta copertura di test in `tests/core-verification.test.ts`.

### Risolto
- **Fix Glitch Rimbalzo Swipe-Down sui Bottom Sheet Touch-Native**:
  - Risolto in `useBottomSheetDragDismiss` il ritorno improvviso verso l'alto e il doppio slide-out su Android dopo la chiusura tramite scorrimento verso il basso: rimosso il reset immediato `translateY.setValue(0)` post-`onClose()`, adottato un target di uscita dinamico fuori schermo (`Math.max(Dimensions.get('window').height, 800)`), introdotto `isDismissingRef` per impedire doppie chiusure o ri-cattura touch in uscita e limitato il reset sincrono di `translateY` alla sola riapertura (`isVisible: true`).
  - Convertiti tutti i `<Modal>` dei bottom sheet (`ServerBottomSheet`, `PlayerInfoSheet`, `PlayerEpisodesCarouselSheet`, `BatchBottomSheet`, `DownloadOptionsSheet`, oltre a `DownloadedEpisodesSheet`) ad `animationType="fade"` e integrato `useBottomSheetDragDismiss` anche su `FilterBottomSheet` (`FILTRI DI RICERCA`).

## [1.0.3] - 2026-11-10

### Aggiunto
- **Gestione Anime in Corso "IN PARI"**:
  - Quando l'utente completa l'ultimo episodio attualmente disponibile di una serie ongoing (totale sconosciuto `'?'` o stato *in corso*), la serie non viene più rimossa da *Riprendi a guardare*.
  - Stato visivo dedicato `isCaughtUp: true` con badge OLED `IN PARI` verde (`#10B981`), icona `checkmark-done-circle`, progress bar al 100% e sottotitolo `EP. X • IN PARI`.
  - Tap diretto sulla card per aprire la scheda tecnica dell'anime e consultare dettagli, palinsesto o rewatch.
- **Sincronizzazione Ibrida Smart (`continue-watching-sync.ts`)**:
  - *Check passivo istantaneo*: confronta a costo zero di rete le serie in pari con gli ultimi episodi caricati nella Home (`homeData.all`, `homeData.newAdded`), promuovendo subito la serie al primo posto nel carosello all'Episodio X+1 a 0:00 non appena esce una nuova puntata.
  - *Check remoto periodico*: controllo di rete mirato in background all'avvio/focus della Home (`useFocusEffect`) se sono trascorse almeno 4 ore dall'ultima verifica.
  - *Pull-to-Refresh forzato*: lo swipe verso il basso nella Home forza istantaneamente il controllo remoto di tutte le serie in pari.
  - *Rimozione automatica a conclusione*: rimozione automatica da *Riprendi a guardare* se la serie risulta definitivamente conclusa (totale noto e raggiunto).
- **Chiusura Menù Player Tramite Scorrimento (Swipe-Down Dismiss)**:
  - Implementato l'hook touch-native `useBottomSheetDragDismiss` su driver nativo a 60/120 FPS per `ServerBottomSheet`, `PlayerInfoSheet` e `PlayerEpisodesCarouselSheet`.
  - Chiusura naturale trascinando la maniglia drag handle o l'area di intestazione verso il basso con soglia minima e velocità di rilascio, senza conflitti con scrolling o pulsanti interni.
- **Simmetria Griglia Filtri & Rimozione Opzioni Ridondanti**:
  - Eliminazione di tutte le opzioni generiche 'TUTTI...' (implicite in assenza di selezione).
  - Griglia touch-native perfettamente bilanciata: Audio a 2 colonne (`DOPPIATI` / `SOTTOTITOLATI`), Formato bilanciato, Stato a 2 colonne e Generi a 2 colonne uniformi.

## [1.0.2] - 2026-11-10

### Aggiunto
- **Primitiva Slider Unificata (`StepSlider`)**: Creato `StepSlider.tsx`, componente base touch-safe con `PanResponder` non-terminabile, calcolo layout dinamico, snapping reattivo su step discreti e feedback aptico `Haptics.selectionAsync()`.
- **Architettura Modulare Schermata Home (`src/components/home/`)**:
  - `home.styles.ts`: Isolamento dell'intero StyleSheet da oltre 600 righe.
  - `HomeSection.tsx`: Unificazione dichiarativa dei caroselli orizzontali (*Ultimi Episodi*, *Tendenze*, *In Corso*, *Prossime Uscite*, *Nuove Aggiunte*).
  - `ContinueWatchingSection.tsx`: Modulo isolato per *Riprendi a guardare* con rimozione sicura.
  - `HomeSearchHeader.tsx` & `HomeAppBar`: Header di ricerca dedicato con autoFocus e barra brand Kuro TV.
  - `SearchFilterChips.tsx`: Barra filtri attivi scrollabile orizzontalmente con rimozione selettiva.
  - `SearchResultsGrid.tsx`: Griglia a 2 colonne `@shopify/flash-list` con stato vuoto touch-safe.
  - `SearchHistoryList.tsx`: Cronologia ricerche in stile Google con eliminazione singola e massiva.
- **Architettura Modulare Impostazioni (`src/components/settings/`)**:
  - `settings.styles.ts`: Isolamento dello StyleSheet da oltre 470 righe.
  - `ThemeSettingsCard.tsx`: Selettore temi SVG (OLED, Pikachu, Orchidea, Rainbow) con invertibilità chiaro/scuro.
  - `SourceSettingsCard.tsx`: Gestione domini rapidi (`.ac`, `.so`, `.tv`) e URL personalizzato con feedback in-app.

### Rimosso
- **Dipendenze e Servizi Inutilizzati**:
  - Rimosso `@expo/ui` dal `package.json` in favore dei modali touch-native React Native `Modal`.
  - Rimossi i servizi orfani `src/services/kitsu/` e `src/services/anilist/`, insieme ai query hook deprecati e al tipo `RootStackParamList`.

### Modificato
- **Snellimento Controller di Rotta**:
  - `app/(tabs)/index.tsx`: ridotto da 2104 a 1134 righe (-970 righe, ~46% di riduzione).
  - `app/(tabs)/settings.tsx`: ridotto da 1571 a 972 righe (-600 righe, ~38% di riduzione).
  - `HistorySlider`, `AniSkipSlider` e `AniSkipDurationSlider`: ridotti da oltre 400 righe ciascuno a ~90-100 righe delegando a `StepSlider`.

## [1.0.1] - 2026-11-10

### Aggiunto
- **Cronologia Ricerche in Stile Google**: Sostituzione dei vecchi consigliati generici con cronologia touch-native delle ricerche recenti (icona orologio `time-outline`, testo maiuscolo monospace, tap-to-search immediato, eliminazione singola voce con `close-outline` $\ge 44$dp e cancellazione massiva protetta da `ConfirmModal`).
- **Configurazione Ritenzione Ricerche nelle Impostazioni**: Nuovo slider discreto `HistorySlider` con preset dedicato `SEARCH_RETENTION_STEPS` (`OFF`, `30GG`, `60GG`, `90GG`, `ON` illimitato) e pulsante di svuotamento rapido della cronologia ricerche.
- **Filtro Audio Dedicato**: Supporto completo per `TUTTI GLI AUDIO`, `DOPPIATI (ITA)` (`dub: '1'`) e `SOTTOTITOLATI (SUB)` (`dub: '0'`).
- **Selezione Multipla Generi**: Integrazione di tutti i 46 generi del catalogo AnimeWorld con supporto a selezioni multiple e combinazione logica `genre_mode=and`.
- **Suite di Test a 16 Stadi**: Estesa la suite di test automatizzata con verifica approfondita di storage cronologia ricerche, filtri multi-genere, audio e isolamento scraper.

### Risolto
- **Fix Risultati Spuri Categorie & Formati AnimeWorld**: Risolto il problema che mostrava 6 titoli spuri non coerenti per ricerche o filtri privi di risultati (es. Film Anime / Movies). Il selettore dello scraper esclude categoricamente i widget laterali `.simple-film-list` e `.ranking`.
- **Mappatura Formati e Categorie**: Mappatura corretta con gli ID numerici nativi del motore AnimeWorld (`type`: `0` Serie TV, `4` Film Anime, `1` OAV, `2` ONA, `3` Special).
- **Ordinamento per Data Reale di Uscita**: Aggiunto `sort: '5'` per ordinare in base alla data di rilascio reale delle serie (`release_date:desc`), oltre a Ultime aggiunte (`1`), Più visti (`6`), Meglio valutati (`7`), A-Z (`2`) e Z-A (`3`).

## [1.0.0] - 2026-11-16

KuroTV_S v2
