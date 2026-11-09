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

Lo script automatico di rilascio è ottimizzato specificamente per smartphone Android:

1. **Gestione Flessibile Versioni & Build Number**:
   - Menu interattivo con selezione automatica SemVer Patch (+0.0.1) o Minor (+0.1.0).
   - Inserimento manuale di qualsiasi versione (es. `1.2.0`, `1.0.0`, `v1.0.0`): **incrementa sempre in automatico** il `versionCode` (`CURRENT_VERSION_CODE + 1`), garantendo l'accettazione dell'aggiornamento dall'installer di sistema Android.
   - Opzione `0` (*"Mantieni vX.Y.Z"*) per preservare il medesimo build number.
   - Supporto sintassi `X.Y.Z:B` (es. `1.2.0:4` per forzare la build) e flag CLI non-interattive: `./scripts/build-release.sh -v 1.2.0 -b 5` o `./scripts/build-release.sh 1.2.0`.
   - Supporto per la modalità `--skip-build` per finalizzare e caricare su R2 un APK già compilato.
2. **Target Architettura Esclusiva (`arm64-v8a`)**:
   - Compila esclusivamente per `arm64-v8a` (`-PreactNativeArchitectures=arm64-v8a`), eliminando il sovraccarico di compilazione delle architetture legacy (`armeabi-v7a`, `x86`, `x86_64`) pur mantenendo la piena compatibilità con tutti gli smartphone moderni.
   - Il client in-app mantiene intatta la logica di risoluzione per architettura (`selectApkForDevice()` in `UpdaterService`) con fallback trasparente su `universal` / `latest.apk`.
2. **Controllo Keystore**: Verifica l'esistenza del keystore release permanente e della password configurata.
3. **Compilazione Gradle**: Esegue `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon` per generare l'APK standalone ottimizzato con ProGuard/R8.
4. **Verifica Integrità Binaria**: Ispeziona l'APK con `unzip` confermando la presenza di `lib/arm64-v8a/` e bloccando tassativamente la release qualora contenga librerie native legacy.
5. **Calcolo Checksum SHA256**: Genera l'hash crittografico per garantire l'integrità del pacchetto distribuito.
6. **Aggiornamento Manifest**: Compila il file `manifest.json` includendo:
   - `version` e `versionCode`
   - `apkUrl`, `apks['arm64-v8a']` e `apks.universal` puntati all'unico APK arm64-v8a (`/mobile/latest.apk`)
   - `sha256` dell'APK
   - `releaseNotes`
7. **Upload su R2**: Carica **esclusivamente 2 file in sovrascrittura**: `mobile/manifest.json` e `mobile/latest.apk` sul bucket R2 privato sotto il percorso `mobile/`, azzerando qualsiasi consumo superfluo di spazio. Nessun file legacy o versionato viene accumulato su R2.
8. **Release GitHub**: Crea contestualmente il tag e la Release su GitHub con le note di rilascio e carica l'APK standalone versionato `arm64-v8a`.

---

## 🔐 Backup Cifrato dei Segreti (`backup-secrets-r2.sh`)

Per prevenire perdite accidentali di chiavi di firma senza committarle nel repository Git:
- Lo script raccoglie `.env.local`, i file keystore e le credenziali in un archivio tar.
- Cifra l'archivio usando **OpenSSL con algoritmo AES-256-CBC** e PBKDF2 (100.000 iterazioni).
- Carica il bundle cifrato (`.enc`) nel percorso isolato **`mobile/secure-backups/`** del bucket R2, completamente separato dal backup della versione Android TV (`secure-backups/`).
