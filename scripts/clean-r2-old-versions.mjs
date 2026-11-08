#!/usr/bin/env node
/**
 * KuroTV - Cloudflare R2 Storage Cleanup Tool
 *
 * Scans Cloudflare R2 buckets (private bucket 'kuro-tv' and legacy bucket 'kurotv-releases')
 * and purges legacy versioned APKs (e.g. kurotv-v*.apk) to save storage space.
 *
 * Preserves ONLY:
 * - manifest.json
 * - latest.apk
 * - latest-arm64-v8a.apk
 * - latest-armeabi-v7a.apk
 * - latest-x86_64.apk
 * - secure-backups/* (if present)
 *
 * Usage:
 *   node scripts/clean-r2-old-versions.mjs [--dry-run] [--yes] [bucket-name]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import readline from 'readline';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore read errors
  }
}

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
loadEnvFile(path.join(rootDir, '.env.local'));
loadEnvFile(path.join(rootDir, '.env'));

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoConfirm = args.includes('--yes') || args.includes('-y');
const targetBucketsFromArgs = args.filter(a => !a.startsWith('-'));

const privateBucket = process.env.R2_PRIVATE_BUCKET_NAME || 'kuro-tv';
const legacyBucket = process.env.R2_BUCKET_NAME || 'kurotv-releases';

const bucketsToClean = targetBucketsFromArgs.length > 0
  ? targetBucketsFromArgs
  : Array.from(new Set([privateBucket, legacyBucket].filter(Boolean)));

const PROTECTED_KEYS = new Set([
  'manifest.json',
  'latest.apk',
  'latest-arm64-v8a.apk',
  'latest-armeabi-v7a.apk',
  'latest-x86_64.apk',
  'mobile/manifest.json',
  'mobile/latest.apk',
  'mobile/latest-arm64-v8a.apk',
  'mobile/latest-armeabi-v7a.apk',
  'mobile/latest-x86_64.apk',
]);

function isDeletableOldVersion(key) {
  if (PROTECTED_KEYS.has(key)) return false;
  if (key.startsWith('secure-backups/') || key.startsWith('mobile/secure-backups/')) return false;

  // Stale versioned APK patterns (root or mobile/ prefix)
  if (/^mobile\/kurotv-mobile-v.*\.apk$/i.test(key)) return true;
  if (/^kurotv-v.*\.apk$/i.test(key)) return true;
  if (/^app-.*\.apk$/i.test(key)) return true;
  if (key === 'latest-universal.apk') return true;

  return false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function listBucketObjects(bucket) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT_URL || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  // Strategy 1: S3 SDK
  if (accessKeyId && secretAccessKey && endpoint) {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      });

      const items = [];
      let continuationToken = undefined;
      do {
        const cmd = new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        });
        const res = await s3.send(cmd);
        if (res.Contents) {
          for (const item of res.Contents) {
            if (item.Key) {
              items.push({ key: item.Key, size: item.Size || 0 });
            }
          }
        }
        continuationToken = res.NextContinuationToken;
      } while (continuationToken);

      return { source: 's3', items, s3 };
    } catch (err) {
      console.warn(`[Cleanup] S3 list failed for '${bucket}': ${err.message}. Trying Cloudflare API...`);
    }
  }

  // Strategy 2: Cloudflare API v4
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (accountId && apiToken) {
    try {
      const targetUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects`);
      const res = await new Promise((resolve, reject) => {
        https.get(targetUrl, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'User-Agent': 'KuroTV-R2-Cleaner',
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        }).on('error', reject);
      });

      const rawItems = res.result || [];
      const items = rawItems.map(obj => ({ key: obj.key, size: obj.size || 0 }));
      return { source: 'cf-api', items, accountId, apiToken };
    } catch (err) {
      console.warn(`[Cleanup] Cloudflare API list failed for '${bucket}': ${err.message}`);
    }
  }

  return { source: 'none', items: [] };
}

async function deleteBucketObject(bucket, key, listContext) {
  if (listContext.source === 's3' && listContext.s3) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await listContext.s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return;
  }

  if (listContext.source === 'cf-api') {
    const { accountId, apiToken } = listContext;
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const targetUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodedKey}`);

    await new Promise((resolve, reject) => {
      const req = https.request(targetUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'User-Agent': 'KuroTV-R2-Cleaner',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      });
      req.on('error', reject);
      req.end();
    });
    return;
  }

  throw new Error(`Nessun client configurato per eliminare '${key}' da '${bucket}'`);
}

async function confirmPrompt(message) {
  if (autoConfirm) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           KuroTV Cloudflare R2 Storage Cleanup Tool               ║');
  console.log('║       Rimozione Versioni Vecchie per Risparmiare Spazio           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  if (isDryRun) {
    console.log('🔍 MODALITÀ DRY-RUN ATTIVA: Nessun file verrà effettivamente eliminato.\n');
  }

  let totalDeletedCount = 0;
  let totalFreedBytes = 0;

  for (const bucket of bucketsToClean) {
    console.log(`📦 Scansione bucket '${bucket}'...`);
    const listResult = await listBucketObjects(bucket);

    if (listResult.source === 'none') {
      console.log(`⚠️  Impossibile elencare gli oggetti del bucket '${bucket}'. Verifica credenziali in .env.local o .env.\n`);
      continue;
    }

    const allObjects = listResult.items;
    const deletableObjects = allObjects.filter(item => isDeletableOldVersion(item.key));

    console.log(`  Totale oggetti nel bucket: ${allObjects.length}`);
    console.log(`  Versioni vecchie da eliminare: ${deletableObjects.length}`);

    if (deletableObjects.length === 0) {
      console.log(`  ✅ Il bucket '${bucket}' contiene già solo i file latest e il manifest. Nessun file da pulire.\n`);
      continue;
    }

    let bucketFreedBytes = 0;
    console.log('\n  File identificati per la rimozione:');
    for (const obj of deletableObjects) {
      bucketFreedBytes += obj.size;
      console.log(`   - 🗑️  ${obj.key.padEnd(45)} (${formatBytes(obj.size)})`);
    }
    console.log(`  Spazio totale recuperabile in '${bucket}': ${formatBytes(bucketFreedBytes)}\n`);

    if (isDryRun) {
      console.log(`  [DRY-RUN] Pulizia di '${bucket}' saltata.\n`);
      continue;
    }

    const confirmed = await confirmPrompt(`  Confermi l'eliminazione definitiva di questi ${deletableObjects.length} file da '${bucket}'?`);
    if (!confirmed) {
      console.log(`  Operazione annullata per '${bucket}'.\n`);
      continue;
    }

    console.log(`  Eliminazione in corso da '${bucket}'...`);
    for (const obj of deletableObjects) {
      try {
        await deleteBucketObject(bucket, obj.key, listResult);
        console.log(`   ✔ Eliminato: ${obj.key}`);
        totalDeletedCount++;
        totalFreedBytes += obj.size;
      } catch (err) {
        console.error(`   ❌ Errore durante l'eliminazione di ${obj.key}:`, err.message);
      }
    }
    console.log(`  ✅ Pulizia bucket '${bucket}' completata!\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  if (isDryRun) {
    console.log('Simulazione completata.');
  } else {
    console.log(`Pulizia completata con successo!`);
    console.log(` - File eliminati: ${totalDeletedCount}`);
    console.log(` - Spazio totale liberato su Cloudflare R2: ${formatBytes(totalFreedBytes)}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Errore irreversibile:', err.message || err);
  process.exit(1);
});

