# Changelog

Tutte le modifiche degne di nota a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

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

## [1.0.0] - 2026-11-08

### Aggiunto
- Release ufficiale Kuro Mobile: client Android touch-native per smartphone con Expo SDK 58, React Native 0.88 e React 19.
- Video Player touch avanzato con streaming asincrono (`replaceAsync`), scrubbing live a frame reali, doppio tap sequenziale $\pm 10$s, controlli luminosità e volume verticali e AniSkip con countdown a 10s.
- Palinsesto settimanale con orari delle puntate (`animeworld.ac/schedule`).
- Hero Banner Spotlight con carosello raccomandati numerato (`#1` ... `#8`) e sincronizzazione bi-direzionale senza ping-pong.
- Design system OLED nero assoluto (`#000000`) con contrasto dinamico YIQ e modale in-app unificato `ConfirmModal`.
- Supporto Picture-in-Picture nativo e controlli di sistema in notifica Android (`MediaStyle`).
