#!/usr/bin/env bash
# ==============================================================================
# KuroTV - Secure Cloudflare R2 Secrets & Keystore Backup Tool
# ==============================================================================
# Backs up:
# 1. Android Release Keystore (credentials/kurotv-release.keystore)
# 2. Signing credentials & passwords (signing-credentials.txt)
# 3. Environment configuration (.env.local / .env)
#
# Security & Worker Isolation Architecture:
# - Zero-Knowledge Client-Side AES-256-CBC Encryption (via OpenSSL PBKDF2).
# - Dedicated private backup bucket (R2_BACKUP_BUCKET_NAME, default: kurotv-backups)
#   which is completely decoupled from the Cloudflare Worker kuro-tv (no bindings).
# - Hardened Worker guard: Even if stored in the same bucket under secure-backups/,
#   the Worker strictly rejects non-APK downloads with 403 Forbidden.
# - Real-time progress bar via scripts/upload-r2.mjs.
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
  echo "║         KuroTV - Cloudflare R2 Secure Secrets Backup Tool         ║"
  echo "║     Android Keystore, Password & .env Cloud Backup (AES-256)      ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ------------------------------------------------------------------------------
# 1. Load Environment Variables
# ------------------------------------------------------------------------------
if [ -f "${ROOT_DIR}/.env.local" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env.local"
  set +a
elif [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
fi

# Configuration & Defaults
# Dedicated backup bucket isolated from the Worker releases bucket
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET_NAME:-${R2_PRIVATE_BUCKET_NAME:-kuro-tv}}"
R2_BACKUP_PREFIX="secure-backups"
BACKUP_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
NON_INTERACTIVE=0
SKIP_ENCRYPTION=0
DRY_RUN=0

KEYSTORE_CLI_PASS=""
KEYSTORE_CLI_ALIAS=""

# CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)
      R2_BACKUP_BUCKET="$2"
      shift 2
      ;;
    --passphrase)
      BACKUP_PASSPHRASE="$2"
      shift 2
      ;;
    --keystore-pass)
      KEYSTORE_CLI_PASS="$2"
      shift 2
      ;;
    --alias)
      KEYSTORE_CLI_ALIAS="$2"
      shift 2
      ;;
    --no-encrypt)
      SKIP_ENCRYPTION=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --yes|-y)
      NON_INTERACTIVE=1
      shift
      ;;
    -h|--help)
      banner
      echo "Uso: ./scripts/backup-secrets-r2.sh [opzioni]"
      echo ""
      echo "Opzioni:"
      echo "  --bucket <nome>        Nome del bucket R2 di destinazione (default: R2_BACKUP_BUCKET_NAME o R2_PRIVATE_BUCKET_NAME)"
      echo "  --passphrase <testo>   Passphrase per cifratura AES-256 (default: BACKUP_ENCRYPTION_PASSPHRASE o prompt interattivo)"
      echo "  --keystore-pass <pass> Password del keystore da includere nel backup cifrato"
      echo "  --alias <alias>        Alias della chiave di firma (default: RELEASE_KEY_ALIAS o kurotv-mobile.key)"
      echo "  --no-encrypt           Disabilita la cifratura lato client (NON raccomandato)"
      echo "  --dry-run              Esegue cifratura e verifica locale senza caricare file su R2"
      echo "  -y, --yes              Esecuzione non-interattiva senza conferme"
      echo "  -h, --help             Mostra questa guida ed esce"
      echo ""
      echo "Sicurezza e Isolamento dal Worker:"
      echo "  I file cifrati vengono caricati su Cloudflare R2 con cifratura AES-256-CBC (PBKDF2, 100k iterazioni)."
      echo "  Il Worker kuro-tv rifiuta rigorosamente (403 Forbidden) qualsiasi download di file non-APK,"
      echo "  e non possiede alcun binding verso un bucket di backup dedicato (R2_BACKUP_BUCKET_NAME)."
      echo ""
      exit 0
      ;;
    *)
      log_error "Opzione sconosciuta: $1"
      exit 1
      ;;
  esac
done

banner

# ------------------------------------------------------------------------------
# 2. Verify Prerequisites
# ------------------------------------------------------------------------------
log_info "Verifica prerequisiti..."

if ! command -v openssl &>/dev/null && [ "${SKIP_ENCRYPTION}" -eq 0 ]; then
  log_error "OpenSSL non trovato. Installalo oppure usa --no-encrypt (sconsigliato)."
  exit 1
fi

if ! command -v tar &>/dev/null; then
  log_error "Utility 'tar' non trovata nel sistema."
  exit 1
fi

if [ ! -f "${ROOT_DIR}/scripts/upload-r2.mjs" ]; then
  log_error "Script di upload '${ROOT_DIR}/scripts/upload-r2.mjs' mancante."
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Locate Source Files to Back Up
# ------------------------------------------------------------------------------
KEYSTORE_PATH=""
if [ -f "${ROOT_DIR}/credentials/kurotv-mobile-release.keystore" ]; then
  KEYSTORE_PATH="${ROOT_DIR}/credentials/kurotv-mobile-release.keystore"
elif [ -f "${ROOT_DIR}/credentials/kurotv-release.keystore" ]; then
  KEYSTORE_PATH="${ROOT_DIR}/credentials/kurotv-release.keystore"
elif [ -f "${ROOT_DIR}/android/app/release.keystore" ]; then
  KEYSTORE_PATH="${ROOT_DIR}/android/app/release.keystore"
fi

if [ -z "${KEYSTORE_PATH}" ]; then
  log_error "Nessun file release.keystore trovato in credentials/ o android/app/!"
  exit 1
fi

ENV_PATH=""
if [ -f "${ROOT_DIR}/.env.local" ]; then
  ENV_PATH="${ROOT_DIR}/.env.local"
elif [ -f "${ROOT_DIR}/.env" ]; then
  ENV_PATH="${ROOT_DIR}/.env"
fi

if [ -z "${ENV_PATH}" ]; then
  log_warn "Nessun file .env o .env.local trovato nel repository."
fi

# Determine signing password (da ambiente/.env, MAI hardcoded)
KEYSTORE_STORE_PASS="${KEYSTORE_CLI_PASS:-${RELEASE_STORE_PASSWORD:-${KEYSTORE_PASSWORD:-}}}"
KEYSTORE_KEY_PASS="${KEYSTORE_CLI_PASS:-${RELEASE_KEY_PASSWORD:-${KEYSTORE_PASSWORD:-}}}"
KEYSTORE_ALIAS="${KEYSTORE_CLI_ALIAS:-${RELEASE_KEY_ALIAS:-kurotv-mobile.key}}"

if [ -z "${KEYSTORE_STORE_PASS}" ]; then
  if [ -t 0 ] && [ "${NON_INTERACTIVE}" -eq 0 ] && [ "${DRY_RUN}" -eq 0 ]; then
    read -s -rp "Inserisci la password dello store/keystore: " KEYSTORE_STORE_PASS
    echo ""
  else
    log_warn "Nessuna password keystore specificata in RELEASE_STORE_PASSWORD / KEYSTORE_PASSWORD."
  fi
fi
if [ -z "${KEYSTORE_KEY_PASS}" ] && [ -n "${KEYSTORE_STORE_PASS}" ]; then
  KEYSTORE_KEY_PASS="${KEYSTORE_STORE_PASS}"
fi

# Verify keystore password with keytool if available
KEYSTORE_SHA256="Non verificato"
if command -v keytool &>/dev/null; then
  KEYTOOL_OUT=$(keytool -list -keystore "${KEYSTORE_PATH}" -storepass "${KEYSTORE_STORE_PASS}" 2>/dev/null || echo "")
  if [ -n "${KEYTOOL_OUT}" ]; then
    EXTRACTED_SHA=$(echo "${KEYTOOL_OUT}" | grep -i "SHA-256" | head -n 1 | awk '{print $NF}' || echo "")
    if [ -n "${EXTRACTED_SHA}" ]; then
      KEYSTORE_SHA256="${EXTRACTED_SHA}"
    fi
  else
    log_warn "Attenzione: la password keystore predefinita potrebbe non corrispondere."
  fi
fi

log_success "File identificati per il backup:"
echo "  - Keystore:    ${KEYSTORE_PATH}"
echo "  - Fingerprint: ${KEYSTORE_SHA256}"
echo "  - Alias:       ${KEYSTORE_ALIAS}"
echo "  - Env file:    ${ENV_PATH:-Nessuno}"
echo "  - Bucket R2:   ${R2_BACKUP_BUCKET}"
echo ""

# ------------------------------------------------------------------------------
# 4. Interactive Encryption Passphrase Setup
# ------------------------------------------------------------------------------
if [ "${SKIP_ENCRYPTION}" -eq 0 ] && [ -z "${BACKUP_PASSPHRASE}" ]; then
  if [ "${NON_INTERACTIVE}" -eq 1 ]; then
    log_error "Modalità non-interattiva attiva ma nessuna passphrase specificata. Usa --passphrase o imposta BACKUP_ENCRYPTION_PASSPHRASE."
    exit 1
  fi

  echo -e "${BOLD}Cifratura AES-256-CBC Zero-Knowledge lato client:${NC}"
  echo "Per garantire che NESSUNO (incluso il Cloudflare Worker, chiunque trovi il bucket o Cloudflare stessa)"
  echo "possa leggere la tua chiave di firma, password o credenziali .env, il backup verrà cifrato con OpenSSL."
  echo ""

  while true; do
    read -rsp "Inserisci la passphrase di cifratura per il backup: " PASS_1
    echo ""
    read -rsp "Conferma la passphrase di cifratura: " PASS_2
    echo ""

    if [ -z "${PASS_1}" ]; then
      log_warn "La passphrase non può essere vuota. Riprova."
      continue
    fi

    if [ "${PASS_1}" != "${PASS_2}" ]; then
      log_error "Le passphrase non coincidono. Riprova."
      continue
    fi

    BACKUP_PASSPHRASE="${PASS_1}"
    break
  done
  echo ""
fi

# ------------------------------------------------------------------------------
# 5. Assemble & Encrypt Backup Archive
# ------------------------------------------------------------------------------
TMP_BACKUP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_BACKUP_DIR}"' EXIT

BACKUP_CONTENT_DIR="${TMP_BACKUP_DIR}/kurotv-backup"
mkdir -p "${BACKUP_CONTENT_DIR}"

# 1. Copy Keystore
cp -f "${KEYSTORE_PATH}" "${BACKUP_CONTENT_DIR}/kurotv-release.keystore"

# 2. Write signing-credentials.txt
cat <<EOF > "${BACKUP_CONTENT_DIR}/signing-credentials.txt"
# ==============================================================================
# KuroTV - Android Release Signing Credentials & Security Backup
# Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==============================================================================
KEYSTORE_FILENAME=kurotv-release.keystore
KEYSTORE_ALIAS=${KEYSTORE_ALIAS}
STORE_PASSWORD=${KEYSTORE_STORE_PASS}
KEY_PASSWORD=${KEYSTORE_KEY_PASS}
CERT_SHA256_FINGERPRINT=${KEYSTORE_SHA256}

# Istruzioni di compilazione locale:
# 1. Copia kurotv-mobile-release.keystore in: credentials/kurotv-mobile-release.keystore
# 2. Copia in: android/app/release.keystore
# ==============================================================================
EOF

# 3. Copy .env files (preserving both .env and .env.local if present)
if [ -f "${ROOT_DIR}/.env" ]; then
  cp -f "${ROOT_DIR}/.env" "${BACKUP_CONTENT_DIR}/.env"
fi
if [ -f "${ROOT_DIR}/.env.local" ]; then
  cp -f "${ROOT_DIR}/.env.local" "${BACKUP_CONTENT_DIR}/.env.local"
fi

# Add README with restore instructions
cat <<EOF > "${BACKUP_CONTENT_DIR}/README.md"
# KuroTV Cloud Security Backup
Creato il: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Contenuto di questo archivio:
1. \`kurotv-release.keystore\`: Chiave crittografica permanente per firmare le release APK.
2. \`signing-credentials.txt\`: Password della chiave, alias e impronta SHA-256.
3. \`.env\` / \`.env.local\`: Variabili d'ambiente, token Cloudflare e configurazione dell'app.

## Ripristino
Per ripristinare il keystore:
\`\`\`bash
cp kurotv-release.keystore credentials/kurotv-release.keystore
cp kurotv-release.keystore android/app/release.keystore
[ -f .env.local ] && cp .env.local ../.env.local || cp .env ../.env.local
\`\`\`
EOF

TIMESTAMP=$(date "+%Y%m%d_%H%M%S")
TAR_FILE="${TMP_BACKUP_DIR}/kurotv-secrets-backup-${TIMESTAMP}.tar.gz"
tar -czf "${TAR_FILE}" -C "${TMP_BACKUP_DIR}" "kurotv-backup"

# File paths & Guida in chiaro
GUIDE_PAYLOAD="${ROOT_DIR}/scripts/HOW-TO-RESTORE.txt"
REMOTE_GUIDE="${R2_BACKUP_PREFIX}/HOW-TO-RESTORE.txt"

if [ "${SKIP_ENCRYPTION}" -eq 1 ]; then
  log_warn "Creazione backup in chiaro NON cifrato su richiesta (--no-encrypt)..."
  BUNDLE_PAYLOAD="${TAR_FILE}"
  REMOTE_BUNDLE_LATEST="${R2_BACKUP_PREFIX}/kurotv-secrets-backup-latest.tar.gz"

  KEYSTORE_PAYLOAD="${KEYSTORE_PATH}"
  REMOTE_KEYSTORE="${R2_BACKUP_PREFIX}/kurotv-release.keystore"

  CREDENTIALS_PAYLOAD="${BACKUP_CONTENT_DIR}/signing-credentials.txt"
  REMOTE_CREDENTIALS="${R2_BACKUP_PREFIX}/signing-credentials.txt"

  if [ -n "${ENV_PATH}" ] && [ -f "${ENV_PATH}" ]; then
    ENV_PAYLOAD="${ENV_PATH}"
    REMOTE_ENV="${R2_BACKUP_PREFIX}/$(basename "${ENV_PATH}")"
  else
    ENV_PAYLOAD=""
    REMOTE_ENV=""
  fi
else
  log_info "Cifratura archivio e singoli componenti con AES-256-CBC (PBKDF2, 100.000 iterazioni)..."

  # 1. Encrypt Bundle
  ENC_BUNDLE="${TMP_BACKUP_DIR}/kurotv-secrets-backup-${TIMESTAMP}.tar.gz.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "${TAR_FILE}" \
    -out "${ENC_BUNDLE}" \
    -pass "pass:${BACKUP_PASSPHRASE}"
  BUNDLE_PAYLOAD="${ENC_BUNDLE}"
  REMOTE_BUNDLE_LATEST="${R2_BACKUP_PREFIX}/kurotv-secrets-backup-latest.tar.gz.enc"

  # 2. Encrypt Keystore copy
  ENC_KEYSTORE="${TMP_BACKUP_DIR}/kurotv-release.keystore.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "${KEYSTORE_PATH}" \
    -out "${ENC_KEYSTORE}" \
    -pass "pass:${BACKUP_PASSPHRASE}"
  KEYSTORE_PAYLOAD="${ENC_KEYSTORE}"
  REMOTE_KEYSTORE="${R2_BACKUP_PREFIX}/kurotv-release.keystore.enc"

  # 3. Encrypt Signing credentials copy
  ENC_CREDENTIALS="${TMP_BACKUP_DIR}/signing-credentials.txt.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
    -in "${BACKUP_CONTENT_DIR}/signing-credentials.txt" \
    -out "${ENC_CREDENTIALS}" \
    -pass "pass:${BACKUP_PASSPHRASE}"
  CREDENTIALS_PAYLOAD="${ENC_CREDENTIALS}"
  REMOTE_CREDENTIALS="${R2_BACKUP_PREFIX}/signing-credentials.txt.enc"

  # 4. Encrypt Env configuration copy
  if [ -n "${ENV_PATH}" ] && [ -f "${ENV_PATH}" ]; then
    ENC_ENV="${TMP_BACKUP_DIR}/env.enc"
    openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
      -in "${ENV_PATH}" \
      -out "${ENC_ENV}" \
      -pass "pass:${BACKUP_PASSPHRASE}"
    ENV_PAYLOAD="${ENC_ENV}"
    REMOTE_ENV="${R2_BACKUP_PREFIX}/.env.enc"
  else
    ENV_PAYLOAD=""
    REMOTE_ENV=""
  fi

  log_success "Tutti i componenti crittografati con successo."
fi

# ------------------------------------------------------------------------------
# 6. Upload to Cloudflare R2 with Real-Time Progress Bar
# ------------------------------------------------------------------------------
if [ "${DRY_RUN}" -eq 1 ]; then
  log_info "[DRY-RUN] Simulazione attiva: nessun file verrà inviato a Cloudflare R2."
  echo "Payloads pronti:"
  echo " - Keystore:    ${REMOTE_KEYSTORE} ($(du -h "${KEYSTORE_PAYLOAD}" | awk '{print $1}'))"
  echo " - Password:    ${REMOTE_CREDENTIALS} ($(du -h "${CREDENTIALS_PAYLOAD}" | awk '{print $1}'))"
  if [ -n "${REMOTE_ENV}" ]; then
    echo " - Env:         ${REMOTE_ENV} ($(du -h "${ENV_PAYLOAD}" | awk '{print $1}'))"
  fi
  echo " - Bundle:      ${REMOTE_BUNDLE_LATEST} ($(du -h "${BUNDLE_PAYLOAD}" | awk '{print $1}')) [SOVRASCRIVE L'ULTIMO]"
  if [ -f "${GUIDE_PAYLOAD}" ]; then
    echo " - Guida TXT:   ${REMOTE_GUIDE} ($(du -h "${GUIDE_PAYLOAD}" | awk '{print $1}')) [IN CHIARO]"
  fi
  log_success "[DRY-RUN] Verifica e cifratura locale completate con successo!"
  exit 0
fi

log_info "Caricamento su Cloudflare R2 (${R2_BACKUP_BUCKET}) con barra di progresso in tempo reale..."

# 1. Caricamento copia chiave di firma dell'app (.keystore.enc)
log_info "1/4 Caricamento copia chiave di firma (${REMOTE_KEYSTORE})..."
node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BACKUP_BUCKET}" "${REMOTE_KEYSTORE}" "${KEYSTORE_PAYLOAD}" "application/octet-stream"

# 2. Caricamento copia credenziali e password di firma (signing-credentials.txt.enc)
log_info "2/4 Caricamento password e credenziali di firma (${REMOTE_CREDENTIALS})..."
node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BACKUP_BUCKET}" "${REMOTE_CREDENTIALS}" "${CREDENTIALS_PAYLOAD}" "application/octet-stream"

# 3. Caricamento copia .env (.env.enc)
if [ -n "${REMOTE_ENV}" ] && [ -f "${ENV_PAYLOAD}" ]; then
  log_info "3/4 Caricamento variabili d'ambiente (${REMOTE_ENV})..."
  node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BACKUP_BUCKET}" "${REMOTE_ENV}" "${ENV_PAYLOAD}" "application/octet-stream"
fi

# 4. Caricamento bundle archivio completo (.tar.gz.enc)
log_info "4/4 Caricamento pacchetto archivio completo (${REMOTE_BUNDLE_LATEST})..."
node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BACKUP_BUCKET}" "${REMOTE_BUNDLE_LATEST}" "${BUNDLE_PAYLOAD}" "application/octet-stream"

# Guida in chiaro con istruzioni di ripristino (HOW-TO-RESTORE.txt)
if [ -f "${GUIDE_PAYLOAD}" ]; then
  log_info "Sincronizzazione guida di ripristino in chiaro (${REMOTE_GUIDE})..."
  node "${ROOT_DIR}/scripts/upload-r2.mjs" "${R2_BACKUP_BUCKET}" "${REMOTE_GUIDE}" "${GUIDE_PAYLOAD}" "text/plain; charset=utf-8"
fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} Backup Cloud di Sicurezza completato con successo! ${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Riepilogo Backup su R2:"
echo " - Bucket R2:         ${R2_BACKUP_BUCKET}"
echo " - Chiave di Firma:   ${REMOTE_KEYSTORE}"
echo " - Password Firma:    ${REMOTE_CREDENTIALS}"
echo " - Variabili .env:    ${REMOTE_ENV:-Nessuno}"
echo " - Archivio Bundle:   ${REMOTE_BUNDLE_LATEST}"
echo " - Guida TXT:         ${REMOTE_GUIDE} (in chiaro su R2)"
echo " - Cifratura:         $([ "${SKIP_ENCRYPTION}" -eq 1 ] && echo "DISATTIVATA" || echo "AES-256-CBC Zero-Knowledge (PBKDF2 100k)")"
echo " - Accesso Worker:    RIGOROSAMENTE BLOCCATO (403 Forbidden su non-APK & zero bindings su backup)"
echo ""
echo -e "${BOLD}Istruzioni di Ripristino:${NC}"
if [ "${SKIP_ENCRYPTION}" -eq 1 ]; then
  echo "Per scaricare ed estrarre il bundle completo:"
  echo "  npm --prefix workers/kuro-tv exec -- wrangler r2 object get \"${R2_BACKUP_BUCKET}/${REMOTE_BUNDLE_LATEST}\" --file=backup.tar.gz --remote"
  echo "  tar -xzf backup.tar.gz"
else
  echo "A) Ripristino dell'intero bundle in un comando:"
  echo "   npm --prefix workers/kuro-tv exec -- wrangler r2 object get \"${R2_BACKUP_BUCKET}/${REMOTE_BUNDLE_LATEST}\" --file=backup.tar.gz.enc --remote"
  echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in backup.tar.gz.enc | tar -xz"
  echo ""
  echo "B) Ripristino del solo Keystore:"
  echo "   npm --prefix workers/kuro-tv exec -- wrangler r2 object get \"${R2_BACKUP_BUCKET}/${REMOTE_KEYSTORE}\" --file=kurotv-release.keystore.enc --remote"
  echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in kurotv-release.keystore.enc -out credentials/kurotv-release.keystore"
  echo ""
  echo "C) Visualizzazione password di firma:"
  echo "   npm --prefix workers/kuro-tv exec -- wrangler r2 object get \"${R2_BACKUP_BUCKET}/${REMOTE_CREDENTIALS}\" --file=signing-credentials.txt.enc --remote"
  echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in signing-credentials.txt.enc"
  if [ -n "${REMOTE_ENV}" ]; then
    echo ""
    echo "D) Ripristino .env:"
    echo "   npm --prefix workers/kuro-tv exec -- wrangler r2 object get \"${R2_BACKUP_BUCKET}/${REMOTE_ENV}\" --file=env.enc --remote"
    echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in env.enc -out .env.local"
  fi
fi
echo ""
