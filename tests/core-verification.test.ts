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

console.log('=== Inizio Test di Verifica KuroTV Mobile ===\n');

// -----------------------------------------------------------------------------
// 1. Test Updater Service & SemVer
// -----------------------------------------------------------------------------
console.log('[1/4] Verifica Updater Service & SemVer...');

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
console.log('\n[2/4] Verifica Regole di Stile Mobile & OLED (AGENTS.md)...');

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

// 5. Mobile Typography (no textTransform uppercase forzato su tutto)
assert(
  oledTheme.typography.hero.fontSize <= 32,
  'Dimensione hero deve essere dimensionata per smartphone (<= 32)'
);

console.log('✓ Regole di Stile Mobile e OLED conformi.');

// -----------------------------------------------------------------------------
// 3. Test Storage & MMKV Fallback
// -----------------------------------------------------------------------------
console.log('\n[3/4] Verifica Storage Locale & Preferiti / Cronologia...');

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
// 4. Fine Test
// -----------------------------------------------------------------------------
console.log('\n==============================================');
console.log('🎉 TUTTI I TEST SONO PASSATI CON SUCCESSO! 🎉');
console.log('==============================================');
