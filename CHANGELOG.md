# Changelog

Tutte le modifiche degne di nota a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

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

## [1.0.0] - 2026-11-10
