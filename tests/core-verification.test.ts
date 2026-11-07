import assert from 'node:assert';
import {
  compareSemver,
  isUpdateAvailable,
  validateManifest,
  getManifestUrl,
  DEFAULT_MANIFEST_URL,
} from '../src/services/updater/updater-service';
import { oledTheme, breakpoints } from '../src/theme/unistyles';
import { AppStorage } from '../src/services/storage/index';
import type { AniSkipResult } from '../src/types/index';

console.log('=== Inizio Test di Verifica KuroTV Mobile ===\n');

// -----------------------------------------------------------------------------
// 1. Test Updater Service & SemVer
// -----------------------------------------------------------------------------
console.log('[1/5] Verifica Updater Service & SemVer...');

assert.strictEqual(compareSemver('1.0.0', '1.0.1'), -1, '1.0.0 deve essere minore di 1.0.1');
assert.strictEqual(compareSemver('1.1.0', '1.0.0'), 1, '1.1.0 deve essere maggiore di 1.0.0');
assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0, '1.0.0 deve essere uguale a 1.0.0');
assert.strictEqual(compareSemver('v1.0.0', '1.0.0'), 0, 'Prefisso v deve essere normalizzato');
assert.strictEqual(compareSemver('1.0.0-beta.1', '1.0.0'), -1, 'Pre-release ha precedenza inferiore');
assert.strictEqual(compareSemver('1.0.0-rc.2', '1.0.0-rc.1'), 1, 'rc.2 deve essere maggiore di rc.1');

const dummyManifest = {
  version: '1.1.0',
  versionCode: 2,
  apkUrl: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
  releaseNotes: 'Nuova versione mobile',
  mandatory: false,
  sha256: 'abc123sha',
  publishedAt: '2026-11-07T00:00:00.000Z',
};

assert.strictEqual(
  isUpdateAvailable('1.0.0', 1, dummyManifest),
  true,
  'Nuova versione disponibile (build 2 > 1)'
);

assert.strictEqual(
  isUpdateAvailable('1.1.0', 2, dummyManifest),
  false,
  'Nessun aggiornamento (versione e build uguali)'
);

assert.strictEqual(
  isUpdateAvailable('1.2.0', 3, dummyManifest),
  false,
  'Nessun aggiornamento (versione installata superiore)'
);

// Manifest Validation
const validManifest = validateManifest({
  version: '1.0.1',
  versionCode: 2,
  apkUrl: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
  apks: {
    universal: {
      url: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
      sha256: 'abc123sha',
    },
  },
});
assert(validManifest !== null, 'Il manifest valido deve essere accettato');
assert.strictEqual(validManifest.version, '1.0.1');
assert.strictEqual(validManifest.versionCode, 2);

const invalidManifest = validateManifest({ version: '' });
assert.strictEqual(invalidManifest, null, 'Il manifest non valido deve essere rifiutato');

// Manifest URL verification (must target /mobile/)
assert(
  DEFAULT_MANIFEST_URL.includes('/mobile/manifest.json'),
  `DEFAULT_MANIFEST_URL deve contenere /mobile/manifest.json, attuale: ${DEFAULT_MANIFEST_URL}`
);
assert(
  getManifestUrl().includes('/mobile/manifest.json'),
  `getManifestUrl() deve puntare a /mobile/manifest.json`
);

console.log('✓ Updater Service & SemVer verificati con successo.');

// -----------------------------------------------------------------------------
// 2. Test Mobile-First Theme & Guidelines (AGENTS.md)
// -----------------------------------------------------------------------------
console.log('\n[2/5] Verifica Regole di Stile Mobile & OLED (AGENTS.md)...');

// 1. Pure OLED Black
assert.strictEqual(
  oledTheme.colors.background,
  '#000000',
  'Lo sfondo tema OLED deve essere nero assoluto (#000000)'
);

// 2. Minimum Touch Target >= 44dp
assert(
  oledTheme.spacing.minTouchTarget >= 44,
  `Il touch target minimo deve essere almeno 44dp (attuale: ${oledTheme.spacing.minTouchTarget})`
);

// 3. Eliminazione overscan TV da 56px
assert.strictEqual(
  oledTheme.spacing.screenHorizontal,
  16,
  'I margini orizzontali devono essere mobile-native (16dp), non TV overscan (56dp)'
);

// 4. Rimozione breakpoint TV 1920
assert.strictEqual(
  (breakpoints as any).tv,
  undefined,
  'Il breakpoint TV (1920) deve essere rimosso'
);

// 5. Mobile Typography
assert(
  oledTheme.typography.hero.fontSize <= 32,
  'Dimensione hero deve essere dimensionata per smartphone (<= 32)'
);

console.log('✓ Regole di Stile Mobile e OLED conformi.');

// -----------------------------------------------------------------------------
// 3. Test Storage & MMKV Fallback
// -----------------------------------------------------------------------------
console.log('\n[3/5] Verifica Storage Locale & Preferiti / Cronologia...');

const testAnime = {
  id: 'test-anime-1',
  title: 'Test Anime Title',
  thumbnail: 'https://example.com/thumb.jpg',
  genres: ['Azione', 'Avventura'],
  link: '/anime/test-anime-1',
};

// Toggle favorite
const isNowFav = AppStorage.toggleFavorite(testAnime);
assert.strictEqual(isNowFav, true, 'Anime aggiunto ai preferiti');
assert.strictEqual(AppStorage.isFavorite('test-anime-1'), true);

const favList = AppStorage.getFavorites();
assert(favList.some((f) => f.id === 'test-anime-1'), 'Anime presente nella lista preferiti');

// Toggle again to remove
const isStillFav = AppStorage.toggleFavorite(testAnime);
assert.strictEqual(isStillFav, false, 'Anime rimosso dai preferiti');
assert.strictEqual(AppStorage.isFavorite('test-anime-1'), false);

// Watch progress & history
AppStorage.saveWatchProgress({
  animeId: 'test-anime-1',
  animeTitle: 'Test Anime Title',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 120,
  duration: 1440,
});

const progress = AppStorage.getWatchProgress('test-anime-1', 1);
assert(progress !== undefined, 'Il progresso deve essere salvato');
assert.strictEqual(progress.animeId, 'test-anime-1');
assert.strictEqual(progress.episodeNumber, 1);
assert.strictEqual(progress.currentTime, 120);

const history = AppStorage.getWatchHistory();
assert(history.length > 0, 'La cronologia deve contenere l\'episodio visto');
assert.strictEqual(history[0].animeId, 'test-anime-1');

// Clear watch history
AppStorage.clearWatchHistory();
const clearedHistory = AppStorage.getWatchHistory();
assert.strictEqual(clearedHistory.length, 0, 'La cronologia deve essere vuota dopo clearWatchHistory');

console.log('✓ Storage Locale & Preferiti / Cronologia verificati con successo.');

// -----------------------------------------------------------------------------
// 4. Test Episode Batching & Grid Logic
// -----------------------------------------------------------------------------
console.log('\n[4/5] Verifica Logica Batch Puntate & Griglia Episodi...');

function createBatches(totalEpisodes: number, batchSize = 25) {
  if (totalEpisodes <= batchSize) {
    return [{ id: 'batch-0', label: `Ep. 1 - ${totalEpisodes || 1}`, start: 1, end: totalEpisodes || 1 }];
  }
  const batches = [];
  for (let i = 0; i < totalEpisodes; i += batchSize) {
    const startEp = i + 1;
    const endEp = Math.min(i + batchSize, totalEpisodes);
    batches.push({
      id: `batch-${i}`,
      label: `Ep. ${startEp} - ${endEp}`,
      start: startEp,
      end: endEp,
    });
  }
  return batches;
}

// Case 1: 12 episodes (single batch)
const batches12 = createBatches(12);
assert.strictEqual(batches12.length, 1);
assert.strictEqual(batches12[0].label, 'Ep. 1 - 12');
assert.strictEqual(batches12[0].start, 1);
assert.strictEqual(batches12[0].end, 12);

// Case 2: 74 episodes (3 batches: 1-25, 26-50, 51-74)
const batches74 = createBatches(74);
assert.strictEqual(batches74.length, 3);
assert.strictEqual(batches74[0].label, 'Ep. 1 - 25');
assert.strictEqual(batches74[1].label, 'Ep. 26 - 50');
assert.strictEqual(batches74[2].label, 'Ep. 51 - 74');
assert.strictEqual(batches74[2].start, 51);
assert.strictEqual(batches74[2].end, 74);

console.log('✓ Logica Batch Puntate e Griglia Episodi verificata con successo.');

// -----------------------------------------------------------------------------
// 5. Test AniSkip Interval Matching
// -----------------------------------------------------------------------------
console.log('\n[5/5] Verifica Rilevamento Intervalli AniSkip...');

const mockSkips: AniSkipResult[] = [
  {
    skipType: 'op',
    interval: { startTime: 90, endTime: 180 },
    skipId: 'skip-op-1',
    episodeLength: 1440,
  },
  {
    skipType: 'ed',
    interval: { startTime: 1320, endTime: 1410 },
    skipId: 'skip-ed-1',
    episodeLength: 1440,
  },
];

function findActiveSkip(currentTime: number, skips: AniSkipResult[]) {
  return skips.find(
    (s) => currentTime >= s.interval.startTime && currentTime <= s.interval.endTime
  ) || null;
}

// At 50s: no skip
assert.strictEqual(findActiveSkip(50, mockSkips), null);

// At 120s: Intro (op) skip active
const opSkip = findActiveSkip(120, mockSkips);
assert(opSkip !== null);
assert.strictEqual(opSkip.skipType, 'op');

// At 200s: no skip
assert.strictEqual(findActiveSkip(200, mockSkips), null);

// At 1350s: Outro (ed) skip active
const edSkip = findActiveSkip(1350, mockSkips);
assert(edSkip !== null);
assert.strictEqual(edSkip.skipType, 'ed');

console.log('✓ Rilevamento Intervalli AniSkip verificato con successo.');

// -----------------------------------------------------------------------------
// Fine Test
// -----------------------------------------------------------------------------
console.log('\n==============================================');
console.log('🎉 TUTTI I TEST SONO PASSATI CON SUCCESSO! 🎉');
console.log('==============================================');
