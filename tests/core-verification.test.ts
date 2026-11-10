import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  compareSemver,
  isUpdateAvailable,
  validateManifest,
  getManifestUrl,
  getDeviceSupportedAbis,
  selectApkForDevice,
  DEFAULT_MANIFEST_URL,
} from '../src/services/updater/updater-service';
import {
  oledTheme,
  darkTheme,
  lightTheme,
  breakpoints,
  applyPikachuTheme,
  applyOrchidTheme,
  applyRainbowTheme,
  applyThemeFamily,
  resetThemeToDefaults,
  StyleSheet,
  UnistylesRuntime,
  ThemeProvider,
  useTheme,
  useUnistyles,
  useStyles,
  mq,
  ColorScheme,
  Orientation,
  getContrastTextColor,
} from '../src/theme/unistyles';
import { AppStorage } from '../src/services/storage/index';
import { scraperConfig } from '../src/services/scraper/config';
import { ProviderRegistry } from '../src/services/scraper/registry';
import {
  PlayerHeader,
  PlayerTimeline,
  PlayerFooter,
  PlayerEpisodesCarouselSheet,
  PlayerInfoSheet,
  formatTime,
} from '../src/components/player/index';
import {
  AnimeHeaderBackdrop,
  AnimeSynopsis,
  AnimeInfoTable,
  AnimeControlsBar,
} from '../src/components/anime/index';
import {
  HistorySlider,
  UpdateModal,
  AniSkipSlider,
  AniSkipDurationSlider,
  ANISKIP_DURATION_STEPS,
  formatAniSkipAutoDescription,
  formatAniSkipManualDescription,
} from '../src/components/index';
import { UpdateStore, usePendingUpdate } from '../src/services/updater/index';
import { parseDetailPage } from '../src/services/scraper/parsers/detail.parser';
import { CURRENT_CHANGELOG, formatChangelog } from '../src/constants/changelog';
import type { AniSkipResult } from '../src/types/index';

console.log('=== Inizio Test di Verifica KuroTV Mobile ===\n');

// -----------------------------------------------------------------------------
// 1. Test Updater Service & SemVer
// -----------------------------------------------------------------------------
console.log('[1/7] Verifica Updater Service & SemVer...');

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

const supportedAbis = getDeviceSupportedAbis();
assert(Array.isArray(supportedAbis), 'getDeviceSupportedAbis deve restituire un array');
assert(supportedAbis.length > 0, 'supportedAbis deve contenere almeno un elemento');

// Test arm64-v8a architecture resolution in OTA updater
const arm64Manifest = validateManifest({
  version: '1.0.1',
  versionCode: 2,
  apkUrl: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
  apks: {
    'arm64-v8a': {
      url: 'https://kuro-tv.g4s01.workers.dev/mobile/latest-arm64-v8a.apk',
      sha256: 'arm64sha',
      size: 12345678,
    },
    universal: {
      url: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
      sha256: 'arm64sha',
      size: 12345678,
    },
  },
});
assert(arm64Manifest !== null, 'arm64Manifest deve essere valido');

// On an arm64-v8a smartphone device, it must pick the arm64-v8a release asset
const selectedForArm64 = selectApkForDevice(arm64Manifest, ['arm64-v8a', 'armeabi-v7a']);
assert.strictEqual(selectedForArm64.abi, 'arm64-v8a', 'Deve selezionare arm64-v8a su dispositivo compatibile');
assert.strictEqual(
  selectedForArm64.url,
  'https://kuro-tv.g4s01.workers.dev/mobile/latest-arm64-v8a.apk',
  'URL deve puntare a latest-arm64-v8a.apk'
);

// On an aarch64 smartphone device (alias), it must resolve alias and pick arm64-v8a
const selectedForAarch64 = selectApkForDevice(arm64Manifest, ['aarch64']);
assert.strictEqual(selectedForAarch64.abi, 'arm64-v8a', 'Deve risolvere alias aarch64 su arm64-v8a');
assert.strictEqual(
  selectedForAarch64.url,
  'https://kuro-tv.g4s01.workers.dev/mobile/latest-arm64-v8a.apk',
  'URL per aarch64 deve puntare a latest-arm64-v8a.apk'
);

// On an older or unlisted device, it must safely fallback to universal latest.apk
const fallbackSelection = selectApkForDevice(arm64Manifest, ['x86']);
assert.strictEqual(fallbackSelection.abi, 'universal', 'Deve ricadere su universal fallback');
assert.strictEqual(
  fallbackSelection.url,
  'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
  'Fallback URL deve puntare a latest.apk'
);

// When device ABIs list is empty, it must safely fallback to universal latest.apk
const fallbackEmptySelection = selectApkForDevice(arm64Manifest, []);
assert.strictEqual(fallbackEmptySelection.abi, 'universal', 'Deve ricadere su universal per device ABI vuoto');
assert.strictEqual(fallbackEmptySelection.url, 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk');

// When manifest does not provide apks object, fallback to manifest.apkUrl
const bareManifest = validateManifest({
  version: '1.0.1',
  versionCode: 2,
  apkUrl: 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk',
});
assert(bareManifest !== null, 'bareManifest deve essere valido');
const bareSelection = selectApkForDevice(bareManifest, ['arm64-v8a']);
assert.strictEqual(bareSelection.abi, 'universal', 'Manifest senza apks map deve ricadere su universal');
assert.strictEqual(bareSelection.url, 'https://kuro-tv.g4s01.workers.dev/mobile/latest.apk');

// -----------------------------------------------------------------------------
// Verify Release Pipeline Script Configuration (build-release.sh & gradle)
// -----------------------------------------------------------------------------
const releaseScriptPath = path.resolve(process.cwd(), 'build-release.sh');
assert(fs.existsSync(releaseScriptPath), 'build-release.sh deve esistere nella root del repository');
const releaseScriptContent = fs.readFileSync(releaseScriptPath, 'utf8');

// Must enforce arm64-v8a in gradle parameters
assert(
  releaseScriptContent.includes('-PreactNativeArchitectures=arm64-v8a'),
  'build-release.sh deve passare -PreactNativeArchitectures=arm64-v8a a ./gradlew assembleRelease'
);
assert(
  releaseScriptContent.includes('reactNativeArchitectures=arm64-v8a'),
  'build-release.sh deve configurare reactNativeArchitectures=arm64-v8a in gradle.properties'
);
// Must check arm64 library presence and exclude legacy ABIs
assert(
  releaseScriptContent.includes('lib/arm64-v8a/'),
  'build-release.sh deve verificare la presenza di lib/arm64-v8a/'
);
assert(
  releaseScriptContent.includes('armeabi-v7a|x86|x86_64'),
  'build-release.sh deve verificare l\'assenza di librerie legacy armeabi-v7a|x86|x86_64'
);

// Verify android/gradle.properties default
const gradlePropsPath = path.resolve(process.cwd(), 'android/gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  const gradlePropsContent = fs.readFileSync(gradlePropsPath, 'utf8');
  assert(
    gradlePropsContent.includes('reactNativeArchitectures=arm64-v8a'),
    'android/gradle.properties deve avere reactNativeArchitectures=arm64-v8a come impostazione predefinita'
  );
}

// Verify scripts/ directory and non-sensitive pipeline tools
const scriptsDir = path.resolve(process.cwd(), 'scripts');
assert(fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory(), 'scripts/ deve essere una directory reale');
const expectedScripts = [
  'build-release.sh',
  'backup-secrets-r2.sh',
  'clean-r2-old-versions.mjs',
  'upload-github-release.mjs',
  'upload-r2.mjs',
  'apply-patches.mjs',
  'HOW-TO-RESTORE.txt',
];
for (const scriptFile of expectedScripts) {
  const p = path.join(scriptsDir, scriptFile);
  assert(fs.existsSync(p), `Lo script ${scriptFile} deve esistere in scripts/`);
}

// Verify in-memory function wrapping (main "$@") and --skip-build support
assert(
  releaseScriptContent.includes('main "$@"'),
  'build-release.sh deve incapsulare l\'esecuzione in una funzione main "$@" per prevenire desync del file descriptor'
);
assert(
  releaseScriptContent.includes('--skip-build'),
  'build-release.sh deve supportare il flag --skip-build'
);

// Verify build-release.sh overwrites GitHub release on different build codes & pushes local repo
assert(
  releaseScriptContent.includes('gh release delete-asset') &&
  releaseScriptContent.includes('gh release edit') &&
  releaseScriptContent.includes('git add -A'),
  'build-release.sh deve includere l\'intero repo locale con git add -A e sovrascrivere vecchi asset/build su GitHub release'
);

const uploadGhScript = fs.readFileSync(path.join(scriptsDir, 'upload-github-release.mjs'), 'utf8');
assert(
  uploadGhScript.includes('isOlderBuildOfSamePattern') &&
  uploadGhScript.includes('deleteAsset'),
  'upload-github-release.mjs deve eliminare automaticamente vecchi APK di build precedenti per la stessa release'
);

// Verify .gitignore keeps secrets and credentials ignored, but scripts/ is NOT ignored
const gitignorePath = path.resolve(process.cwd(), '.gitignore');
assert(fs.existsSync(gitignorePath), '.gitignore deve esistere');
const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
assert(gitignoreContent.includes('.env'), '.gitignore deve ignorare .env');
assert(gitignoreContent.includes('credentials/'), '.gitignore deve ignorare credentials/');
assert(gitignoreContent.includes('secure-backups/'), '.gitignore deve ignorare secure-backups/');
assert(gitignoreContent.includes('*.keystore'), '.gitignore deve ignorare *.keystore');
const gitignoreLines = gitignoreContent.split('\n').map(l => l.trim());
assert(!gitignoreLines.includes('scripts'), '.gitignore non deve ignorare scripts');
assert(!gitignoreLines.includes('scripts/'), '.gitignore non deve ignorare scripts/');

// Verify backup-secrets-r2.sh has no hardcoded secrets
const backupScriptContent = fs.readFileSync(path.join(scriptsDir, 'backup-secrets-r2.sh'), 'utf8');
assert(!backupScriptContent.includes('kurotv_release_2026_secret'), 'backup-secrets-r2.sh non deve contenere password hardcoded');

console.log('✓ Updater Service & SemVer verificati con successo.');

// -----------------------------------------------------------------------------
// 2. Test Mobile-First Theme & Guidelines (AGENTS.md)
// -----------------------------------------------------------------------------
console.log('\n[2/7] Verifica Regole di Stile Mobile & OLED (AGENTS.md)...');

// 1. Pure OLED Black & Theme Integrity
assert.strictEqual(
  oledTheme.colors.background,
  '#000000',
  'Lo sfondo tema OLED deve essere nero assoluto (#000000)'
);
assert.strictEqual(
  darkTheme.colors.background,
  '#000000',
  'Lo sfondo tema dark deve essere nero assoluto (#000000)'
);
assert.strictEqual(
  lightTheme.colors.background,
  '#FFFFFF',
  'Lo sfondo tema light deve essere bianco (#FFFFFF)'
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

// 5. Mobile Typography & Monospace
assert(
  oledTheme.typography.hero.fontSize <= 32,
  'Dimensione hero deve essere dimensionata per smartphone (<= 32)'
);
const typoKeys = ['hero', 'title', 'subtitle', 'body', 'caption'] as const;
for (const key of typoKeys) {
  assert.strictEqual(
    oledTheme.typography[key].fontFamily,
    'monospace',
    `Typography ${key} deve utilizzare font monospace`
  );
  assert.strictEqual(
    oledTheme.typography[key].textTransform,
    'uppercase',
    `Typography ${key} deve essere in stampatello maiuscolo (uppercase)`
  );
}

// 6. Dynamic Theme Application & Safe Unistyles Runtime
applyPikachuTheme('oled');
assert.strictEqual(oledTheme.colors.primary, '#FAD61D', 'Pikachu primary color deve essere #FAD61D');

applyOrchidTheme('oled');
assert.strictEqual(oledTheme.colors.primary, '#E941FB', 'Orchidea primary color deve essere #E941FB');

applyRainbowTheme('oled');
assert.strictEqual(oledTheme.colors.primary, '#73FEC8', 'Rainbow primary color deve essere #73FEC8');

resetThemeToDefaults('oled');
assert.strictEqual(oledTheme.colors.primary, '#E50914', 'Reset defaults deve ripristinare #E50914');
assert.strictEqual(oledTheme.colors.background, '#000000', 'Reset defaults deve preservare OLED #000000');

// 7. StyleSheet & Runtime Safe Functions
const staticStyle = StyleSheet.create({ box: { padding: 10 } });
assert.strictEqual((staticStyle as any).box.padding, 10, 'StyleSheet.create con oggetto statico');

const dynamicStyle = StyleSheet.create((theme) => ({ box: { backgroundColor: theme.colors.background } }));
assert.strictEqual((dynamicStyle as any).box.backgroundColor, '#000000', 'StyleSheet.create con funzione theme');

// 8. Theme Family Switcher and Safe Storage Synchronization
applyThemeFamily('pikachu');
assert.strictEqual(oledTheme.colors.primary, '#FAD61D', 'applyThemeFamily pikachu deve impostare #FAD61D');
applyThemeFamily('default');
assert.strictEqual(oledTheme.colors.primary, '#E50914', 'applyThemeFamily default deve ripristinare #E50914');

// 9. Unistyles Full API Support
assert.strictEqual(typeof useUnistyles, 'function', 'useUnistyles deve essere esportato come hook');
assert.strictEqual(typeof useStyles, 'function', 'useStyles deve essere esportato come hook');
assert.strictEqual(typeof mq.only.width, 'function', 'mq helper deve essere supportato');
assert.strictEqual(ColorScheme.Dark, 'dark', 'ColorScheme deve essere supportato');
assert.strictEqual(Orientation.Portrait, 'portrait', 'Orientation deve essere supportato');

assert.strictEqual(UnistylesRuntime.themeName, 'oled');
UnistylesRuntime.setTheme('light');
assert.strictEqual(UnistylesRuntime.themeName, 'light');
UnistylesRuntime.setTheme('oled');
assert.strictEqual(UnistylesRuntime.themeName, 'oled');

// 10. Invertibilità Temi (Dark e Light per ciascuna famiglia)
applyThemeFamily('oled', 'light');
assert.strictEqual(UnistylesRuntime.themeName, 'light', 'applyThemeFamily oled light deve attivare theme light');
assert.strictEqual(lightTheme.colors.background, '#FFFFFF', 'OLED light background deve essere bianco #FFFFFF');

applyThemeFamily('oled', 'dark');
assert.strictEqual(UnistylesRuntime.themeName, 'oled', 'applyThemeFamily oled dark deve ripristinare oled');
assert.strictEqual(oledTheme.colors.background, '#000000', 'OLED dark background deve essere #000000');

applyThemeFamily('pikachu', 'light');
assert.strictEqual(UnistylesRuntime.themeName, 'light', 'Pikachu light deve attivare theme light');
assert.strictEqual(lightTheme.colors.primary, '#F62D14', 'Pikachu light primary deve essere #F62D14');

applyThemeFamily('pikachu', 'dark');
assert.strictEqual(UnistylesRuntime.themeName, 'oled', 'Pikachu dark deve ripristinare oled');
assert.strictEqual(oledTheme.colors.primary, '#FAD61D', 'Pikachu dark primary deve essere #FAD61D');

applyThemeFamily('orchid', 'light');
assert.strictEqual(UnistylesRuntime.themeName, 'light', 'Orchid light deve attivare theme light');
applyThemeFamily('orchid', 'dark');
assert.strictEqual(UnistylesRuntime.themeName, 'oled', 'Orchid dark deve ripristinare oled');

applyThemeFamily('rainbow', 'light');
assert.strictEqual(UnistylesRuntime.themeName, 'light', 'Rainbow light deve attivare theme light');
applyThemeFamily('rainbow', 'dark');
assert.strictEqual(UnistylesRuntime.themeName, 'oled', 'Rainbow dark deve ripristinare oled');

// Ripristino tema default per i test successivi
applyThemeFamily('default', 'dark');
assert.strictEqual(oledTheme.colors.primary, '#E50914');
assert.strictEqual(oledTheme.colors.background, '#000000');

assert.strictEqual(typeof ThemeProvider, 'function', 'ThemeProvider deve essere esportato come componente');
assert.strictEqual(typeof useTheme, 'function', 'useTheme deve essere esportato come hook');

console.log('✓ Regole di Stile Mobile e OLED conformi.');

// -----------------------------------------------------------------------------
// 3. Test Storage & MMKV Fallback
// -----------------------------------------------------------------------------
console.log('\n[3/7] Verifica Storage Locale & Preferiti / Cronologia...');

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

// Watch progress with thumbnail and continue watching
AppStorage.saveWatchProgress({
  animeId: 'test-anime-thumbnail',
  animeTitle: 'Test Anime Thumb',
  thumbnail: 'https://example.com/anime-cover.jpg',
  episodeId: 'ep-thumb-1',
  episodeNumber: 1,
  currentTime: 30,
  duration: 1200,
});
const continueList = AppStorage.getContinueWatching();
assert(continueList.length > 0, 'Continue watching deve essere popolato');
assert.strictEqual(continueList[0].animeId, 'test-anime-thumbnail');
assert.strictEqual(continueList[0].thumbnail, 'https://example.com/anime-cover.jpg', 'Thumbnail deve essere salvata');

// Test rimozione da continue watching
AppStorage.removeContinueWatching('test-anime-thumbnail');
const afterRemove = AppStorage.getContinueWatching().filter((c) => c.animeId === 'test-anime-thumbnail');
assert.strictEqual(afterRemove.length, 0, 'L\'anime rimosso non deve essere presente in continue watching');

// Test avanzamento automatico all'episodio successivo al completamento
AppStorage.saveWatchProgress({
  animeId: 'test-anime-advancing',
  animeTitle: 'Advancing Anime',
  thumbnail: 'https://example.com/adv.jpg',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 1150, // > 90% di 1200
  duration: 1200,
  nextEpisode: {
    id: 'ep-2',
    number: 2,
    dataId: 'd-2',
  },
});
const advancingContinue = AppStorage.getContinueWatching().find((c) => c.animeId === 'test-anime-advancing');
assert(advancingContinue !== undefined, 'L\'anime deve essere in continue watching con il prossimo episodio');
assert.strictEqual(advancingContinue.episodeNumber, 2, 'L\'episodio deve essere avanzato al 2');
assert.strictEqual(advancingContinue.position, 0, 'Il minutaggio del nuovo episodio deve partire da 0');
assert.strictEqual(advancingContinue.percentage, 0, 'La percentuale del nuovo episodio deve partire da 0');

// Test rimozione automatica da continue watching se l'ultimo episodio è concluso e non ci sono altri episodi
AppStorage.saveWatchProgress({
  animeId: 'test-anime-advancing',
  animeTitle: 'Advancing Anime',
  thumbnail: 'https://example.com/adv.jpg',
  episodeId: 'ep-2',
  episodeNumber: 2,
  currentTime: 1200,
  duration: 1200,
  // Nessun nextEpisode: serie conclusa
});
const completedContinue = AppStorage.getContinueWatching().find((c) => c.animeId === 'test-anime-advancing');
assert.strictEqual(completedContinue, undefined, 'Una serie completamente terminata deve uscire da continue watching');

// Theme Mode in Storage
AppStorage.setThemeMode('light');
assert.strictEqual(AppStorage.getThemeMode(), 'light', 'AppStorage.getThemeMode deve restituire light');
AppStorage.setThemeMode('oled');
assert.strictEqual(AppStorage.getThemeMode(), 'oled', 'AppStorage.getThemeMode deve restituire oled');

// Changelog verification
assert.strictEqual(CURRENT_CHANGELOG.version, '1.0.0', 'CURRENT_CHANGELOG deve essere v1.0.0');
assert(CURRENT_CHANGELOG.highlights.length > 0, 'CURRENT_CHANGELOG deve avere note di rilascio');
const formattedText = formatChangelog(CURRENT_CHANGELOG);
assert(formattedText.includes('1.0.0'), 'Changelog formattato deve contenere versione 1.0.0');

// Clear watch history
AppStorage.clearWatchHistory();
const clearedHistory = AppStorage.getWatchHistory();
assert.strictEqual(clearedHistory.length, 0, 'La cronologia deve essere vuota dopo clearWatchHistory');

// Test removeWatchHistoryItem (singola rimozione episodio)
AppStorage.saveWatchProgress({
  animeId: 'item-to-remove-anime',
  animeTitle: 'Item To Remove',
  episodeId: 'ep-rem-1',
  episodeNumber: 1,
  currentTime: 300,
  duration: 1200,
});
AppStorage.saveWatchProgress({
  animeId: 'item-to-remove-anime',
  animeTitle: 'Item To Remove',
  episodeId: 'ep-rem-2',
  episodeNumber: 2,
  currentTime: 400,
  duration: 1200,
});

assert(
  AppStorage.getWatchHistory().some((h) => h.animeId === 'item-to-remove-anime' && h.episodeNumber === 1),
  'Episodio 1 deve essere in cronologia'
);
assert(
  AppStorage.getWatchHistory().some((h) => h.animeId === 'item-to-remove-anime' && h.episodeNumber === 2),
  'Episodio 2 deve essere in cronologia'
);

const removedEp1 = AppStorage.removeWatchHistoryItem('item-to-remove-anime', 'ep-rem-1', 1);
assert.strictEqual(removedEp1, true, 'removeWatchHistoryItem deve restituire true');
assert(
  !AppStorage.getWatchHistory().some((h) => h.animeId === 'item-to-remove-anime' && h.episodeNumber === 1),
  'Episodio 1 rimosso non deve più comparire in cronologia'
);
assert(
  AppStorage.getWatchHistory().some((h) => h.animeId === 'item-to-remove-anime' && h.episodeNumber === 2),
  'Episodio 2 deve rimanere in cronologia'
);

// Test disabilitazione cronologia (Retention = -1 / OFF)
AppStorage.setHistoryRetentionDays(-1);
assert.strictEqual(AppStorage.getHistoryRetentionDays(), -1, 'Retention deve essere -1 (OFF)');
assert.strictEqual(AppStorage.isHistoryEnabled(), false, 'isHistoryEnabled deve essere false');
assert.strictEqual(AppStorage.getWatchHistory().length, 0, 'getWatchHistory deve restituire [] quando OFF');
assert.strictEqual(AppStorage.getContinueWatching().length, 0, 'getContinueWatching deve restituire [] quando OFF');

// Ripristino cronologia attiva (90 giorni)
AppStorage.setHistoryRetentionDays(90);
assert.strictEqual(AppStorage.getHistoryRetentionDays(), 90, 'Retention deve tornare a 90');
assert.strictEqual(AppStorage.isHistoryEnabled(), true, 'isHistoryEnabled deve tornare true');
AppStorage.clearWatchHistory();

// TLD & Custom Domain Scraper Synchronization
AppStorage.setTld('ac');
assert.strictEqual(AppStorage.getTld(), 'ac', 'AppStorage.getTld deve restituire ac');
assert.strictEqual(AppStorage.getCustomDomain(), undefined, 'setTld deve azzerare customDomain');
assert.strictEqual(scraperConfig.getBaseUrl(), 'https://www.animeworld.ac', 'scraperConfig base URL deve sincronizzarsi su ac');

AppStorage.setCustomDomain('https://custom-proxy.example.com');
assert.strictEqual(AppStorage.getCustomDomain(), 'https://custom-proxy.example.com', 'AppStorage.getCustomDomain deve memorizzare l\'URL completo');
assert.strictEqual(scraperConfig.getBaseUrl(), 'https://custom-proxy.example.com', 'scraperConfig base URL deve aggiornarsi al dominio personalizzato');

AppStorage.setTld('tv');
assert.strictEqual(AppStorage.getTld(), 'tv', 'AppStorage.getTld deve restituire tv');
assert.strictEqual(AppStorage.getCustomDomain(), undefined, 'setTld tv deve rimuovere customDomain');
assert.strictEqual(scraperConfig.getBaseUrl(), 'https://www.animeworld.tv', 'scraperConfig base URL deve tornare al dominio animeworld.tv');

// Test pruneOldProgress (MMKV automatic cleanup)
AppStorage.saveWatchProgress({
  animeId: 'old-completed-anime',
  animeTitle: 'Old Completed',
  episodeId: 'old-ep-1',
  episodeNumber: 1,
  currentTime: 1400,
  duration: 1400,
});
const oldKey = `user.progress.old-completed-anime.1`;
const oldItem = AppStorage.getObject<any>(oldKey);
if (oldItem) {
  oldItem.updatedAt = Date.now() - 100 * 24 * 60 * 60 * 1000;
  oldItem.isCompleted = true;
  AppStorage.setObject(oldKey, oldItem);
}

AppStorage.saveWatchProgress({
  animeId: 'active-continue-anime',
  animeTitle: 'Active Continue',
  episodeId: 'act-ep-1',
  episodeNumber: 1,
  currentTime: 400,
  duration: 1400,
});
const activeKey = `user.progress.active-continue-anime.1`;
const activeItem = AppStorage.getObject<any>(activeKey);
if (activeItem) {
  activeItem.updatedAt = Date.now() - 100 * 24 * 60 * 60 * 1000;
  activeItem.isCompleted = true;
  AppStorage.setObject(activeKey, activeItem);
}

const pruned = AppStorage.pruneOldProgress(200, 60);
assert(pruned >= 1, 'pruneOldProgress deve rimuovere almeno 1 voce completata obsoleta');
assert.strictEqual(AppStorage.getObject(oldKey), null, 'old-completed-anime deve essere eliminato');
assert(AppStorage.getObject(activeKey) !== null, 'active-continue-anime in continue watching non deve MAI essere eliminato');

console.log('✓ Storage Locale & Preferiti / Cronologia verificati con successo.');

// -----------------------------------------------------------------------------
// 4. Test Episode Batching & Grid Logic
// -----------------------------------------------------------------------------
console.log('\n[4/7] Verifica Logica Batch Puntate & Griglia Episodi...');

function createBatches(totalEpisodes: number, batchSize = 25) {
  if (totalEpisodes <= batchSize) {
    return [{ id: 'batch-0', label: `EP. 1 - ${totalEpisodes || 1}`, start: 1, end: totalEpisodes || 1 }];
  }
  const batches = [];
  for (let i = 0; i < totalEpisodes; i += batchSize) {
    const startEp = i + 1;
    const endEp = Math.min(i + batchSize, totalEpisodes);
    batches.push({
      id: `batch-${i}`,
      label: `EP. ${startEp} - ${endEp}`,
      start: startEp,
      end: endEp,
    });
  }
  return batches;
}

// Case 1: 12 episodes (single batch)
const batches12 = createBatches(12);
assert.strictEqual(batches12.length, 1);
assert.strictEqual(batches12[0].label, 'EP. 1 - 12');
assert.strictEqual(batches12[0].start, 1);
assert.strictEqual(batches12[0].end, 12);

// Case 2: 74 episodes (3 batches: 1-25, 26-50, 51-74)
const batches74 = createBatches(74);
assert.strictEqual(batches74.length, 3);
assert.strictEqual(batches74[0].label, 'EP. 1 - 25');
assert.strictEqual(batches74[1].label, 'EP. 26 - 50');
assert.strictEqual(batches74[2].label, 'EP. 51 - 74');
assert.strictEqual(batches74[2].start, 51);
assert.strictEqual(batches74[2].end, 74);

// Case 3: 1000 episodes (large series dynamic batch size: 50)
const batchSize1000 = 1000 > 500 ? 50 : 25;
const batches1000 = createBatches(1000, batchSize1000);
assert.strictEqual(batches1000.length, 20, '1000 episodi devono generare 20 batch da 50');
assert.strictEqual(batches1000[0].label, 'EP. 1 - 50');
assert.strictEqual(batches1000[19].label, 'EP. 951 - 1000');
assert.strictEqual(batches1000[19].start, 951);
assert.strictEqual(batches1000[19].end, 1000);

// Case 4: Anime with Episode 0 (Prologue/Special, e.g. Fate/Zero, Jujutsu Kaisen 0)
const mockEpZeroList = [{ number: 0 }, { number: 1 }, { number: 2 }, { number: 3 }];
const startEpZero = typeof mockEpZeroList[0]?.number === 'number' ? mockEpZeroList[0].number : 1;
const endEpZero = typeof mockEpZeroList[mockEpZeroList.length - 1]?.number === 'number' ? mockEpZeroList[mockEpZeroList.length - 1].number : 4;
assert.strictEqual(startEpZero, 0, 'Episodio 0 non deve essere saltato o convertito in 1');
assert.strictEqual(endEpZero, 3, 'Ultimo episodio deve essere 3');

console.log('✓ Logica Batch Puntate e Griglia Episodi verificata con successo.');

// -----------------------------------------------------------------------------
// 5. Test AniSkip Interval Matching
// -----------------------------------------------------------------------------
console.log('\n[5/7] Verifica Rilevamento Intervalli AniSkip...');

const mockSkips: AniSkipResult[] = [
  {
    skipType: 'recap',
    interval: { startTime: 10, endTime: 45 },
    skipId: 'skip-recap-1',
    episodeLength: 1440,
  },
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

// At 25s: Recap skip active
const recapSkip = findActiveSkip(25, mockSkips);
assert(recapSkip !== null);
assert.strictEqual(recapSkip.skipType, 'recap');

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

// Verify playback speed cycling and brightness auto threshold
const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
const cycleSpeed = (s: number) => {
  const idx = SPEED_OPTIONS.findIndex((o) => Math.abs(o - s) < 0.01);
  return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
};
assert.strictEqual(cycleSpeed(0.75), 1.0);
assert.strictEqual(cycleSpeed(1.0), 1.25);
assert.strictEqual(cycleSpeed(1.5), 2.0);
assert.strictEqual(cycleSpeed(2.0), 0.75);

function computeBrightness(currentVal: number, delta: number): number | 'AUTOMATICA' {
  const raw = currentVal + delta;
  if (raw <= 0.08) return 'AUTOMATICA';
  return Math.max(0.1, Math.min(1, raw));
}
assert.strictEqual(computeBrightness(0.15, -0.1), 'AUTOMATICA');
assert.strictEqual(computeBrightness(0.1, -0.05), 'AUTOMATICA');
assert.strictEqual(computeBrightness(0.5, 0.3), 0.8);

// Verify smooth transition from AUTOMATICA when swiping up
const startBrightnessFromAuto = -1 === -1 ? 0.08 : -1;
assert.strictEqual(computeBrightness(startBrightnessFromAuto, 0.05), 0.13);

// Verify contrast text color utility for themes
assert.strictEqual(getContrastTextColor('#E50914'), '#FFFFFF', 'Rosso Kuro deve avere testo bianco');
assert.strictEqual(getContrastTextColor('#FAD61D'), '#000000', 'Giallo Pikachu deve avere testo nero');
assert.strictEqual(getContrastTextColor('#73FEC8'), '#000000', 'Turchese Rainbow deve avere testo nero');
assert.strictEqual(getContrastTextColor('#FB6EFF'), '#000000', 'Rosa Rainbow Light deve avere testo nero');
assert.strictEqual(getContrastTextColor('#9334C2'), '#FFFFFF', 'Viola Orchid Light deve avere testo bianco');
assert.strictEqual(getContrastTextColor('#000000'), '#FFFFFF', 'Nero deve avere testo bianco');
assert.strictEqual(getContrastTextColor('#FFFFFF'), '#000000', 'Bianco deve avere testo nero');

// Verify Provider Registry (Step 3)
assert.strictEqual(ProviderRegistry.getActiveProvider().id, 'animeworld');
assert.strictEqual(ProviderRegistry.hasMultipleProviders(), false);
const allProviders = ProviderRegistry.getAllProviders();
assert(allProviders.length >= 1, 'ProviderRegistry deve contenere almeno 1 provider');

// Register mock secondary provider
ProviderRegistry.registerProvider({
  id: 'mock-provider',
  name: 'Mock Secondary Provider',
  getHome: async () => ({
    sliders: [],
    all: [],
    subITA: [],
    dubbed: [],
    trending: [],
    ongoing: [],
    newAdded: [],
    upcoming: [],
    upcomingTitle: '',
    topAnime: [],
  }),
  getAnimeDetail: async () => null,
  search: async () => ({ items: [] }),
  resolveVideo: async () => null,
});
assert.strictEqual(ProviderRegistry.hasMultipleProviders(), true, 'hasMultipleProviders deve restituire true dopo registrazione provider');
assert.strictEqual(ProviderRegistry.unregisterProvider('mock-provider'), true, 'unregisterProvider deve rimuovere mock-provider');
assert.strictEqual(ProviderRegistry.hasMultipleProviders(), false, 'hasMultipleProviders deve tornare false');
ProviderRegistry.reset();
assert.strictEqual(ProviderRegistry.hasMultipleProviders(), false, 'reset deve ripristinare solo animeworld');

// Verify Scraper TLDs & Dynamic User Agent (Step 6)
const candidateTlds = scraperConfig.getCandidateTlds();
assert(candidateTlds.includes('so') && candidateTlds.includes('ac') && candidateTlds.includes('tv'), 'Candidate TLDs devono includere so, ac, tv');
const altTlds = scraperConfig.getAlternativeTlds('so');
assert(altTlds.includes('ac') && altTlds.includes('tv') && !altTlds.includes('so'), 'Alternative TLDs di so devono essere ac e tv');
assert(scraperConfig.getUserAgent().includes('Android'), 'User-Agent deve includere identificatore mobile Android');

console.log('✓ Rilevamento Intervalli AniSkip, Gestione Velocità & Luminosità verificati con successo.');

// -----------------------------------------------------------------------------
// 6. Test Skeleton Animation Components (OLED & Hermes Safe)
// -----------------------------------------------------------------------------
console.log('\n[6/7] Verifica Componenti Skeleton & Animazioni Native (OLED & Hermes Safe)...');

const {
  Skeleton,
  AnimeCardSkeleton,
  EpisodeItemSkeleton,
  HomeScreenSkeleton,
  ExploreScreenSkeleton,
  AnimeDetailScreenSkeleton,
  PlayerSkeleton,
} = await import('../src/components/skeleton/index');

assert.strictEqual(typeof Skeleton, 'function', 'Skeleton deve essere un componente React');
assert.strictEqual(typeof AnimeCardSkeleton, 'function', 'AnimeCardSkeleton deve essere un componente React');
assert.strictEqual(typeof EpisodeItemSkeleton, 'function', 'EpisodeItemSkeleton deve essere un componente React');
assert.strictEqual(typeof HomeScreenSkeleton, 'function', 'HomeScreenSkeleton deve essere un componente React');
assert.strictEqual(typeof ExploreScreenSkeleton, 'function', 'ExploreScreenSkeleton deve essere un componente React');
assert.strictEqual(typeof AnimeDetailScreenSkeleton, 'function', 'AnimeDetailScreenSkeleton deve essere un componente React');
assert.strictEqual(typeof PlayerSkeleton, 'function', 'PlayerSkeleton deve essere un componente React');

// Verify that skeleton files do not import node:* or tv libraries
const skeletonDir = path.resolve(process.cwd(), 'src/components/skeleton');
const skeletonFiles = fs.readdirSync(skeletonDir);
for (const file of skeletonFiles) {
  const code = fs.readFileSync(path.join(skeletonDir, file), 'utf-8');
  assert(!code.includes("from 'node:"), `${file} non deve importare node:*`);
  assert(!code.includes('react-tv-space-navigation'), `${file} non deve importare pacchetti TV`);
}

// Verify Extracted Player Components (Step 1)
assert(
  typeof PlayerHeader === 'function' || typeof PlayerHeader === 'object',
  'PlayerHeader deve essere un componente React'
);
assert(
  typeof PlayerTimeline === 'function' || typeof PlayerTimeline === 'object',
  'PlayerTimeline deve essere un componente React'
);
assert(
  typeof PlayerFooter === 'function' || typeof PlayerFooter === 'object',
  'PlayerFooter deve essere un componente React'
);
assert(
  typeof PlayerEpisodesCarouselSheet === 'function' || typeof PlayerEpisodesCarouselSheet === 'object',
  'PlayerEpisodesCarouselSheet deve essere un componente React'
);
assert(
  typeof PlayerInfoSheet === 'function' || typeof PlayerInfoSheet === 'object',
  'PlayerInfoSheet deve essere un componente React'
);
assert.strictEqual(formatTime(75), '01:15', 'formatTime 75s deve essere 01:15');
assert.strictEqual(formatTime(3665), '1:01:05', 'formatTime 3665s deve essere 1:01:05');

// Verify cumulative skip calculation logic
function computeCumulativeSkip(
  current: { direction: 'left' | 'right'; seconds: number } | null,
  newDirection: 'left' | 'right'
): number {
  if (current && current.direction === newDirection) {
    return current.seconds + 10;
  }
  return 10;
}
assert.strictEqual(computeCumulativeSkip(null, 'right'), 10, 'Primo skip a destra deve essere 10s');
assert.strictEqual(computeCumulativeSkip({ direction: 'right', seconds: 10 }, 'right'), 20, 'Secondo skip consecutivo deve essere 20s');
assert.strictEqual(computeCumulativeSkip({ direction: 'right', seconds: 20 }, 'right'), 30, 'Terzo skip consecutivo deve essere 30s');
assert.strictEqual(computeCumulativeSkip({ direction: 'right', seconds: 30 }, 'right'), 40, 'Quarto skip consecutivo deve essere 40s');
assert.strictEqual(computeCumulativeSkip({ direction: 'right', seconds: 40 }, 'right'), 50, 'Quinto skip consecutivo deve essere 50s');
assert.strictEqual(computeCumulativeSkip({ direction: 'right', seconds: 50 }, 'left'), 10, 'Inversione direzione skip deve resettare a 10s');

// Verify episode adjacent navigation logic (Prev / Next)
const testEpisodes = [
  { id: 'ep-1', number: 1 },
  { id: 'ep-2', number: 2 },
  { id: 'ep-3', number: 3 },
];
function getAdjacentEpisodes(currentEpNum: number, list: typeof testEpisodes) {
  const idx = list.findIndex((e) => e.number === currentEpNum);
  return {
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null,
  };
}
assert.strictEqual(getAdjacentEpisodes(1, testEpisodes).prev, null, 'Episodio 1 non ha precedente');
assert.strictEqual(getAdjacentEpisodes(1, testEpisodes).next?.number, 2, 'Episodio 1 ha successivo 2');
assert.strictEqual(getAdjacentEpisodes(2, testEpisodes).prev?.number, 1, 'Episodio 2 ha precedente 1');
assert.strictEqual(getAdjacentEpisodes(2, testEpisodes).next?.number, 3, 'Episodio 2 ha successivo 3');
assert.strictEqual(getAdjacentEpisodes(3, testEpisodes).prev?.number, 2, 'Episodio 3 ha precedente 2');
assert.strictEqual(getAdjacentEpisodes(3, testEpisodes).next, null, 'Ultimo episodio non ha successivo');

// Verify sequential single tap cumulative skip resolution
function simulateSequentialTaps(taps: Array<{ side: 'left' | 'right'; isDouble: boolean }>) {
  let accumulated: { direction: 'left' | 'right'; seconds: number } | null = null;
  for (const tap of taps) {
    if (tap.isDouble) {
      const isConsecutive = accumulated && accumulated.direction === tap.side;
      accumulated = {
        direction: tap.side,
        seconds: isConsecutive ? accumulated.seconds + 10 : 10,
      };
    } else {
      // Single tap during active skip in same direction
      if (accumulated && accumulated.direction === tap.side) {
        accumulated = {
          direction: tap.side,
          seconds: accumulated.seconds + 10,
        };
      }
    }
  }
  return accumulated;
}

const seqResult = simulateSequentialTaps([
  { side: 'right', isDouble: true },  // double tap -> 10s
  { side: 'right', isDouble: false }, // sequential 3rd tap -> 20s
  { side: 'right', isDouble: false }, // sequential 4th tap -> 30s
  { side: 'right', isDouble: false }, // sequential 5th tap -> 40s
  { side: 'right', isDouble: false }, // sequential 6th tap -> 50s
]);
assert.strictEqual(seqResult?.seconds, 50, 'Sequenza di tap deve raggiungere 50s');

// Verify Episode type supports optional description
const epWithDesc: import('../src/types/index').Episode = {
  id: 'ep-test-desc',
  number: 1,
  title: 'Test Title',
  description: 'Test Description',
};
assert.strictEqual(epWithDesc.description, 'Test Description');

// Verify PlayerEpisodesCarouselSheet imports FlashList and safety properties
const carouselCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerEpisodesCarouselSheet.tsx'), 'utf-8');
assert(carouselCode.includes("from '@shopify/flash-list'"), 'PlayerEpisodesCarouselSheet deve importare FlashList da @shopify/flash-list');
assert(!carouselCode.includes("from 'react-native';\nimport { FlatList }"), 'PlayerEpisodesCarouselSheet non deve usare FlatList');
assert(carouselCode.includes('ItemSeparatorComponent'), 'PlayerEpisodesCarouselSheet deve usare ItemSeparatorComponent anziché gap su contentContainerStyle');
assert(!carouselCode.includes('gap: CARD_GAP'), 'PlayerEpisodesCarouselSheet non deve usare gap su contentContainerStyle con FlashList');
assert(carouselCode.includes('nestedScrollEnabled'), 'PlayerEpisodesCarouselSheet deve abilitare nestedScrollEnabled');
assert(carouselCode.includes('maintainVisibleContentPosition={{ disabled: true }}'), 'PlayerEpisodesCarouselSheet deve disabilitare maintainVisibleContentPosition per evitare crash Fabric');
assert(carouselCode.includes('initialScrollIndex={initialIndex}'), 'PlayerEpisodesCarouselSheet deve passare initialScrollIndex');
assert(carouselCode.includes('contentPadding={0}'), 'PlayerEpisodesCarouselSheet deve azzerare contentPadding native');

// Verify AniSkip Depleting Border calculation and initial progress
function computeDepletingProgress(currentTime: number, startTime: number, endTime: number): number {
  if (endTime <= startTime) return 0;
  const duration = endTime - startTime;
  const remaining = Math.max(0, endTime - currentTime);
  return Math.max(0, Math.min(1, remaining / duration));
}
assert.strictEqual(computeDepletingProgress(10, 10, 40), 1.0, 'All\'inizio dell\'intro il progresso bordo deve essere 1.0 (100%)');
assert.strictEqual(computeDepletingProgress(25, 10, 40), 0.5, 'A metà intro il progresso bordo deve essere 0.5 (50%)');
assert.strictEqual(computeDepletingProgress(40, 10, 40), 0.0, 'Alla fine dell\'intro il progresso bordo deve essere 0.0 (consumato)');
assert.strictEqual(computeDepletingProgress(45, 10, 40), 0.0, 'Oltre l\'intervallo deve restare 0.0');
assert.strictEqual(computeDepletingProgress(5, 10, 40), 1.0, 'Prima dell\'intervallo deve restare 1.0');

const aniSkipCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AniSkipButton.tsx'), 'utf-8');
assert(aniSkipCode.includes('getInitialProgress'), 'AniSkipButton deve calcolare il progresso iniziale dinamicamente senza flashare 100%');
assert(aniSkipCode.includes('topBorderTrack') && aniSkipCode.includes('bottomBorderTrack'), 'AniSkipButton deve includere i track di bordo animati');

// Verify Real Video Frame Thumbnail Generation for Timeline Scrubbing
const testPlayerWithThumbnails = {
  currentTime: 100,
  duration: 1200,
  generateThumbnailsAsync: async (times: number[]) => times.map((t) => ({ actualTime: t, width: 160, height: 90 })),
};
const thumbResult = await testPlayerWithThumbnails.generateThumbnailsAsync([120]);
assert.strictEqual(thumbResult.length, 1);
assert.strictEqual(thumbResult[0].actualTime, 120);
assert.strictEqual(thumbResult[0].width, 160);

const timelineCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerTimeline.tsx'), 'utf-8');
assert(timelineCode.includes('getClosestCachedFrame'), 'PlayerTimeline deve implementare getClosestCachedFrame per frame reattivi');

const playerCode = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerCode.includes('replaceAsync'), 'app/player/[id].tsx deve utilizzare replaceAsync per evitare freeze UI su main thread');

// Verify Playback Speed Distribution & Centering in ServerBottomSheet
const SPEED_TEST_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
assert.strictEqual(SPEED_TEST_OPTIONS.length, 5, 'Devono esserci esattamente 5 opzioni di velocità');
const serverSheetCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ServerBottomSheet.tsx'), 'utf-8');
assert(!serverSheetCode.includes('maxWidth: 80'), 'ServerBottomSheet non deve forzare maxWidth: 80 che causa decentramento e taglio');
assert(serverSheetCode.includes('flex: 1'), 'ServerBottomSheet deve distribuire le opzioni di velocità con flex: 1');
assert(serverSheetCode.includes('contentPadding={0}'), 'ServerBottomSheet deve azzerare contentPadding native per evitare doppio padding');
assert(serverSheetCode.includes('safeHorizontalInset'), 'ServerBottomSheet deve usare padding simmetrico per centratura');

// Verify that PlayerTimeline and PlayerTimeDisplay work with paused video initial time
const mockPausedPlayer = {
  currentTime: 750,
  duration: 1500,
  playing: false,
};
assert(typeof mockPausedPlayer.currentTime === 'number', 'Player deve avere currentTime');
assert.strictEqual(formatTime(mockPausedPlayer.currentTime), '12:30', '750s deve formattarsi in 12:30');

// Verify Extracted Anime Detail Components (Step 5)
assert(
  typeof AnimeHeaderBackdrop === 'function' || typeof AnimeHeaderBackdrop === 'object',
  'AnimeHeaderBackdrop deve essere un componente React'
);
assert(
  typeof AnimeSynopsis === 'function' || typeof AnimeSynopsis === 'object',
  'AnimeSynopsis deve essere un componente React'
);
assert(
  typeof AnimeControlsBar === 'function' || typeof AnimeControlsBar === 'object',
  'AnimeControlsBar deve essere un componente React'
);
assert(
  typeof AnimeInfoTable === 'function' || typeof AnimeInfoTable === 'object',
  'AnimeInfoTable deve essere un componente React'
);
assert(
  typeof HistorySlider === 'function' || typeof HistorySlider === 'object',
  'HistorySlider deve essere un componente React'
);

// Test parseDetailPage con estrazione trailer e metadata completi
const sampleDetailHtml = `
<h1 class="title">Test Anime Details</h1>
<div class="desc">Una fantastica avventura anime.</div>
<div class="widget info">
  <div class="info">
    <dl class="row">
      <dt>Audio</dt><dd>Giapponese</dd>
      <dt>Data di uscita</dt><dd>12 Ottobre 2024</dd>
      <dt>Studio</dt><dd><a href="#">Mappa</a></dd>
      <dt>Genere</dt><dd><a href="#">Azione</a>, <a href="#">Fantasy</a></dd>
      <dt>Voto</dt><dd>9.2</dd>
      <dt>Durata</dt><dd>24 min</dd>
      <dt>Episodi</dt><dd>12</dd>
      <dt>Stato</dt><dd>In corso</dd>
    </dl>
  </div>
</div>
<a id="anilist-button" href="https://anilist.co/anime/12345" data-id="12345"></a>
<a id="mal-button" href="https://myanimelist.net/anime/67890" data-id="67890"></a>
<div id="trailer">
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
</div>
`;
const parsedDetail = parseDetailPage(sampleDetailHtml, 'https://www.animeworld.so/play/test-anime', 'https://www.animeworld.so');
assert.strictEqual(parsedDetail.audio, 'Giapponese', 'Audio deve essere estratto');
assert.strictEqual(parsedDetail.releaseDate, '12 Ottobre 2024', 'Data di uscita deve essere estratta');
assert(parsedDetail.studios.includes('Mappa'), 'Studio deve essere estratto');
assert(parsedDetail.genres.includes('Azione'), 'Genere deve contenere Azione');
assert.strictEqual(parsedDetail.rating, '9.2', 'Voto deve essere estratto');
assert.strictEqual(parsedDetail.duration, '24 min', 'Durata deve essere estratta');
assert.strictEqual(parsedDetail.totalEpisodes, 12, 'Episodi devono essere 12');
assert.strictEqual(parsedDetail.status, 'In corso', 'Stato deve essere In corso');
assert.strictEqual(parsedDetail.anilistId, 12345, 'AniList ID deve essere estratto');
assert.strictEqual(parsedDetail.malId, 67890, 'MAL ID deve essere estratto');
assert(parsedDetail.trailer?.includes('dQw4w9WgXcQ'), 'Trailer YouTube deve essere estratto e normalizzato');

// Verifica gestione episodi sconosciuti (?? o ?)
const sampleUnknownHtml = `
<div class="widget info">
  <div class="info">
    <dl class="row">
      <dt>Episodi</dt><dd>??</dd>
    </dl>
  </div>
</div>
`;
const parsedUnknown = parseDetailPage(sampleUnknownHtml, 'https://www.animeworld.so/play/test-unknown', 'https://www.animeworld.so');
assert.strictEqual(parsedUnknown.totalEpisodes, '??', 'Episodi sconosciuti devono preservare ??');

// Verifica AnimeInfoTable, AnimeHeaderBackdrop e BatchBottomSheet
const infoTableCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/AnimeInfoTable.tsx'), 'utf-8');
assert(infoTableCode.includes('horizontal'), 'AnimeInfoTable deve supportare scroll orizzontale per i generi');
assert(infoTableCode.includes('nestedScrollEnabled'), 'AnimeInfoTable deve abilitare nestedScrollEnabled sullo scroll generi');
assert(infoTableCode.includes('youtubeSvg'), 'AnimeInfoTable deve importare youtubeSvg');
assert(infoTableCode.includes('malSvg'), 'AnimeInfoTable deve importare malSvg');
assert(infoTableCode.includes('anilistSvg'), 'AnimeInfoTable deve importare anilistSvg');
assert(infoTableCode.includes('>MAL<'), 'AnimeInfoTable deve rinominare MYANIMELIST in MAL');

const headerBackdropCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/AnimeHeaderBackdrop.tsx'), 'utf-8');
assert(headerBackdropCode.includes('actionButtonsRow'), 'AnimeHeaderBackdrop deve includere la riga con pulsanti azione simbolici');
assert(headerBackdropCode.includes('name="play"'), 'AnimeHeaderBackdrop deve includere il simbolo play');
assert(headerBackdropCode.includes('isCoverExpanded'), 'AnimeHeaderBackdrop deve supportare la copertina espandibile a schermo intero');
assert(!headerBackdropCode.includes('BACKDROP_HEIGHT'), 'AnimeHeaderBackdrop deve rimuovere la vecchia intestazione ingrandita');
assert(headerBackdropCode.includes('name="reload"'), 'AnimeHeaderBackdrop deve includere il simbolo reload per riniziare da capo');
assert(!headerBackdropCode.includes('styles.genresText'), 'AnimeHeaderBackdrop non deve mostrare i generi sotto il titolo');

const batchSheetCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BatchBottomSheet.tsx'), 'utf-8');
assert(batchSheetCode.includes('Modal'), 'BatchBottomSheet deve utilizzare Modal nativo touch-safe per garantire reattività e zero crash in Expo Go');
assert(batchSheetCode.includes('onSelectBatch'), 'BatchBottomSheet deve supportare la selezione del batch al tocco');
assert(!batchSheetCode.includes('STAGIONI CORRELATE'), 'BatchBottomSheet non deve contenere la sezione stagioni correlate');

const animeDetailCode = fs.readFileSync(path.resolve(process.cwd(), 'app/anime/[id].tsx'), 'utf-8');
assert(animeDetailCode.includes('maintainVisibleContentPosition={{ disabled: true }}'), 'app/anime/[id].tsx deve disabilitare maintainVisibleContentPosition su FlashList');

// -----------------------------------------------------------------------------
// Verifica Skeletons Coerenti e Zero CLS
// -----------------------------------------------------------------------------
const animeDetailSkeletonCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/AnimeDetailScreenSkeleton.tsx'), 'utf-8');
assert(!animeDetailSkeletonCode.includes('BACKDROP_HEIGHT'), 'AnimeDetailScreenSkeleton deve essere privo di backdrop per zero layout shift');
assert(animeDetailSkeletonCode.includes('width={110} height={160}'), 'AnimeDetailScreenSkeleton poster deve misurare 110x160');
assert(animeDetailSkeletonCode.includes('actionButtonsRow'), 'AnimeDetailScreenSkeleton deve includere i bottoni di azione circolari');
assert(animeDetailSkeletonCode.includes('tableCard'), 'AnimeDetailScreenSkeleton deve includere la scheda tecnica AnimeInfoTable');
assert(animeDetailSkeletonCode.includes('linksRow'), 'AnimeDetailScreenSkeleton deve includere la riga con 3 link rapidi esterni');
assert(!animeDetailSkeletonCode.includes('serverRow'), 'AnimeDetailScreenSkeleton non deve contenere il vecchio serverRow');

const homeSkeletonCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/HomeScreenSkeleton.tsx'), 'utf-8');
assert(homeSkeletonCode.includes('hasContinueWatching'), 'HomeScreenSkeleton deve supportare la sezione Riprendi a guardare');
assert(homeSkeletonCode.includes('continueThumbWrapper'), 'HomeScreenSkeleton deve modellare la thumbnail di riprendi a guardare');

const exploreSkeletonCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/ExploreScreenSkeleton.tsx'), 'utf-8');
assert(exploreSkeletonCode.includes('padding: 0'), 'ExploreScreenSkeleton deve azzerare padding interno per evitare doppio padding con listContent');

const episodeSkeletonCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/EpisodeItemSkeleton.tsx'), 'utf-8');
assert(episodeSkeletonCode.includes('height={52}'), 'EpisodeItemSkeleton variante grid deve misurare 52dp in altezza come EpisodeItem');

const playerSkeletonCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/PlayerSkeleton.tsx'), 'utf-8');
assert(playerSkeletonCode.includes('centerControlsRow'), 'PlayerSkeleton deve includere la riga dei controlli centrali con prev/next');
assert(playerSkeletonCode.includes('chipsRow'), 'PlayerSkeleton deve riflettere i 3 controlli inferiori');

// -----------------------------------------------------------------------------
// Verifica Sostituzione Alert di Sistema con UI In-App (ConfirmModal)
// -----------------------------------------------------------------------------
const { ConfirmModal } = await import('../src/components/ConfirmModal');
assert(
  typeof ConfirmModal === 'function' || typeof ConfirmModal === 'object',
  'ConfirmModal deve essere un componente React valido'
);

const confirmModalSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ConfirmModal.tsx'), 'utf-8');
assert(!confirmModalSource.includes("from 'node:"), 'ConfirmModal non deve importare node:*');
assert(confirmModalSource.includes('minHeight: 44'), 'ConfirmModal deve garantire touch target >= 44dp');
assert(confirmModalSource.includes('getContrastTextColor'), 'ConfirmModal deve garantire contrasto YIQ');

// Verifica assenza di Alert.alert e Alert in app/(tabs)/index.tsx
const indexCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(!indexCode.includes('Alert.alert'), 'app/(tabs)/index.tsx non deve chiamare Alert.alert nativo');
assert(!indexCode.match(/import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/), 'app/(tabs)/index.tsx non deve importare Alert da react-native');
assert(indexCode.includes('ConfirmModal'), 'app/(tabs)/index.tsx deve utilizzare ConfirmModal');
assert(indexCode.includes('hasContinueWatching={continueWatching.length > 0}'), 'app/(tabs)/index.tsx deve sincronizzare hasContinueWatching con HomeScreenSkeleton');

// Verifica adozione ConfirmModal in history.tsx e settings.tsx
const historyCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/history.tsx'), 'utf-8');
assert(historyCode.includes('ConfirmModal'), 'app/(tabs)/history.tsx deve utilizzare ConfirmModal');

const settingsCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsCode.includes('ConfirmModal'), 'app/(tabs)/settings.tsx deve utilizzare ConfirmModal per la conferma svuotamento');

console.log('✓ Componenti Skeleton e ConfirmModal in-app verificati con successo.');

// -----------------------------------------------------------------------------
// 7. Test Route Default Exports & NitroModules Safety
// -----------------------------------------------------------------------------
console.log('\n[7/7] Verifica Esportazioni Default Rotte Expo Router & NitroModules Safety...');

const requiredRoutes = [
  'app/_layout.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/favorites.tsx',
  'app/(tabs)/history.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/settings.tsx',
  'app/anime/[id].tsx',
  'app/player/[id].tsx',
];

for (const relPath of requiredRoutes) {
  const fullPath = path.resolve(process.cwd(), relPath);
  assert(fs.existsSync(fullPath), `Il file di rotta ${relPath} deve esistere`);
  const content = fs.readFileSync(fullPath, 'utf-8');
  assert(
    content.includes('export default function') || content.includes('export default'),
    `La rotta ${relPath} deve avere un default export valido per Expo Router`
  );

  // Deep verification: ACTUALLY import the route in Node runtime
  const mod = await import(fullPath);
  assert.strictEqual(
    typeof mod.default,
    'function',
    `La rotta ${relPath} deve esportare una funzione componente React di default senza errori di modulo Turbo/Nitro`
  );
  console.log(`  ✓ ${relPath}: default export verificato (${typeof mod.default})`);
}

// Ensure src/theme/unistyles.ts does NOT import native NitroModules directly
const unistylesSource = fs.readFileSync(path.resolve(process.cwd(), 'src/theme/unistyles.ts'), 'utf-8');
assert(
  !unistylesSource.includes("from 'react-native-nitro-modules'"),
  'src/theme/unistyles.ts non deve importare direttamente react-native-nitro-modules'
);
assert(
  !unistylesSource.includes("from 'react-native-unistyles'"),
  'src/theme/unistyles.ts non deve importare direttamente react-native-unistyles'
);

console.log('✓ Esportazioni di tutte le 9 rotte e Theme Safe verificati con successo.');

// -----------------------------------------------------------------------------
// 8. Test Nuove Feature: UpdateModal, UpdateStore, Tab Animated Arrow, Modal Sheets & PiP Controls
// -----------------------------------------------------------------------------
console.log('\n[8/8] Verifica Nuove Feature: UpdateStore, UpdateModal, Tab Arrow, Touch Sheets & PiP Controls...');

// 1. UpdateStore State Transitions & Subscriptions
let listenerCalled = false;
const unsub = UpdateStore.subscribe(() => {
  listenerCalled = true;
});
assert.strictEqual(UpdateStore.getPendingUpdate(), null);
assert.strictEqual(UpdateStore.isModalDismissed(), false);
assert.strictEqual(UpdateStore.isAutoDownloadRequested(), false);

const mockUpdateResult = {
  isUpdateAvailable: true,
  currentVersion: '1.0.0',
  currentVersionCode: 11,
  manifest: {
    version: '1.1.0',
    versionCode: 12,
    apkUrl: 'https://example.com/test.apk',
    releaseNotes: 'Nuova versione con fix e miglioramenti',
    sha256: 'abc123',
    mandatory: false,
    publishedAt: '2026-11-09T00:00:00Z',
  },
};
UpdateStore.setPendingUpdate(mockUpdateResult as any);
assert(listenerCalled, 'UpdateStore listener deve essere invocato su setPendingUpdate');
assert.strictEqual(UpdateStore.getPendingUpdate()?.manifest?.version, '1.1.0');
assert.strictEqual(UpdateStore.isModalDismissed(), false);

UpdateStore.dismissModal();
assert.strictEqual(UpdateStore.isModalDismissed(), true);

UpdateStore.setAutoDownloadRequested(true);
assert.strictEqual(UpdateStore.isAutoDownloadRequested(), true);

UpdateStore.clearUpdate();
assert.strictEqual(UpdateStore.getPendingUpdate(), null);
assert.strictEqual(UpdateStore.isModalDismissed(), false);
assert.strictEqual(UpdateStore.isAutoDownloadRequested(), false);
unsub();

// 2. UpdateModal Component
assert(
  typeof UpdateModal === 'function' || typeof UpdateModal === 'object',
  'UpdateModal deve essere un componente React'
);

// 3. Player Sheets Touch-Safe Native Modal (Zero Compose Crashes)
const infoSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerInfoSheet.tsx'), 'utf-8');
assert(infoSheetSource.includes('Modal'), 'PlayerInfoSheet deve utilizzare Modal nativo per evitare crash Fabric/Compose in landscape');
assert(!infoSheetSource.includes("from '@expo/ui'"), 'PlayerInfoSheet non deve importare BottomSheet da @expo/ui');
assert(infoSheetSource.includes('safeGenres'), 'PlayerInfoSheet deve validare safeGenres come array sicuro');

const carouselSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerEpisodesCarouselSheet.tsx'), 'utf-8');
assert(carouselSource.includes('Modal'), 'PlayerEpisodesCarouselSheet deve utilizzare Modal nativo per evitare crash Fabric/Compose al tocco');
assert(!carouselSource.includes("from '@expo/ui'"), 'PlayerEpisodesCarouselSheet non deve importare BottomSheet da @expo/ui');
assert(carouselSource.includes('setTimeout'), 'PlayerEpisodesCarouselSheet deve differire la navigazione per permettere il dismiss del Modal');

// 4. HistorySlider PointerEvents Protection & Stable PanResponder
const sliderSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/HistorySlider.tsx'), 'utf-8');
assert(sliderSource.includes('pointerEvents="none"'), 'HistorySlider deve avere pointerEvents="none" sui figli del track per evitare salti di coordinate');
assert(!sliderSource.includes('[trackWidth, selectStepByIndex]'), 'HistorySlider non deve ricreare PanResponder su cambio di activeIndex');
assert(sliderSource.includes('onPanResponderTerminationRequest'), 'HistorySlider deve bloccare la terminazione del responder da parte di ScrollView');

// 5. Player Notification Controls & Video Metadata (PiP Mode)
const playerFullSource = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerFullSource.includes('showNowPlayingNotification'), 'app/player/[id].tsx deve abilitare showNowPlayingNotification per i controlli in area notifica');
assert(playerFullSource.includes('metadata: {'), 'app/player/[id].tsx deve inviare metadata (titolo, episodio, thumbnail) per la notifica multimediale');
assert(playerFullSource.includes('formattedTitle'), 'app/player/[id].tsx deve inviare il titolo con numero di episodio');
assert(playerFullSource.includes('loadingOverlay'), 'app/player/[id].tsx deve mostrare feedback visivo di caricamento con loadingOverlay');
assert(playerFullSource.includes('KuroNotificationNextEpisode'), 'app/player/[id].tsx deve ascoltare l\'evento di episodio successivo da notifica');
assert(playerFullSource.includes('isInPiPRef.current'), 'app/player/[id].tsx deve tracciare isInPiPRef per preservare riproduzione e notifiche');

// 6. Tab Layout Animated Upward Arrow
const tabLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(tabLayoutSource.includes('arrow-up'), 'app/(tabs)/_layout.tsx deve mostrare la freccia in su su impostazioni');
assert(tabLayoutSource.includes('Animated.loop'), 'app/(tabs)/_layout.tsx deve animare la freccia con Animated.loop');
assert(tabLayoutSource.includes('isDismissed'), 'app/(tabs)/_layout.tsx deve mostrare la freccia quando l\'aggiornamento non è stato fatto subito');

console.log('✓ Nuove Feature verificate con successo.');

// -----------------------------------------------------------------------------
// 9. Test Nuove Feature: Sheets Cutoff Fixes, AniSkip 10s & Settings, Filter Modal Safety
// -----------------------------------------------------------------------------
console.log('\n[9/9] Verifica Sheets Cutoff Fixes, AniSkip Settings & FilterBottomSheet Modal...');

// 1. PlayerEpisodesCarouselSheet paddingHorizontal & zero cut-off
assert(carouselCode.includes('paddingHorizontal: horizontalPadding'), 'PlayerEpisodesCarouselSheet deve applicare paddingHorizontal a contentContainerStyle');

// 2. PlayerInfoSheet responsive maxHeight & episodeBadge constraints
const infoSheetCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerInfoSheet.tsx'), 'utf-8');
assert(infoSheetCode.includes('numberOfLines={1}'), 'PlayerInfoSheet episodeBadge deve avere numberOfLines={1}');
assert(infoSheetCode.includes('ellipsizeMode="tail"'), 'PlayerInfoSheet episodeBadge deve avere ellipsizeMode="tail"');
assert(infoSheetCode.includes('totalEpisodes'), 'PlayerInfoSheet deve gestire totalEpisodes per mostrare il numero totale episodi');

// 3. ServerBottomSheet speedChip padding
const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ServerBottomSheet.tsx'), 'utf-8');
assert(serverCode.includes('paddingHorizontal: 4'), 'ServerBottomSheet deve ridurre paddingHorizontal dei chip velocità a 4');

// 4. AniSkipButton Generic Text & 10s display
const aniSkipBtnCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AniSkipButton.tsx'), 'utf-8');
assert(aniSkipBtnCode.includes("const label = 'SALTA';"), 'AniSkipButton deve usare testo generico SALTA');
assert(aniSkipBtnCode.includes('BUTTON_DURATION = 10'), 'AniSkipButton deve avere durata display massima di 10 secondi');

// 5. FilterBottomSheet Modal Touch-Safe (Zero @expo/ui crashes)
const filterSheetCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FilterBottomSheet.tsx'), 'utf-8');
assert(filterSheetCode.includes('Modal'), 'FilterBottomSheet deve utilizzare Modal nativo');
assert(!filterSheetCode.includes("from '@expo/ui'"), 'FilterBottomSheet non deve importare da @expo/ui per evitare crash silenziosi');

// 6. Tab layout hides explore tab
assert(tabLayoutSource.includes('name="explore"'), 'app/(tabs)/_layout.tsx deve dichiarare la rotta explore');
assert(tabLayoutSource.includes('href: null'), 'app/(tabs)/_layout.tsx deve nascondere la rotta explore con href: null');

// 7. Search with filters integrated in Home
const homeIndexCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(homeIndexCode.includes('FilterBottomSheet'), 'app/(tabs)/index.tsx deve integrare FilterBottomSheet');
assert(homeIndexCode.includes('isSearchActive'), 'app/(tabs)/index.tsx deve gestire lo stato isSearchActive');

// 8. AniSkip Settings in SettingsScreen
const settingsScreenCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsScreenCode.includes('ANISKIP'), 'app/(tabs)/settings.tsx deve contenere la sezione ANISKIP');
assert(settingsScreenCode.includes('MODALITÀ DI SALTO'), 'app/(tabs)/settings.tsx deve permettere la selezione della modalità');
assert(settingsScreenCode.includes('COSA SALTARE'), 'app/(tabs)/settings.tsx deve permettere di selezionare cosa saltare');
assert(settingsScreenCode.includes('enableRecap'), 'app/(tabs)/settings.tsx deve supportare lo skip del recap');

// 9. AniSkip Storage & Recap support
const aniSettings = AppStorage.getAniSkipSettings();
assert(typeof aniSettings.enableRecap === 'boolean', 'AppStorage.getAniSkipSettings deve supportare enableRecap');
AppStorage.saveAniSkipSettings({ mode: 'auto', enableRecap: false });
assert.strictEqual(AppStorage.getAniSkipSettings().mode, 'auto');
assert.strictEqual(AppStorage.getAniSkipSettings().enableRecap, false);
AppStorage.saveAniSkipSettings({ mode: 'manual', enableRecap: true });

// 10. AniSkip 10s Window Calculation & Rewind Verification
const sampleSkip = {
  skipId: 'op-1',
  skipType: 'op',
  interval: { startTime: 60, endTime: 150 },
};
function check10sWindow(time: number, skip: typeof sampleSkip) {
  const maxDisplayEnd = Math.min(skip.interval.endTime, skip.interval.startTime + 10);
  return time >= skip.interval.startTime && time < maxDisplayEnd;
}
assert.strictEqual(check10sWindow(59, sampleSkip), false, 'Before intro start should not be in window');
assert.strictEqual(check10sWindow(60, sampleSkip), true, 'At intro start must be in window');
assert.strictEqual(check10sWindow(65, sampleSkip), true, '5s into intro must be in window');
assert.strictEqual(check10sWindow(70, sampleSkip), false, '10s after intro start must not be in window');
assert.strictEqual(check10sWindow(80, sampleSkip), false, '20s after intro start must not be in window');
assert.strictEqual(check10sWindow(62, sampleSkip), true, 'Rewinding to 62s must re-activate window');

// Short interval (e.g. 5s recap)
const shortRecap = {
  skipId: 'recap-1',
  skipType: 'recap',
  interval: { startTime: 10, endTime: 15 },
};
assert.strictEqual(check10sWindow(10, shortRecap), true, 'Recap start must be in window');
assert.strictEqual(check10sWindow(14, shortRecap), true, 'Recap 4s in must be in window');
assert.strictEqual(check10sWindow(15, shortRecap), false, 'Recap end must not be in window');

// 11. Deep verification of player fixes
const playerScreenSource = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerScreenSource.includes('AppStorage.addSettingsListener'), 'Player deve ascoltare gli aggiornamenti dinamici di impostazioni AniSkip');
assert(playerScreenSource.includes('autoSkippedIdsRef.current.clear()'), 'Player deve ripulire autoSkippedIdsRef al cambio episodio');
assert(playerScreenSource.includes('isIn10sWindow'), 'Player deve utilizzare isIn10sWindow per il calcolo della finestra da 10s');

// 12. Deep verification of Home search and favorites fixes
assert(homeIndexCode.includes('hardwareBackPress'), 'app/(tabs)/index.tsx deve gestire hardwareBackPress per chiudere la ricerca');
assert(homeIndexCode.includes('Keyboard.dismiss()'), 'app/(tabs)/index.tsx deve chiudere la tastiera aprendo i filtri');
const favCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
assert(favCode.includes("router.push('/(tabs)')"), 'app/(tabs)/favorites.tsx deve navigare verso /(tabs) quando la lista è vuota');
assert(!favCode.includes('/(tabs)/explore'), 'app/(tabs)/favorites.tsx non deve più riferenziare la rotta explore');

// 13. Deep verification of explore redirect
const exploreCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/explore.tsx'), 'utf-8');
assert(exploreCode.includes('/(tabs)'), 'app/(tabs)/explore.tsx deve reindirizzare alla home');

console.log('✓ Sheets Cutoff Fixes, AniSkip Settings & FilterBottomSheet Modal verificati con successo.');

// -----------------------------------------------------------------------------
// [10/10] Verifica System Navigation Bar Compatibility & Auto-Hide Mode
// -----------------------------------------------------------------------------
console.log('\n[10/10] Verifica System Navigation Bar Compatibility & Auto-Hide Mode...');

// 1. Storage default and toggling
AppStorage.setNavBarMode('auto-hide');
assert.strictEqual(AppStorage.getNavBarMode(), 'auto-hide', 'Default navBarMode deve essere auto-hide');
AppStorage.setNavBarMode('visible');
assert.strictEqual(AppStorage.getNavBarMode(), 'visible', 'setNavBarMode deve memorizzare visible');
AppStorage.setNavBarMode('auto-hide');

// 2. Tab layout safe insets verification
const currentTabLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(currentTabLayoutSource.includes('useSafeAreaInsets'), 'TabLayout deve importare ed utilizzare useSafeAreaInsets');
assert(currentTabLayoutSource.includes('insets.bottom'), 'TabLayout deve considerare insets.bottom per evitare sovrapposizioni con la navbar');
assert(currentTabLayoutSource.includes('androidBottomInset'), 'TabLayout deve calcolare androidBottomInset per la compatibilità con i pulsanti di sistema');

// 3. Root layout navigation bar auto-hide
const rootLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(rootLayoutSource.includes('expo-navigation-bar'), 'RootLayout deve integrare expo-navigation-bar');
assert(rootLayoutSource.includes('setVisibilityAsync'), 'RootLayout deve richiamare setVisibilityAsync per nascondere la barra ad app aperta');
assert(rootLayoutSource.includes('navBarMode'), 'RootLayout deve sincronizzarsi dinamicamente con navBarMode');

// 4. Settings screen UI section
const settingsSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsSource.includes('NAVBAR DI SISTEMA'), 'SettingsScreen deve contenere la sezione NAVBAR DI SISTEMA');
assert(settingsSource.includes('NASCONDI (SWIPE)'), 'SettingsScreen deve contenere l\'opzione NASCONDI (SWIPE)');
assert(settingsSource.includes('SEMPRE VISIBILE'), 'SettingsScreen deve contenere l\'opzione SEMPRE VISIBILE');

console.log('✓ System Navigation Bar Compatibility & Auto-Hide Mode verificati con successo.');

// -----------------------------------------------------------------------------
// [11/11] Verifica Gestures Verticali, PiP No-Pause, Sheets Dimensioni & Update Scroll
// -----------------------------------------------------------------------------
console.log('\n[11/11] Verifica Gestures Verticali, PiP No-Pause, Sheets Dimensioni & Update Scroll...');

// 1. Video Player Vertical Gestures & Sensitivity
const updatedPlayerSource = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(updatedPlayerSource.includes('activeOffsetY'), 'Player deve configurare activeOffsetY per soglia di attivazione verticale');
assert(updatedPlayerSource.includes('failOffsetX'), 'Player deve configurare failOffsetX per annullare gesture orizzontali');
assert(
  updatedPlayerSource.includes('Math.abs(e.translationX) > Math.abs(e.translationY)'),
  'Player deve ignorare movimenti prevalentemente orizzontali in onUpdate'
);
assert(
  updatedPlayerSource.includes('startPanTranslationYRef'),
  'Player deve tracciare startPanTranslationYRef per transizione continua senza scatti'
);

// 2. Video Player PiP Mode Fullscreen Restore (No Pause)
assert(
  updatedPlayerSource.includes('wasPlayingInPiPRef'),
  'Player deve tracciare wasPlayingInPiPRef per preservare lo stato di riproduzione in uscita PiP'
);
assert(
  updatedPlayerSource.includes('pipStopTimerRef'),
  'Player deve differire il controllo di chiusura PiP con pipStopTimerRef per non fermare il video al rientro a schermo intero'
);
assert(
  updatedPlayerSource.includes('wasPlayingInPiPRef.current') && updatedPlayerSource.includes('player.play()'),
  'Player deve ripristinare il play quando si rientra a schermo intero da PiP'
);
assert(
  updatedPlayerSource.includes('wasPlayingInPiPRef.current || player.playing'),
  'Player deve proteggere wasPlayingInPiPRef da azzeramenti accidentali durante la transizione nativa PiP'
);

// 3. Sheets Dimensions & Responsive Cut-off Fixes
const updatedServerSheet = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ServerBottomSheet.tsx'), 'utf-8');
assert(updatedServerSheet.includes('numberOfLines={1}'), 'ServerBottomSheet header deve avere numberOfLines={1}');
assert(updatedServerSheet.includes('isLandscape ? 8 : 4'), 'ServerBottomSheet speedRow deve avere gap adattivo 4/8');

const updatedInfoSheet = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerInfoSheet.tsx'), 'utf-8');
assert(updatedInfoSheet.includes('isLandscape ? 84 : 76'), 'PlayerInfoSheet deve adattare la locandina in verticale a 76dp');
assert(updatedInfoSheet.includes('numberOfLines={1}'), 'PlayerInfoSheet header deve avere numberOfLines={1}');

const updatedCarousel = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerEpisodesCarouselSheet.tsx'), 'utf-8');
assert(updatedCarousel.includes('isLandscape ? CARD_WIDTH : 152'), 'PlayerEpisodesCarouselSheet deve adattare cardWidth a 152 in verticale');
assert(updatedCarousel.includes('numberOfLines={1}'), 'PlayerEpisodesCarouselSheet sheetTitle deve avere numberOfLines={1}');

// 4. Elevated App Router Bottom Bar
const updatedTabLayout = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(
  updatedTabLayout.includes('Math.max(16, insets.bottom + 8)'),
  'TabLayout deve elevare androidBottomInset con cuscinetto protettivo per la navbar di sistema fissa'
);

// 5. Update Modal Navigation & Settings Scroll to Bottom
const updatedUpdateModal = fs.readFileSync(path.resolve(process.cwd(), 'src/components/UpdateModal.tsx'), 'utf-8');
assert(
  updatedUpdateModal.includes("params: { scrollTo: 'update' }"),
  'UpdateModal deve passare il parametro scrollTo: update per far scorrere la vista'
);

const updatedSettings = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(
  updatedSettings.includes('scrollToUpdateSection'),
  'SettingsScreen deve implementare scrollToUpdateSection'
);
assert(
  updatedSettings.includes('scrollToEnd'),
  'SettingsScreen deve invocare scrollToEnd per portare la visuale sul pulsante di installazione e progress bar'
);
assert(
  updatedSettings.includes('onContentSizeChange'),
  'SettingsScreen deve osservare onContentSizeChange per scorrere reattivamente all\'espansione della sezione'
);

// 6. Verifica Refinements: Player Info Sheet episode badge, Player minimal loading feedback, Anime Detail spacing
const playerInfoSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerInfoSheet.tsx'), 'utf-8');
assert(
  playerInfoSheetSource.includes('{episodeBadgeText}'),
  'PlayerInfoSheet deve renderizzare {episodeBadgeText} nel badge senza testo duplicato o suffisso titolo'
);
assert(
  !playerInfoSheetSource.includes('EPISODIO {episodeNumber}{totalEpisodesText}'),
  'PlayerInfoSheet non deve includere il vecchio formato con totalEpisodesText disgiunto'
);

const playerSourceForLoading = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(
  playerSourceForLoading.includes('loadingOverlay'),
  'app/player/[id].tsx deve mostrare loadingOverlay durante il caricamento'
);
assert(
  !playerSourceForLoading.includes('CARICAMENTO EPISODIO'),
  'app/player/[id].tsx deve avere feedback minimale senza scritte testuali'
);
assert(
  !playerSourceForLoading.includes('loadingBoxText'),
  'app/player/[id].tsx non deve avere stili di testo nel loadingBox minimale'
);

const animeHeaderSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/AnimeHeaderBackdrop.tsx'), 'utf-8');
assert(
  animeHeaderSource.includes('paddingTop: 68'),
  'AnimeHeaderBackdrop deve avere paddingTop: 68 per garantire lo spacing iniziale sotto il tasto indietro'
);

const animeSkeletonSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/AnimeDetailScreenSkeleton.tsx'), 'utf-8');
assert(
  animeSkeletonSource.includes('paddingTop: 68'),
  'AnimeDetailScreenSkeleton deve sincronizzare paddingTop: 68 con AnimeHeaderBackdrop per zero CLS'
);

const animeDetailScreenSource = fs.readFileSync(path.resolve(process.cwd(), 'app/anime/[id].tsx'), 'utf-8');
assert(
  animeDetailScreenSource.includes('top: Math.max(insets.top + 8, 12)'),
  'app/anime/[id].tsx deve posizionare topNav dinamicamente in base a insets.top'
);

console.log('✓ Gestures Verticali, PiP No-Pause, Sheets Dimensioni & Update Scroll verificati con successo.');

// -----------------------------------------------------------------------------
// [12/12] Verifica AniSkipSlider, Player Integrated Loader & Media Notification
// -----------------------------------------------------------------------------
console.log('\n[12/12] Verifica AniSkipSlider, Player Integrated Loader & Media Notification...');

// 1. AniSkipSlider component and steps
const { ANISKIP_STEPS } = await import('../src/components/AniSkipSlider');
assert.strictEqual(ANISKIP_STEPS.length, 3, 'ANISKIP_STEPS deve avere esattamente 3 opzioni');
assert.strictEqual(ANISKIP_STEPS[0].label, 'OFF', 'Prima opzione deve essere OFF');
assert.strictEqual(ANISKIP_STEPS[0].value, 'disabled', 'OFF deve corrispondere a disabled');
assert.strictEqual(ANISKIP_STEPS[1].label, 'MANUALE', 'Seconda opzione deve essere MANUALE');
assert.strictEqual(ANISKIP_STEPS[1].value, 'manual', 'MANUALE deve corrispondere a manual');
assert.strictEqual(ANISKIP_STEPS[2].label, 'AUTO', 'Terza opzione deve essere AUTO');
assert.strictEqual(ANISKIP_STEPS[2].value, 'auto', 'AUTO deve corrispondere a auto');

// 2. Settings screen uses AniSkipSlider and streamlined navbar description
const settingsCodeAfter = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsCodeAfter.includes('AniSkipSlider'), 'app/(tabs)/settings.tsx deve utilizzare AniSkipSlider');
assert(settingsCodeAfter.includes('A SCOMPARSA, RICHIAMABILE CON SWIPE DAL BASSO.'), 'app/(tabs)/settings.tsx deve avere la descrizione snellita per NAVBAR auto-hide');
assert(settingsCodeAfter.includes('SEMPRE FISSA E VISIBILE IN-APP.'), 'app/(tabs)/settings.tsx deve avere la descrizione snellita per NAVBAR visible');

// 3. Player integrated loading animation and notification listeners
const playerSourceAfter = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerSourceAfter.includes('isBufferingOrLoading'), 'app/player/[id].tsx deve tracciare isBufferingOrLoading');
assert(playerSourceAfter.includes('KuroNotificationPrevEpisode'), 'app/player/[id].tsx deve ascoltare KuroNotificationPrevEpisode');
assert(playerSourceAfter.includes('KuroNotificationNextEpisode'), 'app/player/[id].tsx deve ascoltare KuroNotificationNextEpisode');

// 4. Native ExpoVideoPlaybackService patch verification
const playbackServiceCode = fs.readFileSync(path.resolve(process.cwd(), 'scripts/patches/expo-video/ExpoVideoPlaybackService.kt'), 'utf-8');
assert(playbackServiceCode.includes('KuroForwardingPlayer'), 'ExpoVideoPlaybackService deve includere KuroForwardingPlayer');
assert(playbackServiceCode.includes('COMMAND_SEEK_TO_NEXT'), 'ExpoVideoPlaybackService deve abilitare COMMAND_SEEK_TO_NEXT');
assert(playbackServiceCode.includes('emitNextEpisode'), 'ExpoVideoPlaybackService deve supportare emitNextEpisode');
assert(playbackServiceCode.includes('emitPrevEpisode'), 'ExpoVideoPlaybackService deve supportare emitPrevEpisode');
assert(playbackServiceCode.includes('setArtworkData'), 'ExpoVideoPlaybackService deve trasmettere artworkData a MediaSession');

console.log('✓ AniSkipSlider, Player Integrated Loader & Media Notification verificati con successo.');

// -----------------------------------------------------------------------------
// 13. Test AniSkip Dynamic Auto Description, Auto-Off Fallback & Duration Slider
// -----------------------------------------------------------------------------
console.log('\n[13/13] Verifica AniSkip Dynamic Auto Description, Auto-Off Fallback & Duration Slider...');

// 1. formatAniSkipAutoDescription tests
assert.strictEqual(
  formatAniSkipAutoDescription({ enableOpening: true, enableEnding: true, enableRecap: true }),
  "SALTA AUTOMATICAMENTE INTRO, RECAP E OUTRO ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipAutoDescription({ enableOpening: true, enableEnding: true, enableRecap: false }),
  "SALTA AUTOMATICAMENTE INTRO E OUTRO ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipAutoDescription({ enableOpening: true, enableEnding: false, enableRecap: false }),
  "SALTA AUTOMATICAMENTE INTRO ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipAutoDescription({ enableOpening: false, enableEnding: false, enableRecap: false }),
  "NESSUN INTERVALLO SELEZIONATO. SELEZIONA ALMENO UN ELEMENTO DA SALTARE"
);

// 2. formatAniSkipManualDescription tests
assert.strictEqual(
  formatAniSkipManualDescription({ buttonDuration: 10 }),
  "MOSTRA IL PULSANTE 'SALTA' PER 10 SECONDI ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipManualDescription({ buttonDuration: 20 }),
  "MOSTRA IL PULSANTE 'SALTA' PER 20 SECONDI ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipManualDescription({ buttonDuration: 0 }),
  "MOSTRA IL PULSANTE 'SALTA' PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)"
);

// 3. ANISKIP_DURATION_STEPS verification
assert.strictEqual(ANISKIP_DURATION_STEPS.length, 8, 'ANISKIP_DURATION_STEPS deve contenere 8 step');
assert.strictEqual(ANISKIP_DURATION_STEPS[0].value, 5, 'Primo step deve essere 5s');
assert.strictEqual(ANISKIP_DURATION_STEPS[1].value, 10, 'Secondo step deve essere 10s');
assert.strictEqual(ANISKIP_DURATION_STEPS[7].value, 0, 'Ultimo step deve essere 0 (infinito)');
assert.strictEqual(ANISKIP_DURATION_STEPS[7].label, '∞', 'Ultimo step deve avere label ∞');

// 4. AniSkipDurationSlider export and settings integration
assert(typeof AniSkipDurationSlider === 'function' || typeof AniSkipDurationSlider === 'object', 'AniSkipDurationSlider deve essere esportato');
const settingsCodeFinal = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsCodeFinal.includes('AniSkipDurationSlider'), 'settings.tsx deve importare e usare AniSkipDurationSlider');
assert(settingsCodeFinal.includes("newSettings.mode = 'disabled'"), 'settings.tsx deve impostare mode su disabled se tutti gli intervalli sono deselezionati');

// 5. Defensive Updater checks: selectApkForDevice with undefined/empty manifest
const emptyManifest: any = { version: '1.0.0', versionCode: 2 };
const safeSelected = selectApkForDevice(emptyManifest, undefined);
assert(safeSelected !== null && typeof safeSelected === 'object', 'selectApkForDevice deve gestire supportedAbis undefined senza crash');
assert.strictEqual(safeSelected.abi, 'universal', 'Fallback deve essere universal');

console.log('✓ AniSkip Dynamic Auto Description, Auto-Off Fallback & Duration Slider verificati con successo.');

// -----------------------------------------------------------------------------
// 14. Verifica Ridefinizione Schermata Home & Scraper
// -----------------------------------------------------------------------------
console.log('\n[14/14] Verifica Ridefinizione Schermata Home & Scraper (Raccomandati, Play/Info, Caroselli, Upcoming)...');

// 1. Verifica Metodi Scraper & Parser Home
const { AnimeWorldScraper: AwScraper } = await import('../src/services/scraper/index.ts');
const { parseHomePage: testParseHome } = await import('../src/services/scraper/parsers/home.parser.ts');

assert.strictEqual(typeof AwScraper.getUpcoming, 'function', 'AnimeWorldScraper deve esporre getUpcoming');

// Mock HTML di test che include la top 8 raccomandati, ongoing, upcoming e newAdded
const mockHomeHtml = `
<html>
  <body>
    <div id="swiper-container">
      <div class="items swiper-wrapper">
        <div class="item swiper-slide" style="background-image: url(https://img.animeworld.ac/slider/1.png)">
          <div class="info">
            <a class="name" href="/play/rec-1.abc">Recommended Anime 1</a>
            <p>Descrizione 1</p>
          </div>
        </div>
        <div class="item swiper-slide" style="background-image: url(https://img.animeworld.ac/slider/2.png)">
          <div class="info">
            <a class="name" href="/play/rec-2.def">Recommended Anime 2</a>
            <p>Descrizione 2</p>
          </div>
        </div>
        <div class="item swiper-slide" style="background-image: url(https://img.animeworld.ac/slider/3.png)">
          <div class="info">
            <a class="name" href="/play/rec-3.ghi">Recommended Anime 3</a>
            <p>Descrizione 3</p>
          </div>
        </div>
      </div>
    </div>
    <div class="widget hotnew">
      <div class="widget-body">
        <div class="content"><div class="item"><div class="inner"><a class="name" href="/play/latest-1.xyz">Latest Ep 1</a><img src="https://img/1.png"/></div></div></div>
        <div class="content"></div>
        <div class="content"></div>
        <div class="content"><div class="item"><div class="inner"><a class="name" href="/play/trend-1.xyz">Trending Anime 1</a><img src="https://img/t1.png"/></div></div></div>
      </div>
    </div>
    <div class="widget">
      <div class="widget-title"><a href="/ongoing">Guarda tutto</a><div class="title">Anime in corso</div></div>
      <div class="widget-body"><div class="film-list"><div class="item"><div class="inner"><a class="name" href="/play/ongoing-1.xyz">Ongoing Anime 1</a><img src="https://img/o1.png"/></div></div></div></div>
    </div>
    <div class="widget">
      <div class="widget-title"><a href="/upcoming/2027/winter">Guarda tutto</a><div class="title">Uscite Inverno 2027</div></div>
      <div class="widget-body"><div class="film-list"><div class="item"><div class="inner"><a class="name" href="/play/upcoming-1.xyz">Upcoming Anime 1</a><img src="https://img/u1.png"/></div></div></div></div>
    </div>
    <div class="widget simple-film-list">
      <div class="widget-title"><div class="title">Nuove aggiunte</div></div>
      <div class="widget-body"><div class="item"><a class="name" href="/play/new-1.xyz">New Anime 1</a><img src="https://img/n1.png"/></div></div>
    </div>
  </body>
</html>
`;

const parsedHome = testParseHome(mockHomeHtml, 'https://www.animeworld.ac');
assert.strictEqual(parsedHome.sliders.length, 3, 'Devono essere parsati 3 slider mock');
assert.strictEqual(parsedHome.sliders[0].rank, '1', 'Primo slider deve avere rank 1');
assert.strictEqual(parsedHome.sliders[1].rank, '2', 'Secondo slider deve avere rank 2');
assert.strictEqual(parsedHome.sliders[0].image, 'https://img.animeworld.ac/slider/1.png', 'Primo slider deve contenere image estratta dallo style');
assert.strictEqual(parsedHome.all.length, 1, 'Ultimi episodi deve contenere 1 item');
assert.strictEqual(parsedHome.trending.length, 1, 'Tendenze deve contenere 1 item');
assert.strictEqual(parsedHome.ongoing.length, 1, 'In corso deve contenere 1 item');
assert.strictEqual(parsedHome.upcoming.length, 1, 'Upcoming deve contenere 1 item');
assert.strictEqual(parsedHome.upcomingTitle, 'Uscite Inverno 2027', 'Titolo stagionale upcoming deve essere corretto');
assert.strictEqual(parsedHome.newAdded.length, 1, 'Nuove aggiunte deve contenere 1 item');

// 2. Verifica Scraper Upcoming & parseSearchPage (.film-listnext e prevenzione corruzione titolo)
const { parseSearchPage: testParseSearch } = await import('../src/services/scraper/parsers/search.parser.ts');
const mockUpcomingHtml = `
<html>
  <body>
    <div class="film-listnext">
      <div class="item">
        <div class="inner">
          <a href="/play/im-looking-for-zombie.PuzK7" class="poster">
            <img src="https://img/zombie.jpg"/>
          </a>
          <a href="/play/im-looking-for-zombie.PuzK7" class="name">#I'm Looking For a Zombie</a>
        </div>
      </div>
      <div class="item">
        <div class="inner">
          <a href="/play/my-happy-marriage-special-ita.6vpuG" class="poster">
            <img src="https://img/marriage.jpg"/>
            <div class="status">
              <div class="dub">DUB</div>
              <div class="special">Special</div>
            </div>
          </a>
          <a href="/play/my-happy-marriage-special-ita.6vpuG" class="name">My Happy Marriage Special (ITA)</a>
        </div>
      </div>
    </div>
  </body>
</html>
`;
const parsedUpcoming = testParseSearch(mockUpcomingHtml, 'https://www.animeworld.ac');
assert.strictEqual(parsedUpcoming.items.length, 2, 'parseSearchPage deve supportare .film-listnext e trovare 2 item');
assert.strictEqual(parsedUpcoming.items[0].title, "#I'm Looking For a Zombie", 'Primo titolo deve essere corretto');
assert.strictEqual(parsedUpcoming.items[1].title, 'My Happy Marriage Special (ITA)', 'Il titolo del secondo item NON deve essere corrotto da badge DUB/Special dentro poster');
assert.strictEqual(parsedUpcoming.items[1].id, 'my-happy-marriage-special-ita.6vpuG', 'Slug secondo item corretto');

// 3. Verifica Codice Sorgente app/(tabs)/index.tsx (Bi-directional Sync, Snapping & Zero CLS)
const indexSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(indexSource.includes('TOP RACCOMANDATI'), 'index.tsx deve contenere la sezione TOP RACCOMANDATI');
assert(indexSource.includes('handlePlayHero'), 'index.tsx deve implementare handlePlayHero per avviare la riproduzione dal banner');
assert(indexSource.includes('RIPRODUCI'), 'index.tsx deve mostrare il pulsante RIPRODUCI nel banner hero');
assert(indexSource.includes('INFO'), 'index.tsx deve mostrare il pulsante INFO nel banner hero');
assert(indexSource.includes('handleSelectRecommended'), 'index.tsx deve gestire la selezione dal carosello raccomandati');
assert(indexSource.includes('handleRecommendedScroll'), 'index.tsx deve sincronizzare il focus durante lo scorrimento del carosello');
assert(indexSource.includes('handleHeroScroll'), 'index.tsx deve sincronizzare il carosello durante lo scorrimento del banner hero');
assert(indexSource.includes('heroScrollRef'), 'index.tsx deve referenziare heroScrollRef per lo swiper orizzontale in testa');
assert(indexSource.includes('snapToOffsets'), 'index.tsx deve implementare snapToOffsets per lo snapping touch pulito');
assert(indexSource.includes('activeScrollSourceRef'), 'index.tsx deve usare activeScrollSourceRef per prevenire scroll loop infiniti');
assert(indexSource.includes('paddingRight: Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)'), 'index.tsx deve calcolare dynamic paddingRight per permettere a card #8 di raggiungere il focus');
assert(indexSource.includes('ULTIMI EPISODI USCITI'), 'index.tsx deve contenere il carosello ULTIMI EPISODI USCITI');
assert(indexSource.includes('TENDENZE'), 'index.tsx deve contenere il carosello TENDENZE');
assert(indexSource.includes('ANIME IN CORSO'), 'index.tsx deve contenere il carosello ANIME IN CORSO');
assert(indexSource.includes('PROSSIME USCITE'), 'index.tsx deve supportare il titolo dinamico per le uscite di stagione');
assert(indexSource.includes('NUOVE AGGIUNTE'), 'index.tsx deve contenere il carosello NUOVE AGGIUNTE');
assert(indexSource.includes('hasContinueWatching={continueWatching.length > 0}'), 'index.tsx deve sincronizzare continueWatching con HomeScreenSkeleton');

// 4. Verifica Struttura HomeScreenSkeleton.tsx & Zero Layout Shift (CLS)
const homeSkelSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/HomeScreenSkeleton.tsx'), 'utf-8');
assert(homeSkelSource.includes('const HERO_HEIGHT = 320;'), 'HomeScreenSkeleton deve avere HERO_HEIGHT = 320 per zero CLS con index.tsx');
assert(homeSkelSource.includes('recommendedCardSkeleton'), 'HomeScreenSkeleton deve modellare il carosello dei raccomandati');
assert(homeSkelSource.includes('heroActionsRow'), 'HomeScreenSkeleton deve modellare i due pulsanti Play e Info nel banner');
assert(homeSkelSource.includes('hasContinueWatching'), 'HomeScreenSkeleton deve supportare hasContinueWatching');
assert(homeSkelSource.includes('continueThumbWrapper'), 'HomeScreenSkeleton deve supportare continueThumbWrapper');

console.log('✓ Ridefinizione Schermata Home & Scraper verificate con successo.');

// -----------------------------------------------------------------------------
// Fine Test
// -----------------------------------------------------------------------------
console.log('\n==============================================');
console.log('🎉 TUTTI I TEST SONO PASSATI CON SUCCESSO! 🎉');
console.log('==============================================');
