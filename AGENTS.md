# 📱 AGENTS.md — Regole & Standard di Progetto per Kuro Mobile

Questo documento stabilisce le regole architetturali, i vincoli UX e le convenzioni per il codebase **Kuro** (versione smartphone Android).

---

## 🎯 1. Filosofia di Progetto: Mobile-First & Touch Native

Kuro è un'applicazione concepita **esclusivamente per smartphone Android con interfaccia touch moderna**.

### 🚫 Divieti Tassativi (Anti-Pattern TV)
1. **Nessun Pacchetto TV o D-Pad**:
   - È severamente vietato installare o importare `react-tv-space-navigation`, `@bam.tech/lrud`, `react-native-tvos` o `@react-native-tvos/config-tv`.
   - Nessun listener per telecomandi TV (`TVEventHandler`, `onHWKeyEvent`).
   - Nessun bordo di focus rigido o focus scaling forzato per D-Pad.
2. **Nessuna Disabilitazione della Virtualizzazione**:
   - Su smartphone **è obbligatorio virtualizzare** tutte le liste lunghe (cataloghi anime, cronologia, preferiti, liste episodi) con `@shopify/flash-list` per garantire 60/120 FPS costanti e basso consumo di RAM.

---

## 👆 2. UX & Gesture Touch Mobile
1. **Touch Targets Minimi**:
   - Qualsiasi elemento toccabile (`Pressable`, bottoni, icone) deve rispettare l'area minima di tocco di **almeno 44x44 dp** (utilizzare `hitSlop` dove necessario).
2. **Safe Area & Edge-to-Edge**:
   - Gestire sempre notch, fotocamere punch-hole e barra di navigazione gestuale di Android tramite `react-native-safe-area-context`.
3. **Navigazione a Bottom Tabs**:
   - La navigazione principale usa `<Tabs>` in basso: **Home**, **Cerca**, **Preferiti**, **Cronologia**, **Impostazioni**.
4. **Modal e Menu Contestuali via Bottom Sheets**:
   - Usare i Bottom Sheet nativi (`@expo/ui` o `@gorhom/bottom-sheet`) per selettori server video, filtri di ricerca, cambio qualità e batch puntate.
5. **Feedback Tattile & Pull-to-Refresh**:
   - Integrare feedback aptico (`expo-haptics`) sui tap principali e `RefreshControl` su tutte le schermate a lista per ricaricare i dati da remoto.

---

## 🎬 3. Video Player Mobile
1. **Orientamento & Fullscreen**:
   - Riproduzione in portrait inline con switch automatico o tramite pulsante a **landscape fullscreen**.
   - Blocco barra di navigazione e immersione a schermo intero durante la riproduzione orizzontale.
2. **Gesture Controls**:
   - **Doppio Tap**: Skip rapido ±10 secondi a sinistra/destra dello schermo.
   - **Swipe Verticali**: Controllo luminosità schermo (lato sinistro) e volume multimediale (lato destro).
   - **Controlli OSD**: Auto-hide dopo 4 secondi di inattività; riapparizione con singolo tap sullo schermo.
3. **Picture-in-Picture (PiP)**:
   - Supporto nativo per Android Picture-in-Picture all'uscita dall'app (premendo Home) durante la riproduzione.
4. **AniSkip**:
   - Pulsante fluttuante a schermo ("Salta Intro" / "Salta Outro") al rilevamento dei timestamp.

---

## 🎨 4. Design & Temi (Unistyles)
1. **OLED Nero Assoluto (`#000000`)**:
   - Il tema OLED deve usare `#000000` puro come sfondo base per massimizzare il risparmio energetico sui display AMOLED.
2. **Consistenza con KuroTV**:
   - Mantenere le palette colore (OLED, Dark, Pikachu, Custom) sincronizzate con il core design di KuroTV tramite `react-native-unistyles`.

---

## 🚀 5. Pipeline di Release & OTA
1. **Bucket R2 & Cloudflare Worker**:
   - L'app verifica gli aggiornamenti su `https://kuro-tv.<subdomain>.workers.dev/mobile/manifest.json`.
   - L'APK viene scaricato da `/mobile/latest.apk` con autorizzazione token opzionale.
2. **Script `build-release.sh`**:
   - Compilazione release locale con Gradle, calcolo SHA256, aggiornamento manifest e upload automatico su Cloudflare R2 con commit e tag GitHub.
