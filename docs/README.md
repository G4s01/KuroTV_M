# 📱 Documentazione Ufficiale — Kuro Mobile

Benvenuto nella documentazione tecnica ufficiale di **Kuro Mobile**, l'applicazione Android touch-first concepita per lo streaming anime ad altissime prestazioni, con consumi minimi sui display AMOLED e un'esperienza utente moderna e reattiva.

---

## 🗺️ Mappa della Documentazione

| Documento | Descrizione |
|---|---|
| [**Architettura del Progetto**](./ARCHITECTURE.md) | Struttura modulare del codebase, Expo Router v58, data fetching con TanStack Query v5, MMKV storage sincrono, scraper Hermes-safe, sistema download SAF con visione offline e sincronizzazione self-hosted KuroSync con TV pairing. |
| [**Video Player Mobile**](./VIDEO_PLAYER.md) | Gesture touch avanzate (doppio tap con accumulo sequenziale, swipe volume/luminosità), OSD immersivo, PiP senza zombie playback, anteprima live dei frame video reali a 60 FPS, carosello puntate FlashList e AniSkip con bordo a consumo temporale. |
| [**Temi & Design System**](./THEMES_AND_STYLING.md) | Filosofia OLED `#000000`, palette temi (OLED, Pikachu, Orchidea, Rainbow), icone SVG pure, contrasto YIQ, schermata impostazioni minimale con changelog scrollabile e regole touch target $\ge 44$dp. |
| [**Pipeline di Release & OTA**](./OTA_AND_RELEASES.md) | Architettura Cloudflare Worker, storage R2, manifest `/mobile/manifest.json`, updater automatico in-app e backup cifrati AES-256. |
| [**Ottimizzazioni & Refactoring**](./REFACTORING_AND_OPTIMIZATIONS.md) | Roadmap modulare completata e tracciata (isolamento OSD, batching adattivo episodi, prefetching immagini e pulizia storage). |
| [**Regole & Standard (AGENTS.md)**](../AGENTS.md) | Standard architetturali tassativi, divieti TV/D-Pad, convenzioni touch native e checklist di verifica pre-commit. |

---

## 🚀 Guida Rapida di Sviluppo

### Prerequisiti
- **Node.js**: versione $\ge 20$ (testato con successo su Node v26)
- **Expo CLI**: Expo SDK 58
- **Android SDK**: Build-Tools e Platform-Tools per test su dispositivo o emulatore

### Comandi Principali

```bash
# Avvio ambiente di sviluppo con Metro bundler
npm run start

# Esecuzione completa dei test di verifica (37 stadi)
npm test

# Controllo tipi TypeScript
npm run typecheck

# Esportazione bundle Android di produzione (verifica Hermes)
npx expo export --platform android

# Compilazione ed esecuzione su dispositivo Android collegato
npm run android
```

---

## 🎯 Punti Chiave del Progetto

1. **Zero Scorie TV**: Nessun pacchetto di spatial navigation (`react-tv-space-navigation`, `@bam.tech/lrud`) o listener remoti; il layout è progettato esclusivamente per schermi touch da $5.5''$ a $7''$.
2. **Virtualizzazione Obbligatoria**: Tutte le liste (Home, Esplora, Dettaglio Episodi, Preferiti, Cronologia) impiegano `@shopify/flash-list` per garantire 60/120 FPS costanti.
3. **Nero Assoluto OLED**: Background `#000000` nativo su tutti i componenti per massimizzare il risparmio energetico sui display OLED/AMOLED.
4. **Hermes Runtime Safe**: Parsing HTML basato su `cheerio/slim` con `htmlparser2`, privo di dipendenze dalla libreria standard di Node (`node:stream`, `node:buffer`).
