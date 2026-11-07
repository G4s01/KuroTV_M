#!/usr/bin/env bash
# ==============================================================================
# KuroTV - Automated Release & Cloudflare R2 OTA Pipeline
# ==============================================================================
# This script handles:
# 1. Prerequisite verification (git, node, npm, java, gh, r2 cli)
# 2. Environment loading (.env.local / .env)
# 3. Interactive SemVer bumping & Changelog editing
# 4. Local Android Release APK compilation via Gradle
# 5. SHA256 generation & manifest.json creation
# 6. Cloudflare R2 upload (always overwriting latest.apk & manifest.json)
# 7. Git commit, tag vX.Y.Z, push, and GitHub Release publication
# ==============================================================================

set -euo pipefail

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

log_info() {
  echo -e "${CYAN}${BOLD}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}${BOLD}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}${BOLD}[ERROR]${NC} $1"
}

banner() {
  echo -e "${PURPLE}${BOLD}"
  echo "╔═══════════════════════════════════════════════════════════════════╗"
  echo "║                  KuroTV Mobile Release Tool                      ║"
  echo "║         OTA In-App Updater & Cloudflare R2 (/mobile)             ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

if [[ "${1:-}" =~ ^(-h|--help)$ ]]; then
  banner
  echo "Uso: ./scripts/build-release.sh [opzioni]"
  echo ""
  echo "Opzioni:"
  echo "  -h, --help    Mostra questa guida ed esce"
  echo ""
  echo "Variabili d'ambiente supportate in .env.local o .env:"
  echo "  EXPO_PUBLIC_UPDATE_MANIFEST_URL  URL del manifest.json (es. https://r2.kurotv.app/manifest.json)"
  echo "  R2_BUCKET_NAME                   Nome del bucket R2 legacy (default: kurotv-releases)"
  echo "  R2_PRIVATE_BUCKET_NAME           Nome del bucket R2 privato per Worker (default: kuro-tv)"
  echo "  OTA_WORKER_URL                   URL del Cloudflare Worker kuro-tv (default: https://kuro-tv.g4s01.workers.dev)"
  echo "  OTA_SECRET_TOKEN                 Token segreto per l'accesso autenticato agli OTA"
  echo "  R2_PUBLIC_URL                    URL pubblico R2 legacy (default: https://r2.kurotv.app)"
  echo "  R2_ACCOUNT_ID                    ID Account Cloudflare"
  echo "  R2_ACCESS_KEY_ID                 Access Key ID Cloudflare R2"
  echo "  R2_SECRET_ACCESS_KEY             Secret Access Key Cloudflare R2"
  echo "  R2_ENDPOINT_URL                  Endpoint S3 R2 (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)"
  echo "  R2_BACKUP_BUCKET_NAME            Nome del bucket R2 isolato per backup credenziali (default: kurotv-backups)"
  echo "  BACKUP_ENCRYPTION_PASSPHRASE     Passphrase master per cifratura AES-256 dei backup"
  echo ""
  exit 0
fi

banner

# ------------------------------------------------------------------------------
# 1. Prerequisite Checks
# ------------------------------------------------------------------------------
log_info "Verifica dei prerequisiti di sistema..."

MISSING_PREREQS=0

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    log_error "Comando mancante: $1 ($2)"
    MISSING_PREREQS=1
  fi
}

check_cmd "git" "Necessario per il versioning del repository"
check_cmd "node" "Node.js runtime"
check_cmd "npm" "Node Package Manager"
check_cmd "gh" "GitHub CLI (necessario per creare le GitHub Releases)"
check_cmd "java" "Java Development Kit (JDK 17+ richiesto da Android Gradle)"

# Check R2 CLI tool (wrangler, npx wrangler, or aws-cli)
R2_TOOL=""
if command -v wrangler &> /dev/null; then
  R2_TOOL="wrangler"
  log_success "Rilevato Cloudflare Wrangler CLI per R2."
elif command -v aws &> /dev/null; then
  R2_TOOL="aws"
  log_success "Rilevato AWS CLI per storage R2 S3-compatibile."
elif npx --yes wrangler --version &> /dev/null; then
  R2_TOOL="npx wrangler"
  log_success "Rilevato npx wrangler per storage R2."
else
  log_warn "Nessun client R2 (wrangler o aws-cli) rilevato nel PATH."
  log_warn "Puoi installare wrangler con: npm install -g wrangler"
  log_warn "Oppure aws-cli con il gestore pacchetti del tuo sistema."
fi

if [ "$MISSING_PREREQS" -ne 0 ]; then
  log_error "Prerequisiti mancanti. Risolvi le dipendenze sopra indicate e riprova."
  exit 1
fi

# Verify gh authentication
if ! gh auth status &> /dev/null; then
  log_warn "GitHub CLI ('gh') non risulta autenticato."
  log_warn "Esegui 'gh auth login' prima di pubblicare la release su GitHub."
fi

# ------------------------------------------------------------------------------
# 2. Load Environment Variables
# ------------------------------------------------------------------------------
log_info "Caricamento variabili d'ambiente..."

if [ -f "${ROOT_DIR}/.env.local" ]; then
  log_info "Caricamento credenziali da .env.local"
  # shellcheck source=/dev/null
  set -a
  source "${ROOT_DIR}/.env.local"
  set +a
elif [ -f "${ROOT_DIR}/.env" ]; then
  log_info "Caricamento credenziali da .env"
  # shellcheck source=/dev/null
  set -a
  source "${ROOT_DIR}/.env"
  set +a
else
  log_warn "Nessun file .env.local o .env trovato. Creane uno basandoti su .env.example."
fi

R2_BUCKET_NAME="${R2_BUCKET_NAME:-kurotv-releases}"
R2_PUBLIC_URL="${R2_PUBLIC_URL:-https://r2.kurotv.app}"
R2_PRIVATE_BUCKET_NAME="${R2_PRIVATE_BUCKET_NAME:-kuro-tv}"
OTA_WORKER_URL="${OTA_WORKER_URL:-https://kuro-tv.g4s01.workers.dev}"
OTA_SECRET_TOKEN="${OTA_SECRET_TOKEN:-${KURO_TV_SECRET_TOKEN:-}}"

log_info "Bucket R2 legacy (pubblico): ${R2_BUCKET_NAME}"
log_info "Bucket R2 privato (Worker kuro-tv): ${R2_PRIVATE_BUCKET_NAME}"
log_info "URL Cloudflare Worker kuro-tv: ${OTA_WORKER_URL}"
log_info "URL pubblico R2 legacy: ${R2_PUBLIC_URL}"

# ------------------------------------------------------------------------------
# 3. Determine Current & Next Version
# ------------------------------------------------------------------------------
CURRENT_VERSION=$(node -p "try { require('./app.json').expo.version || require('./package.json').version || '1.0.0' } catch { '1.0.0' }")
CURRENT_VERSION_CODE=$(node -p "try { require('./app.json').expo.android.versionCode || 1 } catch { 1 }")

log_info "Versione corrente da app.json: ${BOLD}v${CURRENT_VERSION}${NC} (Build ${CURRENT_VERSION_CODE})"

# SemVer calculation: parse numbers safely via node (handles pre-releases and metadata without bash arithmetic error)
SEMVER_PARTS=$(node -e "
  const v = '${CURRENT_VERSION}'.replace(/^[vV]/, '');
  const [main] = v.split('-');
  const [maj, min, pat] = (main || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
  console.log([maj, min, pat].join(' '));
")
read -r MAJOR MINOR PATCH <<< "${SEMVER_PARTS}"

NEXT_PATCH="${MAJOR}.${MINOR}.$((PATCH + 1))"
NEXT_MINOR="${MAJOR}.$((MINOR + 1)).0"

echo ""
echo -e "${BOLD}Seleziona la nuova versione (corrente da app.json: v${CURRENT_VERSION}, build ${CURRENT_VERSION_CODE}):${NC}"
echo "  0) Mantieni v${CURRENT_VERSION} ->  v${CURRENT_VERSION} (Build ${CURRENT_VERSION_CODE})"
echo "  1) +0.0.1             ->  v${NEXT_PATCH} [Default - premi INVIO]"
echo "  2) +0.1.0             ->  v${NEXT_MINOR}"
echo "  Oppure digita direttamente la versione manuale (es. 1.2.0)"
echo ""

NEW_VERSION=""
NEW_VERSION_CODE=""
while true; do
  read -rp "Scelta [INVIO=1 / 0 / 2 / versione manuale]: " VERSION_INPUT || true
  VERSION_INPUT="$(echo -e "${VERSION_INPUT:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if [ "${VERSION_INPUT}" = "0" ]; then
    NEW_VERSION="${CURRENT_VERSION}"
    NEW_VERSION_CODE="${CURRENT_VERSION_CODE}"
    break
  elif [ -z "${VERSION_INPUT}" ] || [ "${VERSION_INPUT}" = "1" ]; then
    NEW_VERSION="${NEXT_PATCH}"
    NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
    break
  elif [ "${VERSION_INPUT}" = "2" ]; then
    NEW_VERSION="${NEXT_MINOR}"
    NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
    break
  else
    CLEAN_VERSION="${VERSION_INPUT#v}"
    if [[ "${CLEAN_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
      NEW_VERSION="${CLEAN_VERSION}"
      if [ "${NEW_VERSION}" = "${CURRENT_VERSION}" ]; then
        NEW_VERSION_CODE="${CURRENT_VERSION_CODE}"
      else
        NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
      fi
      break
    else
      log_error "Versione '${VERSION_INPUT}' non valida. Usa il formato SemVer X.Y.Z (es. 1.2.0) o premi INVIO per default (+0.0.1)."
    fi
  fi
done

log_success "Prossima release: v${NEW_VERSION} (versionCode: ${NEW_VERSION_CODE})"

# ------------------------------------------------------------------------------
# 4. Propose & Interactively Edit Changelog / Release Notes
# ------------------------------------------------------------------------------
log_info "Configurazione note di rilascio..."

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
RECENT_COMMITS=""
if [ -n "${LAST_TAG}" ]; then
  RECENT_COMMITS=$(git log "${LAST_TAG}"..HEAD --pretty=format:"- %s" 2>/dev/null || echo "")
else
  RECENT_COMMITS=$(git log -n 10 --pretty=format:"- %s" 2>/dev/null || echo "")
fi

if [ -z "${RECENT_COMMITS}" ]; then
  RECENT_COMMITS="- Aggiornamento e miglioramenti prestazionali per KuroTV Android TV."
fi

RELEASE_DATE=$(date "+%Y-%m-%d")
ISO_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TMP_NOTES=$(mktemp)
trap 'rm -f "${TMP_NOTES}"' EXIT

echo ""
echo -e "${BOLD}Note di rilascio:${NC}"
echo "  [INVIO]  Aggiorna solo versione e data (## [${NEW_VERSION}] - ${RELEASE_DATE})"
echo "  'n'      Apri nano per modificare tutte le note con i commit recenti"
echo "  <testo>  Inserisci direttamente le note di rilascio da console"
echo ""

read -rp "Note di rilascio [INVIO / n / testo]: " NOTES_INPUT || true
NOTES_TRIMMED="$(echo -e "${NOTES_INPUT:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "${NOTES_TRIMMED}" ]; then
  cat <<EOF > "${TMP_NOTES}"
## [${NEW_VERSION}] - ${RELEASE_DATE}
EOF
  log_info "Note di rilascio: impostata solo versione e data (## [${NEW_VERSION}] - ${RELEASE_DATE})."
elif [ "${NOTES_TRIMMED}" = "n" ] || [ "${NOTES_TRIMMED}" = "N" ]; then
  cat <<EOF > "${TMP_NOTES}"
## [${NEW_VERSION}] - ${RELEASE_DATE}

${RECENT_COMMITS}

### Dettagli Tecnici
- Ottimizzato per Android TV / Leanback launcher
- Supporto flussi multi-bitrate HLS ed ExoPlayer
EOF

  EDITOR_TO_USE="${EDITOR:-nano}"
  if ! command -v "${EDITOR_TO_USE}" &> /dev/null; then
    EDITOR_TO_USE="vi"
  fi
  "${EDITOR_TO_USE}" "${TMP_NOTES}"
else
  cat <<EOF > "${TMP_NOTES}"
## [${NEW_VERSION}] - ${RELEASE_DATE}

${NOTES_INPUT}
EOF
  log_info "Note di rilascio inserite da console."
fi

RELEASE_NOTES=$(cat "${TMP_NOTES}")
if [ -z "${RELEASE_NOTES// /}" ]; then
  RELEASE_NOTES="## [${NEW_VERSION}] - ${RELEASE_DATE}"
fi

# Update CHANGELOG.md cleanly preserving preamble
CHANGELOG_FILE="${ROOT_DIR}/CHANGELOG.md"
if [ ! -f "${CHANGELOG_FILE}" ]; then
  cat <<EOF > "${CHANGELOG_FILE}"
# Changelog

Tutte le modifiche degne di nota a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/)
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).
EOF
fi

node -e '
  const fs = require("fs");
  const changelogPath = process.argv[1];
  const notes = fs.readFileSync(process.argv[2], "utf8").trim();
  const newVersion = process.argv[3];
  let content = fs.readFileSync(changelogPath, "utf8");

  const versionEscaped = newVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versionRegex = new RegExp("(?:^|\\n)##\\s+\\[" + versionEscaped + "\\](?:[\\s\\S]*?)(?=\\n##\\s+\\[|$)");

  if (versionRegex.test(content)) {
    content = content.replace(versionRegex, "\n\n" + notes + "\n");
  } else {
    // Insert before the first version header (## [) to keep preamble intact
    const match = content.match(/\n##\s+\[/);
    if (match && typeof match.index === "number") {
      content = content.slice(0, match.index) + "\n\n" + notes + "\n\n" + content.slice(match.index + 1);
    } else {
      content = content.trimEnd() + "\n\n" + notes + "\n";
    }
  }

  // Normalize excessive blank lines
  content = content.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  fs.writeFileSync(changelogPath, content);
' "${CHANGELOG_FILE}" "${TMP_NOTES}" "${NEW_VERSION}"

log_success "File CHANGELOG.md aggiornato."

# ------------------------------------------------------------------------------
# 5. Version Bump in package.json & app.json
# ------------------------------------------------------------------------------
log_info "Aggiornamento versione in package.json, package-lock.json e app.json..."

# package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# package-lock.json (if present)
if [ -f "./package-lock.json" ]; then
  node -e "
    const fs = require('fs');
    const lock = JSON.parse(fs.readFileSync('./package-lock.json', 'utf8'));
    lock.version = '${NEW_VERSION}';
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = '${NEW_VERSION}';
    }
    fs.writeFileSync('./package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  "
fi

# app.json
node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('./app.json', 'utf8'));
  app.expo.version = '${NEW_VERSION}';
  if (!app.expo.android) app.expo.android = {};
  app.expo.android.versionCode = ${NEW_VERSION_CODE};
  fs.writeFileSync('./app.json', JSON.stringify(app, null, 2) + '\n');
"

log_success "Version bump completato (v${NEW_VERSION}, build ${NEW_VERSION_CODE})."

# ------------------------------------------------------------------------------
# 6. Android Release APK Compilation
# ------------------------------------------------------------------------------
echo ""
log_info "Inizio compilazione Android Release APK..."

# Always read latest configuration from app.json as single source of truth
APP_JSON_VERSION=$(node -p "try { require('./app.json').expo.version } catch { '' }")
APP_JSON_VERSION_CODE=$(node -p "try { require('./app.json').expo.android.versionCode } catch { '' }")

if [ -z "${APP_JSON_VERSION}" ] || [ -z "${APP_JSON_VERSION_CODE}" ]; then
  log_error "Impossibile leggere version e versionCode da app.json!"
  exit 1
fi

log_info "Sincronizzazione dati nativi da app.json (v${APP_JSON_VERSION}, versionCode ${APP_JSON_VERSION_CODE})..."

if [ ! -d "${ROOT_DIR}/android" ]; then
  log_info "Directory android non presente. Esecuzione 'npx expo prebuild --platform android --no-install'..."
  npx expo prebuild --platform android --no-install
else
  log_info "Directory android presente. Aggiornamento configurazione nativa con 'npx expo prebuild --platform android --no-clean --no-install'..."
  npx expo prebuild --platform android --no-clean --no-install
fi

# Explicitly ensure android/app/build.gradle contains the exact version and versionCode from app.json
node -e "
  const fs = require('fs');
  const gradlePath = '${ROOT_DIR}/android/app/build.gradle';
  if (fs.existsSync(gradlePath)) {
    let content = fs.readFileSync(gradlePath, 'utf8');
    content = content.replace(/versionCode\s+\d+/, 'versionCode ${APP_JSON_VERSION_CODE}');
    content = content.replace(/versionName\s+[\"'][^\"']+[\"']/, 'versionName \"${APP_JSON_VERSION}\"');
    fs.writeFileSync(gradlePath, content);

    const verified = fs.readFileSync(gradlePath, 'utf8');
    const vCodeMatch = verified.match(/versionCode\s+(\d+)/);
    const vNameMatch = verified.match(/versionName\s+[\"']([^\"']+)[\"']/);
    if (!vCodeMatch || vCodeMatch[1] !== '${APP_JSON_VERSION_CODE}' || !vNameMatch || vNameMatch[1] !== '${APP_JSON_VERSION}') {
      console.error('ERRORE: Allineamento versionCode / versionName in android/app/build.gradle non riuscito!');
      process.exit(1);
    }
  }
"

# Ensure permanent release keystore is copied into android/app
if [ -f "${ROOT_DIR}/credentials/kurotv-mobile-release.keystore" ]; then
  mkdir -p "${ROOT_DIR}/android/app"
  cp -f "${ROOT_DIR}/credentials/kurotv-mobile-release.keystore" "${ROOT_DIR}/android/app/release.keystore"
  log_info "Release keystore mobile sincronizzata in android/app/release.keystore."
elif [ -f "${ROOT_DIR}/credentials/kurotv-release.keystore" ]; then
  mkdir -p "${ROOT_DIR}/android/app"
  cp -f "${ROOT_DIR}/credentials/kurotv-release.keystore" "${ROOT_DIR}/android/app/release.keystore"
  log_info "Release keystore permanente sincronizzata in android/app/release.keystore."
fi

# Clean previous release APK outputs to avoid stale artifact reuse
APK_OUTPUT_DIR="${ROOT_DIR}/android/app/build/outputs/apk/release"
rm -f "${APK_OUTPUT_DIR}"/*.apk
rm -f "${APK_OUTPUT_DIR}/output-metadata.json"

cd "${ROOT_DIR}/android"
chmod +x ./gradlew 2>/dev/null || true
log_info "Esecuzione Gradle assembleRelease con dati da app.json (v${APP_JSON_VERSION}, build ${APP_JSON_VERSION_CODE})..."
./gradlew assembleRelease \
  -PversionCode="${APP_JSON_VERSION_CODE}" \
  -PversionName="${APP_JSON_VERSION}" \
  --no-daemon
cd "${ROOT_DIR}"

# Locate universal (fat) APK and split APKs
UNIVERSAL_APK=""
if [ -f "${APK_OUTPUT_DIR}/app-universal-release.apk" ]; then
  UNIVERSAL_APK="${APK_OUTPUT_DIR}/app-universal-release.apk"
elif [ -f "${APK_OUTPUT_DIR}/app-release.apk" ]; then
  UNIVERSAL_APK="${APK_OUTPUT_DIR}/app-release.apk"
fi

if [ -z "${UNIVERSAL_APK}" ] || [ ! -f "${UNIVERSAL_APK}" ]; then
  log_error "Universal Fat APK non trovato in ${APK_OUTPUT_DIR} (atteso: app-universal-release.apk o app-release.apk)!"
  log_error "Verifica la configurazione dei splits ABI in android/app/build.gradle (universalApk true)."
  exit 1
fi

APK_PATH="${UNIVERSAL_APK}"
log_success "Universal (Fat) APK: ${APK_PATH}"
APK_SIZE=$(du -h "${APK_PATH}" | awk '{print $1}')
APK_SHA256=$(sha256sum "${APK_PATH}" | awk '{print $1}')
APK_SIZE_BYTES=$(node -e "console.log(require('fs').statSync('${APK_PATH}').size)")
log_info "Dimensione Universal APK: ${APK_SIZE} (${APK_SIZE_BYTES} bytes)"
log_info "SHA256 Universal APK: ${APK_SHA256}"

ARM64_APK="${APK_OUTPUT_DIR}/app-arm64-v8a-release.apk"
ARMEABI_APK="${APK_OUTPUT_DIR}/app-armeabi-v7a-release.apk"
X86_64_APK="${APK_OUTPUT_DIR}/app-x86_64-release.apk"

ARM64_EXISTS=0
ARM64_SHA256=""
ARM64_SIZE_BYTES=0
if [ -f "${ARM64_APK}" ]; then
  ARM64_EXISTS=1
  ARM64_SIZE=$(du -h "${ARM64_APK}" | awk '{print $1}')
  ARM64_SHA256=$(sha256sum "${ARM64_APK}" | awk '{print $1}')
  ARM64_SIZE_BYTES=$(node -e "console.log(require('fs').statSync('${ARM64_APK}').size)")
  log_success "Split arm64-v8a APK: ${ARM64_APK} (${ARM64_SIZE}, ${ARM64_SIZE_BYTES} bytes, SHA: ${ARM64_SHA256})"
fi

ARMEABI_EXISTS=0
ARMEABI_SHA256=""
ARMEABI_SIZE_BYTES=0
if [ -f "${ARMEABI_APK}" ]; then
  ARMEABI_EXISTS=1
  ARMEABI_SIZE=$(du -h "${ARMEABI_APK}" | awk '{print $1}')
  ARMEABI_SHA256=$(sha256sum "${ARMEABI_APK}" | awk '{print $1}')
  ARMEABI_SIZE_BYTES=$(node -e "console.log(require('fs').statSync('${ARMEABI_APK}').size)")
  log_success "Split armeabi-v7a APK: ${ARMEABI_APK} (${ARMEABI_SIZE}, ${ARMEABI_SIZE_BYTES} bytes, SHA: ${ARMEABI_SHA256})"
fi

X86_64_EXISTS=0
X86_64_SHA256=""
X86_64_SIZE_BYTES=0
if [ -f "${X86_64_APK}" ]; then
  X86_64_EXISTS=1
  X86_64_SIZE=$(du -h "${X86_64_APK}" | awk '{print $1}')
  X86_64_SHA256=$(sha256sum "${X86_64_APK}" | awk '{print $1}')
  X86_64_SIZE_BYTES=$(node -e "console.log(require('fs').statSync('${X86_64_APK}').size)")
  log_success "Split x86_64 APK: ${X86_64_APK} (${X86_64_SIZE}, ${X86_64_SIZE_BYTES} bytes, SHA: ${X86_64_SHA256})"
fi

# ------------------------------------------------------------------------------
# Post-Build APK Metadata Verification
# ------------------------------------------------------------------------------
log_info "Verifica dei metadati di versione in tutti gli APK compilati..."
APK_VERIFIED=0

METADATA_JSON="${APK_OUTPUT_DIR}/output-metadata.json"
if [ -f "${METADATA_JSON}" ]; then
  META_CHECK_RESULT=$(node -e "
    const fs = require('fs');
    try {
      const meta = JSON.parse(fs.readFileSync('${METADATA_JSON}', 'utf8'));
      const elements = meta.elements || [];
      if (elements.length === 0) process.exit(2);
      for (const el of elements) {
        if (String(el.versionCode) !== '${APP_JSON_VERSION_CODE}' || el.versionName !== '${APP_JSON_VERSION}') {
          console.error('Discrepanza metadati: ' + JSON.stringify(el));
          process.exit(1);
        }
      }
      console.log('OK ' + elements.length);
    } catch (e) {
      process.exit(3);
    }
  " 2>/dev/null || echo "FAILED")

  if [[ "${META_CHECK_RESULT}" =~ ^OK ]]; then
    SPLIT_COUNT=$(echo "${META_CHECK_RESULT}" | awk '{print $2}')
    log_success "Verifica output-metadata.json superata (${SPLIT_COUNT} varianti verificate con versionCode uniforme): v${APP_JSON_VERSION} (versionCode: ${APP_JSON_VERSION_CODE})."
    APK_VERIFIED=1
  else
    log_error "Discrepanza metadati APK in output-metadata.json! Atteso: v${APP_JSON_VERSION} (code: ${APP_JSON_VERSION_CODE})"
    exit 1
  fi
fi

AAPT_CMD=""
if command -v aapt &>/dev/null; then
  AAPT_CMD="aapt"
elif [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}/build-tools" ]; then
  AAPT_CMD=$(find "${ANDROID_HOME}/build-tools" -name "aapt" -type f 2>/dev/null | sort -V | tail -n 1 || echo "")
elif [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "${ANDROID_SDK_ROOT}/build-tools" ]; then
  AAPT_CMD=$(find "${ANDROID_SDK_ROOT}/build-tools" -name "aapt" -type f 2>/dev/null | sort -V | tail -n 1 || echo "")
fi

if [ -n "${AAPT_CMD}" ] && [ -x "${AAPT_CMD}" ]; then
  AAPT_BADGING=$("${AAPT_CMD}" dump badging "${APK_PATH}" 2>/dev/null | grep -E "^package:" || echo "")
  if [ -n "${AAPT_BADGING}" ]; then
    AAPT_VNAME=$(echo "${AAPT_BADGING}" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")
    AAPT_VCODE=$(echo "${AAPT_BADGING}" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")
    
    if [ "${AAPT_VNAME}" = "${APP_JSON_VERSION}" ] && [ "${AAPT_VCODE}" = "${APP_JSON_VERSION_CODE}" ]; then
      log_success "Verifica binaria aapt dump badging superata: v${AAPT_VNAME} (versionCode: ${AAPT_VCODE})."
      APK_VERIFIED=1
    else
      log_error "Discrepanza aapt badging nell'APK! Atteso: v${APP_JSON_VERSION} (code: ${APP_JSON_VERSION_CODE}), Trovato nell'APK: v${AAPT_VNAME} (code: ${AAPT_VCODE})"
      exit 1
    fi
  fi
fi

if [ "${APK_VERIFIED}" -eq 0 ]; then
  log_warn "Impossibile verificare i metadati binari dell'APK (output-metadata.json e aapt non disponibili)."
fi

# ------------------------------------------------------------------------------
# 7. Generate Cloudflare R2 manifest.json
# ------------------------------------------------------------------------------
log_info "Generazione manifest.json per Cloudflare R2..."

MANIFEST_FILE="${ROOT_DIR}/dist/manifest.json"
MANIFEST_WORKER_FILE="${ROOT_DIR}/dist/manifest-worker.json"
mkdir -p "${ROOT_DIR}/dist"

# 1. Legacy manifest for public R2 bucket (transitional - fat universal APK only)
node -e "
  const fs = require('fs');
  const notes = fs.readFileSync('${TMP_NOTES}', 'utf8').trim();
  const manifest = {
    version: '${APP_JSON_VERSION}',
    versionCode: ${APP_JSON_VERSION_CODE},
    apkUrl: '${R2_PUBLIC_URL}/latest.apk',
    apks: {
      universal: {
        url: '${R2_PUBLIC_URL}/latest.apk',
        sha256: '${APK_SHA256}',
        size: ${APK_SIZE_BYTES}
      }
    },
    releaseNotes: notes,
    sha256: '${APK_SHA256}',
    mandatory: false,
    publishedAt: '${ISO_DATE}'
  };
  fs.writeFileSync('${MANIFEST_FILE}', JSON.stringify(manifest, null, 2) + '\n');
"

# 2. Worker manifest for private R2 bucket (kuro-tv worker - architecture splits + universal fallback under /mobile/)
node -e "
  const fs = require('fs');
  const notes = fs.readFileSync('${TMP_NOTES}', 'utf8').trim();
  const workerBase = '${OTA_WORKER_URL}'.replace(/\/+$/, '');
  const apks = {
    universal: {
      url: workerBase + '/mobile/latest.apk',
      sha256: '${APK_SHA256}',
      size: ${APK_SIZE_BYTES}
    }
  };
  if (${ARM64_EXISTS} === 1) {
    apks['arm64-v8a'] = {
      url: workerBase + '/mobile/latest-arm64-v8a.apk',
      sha256: '${ARM64_SHA256}',
      size: ${ARM64_SIZE_BYTES}
    };
  }
  if (${ARMEABI_EXISTS} === 1) {
    apks['armeabi-v7a'] = {
      url: workerBase + '/mobile/latest-armeabi-v7a.apk',
      sha256: '${ARMEABI_SHA256}',
      size: ${ARMEABI_SIZE_BYTES}
    };
  }
  if (${X86_64_EXISTS} === 1) {
    apks['x86_64'] = {
      url: workerBase + '/mobile/latest-x86_64.apk',
      sha256: '${X86_64_SHA256}',
      size: ${X86_64_SIZE_BYTES}
    };
  }
  const manifest = {
    version: '${APP_JSON_VERSION}',
    versionCode: ${APP_JSON_VERSION_CODE},
    apkUrl: workerBase + '/mobile/latest.apk',
    apks,
    releaseNotes: notes,
    sha256: '${APK_SHA256}',
    mandatory: false,
    publishedAt: '${ISO_DATE}'
  };
  fs.writeFileSync('${MANIFEST_WORKER_FILE}', JSON.stringify(manifest, null, 2) + '\n');
"

log_success "Manifest legacy generato in: ${MANIFEST_FILE}"
log_success "Manifest Worker kuro-tv generato in: ${MANIFEST_WORKER_FILE}"
cat "${MANIFEST_FILE}"

# ------------------------------------------------------------------------------
# 8. Git Commit & Tag Locale
# ------------------------------------------------------------------------------
echo ""
log_info "Creazione commit e tag Git..."

git add package.json app.json CHANGELOG.md
if [ -f "./package-lock.json" ]; then
  git add package-lock.json
fi

if git diff --staged --quiet; then
  log_info "Nessuna modifica ai metadati da committare per v${APP_JSON_VERSION}."
else
  git commit -m "chore(release): v${APP_JSON_VERSION} [build ${APP_JSON_VERSION_CODE}]"
  log_success "Commit creato: chore(release): v${APP_JSON_VERSION} [build ${APP_JSON_VERSION_CODE}]"
fi

TAG_NAME="v${APP_JSON_VERSION}"
if git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
  CURRENT_TAG_TARGET=$(git rev-parse "${TAG_NAME}^{commit}" 2>/dev/null || echo "")
  HEAD_TARGET=$(git rev-parse HEAD)
  if [ "${CURRENT_TAG_TARGET}" != "${HEAD_TARGET}" ]; then
    log_warn "Tag '${TAG_NAME}' esistente su commit precedente. Aggiornamento forzato su HEAD..."
    git tag -f -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
    log_success "Tag '${TAG_NAME}' aggiornato con successo a HEAD."
  else
    log_info "Tag '${TAG_NAME}' già associato a HEAD."
  fi
else
  git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
  log_success "Tag '${TAG_NAME}' creato con successo."
fi

# ------------------------------------------------------------------------------
# 9. Pubblicazione GitHub (Push commit/tag e GitHub Release)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}1. Pubblicazione GitHub:${NC}"
GH_CONFIRM="y"
read -rp "Desideri pubblicare la release oltre al commit su GitHub? [Y/n]: " GH_CONFIRM || true
GH_CONFIRM="${GH_CONFIRM:-y}"

if [[ "${GH_CONFIRM}" =~ ^[Yy]$ ]]; then
  log_info "Push del commit e del tag su GitHub (indicatore di progresso)..."
  git push origin HEAD --progress || true
  git push origin "refs/tags/${TAG_NAME}:refs/tags/${TAG_NAME}" --force --progress || true
  log_success "Push completato."

  log_info "Creazione release su GitHub ${TAG_NAME}..."
  if ! gh release view "${TAG_NAME}" &>/dev/null; then
    gh release create "${TAG_NAME}" \
      --title "KuroTV ${TAG_NAME}" \
      --notes-file "${TMP_NOTES}"
    log_success "Release GitHub creata."
  else
    log_info "Release ${TAG_NAME} già presente su GitHub."
  fi

  log_info "Caricamento APK (${APK_SIZE}) su GitHub Release con barra di progresso in tempo reale..."
  VERSIONED_UNIVERSAL_NAME="kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-universal.apk"
  if [ -f "${ROOT_DIR}/scripts/upload-github-release.mjs" ]; then
    node "${ROOT_DIR}/scripts/upload-github-release.mjs" "${TAG_NAME}" "${APK_PATH}" "app-release.apk" "application/vnd.android.package-archive"
    node "${ROOT_DIR}/scripts/upload-github-release.mjs" "${TAG_NAME}" "${APK_PATH}" "${VERSIONED_UNIVERSAL_NAME}" "application/vnd.android.package-archive"
    if [ "${ARM64_EXISTS}" -eq 1 ]; then
      node "${ROOT_DIR}/scripts/upload-github-release.mjs" "${TAG_NAME}" "${ARM64_APK}" "kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-arm64-v8a.apk" "application/vnd.android.package-archive"
    fi
    if [ "${ARMEABI_EXISTS}" -eq 1 ]; then
      node "${ROOT_DIR}/scripts/upload-github-release.mjs" "${TAG_NAME}" "${ARMEABI_APK}" "kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-armeabi-v7a.apk" "application/vnd.android.package-archive"
    fi
    if [ "${X86_64_EXISTS}" -eq 1 ]; then
      node "${ROOT_DIR}/scripts/upload-github-release.mjs" "${TAG_NAME}" "${X86_64_APK}" "kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-x86_64.apk" "application/vnd.android.package-archive"
    fi
    log_success "GitHub Release pubblicata e APK caricati con successo!"
  else
    log_info "Upload fallback tramite gh release upload..."
    gh release upload "${TAG_NAME}" "${APK_PATH}" --clobber
    if [ "${ARM64_EXISTS}" -eq 1 ]; then
      gh release upload "${TAG_NAME}" "${ARM64_APK}#kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-arm64-v8a.apk" --clobber || true
    fi
    if [ "${ARMEABI_EXISTS}" -eq 1 ]; then
      gh release upload "${TAG_NAME}" "${ARMEABI_APK}#kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-armeabi-v7a.apk" --clobber || true
    fi
    if [ "${X86_64_EXISTS}" -eq 1 ]; then
      gh release upload "${TAG_NAME}" "${X86_64_APK}#kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-x86_64.apk" --clobber || true
    fi
    log_success "GitHub Release pubblicata con successo!"
  fi
else
  log_info "Pubblicazione su GitHub ignorata."
fi

# ------------------------------------------------------------------------------
# 10. Caricamento OTA su Cloudflare R2
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}2. Caricamento OTA Cloudflare:${NC}"
R2_CONFIRM="y"
read -rp "Desideri caricare la versione per gli OTA su Cloudflare R2? [Y/n]: " R2_CONFIRM || true
R2_CONFIRM="${R2_CONFIRM:-y}"

if [[ "${R2_CONFIRM}" =~ ^[Yy]$ ]]; then
  log_info "Caricamento su Cloudflare R2 con barre di progresso in tempo reale..."

  # 1. Caricamento su bucket privato per Cloudflare Worker kuro-tv sotto prefisso mobile/ con barra di progresso
  if [ -n "${R2_PRIVATE_BUCKET_NAME:-}" ]; then
    log_info "Upload su bucket privato R2 (${R2_PRIVATE_BUCKET_NAME}) per Worker kuro-tv sotto 'mobile/'..."
    if [ -f "${ROOT_DIR}/scripts/upload-r2.mjs" ]; then
      # Universal Fat APK (sovrascrive sempre mobile/latest.apk)
      node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest.apk" "${APK_PATH}" "application/vnd.android.package-archive" || {
        log_warn "Upload APK con upload-r2.mjs non riuscito. Fallback su Cloudflare Wrangler..."
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
      }

      # Architecture split APKs (sovrascrivono sempre i rispettivi file latest sotto mobile/)
      if [ "${ARM64_EXISTS}" -eq 1 ]; then
        node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest-arm64-v8a.apk" "${ARM64_APK}" "application/vnd.android.package-archive" || {
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-arm64-v8a.apk" --file="${ARM64_APK}" --content-type="application/vnd.android.package-archive" --remote || true
        }
      fi
      if [ "${ARMEABI_EXISTS}" -eq 1 ]; then
        node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest-armeabi-v7a.apk" "${ARMEABI_APK}" "application/vnd.android.package-archive" || {
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-armeabi-v7a.apk" --file="${ARMEABI_APK}" --content-type="application/vnd.android.package-archive" --remote || true
        }
      fi
      if [ "${X86_64_EXISTS}" -eq 1 ]; then
        node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest-x86_64.apk" "${X86_64_APK}" "application/vnd.android.package-archive" || {
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-x86_64.apk" --file="${X86_64_APK}" --content-type="application/vnd.android.package-archive" --remote || true
        }
      fi

      # Versioned mobile APK: mobile/kurotv-mobile-v*.apk
      VERSIONED_MOBILE_KEY="mobile/kurotv-mobile-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}.apk"
      node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "${VERSIONED_MOBILE_KEY}" "${APK_PATH}" "application/vnd.android.package-archive" || true

      # Manifest for private bucket worker (sovrascrive sempre mobile/manifest.json)
      node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/manifest.json" "${MANIFEST_WORKER_FILE}" "application/json" || {
        log_warn "Upload manifest con upload-r2.mjs non riuscito. Fallback su Cloudflare Wrangler..."
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_WORKER_FILE}" --content-type="application/json" --remote
      }
      log_success "File mobile/ caricati su bucket privato (${R2_PRIVATE_BUCKET_NAME}) con successo!"
    else
      log_info "Upload su bucket privato R2 (${R2_PRIVATE_BUCKET_NAME}) tramite Wrangler..."
      npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
      if [ "${ARM64_EXISTS}" -eq 1 ]; then
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-arm64-v8a.apk" --file="${ARM64_APK}" --content-type="application/vnd.android.package-archive" --remote
      fi
      if [ "${ARMEABI_EXISTS}" -eq 1 ]; then
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-armeabi-v7a.apk" --file="${ARMEABI_APK}" --content-type="application/vnd.android.package-archive" --remote
      fi
      if [ "${X86_64_EXISTS}" -eq 1 ]; then
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest-x86_64.apk" --file="${X86_64_APK}" --content-type="application/vnd.android.package-archive" --remote
      fi
      npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_WORKER_FILE}" --content-type="application/json" --remote
      log_success "File mobile/ caricati su bucket privato (${R2_PRIVATE_BUCKET_NAME}) con Wrangler!"
    fi
  fi

  # ==============================================================================
  # [SEZIONE TRANSITORIA FACOLTATIVA: BUCKET PUBBLICO LEGACY (kurotv-releases)]
  # Questa sezione è transitoria. Come richiesto, carichiamo ESCLUSIVAMENTE il Fat universal APK
  # e il manifest di compatibilità (solo latest.apk e manifest.json sovrascritti, nessun file versionato).
  # ==============================================================================
  if [ -n "${R2_BUCKET_NAME:-}" ]; then
    echo ""
    UPLOAD_LEGACY_CONFIRM="n"
    read -rp "Desideri caricare anche sul bucket legacy pubblico '${R2_BUCKET_NAME}'? [y/N]: " UPLOAD_LEGACY_CONFIRM || true
    if [[ "${UPLOAD_LEGACY_CONFIRM:-n}" =~ ^[Yy]$ ]]; then
      log_info "Upload di compatibilità transitoria su bucket legacy (${R2_BUCKET_NAME}) con SOLO Fat APK latest..."
      if [ -f "${ROOT_DIR}/scripts/upload-r2.mjs" ]; then
        node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BUCKET_NAME}" "latest.apk" "${APK_PATH}" "application/vnd.android.package-archive" || {
          log_warn "Upload legacy con upload-r2.mjs non riuscito. Tentativo tramite Wrangler..."
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_BUCKET_NAME}/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
        }
        node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BUCKET_NAME}" "manifest.json" "${MANIFEST_FILE}" "application/json" || {
          log_warn "Upload manifest legacy con upload-r2.mjs non riuscito. Tentativo tramite Wrangler..."
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_BUCKET_NAME}/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
        }
        log_success "Fat APK latest e manifest legacy caricati su R2 legacy (${R2_BUCKET_NAME}) con successo!"
      elif [ -d "${ROOT_DIR}/workers/kuro-tv" ]; then
        log_info "Upload su bucket legacy (${R2_BUCKET_NAME}) tramite Cloudflare Wrangler..."
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_BUCKET_NAME}/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_BUCKET_NAME}/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
        log_success "Fat APK latest e manifest legacy caricati su R2 legacy (${R2_BUCKET_NAME}) con Wrangler!"
      elif command -v aws >/dev/null 2>&1 && [ -n "${R2_ENDPOINT_URL:-}" ]; then
        log_info "Caricamento legacy tramite AWS CLI S3 endpoint..."
        AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
        AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}" \
        AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}" \
        aws s3 cp "${APK_PATH}" "s3://${R2_BUCKET_NAME}/latest.apk" \
          --endpoint-url "${R2_ENDPOINT_URL}" \
          --content-type "application/vnd.android.package-archive"

        AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
        AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}" \
        AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}" \
        aws s3 cp "${MANIFEST_FILE}" "s3://${R2_BUCKET_NAME}/manifest.json" \
          --endpoint-url "${R2_ENDPOINT_URL}" \
          --content-type "application/json"
        log_success "Fat APK latest e manifest caricati su R2 legacy con AWS CLI!"
      else
        log_warn "Credenziali o client R2 legacy non configurati. Puoi caricare manualmente '${MANIFEST_FILE}' e '${APK_PATH}' sul bucket '${R2_BUCKET_NAME}'."
      fi
    else
      log_info "Caricamento sul bucket legacy '${R2_BUCKET_NAME}' ignorato."
    fi
  fi
  # ==============================================================================
  # [FINE SEZIONE TRANSITORIA BUCKET LEGACY]
  # ==============================================================================

  # Prune automatico di eventuali file versionati legacy rimasti nello storage R2
  if [ -f "${ROOT_DIR}/scripts/clean-r2-old-versions.mjs" ]; then
    log_info "Verifica e pulizia automatica di vecchie versioni archiviate su R2 per risparmiare spazio..."
    node "${ROOT_DIR}/scripts/clean-r2-old-versions.mjs" --yes || true
  fi
else
  log_info "Caricamento OTA su Cloudflare R2 ignorato."
fi

# ------------------------------------------------------------------------------
# 11. Backup Cloud Sicuro (Keystore, Password e .env su Cloudflare R2)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}3. Backup Cloud Sicuro:${NC}"
BACKUP_CONFIRM="n"
read -rp "Desideri creare e caricare un backup cifrato di firma, password e .env su R2? [y/N]: " BACKUP_CONFIRM || true
if [[ "${BACKUP_CONFIRM:-n}" =~ ^[Yy]$ ]]; then
  if [ -f "${ROOT_DIR}/scripts/backup-secrets-r2.sh" ]; then
    bash "${ROOT_DIR}/scripts/backup-secrets-r2.sh"
  else
    log_warn "Script backup-secrets-r2.sh non trovato in scripts/."
  fi
else
  log_info "Backup cloud su Cloudflare R2 ignorato."
fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} Release v${APP_JSON_VERSION} (Build ${APP_JSON_VERSION_CODE}) completata con successo! ${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Riepilogo:"
echo " - APK: ${APK_PATH} (${APK_SIZE})"
echo " - SHA256: ${APK_SHA256}"
echo " - Worker kuro-tv Manifest: ${OTA_WORKER_URL}/manifest.json"
echo " - Worker kuro-tv APK: ${OTA_WORKER_URL}/latest.apk"
echo " - R2 Legacy Manifest: ${R2_PUBLIC_URL}/manifest.json"
echo " - R2 Legacy APK: ${R2_PUBLIC_URL}/latest.apk"
echo ""
