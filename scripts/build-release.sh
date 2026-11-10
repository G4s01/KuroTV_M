#!/usr/bin/env bash
# ==============================================================================
# Kuro Mobile - Automated Release & Cloudflare R2 OTA Pipeline
# ==============================================================================
# Handles:
#   SemVer bump → Gradle build → SHA256 + manifest → R2 upload → Git + GitHub Release
# ==============================================================================

set -euo pipefail

# ── ANSI Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Project Root Resolution ──────────────────────────────────────────────────
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

SCRIPTS_DIR="${ROOT_DIR}/scripts"
if [ ! -d "${SCRIPTS_DIR}" ] && [ -d "${ROOT_DIR}/.scripts" ]; then
  SCRIPTS_DIR="${ROOT_DIR}/.scripts"
elif [ ! -d "${SCRIPTS_DIR}" ]; then
  SCRIPTS_DIR="${ROOT_DIR}"
fi

# ── Logging Helpers ──────────────────────────────────────────────────────────
_step=0
step() {
  _step=$((_step + 1))
  echo ""
  echo -e "${PURPLE}${BOLD}── ${_step}. $1 ──${NC}"
}

log() {
  echo -e "   ${DIM}›${NC} $1"
}

ok() {
  echo -e "   ${GREEN}✓${NC} $1"
}

warn() {
  echo -e "   ${YELLOW}⚠${NC} $1"
}

err() {
  echo -e "   ${RED}✗${NC} $1"
}

banner() {
  echo ""
  echo -e "${PURPLE}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PURPLE}${BOLD}║           Kuro Mobile Release Tool (arm64-v8a)                   ║${NC}"
  echo -e "${PURPLE}${BOLD}║        OTA In-App Updater & Cloudflare R2 (/mobile)              ║${NC}"
  echo -e "${PURPLE}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ── Prerequisite Check ───────────────────────────────────────────────────────
MISSING_PREREQS=0

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    err "Comando mancante: ${BOLD}$1${NC} ($2)"
    MISSING_PREREQS=1
  fi
}

# ==============================================================================
#  MAIN
# ==============================================================================
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

  # ── 1. Prerequisiti ────────────────────────────────────────────────────────
  step "Prerequisiti"

  MISSING_PREREQS=0
  check_cmd "git" "Necessario per il versioning del repository"
  check_cmd "node" "Node.js runtime"
  check_cmd "npm" "Node Package Manager"
  check_cmd "gh" "GitHub CLI (necessario per creare le GitHub Releases)"
  if [ "${SKIP_BUILD}" -eq 0 ]; then
    check_cmd "java" "Java Development Kit (JDK 17+ richiesto da Android Gradle)"
  fi

  # shellcheck disable=SC2034
  R2_TOOL=""
  if command -v wrangler &> /dev/null; then
    R2_TOOL="wrangler"
    ok "Cloudflare Wrangler CLI"
  elif command -v aws &> /dev/null; then
    R2_TOOL="aws"
    ok "AWS CLI (S3-compatibile)"
  elif npx --yes wrangler --version &> /dev/null; then
    # shellcheck disable=SC2034
    R2_TOOL="npx wrangler"
    ok "npx wrangler"
  else
    warn "Nessun client R2 (wrangler / aws-cli) rilevato."
  fi

  if [ "$MISSING_PREREQS" -ne 0 ]; then
    err "Prerequisiti mancanti. Risolvi le dipendenze sopra indicate e riprova."
    exit 1
  fi

  if ! gh auth status &> /dev/null; then
    warn "GitHub CLI non autenticato. Esegui ${BOLD}gh auth login${NC} prima di pubblicare."
  fi

  # ── 2. Variabili d'ambiente ────────────────────────────────────────────────
  step "Ambiente"

  if [ -f "${ROOT_DIR}/.env.local" ]; then
    log "Caricamento credenziali da .env.local"
    set -a
    # shellcheck source=/dev/null
    source "${ROOT_DIR}/.env.local"
    set +a
  elif [ -f "${ROOT_DIR}/.env" ]; then
    log "Caricamento credenziali da .env"
    set -a
    # shellcheck source=/dev/null
    source "${ROOT_DIR}/.env"
    set +a
  else
    warn "Nessun file .env.local o .env trovato."
  fi

  R2_PRIVATE_BUCKET_NAME="${R2_PRIVATE_BUCKET_NAME:-kuro-tv}"
  OTA_WORKER_URL="${OTA_WORKER_URL:-https://kuro-tv.g4s01.workers.dev}"
  OTA_SECRET_TOKEN="${OTA_SECRET_TOKEN:-${KURO_TV_SECRET_TOKEN:-}}"

  log "Bucket R2: ${BOLD}${R2_PRIVATE_BUCKET_NAME}${NC}"
  log "Worker URL: ${BOLD}${OTA_WORKER_URL}${NC}"

  # ── 3. Versioning ─────────────────────────────────────────────────────────
  step "Versioning"

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

  log "Corrente: ${BOLD}v${CURRENT_VERSION}${NC} (build ${CURRENT_VERSION_CODE})"

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
    echo -e "   ${BOLD}Modalità --skip-build (riutilizzo APK esistente):${NC}"
    echo "     0) Mantieni v${CURRENT_VERSION} → v${CURRENT_VERSION} (Build ${CURRENT_VERSION_CODE}) [Default]"
    echo "     1) +0.0.1   → v${NEXT_PATCH} (Build $((CURRENT_VERSION_CODE + 1)))"
    echo "     2) +0.1.0   → v${NEXT_MINOR} (Build $((CURRENT_VERSION_CODE + 1)))"
  else
    echo -e "   ${BOLD}Seleziona la nuova versione:${NC}"
    echo "     0) Mantieni v${CURRENT_VERSION} → v${CURRENT_VERSION} (Build ${CURRENT_VERSION_CODE})"
    echo "     1) +0.0.1   → v${NEXT_PATCH} (Build $((CURRENT_VERSION_CODE + 1))) [Default]"
    echo "     2) +0.1.0   → v${NEXT_MINOR} (Build $((CURRENT_VERSION_CODE + 1)))"
  fi
  echo "     Oppure digita versione manuale (es. 1.2.0 o 1.2.0:4)"
  echo ""

  NEW_VERSION=""
  NEW_VERSION_CODE=""
  while true; do
    if [ -n "${CLI_VERSION:-}" ]; then
      VERSION_INPUT="${CLI_VERSION}"
      CLI_VERSION="" # consumata
    elif [ "${SKIP_BUILD}" -eq 1 ]; then
      read -rp "   Scelta [INVIO=0 / 1 / 2 / manuale]: " VERSION_INPUT || true
    else
      read -rp "   Scelta [INVIO=1 / 0 / 2 / manuale]: " VERSION_INPUT || true
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
          NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
        fi
        break
      else
        err "Versione '${VERSION_INPUT}' non valida. Formato: X.Y.Z o X.Y.Z:B"
      fi
    fi
  done

  ok "Release: ${BOLD}v${NEW_VERSION}${NC} (versionCode: ${NEW_VERSION_CODE})"

  # ── 4. Note di rilascio ────────────────────────────────────────────────────
  step "Note di rilascio"

  LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
  RECENT_COMMITS=""
  if [ -n "${LAST_TAG}" ]; then
    RECENT_COMMITS=$(git log "${LAST_TAG}"..HEAD --pretty=format:"- %s" 2>/dev/null || echo "")
  else
    RECENT_COMMITS=$(git log -n 10 --pretty=format:"- %s" 2>/dev/null || echo "")
  fi
  [ -z "${RECENT_COMMITS}" ] && RECENT_COMMITS="- Aggiornamento e miglioramenti prestazionali per Kuro Mobile."

  RELEASE_DATE=$(date "+%Y-%m-%d")
  ISO_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  TMP_NOTES=$(mktemp)
  trap 'rm -f "${TMP_NOTES}"' EXIT

  echo -e "   ${BOLD}Opzioni:${NC}"
  echo "     [INVIO]  Solo versione e data (## [${NEW_VERSION}] - ${RELEASE_DATE})"
  echo "     'n'      Apri editor per modificare le note con i commit recenti"
  echo "     <testo>  Inserisci direttamente le note"
  echo ""

  read -rp "   Note di rilascio [INVIO / n / testo]: " NOTES_INPUT || true
  NOTES_TRIMMED="$(echo -e "${NOTES_INPUT:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if [ -z "${NOTES_TRIMMED}" ]; then
    cat <<EOF > "${TMP_NOTES}"
## [${NEW_VERSION}] - ${RELEASE_DATE}
EOF
    ok "Note: solo header versione."
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
    ok "Note inserite da console."
  fi

  RELEASE_NOTES=$(cat "${TMP_NOTES}")
  if [ -z "${RELEASE_NOTES// /}" ]; then
    RELEASE_NOTES="## [${NEW_VERSION}] - ${RELEASE_DATE}"
  fi

  # Aggiornamento CHANGELOG.md
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
      const match = content.match(/\n##\s+\[/);
      if (match && typeof match.index === "number") {
        content = content.slice(0, match.index) + "\n\n" + notes + "\n\n" + content.slice(match.index + 1);
      } else {
        content = content.trimEnd() + "\n\n" + notes + "\n";
      }
    }
    content = content.replace(/\n{3,}/g, "\n\n").trim() + "\n";
    fs.writeFileSync(changelogPath, content);
  ' "${CHANGELOG_FILE}" "${TMP_NOTES}" "${NEW_VERSION}"

  ok "CHANGELOG.md aggiornato."

  # ── 5. Version Bump ────────────────────────────────────────────────────────
  step "Version Bump"

  # package.json
  node -e '
    const fs = require("fs");
    const pkgPath = process.argv[1];
    const newVer = process.argv[2];
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.version = newVer;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  ' "${ROOT_DIR}/package.json" "${NEW_VERSION}"

  # package-lock.json
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

  ok "v${NEW_VERSION} (build ${NEW_VERSION_CODE}) scritto in package.json e app.json."

  # ── 6. Build Android ───────────────────────────────────────────────────────
  step "Build Android"

  APP_JSON_VERSION=$(node -p "try { require('./app.json').expo.version } catch { '' }")
  APP_JSON_VERSION_CODE=$(node -p "try { require('./app.json').expo.android.versionCode } catch { '' }")

  if [ -z "${APP_JSON_VERSION}" ] || [ -z "${APP_JSON_VERSION_CODE}" ]; then
    err "Impossibile leggere version/versionCode da app.json!"
    exit 1
  fi

  if [ "${SKIP_BUILD}" -eq 1 ]; then
    log "Compilazione saltata (--skip-build)"
  else
    # Expo prebuild
    if [ ! -d "${ROOT_DIR}/android" ]; then
      log "Directory android non presente → expo prebuild..."
      npx expo prebuild --platform android --no-install
    else
      log "Aggiornamento configurazione nativa → expo prebuild --no-clean..."
      npx expo prebuild --platform android --no-clean --no-install
    fi

    # Allineamento build.gradle
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

  # Keystore
  if [ -f "${ROOT_DIR}/credentials/kurotv-mobile-release.keystore" ]; then
    mkdir -p "${ROOT_DIR}/android/app"
    cp -f "${ROOT_DIR}/credentials/kurotv-mobile-release.keystore" "${ROOT_DIR}/android/app/release.keystore"
    log "Keystore mobile sincronizzata."
  elif [ -f "${ROOT_DIR}/credentials/kurotv-release.keystore" ]; then
    mkdir -p "${ROOT_DIR}/android/app"
    cp -f "${ROOT_DIR}/credentials/kurotv-release.keystore" "${ROOT_DIR}/android/app/release.keystore"
    log "Keystore permanente sincronizzata."
  fi

  # Lock arm64-v8a
  GRADLE_PROPERTIES_FILE="${ROOT_DIR}/android/gradle.properties"
  if [ -f "${GRADLE_PROPERTIES_FILE}" ]; then
    if grep -q -E "^[[:space:]]*reactNativeArchitectures=" "${GRADLE_PROPERTIES_FILE}"; then
      sed -i -E 's/^[[:space:]]*reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' "${GRADLE_PROPERTIES_FILE}"
    else
      echo "reactNativeArchitectures=arm64-v8a" >> "${GRADLE_PROPERTIES_FILE}"
    fi
  fi

  APK_OUTPUT_DIR="${ROOT_DIR}/android/app/build/outputs/apk/release"

  if [ "${SKIP_BUILD}" -eq 1 ]; then
    log "Ricerca APK esistente in output dir..."
  else
    # Clean stale APK
    rm -f "${APK_OUTPUT_DIR}"/*.apk
    rm -f "${APK_OUTPUT_DIR}/output-metadata.json"

    cd "${ROOT_DIR}/android"
    chmod +x ./gradlew 2>/dev/null || true
    log "Gradle assembleRelease (arm64-v8a, v${APP_JSON_VERSION} build ${APP_JSON_VERSION_CODE})..."
    ./gradlew assembleRelease \
      -PversionCode="${APP_JSON_VERSION_CODE}" \
      -PversionName="${APP_JSON_VERSION}" \
      -PreactNativeArchitectures=arm64-v8a \
      --no-daemon
    cd "${ROOT_DIR}"
  fi

  # Locate APK
  ARM64_APK=""
  if [ -f "${APK_OUTPUT_DIR}/app-arm64-v8a-release.apk" ]; then
    ARM64_APK="${APK_OUTPUT_DIR}/app-arm64-v8a-release.apk"
  elif [ -f "${APK_OUTPUT_DIR}/app-release.apk" ]; then
    ARM64_APK="${APK_OUTPUT_DIR}/app-release.apk"
  elif [ -f "${APK_OUTPUT_DIR}/app-universal-release.apk" ]; then
    ARM64_APK="${APK_OUTPUT_DIR}/app-universal-release.apk"
  fi

  if [ -z "${ARM64_APK}" ] || [ ! -f "${ARM64_APK}" ]; then
    err "APK arm64-v8a non trovato in ${APK_OUTPUT_DIR}!"
    exit 1
  fi

  APK_PATH="${ARM64_APK}"
  APK_SIZE=$(du -h "${APK_PATH}" | awk '{print $1}')
  APK_SHA256=$(sha256sum "${APK_PATH}" | awk '{print $1}')
  APK_SIZE_BYTES=$(node -e 'console.log(require("fs").statSync(process.argv[1]).size)' "${APK_PATH}")

  ok "APK: ${APK_SIZE} — SHA256: ${DIM}${APK_SHA256:0:16}…${NC}"

  # Verifica architettura
  if command -v unzip &>/dev/null; then
    if unzip -l "${APK_PATH}" "lib/*" 2>/dev/null | grep -q "lib/arm64-v8a/"; then
      ok "Librerie native arm64-v8a confermate."
    fi
    if unzip -l "${APK_PATH}" "lib/*" 2>/dev/null | grep -E -q "lib/(armeabi-v7a|x86|x86_64)/"; then
      if [ "${SKIP_BUILD}" -eq 1 ]; then
        warn "Librerie multi-arch nell'APK pre-esistente (--skip-build). Accettato."
      else
        err "Librerie legacy nell'APK! Build arm64-v8a non pura."
        exit 1
      fi
    fi
  fi

  # shellcheck disable=SC2034
  ARM64_EXISTS=1
  # shellcheck disable=SC2034
  ARM64_SHA256="${APK_SHA256}"
  # shellcheck disable=SC2034
  ARM64_SIZE_BYTES="${APK_SIZE_BYTES}"

  # ── 7. Verifica metadati APK ───────────────────────────────────────────────
  step "Verifica metadati"

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
      ok "output-metadata.json: ${SPLIT_COUNT} varianti, v${APP_JSON_VERSION} (code ${APP_JSON_VERSION_CODE})."
      APK_VERIFIED=1
    else
      err "Discrepanza in output-metadata.json! Atteso: v${APP_JSON_VERSION} (code ${APP_JSON_VERSION_CODE})"
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
        ok "aapt badging: v${AAPT_VNAME} (code ${AAPT_VCODE})."
        APK_VERIFIED=1
      else
        err "Discrepanza aapt! Atteso: v${APP_JSON_VERSION} (code ${APP_JSON_VERSION_CODE}), trovato: v${AAPT_VNAME} (code ${AAPT_VCODE})"
        exit 1
      fi
    fi
  fi

  if [ "${APK_VERIFIED}" -eq 0 ]; then
    warn "Verifica metadati binari non disponibile (né output-metadata.json né aapt)."
  fi

  # ── 8. Manifest R2 ────────────────────────────────────────────────────────
  step "Manifest Cloudflare R2"

  ensure_manifest() {
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

    ok "Manifest generato: ${DIM}${MANIFEST_FILE}${NC}"
  }

  ensure_manifest

  # ── 9. Git commit & tag ────────────────────────────────────────────────────
  step "Git commit & tag"

  git add -A

  if git diff --staged --quiet; then
    log "Nessuna modifica da committare."
  else
    git commit -m "chore(release): v${APP_JSON_VERSION} [build ${APP_JSON_VERSION_CODE}]"
    ok "Commit: chore(release): v${APP_JSON_VERSION} [build ${APP_JSON_VERSION_CODE}]"
  fi

  TAG_NAME="v${APP_JSON_VERSION}"
  if git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
    CURRENT_TAG_TARGET=$(git rev-parse "${TAG_NAME}^{commit}" 2>/dev/null || echo "")
    HEAD_TARGET=$(git rev-parse HEAD)
    if [ "${CURRENT_TAG_TARGET}" != "${HEAD_TARGET}" ]; then
      git tag -f -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
      ok "Tag ${TAG_NAME} aggiornato a HEAD."
    else
      log "Tag ${TAG_NAME} già su HEAD."
    fi
  else
    git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
    ok "Tag ${TAG_NAME} creato."
  fi

  # ── 10. GitHub Release ─────────────────────────────────────────────────────
  step "GitHub Release"

  VERSIONED_APK_NAME="kurotv-v${APP_JSON_VERSION}-${APP_JSON_VERSION_CODE}-arm64-v8a.apk"

  GH_CONFIRM="y"
  read -rp "   Pubblicare su GitHub? [Y/n]: " GH_CONFIRM || true
  GH_CONFIRM="${GH_CONFIRM:-y}"

  if [[ "${GH_CONFIRM}" =~ ^[Yy]$ ]]; then
    # Commit residui pre-push
    if [ -n "$(git status --porcelain)" ]; then
      log "Modifiche residue rilevate → commit aggiuntivo..."
      git add -A
      git commit -m "chore(release): v${APP_JSON_VERSION} [build ${APP_JSON_VERSION_CODE}]" || true
      git tag -f -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
    fi

    # Push branch
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [ -z "${CURRENT_BRANCH}" ] || [ "${CURRENT_BRANCH}" = "HEAD" ]; then
      CURRENT_BRANCH="master"
    fi

    log "Push ${BOLD}${CURRENT_BRANCH}${NC} → origin..."
    if ! git push origin "${CURRENT_BRANCH}" --progress; then
      if ! git push origin "HEAD:${CURRENT_BRANCH}" --progress; then
        err "Push fallito su origin/${CURRENT_BRANCH}!"
        exit 1
      fi
    fi

    # Push tag
    log "Push tag ${TAG_NAME}..."
    if ! git push origin "refs/tags/${TAG_NAME}:refs/tags/${TAG_NAME}" --force --progress; then
      err "Push tag ${TAG_NAME} fallito!"
      exit 1
    fi
    ok "Branch e tag sincronizzati su GitHub."

    # Creazione / aggiornamento release
    log "Creazione/aggiornamento release ${TAG_NAME}..."
    if ! gh release view "${TAG_NAME}" &>/dev/null; then
      gh release create "${TAG_NAME}" \
        --title "KuroTV ${TAG_NAME}" \
        --notes-file "${TMP_NOTES}"
      ok "Release ${TAG_NAME} creata."
    else
      gh release edit "${TAG_NAME}" \
        --title "KuroTV ${TAG_NAME}" \
        --notes-file "${TMP_NOTES}"
      ok "Release ${TAG_NAME} aggiornata."
    fi

    # Pulizia TUTTI i vecchi asset APK (inclusi eventuali app-release.apk legacy)
    log "Pulizia vecchi asset APK..."
    EXISTING_ASSETS=$(gh release view "${TAG_NAME}" --json assets -q '.assets[].name' 2>/dev/null || echo "")
    for OLD_ASSET in ${EXISTING_ASSETS}; do
      if [[ "${OLD_ASSET}" =~ \.apk$ ]] && [ "${OLD_ASSET}" != "${VERSIONED_APK_NAME}" ]; then
        warn "Rimozione asset obsoleto: ${OLD_ASSET}"
        gh release delete-asset "${TAG_NAME}" "${OLD_ASSET}" --yes 2>/dev/null || true
      fi
    done

    # Upload singolo APK con nome versionato
    log "Upload ${BOLD}${VERSIONED_APK_NAME}${NC} (${APK_SIZE})..."
    if [ -f "${SCRIPTS_DIR}/upload-github-release.mjs" ]; then
      node "${SCRIPTS_DIR}/upload-github-release.mjs" "${TAG_NAME}" "${APK_PATH}" "${VERSIONED_APK_NAME}" "application/vnd.android.package-archive"
    else
      TEMP_VERSIONED_APK="${APK_OUTPUT_DIR}/${VERSIONED_APK_NAME}"
      cp -f "${APK_PATH}" "${TEMP_VERSIONED_APK}"
      gh release upload "${TAG_NAME}" "${TEMP_VERSIONED_APK}" --clobber
      rm -f "${TEMP_VERSIONED_APK}"
    fi
    ok "GitHub Release ${TAG_NAME} pubblicata con APK ${VERSIONED_APK_NAME}."
  else
    log "Pubblicazione GitHub ignorata."
  fi

  # ── 11. Cloudflare R2 OTA ──────────────────────────────────────────────────
  step "Cloudflare R2 OTA"

  R2_CONFIRM="y"
  read -rp "   Caricare OTA su Cloudflare R2? [Y/n]: " R2_CONFIRM || true
  R2_CONFIRM="${R2_CONFIRM:-y}"

  if [[ "${R2_CONFIRM}" =~ ^[Yy]$ ]]; then
    if [ -n "${R2_PRIVATE_BUCKET_NAME:-}" ]; then
      log "Upload su ${BOLD}${R2_PRIVATE_BUCKET_NAME}${NC}/mobile/ ..."

      # Ripristino manifest se necessario
      if [ ! -f "${MANIFEST_FILE}" ]; then
        if [ -f "${APK_OUTPUT_DIR}/manifest.json" ]; then
          mkdir -p "${ROOT_DIR}/dist"
          cp -f "${APK_OUTPUT_DIR}/manifest.json" "${MANIFEST_FILE}"
        else
          ensure_manifest
        fi
      fi

      if [ -f "${SCRIPTS_DIR}/upload-r2.mjs" ]; then
        node "${SCRIPTS_DIR}/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/latest.apk" "${APK_PATH}" "application/vnd.android.package-archive" || {
          warn "Fallback su Wrangler per APK..."
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
        }

        node "${SCRIPTS_DIR}/upload-r2.mjs" "${R2_PRIVATE_BUCKET_NAME}" "mobile/manifest.json" "${MANIFEST_FILE}" "application/json" || {
          warn "Fallback su Wrangler per manifest..."
          npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
        }
      else
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/latest.apk" --file="${APK_PATH}" --content-type="application/vnd.android.package-archive" --remote
        npm --prefix "${ROOT_DIR}/workers/kuro-tv" exec -- wrangler r2 object put "${R2_PRIVATE_BUCKET_NAME}/mobile/manifest.json" --file="${MANIFEST_FILE}" --content-type="application/json" --remote
      fi
      ok "latest.apk e manifest.json caricati su R2."
    fi

    # Prune vecchie versioni
    if [ -f "${SCRIPTS_DIR}/clean-r2-old-versions.mjs" ]; then
      log "Pulizia vecchie versioni su R2..."
      node "${SCRIPTS_DIR}/clean-r2-old-versions.mjs" --yes || true
    fi
  else
    log "Upload R2 ignorato."
  fi

  # ── 12. Backup Cloud ───────────────────────────────────────────────────────
  step "Backup Cloud"

  BACKUP_CONFIRM="n"
  read -rp "   Backup cifrato di firma, password e .env su R2? [y/N]: " BACKUP_CONFIRM || true
  if [[ "${BACKUP_CONFIRM:-n}" =~ ^[Yy]$ ]]; then
    if [ -f "${SCRIPTS_DIR}/backup-secrets-r2.sh" ]; then
      bash "${SCRIPTS_DIR}/backup-secrets-r2.sh"
    else
      warn "Script backup-secrets-r2.sh non trovato."
    fi
  else
    log "Backup ignorato."
  fi

  # ── Riepilogo finale ───────────────────────────────────────────────────────
  echo ""
  echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║  ✓ Release v${APP_JSON_VERSION} (Build ${APP_JSON_VERSION_CODE}) completata!$(printf '%*s' $((34 - ${#APP_JSON_VERSION} - ${#APP_JSON_VERSION_CODE})) '')║${NC}"
  echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "   ${BOLD}Architettura:${NC}  arm64-v8a"
  echo -e "   ${BOLD}APK:${NC}           ${APK_PATH} (${APK_SIZE})"
  echo -e "   ${BOLD}SHA256:${NC}        ${APK_SHA256}"
  echo -e "   ${BOLD}Manifest:${NC}      ${OTA_WORKER_URL}/mobile/manifest.json"
  echo -e "   ${BOLD}Download:${NC}      ${OTA_WORKER_URL}/mobile/latest.apk"
  echo ""
}

main "$@"
exit $?
