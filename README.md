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
│  ⚡ MMKV ZERO LATENCY     │  📑 FLASHLIST CAROUSEL│  🚀 IN-APP OTA      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 Caratteristiche Principali

### 🎬 Player Video Touch di Nuova Generazione
- **⚡ Streaming Asincrono (`replaceAsync`)**: Risoluzione del flusso video off-thread (`expo-video`) senza blocchi sincroni sul Main Thread, garantendo caricamento immediato e zero freeze dell'interfaccia.
- **🎞️ Live Real-Frame Scrubbing**: Trascina la timeline per visualizzare in tempo reale i veri fotogrammi video estratti dallo stream (`expo-video`), con cache in memoria e proximity matching a 60 FPS senza lag.
- **⏭️ AniSkip Unificato con Bordo a Consumo**: Rilevamento automatico delle sigle (`OP`/`ED`/`Recap`) con etichetta unificata `'SALTA'`, finestra di esposizione da 10 secondi a consumo temporale e resilienza al riavvolgimento (rewind). Configurabile in Impostazioni per salto manuale o automatico.
- **⏩ Skip Sequenziale Intelligente**: Doppio tap $\pm 10$s con accumulo cumulativo (`+20s`, `+30s`, `+50s`, `-30s`) e pill di feedback compatto centrato accanto al tasto Play/Pausa.
- **⏮️ Comandi Centrali Bilanciati**: Pulsante Play/Pausa circolare affiancato dai comandi per episodio precedente (`play-skip-back`) e successivo (`play-skip-forward`).
- **📑 Carosello Episodi Virtualizzato**: Drawer modale touch-safe con `@shopify/flash-list` per navigare istantaneamente centinaia di episodi con auto-scroll alla puntata corrente e padding simmetrico.
- **ℹ️ Scheda Info & Trama**: Accesso rapido a locandina, badge puntata formattato rigorosamente come `'EPISODIO X/TOT'`, dettagli della serie e sinossi completa scrollabile con normalizzazione difensiva dei generi.
- **🔄 Feedback Visivo Minimale di Caricamento**: Overlay circolare compatto (`ActivityIndicator`) senza scritte testuali durante il caricamento e buffering dello streaming.
- **☀️ Gesture HUD Volume & Luminosità**: Swipe rigorosamente verticali con isolamento asse (`activeOffsetY`, `failOffsetX`, rigetto spostamenti orizzontali) e travel range calibrato per volume (destra) e luminosità (sinistra) con modalità `AUTOMATICA`.
- **📺 Picture-in-Picture & Controlli in Notifica (MediaStyle)**: Supporto nativo PiP, transizione fluida a schermo intero senza pause involontarie tramite `wasPlayingInPiPRef`, controlli rapidi Android MediaSession (con tasto episodio successivo e copertina asincrona via patch native) nel cassetto notifiche e chiusura anti-zombie playback.
- **📑 Menù e Drawer Touch-Safe Senza Tagli Visivi**: Dimensioni responsive in base all'orientamento (portrait/landscape) con troncamento elegante dei testi per azzerare i tagli laterali su smartphone di qualsiasi fattore di forma.

### 📋 Scheda Tecnica Dettaglio & Controlli Rapidi
- **🖼️ Header Pulito & Copertina Espandibile a Schermo Intero**: Rimozione del vecchio backdrop ingrandito a favore di uno spacing iniziale protetto al di sotto del tasto Indietro e locandina cliccabile per aprire l'artwork ad alta risoluzione in una card modale OLED.
- **🎞️ Tabella Tecnica & Supporto Totali Incerti**: Cella generi a scorrimento orizzontale e gestione difensiva dei totali episodi incerti o serie in corso (`??`, `?`).
- **▶️ Controlli di Avvio Rapido Simbolici**: Header compatto con pulsanti Play (`play`) e Riavvia da capo (`reload`) a soli simboli ($\ge 44$dp), con eliminazione del tasto ridondante a fondo pagina.
- **📑 Selettore Batch Touch-Native**: Bottom sheet modale basato su React Native `Modal` touch-safe, ripulito da contenuti correlati per garantire selezione istantanea ad ogni tocco e zero crash Fabric/Compose.
- **🌐 Link Esterni con Icone SVG**: Pulsanti rapidi con icone SVG dedicate per Trailer YouTube, MAL e AniList.

### 🖤 Design System & Esperienza Touch
- **Nero Assoluto OLED (`#000000`)**: Spegnimento fisico dei pixel sui display AMOLED per azzerare i consumi energetici e massimizzare il contrasto.
- **Tipografia Monospace & CAPS LOCK**: Identità coerente su tutta l'app con font monospace di sistema e testi in maiuscolo.
- **📱 Compatibilità Navbar di Sistema Android**: Navbar fissa in-app di default con sollevamento dinamico del router dei tab per zero interferenze con i tasti di navigazione fisici/virtuali, commutazione automatica in auto-hide immersivo (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) durante la riproduzione video a schermo intero e switch dedicato in Impostazioni.
- **🔍 Ricerca Unificata in Home**: Catalogo accessibile dalla Home tramite header search con debouncing 450ms, dismiss tastiera su scroll, hardware back button e filtri modali.
- **Zero Alert di Sistema & Modal In-App Unificato (`ConfirmModal`)**: Sostituzione integrale degli alert nativi grezzi di Android con modali a tema OLED, contrasto dinamico YIQ, feedback aptico e touch target $\ge 44$dp.
- **Bottom Tabs Solo Icone**: Barra inferiore pulita a 4 schede (**Home**, **Preferiti**, **Cronologia**, **Impostazioni**) senza etichette testuali e touch target minimi $\ge 44$dp.
- **Temi Reattivi al Click**: Quattro palette d'accento (**OLED Puro**, **Pikachu**, **Orchidea**, **Rainbow**) con toggle scuro/chiaro al click e contrasto dinamico YIQ del testo.

### ⚡ Prestazioni Estreme & Architettura Safe
- **Storage Sincrono MMKV v3**: Cronologia, preferiti, impostazioni AniSkip e Navbar memorizzati con letture e scritture a latenza zero.
- **Skeleton Animati a Zero CLS**: Primitive e layout dedicati che rispecchiano al millimetro le geometrie reali (scheda tecnica metadati, pulsanti rapidi, hero spotlight, griglie senza doppio padding e sezioni condizionali sincronizzate) azzerando il Cumulative Layout Shift (CLS).
- **Scraper 100% Hermes Safe**: Web scraper nativo basato su `cheerio/slim` ed `htmlparser2`, privo di moduli pesanti `node:*` incompatibili con il runtime mobile.
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

---

## 🚀 Guida Rapida

### 1. Installazione
```bash
git clone https://github.com/user/KuroM.git
cd KuroM
npm install
```

### 2. Test di Qualità (11 Stadi)
```bash
npm test
```
*Valida SemVer, regole OLED, storage MMKV, batch puntate, intervalli AniSkip, skeleton animation, export delle rotte, touch sheets, updater, compatibilità navbar, gesture verticali, PiP no-pause e dimensioni sheets.*

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
