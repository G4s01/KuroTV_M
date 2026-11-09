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
# shellcheck disable=SC2034
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine the real project root directory (where package.json and app.json live)
CALL_DIR="$(pwd)"
SRC_PATH="${BASH_SOURCE[0]:-}"
while [ -L "${SRC_PATH}" ] && [[ "${SRC_PATH}" != /dev/fd/* ]]; do
  DIR="$(cd -P "$(dirname "${SRC_PATH}")" 2>/dev/null && pwd || echo "${CALL_DIR}")"
  TARGET="$(readlink "${SRC_PATH}" 2>/dev/null || echo "")"
  [ -z "${TARGET}" ] && break
  [[ "${TARGET}" != /* ]] && TARGET="${DIR}/${TARGET}"
  SRC_PATH="${TARGET}"
done
SCRIPT_DIR="$(cd -P "$(dirname "${SRC_PATH}")" 2>/dev/null && pwd || echo "")"

if [ -f "${SCRIPT_DIR}/package.json" ] && [ -f "${SCRIPT_DIR}/app.json" ]; then
  ROOT_DIR="${SCRIPT_DIR}"
elif [ -f "${SCRIPT_DIR}/../package.json" ] && [ -f "${SCRIPT_DIR}/../app.json" ]; then
  ROOT_DIR="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${CALL_DIR}/package.json" ] && [ -f "${CALL_DIR}/app.json" ]; then
  ROOT_DIR="${CALL_DIR}"
else
  ROOT_DIR="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
fi
cd "${ROOT_DIR}"

# Locate helper scripts directory (scripts/ preferred, .scripts/ fallback)
SCRIPTS_DIR="${ROOT_DIR}/scripts"
if [ ! -d "${SCRIPTS_DIR}" ] && [ -d "${ROOT_DIR}/.scripts" ]; then
  SCRIPTS_DIR="${ROOT_DIR}/.scripts"
elif [ ! -d "${SCRIPTS_DIR}" ]; then
  SCRIPTS_DIR="${ROOT_DIR}"
fi

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
  echo "║            KuroTV Mobile Release Tool (arm64-v8a)                ║"
  echo "║         OTA In-App Updater & Cloudflare R2 (/mobile)             ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

MISSING_PREREQS=0

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    log_error "Comando mancante: $1 ($2)"
    MISSING_PREREQS=1
  fi
}

main() {
  SKIP_BUILD=0
  CLI_VERSION=""
  CLI_BUILD_NUMBER=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --skip-build|--no-build)
        SKIP_BUILD=1
        shift
        ;;
      -v|--version)
        CLI_VERSION="$2"
        shift 2
        ;;
      --version=*)
        CLI_VERSION="${1#*=}"
        shift
        ;;
      -b|--build-number|--build)
        CLI_BUILD_NUMBER="$2"
        shift 2
        ;;
      --build-number=*|--build=*)
        CLI_BUILD_NUMBER="${1#*=}"
        shift
        ;;
      -h|--help)
        banner
        echo "Uso: ./build-release.sh [opzioni] [versione]"
        echo "     oppure ./scripts/build-release.sh [opzioni] [versione]"
        echo ""
        echo "Opzioni:"
        echo "  -v, --version <ver>         Specifica direttamente la nuova versione (es. 1.2.0)"
        echo "  -b, --build-number <num>    Specifica direttamente il numero di build (versionCode)"
        echo "  --skip-build                Salta la compilazione Gradle e riutilizza l'APK già presente in android/app/build/outputs/apk/release"
        echo "  -h, --help                  Mostra questa guida ed esce"
        echo ""
        echo "Variabili d'ambiente supportate in .env.local o .env:"
        echo "  R2_PRIVATE_BUCKET_NAME           Nome del bucket R2 privato per Worker (default: kuro-tv)"
        echo "  OTA_WORKER_URL                   URL del Cloudflare Worker kuro-tv (default: https://kuro-tv.g4s01.workers.dev)"
        echo "  OTA_SECRET_TOKEN                 Token segreto per l'accesso autenticato agli OTA"
        echo "  R2_ACCOUNT_ID                    ID Account Cloudflare"
        echo "  R2_ACCESS_KEY_ID                 Access Key ID Cloudflare R2"
        echo "  R2_SECRET_ACCESS_KEY             Secret Access Key Cloudflare R2"
        echo "  R2_ENDPOINT_URL                  Endpoint S3 R2 (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)"
        echo "  R2_BACKUP_BUCKET_NAME            Nome del bucket R2 per backup credenziali (default: kurotv-backups o kuro-tv)"
        echo "  BACKUP_ENCRYPTION_PASSPHRASE     Passphrase master per cifratura AES-256 dei backup"
        echo ""
        exit 0
        ;;
      *)
        if [[ "$1" =~ ^v?[0-9]+\.[0-9]+ ]]; then
          CLI_VERSION="$1"
        fi
        shift
        ;;
    esac
  done

  banner

  # ------------------------------------------------------------------------------
  # 1. Prerequisite Checks
  # ------------------------------------------------------------------------------
  log_info "Verifica dei prerequisiti di sistema..."

  MISSING_PREREQS=0

check_cmd "git" "Necessario per il versioning del repository"
check_cmd "node" "Node.js runtime"
check_cmd "npm" "Node Package Manager"
check_cmd "gh" "GitHub CLI (necessario per creare le GitHub Releases)"
if [ "${SKIP_BUILD}" -eq 0 ]; then
  check_cmd "java" "Java Development Kit (JDK 17+ richiesto da Android Gradle)"
fi

# Check R2 CLI tool (wrangler, npx wrangler, or aws-cli)
# shellcheck disable=SC2034
R2_TOOL=""
if command -v wrangler &> /dev/null; then
  R2_TOOL="wrangler"
  log_success "Rilevato Cloudflare Wrangler CLI per R2."
elif command -v aws &> /dev/null; then
  R2_TOOL="aws"
  log_success "Rilevato AWS CLI per storage R2 S3-compatibile."
elif npx --yes wrangler --version &> /dev/null; then
  # shellcheck disable=SC2034
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
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env.local"
  set +a
elif [ -f "${ROOT_DIR}/.env" ]; then
  log_info "Caricamento credenziali da .env"
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
else
  log_warn "Nessun file .env.local o .env trovato. Creane uno basandoti su .env.example."
fi

R2_PRIVATE_BUCKET_NAME="${R2_PRIVATE_BUCKET_NAME:-kuro-tv}"
OTA_WORKER_URL="${OTA_WORKER_URL:-https://kuro-tv.g4s01.workers.dev}"
OTA_SECRET_TOKEN="${OTA_SECRET_TOKEN:-${KURO_TV_SECRET_TOKEN:-}}"

log_info "Bucket R2 privato (Worker kuro-tv): ${R2_PRIVATE_BUCKET_NAME}"
log_info "URL Cloudflare Worker kuro-tv: ${OTA_WORKER_URL}"

# ------------------------------------------------------------------------------
# 3. Determine Current & Next Version
# ------------------------------------------------------------------------------
CURRENT_VERSION=$(node -p "try { require('./app.json').expo.version || require('./package.json').version || '1.0.0' } catch { '1.0.0' }")
CURRENT_VERSION_CODE=$(node -e '
  const fs = require("fs");
  let code = 1;
  try {
    const app = JSON.parse(fs.readFileSync("./app.json", "utf8"));
    if (app?.expo?.android?.versionCode) code = Math.max(code, parseInt(app.expo.android.versionCode, 10));
  } catch {}
  try {
    const gradle = fs.readFileSync("./android/app/build.gradle", "utf8");
    const m = gradle.match(/versionCode\s+(\d+)/);
    if (m) code = Math.max(code, parseInt(m[1], 10));
  } catch {}
  console.log(code);
')

log_info "Versione corrente da app.json: ${BOLD}v${CURRENT_VERSION}${NC} (Build ${CURRENT_VERSION_CODE})"

# SemVer calculation: parse numbers safely via node (handles pre-releases and metadata without bash arithmetic error)
SEMVER_PARTS=$(node -e '
  const v = (process.argv[1] || "1.0.0").replace(/^[vV]/, "");
  const [main] = v.split("-");
  const [maj, min, pat] = (main || "1.0.0").split(".").map(n => parseInt(n, 10) || 0);
  console.log([maj, min, pat].join(" "));
' "${CURRENT_VERSION}")
read -r MAJOR MINOR PATCH <<< "${SEMVER_PARTS}"

NEXT_PATCH="${MAJOR}.${MINOR}.$((PATCH + 1))"
NEXT_MINOR="${MAJOR}.$((MINOR + 1)).0"

echo ""
if [ "${SKIP_BUILD}" -eq 1 ]; then
  echo -e "${BOLD}Modalità --skip-build attiva (riutilizzo binario APK esistente):${NC}"
  echo "  0) Mantieni v${CURRENT_VERSION} ->  v${CURRENT_VERSION} (Build ${CURRENT_VERSION_CODE}) [Default con --skip-build - premi INVIO]"
  echo "  1) +0.0.1             ->  v${NEXT_PATCH} (Build $((CURRENT_VERSION_CODE + 1)))"
  echo "  2) +0.1.0             ->  v${NEXT_MINOR} (Build $((CURRENT_VERSION_CODE + 1)))"
else
  echo -e "${BOLD}Seleziona la nuova versione (corrente da app.json: v${CURRENT_VERSION}, build ${CURRENT_VERSION_CODE}):${NC}"
  echo "  0) Mantieni v${CURRENT_VERSION} ->  v${CURRENT_VERSION} (Build ${CURRENT_VERSION_CODE})"
  echo "  1) +0.0.1             ->  v${NEXT_PATCH} (Build $((CURRENT_VERSION_CODE + 1))) [Default - premi INVIO]"
  echo "  2) +0.1.0             ->  v${NEXT_MINOR} (Build $((CURRENT_VERSION_CODE + 1)))"
fi
echo "  Oppure digita direttamente la versione manuale (es. 1.2.0 o 1.2.0:4 per build specifica)"
echo ""

NEW_VERSION=""
NEW_VERSION_CODE=""
while true; do
  if [ -n "${CLI_VERSION:-}" ]; then
    VERSION_INPUT="${CLI_VERSION}"
    CLI_VERSION="" # consumata
  elif [ "${SKIP_BUILD}" -eq 1 ]; then
    read -rp "Scelta [INVIO=0 / 1 / 2 / versione manuale]: " VERSION_INPUT || true
  else
    read -rp "Scelta [INVIO=1 / 0 / 2 / versione manuale]: " VERSION_INPUT || true
  fi
  VERSION_INPUT="$(echo -e "${VERSION_INPUT:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if [ -z "${VERSION_INPUT}" ]; then
    if [ "${SKIP_BUILD}" -eq 1 ]; then
      NEW_VERSION="${CURRENT_VERSION}"
      NEW_VERSION_CODE="${CLI_BUILD_NUMBER:-${CURRENT_VERSION_CODE}}"
    else
      NEW_VERSION="${NEXT_PATCH}"
      NEW_VERSION_CODE="${CLI_BUILD_NUMBER:-$((CURRENT_VERSION_CODE + 1))}"
    fi
    break
  elif [ "${VERSION_INPUT}" = "0" ]; then
    NEW_VERSION="${CURRENT_VERSION}"
    NEW_VERSION_CODE="${CLI_BUILD_NUMBER:-${CURRENT_VERSION_CODE}}"
    break
  elif [ "${VERSION_INPUT}" = "1" ]; then
    NEW_VERSION="${NEXT_PATCH}"
    NEW_VERSION_CODE="${CLI_BUILD_NUMBER:-$((CURRENT_VERSION_CODE + 1))}"
    break
  elif [ "${VERSION_INPUT}" = "2" ]; then
    NEW_VERSION="${NEXT_MINOR}"
    NEW_VERSION_CODE="${CLI_BUILD_NUMBER:-$((CURRENT_VERSION_CODE + 1))}"
    break
  else
    RAW_MANUAL="${VERSION_INPUT#v}"
    EXPLICIT_BUILD=""
    TARGET_VER="${RAW_MANUAL}"

    if [[ "${RAW_MANUAL}" =~ [:+#] ]]; then
      TARGET_VER=$(echo "${RAW_MANUAL}" | sed -E 's/[:+#].*$//')
      EXPLICIT_BUILD=$(echo "${RAW_MANUAL}" | sed -E 's/^.*[:+#]//')
    fi

    if [[ "${TARGET_VER}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
      NEW_VERSION="${TARGET_VER}"
      if [ -n "${CLI_BUILD_NUMBER:-}" ]; then
        NEW_VERSION_CODE="${CLI_BUILD_NUMBER}"
      elif [ -n "${EXPLICIT_BUILD}" ] && [[ "${EXPLICIT_BUILD}" =~ ^[0-9]+$ ]]; then
        NEW_VERSION_CODE="${EXPLICIT_BUILD}"
      else
        # Inserimento manuale: incrementa SEMPRE il numero di build rispetto alla corrente
        NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
      fi
      break
    else
      log_error "Versione '${VERSION_INPUT}' non valida. Usa il formato SemVer X.Y.Z (es. 1.2.0) o X.Y.Z:B (es. 1.2.0:4) o premi INVIO per default (+0.0.1)."
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
  RECENT_COMMITS="- Aggiornamento e miglioramenti prestazionali per Kuro Mobile."
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
- Compilazione ottimizzata per smartphone Android (sola architettura arm64-v8a)
- UI OLED touch nativa ad alte prestazioni a 60/120 FPS
- Video Player avanzato con controlli touch e supporto Picture-in-Picture
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

# shellcheck disable=SC2016
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
node -e '
  const fs = require("fs");
  const pkgPath = process.argv[1];
  const newVer = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.version = newVer;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
' "${ROOT_DIR}/package.json" "${NEW_VERSION}"

# package-lock.json (if present)
if [ -f "${ROOT_DIR}/package-lock.json" ]; then
  node -e '
    const fs = require("fs");
    const lockPath = process.argv[1];
    const newVer = process.argv[2];
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    lock.version = newVer;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = newVer;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  ' "${ROOT_DIR}/package-lock.json" "${NEW_VERSION}"
fi

# app.json
node -e '
  const fs = require("fs");
  const appPath = process.argv[1];
  const newVer = process.argv[2];
  const newCode = parseInt(process.argv[3], 10);
  const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
  app.expo.version = newVer;
  if (!app.expo.android) app.expo.android = {};
  app.expo.android.versionCode = newCode;
  fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");
' "${ROOT_DIR}/app.json" "${NEW_VERSION}" "${NEW_VERSION_CODE}"

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

if [ "${SKIP_BUILD}" -eq 1 ]; then
  log_info "Salto expo prebuild e aggiornamento build.gradle (--skip-build attivo)."
else
  if [ ! -d "${ROOT_DIR}/android" ]; then
    log_info "Directory android non presente. Esecuzione 'npx expo prebuild --platform android --no-install'..."
    npx expo prebuild --platform android --no-install
  else
    log_info "Directory android presente. Aggiornamento configurazione nativa con 'npx expo prebuild --platform android --no-clean --no-install'..."
    npx expo prebuild --platform android --no-clean --no-install
  fi

  # Explicitly ensure android/app/build.gradle contains the exact version and versionCode from app.json
  # shellcheck disable=SC2016
  node -e '
    const fs = require("fs");
    const gradlePath = process.argv[1];
    const targetCode = process.argv[2];
    const targetName = process.argv[3];
    if (fs.existsSync(gradlePath)) {
      let content = fs.readFileSync(gradlePath, "utf8");
      content = content.replace(/versionCode\s+\d+/, "versionCode " + targetCode);
      content = content.replace(/versionName\s+["\x27][^"\x27]+["\x27]/, "versionName \"" + targetName + "\"");
      fs.writeFileSync(gradlePath, content);

      const verified = fs.readFileSync(gradlePath, "utf8");
      const vCodeMatch = verified.match(/versionCode\s+(\d+)/);
      const vNameMatch = verified.match(/versionName\s+["\x27]([^"\x27]+)["\x27]/);
      if (!vCodeMatch || vCodeMatch[1] !== targetCode || !vNameMatch || vNameMatch[1] !== targetName) {
        console.error("ERRORE: Allineamento versionCode / versionName in android/app/build.gradle non riuscito!");
        process.exit(1);
      }
    }
  ' "${ROOT_DIR}/android/app/build.gradle" "${APP_JSON_VERSION_CODE}" "${APP_JSON_VERSION}"
fi

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

# Ensure reactNativeArchitectures is locked to arm64-v8a for modern smartphone builds
GRADLE_PROPERTIES_FILE="${ROOT_DIR}/android/gradle.properties"
if [ -f "${GRADLE_PROPERTIES_FILE}" ]; then
  if grep -q -E "^[[:space:]]*reactNativeArchitectures=" "${GRADLE_PROPERTIES_FILE}"; then
    sed -i -E 's/^[[:space:]]*reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' "${GRADLE_PROPERTIES_FILE}"
  else
    echo "reactNativeArchitectures=arm64-v8a" >> "${GRADLE_PROPERTIES_FILE}"
  fi
  log_info "Architettura impostata su arm64-v8a in android/gradle.properties."
fi

APK_OUTPUT_DIR="${ROOT_DIR}/android/app/build/outputs/apk/release"

if [ "${SKIP_BUILD}" -eq 1 ]; then
  log_info "Compilazione Gradle ignorata (--skip-build attivo). Ricerca APK esistente in ${APK_OUTPUT_DIR}..."
else
  # Clean previous release APK outputs to avoid stale artifact reuse
  rm -f "${APK_OUTPUT_DIR}"/*.apk
  rm -f "${APK_OUTPUT_DIR}/output-metadata.json"

  cd "${ROOT_DIR}/android"
  chmod +x ./gradlew 2>/dev/null || true
  log_info "Esecuzione Gradle assembleRelease (sola architettura arm64-v8a) con dati da app.json (v${APP_JSON_VERSION}, build ${APP_JSON_VERSION_CODE})..."
  ./gradlew assembleRelease \
    -PversionCode="${APP_JSON_VERSION_CODE}" \
    -PversionName="${APP_JSON_VERSION}" \
    -PreactNativeArchitectures=arm64-v8a \
    --no-daemon
  cd "${ROOT_DIR}"
fi

# Locate arm64-v8a release APK
ARM64_APK=""
if [ -f "${APK_OUTPUT_DIR}/app-arm64-v8a-release.apk" ]; then
  ARM64_APK="${APK_OUTPUT_DIR}/app-arm64-v8a-release.apk"
elif [ -f "${APK_OUTPUT_DIR}/app-release.apk" ]; then
  ARM64_APK="${APK_OUTPUT_DIR}/app-release.apk"
elif [ -f "${APK_OUTPUT_DIR}/app-universal-release.apk" ]; then
  ARM64_APK="${APK_OUTPUT_DIR}/app-universal-release.apk"
fi

if [ -z "${ARM64_APK}" ] || [ ! -f "${ARM64_APK}" ]; then
  log_error "APK Release arm64-v8a non trovato in ${APK_OUTPUT_DIR} (atteso: app-arm64-v8a-release.apk o app-release.apk)!"
  exit 1
fi

APK_PATH="${ARM64_APK}"
log_success "APK Release arm64-v8a: ${APK_PATH}"
APK_SIZE=$(du -h "${APK_PATH}" | awk '{print $1}')
APK_SHA256=$(sha256sum "${APK_PATH}" | awk '{print $1}')
APK_SIZE_BYTES=$(node -e 'console.log(require("fs").statSync(process.argv[1]).size)' "${APK_PATH}")
log_info "Dimensione APK arm64-v8a: ${APK_SIZE} (${APK_SIZE_BYTES} bytes)"
log_info "SHA256 APK arm64-v8a: ${APK_SHA256}"

# Verifica di integrità dell'architettura arm64-v8a tramite unzip
if command -v unzip &>/dev/null; then
  log_info "Verifica architettura nativa nell'APK..."
  if unzip -l "${APK_PATH}" "lib/*" 2>/dev/null | grep -q "lib/arm64-v8a/"; then
    log_success "Verifica architettura superata: librerie native arm64-v8a confermate nell'APK."
  else
    log_info "Nessuna libreria nativa binaria rilevata in lib/arm64-v8a/ (bundle JavaScript/Hermes)."
  fi
  if unzip -l "${APK_PATH}" "lib/*" 2>/dev/null | grep -E -q "lib/(armeabi-v7a|x86|x86_64)/"; then
    if [ "${SKIP_BUILD}" -eq 1 ]; then
      log_warn "Rilevate librerie native multi-arch nell'APK pre-esistente (--skip-build attivo). Accettato per il rilascio."
    else
      log_error "Rilevate librerie native legacy nell'APK! Compilazione arm64-v8a non pura."
      exit 1
    fi
  else
    log_success "Conferma: nessuna libreria legacy (armeabi-v7a, x86, x86_64) inclusa."
  fi
fi

# shellcheck disable=SC2034
ARM64_EXISTS=1
# shellcheck disable=SC2034
ARM64_SHA256="${APK_SHA256}"
# shellcheck disable=SC2034
ARM64_SIZE_BYTES="${APK_SIZE_BYTES}"

# ------------------------------------------------------------------------------
# Post-Build APK Metadata Verification
# ------------------------------------------------------------------------------
log_info "Verifica dei metadati di versione in tutti gli APK compilati..."
APK_VERIFIED=0

METADATA_JSON="${APK_OUTPUT_DIR}/output-metadata.json"
if [ -f "${METADATA_JSON}" ]; then
  META_CHECK_RESULT=$(node -e '
    const fs = require("fs");
    try {
      const meta = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const elements = meta.elements || [];
      if (elements.length === 0) process.exit(2);
      for (const el of elements) {
        if (String(el.versionCode) !== process.argv[2] || el.versionName !== process.argv[3]) {
          console.error("Discrepanza metadati: " + JSON.stringify(el));
          process.exit(1);
        }
      }
      console.log("OK " + elements.length);
    } catch (e) {
      process.exit(3);
    }
  ' "${METADATA_JSON}" "${APP_JSON_VERSION_CODE}" "${APP_JSON_VERSION}" 2>/dev/null || echo "FAILED")

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
ensure_manifest() {
  log_info "Generazione/Sincronizzazione manifest.json per Cloudflare R2..."

  MANIFEST_FILE="${ROOT_DIR}/dist/manifest.json"
  mkdir -p "${ROOT_DIR}/dist"
  mkdir -p "${APK_OUTPUT_DIR}"

  local notes_content=""
  if [ -n "${TMP_NOTES:-}" ] && [ -f "${TMP_NOTES}" ]; then
    notes_content=$(cat "${TMP_NOTES}")
  fi
  if [ -z "${notes_content}" ]; then
    notes_content="Aggiornamento Kuro Mobile v${APP_JSON_VERSION} (Build ${APP_JSON_VERSION_CODE})"
  fi

  # shellcheck disable=SC2016
  node -e '
    const fs = require("fs");
    const [manifestPath, backupPath, notes, version, vCode, workerUrl, sha256, sizeBytes, isoDate] = process.argv.slice(1);
    const workerBase = workerUrl.replace(/\/+$/, "");
    const apks = {
      "arm64-v8a": {
        url: `${workerBase}/mobile/latest.apk`,
        sha256: sha256,
        size: parseInt(sizeBytes, 10)
      },
      universal: {
        url: `${workerBase}/mobile/latest.apk`,
        sha256: sha256,
        size: parseInt(sizeBytes, 10)
      }
    };
    const manifest = {
      version: version,
      versionCode: parseInt(vCode, 10),
      apkUrl: `${workerBase}/mobile/latest.apk`,
      apks,
      releaseNotes: (notes || "").trim(),
      sha256: sha256,
      mandatory: false,
      publishedAt: isoDate
    };
    const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
    fs.writeFileSync(manifestPath, manifestJson);
    if (backupPath) {
      try { fs.writeFileSync(backupPath, manifestJson); } catch {}
    }
  ' "${MANIFEST_FILE}" "${APK_OUTPUT_DIR}/manifest.json" "${notes_content}" "${APP_JSON_VERSION}" "${APP_JSON_VERSION_CODE}" "${OTA_WORKER_URL}" "${APK_SHA256}" "${APK_SIZE_BYTES}" "${ISO_DATE}"

  log_success "Manifest Cloudflare R2 generato in: ${MANIFEST_FILE}"
}

ensure_manifest
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

  log_info "Caricamento APK arm64-v8a (${APK_SIZE}) su GitHub Release con barra di progresso in tempo reale..."
  VERSIONED_ARM64_NAME="kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-arm64-v8a.apk"
  if [ -f "${SCRIPTS_DIR}/upload-github-release.mjs" ]; then
    node "${SCRIPTS_DIR}/upload-github-release.mjs" "${TAG_NAME}" "${APK_PATH}" "app-release.apk" "application/vnd.android.package-archive"
    node "${SCRIPTS_DIR}/upload-github-release.mjs" "${TAG_NAME}" "${APK_PATH}" "${VERSIONED_ARM64_NAME}" "application/vnd.android.package-archive"
    log_success "GitHub Release pubblicata e APK arm64-v8a caricato con successo!"
  else
    log_info "Upload fallback tramite gh release upload..."
    TEMP_VERSIONED_APK="${APK_OUTPUT_DIR}/${VERSIONED_ARM64_NAME}"
    cp -f "${APK_PATH}" "${TEMP_VERSIONED_APK}"
    gh release upload "${TAG_NAME}" "${APK_PATH}" --clobber
    gh release upload "${TAG_NAME}" "${TEMP_VERSIONED_APK}" --clobber
    rm -f "${TEMP_VERSIONED_APK}"
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
    log_info "Upload su bucket privato R2 (${R2_PRIVATE_BUCKET_NAME}) per Worker kuro-tv sotto 'mobile/' (sovrascrittura del solo latest.apk)..."

    # Pre-upload check: se dist/manifest.json è stato rimosso (ad es. da un expo export o clean), ripristinalo o rigeneralo
    if [ ! -f "${MANIFEST_FILE}" ]; then
      if [ -f "${APK_OUTPUT_DIR}/manifest.json" ]; then
        log_warn "File ${MANIFEST_FILE} non trovato. Ripristino da ${APK_OUTPUT_DIR}/manifest.json..."
        mkdir -p "${ROOT_DIR}/dist"
        cp -f "${APK_OUTPUT_DIR}/manifest.json" "${MANIFEST_FILE}"
      else
        log_warn "File ${MANIFEST_FILE} non trovato. Rigenerazione in corso..."
        ensure_manifest
      fi
    fi

    if [ -f "${SCRIPTS_DIR}/upload-r2.mjs" ]; then
      # Singolo APK per smartphone arm64-v8a: sovrascrive sempre mobile/latest.apk
      node "${SCRIPTS_DIR}/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest.apk" "${APK_PATH}" "application/vnd.android.package-archive" || {
        log_warn "Upload APK con upload-r2.mjs non riuscito. Fallback su Cloudflare Wrangler..."
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
      }

      # Manifest for private bucket worker (sovrascrive sempre mobile/manifest.json)
      node "${SCRIPTS_DIR}/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/manifest.json" "${MANIFEST_FILE}" "application/json" || {
        log_warn "Upload manifest con upload-r2.mjs non riuscito. Fallback su Cloudflare Wrangler..."
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
      }
      log_success "File mobile/ (latest.apk e manifest.json) caricati su bucket privato (${R2_PRIVATE_BUCKET_NAME}) con successo!"
    else
      log_info "Upload su bucket privato R2 (${R2_PRIVATE_BUCKET_NAME}) tramite Wrangler..."
      npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
      npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
      log_success "File mobile/ (latest.apk e manifest.json) caricati su bucket privato (${R2_PRIVATE_BUCKET_NAME}) con Wrangler!"
    fi
  fi

  # Prune automatico di eventuali file versionati legacy rimasti nello storage R2
  if [ -f "${SCRIPTS_DIR}/clean-r2-old-versions.mjs" ]; then
    log_info "Verifica e pulizia automatica di vecchie versioni archiviate su R2 per risparmiare spazio..."
    node "${SCRIPTS_DIR}/clean-r2-old-versions.mjs" --yes || true
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
  if [ -f "${SCRIPTS_DIR}/backup-secrets-r2.sh" ]; then
    bash "${SCRIPTS_DIR}/backup-secrets-r2.sh"
  else
    log_warn "Script backup-secrets-r2.sh non trovato."
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
echo " - Architettura Target: arm64-v8a (Smartphone Android)"
echo " - APK: ${APK_PATH} (${APK_SIZE})"
echo " - SHA256: ${APK_SHA256}"
echo " - Worker kuro-tv Manifest: ${OTA_WORKER_URL}/mobile/manifest.json"
echo " - Worker kuro-tv APK: ${OTA_WORKER_URL}/mobile/latest.apk"
echo ""
}

main "$@"
exit $?
