#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { Transform } from 'stream';
import { URL } from 'url';

// Load .env.local or .env if present and environment variables not already exported
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

const [,, bucket, key, filePath, contentTypeArg] = process.argv;

if (!bucket || !key || !filePath) {
  console.error('Uso: node upload-r2.mjs <bucket> <key> <filePath> [contentType]');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`Errore: File non trovato: ${filePath}`);
  process.exit(1);
}

function detectContentType(targetPath, customType) {
  if (customType) return customType;
  if (targetPath.endsWith('.apk')) return 'application/vnd.android.package-archive';
  if (targetPath.endsWith('.json')) return 'application/json';
  if (targetPath.endsWith('.enc')) return 'application/octet-stream';
  if (targetPath.endsWith('.tar.gz') || targetPath.endsWith('.tgz')) return 'application/gzip';
  if (targetPath.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

const contentType = detectContentType(key, contentTypeArg);

function formatBytes(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderProgressBar(uploaded, total, startTime) {
  const percentage = total > 0 ? Math.min(100, Math.floor((uploaded / total) * 100)) : 100;
  const barLength = 26;
  const filledLength = Math.round((barLength * percentage) / 100);
  const emptyLength = Math.max(0, barLength - filledLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

  const elapsedSec = (Date.now() - startTime) / 1000;
  const speed = elapsedSec > 0 ? uploaded / elapsedSec : 0;
  const speedStr = `${formatBytes(speed)}/s`;
  const remainingSec = speed > 0 && uploaded < total ? Math.ceil((total - uploaded) / speed) : 0;
  const etaStr = remainingSec > 0 ? `ETA: ${remainingSec}s` : 'Completato';

  const output = `\r  [${bar}] ${percentage.toString().padStart(3)}% | ${formatBytes(uploaded)} / ${formatBytes(total)} | ${speedStr} | ${etaStr}`;
  process.stdout.write(output);
}

// Upload Strategy 1: Cloudflare REST API v4 PUT (preferred when CLOUDFLARE_API_TOKEN is available)
async function uploadViaCloudflareApi(accountId, token, targetBucket, targetKey, targetFilePath, totalBytes, mimeType) {
  return new Promise((resolve, reject) => {
    const encodedBucket = encodeURIComponent(targetBucket);
    // Key may contain subpaths (e.g. secure-backups/kurotv-backup.enc); encode each segment preserving '/'
    const encodedKey = targetKey.split('/').map(encodeURIComponent).join('/');
    const targetUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodedBucket}/objects/${encodedKey}`);

    const startTime = Date.now();
    let uploadedBytes = 0;

    renderProgressBar(0, totalBytes, startTime);

    const fileStream = fs.createReadStream(targetFilePath, { highWaterMark: 128 * 1024 });
    const progressStream = new Transform({
      transform(chunk, encoding, callback) {
        uploadedBytes += chunk.length;
        renderProgressBar(uploadedBytes, totalBytes, startTime);
        callback(null, chunk);
      },
    });

    const req = https.request({
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname,
      method: 'PUT',
      headers: {
        'User-Agent': 'KuroTV-R2-Uploader',
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
        'Content-Length': totalBytes,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          renderProgressBar(totalBytes, totalBytes, startTime);
          process.stdout.write('\n');
          resolve(body);
        } else {
          process.stdout.write('\n');
          reject(new Error(`Cloudflare API HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    fileStream.on('error', (err) => {
      process.stdout.write('\n');
      try { req.destroy(err); } catch {}
      reject(err);
    });

    progressStream.on('error', (err) => {
      process.stdout.write('\n');
      try { req.destroy(err); } catch {}
      reject(err);
    });

    req.on('error', (err) => {
      process.stdout.write('\n');
      reject(err);
    });

    fileStream.pipe(progressStream).pipe(req);
  });
}

// Upload Strategy 2: S3 SDK PutObject (preferred when R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY are provided)
async function uploadViaS3Client(endpoint, accessKeyId, secretAccessKey, targetBucket, targetKey, targetFilePath, totalBytes, mimeType) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const startTime = Date.now();
  let uploadedBytes = 0;

  renderProgressBar(0, totalBytes, startTime);

  const fileStream = fs.createReadStream(targetFilePath, { highWaterMark: 128 * 1024 });
  const progressStream = new Transform({
    transform(chunk, encoding, callback) {
      uploadedBytes += chunk.length;
      renderProgressBar(uploadedBytes, totalBytes, startTime);
      callback(null, chunk);
    },
  });

  await new Promise((resolve, reject) => {
    fileStream.on('error', (err) => {
      process.stdout.write('\n');
      reject(err);
    });
    progressStream.on('error', (err) => {
      process.stdout.write('\n');
      reject(err);
    });

    fileStream.pipe(progressStream);

    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: targetKey,
      Body: progressStream,
      ContentLength: totalBytes,
      ContentType: mimeType,
    });

    s3.send(command).then(
      () => {
        renderProgressBar(totalBytes, totalBytes, startTime);
        process.stdout.write('\n');
        resolve();
      },
      (err) => {
        process.stdout.write('\n');
        reject(err);
      }
    );
  });
}

async function main() {
  const fileStat = fs.statSync(filePath);
  const totalBytes = fileStat.size;

  const cfToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT_URL || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  console.log(`[R2] Caricamento di '${key}' (${formatBytes(totalBytes)}) su bucket '${bucket}'...`);

  // Try Cloudflare REST API first if token and account ID are available (reliable & native token support)
  if (cfToken && accountId) {
    try {
      await uploadViaCloudflareApi(accountId, cfToken, bucket, key, filePath, totalBytes, contentType);
      console.log(`[R2] Caricamento completato con successo (Cloudflare API v4): ${key}`);
      return;
    } catch (err) {
      // If S3 credentials also exist, try S3 as fallback
      if (accessKeyId && secretAccessKey && endpoint) {
        console.warn(`\n[R2] Avviso: Cloudflare API fallita (${err.message}). Tentativo tramite client S3...`);
      } else {
        throw err;
      }
    }
  }

  // S3 API client path
  if (accessKeyId && secretAccessKey && endpoint) {
    await uploadViaS3Client(endpoint, accessKeyId, secretAccessKey, bucket, key, filePath, totalBytes, contentType);
    console.log(`[R2] Caricamento completato con successo (S3 API): ${key}`);
    return;
  }

  throw new Error(
    'Nessuna credenziale valida trovata per Cloudflare R2.\n' +
    'Configura CLOUDFLARE_API_TOKEN e R2_ACCOUNT_ID (consigliato)\n' +
    'oppure R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY in .env.local o nell\'ambiente.'
  );
}

main().catch((err) => {
  console.error('\n[R2] Errore durante il caricamento:', err.message || err);
  process.exit(1);
});
