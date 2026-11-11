# Changelog

Tutte le modifiche degne di nota a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

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

## [1.0.0] - 2026-11-11
