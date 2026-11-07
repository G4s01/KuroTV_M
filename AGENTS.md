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

---

## 🛠️ 2. Stack Tecnologico & Architettura (2026)

- **Framework & Runtime**: Expo SDK 58, React Native 0.88.1, React 19.3.0 (Nuova Architettura / TurboModules).
- **Routing & Navigazione**: `expo-router` v58 (file-based routing con Stack e Bottom Tabs).
- **Virtualizzazione Liste**: `@shopify/flash-list` v2 (rendering rapido di griglie e liste infinite).
- **Componenti Nativi UI**: `@expo/ui` per BottomSheet con Jetpack Compose nativo su Android.
- **Data Fetching & Cache Remota**: `@tanstack/react-query` v5 con stale-time ottimizzato.
- **Storage Locale ad Alte Prestazioni**: `react-native-mmkv` v3 (zero-latency key-value store sincrono per preferiti, cronologia e configurazioni).
- **Video & Multimedialità**: `expo-video` v58 con controlli touch personalizzati, OSD immersivo, HUD luminosità/volume e Picture-in-Picture nativo.
- **Styling & Temi**: Sistema dinamico reattivo ispirato a `react-native-unistyles` con `ThemeProvider` a clonazione di riferimento per aggiornamento istantaneo al click.
- **Immagini & Asset SVG**: `expo-image` con cache disco/memoria e supporto SVG integrato.

---

## 👆 3. UX, Gesture Touch & Layout Mobile

1. **Touch Targets Minimi**:
   - Qualsiasi elemento interattivo (`Pressable`, bottoni, chip, icone) deve rispettare l'area minima di tocco di **almeno 44x44 dp** (usare `hitSlop` per icone graficamente compatte).
2. **Safe Area & Edge-to-Edge**:
   - Gestire sempre notch, fotocamere punch-hole e barra di navigazione gestuale di Android tramite `react-native-safe-area-context` e `react-native-edge-to-edge`.
3. **Navigazione a Bottom Tabs**:
   - La navigazione principale usa `<Tabs>` in basso: **Home**, **Esplora**, **Preferiti**, **Cronologia**, **Impostazioni**.
   - Colore attivo delle tab agganciato dinamicamente a `theme.colors.primary`.
4. **Modal e Menu Contestuali via Bottom Sheets**:
   - Usare i Bottom Sheet nativi (`@expo/ui`) per selettori server video, filtri di ricerca, cambio velocità e batch puntate.
5. **Feedback Tattile & Pull-to-Refresh**:
   - Integrare feedback aptico (`expo-haptics`) sui tap principali (`ImpactFeedbackStyle.Light`, `Selection`, `NotificationFeedbackType.Success`).
   - `RefreshControl` nativo su tutte le schermate a lista per consentire la ricarica manuale dei dati da remoto con tint color coordinato al tema.

---

## 🎬 4. Video Player Mobile

1. **Orientamento & Fullscreen**:
   - Riproduzione inline in modalità portrait con passaggio automatico o manuale a **landscape fullscreen**.
   - Barra di navigazione nascosta e modalità immersiva durante la visualizzazione orizzontale (`expo-navigation-bar`).
2. **Gesture Controls Avanzate**:
   - **Doppio Tap**: Skip rapido $\pm 10$ secondi sul lato sinistro (indietro) o destro (avanti) dello schermo con animazione iconica.
   - **Swipe Verticali**: Controllo luminosità schermo (lato sinistro) e volume multimediale (lato destro) con indicatore HUD a percentuale al centro.
   - **Controlli OSD**: Auto-hide automatico dopo 4 secondi di inattività; riapparizione immediata con singolo tap sullo schermo.
3. **Picture-in-Picture (PiP)**:
   - Supporto per Android Picture-in-Picture alla pressione del pulsante home o tramite pulsante OSD dedicato.
4. **AniSkip Reattivo**:
   - Rilevamento automatico timestamp intro/outro (servizio AniSkip) e pulsante fluttuante a schermo ("Salta Intro" / "Salta Outro") stilizzato con `theme.colors.primary`.

---

## 🎨 5. Design System & Temi Dinamici

1. **OLED Nero Assoluto (`#000000`)**:
   - Il tema base OLED deve utilizzare `#000000` puro come sfondo base per massimizzare il risparmio energetico e il contrasto sui display AMOLED.
2. **Palette Temi Supportate**:
   - **OLED Puro**: Primario Rosso `#E50914`, Sfondo `#000000`.
   - **Pikachu**: Primario Giallo `#FAD61D`, Sfondo `#000000`.
   - **Orchidea**: Primario Magenta `#E941FB`, Sfondo `#000000`.
   - **Rainbow**: Primario Turchese `#73FEC8`, Sfondo `#000000`.
   - **Personalizzato**: Colore primario configurabile con contrasto garantito.
3. **Reattività al Click**:
   - I componenti devono consumare `useTheme()` da `@/theme` per aggiornare bordi, badge, pulsanti e indicatori di progresso istantaneamente al click nel selettore temi.

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

---

## 🧪 7. Standard di Test & Verifica Qualità

Prima di ogni commit o push è obbligatorio verificare la conformità tramite:
1. `npm test`: Suite di test automatizzata a 6 stadi:
   - SemVer e Updater Service.
   - Regole di Stile Mobile & conformità OLED.
   - Storage MMKV (preferiti, cronologia visione).
   - Logica di batching episodi e griglia puntate.
   - Intervalli AniSkip.
   - Default export di tutte le rotte Expo Router & sicurezza Hermes.
2. `npx expo export --platform android`: Verifica dell'assenza di errori di bundle e corretta generazione del bytecode Hermes.
