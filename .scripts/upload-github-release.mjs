#!/usr/bin/env node
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { execSync } from 'child_process';
import { URL } from 'url';

const [,, tag, filePath, customAssetName, contentTypeArg] = process.argv;

if (!tag || !filePath) {
  console.error('Uso: node upload-github-release.mjs <tag> <filePath> [assetName] [contentType]');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`Errore: File non trovato ${filePath}`);
  process.exit(1);
}

const assetName = customAssetName || path.basename(filePath);
const contentType = contentTypeArg || (assetName.endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/octet-stream');

function getGitHubToken() {
  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) {
    return process.env.GH_TOKEN.trim();
  }
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return process.env.GITHUB_TOKEN.trim();
  }
  try {
    const token = execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (token) return token;
  } catch {
    // fallback
  }
  return null;
}

function getRepoSlug() {
  if (process.env.GH_REPO && process.env.GH_REPO.trim()) {
    return process.env.GH_REPO.trim();
  }
  try {
    const slug = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (slug) return slug;
  } catch {
    // fallback
  }
  try {
    const remote = execSync('git config --get remote.origin.url', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const match = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // fallback
  }
  return null;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderProgressBar(uploaded, total, startTime) {
  const percentage = Math.min(100, Math.floor((uploaded / total) * 100));
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

function apiRequest(targetUrl, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const client = u.protocol === 'http:' ? http : https;
    const req = client.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'User-Agent': 'KuroTV-Release-Script',
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getRelease(repo, releaseTag, token) {
  try {
    const output = execSync(`gh release view "${releaseTag}" --json id,uploadUrl,assets`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (output) {
      return JSON.parse(output);
    }
  } catch {
    // fallback to REST API
  }

  const url = `https://api.github.com/repos/${repo}/releases/tags/${releaseTag}`;
  const res = await apiRequest(url, 'GET', {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  if (res.statusCode === 404) {
    throw new Error(`Release con tag '${releaseTag}' non trovata nel repository ${repo}.`);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Errore API GitHub (${res.statusCode}): ${res.body}`);
  }
  return JSON.parse(res.body);
}

async function deleteAsset(repo, releaseTag, assetName, assetId, token) {
  try {
    execSync(`gh release delete-asset "${releaseTag}" "${assetName}" --yes`, {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return;
  } catch {
    // fallback to REST API
  }

  const url = `https://api.github.com/repos/${repo}/releases/assets/${assetId}`;
  const res = await apiRequest(url, 'DELETE', {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  if (res.statusCode !== 204 && res.statusCode !== 200) {
    console.warn(`\n[GitHub] Avviso: impossibile rimuovere asset esistente (status ${res.statusCode})`);
  }
}

function uploadStream(targetUrl, targetFilePath, totalBytes, token, uploadContentType) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const client = u.protocol === 'http:' ? http : https;
    const startTime = Date.now();
    let uploadedBytes = 0;

    renderProgressBar(0, totalBytes, startTime);

    const fileStream = fs.createReadStream(targetFilePath);
    const progressStream = new Transform({
      transform(chunk, encoding, callback) {
        uploadedBytes += chunk.length;
        renderProgressBar(uploadedBytes, totalBytes, startTime);
        callback(null, chunk);
      },
    });

    const headers = {
      'User-Agent': 'KuroTV-Release-Script',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': uploadContentType,
      'Content-Length': totalBytes,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const req = client.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // Handle potential 307 or 302 redirect
        if ((res.statusCode === 307 || res.statusCode === 302) && res.headers.location) {
          uploadStream(res.headers.location, targetFilePath, totalBytes, token, uploadContentType)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          renderProgressBar(totalBytes, totalBytes, startTime);
          resolve(body ? JSON.parse(body) : {});
        } else {
          reject(new Error(`Caricamento fallito (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    fileStream.pipe(progressStream).pipe(req);
  });
}

async function main() {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('Nessun token GitHub rilevato. Assicurati che "gh auth login" sia configurato o imposta GH_TOKEN.');
  }

  const repo = getRepoSlug();
  if (!repo) {
    throw new Error('Impossibile determinare il repository GitHub (owner/repo).');
  }

  const fileStat = fs.statSync(filePath);
  const totalBytes = fileStat.size;

  console.log(`[GitHub] Recupero dettagli release '${tag}' per ${repo}...`);
  const release = await getRelease(repo, tag, token);

  // Check if an asset with the same name already exists and remove it (clobber)
  if (Array.isArray(release.assets)) {
    const existingAsset = release.assets.find(a => a.name === assetName);
    if (existingAsset) {
      console.log(`[GitHub] Rilevato asset esistente '${assetName}'. Rimozione in corso...`);
      await deleteAsset(repo, tag, assetName, existingAsset.id, token);
      console.log(`[GitHub] Asset precedente rimosso con successo.`);
    }
  }

  const rawUploadUrl = release.upload_url || release.uploadUrl;
  if (!rawUploadUrl) {
    throw new Error('La release non include un upload_url valido.');
  }

  const baseUploadUrl = rawUploadUrl.split('{')[0];
  const targetUploadUrl = `${baseUploadUrl}?name=${encodeURIComponent(assetName)}`;

  console.log(`[GitHub] Caricamento di '${assetName}' (${formatBytes(totalBytes)}) su release '${tag}'...`);
  await uploadStream(targetUploadUrl, filePath, totalBytes, token, contentType);
  console.log(`\n[GitHub] Caricamento completato con successo: ${assetName}`);
}

main().catch((err) => {
  console.error('\n[GitHub] Errore durante il caricamento:', err.message || err);
  process.exit(1);
});
