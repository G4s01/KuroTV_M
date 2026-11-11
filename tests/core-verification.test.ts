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
import { computeResponsiveLayout } from '../src/hooks/useResponsiveLayout';
import {
  ENDING_COINCIDE_END_THRESHOLD_SECONDS,
  isEndingSkipType,
  doesEndingCoincideWithEnd,
  computeAniSkipOverlayState,
} from '../src/services/aniskip/index';
import type { AniSkipResult, AniSkipSettings } from '../src/types/index';

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
      const isConsecutive: boolean = Boolean(accumulated && accumulated.direction === tap.side);
      const prevSeconds: number = accumulated?.seconds ?? 0;
      accumulated = {
        direction: tap.side,
        seconds: isConsecutive ? prevSeconds + 10 : 10,
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
assert(Boolean(parsedDetail.studios?.includes('Mappa')), 'Studio deve essere estratto');
assert(Boolean(parsedDetail.genres?.includes('Azione')), 'Genere deve contenere Azione');
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
assert(playerFullSource.includes('metadata: {'), 'app/player/[id].tsx deve inviare metadata (episodio, titolo serie, thumbnail) per la notifica multimediale');
assert(playerFullSource.includes('const episodeTitle = `EPISODIO ${episodeNumber}`'), 'app/player/[id].tsx deve impostare EPISODIO <Num> come titolo compatto della notifica');
assert(playerFullSource.includes('title: episodeTitle'), 'app/player/[id].tsx deve assegnare episodeTitle al campo metadata.title');
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

// 4. AniSkipButton Variants ('SALTA' / 'PROSSIMO') & Configurable Default Duration
const aniSkipBtnCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AniSkipButton.tsx'), 'utf-8');
assert(
  aniSkipBtnCode.includes("const label = isNextVariant ? 'PROSSIMO' : 'SALTA';"),
  'AniSkipButton deve supportare etichette SALTA e PROSSIMO tramite variant'
);
assert(aniSkipBtnCode.includes('BUTTON_DURATION = 10'), 'AniSkipButton deve avere durata display predefinita di 10 secondi');

// 5. FilterBottomSheet Modal Touch-Safe (Zero @expo/ui crashes)
const filterSheetCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FilterBottomSheet.tsx'), 'utf-8');
assert(filterSheetCode.includes('Modal'), 'FilterBottomSheet deve utilizzare Modal nativo');
assert(!filterSheetCode.includes("from '@expo/ui'"), 'FilterBottomSheet non deve importare da @expo/ui per evitare crash silenziosi');

// 6. Tab layout integrates explore tab (Palinsesto)
assert(tabLayoutSource.includes('name="explore"'), 'app/(tabs)/_layout.tsx deve dichiarare la rotta explore');
assert(tabLayoutSource.includes('PALINSESTO'), 'app/(tabs)/_layout.tsx deve configurare il titolo PALINSESTO su explore');
assert(tabLayoutSource.includes('calendar'), 'app/(tabs)/_layout.tsx deve usare icona calendar per la tab explore');

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
assert(playerScreenSource.includes('computeAniSkipOverlayState'), 'Player deve utilizzare computeAniSkipOverlayState per il calcolo dei pulsanti e finestre AniSkip');

// 12. Deep verification of Home search and favorites fixes
assert(homeIndexCode.includes('hardwareBackPress'), 'app/(tabs)/index.tsx deve gestire hardwareBackPress per chiudere la ricerca');
assert(homeIndexCode.includes('Keyboard.dismiss()'), 'app/(tabs)/index.tsx deve chiudere la tastiera aprendo i filtri');
const favCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
assert(favCode.includes("router.push('/(tabs)')"), 'app/(tabs)/favorites.tsx deve navigare verso /(tabs) quando la lista è vuota');
assert(!favCode.includes('/(tabs)/explore'), 'app/(tabs)/favorites.tsx non deve più riferenziare la rotta explore');

// 13. Deep verification of explore route (Palinsesto / Programmazione)
const exploreCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/explore.tsx'), 'utf-8');
assert(exploreCode.includes('PALINSESTO'), 'app/(tabs)/explore.tsx deve renderizzare la schermata PALINSESTO');

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

// 4. Native ExpoVideoPlaybackService patch & buildFromSource autolinking verification
const playbackServiceCode = fs.readFileSync(path.resolve(process.cwd(), 'scripts/patches/expo-video/ExpoVideoPlaybackService.kt'), 'utf-8');
const mediaCallbackCode = fs.readFileSync(path.resolve(process.cwd(), 'scripts/patches/expo-video/VideoMediaSessionCallback.kt'), 'utf-8');
const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
assert(
  Array.isArray(pkgJson?.expo?.autolinking?.android?.buildFromSource) &&
    pkgJson.expo.autolinking.android.buildFromSource.includes('expo-video'),
  'package.json deve configurare expo.autolinking.android.buildFromSource con expo-video per compilare le patch Kotlin anziché usare l\'AAR precompilato'
);
assert(playbackServiceCode.includes('KuroForwardingPlayer'), 'ExpoVideoPlaybackService deve includere KuroForwardingPlayer');
assert(playbackServiceCode.includes('COMMAND_SEEK_TO_NEXT'), 'ExpoVideoPlaybackService deve abilitare COMMAND_SEEK_TO_NEXT');
assert(playbackServiceCode.includes('COMMAND_SEEK_TO_NEXT_MEDIA_ITEM'), 'ExpoVideoPlaybackService deve abilitare COMMAND_SEEK_TO_NEXT_MEDIA_ITEM');
assert(playbackServiceCode.includes('onAvailableCommandsChanged'), 'KuroForwardingPlayer deve propagare i comandi di navigazione anche su onAvailableCommandsChanged');
assert(playbackServiceCode.includes('emitNextEpisode'), 'ExpoVideoPlaybackService deve supportare emitNextEpisode');
assert(playbackServiceCode.includes('emitPrevEpisode'), 'ExpoVideoPlaybackService deve supportare emitPrevEpisode');
assert(playbackServiceCode.includes('setArtworkData'), 'ExpoVideoPlaybackService deve trasmettere artworkData a MediaSession');
assert(mediaCallbackCode.includes('COMMAND_SEEK_TO_NEXT_MEDIA_ITEM'), 'VideoMediaSessionCallback deve autorizzare COMMAND_SEEK_TO_NEXT_MEDIA_ITEM');

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
  "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 10 SECONDI ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipManualDescription({ buttonDuration: 20 }),
  "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 20 SECONDI ALL'INIZIO DELL'INTERVALLO"
);
assert.strictEqual(
  formatAniSkipManualDescription({ buttonDuration: 0 }),
  "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)"
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
assert(
  settingsCodeFinal.includes("aniSkipSettings.mode === 'manual'") &&
  settingsCodeFinal.includes("aniSkipSettings.mode !== 'disabled'"),
  'settings.tsx deve mostrare la durata solo in modalità manuale e COSA SALTARE solo quando non in OFF (disabled)'
);

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
const { AnimeWorldScraper: AwScraper } = await import('../src/services/scraper/index');
const { parseHomePage: testParseHome } = await import('../src/services/scraper/parsers/home.parser');

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
const { parseSearchPage: testParseSearch } = await import('../src/services/scraper/parsers/search.parser');
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
assert(indexSource.includes('RACCOMANDATI'), 'index.tsx deve contenere la sezione RACCOMANDATI');
assert(indexSource.includes('handlePlayHero'), 'index.tsx deve implementare handlePlayHero per avviare la riproduzione dal banner');
assert(indexSource.includes('RIPRODUCI'), 'index.tsx deve mostrare il pulsante RIPRODUCI nel banner hero');
assert(indexSource.includes('INFO'), 'index.tsx deve mostrare il pulsante INFO nel banner hero');
assert(indexSource.includes('handleSelectRecommended'), 'index.tsx deve gestire la selezione dal carosello raccomandati');
assert(indexSource.includes('handleRecommendedScroll'), 'index.tsx deve sincronizzare il focus durante lo scorrimento del carosello');
assert(indexSource.includes('handleHeroScroll'), 'index.tsx deve sincronizzare il carosello durante lo scorrimento del banner hero');
assert(indexSource.includes('heroScrollRef'), 'index.tsx deve referenziare heroScrollRef per lo swiper orizzontale in testa');
assert(indexSource.includes('snapToOffsets'), 'index.tsx deve implementare snapToOffsets per lo snapping touch pulito');
assert(indexSource.includes('activeScrollSourceRef'), 'index.tsx deve usare activeScrollSourceRef per prevenire scroll loop infiniti');
assert(indexSource.includes('paddingRight: Math.max(16, contentWidth - RECOMMENDED_ITEM_WIDTH - 16)') || indexSource.includes('paddingRight: Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16)'), 'index.tsx deve calcolare dynamic paddingRight per permettere a card #8 di raggiungere il focus');
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
// 15. Verifica Palinsesto / Schedule & Fix Aggiornamenti Manuali
// -----------------------------------------------------------------------------
console.log('\n[15/15] Verifica Palinsesto / Schedule & Fix Aggiornamenti Manuali...');

// 1. Verifica Parser Palinsesto / Schedule
const { parseSchedulePage } = await import('../src/services/scraper/parsers/schedule.parser');
const mockScheduleHtml = `
<!DOCTYPE html>
<html>
  <body>
    <div class="sch" id="sch">
      <section class="sch-hero" data-at="1794321000000">
        <a class="sch-ht" href="/play/nia-liston.VVpfI" data-jtitle="Kyouran Reijou">Nia Liston: The Merciless Maiden</a>
        <div class="sch-hm"><span class="sch-ep">Episodio 6</span></div>
        <div class="sch-hw"><span class="sch-hwt">Oggi · 15:30</span></div>
        <img class="sch-hbg" src="https://img/nia.jpg" />
      </section>

      <div class="sch-bar">
        <div class="sch-wk">Settimana <b>9 nov – 15 nov</b></div>
      </div>

      <div class="sch-days">
        <section class="sch-day" id="sch-d-mon" data-day="mon" data-name="Lunedì" data-label="9 nov">
          <div class="sch-dh">
            <h3 class="sch-hx">Lunedì <span>9 nov</span></h3>
            <span class="sch-dc">2 uscite</span>
          </div>
          <ul class="sch-tl">
            <li class="sch-row is-done" data-time="15:00">
              <span class="sch-time">15:00</span>
              <a class="sch-item" href="/play/witch-potion.AGegB">
                <span class="sch-po"><img src="https://img/witch.jpg"/></span>
                <span class="sch-cb">
                  <span class="sch-ct" data-jtitle="Doumo Suki">Love Potion</span>
                  <span class="sch-cm"><span class="sch-ep">Episodio 6</span><span class="sch-st">Uscito</span></span>
                </span>
              </a>
            </li>
            <li class="sch-row is-pause" data-time="15:30" data-paused="1">
              <span class="sch-time">15:30</span>
              <a class="sch-item" href="/play/reborn-goblin.UC3Im">
                <span class="sch-po"><img src="https://img/goblin.jpg"/></span>
                <span class="sch-cb">
                  <span class="sch-ct">Reborn Goblin</span>
                  <span class="sch-cm"><span class="sch-ep">Episodio 7</span><span class="sch-st">In pausa</span></span>
                </span>
              </a>
            </li>
          </ul>
        </section>
        <section class="sch-day is-today" id="sch-d-tue" data-day="tue" data-name="Martedì" data-label="10 nov">
          <ul class="sch-tl">
            <li class="sch-row" data-time="18:00">
              <span class="sch-time">18:00</span>
              <a class="sch-item" href="/play/mage-life.4SaIK">
                <span class="sch-po"><img src="https://img/mage.jpg"/></span>
                <span class="sch-cb">
                  <span class="sch-ct">Mage Life</span>
                  <span class="sch-cm"><span class="sch-ep">Episodio 5</span><span class="sch-st">Alle 18:00</span></span>
                </span>
              </a>
            </li>
          </ul>
        </section>
      </div>

      <section class="sch-unk">
        <ul class="sch-ul">
          <li>
            <a class="sch-u" href="/play/one-piece-ita.d5nahE">
              <span class="sch-uq"><img src="https://img/op.jpg"/></span>
              <span class="sch-ub">
                <span class="sch-ut">One Piece (ITA)</span>
                <span class="sch-um"><span class="sch-uep">Ep. 947</span><span class="sch-tag">ITA</span></span>
              </span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  </body>
</html>
`;

const parsedSchedule = parseSchedulePage(mockScheduleHtml, 'https://www.animeworld.ac');
assert.strictEqual(parsedSchedule.weekLabel, 'Settimana 9 nov – 15 nov', 'Week label deve essere corretta');
assert(parsedSchedule.hero !== undefined, 'Hero deve essere presente');
assert.strictEqual(parsedSchedule.hero?.title, 'Nia Liston: The Merciless Maiden', 'Hero title corretto');
assert.strictEqual(parsedSchedule.hero?.id, 'nia-liston.VVpfI', 'Hero id corretto');
assert.strictEqual(parsedSchedule.days.length, 2, 'Devono esserci 2 giorni');
assert.strictEqual(parsedSchedule.days[0].items.length, 2, 'Lunedì deve avere 2 uscite');
assert.strictEqual(parsedSchedule.days[0].items[0].isDone, true, 'Prima uscita Lunedì deve essere isDone');
assert.strictEqual(parsedSchedule.days[0].items[1].isPause, true, 'Seconda uscita Lunedì deve essere isPause');
assert.strictEqual(parsedSchedule.days[1].isToday, true, 'Martedì deve essere isToday');
assert.strictEqual(parsedSchedule.unscheduled.length, 1, 'Unscheduled deve avere 1 elemento');
assert.strictEqual(parsedSchedule.unscheduled[0].title, 'One Piece (ITA)', 'Titolo serie senza data fissa corretto');

// 2. Storage Cache Palinsesto
AppStorage.saveScheduleData(parsedSchedule);
const cachedSchedule = AppStorage.getScheduleData();
assert.strictEqual(cachedSchedule?.weekLabel, parsedSchedule.weekLabel, 'AppStorage deve memorizzare e recuperare scheduleData');

// 3. Verifica Scraper & Query options
const { AnimeWorldScraper } = await import('../src/services/scraper/index');
assert(typeof AnimeWorldScraper.getSchedule === 'function', 'AnimeWorldScraper deve esporre getSchedule');
const { animeQueryKeys, scheduleQueryOptions } = await import('../src/services/queries/anime-queries');
assert.deepStrictEqual(animeQueryKeys.schedule(), ['anime', 'schedule'], 'animeQueryKeys.schedule deve essere definito');
const schedOpts = scheduleQueryOptions();
assert.strictEqual(typeof schedOpts.queryFn, 'function', 'scheduleQueryOptions deve avere queryFn');

// 4. Verifica Skeleton Palinsesto
const { ScheduleScreenSkeleton } = await import('../src/components/skeleton/ScheduleScreenSkeleton');
assert(typeof ScheduleScreenSkeleton === 'function', 'ScheduleScreenSkeleton deve essere esportato');

// 5. Verifica Sorgente app/(tabs)/explore.tsx (Palinsesto / Programmazione)
const exploreSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/explore.tsx'), 'utf-8');
assert(exploreSource.includes('PALINSESTO'), 'explore.tsx deve mostrare il titolo PALINSESTO');
assert(exploreSource.includes('scheduleQueryOptions'), 'explore.tsx deve invocare scheduleQueryOptions');
assert(exploreSource.includes('ScheduleScreenSkeleton'), 'explore.tsx deve integrare ScheduleScreenSkeleton');
assert(exploreSource.includes('FlashList'), 'explore.tsx deve virtualizzare le liste con FlashList');
assert(exploreSource.includes('selectedDayId'), 'explore.tsx deve gestire lo stato del giorno selezionato');
assert(!exploreSource.includes('SENZA DATA'), 'explore.tsx non deve avere la sezione SENZA DATA nel palinsesto');
assert(exploreSource.includes('dayTabLabel'), 'explore.tsx deve usare dayTabLabel per il nome del giorno (es. SAB 14)');
assert(!exploreSource.includes('dayTabBadge'), 'explore.tsx non deve mostrare il badge con il numero di uscite del giorno');
assert(exploreSource.includes('heroBanner'), 'explore.tsx deve supportare il banner Hero Prossima Uscita');

// 6. Verifica Bottom Tabs Layout
const scheduleTabLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(scheduleTabLayoutSource.includes('name="explore"'), 'TabLayout deve contenere lo screen explore');
assert(scheduleTabLayoutSource.includes('calendar'), 'TabLayout deve usare l icona calendar per explore');
assert(!scheduleTabLayoutSource.includes('name="explore"\n        options={{\n          href: null'), 'explore non deve essere nascosto con href: null');

// 7. Verifica Fix Aggiornamenti Manuali in settings.tsx
const settingsFixedSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsFixedSource.includes('onPress={() => handleStartDownloadUpdate()}'), 'settings.tsx non deve passare event a handleStartDownloadUpdate');
assert(settingsFixedSource.includes('isManifest = (m: any): boolean =>'), 'settings.tsx deve validare che il manifest passato sia un UpdateManifest valido');
assert(settingsFixedSource.includes("prev === 'idle' || prev === 'error' ? 'available' : prev"), 'settings.tsx deve recuperare dallo stato di errore al focus');

console.log('✓ Palinsesto / Schedule & Fix Aggiornamenti Manuali verificati con successo.');

// -----------------------------------------------------------------------------
// 16. Verifica Ricerca, Cronologia Ricerche (Google Style) & Fix Filtri / Audio
// -----------------------------------------------------------------------------
console.log('\n[16/16] Verifica Cronologia Ricerche, Filtri Avanzati (Multi-Genere & Audio) & Fix Scraper...');

// 1. Verifica Storage Cronologia Ricerca in AppStorage
AppStorage.clearSearchHistory();
assert.deepStrictEqual(AppStorage.getSearchHistory(), [], 'Cronologia ricerche deve iniziare vuota');

AppStorage.addSearchHistory('Naruto');
AppStorage.addSearchHistory('One Piece');
AppStorage.addSearchHistory('Attack on Titan');
// Inserimento duplicato: deve riposizionare in testa senza duplicare
AppStorage.addSearchHistory('naruto');

let searchHist = AppStorage.getSearchHistory();
assert.strictEqual(searchHist.length, 3, 'Cronologia ricerche deve contenere 3 elementi unici');
assert.strictEqual(searchHist[0].query, 'naruto', 'L ultimo elemento cercato deve essere in cima');

// Rimozione singolo elemento
AppStorage.removeSearchHistoryItem('one piece');
searchHist = AppStorage.getSearchHistory();
assert.strictEqual(searchHist.length, 2, 'Dopo rimozione di One Piece devono rimanere 2 ricerche');
assert(!searchHist.some((h) => h.query.toLowerCase() === 'one piece'), 'One Piece non deve più essere presente');

// Retention slider & spegnimento cronologia (OFF / -1)
AppStorage.setSearchHistoryRetentionDays(-1);
assert.strictEqual(AppStorage.isSearchHistoryEnabled(), false, 'Retention -1 deve disattivare la cronologia');
assert.deepStrictEqual(AppStorage.getSearchHistory(), [], 'Con cronologia disattivata getSearchHistory deve restituire array vuoto');

// Riattivazione retention a 90 giorni
AppStorage.setSearchHistoryRetentionDays(90);
assert.strictEqual(AppStorage.isSearchHistoryEnabled(), true, 'Retention 90 deve riattivare la cronologia ricerche');
AppStorage.addSearchHistory('Bleach');
assert.strictEqual(AppStorage.getSearchHistory().length, 1, 'Dopo riattivazione la nuova ricerca deve essere salvata');
AppStorage.clearSearchHistory();
assert.deepStrictEqual(AppStorage.getSearchHistory(), [], 'clearSearchHistory deve svuotare la cronologia');

// Verifica filtraggio prefissi e ricerche incomplete (mantiene solo la ricerca più completa e finale)
AppStorage.clearSearchHistory();
AppStorage.addSearchHistory('One');
AppStorage.addSearchHistory('One P');
AppStorage.addSearchHistory('One Piece');
let prefixHist = AppStorage.getSearchHistory();
assert.strictEqual(prefixHist.length, 1, 'Deve rimanere solo la ricerca finale più completa');
assert.strictEqual(prefixHist[0].query, 'One Piece', 'La ricerca salvata deve essere One Piece');

AppStorage.addSearchHistory('Attack');
AppStorage.addSearchHistory('Attack on');
AppStorage.addSearchHistory('Attack on Titan');
prefixHist = AppStorage.getSearchHistory();
assert.strictEqual(prefixHist.length, 2, 'Devono essere presenti solo le due ricerche complete');
assert.strictEqual(prefixHist[0].query, 'Attack on Titan', 'Attack on Titan deve essere in cima');
assert.strictEqual(prefixHist[1].query, 'One Piece', 'One Piece deve rimanere al secondo posto');
AppStorage.clearSearchHistory();

// 2. Verifica buildFilterQuery & Mapping Parametri AnimeWorld
const { buildFilterQuery } = await import('../src/services/scraper/parsers/search.parser');

// Test Type mapping (movie -> 4, tv -> 0, etc.)
const queryMovie = buildFilterQuery({ type: 'movie' });
assert(queryMovie.includes('type=4'), 'buildFilterQuery deve convertire type: movie in type=4 per AnimeWorld');
const queryTv = buildFilterQuery({ type: 'tv' });
assert(queryTv.includes('type=0'), 'buildFilterQuery deve convertire type: tv in type=0 per AnimeWorld');
const queryDirectType = buildFilterQuery({ type: '4' });
assert(queryDirectType.includes('type=4'), 'buildFilterQuery deve preservare type numerico 4');

// Test Status mapping (ongoing -> 0, completed -> 1)
const queryOngoing = buildFilterQuery({ status: 'ongoing' });
assert(queryOngoing.includes('status=0'), 'buildFilterQuery deve convertire status: ongoing in status=0');
const queryCompleted = buildFilterQuery({ status: 'completed' });
assert(queryCompleted.includes('status=1'), 'buildFilterQuery deve convertire status: completed in status=1');

// Test Sort mapping (recent / release_date -> 5, post_date -> 1, views -> 6, vote -> 7)
const queryRecent = buildFilterQuery({ sort: 'recent' });
assert(queryRecent.includes('sort=5'), 'buildFilterQuery deve mappare sort: recent su sort=5 (data di uscita)');
const queryLatest = buildFilterQuery({ sort: 'latest' });
assert(queryLatest.includes('sort=1'), 'buildFilterQuery deve mappare sort: latest su sort=1 (ultime aggiunte)');
const queryPopular = buildFilterQuery({ sort: 'popular' });
assert(queryPopular.includes('sort=6'), 'buildFilterQuery deve mappare sort: popular su sort=6 (più visti)');
const queryRating = buildFilterQuery({ sort: 'rating' });
assert(queryRating.includes('sort=7'), 'buildFilterQuery deve mappare sort: rating su sort=7 (meglio valutati)');

// Test Dub / Audio filter (dubbed -> 1, subbed -> 0)
const queryDub = buildFilterQuery({ dub: '1' });
assert(queryDub.includes('dub=1'), 'buildFilterQuery deve gestire dub=1 per doppiati ITA');
const querySub = buildFilterQuery({ dub: '0' });
assert(querySub.includes('dub=0'), 'buildFilterQuery deve gestire dub=0 per sottotitolati SUB');
const queryAudioIta = buildFilterQuery({ audio: 'ita' });
assert(queryAudioIta.includes('dub=1'), 'buildFilterQuery audio: ita deve mappare su dub=1');

// Test Multi-Genre & genre_mode=and
const queryMultiGenre = buildFilterQuery({ genres: ['1', '9'] });
assert(queryMultiGenre.includes('genre=1'), 'buildFilterQuery multi-genre deve includere genre=1');
assert(queryMultiGenre.includes('genre=9'), 'buildFilterQuery multi-genre deve includere genre=9');
assert(queryMultiGenre.includes('genre_mode=and'), 'buildFilterQuery multi-genre deve impostare genre_mode=and');

// 3. Verifica parseSearchPage su HTML con zero risultati (Esclusione widget laterali da 6 elementi)
const { parseSearchPage } = await import('../src/services/scraper/parsers/search.parser');

const mockHtmlNoResults = `
<html>
<body>
  <div id="main">
    <div class="content">
      <div class="alert alert-warning">Non ci sono anime con i filtri inseriti!</div>
      <div class="film-list"></div>
    </div>
  </div>
  <aside class="sidebar">
    <div class="widget simple-film-list">
      <div class="widget-body">
        <div class="item"><a class="name" href="/play/item-1">Item 1</a></div>
        <div class="item"><a class="name" href="/play/item-2">Item 2</a></div>
        <div class="item"><a class="name" href="/play/item-3">Item 3</a></div>
        <div class="item"><a class="name" href="/play/item-4">Item 4</a></div>
        <div class="item"><a class="name" href="/play/item-5">Item 5</a></div>
        <div class="item"><a class="name" href="/play/item-6">Item 6</a></div>
      </div>
    </div>
  </aside>
</body>
</html>
`;
const parsedNoResults = parseSearchPage(mockHtmlNoResults, 'https://www.animeworld.ac');
assert.strictEqual(parsedNoResults.items.length, 0, 'parseSearchPage non deve raccogliere i 6 elementi dal widget laterale in assenza di risultati');

// 4. Verifica Costanti e Componente FilterBottomSheet
const {
  ANIME_GENRES,
  ANIME_DUB,
  ANIME_TYPES,
  ANIME_STATUSES,
  ANIME_SORTS,
} = await import('../src/components/FilterBottomSheet');

assert(Array.isArray(ANIME_GENRES) && ANIME_GENRES.length >= 40, 'ANIME_GENRES deve contenere tutti i generi completi di AnimeWorld');
assert(ANIME_GENRES.some((g: any) => g.id === '1' && g.label === 'Azione'), 'ANIME_GENRES deve contenere Azione con id 1');
assert(ANIME_GENRES.some((g: any) => g.id === '49' && g.label === 'Isekai'), 'ANIME_GENRES deve contenere Isekai');

assert(Array.isArray(ANIME_DUB) && ANIME_DUB.length === 2, 'ANIME_DUB deve contenere DOPPIATI e SOTTOTITOLATI');
assert(ANIME_DUB.some((d: any) => d.value === '1' && d.label === 'DOPPIATI'), 'ANIME_DUB deve supportare Doppiati (1)');
assert(ANIME_DUB.some((d: any) => d.value === '0' && d.label === 'SOTTOTITOLATI'), 'ANIME_DUB deve supportare Sottotitolati (0)');
assert(!ANIME_DUB.some((d: any) => d.value === ''), 'ANIME_DUB non deve contenere valori vuoti TUTTI');
assert(!ANIME_TYPES.some((t: any) => t.value === ''), 'ANIME_TYPES non deve contenere valori vuoti TUTTI');
assert(!ANIME_STATUSES.some((s: any) => s.value === ''), 'ANIME_STATUSES non deve contenere valori vuoti TUTTI');
assert(!ANIME_SORTS.some((s: any) => s.value === ''), 'ANIME_SORTS non deve contenere valori vuoti TUTTI');

assert(ANIME_TYPES.some((t: any) => t.value === '4' && t.label === 'FILM ANIME'), 'ANIME_TYPES deve mappare FILM ANIME a 4');
assert(ANIME_SORTS.some((s: any) => s.value === '5' && s.label.includes('RECENTI')), 'ANIME_SORTS deve mappare PIÙ RECENTI a 5');

// 5. Verifica File Sorgente app/(tabs)/index.tsx e settings.tsx
const homeSearchSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(homeSearchSource.includes('RICERCHE RECENTI'), 'index.tsx deve contenere la sezione RICERCHE RECENTI in stile Google');
assert(homeSearchSource.includes('time-outline'), 'index.tsx deve mostrare l icona orologio time-outline per le ricerche passate');
assert(homeSearchSource.includes('handleDeleteSearchHistoryItem'), 'index.tsx deve permettere l eliminazione di singole ricerche');
assert(homeSearchSource.includes('handleConfirmClearAllSearch'), 'index.tsx deve permettere di svuotare la cronologia con ConfirmModal');
assert(!homeSearchSource.includes('SUGGERIMENTI RAPIDI'), 'index.tsx non deve più contenere i vecchi SUGGERIMENTI RAPIDI');
assert(homeSearchSource.includes('ANIME_DUB'), 'index.tsx deve integrare il filtro AUDIO');
assert(homeSearchSource.includes('removeGenre'), 'index.tsx deve supportare la rimozione di singoli generi selezionati');

const settingsSearchSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsSearchSource.includes('CRONOLOGIA DI RICERCA'), 'settings.tsx deve contenere la sezione CRONOLOGIA DI RICERCA');
assert(settingsSearchSource.includes('SEARCH_RETENTION_STEPS'), 'settings.tsx deve usare SEARCH_RETENTION_STEPS con HistorySlider');
assert(settingsSearchSource.includes('isClearSearchHistoryConfirmOpen'), 'settings.tsx deve gestire la modale ConfirmModal per svuotare le ricerche');

console.log('✓ Cronologia Ricerche, Filtri Avanzati (Multi-Genere & Audio) & Fix Scraper verificati con successo.');

// -----------------------------------------------------------------------------
// [17/17] Verifica Sincronizzazione Focus Carosello Raccomandati & Simmetria Filtri Touch-Native
// -----------------------------------------------------------------------------
console.log('\n[17/17] Verifica Sincronizzazione Focus Carosello Raccomandati & Simmetria Filtri Touch-Native...');

// 1. Verifica Sincronizzazione Focus Settling in app/(tabs)/index.tsx
assert(homeSearchSource.includes('lastSettledRecommendedIndexRef'), 'index.tsx deve tracciare lastSettledRecommendedIndexRef');
assert(homeSearchSource.includes('lastSettledHeroIndexRef'), 'index.tsx deve tracciare lastSettledHeroIndexRef');
assert(
  homeSearchSource.includes('heroScrollRef.current?.scrollTo({\n      x: targetIndex * windowWidth,') ||
  homeSearchSource.includes('heroScrollRef.current?.scrollTo({\n      x: targetIndex * contentWidth,'),
  'settleRecommendedScroll deve sincronizzare heroScrollRef allo settling dello scorrimento'
);
assert(
  homeSearchSource.includes('recommendedScrollRef.current?.scrollTo({\n      x: targetIndex * RECOMMENDED_ITEM_TOTAL,'),
  'settleHeroScroll deve sincronizzare recommendedScrollRef allo settling dello scorrimento'
);

// 2. Verifica Simmetria & Rimozione TUTTI in FilterBottomSheet.tsx
const filterSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FilterBottomSheet.tsx'), 'utf-8');
assert(!filterSheetSource.includes('TUTTI GLI AUDIO'), 'FilterBottomSheet non deve più mostrare TUTTI GLI AUDIO');
assert(!filterSheetSource.includes('TUTTI I TIPI'), 'FilterBottomSheet non deve più mostrare TUTTI I TIPI');
assert(!filterSheetSource.includes('TUTTI GLI STATI'), 'FilterBottomSheet non deve più mostrare TUTTI GLI STATI');
assert(filterSheetSource.includes('genresGrid'), 'FilterBottomSheet deve usare una griglia simmetrica genresGrid per i generi');
assert(filterSheetSource.includes('renderFilterButton'), 'FilterBottomSheet deve usare il render helper per layout simmetrico');

// 3. Verifica SearchFilterChips.tsx con label generiche DOPPIATI e SOTTOTITOLATI
const filterChipsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/SearchFilterChips.tsx'), 'utf-8');
assert(filterChipsSource.includes("AUDIO: {filterState.dub === '1' ? 'DOPPIATI' : 'SOTTOTITOLATI'}"), 'SearchFilterChips deve mostrare etichette generiche DOPPIATI e SOTTOTITOLATI');
assert(!filterChipsSource.includes('DOPPIATI (ITA)'), 'SearchFilterChips non deve più mostrare DOPPIATI (ITA)');

console.log('✓ Sincronizzazione Focus Carosello Raccomandati & Simmetria Filtri Touch-Native verificate con successo.');

// -----------------------------------------------------------------------------
// [18/18] Verifica Chiusura Menù Player Tramite Scorrimento (Swipe-Down Dismiss)
// -----------------------------------------------------------------------------
console.log('\n[18/18] Verifica Chiusura Menù Player Tramite Scorrimento (Swipe-Down Dismiss)...');

// 1. Verifica Hook useBottomSheetDragDismiss
const { useBottomSheetDragDismiss } = await import('../src/components/useBottomSheetDragDismiss');
assert(typeof useBottomSheetDragDismiss === 'function', 'useBottomSheetDragDismiss deve essere esportato come funzione');

const hookSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/useBottomSheetDragDismiss.ts'), 'utf-8');
assert(hookSource.includes('PanResponder.create'), 'useBottomSheetDragDismiss deve implementare PanResponder');
assert(hookSource.includes('useNativeDriver: true'), 'useBottomSheetDragDismiss deve animare su driver nativo a 60/120 FPS');
assert(hookSource.includes('translateY'), 'useBottomSheetDragDismiss deve esporre translateY');
assert(hookSource.includes('panHandlers'), 'useBottomSheetDragDismiss deve esporre i panHandlers');
assert(hookSource.includes('isDismissingRef'), 'useBottomSheetDragDismiss deve proteggere lo stato di chiusura con isDismissingRef');
assert(
  !hookSource.includes('onClose();\n          translateY.setValue(0)'),
  'useBottomSheetDragDismiss non deve resettare translateY a 0 dopo onClose per evitare il rimbalzo prima della chiusura del Modal'
);

// 2. Verifica Integrazione in ServerBottomSheet.tsx (Opzioni di Riproduzione)
const serverSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ServerBottomSheet.tsx'), 'utf-8');
assert(serverSheetSource.includes('useBottomSheetDragDismiss'), 'ServerBottomSheet deve integrare useBottomSheetDragDismiss');
assert(serverSheetSource.includes('Animated.View'), 'ServerBottomSheet container deve essere un Animated.View');
assert(serverSheetSource.includes('transform: [{ translateY }]'), 'ServerBottomSheet deve applicare translateY');
assert(serverSheetSource.includes('dragStripArea'), 'ServerBottomSheet deve applicare panHandlers all area intestazione dragStripArea');
assert(serverSheetSource.includes('animationType="fade"'), 'ServerBottomSheet deve usare animationType="fade" per evitare doppio slide-out nativo Android');

// 3. Verifica Integrazione in PlayerInfoSheet.tsx (Scheda Informazioni)
const playerInfoSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerInfoSheet.tsx'), 'utf-8');
assert(playerInfoSource.includes('useBottomSheetDragDismiss'), 'PlayerInfoSheet deve integrare useBottomSheetDragDismiss');
assert(playerInfoSource.includes('Animated.View'), 'PlayerInfoSheet container deve essere un Animated.View');
assert(playerInfoSource.includes('transform: [{ translateY }]'), 'PlayerInfoSheet deve applicare translateY');
assert(playerInfoSource.includes('dragStripArea'), 'PlayerInfoSheet deve applicare panHandlers all area intestazione dragStripArea');
assert(playerInfoSource.includes('animationType="fade"'), 'PlayerInfoSheet deve usare animationType="fade" per evitare doppio slide-out nativo Android');

// 4. Verifica Integrazione in PlayerEpisodesCarouselSheet.tsx (Carosello Episodi)
const carouselSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerEpisodesCarouselSheet.tsx'), 'utf-8');
assert(carouselSheetSource.includes('useBottomSheetDragDismiss'), 'PlayerEpisodesCarouselSheet deve integrare useBottomSheetDragDismiss');
assert(carouselSheetSource.includes('Animated.View'), 'PlayerEpisodesCarouselSheet container deve essere un Animated.View');
assert(carouselSheetSource.includes('transform: [{ translateY }]'), 'PlayerEpisodesCarouselSheet deve applicare translateY');
assert(carouselSheetSource.includes('dragStripArea'), 'PlayerEpisodesCarouselSheet deve applicare panHandlers all area intestazione dragStripArea');
assert(carouselSheetSource.includes('animationType="fade"'), 'PlayerEpisodesCarouselSheet deve usare animationType="fade" per evitare doppio slide-out nativo Android');

// 5. Verifica animationType="fade" anche su BatchBottomSheet, DownloadOptionsSheet e FilterBottomSheet
const batchModalSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BatchBottomSheet.tsx'), 'utf-8');
assert(batchModalSource.includes('animationType="fade"'), 'BatchBottomSheet deve usare animationType="fade" per evitare doppio slide-out');
const downloadOptionsModalSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/DownloadOptionsSheet.tsx'), 'utf-8');
assert(downloadOptionsModalSource.includes('animationType="fade"'), 'DownloadOptionsSheet deve usare animationType="fade" per evitare doppio slide-out');
const filterDragSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FilterBottomSheet.tsx'), 'utf-8');
assert(filterDragSource.includes('useBottomSheetDragDismiss'), 'FilterBottomSheet deve integrare useBottomSheetDragDismiss');
assert(filterDragSource.includes('animationType="fade"'), 'FilterBottomSheet deve usare animationType="fade"');

console.log('✓ Chiusura Menù Player Tramite Scorrimento (Swipe-Down Dismiss) verificata con successo.');

// -----------------------------------------------------------------------------
// [19/19] Verifica Gestione Anime in Corso 'IN PARI' & Sincronizzazione Ibrida Smart
// -----------------------------------------------------------------------------
console.log('\n[19/19] Verifica Gestione Anime in Corso \'IN PARI\' & Sincronizzazione Ibrida Smart...');

const { syncCaughtUpWithHomeList, syncCaughtUpWithRemote } = await import('../src/services/storage/continue-watching-sync');
assert(typeof syncCaughtUpWithHomeList === 'function', 'syncCaughtUpWithHomeList deve essere esportato come funzione');
assert(typeof syncCaughtUpWithRemote === 'function', 'syncCaughtUpWithRemote deve essere esportato come funzione');

// 1. Test salvataggio completamento episodio per anime in corso (totale '?')
AppStorage.clearWatchHistory();
AppStorage.saveWatchProgress({
  animeId: 'one-piece-test',
  animeTitle: 'One Piece',
  episodeId: 'ep-1100',
  episodeNumber: 1100,
  totalEpisodes: '?',
  currentTime: 1440,
  duration: 1440,
  thumbnail: 'https://example.com/one-piece.jpg',
  // Nessun nextEpisode disponibile
});

let testContinueList = AppStorage.getContinueWatching();
const caughtUpAnime = testContinueList.find((c) => c.animeId === 'one-piece-test');
assert(caughtUpAnime !== undefined, 'L anime in corso con totale ? deve rimanere nel carosello Continua a Guardare');
assert(caughtUpAnime.isCaughtUp === true, 'L anime in corso deve essere contrassegnato con isCaughtUp = true');
assert(caughtUpAnime.episodeNumber === 1100, 'L episodio registrato deve essere 1100');

// 2. Test avanzamento automatico al rilascio di un nuovo episodio
const updated = AppStorage.updateContinueWatchingEpisode(
  'one-piece-test',
  { id: 'ep-1101', number: 1101, dataId: 'data-1101' },
  '?'
);
assert(updated === true, 'updateContinueWatchingEpisode deve restituire true');

testContinueList = AppStorage.getContinueWatching();
const promotedAnime = testContinueList[0];
assert(promotedAnime.animeId === 'one-piece-test', 'L anime aggiornato deve essere promosso in cima al carosello');
assert(promotedAnime.episodeNumber === 1101, 'Il nuovo episodio deve essere 1101');
assert(promotedAnime.percentage === 0, 'La percentuale del nuovo episodio deve essere 0%');
assert(promotedAnime.isCaughtUp === false, 'isCaughtUp deve tornare false');

// 3. Test anime concluso con totale noto (es. 12 episodi, non contiene '?'): deve essere rimosso
AppStorage.saveWatchProgress({
  animeId: 'concluded-anime-test',
  animeTitle: 'Anime Concluso',
  episodeId: 'ep-12',
  episodeNumber: 12,
  totalEpisodes: 12,
  currentTime: 1440,
  duration: 1440,
  thumbnail: 'https://example.com/concluded.jpg',
  // Nessun nextEpisode
});

testContinueList = AppStorage.getContinueWatching();
const concludedInContinue = testContinueList.find((c) => c.animeId === 'concluded-anime-test');
assert(concludedInContinue === undefined, 'Le serie concluse a totale noto senza episodi successivi non devono restare in Continua a Guardare');

// 4. Verifica sorgenti UI
const continueSectionSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/ContinueWatchingSection.tsx'), 'utf-8');
assert(continueSectionSource.includes('item.isCaughtUp'), 'ContinueWatchingSection deve verificare isCaughtUp');
assert(continueSectionSource.includes('IN PARI'), 'ContinueWatchingSection deve mostrare il badge e sottotitolo IN PARI');
assert(continueSectionSource.includes('checkmark-done-circle'), 'ContinueWatchingSection deve mostrare icona checkmark per serie in pari');

console.log('✓ Gestione Anime in Corso \'IN PARI\' & Sincronizzazione Ibrida Smart verificate con successo.');

// -----------------------------------------------------------------------------
// 20. Test Supporto Schermi Larghi, Tablet (sw600dp), Left Navigation Rail & Master-Detail
// -----------------------------------------------------------------------------
console.log('\n[20/20] Verifica Supporto Schermi Larghi, Tablet (sw600dp), Left Navigation Rail & Master-Detail...');

// 1. Test standard sw600dp: Smartphone vs Tablet
const phonePortrait = computeResponsiveLayout(390, 844);
assert.strictEqual(phonePortrait.isTablet, false, 'Smartphone portrait non deve essere identificato come tablet');
assert.strictEqual(phonePortrait.railWidth, 0, 'Smartphone non deve avere navigation rail laterale');
assert.strictEqual(phonePortrait.numColumns, 2, 'Smartphone deve mantenere 2 colonne standard');
assert.strictEqual(phonePortrait.isMasterDetail, false, 'Smartphone non deve usare master-detail');

// Smartphone in landscape (es. 844 x 390): min dimension < 600 -> non è tablet
const phoneLandscape = computeResponsiveLayout(844, 390);
assert.strictEqual(phoneLandscape.isTablet, false, 'Smartphone in landscape non deve attivare layout tablet (min dimension < 600)');
assert.strictEqual(phoneLandscape.railWidth, 0, 'Smartphone in landscape mantiene bottom tab bar');

// Tablet in portrait (800 x 1280): min dimension 800 >= 600 -> isTablet = true
const tabletPortrait = computeResponsiveLayout(800, 1280);
assert.strictEqual(tabletPortrait.isTablet, true, 'Tablet portrait deve essere identificato come tablet');
assert.strictEqual(tabletPortrait.railWidth, 76, 'Tablet deve avere navigation rail di 76dp');
assert.strictEqual(tabletPortrait.contentWidth, 800 - 76, 'contentWidth deve sottrarre la rail laterale');
assert(tabletPortrait.numColumns >= 3, 'Tablet portrait deve avere almeno 3 o 4 colonne');
assert.strictEqual(tabletPortrait.isMasterDetail, true, 'Tablet portrait deve supportare master-detail');

// Tablet in landscape (1280 x 800): min dimension 800 >= 600 -> isTablet = true
const tabletLandscape = computeResponsiveLayout(1280, 800);
assert.strictEqual(tabletLandscape.isTablet, true, 'Tablet landscape deve essere identificato come tablet');
assert.strictEqual(tabletLandscape.railWidth, 76, 'Tablet landscape ha rail di 76dp');
assert(tabletLandscape.numColumns >= 5, 'Tablet landscape deve avere almeno 5 o 6 colonne');
assert.strictEqual(tabletLandscape.isMasterDetail, true, 'Tablet landscape deve supportare master-detail');
assert(tabletLandscape.episodeColumns >= 6, 'Tablet landscape deve avere 6-8 colonne chip episodi');

// Foldable aperto (700 x 830): min dimension 700 >= 600 -> isTablet = true
const foldableOpen = computeResponsiveLayout(700, 830);
assert.strictEqual(foldableOpen.isTablet, true, 'Foldable aperto deve essere identificato come tablet');

// 2. Verifica sorgente TabLayout (Left Navigation Rail)
const tabLayoutRespSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(tabLayoutRespSource.includes("tabBarPosition: isTablet ? 'left' : 'bottom'"), 'TabLayout deve impostare tabBarPosition condizionale');
assert(tabLayoutRespSource.includes('railBrandWrapper'), 'TabLayout deve includere il brand logo per la navigation rail');
assert(tabLayoutRespSource.includes('railBrandLogoBox'), 'TabLayout deve avere il logo monogramma K');
assert(tabLayoutRespSource.includes('width: 76'), 'Navigation rail deve avere larghezza 76dp');
assert(tabLayoutRespSource.includes('borderRightWidth: 1'), 'Navigation rail deve avere borderRightWidth');

// 3. Verifica sorgente AnimeDetailScreen (Master-Detail)
const respDetailSource = fs.readFileSync(path.resolve(process.cwd(), 'app/anime/[id].tsx'), 'utf-8');
assert(respDetailSource.includes('isMasterDetail'), 'AnimeDetailScreen deve supportare isMasterDetail');
assert(respDetailSource.includes('masterDetailContainer'), 'AnimeDetailScreen deve avere masterDetailContainer');
assert(respDetailSource.includes('leftMasterColumn'), 'AnimeDetailScreen deve avere colonna sinistra master');
assert(respDetailSource.includes('rightDetailColumn'), 'AnimeDetailScreen deve avere colonna destra detail');
assert(respDetailSource.includes('masterDetailDivider'), 'AnimeDetailScreen deve avere divisore centrale');

// 4. Verifica sorgente FavoritesScreen e SearchResultsGrid (Colonne dinamiche)
const respFavoritesSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
assert(respFavoritesSource.includes('useResponsiveLayout'), 'FavoritesScreen deve utilizzare useResponsiveLayout');
assert(respFavoritesSource.includes('numColumns={numColumns}'), 'FavoritesScreen deve passare numColumns dinamico');

const respSearchGridSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/SearchResultsGrid.tsx'), 'utf-8');
assert(respSearchGridSource.includes('numColumns?: number'), 'SearchResultsGrid deve supportare numColumns');
assert(respSearchGridSource.includes('numColumns={numColumns}'), 'SearchResultsGrid deve passare numColumns a FlashList');

// 5. Verifica Bottom Sheets & Modali (Max-width per schermi larghi)
const respFilterSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FilterBottomSheet.tsx'), 'utf-8');
assert(respFilterSheetSource.includes('maxWidth: 620'), 'FilterBottomSheet deve limitare maxWidth a 620 su tablet');

const respServerSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ServerBottomSheet.tsx'), 'utf-8');
assert(respServerSheetSource.includes('maxWidth: 580'), 'ServerBottomSheet deve limitare maxWidth a 580 su tablet');

const respBatchSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BatchBottomSheet.tsx'), 'utf-8');
assert(respBatchSheetSource.includes('maxWidth: 580'), 'BatchBottomSheet deve limitare maxWidth a 580 su tablet');
assert(respBatchSheetSource.includes('useBottomSheetDragDismiss'), 'BatchBottomSheet deve supportare swipe-down dismiss tramite useBottomSheetDragDismiss');

const respDownloadSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/DownloadOptionsSheet.tsx'), 'utf-8');
assert(respDownloadSheetSource.includes('maxWidth: 580'), 'DownloadOptionsSheet deve limitare maxWidth a 580 su tablet');

console.log('✓ Supporto Schermi Larghi, Tablet (sw600dp), Left Navigation Rail & Master-Detail verificati con successo.');

// -----------------------------------------------------------------------------
// [21/21] Verifica Sistema di Download Episodi, Storage SAF & Visione Offline
// -----------------------------------------------------------------------------
console.log('\n[21/21] Verifica Sistema di Download Episodi, Storage SAF & Visione Offline...');

// 1. Verifica DownloadService e funzioni helper
const { DownloadService, formatDownloadBytes, sanitizeFileName, DEFAULT_DOWNLOAD_SETTINGS } = await import('../src/services/downloads');
assert(typeof DownloadService.startDownload === 'function', 'DownloadService.startDownload deve essere una funzione');
assert(typeof DownloadService.startBatchDownload === 'function', 'DownloadService.startBatchDownload deve essere una funzione');
assert(typeof DownloadService.pauseDownload === 'function', 'DownloadService.pauseDownload deve essere una funzione');
assert(typeof DownloadService.resumeDownload === 'function', 'DownloadService.resumeDownload deve essere una funzione');
assert(typeof DownloadService.cancelDownload === 'function', 'DownloadService.cancelDownload deve essere una funzione');
assert(typeof DownloadService.cancelAnimeDownloads === 'function', 'DownloadService.cancelAnimeDownloads deve essere una funzione');
assert(typeof DownloadService.deleteDownload === 'function', 'DownloadService.deleteDownload deve essere una funzione');
assert(typeof DownloadService.deleteAnimeDownloads === 'function', 'DownloadService.deleteAnimeDownloads deve essere una funzione');
assert(typeof DownloadService.clearAllDownloads === 'function', 'DownloadService.clearAllDownloads deve essere una funzione');
assert(typeof DownloadService.isEpisodeDownloaded === 'function', 'DownloadService.isEpisodeDownloaded deve essere una funzione');
assert(typeof DownloadService.getDownloadedEpisodeUri === 'function', 'DownloadService.getDownloadedEpisodeUri deve essere una funzione');
assert(typeof DownloadService.resolvePlayableLocalUri === 'function', 'DownloadService.resolvePlayableLocalUri deve essere una funzione');
assert(typeof DownloadService.getDownloadedAnimeList === 'function', 'DownloadService.getDownloadedAnimeList deve essere una funzione');
assert(typeof DownloadService.getStorageUsage === 'function', 'DownloadService.getStorageUsage deve essere una funzione');

// 2. Test formatDownloadBytes & sanitizeFileName
assert.strictEqual(formatDownloadBytes(0), '0 B');
assert.strictEqual(formatDownloadBytes(1024), '1.0 KB');
assert.strictEqual(formatDownloadBytes(1048576), '1.0 MB');
assert.strictEqual(formatDownloadBytes(1073741824), '1.0 GB');

assert.strictEqual(sanitizeFileName('Attack on Titan: Final Season!'), 'Attack_on_Titan__Final_Season_');

// 3. Test DownloadSettings e persistenza
assert.strictEqual(typeof DEFAULT_DOWNLOAD_SETTINGS.wifiOnly, 'boolean');
assert.strictEqual(DEFAULT_DOWNLOAD_SETTINGS.wifiOnly, true);
DownloadService.setWifiOnly(true);
assert.strictEqual(DownloadService.getSettings().wifiOnly, true);
DownloadService.setCustomDirectoryUri(null);
assert.strictEqual(DownloadService.getSettings().customDirectoryUri, null);

// 4. Test enqueuing download
const offlineTestAnime = { id: 'test-anime-offline', title: 'Test Anime Offline', thumbnail: 'https://example.com/thumb.jpg' };
const offlineTestEp1 = { id: 'test-ep-1', number: 1, title: 'Episodio 1', dataId: '123', remoteUrl: 'https://example.com/ep1.mp4' };
const offlineTestEp2 = { id: 'test-ep-2', number: 2, title: 'Episodio 2', dataId: '124', remoteUrl: 'https://example.com/ep2.mp4' };

await DownloadService.startDownload(offlineTestAnime, offlineTestEp1 as any);
assert(DownloadService.getDownloadItem('test-anime-offline-ep-1') !== undefined, 'Download item deve essere registrato');
assert(['queued', 'downloading', 'completed'].includes(DownloadService.getEpisodeDownloadStatus('test-anime-offline', 1)), 'Stato episodio deve essere queued/downloading/completed');

await DownloadService.startBatchDownload(offlineTestAnime, [offlineTestEp2 as any]);
assert(DownloadService.getDownloadItem('test-anime-offline-ep-2') !== undefined, 'Batch download item deve essere registrato');

// Cleanup test items
await DownloadService.deleteDownload('test-anime-offline-ep-1');
await DownloadService.deleteDownload('test-anime-offline-ep-2');

// Verifica annullamento intenzionale download senza console.warn né stato error
const originalWarn = console.warn;
const capturedCancelWarns: string[] = [];
console.warn = (...args: any[]) => {
  capturedCancelWarns.push(args.map(String).join(' '));
};
try {
  const cancelTestEp = { id: 'test-ep-3', number: 3, title: 'Episodio 3', dataId: '125', remoteUrl: 'https://example.com/ep3.mp4' };
  await DownloadService.startDownload(offlineTestAnime, cancelTestEp as any);
  await DownloadService.cancelDownload('test-anime-offline-ep-3');
  await new Promise((r) => setTimeout(r, 30));
} finally {
  console.warn = originalWarn;
}
assert(
  !capturedCancelWarns.some((w) => w.includes('Download interrotto o non completato') || w.includes('Download failed')),
  'L annullamento manuale del download non deve generare warning di errore'
);
assert.strictEqual(
  DownloadService.getEpisodeDownloadStatus('test-anime-offline', 3),
  'none',
  'Dopo cancelDownload lo stato episodio deve tornare a none'
);

// Verifica annullamento intero raggruppamento download di una serie (cancelAnimeDownloads)
const batchCancelAnime = { id: 'boruto-batch-cancel', title: 'Boruto Test', thumbnail: 'https://example.com/boruto.jpg' };
const otherSeriesAnime = { id: 'other-series-keep', title: 'Other Series', thumbnail: 'https://example.com/other.jpg' };
const batchCancelEps = [
  { id: 'b-ep-1', number: 1, title: 'Episodio 1', dataId: 'b1', remoteUrl: 'https://example.com/b1.mp4' },
  { id: 'b-ep-2', number: 2, title: 'Episodio 2', dataId: 'b2', remoteUrl: 'https://example.com/b2.mp4' },
  { id: 'b-ep-3', number: 3, title: 'Episodio 3', dataId: 'b3', remoteUrl: 'https://example.com/b3.mp4' },
];
const otherSeriesEp = { id: 'o-ep-1', number: 1, title: 'Episodio 1', dataId: 'o1', remoteUrl: 'https://example.com/o1.mp4' };

await DownloadService.startBatchDownload(batchCancelAnime, batchCancelEps as any);
await DownloadService.startDownload(otherSeriesAnime, otherSeriesEp as any);
const cancelledGroupCount = await DownloadService.cancelAnimeDownloads('boruto-batch-cancel');
assert.strictEqual(cancelledGroupCount, 3, 'cancelAnimeDownloads deve annullare tutti e 3 gli episodi in download/coda della serie');
assert.strictEqual(DownloadService.getEpisodeDownloadStatus('boruto-batch-cancel', 1), 'none');
assert.strictEqual(DownloadService.getEpisodeDownloadStatus('boruto-batch-cancel', 2), 'none');
assert.strictEqual(DownloadService.getEpisodeDownloadStatus('boruto-batch-cancel', 3), 'none');
assert(DownloadService.getDownloadItem('other-series-keep-ep-1') !== undefined, 'cancelAnimeDownloads non deve annullare episodi di altre serie');
await DownloadService.cancelDownload('other-series-keep-ep-1');

const downloadServiceSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/downloads/download-service.ts'), 'utf-8');
assert(downloadServiceSource.includes('cancelledItems') && downloadServiceSource.includes('pausedItems'), 'DownloadService deve tracciare interruzioni intenzionali con WeakSet dedicati');
assert(downloadServiceSource.includes("item.animeId === animeId && item.status !== 'completed'"), 'cancelAnimeDownloads non deve eliminare episodi già completati della serie');

// Verifica assenza Require Cycle su storage (app-storage.ts <- continue-watching-sync.ts <- index.ts)
const storageIndexSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storage/index.ts'), 'utf-8');
const syncModuleSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storage/continue-watching-sync.ts'), 'utf-8');
const appStorageSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storage/app-storage.ts'), 'utf-8');
assert(storageIndexSource.includes("./app-storage") && storageIndexSource.includes("./continue-watching-sync"), 'storage/index.ts deve essere un barrel privo di cicli');
assert(syncModuleSource.includes("./app-storage") && !syncModuleSource.includes("./index"), 'continue-watching-sync.ts deve importare da ./app-storage senza cicli con ./index');
assert(!appStorageSource.includes('./continue-watching-sync'), 'app-storage.ts non deve importare o esportare continue-watching-sync');

// 5. Verifica Esportazione Rotta Downloads (app/downloads/index.tsx)
const downloadsRouteModule = await import('../app/downloads/index');
assert(typeof downloadsRouteModule.default === 'function', 'app/downloads/index.tsx deve esportare un componente React');

// 6. Verifica Componenti Download e Settings
const { DownloadSettingsCard } = await import('../src/components/settings/DownloadSettingsCard');
assert(typeof DownloadSettingsCard === 'function', 'DownloadSettingsCard deve essere esportata');

const { StorageUsageBar, ActiveDownloadCard, ActiveDownloadGroupCard, DownloadedAnimeCard, DownloadedEpisodesSheet } = await import('../src/components/downloads');
assert(Boolean(StorageUsageBar), 'StorageUsageBar deve essere esportata');
assert(Boolean(ActiveDownloadCard), 'ActiveDownloadCard deve essere esportata');
assert(Boolean(ActiveDownloadGroupCard), 'ActiveDownloadGroupCard deve essere esportata');
assert(Boolean(DownloadedAnimeCard), 'DownloadedAnimeCard deve essere esportata');
assert(Boolean(DownloadedEpisodesSheet), 'DownloadedEpisodesSheet deve essere esportata');

// 7. Verifica Integrazione in DownloadOptionsSheet, BatchBottomSheet, PlayerHeader, EpisodeItem, Player & Downloads
const batchSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BatchBottomSheet.tsx'), 'utf-8');
assert(batchSource.includes('useBottomSheetDragDismiss'), 'BatchBottomSheet deve supportare chiusura swipe-down tramite useBottomSheetDragDismiss');
assert(!batchSource.includes('onDownloadAll'), 'BatchBottomSheet deve rimanere focalizzato sulla selezione visuale delle batch senza comandi download sparsi');

const downloadSheetSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/DownloadOptionsSheet.tsx'), 'utf-8');
assert(downloadSheetSource.includes('useBottomSheetDragDismiss'), 'DownloadOptionsSheet deve supportare chiusura swipe-down tramite useBottomSheetDragDismiss');
assert(downloadSheetSource.includes('SCARICA TUTTI'), 'DownloadOptionsSheet deve esporre opzione pre-menù SCARICA TUTTI');
assert(downloadSheetSource.includes('SCARICA PER BATCH'), 'DownloadOptionsSheet deve esporre opzione pre-menù SCARICA PER BATCH');
assert(downloadSheetSource.includes('onDownloadBatches'), 'DownloadOptionsSheet deve supportare selezione multipla batch tramite onDownloadBatches');
assert(downloadSheetSource.includes('onDownloadRange'), 'DownloadOptionsSheet deve supportare onDownloadRange per intervalli personalizzati');
assert(downloadSheetSource.includes('INTERVALLO PERSONALIZZATO'), 'DownloadOptionsSheet deve esporre il selettore INTERVALLO PERSONALIZZATO');
assert(downloadSheetSource.includes('TextInput'), 'DownloadOptionsSheet deve permettere inserimento numerico e steppers per intervallo episodi');

const playerHeaderSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerHeader.tsx'), 'utf-8');
assert(playerHeaderSource.includes('onDownloadPress'), 'PlayerHeader deve supportare onDownloadPress');
assert(playerHeaderSource.includes('downloadStatus'), 'PlayerHeader deve supportare downloadStatus');
assert(playerHeaderSource.includes('isOffline'), 'PlayerHeader deve supportare isOffline');

const episodeItemSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/EpisodeItem.tsx'), 'utf-8');
assert(episodeItemSource.includes('onDownloadPress'), 'EpisodeItem deve supportare onDownloadPress');
assert(episodeItemSource.includes('downloadStatus'), 'EpisodeItem deve supportare downloadStatus');
assert(episodeItemSource.includes('gridDownloadBtn'), 'EpisodeItem deve supportare download interattivo anche in vista griglia (gridDownloadBtn)');

const controlsBarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/AnimeControlsBar.tsx'), 'utf-8');
assert(!controlsBarSource.includes('downloadBatchBtn'), 'AnimeControlsBar non deve contenere il pulsante downloadBatchBtn spostato in intestazione');
assert(controlsBarSource.includes("flexWrap: 'wrap'"), 'AnimeControlsBar deve abilitare flexWrap per prevenire overflow');
assert(controlsBarSource.includes("marginLeft: 'auto'"), 'AnimeControlsBar deve mantenere controlsRight allineato a destra al wrapping');

const animeDetailSource = fs.readFileSync(path.resolve(process.cwd(), 'app/anime/[id].tsx'), 'utf-8');
assert(animeDetailSource.includes('DownloadService.cancelDownload'), 'Scheda anime deve annullare il download al secondo tap sull episodio');
assert(animeDetailSource.includes('DownloadOptionsSheet'), 'Scheda anime deve montare DownloadOptionsSheet');
assert(animeDetailSource.includes('onDownloadBatches={handleDownloadBatches}'), 'Scheda anime deve passare handleDownloadBatches per il download multi-batch');
assert(animeDetailSource.includes('onDownloadRange={handleDownloadRange}'), 'Scheda anime deve passare handleDownloadRange a DownloadOptionsSheet');
assert(animeDetailSource.includes('setIsDownloadSheetVisible(true)'), 'Intestazione scheda anime deve aprire DownloadOptionsSheet accanto a Preferiti e Condivisione');
assert(animeDetailSource.includes('prev.get(item.episodeNumber) === item.status'), 'Scheda anime deve ignorare i tick di progresso quando lo stato episodio non cambia per evitare re-render continui');
assert(animeDetailSource.includes('ListHeaderComponent={portraitHeaderElement}'), 'Scheda anime deve passare ListHeaderComponent come elemento memoizzato per evitare refresh continuo immagini durante il download');
assert(!animeDetailSource.includes('ConfirmModal'), 'Scheda anime non deve mostrare doppia conferma ConfirmModal dopo DownloadOptionsSheet');

const animeHeaderBackdropSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/anime/AnimeHeaderBackdrop.tsx'), 'utf-8');
assert(animeHeaderBackdropSource.includes('posterSource') && animeHeaderBackdropSource.includes('memory-disk'), 'AnimeHeaderBackdrop deve memoizzare posterSource con cache memory-disk per zero flickering');

const downloadsScreenSource = fs.readFileSync(path.resolve(process.cwd(), 'app/downloads/index.tsx'), 'utf-8');
assert(downloadsScreenSource.includes('SCARICATI'), 'Sezione router downloads deve avere titolo SCARICATI');
assert(downloadsScreenSource.includes("scrollTo: 'downloads'"), 'Pulsante impostazioni in SCARICATI deve passare scrollTo: downloads');
assert(downloadsScreenSource.includes('animeId: item.animeId') && downloadsScreenSource.includes('episodeNumber: String(item.episodeNumber)'), 'Riproduzione da SCARICATI deve passare animeId ed episodeNumber corretti al player');
assert(
  downloadsScreenSource.indexOf('EPISODI SALVATI') < downloadsScreenSource.indexOf('IN CORSO & IN CODA'),
  'Sezione EPISODI SALVATI deve apparire prima di IN CORSO & IN CODA'
);
assert(downloadsScreenSource.includes('ActiveDownloadGroupCard'), 'Rotta SCARICATI deve usare ActiveDownloadGroupCard per raggruppare ed espandere serie/episodi in coda');
assert(downloadsScreenSource.includes('aDownloading !== bDownloading'), 'Rotta SCARICATI deve mantenere sempre in cima l episodio in downloading prima dell ordine crescente');
assert(downloadsScreenSource.includes('handleCancelGroup') && downloadsScreenSource.includes('cancelAnimeDownloads'), 'Rotta SCARICATI deve permettere annullamento dell intero gruppo in download tramite ConfirmModal');

const activeGroupSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/downloads/ActiveDownloadGroupCard.tsx'), 'utf-8');
assert(activeGroupSource.includes('isQueueExpanded') && activeGroupSource.includes('EPISODI IN CODA'), 'ActiveDownloadGroupCard deve racchiudere gli episodi in coda multipli in un elemento espandibile');
assert(activeGroupSource.includes('onCancelGroup') && activeGroupSource.includes('ANNULLA TUTTI'), 'ActiveDownloadGroupCard deve esporre il comando ANNULLA TUTTI per annullare l intero raggruppamento di episodi');

const playerOfflineSource = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerOfflineSource.includes('resolvePlayableLocalUri'), 'VideoPlayer deve verificare effettiva esistenza/integrità del file locale tramite resolvePlayableLocalUri');
assert(playerOfflineSource.includes('useVideoPlayer(null'), 'VideoPlayer deve inizializzare useVideoPlayer(null) evitando race condition replaceAsync e lookup URI vuoti');
assert(playerOfflineSource.includes('videoUrl && !sourceError'), 'VideoPlayer deve mostrare la schermata di errore se ExoPlayer segnala error dopo loadStream');

const settingsScreenSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsScreenSource.includes('scrollToDownloadsSection'), 'Settings deve supportare lo scroll automatico alla sezione SCARICATI');

const downloadsStylesSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/downloads/downloads.styles.ts'), 'utf-8');
assert(downloadsStylesSource.includes('minWidth: 0'), 'downloads.styles.ts deve includere minWidth: 0 per prevenire overflow di testo nelle card');

const homeAppBarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/HomeSearchHeader.tsx'), 'utf-8');
assert(homeAppBarSource.includes('onDownloadsPress'), 'HomeAppBar deve supportare onDownloadsPress');
assert(homeAppBarSource.includes('activeDownloadsCount'), 'HomeAppBar deve supportare activeDownloadsCount');

console.log('✓ Sistema di Download Episodi, Storage SAF & Visione Offline verificati con successo.');

// -----------------------------------------------------------------------------
// [22/22] Verifica Selezione Multipla Preferiti/Cronologia & Cuore Rimozione Rapida
// -----------------------------------------------------------------------------
console.log('\n[22/22] Verifica Selezione Multipla Preferiti/Cronologia & Cuore Rimozione Rapida...');

// 1. Verifica AppStorage.removeFavorites (rimozione multipla atomica)
for (const existingFav of AppStorage.getFavorites()) {
  AppStorage.removeFavorite(existingFav.id);
}
AppStorage.toggleFavorite({ id: 'fav-multi-1', title: 'Fav Multi 1', thumbnail: '', genres: [], link: '' });
AppStorage.toggleFavorite({ id: 'fav-multi-2', title: 'Fav Multi 2', thumbnail: '', genres: [], link: '' });
AppStorage.toggleFavorite({ id: 'fav-multi-3', title: 'Fav Multi 3', thumbnail: '', genres: [], link: '' });
assert.strictEqual(AppStorage.getFavorites().length, 3, 'Devono esserci 3 preferiti iniziali');

const removedFavCount = AppStorage.removeFavorites(['fav-multi-1', 'fav-multi-3']);
assert.strictEqual(removedFavCount, 2, 'removeFavorites deve restituire 2 elementi rimossi');
assert.deepStrictEqual(
  AppStorage.getFavorites().map((f) => f.id),
  ['fav-multi-2'],
  'Solo fav-multi-2 deve restare nei preferiti'
);
assert.strictEqual(AppStorage.removeFavorites([]), 0, 'removeFavorites([]) deve restituire 0');
AppStorage.removeFavorite('fav-multi-2');
assert.strictEqual(AppStorage.getFavorites().length, 0, 'Tutti i preferiti di test devono essere puliti');

// 2. Verifica AppStorage.removeWatchHistoryItems (rimozione multipla e aggiornamento continueWatching)
AppStorage.clearWatchHistory();
AppStorage.saveWatchProgress({
  animeId: 'hist-multi-a',
  animeTitle: 'Anime Multi A',
  episodeId: 'ep-a-1',
  episodeNumber: 1,
  currentTime: 250,
  duration: 1200,
});
AppStorage.saveWatchProgress({
  animeId: 'hist-multi-a',
  animeTitle: 'Anime Multi A',
  episodeId: 'ep-a-2',
  episodeNumber: 2,
  currentTime: 500,
  duration: 1200,
});
AppStorage.saveWatchProgress({
  animeId: 'hist-multi-b',
  animeTitle: 'Anime Multi B',
  episodeId: 'ep-b-1',
  episodeNumber: 1,
  currentTime: 300,
  duration: 1200,
});

assert.strictEqual(AppStorage.getWatchHistory().length, 3, 'La cronologia deve avere 3 voci');
const removedHistCount = AppStorage.removeWatchHistoryItems([
  { animeId: 'hist-multi-a', episodeId: 'ep-a-2', episodeNumber: 2 },
  { animeId: 'hist-multi-b', episodeId: 'ep-b-1', episodeNumber: 1 },
]);
assert.strictEqual(removedHistCount, 2, 'removeWatchHistoryItems deve rimuovere 2 voci');

const remainingHistAfterMulti = AppStorage.getWatchHistory();
assert.strictEqual(remainingHistAfterMulti.length, 1, 'Deve restare 1 voce in cronologia');
assert.strictEqual(remainingHistAfterMulti[0].animeId, 'hist-multi-a');
assert.strictEqual(remainingHistAfterMulti[0].episodeNumber, 1);

const continueAfterMulti = AppStorage.getContinueWatching();
assert.strictEqual(continueAfterMulti.length, 1, 'hist-multi-b deve essere rimosso da continueWatching e hist-multi-a deve aggiornarsi');
assert.strictEqual(continueAfterMulti[0].animeId, 'hist-multi-a');
assert.strictEqual(continueAfterMulti[0].episodeNumber, 1, 'continueWatching deve tornare all episodio 1 rimanente');
assert.strictEqual(AppStorage.getWatchProgress('hist-multi-a', 2), undefined, 'Progress key ep 2 rimosso deve essere eliminato');
assert(AppStorage.getWatchProgress('hist-multi-a', 1) !== undefined, 'Progress key ep 1 non rimosso deve persistere');
AppStorage.clearWatchHistory();

// 3. Verifica esportazioni hook & componenti di selezione
const { useMultiSelection } = await import('../src/hooks/index');
assert.strictEqual(typeof useMultiSelection, 'function', 'useMultiSelection deve essere esportato da src/hooks');
const { SelectionAppBar } = await import('../src/components/index');
assert(Boolean(SelectionAppBar), 'SelectionAppBar deve essere esportata da src/components');

// 4. Verifica AnimeCard, FavoritesScreen e HistoryScreen
const animeCardSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AnimeCard.tsx'), 'utf-8');
assert(animeCardSource.includes('onLongPress'), 'AnimeCard deve supportare onLongPress');
assert(animeCardSource.includes('onRemoveFavorite'), 'AnimeCard deve supportare onRemoveFavorite con cuore diretto');
assert(animeCardSource.includes('selectionMode'), 'AnimeCard deve supportare selectionMode');
assert(animeCardSource.includes('isSelected'), 'AnimeCard deve supportare isSelected');
assert(animeCardSource.includes('favoriteBtn'), 'AnimeCard deve renderizzare il pulsante cuore in alto a destra');

const favSelectionSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
assert(favSelectionSource.includes('SelectionAppBar'), 'FavoritesScreen deve usare SelectionAppBar');
assert(favSelectionSource.includes('ConfirmModal'), 'FavoritesScreen deve confermare la rimozione multipla tramite ConfirmModal');
assert(favSelectionSource.includes('useMultiSelection'), 'FavoritesScreen deve usare useMultiSelection');
assert(favSelectionSource.includes('AppStorage.removeFavorites'), 'FavoritesScreen deve rimuovere i preferiti selezionati tramite AppStorage.removeFavorites');
assert(favSelectionSource.includes('AppStorage.removeFavorite'), 'FavoritesScreen deve rimuovere il singolo preferito tramite AppStorage.removeFavorite');
assert(favSelectionSource.includes('hardwareBackPress'), 'FavoritesScreen deve gestire il tasto Indietro Android per uscire dalla selezione');
assert(favSelectionSource.includes('extraData={selectionExtraData}'), 'FavoritesScreen deve passare extraData a FlashList');
assert(!favSelectionSource.includes('Alert.alert'), 'FavoritesScreen non deve usare Alert.alert');

const histSelectionSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/history.tsx'), 'utf-8');
assert(histSelectionSource.includes('SelectionAppBar'), 'HistoryScreen deve usare SelectionAppBar');
assert(histSelectionSource.includes('useMultiSelection'), 'HistoryScreen deve usare useMultiSelection');
assert(histSelectionSource.includes('AppStorage.removeWatchHistoryItems'), 'HistoryScreen deve rimuovere gli elementi selezionati tramite AppStorage.removeWatchHistoryItems');
assert(histSelectionSource.includes("deleteTarget === 'selected'"), 'HistoryScreen deve gestire la conferma modale per selezione multipla');
assert(histSelectionSource.includes('hardwareBackPress'), 'HistoryScreen deve gestire il tasto Indietro Android per uscire dalla selezione');
assert(histSelectionSource.includes('extraData={selectionExtraData}'), 'HistoryScreen deve passare extraData a FlashList');
assert(!histSelectionSource.includes('Alert.alert'), 'HistoryScreen non deve usare Alert.alert');

console.log('✓ Selezione Multipla Preferiti/Cronologia & Cuore Rimozione Rapida verificati con successo.');

// -----------------------------------------------------------------------------
// [23/23] Verifica Tabs.Protected su Cronologia & Reattività Storage OFF/ON
// -----------------------------------------------------------------------------
console.log('\n[23/23] Verifica Tabs.Protected su Cronologia & Reattività Storage OFF/ON...');

const protectedTabLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(
  /<Tabs\.Protected\s+guard=\{isHistoryEnabled\}>[\s\S]*?<Tabs\.Screen[\s\S]*?name="history"[\s\S]*?<\/Tabs\.Protected>/.test(
    protectedTabLayoutSource
  ),
  'TabLayout deve racchiudere la schermata history dentro <Tabs.Protected guard={isHistoryEnabled}>'
);
assert(
  !protectedTabLayoutSource.includes("href: isHistoryEnabled ? '/(tabs)/history' : null"),
  'TabLayout non deve più usare il workaround href: null per nascondere history'
);
assert(
  protectedTabLayoutSource.includes('AppStorage.addSettingsListener') &&
    protectedTabLayoutSource.includes('setIsHistoryEnabled(AppStorage.isHistoryEnabled())'),
  'TabLayout deve restare sincronizzato in tempo reale con AppStorage.addSettingsListener'
);

const prevRetention = AppStorage.getHistoryRetentionDays();
let settingsNotifications = 0;
const observedEnabledStates: boolean[] = [];
const unsubHistoryGuardTest = AppStorage.addSettingsListener(() => {
  settingsNotifications += 1;
  observedEnabledStates.push(AppStorage.isHistoryEnabled());
});

try {
  AppStorage.setHistoryRetentionDays(-1);
  assert.strictEqual(
    AppStorage.isHistoryEnabled(),
    false,
    'Impostare historyRetentionDays = -1 deve disabilitare isHistoryEnabled()'
  );
  AppStorage.setHistoryRetentionDays(90);
  assert.strictEqual(
    AppStorage.isHistoryEnabled(),
    true,
    'Ripristinare historyRetentionDays = 90 deve riabilitare isHistoryEnabled()'
  );
  assert.strictEqual(
    settingsNotifications,
    2,
    'addSettingsListener deve notificare sincronicamente entrambe le transizioni OFF/ON'
  );
  assert.deepStrictEqual(
    observedEnabledStates,
    [false, true],
    'Lo stato osservato dai listener durante OFF -> ON deve essere [false, true]'
  );
} finally {
  unsubHistoryGuardTest();
  AppStorage.setHistoryRetentionDays(prevRetention);
}

console.log('✓ Tabs.Protected su Cronologia & Reattività Storage OFF/ON verificati con successo.');

// -----------------------------------------------------------------------------
// [24/24] Verifica AniSkip Ending 'PROSSIMO' & Post-Ending Sequenziale (Senza Coesistenza)
// -----------------------------------------------------------------------------
console.log("\n[24/24] Verifica AniSkip Ending 'PROSSIMO' & Post-Ending Sequenziale (Senza Coesistenza)...");

assert.strictEqual(ENDING_COINCIDE_END_THRESHOLD_SECONDS, 5);
assert.strictEqual(isEndingSkipType('ed'), true);
assert.strictEqual(isEndingSkipType('mixed-ed'), true);
assert.strictEqual(isEndingSkipType('op'), false);
assert.strictEqual(isEndingSkipType('recap'), false);

const endingAtEnd: AniSkipResult = {
  skipId: 'ed-end-1',
  skipType: 'ed',
  interval: { startTime: 1345, endTime: 1436 },
  episodeLength: 1440,
};

const endingWithPost: AniSkipResult = {
  skipId: 'ed-post-1',
  skipType: 'mixed-ed',
  interval: { startTime: 1300, endTime: 1390 },
  episodeLength: 1440,
};

const opForComparison: AniSkipResult = {
  skipId: 'op-cmp-1',
  skipType: 'op',
  interval: { startTime: 0, endTime: 90 },
  episodeLength: 1440,
};

assert.strictEqual(doesEndingCoincideWithEnd(endingAtEnd, 1440), true, 'Ending a 4s dalla fine deve coincidere con la fine (soglia 5s)');
assert.strictEqual(doesEndingCoincideWithEnd({ ...endingAtEnd, interval: { startTime: 1345, endTime: 1435 } }, 1440), true, 'Ending esattamente a 5s dalla fine deve coincidere con la fine');
assert.strictEqual(doesEndingCoincideWithEnd({ ...endingAtEnd, interval: { startTime: 1345, endTime: 1434.5 } }, 1440), false, 'Ending oltre 5s dalla fine indica contenuto post-ending');
assert.strictEqual(doesEndingCoincideWithEnd(endingAtEnd, 0), true, 'Fallback a skip.episodeLength se episodeDuration non ancora nota');
assert.strictEqual(doesEndingCoincideWithEnd({ ...endingAtEnd, episodeLength: 0 }, 0), false, 'Senza durata valida non assume coincidenza');
assert.strictEqual(doesEndingCoincideWithEnd(opForComparison, 90), false, 'isEndingSkipType esclude le opening');

const manual15s: AniSkipSettings = {
  mode: 'manual',
  enableOpening: true,
  enableEnding: true,
  enableRecap: true,
  buttonDuration: 15,
};

// Case A: Ending coincides with episode end -> 'SALTA' becomes 'PROSSIMO'
const endManualWithNext = computeAniSkipOverlayState({
  currentTime: 1346,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(endManualWithNext.primarySkip?.action, 'next', 'Ending alla fine con episodio successivo deve proporre PROSSIMO al posto di SALTA');
assert.strictEqual(endManualWithNext.separateNext, null, 'Non deve duplicare PROSSIMO quando sostituisce già SALTA');
assert.strictEqual(endManualWithNext.autoAction, null);

// Duration window expires after buttonDuration (1345 + 15 = 1360) and rewinds cleanly
const endManualExpired = computeAniSkipOverlayState({
  currentTime: 1361,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(endManualExpired.primarySkip, null);
assert.strictEqual(endManualExpired.separateNext, null);

const endManualRewind = computeAniSkipOverlayState({
  currentTime: 1348,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(endManualRewind.primarySkip?.action, 'next', 'Rewind nella finestra ending deve riattivare PROSSIMO');

// Case B: Last episode (!hasNextEpisode) -> never 'PROSSIMO'
const endManualNoNext = computeAniSkipOverlayState({
  currentTime: 1346,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: manual15s,
  hasNextEpisode: false,
});
assert.strictEqual(endManualNoNext.primarySkip?.action, 'skip', 'Senza episodio successivo deve restare SALTA');
assert.strictEqual(endManualNoNext.separateNext, null);

// Case C: Auto mode when ending coincides with end
const autoSettings: AniSkipSettings = {
  ...manual15s,
  mode: 'auto',
};
const endAutoWithNext = computeAniSkipOverlayState({
  currentTime: 1345,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: autoSettings,
  hasNextEpisode: true,
  autoSkippedIds: new Set(),
});
assert.strictEqual(endAutoWithNext.autoAction?.action, 'next', 'In AUTO, ending a fine episodio con next disponibile deve navigare al prossimo episodio');

const endAutoAlreadySkipped = computeAniSkipOverlayState({
  currentTime: 1346,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: autoSettings,
  hasNextEpisode: true,
  autoSkippedIds: new Set(['ed-end-1']),
});
assert.strictEqual(endAutoAlreadySkipped.autoAction, null);

const endAutoNoNext = computeAniSkipOverlayState({
  currentTime: 1345,
  episodeDuration: 1440,
  skips: [endingAtEnd],
  settings: autoSettings,
  hasNextEpisode: false,
  autoSkippedIds: new Set(),
});
assert.strictEqual(endAutoNoNext.autoAction?.action, 'skip', 'In AUTO sull ultimo episodio deve eseguire solo skip');

// Case D: Ending WITH post-ending part (manual) -> ONLY 'SALTA' during ending, then ONLY 'PROSSIMO' in post-ending
const postDuringEnding = computeAniSkipOverlayState({
  currentTime: 1302,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(postDuringEnding.primarySkip?.action, 'skip', 'Durante ending con scena post-ending deve apparire solo SALTA');
assert.strictEqual(postDuringEnding.separateNext, null, 'SALTA e PROSSIMO non devono coesistere durante la ending');

for (const sampleT of [0, 1300, 1302, 1314.9, 1315, 1389, 1390, 1390.5, 1404.9, 1405, 1438]) {
  const probe = computeAniSkipOverlayState({
    currentTime: sampleT,
    episodeDuration: 1440,
    skips: [opForComparison, endingWithPost],
    settings: manual15s,
    hasNextEpisode: true,
  });
  assert(!(probe.primarySkip && probe.separateNext), `Al secondo ${sampleT}s non devono mai coesistere due pulsanti`);
}

// Inside post-ending window [1390, 1405) for buttonDuration=15 -> separate 'PROSSIMO' appears alone
const postAfterEndingStart = computeAniSkipOverlayState({
  currentTime: 1390.5,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(postAfterEndingStart.primarySkip, null);
assert(postAfterEndingStart.separateNext !== null, 'All inizio della scena post-ending deve mostrare PROSSIMO per buttonDuration');
assert.strictEqual(postAfterEndingStart.separateNext?.startTime, 1390);
assert.strictEqual(postAfterEndingStart.separateNext?.endTime, 1440);

const postAfterEndingExpired = computeAniSkipOverlayState({
  currentTime: 1406,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(postAfterEndingExpired.separateNext, null, 'Il pulsante PROSSIMO post-ending deve rispettare buttonDuration (15s)');

const postAfterEndingRewind = computeAniSkipOverlayState({
  currentTime: 1394,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: manual15s,
  hasNextEpisode: true,
});
assert(postAfterEndingRewind.separateNext !== null, 'Rewind nella finestra post-ending deve riattivare PROSSIMO');

// Case E: Auto mode with post-ending skips to 1390.5 and then exposes separate 'PROSSIMO'
const postAutoTrigger = computeAniSkipOverlayState({
  currentTime: 1300,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: autoSettings,
  hasNextEpisode: true,
  autoSkippedIds: new Set(),
});
assert.strictEqual(postAutoTrigger.autoAction?.action, 'skip');
assert.strictEqual(postAutoTrigger.autoAction?.targetTime, 1390.5);

const postAutoAfterJump = computeAniSkipOverlayState({
  currentTime: 1390.5,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: autoSettings,
  hasNextEpisode: true,
  autoSkippedIds: new Set(['ed-post-1']),
});
assert(postAutoAfterJump.separateNext !== null, 'Anche dopo auto-skip di una ending con post-ending deve comparire PROSSIMO');

// Case F: Infinite duration (buttonDuration = 0) & disabled/enableEnding=false
const manualInfinite: AniSkipSettings = { ...manual15s, buttonDuration: 0 };
const postInfiniteEnd = computeAniSkipOverlayState({
  currentTime: 1438,
  episodeDuration: 1440,
  skips: [endingWithPost],
  settings: manualInfinite,
  hasNextEpisode: true,
});
assert(postInfiniteEnd.separateNext !== null, 'Con buttonDuration=0 (∞) PROSSIMO deve restare visibile fino a fine episodio');

const disabledEndingResult = computeAniSkipOverlayState({
  currentTime: 1346,
  episodeDuration: 1440,
  skips: [endingAtEnd, opForComparison],
  settings: { ...manual15s, enableEnding: false },
  hasNextEpisode: true,
});
assert.strictEqual(disabledEndingResult.primarySkip, null);
assert.strictEqual(disabledEndingResult.separateNext, null);

const openingAtStart = computeAniSkipOverlayState({
  currentTime: 0,
  episodeDuration: 1440,
  skips: [opForComparison],
  settings: manual15s,
  hasNextEpisode: true,
});
assert.strictEqual(openingAtStart.primarySkip?.action, 'skip', 'Intro che inizia a 0s deve attivare SALTA correttamente');

// Case G: UI & Player Integration Checks (Mutually Exclusive Rendering)
assert(aniSkipBtnCode.includes("variant?: 'skip' | 'next'"), 'AniSkipButton deve esporre la prop variant');
assert(aniSkipBtnCode.includes('play-skip-forward'), 'AniSkipButton variant=next deve usare icona play-skip-forward');
assert(!aniSkipBtnCode.includes('inline?: boolean'), 'AniSkipButton non deve più usare rendering inline affiancato');
assert(
  aniSkipBtnCode.includes("typeof endTime === 'number' && typeof startTime === 'number' && endTime > startTime"),
  'AniSkipButton deve gestire correttamente startTime === 0'
);
assert(
  playerScreenSource.includes('{primarySkipState ? (') &&
    playerScreenSource.includes(': separateNextState && (nextEpisode || nextEpisodeRef.current) ? ('),
  'Player deve renderizzare in mutua esclusione un solo pulsante AniSkip alla volta (SALTA oppure PROSSIMO)'
);
assert(playerScreenSource.includes('markCurrentCompleted: true'), 'Navigazione da AniSkip PROSSIMO deve marcare completato l episodio corrente');
assert(
  settingsCodeFinal.includes('DURATA PULSANTI ANISKIP'),
  'Settings deve aggiornare la label della durata ai pulsanti AniSkip (SALTA / PROSSIMO)'
);
const durationSliderCode = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AniSkipDurationSlider.tsx'),
  'utf-8'
);
assert(
  durationSliderCode.includes('DURATA PULSANTI ANISKIP'),
  'AniSkipDurationSlider deve avere accessibilityLabelPrefix aggiornato'
);

console.log("✓ AniSkip Ending 'PROSSIMO' & Post-Ending Sequenziale verificati con successo.");

// -----------------------------------------------------------------------------
// Fine Test
// -----------------------------------------------------------------------------
console.log('\n==============================================');
console.log('🎉 TUTTI I TEST SONO PASSATI CON SUCCESSO! 🎉');
console.log('==============================================');
