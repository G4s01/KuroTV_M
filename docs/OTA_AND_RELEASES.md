# 🚀 Pipeline di Release, OTA & Architettura Cloudflare

Kuro Mobile integra un sistema autonomo e sicuro per la distribuzione degli aggiornamenti via over-the-air (OTA) tramite **Cloudflare Workers** e storage privato **Cloudflare R2**.

---

## ☁️ Architettura Cloudflare Worker & Bucket R2

L'applicazione condivide lo stesso Cloudflare Worker (`kuro-tv`) della versione televisiva, ma con **un routing e un prefisso di storage completamente isolati**:

```
           [Kuro Mobile App]
                  │
                  ▼
   GET /mobile/manifest.json (Header: x-ota-token / Bearer)
                  │
                  ▼
    ┌───────────────────────────┐
    │     Cloudflare Worker     │
    │        (kuro-tv)          │
    └─────────────┬─────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
  Path: /manifest.json  Path: /mobile/manifest.json
        │                   │
        ▼                   ▼
  [R2 Root: TV]       [R2: mobile/]
  - manifest.json     - manifest.json
  - latest.apk        - latest.apk
  - kuro-vX.Y.apk     - kurom-vX.Y.Z.apk
```

### Endpoints Ufficiali per Kuro Mobile

- **Manifest Mobile**: `https://kuro-tv.<subdomain>.workers.dev/mobile/manifest.json`
- **Ultimo APK Mobile**: `https://kuro-tv.<subdomain>.workers.dev/mobile/latest.apk`

---

## 🔒 Sicurezza e Protezione Manifest

1. **Blocco Modifica In-App (`READ-ONLY`)**:
   L'URL del manifest è bloccato in sola lettura nel file [`src/services/updater/updater-service.ts`](file:///home/g4s/VSCode/KuroM/src/services/updater/updater-service.ts). Qualsiasi tentativo di puntare alla root `/manifest.json` viene automaticamente riscritto a `/mobile/manifest.json` per scongiurare che gli utenti mobile installino accidentalmente la versione Android TV.
2. **Quarantena Rigorosa delle Credenziali**:
   - I file contenenti token e chiavi segrete (`.env`, `.env.local`, `credentials/`) sono protetti in [`.gitignore`](file:///home/g4s/VSCode/KuroM/.gitignore) e non vengono mai inclusi nei commit di Git.
   - Il file [`.env.example`](file:///home/g4s/VSCode/KuroM/.env.example) funge da template pubblico documentato.

---

## 📲 Ciclo di Vita dell'Updater In-App

Il servizio [`UpdaterService`](file:///home/g4s/VSCode/KuroM/src/services/updater/updater-service.ts) gestisce l'intero ciclo di aggiornamento:

1. **Verifica Versione (SemVer)**:
   - Confronta la versione installata (`Constants.expoConfig?.version`) con `manifest.version`.
   - Se `manifest.versionCode > currentVersionCode` o la versione SemVer è più recente, attiva la notifica di aggiornamento.
2. **Download in Background con Progresso**:
   - Scarica l'APK nella cache locale tramite `expo-file-system`.
   - Emette callback continui con percentuale, byte scritti e byte totali per aggiornare la barra di progresso in tempo reale.
3. **Installazione Automatica con Intent Android**:
   - Completato il download, invoca l'Intent nativo `android.intent.action.VIEW` con mime-type `application/vnd.android.package-archive` e flag `FLAG_GRANT_READ_URI_PERMISSION` tramite `expo-intent-launcher`.

---

## 🛠️ Pipeline di Compilazione Release (`build-release.sh`)

Lo script automatico di rilascio esegue le seguenti operazioni:

1. **Controllo Keystore**: Verifica l'esistenza del keystore release e della password configurata.
2. **Compilazione Gradle**: Esegue `cd android && ./gradlew assembleRelease` per generare l'APK standalone ottimizzato con ProGuard/R8.
3. **Calcolo Checksum SHA256**: Genera l'hash crittografico per garantire l'integrità del pacchetto distribuito.
4. **Aggiornamento Manifest**: Compila il file `manifest.json` includendo:
   - `version` e `versionCode`
   - `downloadUrl` (puntato a `/mobile/latest.apk`)
   - `sha256` dell'APK
   - `releaseNotes`
5. **Upload su R2**: Carica `manifest.json`, l'APK versionato (`kurom-vX.Y.Z.apk`) e `latest.apk` sul bucket R2 sotto il percorso `mobile/`.
6. **Notifica GitHub**: Crea contestualmente il tag e la Release su GitHub con le note di rilascio allegate.

---

## 🔐 Backup Cifrato dei Segreti (`backup-secrets-r2.sh`)

Per prevenire perdite accidentali di chiavi di firma senza committarle nel repository Git:
- Lo script raccoglie `.env.local`, i file keystore e le credenziali in un archivio tar.
- Cifra l'archivio usando **OpenSSL con algoritmo AES-256-CBC** e PBKDF2.
- Carica il bundle cifrato (`.enc`) in una cartella sicura e privata del bucket R2.
