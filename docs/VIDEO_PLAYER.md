# 🎬 Video Player Mobile — Specifiche & Architettura

Il video player di Kuro Mobile ([`app/player/[id].tsx`](file:///home/g4s/VSCode/KuroM/app/player/[id].tsx)) è il cuore pulsante dell'applicazione, progettato per offrire un'esperienza multimediale touch cinematografica, fluida e immersiva.

---

## 👆 Gesture Touch & Controlli a Schermo

Il player integra gesture native ad altissima reattività gestite tramite `react-native-gesture-handler`:

### 1. Doppio Tap Rapido ($\pm 10$ Secondi)
- **Metà Sinistra dello Schermo**: Salto indietro rapido di 10 secondi con animazione ad onda e icona `play-back`.
- **Metà Destra dello Schermo**: Salto in avanti rapido di 10 secondi con animazione e icona `play-forward`.

### 2. Swipe Verticali per Luminosità e Volume
- **Swipe sul Lato Sinistro**: Regolazione continua della luminosità dello schermo (da 0% a 100%).
- **Swipe sul Lato Destro**: Regolazione del volume multimediale audio (da 0% a 100%).
- **Indicatore HUD Centrale**: Quando l'utente effettua uno swipe, al centro dello schermo compare un badge scuro a capsula con l'icona (`sunny` o `volume-high`) e il valore percentuale in tempo reale, che scompare dopo 1.5 secondi di inattività.

### 3. Ciclo di Vita dell'OSD (On-Screen Display)
- **Singolo Tap**: Mostra o nasconde i controlli OSD (Header, Barra Timeline, Pulsante Play/Pausa centrale e opzioni).
- **Auto-Hide a 4 Secondi**: Se l'utente non tocca lo schermo per 4 secondi durante la riproduzione, l'OSD si dissolve automaticamente per lasciare spazio al video.
- **Reset del Timer**: Qualsiasi interazione (seek sulla barra, tap sui pulsanti) azzera il timer di inattività.

---

## ⏭️ Integrazione AniSkip (Salta Intro & Outro)

Il player si interfaccia in background con il servizio **AniSkip**:
1. **Recupero Timestamp**: All'avvio dell'episodio, viene interrogata l'API AniSkip per ottenere gli intervalli di tempo in secondi (`start` ed `end`) della sigla di apertura (`op`) e di chiusura (`ed`).
2. **Attivazione Intelligente**: Durante la riproduzione, quando il cursore del tempo corrente entra nell'intervallo dell'opening o dell'ending, a schermo compare in basso a destra il pulsante fluttuante [`AniSkipButton`](file:///home/g4s/VSCode/KuroM/src/components/AniSkipButton.tsx).
3. **Esecuzione dello Skip**: Premendo "Salta Intro" o "Salta Outro", il player effettua il salto immediato al termine dell'intervallo e invia un feedback aptico di successo.
4. **Colore Reattivo**: Il pulsante adotta automaticamente la tinta primaria del tema attivo (`theme.colors.primary`).

---

## 🔄 Orientamento, Fullscreen & Immersione

- **Portrait Inline**: Quando il telefono è in verticale, il video si adatta con aspect-ratio 16:9.
- **Landscape Fullscreen Immersivo**:
  - Toccando il pulsante di ingrandimento (o ruotando il dispositivo), l'orientamento viene forzato a `LANDSCAPE`.
  - La barra di navigazione gestuale e la barra di stato di Android vengono nascoste tramite `expo-navigation-bar`, offrendo un'immersione edge-to-edge a schermo intero senza distrazioni.

---

## 📺 Picture-in-Picture (PiP) Nativo

- **Pulsante OSD Dedicato**: Premendo l'icona PiP nell'header del player, l'app passa istantaneamente alla finestra fluttuante PiP di Android.
- **Background Playback**: La riproduzione video e l'audio continuano senza interruzioni durante l'utilizzo di altre applicazioni sullo smartphone.

---

## ⚙️ Bottom Sheet per Server Video & Velocità

Premendo il tasto opzioni nell'OSD si apre il [`ServerBottomSheet`](file:///home/g4s/VSCode/KuroM/src/components/ServerBottomSheet.tsx):
- **Cambio Sorgente Video**: Possibilità di commutare il server video (AnimeWorld Server 9, server alternativi) in caso di buffering o rallentamenti.
- **Velocità di Riproduzione**: Selezione rapida tra $0.75\times$, $1.0\times$, $1.25\times$, $1.5\times$ e $2.0\times$ con indicatore visuale attivo.
