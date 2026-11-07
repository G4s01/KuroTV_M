# 📱 Documentazione Ufficiale — Kuro Mobile

Benvenuto nella documentazione tecnica ufficiale di **Kuro Mobile**, l'applicazione Android touch-first concepita per lo streaming anime ad altissime prestazioni, con consumi minimi sui display AMOLED e un'esperienza utente moderna e reattiva.

---

## 🗺️ Mappa della Documentazione

| Documento | Descrizione |
|---|---|
| [**Architettura del Progetto**](./ARCHITECTURE.md) | Struttura del codebase, Expo Router, data fetching con TanStack Query, MMKV storage e scraper compatibile con Hermes. |
| [**Video Player Mobile**](./VIDEO_PLAYER.md) | Gestione gesture touch (doppio tap seek, swipe luminosità/volume), OSD immersivo, PiP, landscape e integrazione AniSkip. |
| [**Temi & Design System**](./THEMES_AND_STYLING.md) | Filosofia OLED `#000000`, palette colori, icone SVG, regole di touch target $\ge 44$dp e reattività dinamica con `useTheme()`. |
| [**Pipeline di Release & OTA**](./OTA_AND_RELEASES.md) | Architettura Cloudflare Worker, storage R2, manifest `/mobile/manifest.json`, updater automatico e backup cifrati. |
| [**Regole & Standard (AGENTS.md)**](../AGENTS.md) | Standard di progetto tassativi, divieti TV/D-Pad, convenzioni e checklist di verifica pre-commit. |

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

# Esecuzione completa dei test di verifica (6 stadi)
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
