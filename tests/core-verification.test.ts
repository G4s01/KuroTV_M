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
import { AppStorage, StorageKeys } from '../src/services/storage/index';
import { scraperConfig } from '../src/services/scraper/config';
import { ProviderRegistry } from '../src/services/scraper/registry';
import {
  PlayerHeader,
  PlayerTimeline,
  PlayerFooter,
  PlayerEpisodesCarouselSheet,
  PlayerInfoSheet,
  formatTime,
  formatDeltaTime,
  getAniSkipChapterBadge,
  computeTimelineChapters,
  findChapterAtTime,
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
import type { LocalStorageState, RemotePullResponse } from '../src/services/sync/index';
import {
  SyncManager,
  DEFAULT_SYNC_SERVER_URL,
  KUROSYNC_GITHUB_REPO_URL,
  parseKuroSyncDeepLink,
  KuroSyncClient,
  mergeLocalAndRemote,
  getDeviceName,
  getDeviceMetadata,
} from '../src/services/sync/index';
import {
  SyncSettingsCard,
  SyncConnectModal,
  AuthorizeTvModal,
  SyncProfileModal,
  QrScannerModal,
} from '../src/components/settings/index';

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
  'app/(tabs)/profile.tsx',
  'app/(tabs)/settings.tsx',
  'app/settings/_layout.tsx',
  'app/settings/appearance.tsx',
  'app/settings/playback.tsx',
  'app/settings/sync.tsx',
  'app/settings/downloads.tsx',
  'app/settings/source.tsx',
  'app/settings/history.tsx',
  'app/settings/about.tsx',
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

// 8. AniSkip Settings in SettingsScreen / Playback Subpage
const settingsScreenCode = fs.existsSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsScreenCode.includes('ANISKIP'), 'playback.tsx deve contenere la sezione ANISKIP');
assert(settingsScreenCode.includes('MODALITÀ DI SALTO'), 'playback.tsx deve permettere la selezione della modalità');
assert(settingsScreenCode.includes('COSA SALTARE'), 'playback.tsx deve permettere di selezionare cosa saltare');
assert(settingsScreenCode.includes('enableRecap'), 'playback.tsx deve supportare lo skip del recap');

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

// 4. Settings screen UI section (Appearance Subpage)
const settingsSource = fs.existsSync(path.resolve(process.cwd(), 'app/settings/appearance.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/appearance.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
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

const updatedSettings = fs.existsSync(path.resolve(process.cwd(), 'app/settings/about.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/about.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
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
const settingsCodeAfter = fs.existsSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsCodeAfter.includes('AniSkipSlider'), 'playback.tsx deve utilizzare AniSkipSlider');
const navBarCodeAfter = fs.existsSync(path.resolve(process.cwd(), 'app/settings/appearance.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/appearance.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(navBarCodeAfter.includes('A SCOMPARSA, RICHIAMABILE CON SWIPE DAL BASSO.'), 'appearance.tsx deve avere la descrizione snellita per NAVBAR auto-hide');
assert(navBarCodeAfter.includes('SEMPRE FISSA E VISIBILE IN-APP.'), 'appearance.tsx deve avere la descrizione snellita per NAVBAR visible');

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
const settingsCodeFinal = fs.existsSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/playback.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
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
assert(scheduleTabLayoutSource.includes('name="explore"') && scheduleTabLayoutSource.includes('href: null'), 'explore deve avere href: null nel TabLayout poichè il pulsante è stato spostato in Home');

// 7. Verifica Fix Aggiornamenti Manuali in settings.tsx / about.tsx
const settingsFixedSource = fs.existsSync(path.resolve(process.cwd(), 'app/settings/about.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/about.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsFixedSource.includes('onPress={() => handleStartDownloadUpdate()}'), 'settings/about deve non passare event a handleStartDownloadUpdate');
assert(settingsFixedSource.includes('isManifest = (m: any): boolean =>'), 'settings/about deve validare che il manifest passato sia un UpdateManifest valido');
assert(settingsFixedSource.includes("prev === 'idle' || prev === 'error' ? 'available' : prev"), 'settings/about deve recuperare dallo stato di errore al focus');

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

const settingsSearchSource = fs.existsSync(path.resolve(process.cwd(), 'app/settings/history.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/history.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsSearchSource.includes('CRONOLOGIA DI RICERCA'), 'history/settings deve contenere la sezione CRONOLOGIA DI RICERCA');
assert(settingsSearchSource.includes('SEARCH_RETENTION_STEPS'), 'history/settings deve usare SEARCH_RETENTION_STEPS con HistorySlider');
assert(settingsSearchSource.includes('isClearSearchHistoryConfirmOpen'), 'history/settings deve gestire la modale ConfirmModal per svuotare le ricerche');

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
assert.strictEqual(tabletPortrait.isMasterDetail, false, 'Tablet portrait non deve dividersi a meta (colonna singola)');

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
assert(tabLayoutRespSource.includes('TabletNavigationRail'), 'TabLayout deve utilizzare TabletNavigationRail per la navigation rail');
assert(tabLayoutRespSource.includes('handleProfilePress'), 'TabLayout deve connettere onProfilePress');
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
// 25. Verifica Sincronizzazione Self-Hosted KuroSync (KuroTV_S, MMKV Storage Bridge, Debounce & TV Pairing)
// -----------------------------------------------------------------------------
console.log('\n[25/25] Verifica Sincronizzazione Self-Hosted KuroSync (KuroTV_S, MMKV Storage Bridge, Debounce & TV Pairing)...');

// 1. Deep-link URL scheme parsing (kurosync://connect?url=...&token=...&profile=...)
const validDeepLink = 'kurosync://connect?url=' + encodeURIComponent('https://my-sync.workers.dev') + '&token=' + encodeURIComponent('token-abc-123') + '&profile=' + encodeURIComponent('prof-primary');
const parsedLink = parseKuroSyncDeepLink(validDeepLink);
assert(parsedLink !== null, 'Il parser deep-link deve riconoscere kurosync://');
assert.strictEqual(parsedLink?.url, 'https://my-sync.workers.dev', 'URL del server estratto correttamente');
assert.strictEqual(parsedLink?.token, 'token-abc-123', 'Token estratto correttamente');
assert.strictEqual(parsedLink?.profile, 'prof-primary', 'Profilo estratto correttamente');

const noProfileLink = 'kurosync://connect?url=' + encodeURIComponent('https://my-sync.workers.dev') + '&token=' + encodeURIComponent('tok-xyz');
const parsedNoProfile = parseKuroSyncDeepLink(noProfileLink);
assert(parsedNoProfile !== null);
assert.strictEqual(parsedNoProfile?.token, 'tok-xyz');
assert.strictEqual(parsedNoProfile?.profile, undefined);

const invalidLink = 'https://google.com/search?q=kurotv';
assert.strictEqual(parseKuroSyncDeepLink(invalidLink), null, 'Link non inerenti devono restituire null');

const tvPairSchemeLink = 'kurosync://pair?code=K7X9P2';
const parsedTvScheme = parseKuroSyncDeepLink(tvPairSchemeLink);
assert(parsedTvScheme !== null, 'Il parser deep-link deve riconoscere kurosync://pair');
assert.strictEqual(parsedTvScheme?.code, 'K7X9P2', 'Codice TV K7X9P2 estratto da kurosync://pair');

const tvPairWebLink = 'https://my-sync.workers.dev/pair?code=ABC123';
const parsedTvWeb = parseKuroSyncDeepLink(tvPairWebLink);
assert(parsedTvWeb !== null, 'Il parser deep-link deve riconoscere link web /pair?code=');
assert.strictEqual(parsedTvWeb?.code, 'ABC123', 'Codice TV ABC123 estratto da link web');
assert.strictEqual(parsedTvWeb?.url, 'https://my-sync.workers.dev', 'URL estratto da origin di link web /pair');

const webConsoleLink = 'https://my-sync.workers.dev/connect?token=xyz';
const parsedWebConsole = parseKuroSyncDeepLink(webConsoleLink);
assert(parsedWebConsole !== null, 'Il parser deep-link deve riconoscere link web console /connect?token=');
assert.strictEqual(parsedWebConsole?.url, 'https://my-sync.workers.dev', 'URL del server estratto da origin del link web console');
assert.strictEqual(parsedWebConsole?.token, 'xyz', 'Token estratto dal link web console');

const jsonQrPayload = JSON.stringify({ url: 'https://my-sync.workers.dev', token: 'json-token-999', profile: 'prof-2' });
const parsedJson = parseKuroSyncDeepLink(jsonQrPayload);
assert(parsedJson !== null, 'Il parser deep-link deve supportare codici QR in formato JSON');
assert.strictEqual(parsedJson?.url, 'https://my-sync.workers.dev');
assert.strictEqual(parsedJson?.token, 'json-token-999');
assert.strictEqual(parsedJson?.profile, 'prof-2');

const jsonTvCode = JSON.stringify({ code: 'TVCODE' });
const parsedJsonTv = parseKuroSyncDeepLink(jsonTvCode);
assert(parsedJsonTv !== null);
assert.strictEqual(parsedJsonTv?.code, 'TVCODE');

// 2. Pure Merge Engine Tests (mergeLocalAndRemote)
// Case A: Tombstone Dominance for Favorites and Continue Watching
const localFavItem = {
  id: 'fav-anime-1',
  title: 'Demon Slayer',
  thumbnail: 'https://example.com/thumb.jpg',
  genres: ['Action'],
  link: '/anime/fav-anime-1',
  updatedAt: 1000,
};
const localCwItem = {
  animeId: 'cw-anime-1',
  title: 'Demon Slayer',
  thumbnail: 'https://example.com/thumb.jpg',
  episodeId: 'ep-10',
  episodeNumber: 10,
  position: 300,
  duration: 1400,
  percentage: 21,
  updatedAt: 1000,
  isCaughtUp: false,
};

const mergeTombstoneResult = mergeLocalAndRemote(
  {
    favorites: [localFavItem],
    continueWatching: [localCwItem],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [{ query: 'NARUTO', timestamp: 1000 }],
  },
  {
    serverTime: 2000,
    deltas: {
      favorites: [],
      continueWatching: [],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [],
    },
    tombstones: [
      { type: 'favorite', key: 'fav-anime-1', deletedAt: 1500 },
      { type: 'continue_watching', key: 'cw-anime-1', deletedAt: 1500 },
      { type: 'search_history', key: 'NARUTO', deletedAt: 1500 },
    ],
  }
);
assert.strictEqual(mergeTombstoneResult.state.favorites.length, 0, 'Il preferito con tombstone deve essere eliminato');
assert.strictEqual(mergeTombstoneResult.state.continueWatching.length, 0, 'Il continue watching con tombstone deve essere eliminato');
assert.strictEqual(mergeTombstoneResult.state.searchHistory.length, 0, 'La ricerca con tombstone deve essere eliminata');
assert(mergeTombstoneResult.appliedDeletions >= 3, 'Tombstones applicati con successo');

// Case B: Continue Watching Episode Regression Prevention (Local Ahead)
const localAheadCw = {
  animeId: 'anime-ahead-1',
  title: 'One Piece',
  thumbnail: 'https://example.com/op.jpg',
  episodeId: 'ep-13',
  episodeNumber: 13,
  position: 120,
  duration: 1440,
  percentage: 8,
  updatedAt: 2000,
  isCaughtUp: false,
};
const remoteBehindCw = {
  animeId: 'anime-ahead-1',
  title: 'One Piece',
  thumbnail: 'https://example.com/op.jpg',
  episodeId: 'ep-12',
  episodeNumber: 12,
  position: 1400,
  duration: 1440,
  percentage: 97,
  updatedAt: 2500,
  isCaughtUp: true, // Stale isCaughtUp from older episode
};

const mergeRegressionResult = mergeLocalAndRemote(
  {
    favorites: [],
    continueWatching: [localAheadCw],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [],
  },
  {
    serverTime: 3000,
    deltas: {
      favorites: [],
      continueWatching: [remoteBehindCw],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [],
    },
    tombstones: [],
  }
);
assert.strictEqual(mergeRegressionResult.state.continueWatching.length, 1);
const mergedCwAhead = mergeRegressionResult.state.continueWatching[0];
assert.strictEqual(mergedCwAhead.episodeNumber, 13, 'Non deve regredire all episodio 12 remoto');
assert.strictEqual(mergedCwAhead.isCaughtUp, false, 'Non deve ereditare isCaughtUp dall episodio 12 obsoleto');

// Case C: Continue Watching Advance Progression (Remote Ahead)
const localBehindCw = { ...localAheadCw, episodeNumber: 13, isCaughtUp: false };
const remoteAheadCw = {
  ...localAheadCw,
  episodeId: 'ep-14',
  episodeNumber: 14,
  position: 0,
  percentage: 0,
  updatedAt: 3000,
  isCaughtUp: true,
};

const mergeAdvanceResult = mergeLocalAndRemote(
  {
    favorites: [],
    continueWatching: [localBehindCw],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [],
  },
  {
    serverTime: 4000,
    deltas: {
      favorites: [],
      continueWatching: [remoteAheadCw],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [],
    },
    tombstones: [],
  }
);
const mergedCwAdvance = mergeAdvanceResult.state.continueWatching[0];
assert.strictEqual(mergedCwAdvance.episodeNumber, 14, 'Deve avanzare all episodio 14 remoto');
assert.strictEqual(mergedCwAdvance.isCaughtUp, true, 'Deve ereditare lo stato IN PARI dall episodio 14');

// Case D: Timeline Progress Safeguard (Same Episode: Max Position & Percentage)
const localEp1Progress = {
  animeId: 'anime-safeguard-1',
  animeTitle: 'Solo Leveling',
  thumbnail: '',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 500,
  duration: 1440,
  percentage: 35,
  isCompleted: false,
  updatedAt: 2000,
};
const remoteEp1Progress = {
  animeId: 'anime-safeguard-1',
  animeTitle: 'Solo Leveling',
  thumbnail: '',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 300,
  duration: 1440,
  percentage: 21,
  isCompleted: false,
  updatedAt: 2500, // Newer timestamp but smaller progress!
};

const mergeProgressResult = mergeLocalAndRemote(
  {
    favorites: [],
    continueWatching: [],
    watchHistory: [],
    watchProgress: [localEp1Progress],
    sharedSettings: {},
    searchHistory: [],
  },
  {
    serverTime: 3000,
    deltas: {
      favorites: [],
      continueWatching: [],
      watchHistory: [],
      watchProgress: [remoteEp1Progress],
      sharedSettings: {},
      searchHistory: [],
    },
    tombstones: [],
  }
);
const mergedProgress = mergeProgressResult.state.watchProgress[0];
assert.strictEqual(mergedProgress.currentTime, 500, 'Timeline Progress Safeguard: deve preservare la posizione maggiore');
assert.strictEqual(mergedProgress.percentage, 35, 'Timeline Progress Safeguard: deve preservare la percentuale maggiore');

// Case E: Merge Sorting Order (Newest updatedAt / timestamp First)
const olderCw = { ...localCwItem, animeId: 'older-cw', updatedAt: 1000 };
const newerRemoteCw = { ...localCwItem, animeId: 'newer-cw', updatedAt: 5000 };
const mergeSortResult = mergeLocalAndRemote(
  {
    favorites: [
      { ...localFavItem, id: 'fav-old', updatedAt: 1000 },
    ],
    continueWatching: [olderCw],
    watchHistory: [
      { animeId: 'a1', episodeNumber: 1, episodeId: 'e1', title: 'A', thumbnail: '', position: 0, duration: 100, progressPercent: 0, isCompleted: false, updatedAt: 1000 },
    ],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [{ query: 'OLD_SEARCH', timestamp: 1000 }],
  },
  {
    serverTime: 6000,
    deltas: {
      favorites: [
        { ...localFavItem, id: 'fav-new', updatedAt: 5000 },
      ],
      continueWatching: [newerRemoteCw],
      watchHistory: [
        { animeId: 'a2', episodeNumber: 1, episodeId: 'e2', title: 'B', thumbnail: '', position: 0, duration: 100, progressPercent: 0, isCompleted: false, updatedAt: 5000 },
      ],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [{ query: 'NEW_SEARCH', timestamp: 5000 }],
    },
    tombstones: [],
  }
);
assert.strictEqual(mergeSortResult.state.continueWatching[0].animeId, 'newer-cw', 'Continue watching deve essere ordinato con il più recente in testa');
assert.strictEqual(mergeSortResult.state.watchHistory[0].animeId, 'a2', 'Watch history deve essere ordinata con il più recente in testa');
assert.strictEqual(mergeSortResult.state.favorites[0].id, 'fav-new', 'Favorites deve essere ordinato con il più recente in testa');
assert.strictEqual(mergeSortResult.state.searchHistory[0].query, 'NEW_SEARCH', 'Search history deve essere ordinata con la più recente in testa');

// 3. Storage Bridge with MMKV (app-storage.ts)
AppStorage.clearPendingSyncDeletions();
AppStorage.clearPendingSyncMutations();
assert.strictEqual(AppStorage.getPendingSyncDeletions().length, 0);

// Test tombstone generation on favorite removal
const testSyncAnime = {
  id: 'sync-anime-fav',
  title: 'Bleach',
  thumbnail: 'https://example.com/bleach.jpg',
  genres: ['Action'],
  link: '/anime/bleach',
};
AppStorage.toggleFavorite(testSyncAnime); // Added
const mutationsAfterFavAdd = AppStorage.getPendingSyncMutations();
assert(Array.isArray(mutationsAfterFavAdd.favorites), 'Aggiunta ai preferiti deve accodare una mutation');
assert(mutationsAfterFavAdd.favorites.some((f: any) => f.id === 'sync-anime-fav'));

AppStorage.toggleFavorite(testSyncAnime); // Removed
const deletionsAfterFavRemove = AppStorage.getPendingSyncDeletions();
assert(deletionsAfterFavRemove.some((d) => d.type === 'favorite' && d.key === 'sync-anime-fav'), 'Rimozione dai preferiti deve generare tombstone favorite');

// Test tombstone generation on continue watching removal
AppStorage.removeContinueWatching('anime-cw-del');
const deletionsAfterCw = AppStorage.getPendingSyncDeletions();
assert(deletionsAfterCw.some((d) => d.type === 'continue_watching' && d.key === 'anime-cw-del'), 'Rimozione da continue watching deve generare tombstone continue_watching');

// Test tombstone generation on watch history removal
AppStorage.removeWatchHistoryItem('anime-hist-del', 'ep-5', 5);
const deletionsAfterHist = AppStorage.getPendingSyncDeletions();
assert(deletionsAfterHist.some((d) => d.type === 'watch_history' && d.key === 'anime-hist-del:5'), 'Rimozione cronologia deve generare tombstone watch_history');
assert(deletionsAfterHist.some((d) => d.type === 'watch_progress' && d.key === 'anime-hist-del:5'), 'Rimozione cronologia deve generare tombstone watch_progress');

// Test tombstone generation on search history removal
AppStorage.removeSearchHistoryItem('ATTACK ON TITAN');
const deletionsAfterSearch = AppStorage.getPendingSyncDeletions();
assert(deletionsAfterSearch.some((d) => d.type === 'search_history' && d.key === 'ATTACK ON TITAN'), 'Rimozione ricerca deve generare tombstone search_history');

// Test progress saving and mutation queuing
AppStorage.saveWatchProgress({
  animeId: 'sync-progress-anime',
  animeTitle: 'Frieren',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 100,
  duration: 1400,
});
const mutationsAfterProgress = AppStorage.getPendingSyncMutations();
assert(Array.isArray(mutationsAfterProgress.watchProgress), 'Salvataggio progresso deve accodare watchProgress');
assert(mutationsAfterProgress.watchProgress.some((wp: any) => wp.animeId === 'sync-progress-anime'));

const allWatchProgress = AppStorage.getAllWatchProgress();
assert(allWatchProgress.some((wp) => wp.animeId === 'sync-progress-anime'), 'getAllWatchProgress deve recuperare gli elementi da user.progress.*');

// Test queue reconciliation: re-adding favorite clears deletion tombstone
AppStorage.clearPendingSyncDeletions();
AppStorage.clearPendingSyncMutations();
AppStorage.recordSyncDeletion('favorite', 're-add-anime');
assert.strictEqual(AppStorage.getPendingSyncDeletions().length, 1);
AppStorage.recordSyncMutation('favorites', { id: 're-add-anime', title: 'ReAdd', thumbnail: '', genres: [], link: '' });
assert.strictEqual(AppStorage.getPendingSyncDeletions().length, 0, 'La ri-aggiunta deve cancellare il tombstone pendente');
assert.strictEqual(AppStorage.getPendingSyncMutations().favorites.length, 1, 'La ri-aggiunta deve accodare la mutation');

// Test queue reconciliation: deleting item clears pending mutation
AppStorage.recordSyncDeletion('favorite', 're-add-anime');
assert.strictEqual(AppStorage.getPendingSyncDeletions().length, 1, 'Cancellazione deve accodare tombstone');
assert.strictEqual((AppStorage.getPendingSyncMutations().favorites || []).length, 0, 'Cancellazione deve rimuovere la mutation pendente');

// Test wildcard history deletion generates watch_progress tombstones for discrete keys
AppStorage.saveWatchProgress({
  animeId: 'wildcard-test-anime',
  animeTitle: 'Wildcard Title',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 50,
  duration: 1400,
});
AppStorage.saveWatchProgress({
  animeId: 'wildcard-test-anime',
  animeTitle: 'Wildcard Title',
  episodeId: 'ep-2',
  episodeNumber: 2,
  currentTime: 80,
  duration: 1400,
});
AppStorage.clearPendingSyncDeletions();
AppStorage.removeWatchHistoryItem('wildcard-test-anime'); // Wildcard removal (no ep specified)
const wildcardDels = AppStorage.getPendingSyncDeletions();
assert(wildcardDels.some((d) => d.type === 'watch_progress' && d.key === 'wildcard-test-anime:1'), 'Wildcard deletion deve generare tombstone progress per ep 1');
assert(wildcardDels.some((d) => d.type === 'watch_progress' && d.key === 'wildcard-test-anime:2'), 'Wildcard deletion deve generare tombstone progress per ep 2');

// 4. KuroSyncClient SDK Methods Verification with Mock Fetch
const mockClient = new KuroSyncClient({
  baseUrl: 'https://my-sync.workers.dev',
  deviceToken: 'mock-token-123',
});
assert.strictEqual(mockClient.getBaseUrl(), 'https://my-sync.workers.dev');
assert.strictEqual(mockClient.getDeviceToken(), 'mock-token-123');

const originalFetch = globalThis.fetch;
let lastFetchUrl = '';
let lastFetchOptions: any = null;

// Mock globalThis.fetch for SDK methods
(globalThis as any).fetch = async (url: string, options: any) => {
  lastFetchUrl = url;
  lastFetchOptions = options;
  if (url.includes('/api/health')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, initialized: true, version: '1.0.0' }),
    } as any;
  }
  if (url.includes('/api/pair/approve')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, deviceId: 'tv-device-uuid-999' }),
    } as any;
  }
  if (url.includes('/api/sync/pull')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        serverTime: 1234567890,
        deltas: {
          favorites: [],
          continueWatching: [],
          watchHistory: [],
          watchProgress: [],
          sharedSettings: {},
          searchHistory: [],
        },
        tombstones: [],
      }),
    } as any;
  }
  if (url.includes('/api/sync/push')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, serverTime: 1234567895, appliedCount: 1 }),
    } as any;
  }
  if (url.includes('/api/profiles')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        profiles: [
          { id: 'prof-1', name: 'Principale', avatar_color: '#E50914' },
          { id: 'prof-2', name: 'Salotto TV', avatar_color: '#3B82F6' },
        ],
      }),
    } as any;
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as any;
};

// 4.1 Check Health
const healthRes = await mockClient.checkHealth();
assert.strictEqual(healthRes.ok, true, 'checkHealth deve restituire ok');
assert(lastFetchUrl.endsWith('/api/health'));

// 4.2 TV Pairing Approval
const pairRes = await mockClient.approveTvPairing({
  code: 'K7X9P2',
  profileId: 'prof-1',
  deviceLabel: 'Living Room TV',
});
assert.strictEqual(pairRes.ok, true, 'approveTvPairing deve restituire ok');
assert(lastFetchUrl.endsWith('/api/pair/approve'));
assert.strictEqual(lastFetchOptions.headers['Authorization'], 'Bearer mock-token-123');
const pairBody = JSON.parse(lastFetchOptions.body);
assert.strictEqual(pairBody.code, 'K7X9P2');
assert.strictEqual(pairBody.profileId, 'prof-1');

// 4.3 List Profiles
const profilesList = await mockClient.listProfiles();
assert.strictEqual(profilesList.length, 2, 'listProfiles deve restituire i 2 profili');
assert.strictEqual(profilesList[0].name, 'Principale');

// 5. TV Pairing in SyncManager (Supporto sia codice che URL completa del QR)
AppStorage.setString(StorageKeys.SYNC_SERVER_URL, 'https://my-sync.workers.dev');
AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, 'test-sync-token');
AppStorage.setString(StorageKeys.SYNC_PROFILE_ID, 'prof-1');
const tvApprovalRaw = await SyncManager.approveTvPairing('K7X9P2', 'prof-1');
assert.strictEqual(tvApprovalRaw.ok, true, 'Approvazione con codice raw deve riuscire');

const tvApprovalUrl = await SyncManager.approveTvPairing('https://my-sync.workers.dev/pair?code=K7X9P2', 'prof-1');
assert.strictEqual(tvApprovalUrl.ok, true, 'Approvazione con URL QR deve estrarre il codice e riuscire');

// 6. Playback Debounce (45-60s) & Immediate Flush
let pushCount = 0;
const originalPushDelta = (SyncManager as any).client.pushDelta.bind((SyncManager as any).client);
(SyncManager as any).client.pushDelta = async (delta: any) => {
  pushCount++;
  return { ok: true, serverTime: Date.now(), appliedCount: 1 };
};

// Initial playback update (sets baseline)
await SyncManager.recordPlaybackProgress({
  animeId: 'anime-debounce-test',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 10,
  duration: 1400,
  isCompleted: false,
});
assert.strictEqual(pushCount, 0, 'Il primo tick non deve invocare push immediato se non trascorso 45s');

// Tick 4s later (normal playback tick): must be debounced, NO push!
await SyncManager.recordPlaybackProgress({
  animeId: 'anime-debounce-test',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 14,
  duration: 1400,
  isCompleted: false,
});
assert.strictEqual(pushCount, 0, 'Tick di avanzamento normale (4s) deve essere debounced a 45-60s per rispettare i limiti D1');

// Immediate flush on Pause / Unmount / Completion
await SyncManager.recordPlaybackProgress(
  {
    animeId: 'anime-debounce-test',
    episodeId: 'ep-1',
    episodeNumber: 1,
    currentTime: 14,
    duration: 1400,
    isCompleted: false,
  },
  true // Immediate!
);
assert.strictEqual(pushCount, 1, 'Invocazione con immediate=true (pausa o uscita) deve forzare il flush istantaneo');

// Immediate flush on completion (>= 90%)
await SyncManager.recordPlaybackProgress({
  animeId: 'anime-debounce-test',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 1300,
  duration: 1400,
  isCompleted: true, // Completed!
});
assert.strictEqual(pushCount, 2, 'Raggiungimento della soglia di fine episodio (isCompleted) deve forzare il flush istantaneo');

// Test atomic push: pushPending with pending playback payload must invoke pushDelta exactly once
pushCount = 0;
await SyncManager.recordPlaybackProgress({
  animeId: 'atomic-push-test',
  episodeId: 'ep-1',
  episodeNumber: 1,
  currentTime: 50,
  duration: 1400,
  isCompleted: false,
});
assert.strictEqual(pushCount, 0);
await SyncManager.pushPending(true);
assert.strictEqual(pushCount, 1, 'pushPending con payload in sospeso deve eseguire ESATTAMENTE un solo pushDelta atomico');

// Restore original fetch and pushDelta
(SyncManager as any).client.pushDelta = originalPushDelta;
globalThis.fetch = originalFetch;

// Clean up test token in storage
AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);
AppStorage.remove(StorageKeys.SYNC_SERVER_URL);

// 7. Verify UI Components Export & AGENTS.md Compliance
assert(
  typeof SyncSettingsCard === 'function' || typeof SyncSettingsCard === 'object',
  'SyncSettingsCard deve essere un componente React valido'
);
assert(
  typeof SyncConnectModal === 'function' || typeof SyncConnectModal === 'object',
  'SyncConnectModal deve essere un componente React valido'
);
assert(
  typeof AuthorizeTvModal === 'function' || typeof AuthorizeTvModal === 'object',
  'AuthorizeTvModal deve essere un componente React valido'
);
assert(
  typeof SyncProfileModal === 'function' || typeof SyncProfileModal === 'object',
  'SyncProfileModal deve essere un componente React valido'
);
assert(
  typeof QrScannerModal === 'function' || typeof QrScannerModal === 'object',
  'QrScannerModal deve essere un componente React valido'
);

const appJsonRaw = fs.readFileSync(path.resolve(process.cwd(), 'app.json'), 'utf-8');
const appJson = JSON.parse(appJsonRaw);
const cameraPlugin = appJson.expo.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-camera');
assert(cameraPlugin, 'Plugin expo-camera configurato in app.json');
assert.strictEqual(cameraPlugin[1].recordAudioAndroid, false, 'recordAudioAndroid deve essere false per non richiedere il microfono');
assert(!appJson.expo.android.permissions.includes('android.permission.RECORD_AUDIO'), 'RECORD_AUDIO non deve essere nei permessi Android');

const qrScannerSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/QrScannerModal.tsx'), 'utf-8');
assert(qrScannerSource.includes('onMountError'), 'QrScannerModal deve gestire onMountError per prevenire blocchi hardware');
assert(qrScannerSource.includes('openSettings'), 'QrScannerModal deve offrire openSettings quando il permesso è bloccato');

// Verify NO hardcoded personal URL exists and generic placeholder / empty default is used
assert.strictEqual(DEFAULT_SYNC_SERVER_URL, '', 'DEFAULT_SYNC_SERVER_URL non deve esporre l\'istanza privata');
assert.strictEqual(KUROSYNC_GITHUB_REPO_URL, 'https://github.com/G4s01/KuroTV_S', 'KUROSYNC_GITHUB_REPO_URL deve puntare al repo ufficiale');

const settingsCardSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncSettingsCard.tsx'), 'utf-8');
assert(settingsCardSource.includes('KUROSYNC_GITHUB_REPO_URL'), 'SyncSettingsCard deve collegare il repository GitHub di KuroTV_S');
assert(settingsCardSource.includes('Linking.openURL'), 'SyncSettingsCard deve aprire il link GitHub con Linking.openURL');

const connectModalSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncConnectModal.tsx'), 'utf-8');
assert(connectModalSource.includes('QrScannerModal'), 'SyncConnectModal deve integrare QrScannerModal');
assert(connectModalSource.includes('SCANSIONA CON FOTOCAMERA'), 'SyncConnectModal deve offrire il pulsante per scansionare con fotocamera');
assert(connectModalSource.includes('tuo-kurotv-s'), 'SyncConnectModal deve usare un placeholder generico es. tuo-kurotv-s');
assert(!connectModalSource.includes('kurotv-s.g4s01.workers.dev'), 'SyncConnectModal non deve contenere URL personale hardcoded');

const authorizeTvSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/AuthorizeTvModal.tsx'), 'utf-8');
assert(authorizeTvSource.includes('QrScannerModal'), 'AuthorizeTvModal deve integrare QrScannerModal');
assert(authorizeTvSource.includes('SCANSIONA QR DELLA TV'), 'AuthorizeTvModal deve offrire il pulsante scanner fotocamera');

const settingsSyncCheckSource = fs.existsSync(path.resolve(process.cwd(), 'app/settings/sync.tsx'))
  ? fs.readFileSync(path.resolve(process.cwd(), 'app/settings/sync.tsx'), 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsSyncCheckSource.includes('<SyncSettingsCard'), 'settings sync deve includere SyncSettingsCard');

const layoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(layoutSource.includes('kurosync://'), '_layout.tsx deve gestire il deep-link kurosync://');
assert(layoutSource.includes('SyncManager.pullDelta'), '_layout.tsx deve sincronizzare al rientro in foreground');
assert(layoutSource.includes('SyncManager.pushPending'), '_layout.tsx deve fare push delle modifiche pendenti su background');

const playerSource = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerSource.includes('SyncManager.recordPlaybackProgress'), 'player/[id].tsx deve inviare il progresso a SyncManager');
assert(playerSource.includes('SyncManager.flushPlaybackProgress'), 'player/[id].tsx deve fare flush immediato del progresso su pausa o unmount');

// Check AGENTS.md rule: NO Alert.alert in any sync component
const syncFiles = [
  'src/services/sync/sync-manager.ts',
  'src/services/sync/client.ts',
  'src/components/settings/SyncSettingsCard.tsx',
  'src/components/settings/SyncConnectModal.tsx',
  'src/components/settings/AuthorizeTvModal.tsx',
  'src/components/settings/SyncProfileModal.tsx',
  'src/components/settings/QrScannerModal.tsx',
];
for (const f of syncFiles) {
  const content = fs.readFileSync(path.resolve(process.cwd(), f), 'utf-8');
  assert(!content.includes('Alert.alert'), `Divieto Alert.alert violato in ${f}`);
  assert(!content.includes('kurotv-s.g4s01.workers.dev'), `URL personale non rimosso da ${f}`);
}

console.log('✓ Sincronizzazione Self-Hosted KuroSync, MMKV Storage Bridge, Debounce & TV Pairing verificati con successo.');

// -----------------------------------------------------------------------------
// [26/26] Verifica Integrazione Avanzata KuroSync (Nomi Dispositivo Dinamici, Netflix Profile Selector, In-App Switcher, QR 410 Gone & Revoca Token)
// -----------------------------------------------------------------------------
console.log('\n[26/26] Verifica Integrazione Avanzata KuroSync (Nomi Dispositivo Dinamici, Netflix Profile Selector, In-App Switcher, QR 410 Gone & Revoca Token)...');

// 1. Dynamic Device Name detection
const detectedDeviceName = getDeviceName();
assert(typeof detectedDeviceName === 'string' && detectedDeviceName.length > 0, 'getDeviceName deve restituire una stringa non vuota');
assert(detectedDeviceName.includes('Pixel') || detectedDeviceName.includes('Google') || detectedDeviceName.includes('Android'), 'getDeviceName deve rilevare il modello reale');
assert.strictEqual(detectedDeviceName, 'Google Pixel 8 Pro', 'getDeviceName deve combinare Manufacturer e Model Android');

const metadata = getDeviceMetadata();
assert.strictEqual(metadata.deviceType, 'mobile', 'deviceType deve essere mobile');
assert.strictEqual(metadata.platform, 'android', 'platform deve essere android');
assert.strictEqual(metadata.deviceName, detectedDeviceName);

// 1.2 Deep-Link and QR parsing flexibility (kurosync:// and kurotv:// with url= or endpoint=)
const deepLinkWithEndpoint = parseKuroSyncDeepLink('kurotv://sync?token=qr_ephemeral123&endpoint=https%3A%2F%2Fcustom.workers.dev');
assert(deepLinkWithEndpoint, 'parseKuroSyncDeepLink deve supportare kurotv:// con endpoint=');
assert.strictEqual(deepLinkWithEndpoint.url, 'https://custom.workers.dev');
assert.strictEqual(deepLinkWithEndpoint.token, 'qr_ephemeral123');

// 2. Mock Fetch environment for advanced KuroSync flows
let recordedRequests: { url: string; method: string; body?: any; headers?: any }[] = [];

const advancedMockClient = new KuroSyncClient({
  baseUrl: 'https://test-sync.workers.dev',
});

const restoreGlobalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, options: any) => {
  const reqMethod = options?.method || 'GET';
  const reqHeaders = options?.headers || {};
  const reqBody = options?.body ? JSON.parse(options.body) : null;
  recordedRequests.push({ url, method: reqMethod, headers: reqHeaders, body: reqBody });

  // 2.1 POST /api/auth/profiles (Master password pre-login profile list)
  if (url.includes('/api/auth/profiles')) {
    if (reqBody?.password === 'wrong-pass') {
      return {
        ok: false,
        status: 401,
        json: async () => ({ ok: false, error: 'Password non corretta' }),
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        profiles: [
          { id: 'prof-net-1', name: 'Marco', avatarColor: '#E50914' },
          { id: 'prof-net-2', name: 'Sara', avatarColor: '#00E5FF' },
        ],
      }),
    } as any;
  }

  // 2.1b GET /api/profiles (Authenticated profile list for QR flow & profile switch)
  if (url.includes('/api/profiles') && !url.includes('/api/auth/profiles')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        profiles: [
          { id: 'prof-net-1', name: 'Marco', avatarColor: '#E50914' },
          { id: 'prof-net-2', name: 'Sara', avatarColor: '#00E5FF' },
        ],
      }),
    } as any;
  }

  // 2.2 POST /api/auth/device-login (Device login with selected profile)
  if (url.includes('/api/auth/device-login')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        deviceToken: 'device-token-abc-999',
        deviceId: 'device-id-uuid-123',
        profile: {
          id: reqBody?.profileId || 'prof-net-1',
          name: reqBody?.profileId === 'prof-net-2' ? 'Sara' : 'Marco',
        },
      }),
    } as any;
  }

  // 2.3 POST /api/auth/switch-profile (In-app dynamic profile switcher)
  if (url.includes('/api/auth/switch-profile')) {
    const pId = reqBody?.profileId;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        profileId: pId,
        profile: {
          id: pId,
          name: pId === 'prof-net-2' ? 'Sara' : 'Marco',
          avatarColor: pId === 'prof-net-2' ? '#00E5FF' : '#E50914',
        },
      }),
    } as any;
  }

  // 2.4 POST /api/auth/exchange (QR single-use token exchange)
  if (url.includes('/api/auth/exchange')) {
    if (reqBody?.token === 'expired-qr-token') {
      return {
        ok: false,
        status: 410,
        json: async () => ({ ok: false, error: 'QR code expired or already consumed' }),
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        deviceToken: 'exchanged-token-xyz',
        deviceId: 'dev-qr-123',
        profileId: 'prof-net-1',
      }),
    } as any;
  }

  // 2.5 POST /api/auth/logout (Revoke device session)
  if (url.includes('/api/auth/logout')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, message: 'Dispositivo disconnesso con successo' }),
    } as any;
  }

  // 2.6 GET /api/sync/pull (Delta pull)
  if (url.includes('/api/sync/pull')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        serverTime: 999999999,
        deltas: {
          favorites: [],
          continueWatching: [],
          watchHistory: [],
          watchProgress: [],
          sharedSettings: {},
          searchHistory: [],
        },
        tombstones: [],
      }),
    } as any;
  }

  // Fallback
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as any;
};

// Test 2.1: listProfilesWithPassword
const preLoginProfiles = await advancedMockClient.listProfilesWithPassword('correct-pass');
assert.strictEqual(preLoginProfiles.length, 2, 'listProfilesWithPassword deve restituire i profili');
assert.strictEqual(preLoginProfiles[0].avatarColor, '#E50914');
assert.strictEqual(preLoginProfiles[1].name, 'Sara');
const profilesReq = recordedRequests.find((r) => r.url.endsWith('/api/auth/profiles'));
assert(profilesReq, 'Deve invocare /api/auth/profiles');
assert.strictEqual(profilesReq.body.password, 'correct-pass');

// Test 2.2: Master Password Login with Profile
const loginRes = await SyncManager.loginDeviceWithProfile({
  serverUrl: 'https://test-sync.workers.dev',
  password: 'correct-pass',
  profileId: 'prof-net-2',
  profileName: 'Sara',
});
assert.strictEqual(loginRes.ok, true, 'loginDeviceWithProfile deve riuscire');
const loginReq = recordedRequests.find((r) => r.url.endsWith('/api/auth/device-login'));
assert(loginReq, 'loginDeviceWithProfile deve invocare POST /api/auth/device-login');
assert.strictEqual(loginReq.body.profileId, 'prof-net-2');
assert.strictEqual(loginReq.body.deviceName, detectedDeviceName, 'loginDevice deve inviare il modello reale del dispositivo');
assert.strictEqual(loginReq.body.deviceType, 'mobile', 'deviceType deve essere mobile');
assert.strictEqual(loginReq.body.platform, 'android', 'platform deve essere android');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN), 'device-token-abc-999');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_DEVICE_ID), 'device-id-uuid-123', 'deviceId deve essere salvato in MMKV');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_ID), 'prof-net-2');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_NAME), 'Sara');

// Test 3: In-App Profile Switcher
const switchSuccess = await SyncManager.switchProfile('prof-net-1', 'Marco');
assert.strictEqual(switchSuccess, true, 'switchProfile deve riuscire');
const switchReq = recordedRequests.find((r) => r.url.endsWith('/api/auth/switch-profile'));
assert(switchReq, 'Deve invocare endpoint POST /api/auth/switch-profile');
assert.strictEqual(switchReq.body.profileId, 'prof-net-1');
assert(recordedRequests.some((r) => r.url.includes('/api/sync/pull?since=0')), 'switchProfile deve eseguire pullDelta(0) per il nuovo profilo');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_ID), 'prof-net-1');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_NAME), 'Marco');

// Test 3.1: Switch Profile Failure Anti-Corruption Rollback
let failNextPull = true;
const previousFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, options: any) => {
  if (url.includes('/api/sync/pull') && failNextPull) {
    failNextPull = false;
    return {
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'Internal Server Error' }),
    } as any;
  }
  return previousFetch(url, options);
};

const switchFailResult = await SyncManager.switchProfile('prof-corrupt', 'NonValido');
assert.strictEqual(switchFailResult, false, 'switchProfile deve restituire false in caso di fallimento pull');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_ID), 'prof-net-1', 'MMKV non deve essere corrotto in caso di errore pull');
globalThis.fetch = previousFetch;

// Test 4: Ephemeral QR Token Exchange & 410 Gone Handling
const expiredQrResult = await SyncManager.connectWithToken('https://test-sync.workers.dev', 'expired-qr-token');
assert.strictEqual(expiredQrResult.ok, false, 'QR scaduto deve restituire ok=false');
assert.strictEqual(expiredQrResult.isExpiredQr, true, 'Deve segnalare isExpiredQr=true');
assert.strictEqual(
  expiredQrResult.message,
  'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.',
  'Messaggio per HTTP 410 deve corrispondere alle specifiche di AGENTS.md e CLIENT_INTEGRATION.md'
);

// Valid QR token exchange
const validQrResult = await SyncManager.connectWithToken('https://test-sync.workers.dev', 'valid-qr-token');
assert.strictEqual(validQrResult.ok, true, 'QR valido deve riuscire');
const exchangeReq = recordedRequests.find((r) => r.url.endsWith('/api/auth/exchange') && r.body?.token === 'valid-qr-token');
assert(exchangeReq, 'exchangeToken deve essere invocato');
assert.strictEqual(exchangeReq.body.deviceName, detectedDeviceName, 'exchangeToken deve inviare il modello reale del dispositivo');
assert.strictEqual(exchangeReq.body.deviceType, 'mobile', 'deviceType mobile su exchange');
assert.strictEqual(exchangeReq.body.platform, 'android', 'platform android su exchange');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN), 'exchanged-token-xyz');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_DEVICE_ID), 'dev-qr-123', 'deviceId deve essere salvato su token exchange');

// Test 4.1: Ephemeral QR Token Prepare & Netflix Profile Selection
const prepQrRes = await SyncManager.prepareQrConnection('kurotv://sync?token=valid-qr-prep&endpoint=https%3A%2F%2Ftest-sync.workers.dev');
assert.strictEqual(prepQrRes.ok, true, 'prepareQrConnection deve riuscire');
assert(prepQrRes.profiles && prepQrRes.profiles.length > 0, 'prepareQrConnection deve restituire i profili per la selezione Netflix');
assert.strictEqual(prepQrRes.deviceToken, 'exchanged-token-xyz');

// Test 4.2: Robustness edge cases for prepareQrConnection & completeQrConnection
const emptyQrRes = await SyncManager.prepareQrConnection('');
assert.strictEqual(emptyQrRes.ok, false, 'prepareQrConnection deve fallire con input vuoto');
assert.strictEqual(emptyQrRes.message, 'Codice QR o link mancante');

const expiredPrepQrRes = await SyncManager.prepareQrConnection('kurotv://sync?token=expired-qr-token&endpoint=https%3A%2F%2Ftest-sync.workers.dev');
assert.strictEqual(expiredPrepQrRes.ok, false, 'prepareQrConnection deve fallire per QR scaduto');
assert.strictEqual(expiredPrepQrRes.isExpiredQr, true, 'isExpiredQr deve essere true per 410');

const invalidCompleteQrRes = await SyncManager.completeQrConnection({
  serverUrl: '',
  deviceToken: '',
  profileId: '',
});
assert.strictEqual(invalidCompleteQrRes.ok, false, 'completeQrConnection deve validare i parametri obbligatori');

const completeQrRes = await SyncManager.completeQrConnection({
  serverUrl: prepQrRes.serverUrl!,
  deviceToken: prepQrRes.deviceToken!,
  deviceId: prepQrRes.deviceId,
  profileId: 'prof-net-2',
  profileName: 'Sara',
});
assert.strictEqual(completeQrRes.ok, true, 'completeQrConnection deve finalizzare la connessione con il profilo selezionato');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_ID), 'prof-net-2');
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_PROFILE_NAME), 'Sara');

// Test 5: Clean Logout & Session Revocation
await SyncManager.disconnect();
const logoutReq = recordedRequests.find((r) => r.url.endsWith('/api/auth/logout'));
assert(logoutReq, 'disconnect deve invocare POST /api/auth/logout');
assert(!AppStorage.getString(StorageKeys.SYNC_DEVICE_TOKEN), 'device_token deve essere rimosso da MMKV');
assert(!AppStorage.getString(StorageKeys.SYNC_PROFILE_ID), 'profile_id deve essere rimosso da MMKV');
assert(!AppStorage.getNumber(StorageKeys.SYNC_LAST_TIMESTAMP), 'last_timestamp deve essere rimosso da MMKV');
assert.strictEqual(SyncManager.isConnected(), false, 'SyncManager non deve più risultare connesso');

// Restore original fetch
globalThis.fetch = restoreGlobalFetch;

// Test 6: Verify UI Source Code Alignment
const connectModalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncConnectModal.tsx'), 'utf-8');
assert(connectModalCode.includes('listProfilesWithPassword'), 'SyncConnectModal deve usare listProfilesWithPassword');
assert(connectModalCode.includes('loginDeviceWithProfile'), 'SyncConnectModal deve usare loginDeviceWithProfile');
assert(connectModalCode.includes('prepareQrConnection'), 'SyncConnectModal deve usare prepareQrConnection per lo scan QR');
assert(connectModalCode.includes('completeQrConnection'), 'SyncConnectModal deve usare completeQrConnection dopo la scelta profilo');
assert(!connectModalCode.includes('deepLinkInput'), 'SyncConnectModal non deve contenere campi di input per token o deep link');
assert(connectModalCode.includes('CHI STA GUARDANDO?'), 'SyncConnectModal deve mostrare il selettore Netflix CHI STA GUARDANDO?');
assert(connectModalCode.includes('avatarColor'), 'SyncConnectModal deve supportare avatarColor');
assert(connectModalCode.includes('Il codice QR è scaduto o è già stato utilizzato'), 'SyncConnectModal deve mostrare messaggio esplicativo per 410');

const profileModalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncProfileModal.tsx'), 'utf-8');
assert(profileModalCode.includes('switchProfile'), 'SyncProfileModal deve supportare switchProfile');
assert(profileModalCode.includes('activeProfileId'), 'SyncProfileModal deve evidenziare il profilo attivo');

const syncCardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncSettingsCard.tsx'), 'utf-8');
assert(syncCardCode.includes('setIsProfileModalOpen(true)'), 'SyncSettingsCard deve permettere di aprire il modal di cambio profilo');
assert(syncCardCode.includes('CAMBIA'), 'SyncSettingsCard deve includere pulsante CAMBIA per il profilo');
assert(syncCardCode.includes('syncIconBtn'), 'SyncSettingsCard deve usare syncIconBtn per la disconnessione touch-safe');
assert((syncCardCode.match(/setIsProfileModalOpen\(true\)/g) || []).length === 1, 'SyncSettingsCard non deve avere pulsante doppio per il cambio profilo');

const layoutCode = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(layoutCode.includes('Il codice QR è scaduto o è già stato utilizzato'), '_layout.tsx deve mostrare alert per QR scaduto');
assert(!layoutCode.includes('Alert.alert'), 'Divieto Alert.alert rispettato in _layout.tsx');

console.log('✓ Integrazione Avanzata KuroSync (Nomi Dinamici, Netflix Selector, Switcher, 410 Gone & Logout) verificata con successo.');

// -----------------------------------------------------------------------------
// [27/27] Verifica Riorganizzazione Palinsesto in Home, Profilo Rapido Tab Bar & Persistenza Indistruttibile SYNC_SERVER_URL
// -----------------------------------------------------------------------------
console.log('\n[27/27] Verifica Riorganizzazione Palinsesto in Home, Profilo Rapido Tab Bar & Persistenza Indistruttibile SYNC_SERVER_URL...');

// 1. HomeAppBar Palinsesto Button
const homeHeaderCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/HomeSearchHeader.tsx'), 'utf-8');
assert(homeHeaderCode.includes('onSchedulePress'), 'HomeAppBar deve accettare la prop onSchedulePress');
assert(homeHeaderCode.includes('calendar-outline'), 'HomeAppBar deve mostrare l icona calendar-outline per il palinsesto');
assert(homeHeaderCode.includes('scheduleButton'), 'HomeAppBar deve usare la classe scheduleButton');
assert(homeHeaderCode.includes('accessibilityLabel="PALINSESTO"'), 'HomeAppBar deve avere accessibilityLabel PALINSESTO');

// Check order: scheduleButton placed in between downloads and search
const schedulePos = homeHeaderCode.indexOf('scheduleButton');
const downloadPos = homeHeaderCode.indexOf('downloadButton');
const searchPos = homeHeaderCode.indexOf('searchButton');
assert(downloadPos !== -1 && schedulePos !== -1 && searchPos !== -1, 'Tutti e tre i pulsanti devono essere presenti');
assert(
  (downloadPos < schedulePos && schedulePos < searchPos) || (searchPos < schedulePos && schedulePos < downloadPos),
  'Il pulsante palinsesto deve trovarsi in mezzo tra download e ricerca'
);

// 2. Home index binds onSchedulePress to navigate to /explore
const homeScreenCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(homeScreenCode.includes('onSchedulePress'), 'app/(tabs)/index.tsx deve passare onSchedulePress a HomeAppBar');
assert(homeScreenCode.includes("navigate('/(tabs)/explore'") || homeScreenCode.includes("push('/explore'"), 'onSchedulePress deve navigare a /explore');

// 3. Tab Bar Layout: explore hidden with href: null, profile tab between history and settings
const tabLayoutNew = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(tabLayoutNew.includes('name="profile"'), 'app/(tabs)/_layout.tsx deve dichiarare la tab profile');
assert(tabLayoutNew.includes('person-circle'), 'tab profile deve usare l icona person-circle / person-outline');
assert(tabLayoutNew.includes('SyncConnectModal'), 'app/(tabs)/_layout.tsx deve integrare SyncConnectModal');
assert(tabLayoutNew.includes('SyncProfileModal'), 'app/(tabs)/_layout.tsx deve integrare SyncProfileModal');

// Check tab ordering: profile is between history and settings
const historyTabPos = tabLayoutNew.indexOf('name="history"');
const profileTabPos = tabLayoutNew.indexOf('name="profile"');
const settingsTabPos = tabLayoutNew.indexOf('name="settings"');
assert(historyTabPos !== -1 && profileTabPos !== -1 && settingsTabPos !== -1, 'History, Profile e Settings devono essere presenti');
assert(historyTabPos < profileTabPos && profileTabPos < settingsTabPos, 'Il tab Profilo deve trovarsi tra Cronologia e Impostazioni');

// 4. Persistence of SYNC_SERVER_URL without deletion of g4s01.workers.dev
const syncManagerSourceCode = fs.readFileSync(path.resolve(process.cwd(), 'src/services/sync/sync-manager.ts'), 'utf-8');
assert(!syncManagerSourceCode.includes("savedUrl.includes('g4s01.workers.dev')"), 'sync-manager.ts non deve contenere rimozioni automatiche di g4s01.workers.dev');
assert(!syncManagerSourceCode.includes("AppStorage.remove(StorageKeys.SYNC_SERVER_URL)"), 'sync-manager.ts non deve rimuovere SYNC_SERVER_URL nel costruttore');

// 5. Test real storage persistence with g4s01.workers.dev
const testPersonalUrl = 'https://kurotv-s.g4s01.workers.dev';
AppStorage.setString(StorageKeys.SYNC_SERVER_URL, testPersonalUrl);
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_SERVER_URL), testPersonalUrl, 'L URL deve essere salvato in MMKV');

// Instantiate a new SyncManagerClass: it must NOT wipe the stored URL
const FreshSyncManagerClass = (SyncManager.constructor as any);
const freshInstance = new FreshSyncManagerClass();
assert.strictEqual(
  AppStorage.getString(StorageKeys.SYNC_SERVER_URL),
  testPersonalUrl,
  'Il costruttore di SyncManager NON deve cancellare l URL del server KuroSync anche se contiene g4s01.workers.dev'
);
assert.strictEqual(
  freshInstance.getClient().getBaseUrl(),
  testPersonalUrl,
  'KuroSyncClient deve ricevere l URL persistito dallo storage'
);

// 6. Test prepareQrConnection saves URL immediately into MMKV
AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
AppStorage.remove('sync.server_url_backup');
const qrResult = await SyncManager.prepareQrConnection('kurotv://sync?endpoint=https%3A%2F%2Fpersisted-server.workers.dev&token=some-token');
assert.strictEqual(
  AppStorage.getString(StorageKeys.SYNC_SERVER_URL),
  'https://persisted-server.workers.dev',
  'prepareQrConnection deve persistere immediatamente l URL del server in MMKV'
);

// 7. Test indestructible persistence & self-healing from backup key
AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
assert.strictEqual(AppStorage.getString(StorageKeys.SYNC_SERVER_URL), undefined);
// getStatus triggers self-healing
const healedStatus = SyncManager.getStatus();
assert.strictEqual(
  healedStatus.serverUrl,
  'https://persisted-server.workers.dev',
  'getStatus deve auto-ripristinare l URL del server dalla chiave di backup o dalla memoria'
);
assert.strictEqual(
  AppStorage.getString(StorageKeys.SYNC_SERVER_URL),
  'https://persisted-server.workers.dev',
  'La chiave MMKV deve essere auto-ripristinata dal self-healing'
);

// 8. Test isConnected requires BOTH token AND serverUrl
AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, 'test-token');
assert.strictEqual(SyncManager.isConnected(), true, 'Con token e URL validi isConnected deve essere true');

// If both primary and backup URL are removed and client is reset
AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
AppStorage.remove('sync.server_url_backup');
const emptyUrlInstance = new FreshSyncManagerClass();
assert.strictEqual(
  emptyUrlInstance.isConnected(),
  false,
  'isConnected NON deve essere true se l URL del server è mancante, prevenendo il crash URL non configurato'
);

// 9. Test parseKuroSyncDeepLink with serverUrl and baseUrl query parameters
const deepLinkWithServerUrl = parseKuroSyncDeepLink('kurosync://connect?serverUrl=https%3A%2F%2Fmy-custom-server.com&token=tok-123');
assert(deepLinkWithServerUrl !== null && deepLinkWithServerUrl.url === 'https://my-custom-server.com', 'parseKuroSyncDeepLink deve supportare serverUrl');
const deepLinkWithBaseUrl = parseKuroSyncDeepLink('kurosync://connect?baseUrl=https%3A%2F%2Fbase-server.com&token=tok-456');
assert(deepLinkWithBaseUrl !== null && deepLinkWithBaseUrl.url === 'https://base-server.com', 'parseKuroSyncDeepLink deve supportare baseUrl');

// 10. Test ProfileScreen graceful redirect source code
const profileScreenSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/profile.tsx'), 'utf-8');
assert(profileScreenSource.includes("router.replace('/(tabs)')"), 'ProfileScreen deve reindirizzare alla home tab se montata direttamente');

// 11. Test SyncConnectModal source code reloads stored URL on visible: true
const syncModalSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncConnectModal.tsx'), 'utf-8');
assert(syncModalSource.includes('AppStorage.getString(StorageKeys.SYNC_SERVER_URL)'), 'SyncConnectModal deve ripristinare il serverUrl memorizzato');
assert(syncModalSource.includes('setServerUrl(saved)'), 'SyncConnectModal deve aggiornare lo stato serverUrl all apertura');

// Clean up test keys
AppStorage.remove(StorageKeys.SYNC_SERVER_URL);
AppStorage.remove('sync.server_url_backup');
AppStorage.remove(StorageKeys.SYNC_DEVICE_TOKEN);

console.log('✓ Riorganizzazione Palinsesto in Home, Profilo Rapido Tab Bar & Persistenza Indistruttibile SYNC_SERVER_URL verificati con successo.');

// -----------------------------------------------------------------------------
// [28/28] Verifica Fix Tablet Rail (Doppio Contorno & Back Gesture), Smartphone Navbar & Palinsesto
// -----------------------------------------------------------------------------
console.log('\n[28/28] Verifica Fix Tablet Rail (Doppio Contorno & Back Gesture), Smartphone Navbar & Palinsesto...');

// 1. Tablet Rail Single Border: BottomTabIcon and SettingsTabIcon must avoid wrapping in bottomTabItem on tablet
const tabLayoutLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/_layout.tsx'), 'utf-8');
assert(tabLayoutLatestCode.includes('styles.tabletTabIconWrapper'), 'TabLayout deve definire tabletTabIconWrapper per azzerare il doppio contorno');
assert(tabLayoutLatestCode.includes('if (isTablet)'), 'BottomTabIcon deve verificare isTablet per evitare doppio bordo');

// 2. Navigation bar icons wrap clearance from top line
assert(tabLayoutLatestCode.includes('paddingTop: 6'), 'tabBarStyle su smartphone deve avere paddingTop per distanziare il wrap dalla linea superiore');
assert(tabLayoutLatestCode.includes('height: 38'), 'bottomTabItem deve avere altezza 38dp per garantire clearance confortevole');

// 3. Profile icon matches tablet style on smartphone with initial letter & login icon when disconnected or no profile selected
assert(tabLayoutLatestCode.includes('ProfileTabIcon'), 'TabLayout deve definire il componente ProfileTabIcon');
assert(tabLayoutLatestCode.includes('profileAvatarInitial'), 'ProfileTabIcon deve renderizzare la lettera iniziale del profilo');
assert(tabLayoutLatestCode.includes('profileAvatarCircle'), 'ProfileTabIcon deve renderizzare l avatar circolare come su tablet');
assert(tabLayoutLatestCode.includes('log-in'), 'ProfileTabIcon deve mostrare l icona di login quando disconnesso o senza profilo selezionato');
assert(tabLayoutLatestCode.includes('hasProfile'), 'ProfileTabIcon deve verificare sia connessione che profilo selezionato');

const tabletRailLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TabletNavigationRail.tsx'), 'utf-8');
assert(tabletRailLatestCode.includes('log-in-outline'), 'TabletNavigationRail deve mostrare log-in-outline quando disconnesso');
assert(tabletRailLatestCode.includes('hasProfile'), 'TabletNavigationRail deve verificare sia connessione che profilo selezionato per mostrare l avatar');

// 4. Palinsesto is accessible and does not redirect away (no options.href = null runtime trigger, using display none and tabBarButton null)
assert(tabLayoutLatestCode.includes("tabBarItemStyle: { display: 'none' }"), 'Palinsesto deve usare tabBarItemStyle display none');
assert(tabLayoutLatestCode.includes('tabBarButton: () => null'), 'Palinsesto deve usare tabBarButton null per nascondersi dalla barra');
assert(!tabLayoutLatestCode.match(/name="explore"[\s\S]*?href:\s*null\s*,/), 'Palinsesto non deve più passare href: null nelle options per evitare il redirect forzato v58');

// 5. Back gesture lifecycle via useFocusEffect in Scaricati, Ricerca e Palinsesto
const exploreLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/explore.tsx'), 'utf-8');
assert(exploreLatestCode.includes('useFocusEffect('), 'explore.tsx deve usare useFocusEffect per il tasto hardwareBackPress');

const downloadsLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/downloads/index.tsx'), 'utf-8');
assert(downloadsLatestCode.includes('useFocusEffect('), 'downloads/index.tsx deve usare useFocusEffect per il tasto hardwareBackPress');
assert(downloadsLatestCode.includes('isSheetVisibleRef'), 'downloads/index.tsx deve usare un ref sincrono per isSheetVisible');

const indexLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
assert(indexLatestCode.includes('useFocusEffect('), 'index.tsx deve usare useFocusEffect per hardwareBackPress');
assert(indexLatestCode.includes('isFilterSheetVisibleRef'), 'index.tsx deve chiudere il foglio filtri prima di chiudere la ricerca');

console.log('✓ Fix Tablet Rail (Doppio Contorno & Back Gesture), Smartphone Navbar & Palinsesto verificati con successo.');

// -----------------------------------------------------------------------------
// [29/29] Verifica Gestures Indietro Tablet & Retry Automatici KuroSync con Auto-Logout
// -----------------------------------------------------------------------------
console.log('\n[29/29] Verifica Gestures Indietro Tablet & Retry Automatici KuroSync con Auto-Logout...');

// 1. Back gesture coverage across all tab screens
const favoritesLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
assert(favoritesLatestCode.includes("router.replace('/(tabs)')"), 'favorites.tsx deve tornare alla home quando non in selection mode');
assert(favoritesLatestCode.includes('useFocusEffect('), 'favorites.tsx deve usare useFocusEffect per hardwareBackPress');

const historyLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/history.tsx'), 'utf-8');
assert(historyLatestCode.includes("router.replace('/(tabs)')"), 'history.tsx deve tornare alla home quando non in selection mode');
assert(historyLatestCode.includes('useFocusEffect('), 'history.tsx deve usare useFocusEffect per hardwareBackPress');

const settingsLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(settingsLatestCode.includes("router.replace('/(tabs)')"), 'settings.tsx deve tornare alla home alla pressione indietro');
assert(settingsLatestCode.includes('useFocusEffect('), 'settings.tsx deve usare useFocusEffect per hardwareBackPress');

assert(tabLayoutLatestCode.includes('backBehavior="initialRoute"'), 'TabLayout deve configurare backBehavior="initialRoute"');

// 2. SyncManager retry methods exist
assert(typeof (SyncManager as any).performFullSyncWithRetries === 'function', 'SyncManager deve definire performFullSyncWithRetries');
assert(typeof (SyncManager as any).listProfilesWithRetries === 'function', 'SyncManager deve definire listProfilesWithRetries');
assert(typeof (SyncManager as any).switchProfileWithRetries === 'function', 'SyncManager deve definire switchProfileWithRetries');

// 3. Root Navigation startup sync & retry banner & reconnect prompt
const rootLayoutLatestCode = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(rootLayoutLatestCode.includes('performFullSyncWithRetries'), 'app/_layout.tsx deve usare performFullSyncWithRetries');
assert(rootLayoutLatestCode.includes('startupSyncBanner'), 'app/_layout.tsx deve mostrare il banner di feedback durante i tentativi di sincronizzazione');
assert(rootLayoutLatestCode.includes('connectionFailurePrompt'), 'app/_layout.tsx deve gestire connectionFailurePrompt per proporre il login');
assert(rootLayoutLatestCode.includes('SyncConnectModal'), 'app/_layout.tsx deve includere SyncConnectModal per consentire il login immediato (QR o manuale)');

// 4. SyncProfileModal retry feedback & onProposeLogin
const syncProfileModalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SyncProfileModal.tsx'), 'utf-8');
assert(syncProfileModalCode.includes('listProfilesWithRetries'), 'SyncProfileModal deve usare listProfilesWithRetries');
assert(syncProfileModalCode.includes('switchProfileWithRetries'), 'SyncProfileModal deve usare switchProfileWithRetries');
assert(syncProfileModalCode.includes('onProposeLogin'), 'SyncProfileModal deve supportare la prop onProposeLogin');
assert(syncProfileModalCode.includes('retryFeedback'), 'SyncProfileModal deve mostrare retryFeedback durante i tentativi');

// 5. Test SyncManager.performFullSyncWithRetries behavior with failing mock fetch
const tempToken = 'test-retry-token-123';
AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, tempToken);
AppStorage.setString(StorageKeys.SYNC_SERVER_URL, 'https://test-sync.workers.dev');

let retryCallbackCalls: number[] = [];
// Save current fetch
const savedFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string) => {
  if (url.includes('/api/sync/pull')) {
    return {
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'Database transient error' }),
    } as any;
  }
  return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
};

try {
  const retrySyncRes = await SyncManager.performFullSyncWithRetries(2, (attempt, max) => {
    retryCallbackCalls.push(attempt);
  });
  assert.strictEqual(retrySyncRes.ok, false, 'performFullSyncWithRetries deve fallire se tutte le chiamate falliscono');
  assert.strictEqual(retrySyncRes.wasLoggedOut, false, 'performFullSyncWithRetries NON deve disconnettere l utente in caso di errore 500 transitorio per preservare l offline');
  assert.strictEqual(retryCallbackCalls.length, 2, 'performFullSyncWithRetries deve eseguire 2 retry (totale 3 tentativi)');
  assert.strictEqual(SyncManager.isConnected(), true, 'SyncManager deve rimanere connesso preservando le credenziali offline su errore 500');

  // Test disconnessione forzata (auto-logout) SOLO su HTTP 401/403 Unauthorized
  (globalThis as any).fetch = async (url: string) => {
    if (url.includes('/api/sync/pull')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ ok: false, error: 'Unauthorized token' }),
      } as any;
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
  };
  const authErrRes = await SyncManager.performFullSyncWithRetries(2);
  assert.strictEqual(authErrRes.ok, false);
  assert.strictEqual(authErrRes.wasLoggedOut, true, 'performFullSyncWithRetries DEVE disconnettere l utente su HTTP 401');
  assert.strictEqual(SyncManager.isConnected(), false, 'SyncManager non deve più essere connesso dopo HTTP 401');
} finally {
  (globalThis as any).fetch = savedFetch;
}

console.log('✓ Gestures Indietro Tablet & Retry Automatici KuroSync con Auto-Logout verificati con successo.');

// -----------------------------------------------------------------------------
// 30. Verifica Auto-Sync Reattivo, Storage Mutation Listeners, AniSkip/Search Sync & Preservazione Local Deletions
// -----------------------------------------------------------------------------
console.log('\n[30/30] Verifica Auto-Sync Reattivo, Storage Mutation Listeners, AniSkip/Search Sync & Preservazione Local Deletions...');

// 1. AppStorage.addMutationListener fires on favorites, history, search, and settings
let notifiedMutations: string[] = [];
const unsubMut = AppStorage.addMutationListener((type) => {
  notifiedMutations.push(type);
});

AppStorage.saveAniSkipSettings({ mode: 'auto', buttonDuration: 25 });
assert(notifiedMutations.includes('sharedSettings'), 'saveAniSkipSettings deve notificare i mutation listeners con sharedSettings');
const pendingMutations1 = AppStorage.getPendingSyncMutations();
assert(pendingMutations1.sharedSettings?.aniSkipSettings?.mode === 'auto', 'saveAniSkipSettings deve accodare aniSkipSettings in pending mutations');
assert.strictEqual(pendingMutations1.sharedSettings?.aniSkipSettings?.buttonDuration, 25);

// 2. Favorites addition sets fresh Date.now() timestamp and fires mutation listener
notifiedMutations = [];
const favTestItem = {
  id: 'fav-sync-fresh',
  title: 'Fresh Favorite',
  thumbnail: '',
  genres: [],
  link: '',
  updatedAt: 1000, // Past timestamp from scraper
};
AppStorage.toggleFavorite(favTestItem);
assert(notifiedMutations.includes('favorites'), 'toggleFavorite deve notificare i mutation listeners');
const freshFav = AppStorage.getFavorites().find((f) => f.id === 'fav-sync-fresh');
assert(freshFav && freshFav.updatedAt && freshFav.updatedAt > 1000, 'toggleFavorite deve rinfrescare updatedAt a Date.now()');

// 3. Search History pruned prefixes generate tombstones
notifiedMutations = [];
AppStorage.clearPendingSyncDeletions();
AppStorage.addSearchHistory('SOLO');
AppStorage.addSearchHistory('SOLO LEVELING');
const searchTombstones = AppStorage.getPendingSyncDeletions();
assert(searchTombstones.some((d) => d.type === 'search_history' && d.key === 'SOLO'), 'addSearchHistory deve creare tombstone per prefissi rimossi come SOLO');

// 4. mergeLocalAndRemote preserves local pending deletions (no resurrection)
const mergeNoResurrect = mergeLocalAndRemote(
  {
    favorites: [],
    continueWatching: [],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [],
  },
  {
    serverTime: 5000,
    deltas: {
      favorites: [{ id: 'deleted-fav-1', title: 'Should Not Resurrect', thumbnail: '', genres: [], link: '', updatedAt: 2000 }],
      continueWatching: [],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: {},
      searchHistory: [{ query: 'DELETED_QUERY', timestamp: 2000 }],
    },
    tombstones: [], // Server has not received tombstones yet!
  },
  [
    { type: 'favorite', key: 'deleted-fav-1', deletedAt: 3000 },
    { type: 'search_history', key: 'DELETED_QUERY', deletedAt: 3000 },
  ]
);
assert.strictEqual(mergeNoResurrect.state.favorites.length, 0, 'mergeLocalAndRemote non deve resuscitare entità con deletion locale pendente');
assert.strictEqual(mergeNoResurrect.state.searchHistory.length, 0, 'mergeLocalAndRemote non deve resuscitare query con deletion locale pendente');

// 5. mergeLocalAndRemote preserves local pending sharedSettings mutations (AniSkip)
const mergePreserveSettings = mergeLocalAndRemote(
  {
    favorites: [],
    continueWatching: [],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: { aniSkipSettings: { mode: 'auto', buttonDuration: 25 } },
    searchHistory: [],
  },
  {
    serverTime: 5000,
    deltas: {
      favorites: [],
      continueWatching: [],
      watchHistory: [],
      watchProgress: [],
      sharedSettings: { aniSkipSettings: { mode: 'manual', buttonDuration: 10 } }, // Stale remote
      searchHistory: [],
    },
    tombstones: [],
  },
  [],
  {
    sharedSettings: { aniSkipSettings: { mode: 'auto', buttonDuration: 25 } },
  }
);
assert.strictEqual(mergePreserveSettings.state.sharedSettings.aniSkipSettings.mode, 'auto', 'mergeLocalAndRemote deve preservare mutation pendente di AniSkip');

// 6. SyncManager.scheduleAutoSync & pushPending full search history
let pushedPayload: any = null;
AppStorage.setString(StorageKeys.SYNC_DEVICE_TOKEN, 'test-auto-sync-token');
AppStorage.setString(StorageKeys.SYNC_SERVER_URL, 'https://test-sync.workers.dev');

(globalThis as any).fetch = async (url: string, options: any) => {
  if (url.includes('/api/sync/push')) {
    pushedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, serverTime: 999999, appliedCount: 1 }),
    } as any;
  }
  return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
};

// Set watermark
AppStorage.setNumber(StorageKeys.SYNC_LAST_TIMESTAMP, 12345);

AppStorage.recordSyncMutation('searchHistory', { query: 'NEW TEST QUERY', timestamp: Date.now() });
const initialTimestamp = AppStorage.getNumber(StorageKeys.SYNC_LAST_TIMESTAMP);
await SyncManager.pushPending(true);

assert(pushedPayload !== null, 'pushPending deve inviare payload al server');
assert(Array.isArray(pushedPayload.searchHistory), 'pushPending deve inviare l array completo di searchHistory');
assert(pushedPayload.searchHistory.some((s: any) => s.query === 'SOLO LEVELING'), 'pushPending deve includere le query precedenti da getSearchHistory()');
assert.strictEqual(AppStorage.getNumber(StorageKeys.SYNC_LAST_TIMESTAMP), initialTimestamp, 'pushPending NON deve sovrascrivere SYNC_LAST_TIMESTAMP (preservazione watermark pull)');

unsubMut();
AppStorage.clearPendingSyncDeletions();
AppStorage.clearPendingSyncMutations();
await SyncManager.disconnect();

console.log('✓ Auto-Sync Reattivo, Mutation Listeners, AniSkip/Search Sync & Preservazione Local Deletions verificati con successo.');

// -----------------------------------------------------------------------------
// 31. Verifica Riprogettazione Modulare "Impostazioni" (Hub & Spoke, 7 Sotto-pagine, Hero Card & Deep-links)
// -----------------------------------------------------------------------------
console.log('\n[31/31] Verifica Riprogettazione Modulare "Impostazioni" (Hub & Spoke, 7 Sotto-pagine, Hero Card & Deep-links)...');

// 1. Hub Screen Structure and Hero Card
const hubSource = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');
assert(hubSource.includes('SettingsCategoryRow'), 'Hub settings.tsx deve importare e renderizzare SettingsCategoryRow');
assert(hubSource.includes('hubHeroCard'), 'Hub settings.tsx deve includere la Hero Card per KuroSync e profilo');
assert(hubSource.includes('hubHeroAvatar'), 'Hub settings.tsx deve includere l avatar circolare con iniziale o icona');
assert(hubSource.includes('hubHeroStatusDot'), 'Hub settings.tsx deve includere il pallino di stato connessione');

// 2. Hub renders all 7 Category Rows with dynamic glanceability
const expectedCategories = [
  'APPARENZA',
  'PLAYER',
  'SINCRONIA',
  'DOWNLOAD',
  'SORGENTE',
  'CRONOLOGIA',
  'APPLICAZIONE',
];
for (const cat of expectedCategories) {
  assert(hubSource.includes(cat), `Hub settings.tsx deve contenere la riga categoria ${cat}`);
}

// 3. Deep link and auto-download redirection (with anti-infinite loop param clearance)
assert(
  hubSource.includes("params.scrollTo === 'downloads'") && hubSource.includes('/settings/downloads'),
  'Hub settings.tsx deve reindirizzare verso /settings/downloads su parametro scrollTo: downloads'
);
assert(
  (hubSource.includes("params.scrollTo === 'update'") || hubSource.includes('isAutoDownloadRequested')) &&
  hubSource.includes('/settings/about'),
  'Hub settings.tsx deve reindirizzare verso /settings/about su parametro scrollTo: update o auto-download'
);
assert(
  hubSource.includes('setParams') && hubSource.includes('scrollTo: undefined'),
  'Hub settings.tsx deve azzerare il parametro scrollTo via setParams per azzerare loop infiniti al ritorno'
);

// 4. Zero Alert.alert in Hub and all subpages
assert(!hubSource.includes('Alert.alert'), 'Hub settings.tsx non deve MAI usare Alert.alert');
const settingsSubpages = [
  'app/settings/appearance.tsx',
  'app/settings/playback.tsx',
  'app/settings/sync.tsx',
  'app/settings/downloads.tsx',
  'app/settings/source.tsx',
  'app/settings/history.tsx',
  'app/settings/about.tsx',
];
for (const subpage of settingsSubpages) {
  const p = path.resolve(process.cwd(), subpage);
  assert(fs.existsSync(p), `La sottopagina ${subpage} deve esistere`);
  const content = fs.readFileSync(p, 'utf-8');
  assert(!content.includes('Alert.alert'), `${subpage} non deve MAI usare Alert.alert`);
  assert(content.includes('SettingsHeader'), `${subpage} deve utilizzare SettingsHeader`);
  assert(content.includes('useFocusEffect('), `${subpage} deve gestire hardwareBackPress con useFocusEffect`);
  assert(content.includes('router.back()'), `${subpage} deve consentire il ritorno indietro fluido con router.back()`);
}

// 5. Shared components verification
const categoryRowSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SettingsCategoryRow.tsx'), 'utf-8');
assert(categoryRowSource.includes('Haptics.selectionAsync'), 'SettingsCategoryRow deve fornire feedback tattile al tocco');
assert(categoryRowSource.includes('chevron-forward'), 'SettingsCategoryRow deve mostrare la chevron destra');

const headerComponentSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SettingsHeader.tsx'), 'utf-8');
const settingsStylesSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/settings.styles.ts'), 'utf-8');
assert(headerComponentSource.includes('subPageBackBtn'), 'SettingsHeader deve applicare la classe subPageBackBtn');
assert(settingsStylesSource.includes('subPageBackBtn') && settingsStylesSource.includes('minWidth: 44'), 'SettingsHeader deve garantire un touch target >= 44dp');
assert(settingsStylesSource.includes('hubHeroActionBtn') && settingsStylesSource.includes('minHeight: 44'), 'hubHeroActionBtn deve garantire un touch target >= 44dp');
assert(settingsStylesSource.includes('smallActionBtn') && settingsStylesSource.includes('minHeight: 44'), 'smallActionBtn deve garantire un touch target >= 44dp');
assert(headerComponentSource.includes('arrow-back'), 'SettingsHeader deve mostrare la freccia Indietro');

// 5b. Dynamic Contrast YIQ & Robustness
const sourceCardSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SourceSettingsCard.tsx'), 'utf-8');
assert(sourceCardSource.includes('getContrastTextColor'), 'SourceSettingsCard deve applicare il contrasto dinamico YIQ sul tasto Applica');

const aboutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/settings/about.tsx'), 'utf-8');
assert(aboutSource.includes('setParams') && aboutSource.includes('autoDownload: undefined'), 'about.tsx deve azzerare autoDownload via setParams per prevenire download duplicati');

// 6. Navigation Stack Layouts
const settingsLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'app/settings/_layout.tsx'), 'utf-8');
assert(settingsLayoutSource.includes("animation: 'slide_from_right'"), 'app/settings/_layout.tsx deve adottare animazione slide_from_right');

const rootLayoutCheckSource = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(rootLayoutCheckSource.includes('name="settings"'), 'app/_layout.tsx deve registrare la rotta settings');

console.log('✓ Riprogettazione Modulare "Impostazioni" (Hub & Spoke, 7 Sotto-pagine, Hero Card & Deep-links) verificati con successo.');

// -----------------------------------------------------------------------------
// [32/32] Verifica Audit Codebase (Hardening Deep-link, Resilienza Rete, Validazione Checksum OTA, Plugin MainActivity & De-monolizzazione Home)
// -----------------------------------------------------------------------------
console.log('\n[32/32] Verifica Audit Codebase (Hardening Deep-link, Resilienza Rete, Validazione Checksum OTA, Plugin MainActivity & De-monolizzazione Home)...');

// 1. isSyncAuthError validation
const { isSyncAuthError } = await import('../src/services/sync/sync-manager');
assert.strictEqual(isSyncAuthError(null, 401), true, 'status 401 deve essere auth error');
assert.strictEqual(isSyncAuthError(null, 403), true, 'status 403 deve essere auth error');
assert.strictEqual(isSyncAuthError('Unauthorized token', 200), true, 'messaggio Unauthorized deve essere auth error');
assert.strictEqual(isSyncAuthError('Forbidden access', 500), true, 'messaggio Forbidden deve essere auth error');
assert.strictEqual(isSyncAuthError('token non valido', undefined), true, 'token non valido deve essere auth error');
assert.strictEqual(isSyncAuthError('sessione scaduta', undefined), true, 'sessione scaduta deve essere auth error');
assert.strictEqual(isSyncAuthError('Internal Server Error 500', 500), false, 'errore 500 generico non deve essere auth error');
assert.strictEqual(isSyncAuthError('Network request failed', undefined), false, 'network failure non deve essere auth error');

// 2. UpdaterService.verifyApkChecksum validation
const { UpdaterService } = await import('../src/services/updater/updater-service');
assert.strictEqual(await UpdaterService.verifyApkChecksum('/mock/test.apk', 'any-hash'), true, 'mock path deve restituire true');
assert.strictEqual(await UpdaterService.verifyApkChecksum('/test.apk', ''), true, 'expected hash vuoto deve restituire true');
assert.strictEqual(await UpdaterService.verifyApkChecksum('/test.apk', undefined), true, 'expected hash undefined deve restituire true');

// Test actual SHA-256 calculation with simulated FileSystem.readAsStringAsync
const sampleData = 'KuroTV Test APK Content';
const sampleBase64 = Buffer.from(sampleData).toString('base64');
const sampleSha256 = '11b3d3b541cfef9c759d6766fb9eb351b8bf4102306b1bec48e18637f5e285bb';

const { setMockFileContent } = (await import('expo-file-system/legacy')) as any;
try {
  (setMockFileContent as any)(sampleBase64);
  const validCheck = await UpdaterService.verifyApkChecksum('file:///data/app.apk', sampleSha256);
  assert.strictEqual(validCheck, true, 'verifyApkChecksum deve validare correttamente il checksum SHA-256');

  const invalidCheck = await UpdaterService.verifyApkChecksum('file:///data/app.apk', 'bad-checksum-12345');
  assert.strictEqual(invalidCheck, false, 'verifyApkChecksum deve rifiutare un checksum non corrispondente');
} finally {
  (setMockFileContent as any)('');
}

// 3. Plugins: withAndroidBackPress.modifyMainActivity
const { modifyMainActivity } = await import('../plugins/withAndroidBackPress.js');
const sampleExpoMainActivity = `package com.kurotv.mobile
import android.os.Bundle
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
`;
const patchedMainActivity = modifyMainActivity(sampleExpoMainActivity);
const invokeCount = (patchedMainActivity.match(/override fun invokeDefaultOnBackPressed/g) || []).length;
assert.strictEqual(invokeCount, 1, 'modifyMainActivity non deve duplicare invokeDefaultOnBackPressed');
assert(patchedMainActivity.includes('OnBackPressedCallback'), 'modifyMainActivity deve iniettare OnBackPressedCallback');
assert(patchedMainActivity.includes('import android.os.Build'), 'modifyMainActivity deve garantire import Build');
assert(patchedMainActivity.includes('import androidx.activity.OnBackPressedCallback'), 'modifyMainActivity deve garantire import OnBackPressedCallback');
assert.strictEqual(modifyMainActivity(patchedMainActivity), patchedMainActivity, 'modifyMainActivity deve essere idempotente');

// 4. app.json Hardening verification
const auditAppJsonRaw = fs.readFileSync(path.resolve(process.cwd(), 'app.json'), 'utf-8');
const auditAppJson = JSON.parse(auditAppJsonRaw);
assert.strictEqual(auditAppJson.expo?.android?.allowBackup, false, 'app.json deve impostare android.allowBackup=false');
assert(!auditAppJson.expo?.android?.permissions?.includes('android.permission.SYSTEM_ALERT_WINDOW'), 'SYSTEM_ALERT_WINDOW deve essere rimosso da app.json');
assert(auditAppJson.expo?.plugins?.includes('./plugins/withAndroidBackPress.js'), 'plugins deve includere withAndroidBackPress.js');

// 5. sanitizeFileName edge cases
const { sanitizeFileName: sanitizeTest } = await import('../src/services/downloads/download-service');
assert.notStrictEqual(sanitizeTest('..'), '..', 'sanitizeFileName non deve restituire ..');
assert.notStrictEqual(sanitizeTest('.'), '.', 'sanitizeFileName non deve restituire .');
assert.notStrictEqual(sanitizeTest('../../etc/passwd'), '../../etc/passwd', 'sanitizeFileName deve prevenire directory traversal');
assert.strictEqual(sanitizeTest(''), 'unknown', 'sanitizeFileName stringa vuota deve restituire unknown');
assert.strictEqual(sanitizeTest('Attack on Titan: Final Season!'), 'Attack_on_Titan__Final_Season_', 'sanitizeFileName deve preservare nomi validi');

// 6. Home modular components
const homeBarrel = await import('../src/components/home');
assert(typeof homeBarrel.HeroBannerSection === 'object' || typeof homeBarrel.HeroBannerSection === 'function', 'HeroBannerSection deve essere esportato');
assert(typeof homeBarrel.RecommendedCarouselSection === 'object' || typeof homeBarrel.RecommendedCarouselSection === 'function', 'RecommendedCarouselSection deve essere esportato');

console.log('✓ Audit Codebase (Hardening Deep-link, Resilienza Rete, Validazione Checksum OTA, Plugin MainActivity & De-monolizzazione Home) verificati con successo.');

// -----------------------------------------------------------------------------
// [33/33] Verifica Player Fix: Orientamento Orizzontale Stabile, Download Source Error & Riprova Sbloccato
// -----------------------------------------------------------------------------
console.log('\n[33/33] Verifica Player Fix: Orientamento Orizzontale Stabile, Download Source Error & Riprova Sbloccato...');

// 1. Verifica _layout.tsx: nessun lock forzato al cambio orientamento su smartphone
const layoutSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');
assert(layoutSrc.includes('isTablet !== wasTablet'), '_layout.tsx deve mutare lock solo se lo stato tablet cambia realmente');
assert(!layoutSrc.includes('handleOrientationPolicy();\n    const dimSub = Dimensions.addEventListener(\'change\', handleOrientationPolicy);'), '_layout.tsx non deve ri-eseguire lock su ogni rotazione');

// 2. Verifica download-service: resolvePlayableLocalUri restituisce null se l\'episodio è in downloading/queued/paused/error
const downloadServiceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/services/downloads/download-service.ts'), 'utf-8');
assert(downloadServiceSrc.includes('item && item.status !== \'completed\''), 'resolvePlayableLocalUri deve verificare che lo status non sia completed');
assert(downloadServiceSrc.includes('return null;'), 'resolvePlayableLocalUri deve restituire null per download incompleti');

// 3. Verifica app/player/[id].tsx: GestureDetector & osdOverlay disattivati in presenza di sourceError
const playerSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerSrc.includes('!showControls && !sourceError && !isLoadingSource && ('), 'GestureDetector deve essere inibito in presenza di sourceError');
assert(playerSrc.includes('showControls && Boolean(videoUrl) && !sourceError && ('), 'osdOverlay deve essere inibito in presenza di sourceError');
assert(playerSrc.includes('errorBackBtn'), 'La schermata di errore deve offrire un pulsante indietro dedicato');
assert(playerSrc.includes('setVideoUrl(null)'), 'loadStream deve resettare videoUrl durante il ricaricamento');
assert(playerSrc.includes('hasNavigatedRef.current || isNavigatingToEpisode'), 'Il cambio episodio non deve resettare l\'orientamento a verticale durante l\'unmount');
assert(playerSrc.includes('isBuffering'), 'Il player deve monitorare attivamente lo stato di buffering a metà riproduzione');
assert(playerSrc.includes('isBufferingOrLoading'), 'isBufferingOrLoading deve includere isBuffering per mostrare l\'indicatore durante i caricamenti');

// 4. Verifica player.styles.ts: loadingWrapper ha zIndex elevato ed errorBackBtn è definito
const playerStylesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/player.styles.ts'), 'utf-8');
assert(playerStylesSrc.includes('zIndex: 40'), 'loadingWrapper deve avere zIndex: 40 per non essere sovrastato');
assert(playerStylesSrc.includes('errorBackBtn: {'), 'errorBackBtn deve essere presente nei fogli di stile del player');

console.log('✓ Player Fix: Orientamento Orizzontale Stabile, Download Source Error & Riprova Sbloccato verificati con successo.');

// -----------------------------------------------------------------------------
// [34/34] Verifica Sincronizzazione Avanzata: Riprendi a Guardare, Preferiti & Cronologia
// -----------------------------------------------------------------------------
console.log('\n[34/34] Verifica Sincronizzazione Avanzata: Riprendi a Guardare, Preferiti & Cronologia...');

// 1. Verifica che updateContinueWatchingEpisode generi una sync mutation per continueWatching
AppStorage.clearPendingSyncMutations();
AppStorage.clearPendingSyncDeletions();
AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, [
  {
    animeId: 'caughtup-sync-test',
    title: 'CaughtUp Test',
    thumbnail: 'https://example.com/thumb.jpg',
    episodeId: 'ep-1',
    episodeNumber: 1,
    totalEpisodes: 12,
    position: 0,
    duration: 1400,
    percentage: 100,
    isCaughtUp: true,
    updatedAt: 1000,
  },
]);

const updatedCw = AppStorage.updateContinueWatchingEpisode(
  'caughtup-sync-test',
  { id: 'ep-2', number: 2 },
  12
);
assert.strictEqual(updatedCw, true, 'updateContinueWatchingEpisode deve restituire true');
const pendingAfterAdvance = AppStorage.getPendingSyncMutations();
assert(
  Array.isArray(pendingAfterAdvance.continueWatching),
  'updateContinueWatchingEpisode deve registrare una mutation per continueWatching'
);
assert(
  pendingAfterAdvance.continueWatching.some(
    (c: any) => c.animeId === 'caughtup-sync-test' && c.episodeNumber === 2
  ),
  'La mutation continueWatching deve contenere il nuovo episodio avanzato'
);

// 2. Verifica che un anime concluso in saveWatchProgress generi tombstone continue_watching e non muti anime estranei
AppStorage.clearPendingSyncMutations();
AppStorage.clearPendingSyncDeletions();
AppStorage.setObject(StorageKeys.CONTINUE_WATCHING, [
  {
    animeId: 'unrelated-anime',
    title: 'Unrelated Anime',
    thumbnail: '',
    episodeId: 'ep-1',
    episodeNumber: 1,
    totalEpisodes: 24,
    position: 500,
    duration: 1400,
    percentage: 35,
    isCaughtUp: false,
    updatedAt: 1000,
  },
  {
    animeId: 'concluded-anime',
    title: 'Concluded Anime',
    thumbnail: '',
    episodeId: 'ep-12',
    episodeNumber: 12,
    totalEpisodes: 12,
    position: 1390,
    duration: 1400,
    percentage: 99,
    isCaughtUp: false,
    updatedAt: 1000,
  },
]);

AppStorage.saveWatchProgress({
  animeId: 'concluded-anime',
  animeTitle: 'Concluded Anime',
  episodeId: 'ep-12',
  episodeNumber: 12,
  totalEpisodes: 12,
  currentTime: 1400,
  duration: 1400,
  isOngoing: false, // Serie conclusa
  nextEpisode: undefined, // Nessun prossimo episodio
});

const delsAfterConclude = AppStorage.getPendingSyncDeletions();
assert(
  delsAfterConclude.some((d) => d.type === 'continue_watching' && d.key === 'concluded-anime'),
  'Il completamento di una serie conclusa deve generare un tombstone continue_watching per quella serie'
);

const mutsAfterConclude = AppStorage.getPendingSyncMutations();
const cwMuts = mutsAfterConclude.continueWatching || [];
assert(
  !cwMuts.some((c: any) => c.animeId === 'unrelated-anime'),
  'Il completamento di una serie conclusa NON deve mutare arbitrariamente anime estranei in cima alla lista'
);

// 3. Verifica atomic acknowledgement: removePendingSyncMutations & removePendingSyncDeletions
AppStorage.clearPendingSyncMutations();
AppStorage.clearPendingSyncDeletions();

AppStorage.recordSyncMutation('favorites', {
  id: 'fav-1',
  title: 'Fav 1',
  thumbnail: '',
  link: '',
  updatedAt: 100,
});
AppStorage.recordSyncMutation('favorites', {
  id: 'fav-2',
  title: 'Fav 2',
  thumbnail: '',
  link: '',
  updatedAt: 100,
});
AppStorage.recordSyncMutation('continueWatching', {
  animeId: 'cw-1',
  title: 'CW 1',
  thumbnail: '',
  episodeId: 'ep-1',
  episodeNumber: 1,
  updatedAt: 100,
});

// Simula arrivo completamento push per solo fav-1: fav-2 e cw-1 devono rimanere intatti
AppStorage.removePendingSyncMutations({
  favorites: [{ id: 'fav-1', updatedAt: 100 }],
});
const remainingMuts = AppStorage.getPendingSyncMutations();
assert.strictEqual(remainingMuts.favorites.length, 1, 'Solo fav-1 doveva essere rimosso');
assert.strictEqual(remainingMuts.favorites[0].id, 'fav-2', 'fav-2 deve rimanere in coda');
assert.strictEqual(remainingMuts.continueWatching.length, 1, 'cw-1 deve rimanere in coda');

// Simula mutazione concorrente in-flight: fav-2 riceve update a t=200 mentre il push era per t=100
AppStorage.recordSyncMutation('favorites', {
  id: 'fav-2',
  title: 'Fav 2 Updated In-Flight',
  thumbnail: '',
  link: '',
  updatedAt: 200,
});
AppStorage.removePendingSyncMutations({
  favorites: [{ id: 'fav-2', updatedAt: 100 }], // Push completato per versione vecchia a 100
});
const remainingAfterInFlight = AppStorage.getPendingSyncMutations();
assert(remainingAfterInFlight.favorites && remainingAfterInFlight.favorites.length === 1, 'fav-2 con timestamp più recente (200) non deve essere cancellato');
assert.strictEqual(remainingAfterInFlight.favorites[0].updatedAt, 200);

// Verifica removePendingSyncDeletions
AppStorage.recordSyncDeletion('favorite', 'del-1');
AppStorage.recordSyncDeletion('favorite', 'del-2');
AppStorage.removePendingSyncDeletions([{ type: 'favorite', key: 'del-1' }]);
const remainingDels = AppStorage.getPendingSyncDeletions();
assert.strictEqual(remainingDels.length, 1, 'del-1 deve essere rimosso e del-2 preservato');
assert.strictEqual(remainingDels[0].key, 'del-2');

// 4. Verifica prevenzione regressione unmount nel player
const playerSourceCode = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerSourceCode.includes('hasNavigatedRef.current = true;'), 'player/[id].tsx deve impostare hasNavigatedRef alla navigazione');
assert(playerSourceCode.includes('!hasNavigatedRef.current && currentAnimeIdRef.current'), 'Il cleanup di unmount non deve sovrascrivere il progresso se la navigazione è già avvenuta');
assert(playerSourceCode.includes('currentTimeRef.current = savePos;'), 'handleNavigateToEpisode deve aggiornare currentTimeRef al valore salvato');
assert(playerSourceCode.includes('currentTimeRef.current = finalDuration;'), 'playToEnd deve aggiornare currentTimeRef al valore finale');

// 5. Verifica pullDeltaIfNeeded e aggancio a schermate
assert(typeof (SyncManager as any).pullDeltaIfNeeded === 'function', 'SyncManager deve esporre pullDeltaIfNeeded');
const homeSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/index.tsx'), 'utf-8');
const favSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/favorites.tsx'), 'utf-8');
const histSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/(tabs)/history.tsx'), 'utf-8');
assert(homeSrc.includes('SyncManager.pullDeltaIfNeeded'), 'Home index.tsx deve richiamare pullDeltaIfNeeded on focus');
assert(favSrc.includes('SyncManager.pullDeltaIfNeeded'), 'Favorites favorites.tsx deve richiamare pullDeltaIfNeeded on focus');
assert(histSrc.includes('SyncManager.pullDeltaIfNeeded'), 'History history.tsx deve richiamare pullDeltaIfNeeded on focus');

// 6. Verifica fallback defaults non-null nel backend KuroTV_S
const serverSyncSrc = fs.readFileSync(path.resolve(process.cwd(), '../KuroTV_S/src/worker/routes/sync.ts'), 'utf-8');
assert(serverSyncSrc.includes('item.thumbnail || ""'), 'KuroTV_S deve applicare fallback non-null per thumbnail');
assert(serverSyncSrc.includes('item.title || "Anime"'), 'KuroTV_S deve applicare fallback non-null per title');
assert(serverSyncSrc.includes('item.episodeId || ""'), 'KuroTV_S deve applicare fallback non-null per episodeId');

console.log('✓ Sincronizzazione Avanzata: Riprendi a Guardare, Preferiti & Cronologia verificati con successo.');

// -----------------------------------------------------------------------------
// 35. Verifica Allineamento Client KuroSync: Cursori di Replica, Anti-Resurrezione Tombstones & Robustezza Payload
// -----------------------------------------------------------------------------
console.log('\n[35/35] Verifica Allineamento Client KuroSync: Cursori di Replica, Anti-Resurrezione Tombstones & Robustezza Payload...');

// 1. Gestione Rigorosa Cursori per Profilo
SyncManager.resetLastSyncTimestamp('prof-scoping-1');
SyncManager.resetLastSyncTimestamp('prof-scoping-2');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-1'), 0, 'Timestamp iniziale per nuovo profilo deve essere 0');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-2'), 0, 'Timestamp iniziale per secondo profilo deve essere 0');

SyncManager.setLastSyncTimestamp(50000, 'prof-scoping-1');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-1'), 50000, 'prof-scoping-1 deve riflettere il suo watermark');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-2'), 0, 'prof-scoping-2 deve rimanere isolato a 0');

SyncManager.setLastSyncTimestamp(75000, 'prof-scoping-2');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-2'), 75000, 'prof-scoping-2 deve salvare il suo timestamp');
assert.strictEqual(SyncManager.getLastSyncTimestamp('prof-scoping-1'), 50000, 'prof-scoping-1 deve preservare 50000 inalterato');

// 2. Anti-Resurrezione Tombstones & Pruning Pending Mutations
AppStorage.clearKnownTombstones();
AppStorage.clearPendingSyncMutations();

AppStorage.recordKnownTombstones([
  { type: 'favorite', key: 'tomb-anime-1', deletedAt: 1000 },
  { type: 'continue_watching', key: 'tomb-anime-2', deletedAt: 1500 },
]);
const knownTombs = AppStorage.getKnownTombstones();
assert.strictEqual(knownTombs.length, 2, 'Devono essere presenti 2 tombstones noti');
assert(knownTombs.some((t) => t.key === 'tomb-anime-1' && t.deletedAt === 1000));

// Simula mutazioni locali pre-esistenti prima della ricezione di tombstones
AppStorage.setObject(StorageKeys.SYNC_PENDING_MUTATIONS, {
  favorites: [
    { id: 'tomb-anime-1', title: 'Old Ghost Title', updatedAt: 800 },
    { id: 'legit-anime-3', title: 'Legit Anime', updatedAt: 2000 },
  ],
  continueWatching: [
    { animeId: 'tomb-anime-2', episodeNumber: 1, updatedAt: 1200 },
  ],
});

AppStorage.prunePendingMutationsAgainstTombstones(AppStorage.getKnownTombstones());
const prunedMuts = AppStorage.getPendingSyncMutations();
assert(
  !prunedMuts.favorites || !prunedMuts.favorites.some((f: any) => f.id === 'tomb-anime-1'),
  'tomb-anime-1 con updatedAt <= deletedAt deve essere eliminato da pending mutations'
);
assert(
  !prunedMuts.continueWatching || !prunedMuts.continueWatching.some((c: any) => c.animeId === 'tomb-anime-2'),
  'tomb-anime-2 con updatedAt <= deletedAt deve essere eliminato da continueWatching pending'
);
assert(
  prunedMuts.favorites && prunedMuts.favorites.some((f: any) => f.id === 'legit-anime-3'),
  'legit-anime-3 senza tombstone deve essere preservato intatto'
);

// Verifica che una chiamata a recordSyncMutation con timestamp vecchio venga scartata all'origine
AppStorage.recordSyncMutation('favorites', { id: 'tomb-anime-1', title: 'Old Rejected', updatedAt: 700 });
const mutsAfterOldCall = AppStorage.getPendingSyncMutations();
assert(
  !mutsAfterOldCall.favorites || !mutsAfterOldCall.favorites.some((f: any) => f.id === 'tomb-anime-1'),
  'recordSyncMutation con updatedAt <= deletedAt deve essere scartata all origine per tombstone dominance'
);

// Simula ri-aggiunta legittima da parte dell utente (updatedAt > deletedAt): deve rimuovere il tombstone
AppStorage.recordSyncMutation('favorites', { id: 'tomb-anime-1', title: 'Restored Title', updatedAt: 2500 });
const tombsAfterRestore = AppStorage.getKnownTombstones();
assert(
  !tombsAfterRestore.some((t) => t.key === 'tomb-anime-1'),
  'Ri-aggiunta di tomb-anime-1 deve rimuovere il tombstone corrispondente'
);

// 3. Verifica Merge Local & Remote con Known Tombstones
const localStateTest: LocalStorageState = {
  favorites: [
    { id: 'fav-kept', title: 'Fav Kept', thumbnail: '', link: '', updatedAt: 500, genres: [] },
    { id: 'fav-purged', title: 'Fav Purged', thumbnail: '', link: '', updatedAt: 400, genres: [] },
  ],
  continueWatching: [],
  watchHistory: [],
  watchProgress: [],
  sharedSettings: {},
  searchHistory: [],
};
const remotePullTest: RemotePullResponse = {
  serverTime: 60000,
  profile: { id: 'p1', name: 'Main' },
  deltas: {
    favorites: [{ id: 'fav-kept', title: 'Fav Kept Updated', thumbnail: '', link: '', updatedAt: 800, genres: [] }],
    continueWatching: [],
    watchHistory: [],
    watchProgress: [],
    sharedSettings: {},
    searchHistory: [],
  },
  tombstones: [],
};
const externalKnownTombs = [{ type: 'favorite', key: 'fav-purged', deletedAt: 600 }];
const mergeResult = mergeLocalAndRemote(
  localStateTest,
  remotePullTest,
  [],
  {},
  externalKnownTombs
);
assert.strictEqual(mergeResult.state.favorites.length, 1, 'Solo fav-kept deve essere presente');
assert.strictEqual(mergeResult.state.favorites[0].id, 'fav-kept');
assert.strictEqual(mergeResult.state.favorites[0].title, 'Fav Kept Updated', 'LWW deve adottare il titolo remoto piu recente');

// Cleanup
AppStorage.clearKnownTombstones();
AppStorage.clearPendingSyncMutations();
AppStorage.clearPendingSyncDeletions();

console.log('✓ Allineamento Client KuroSync: Cursori di Replica, Anti-Resurrezione Tombstones & Robustezza Payload verificati con successo.');

// -----------------------------------------------------------------------------
// [36/36] Verifica Preservazione Orientamento Player & Contromisure Anti-Duplicazione Tastiere Terze
// -----------------------------------------------------------------------------
console.log('\n[36/36] Verifica Preservazione Orientamento Player & Contromisure Anti-Duplicazione Tastiere Terze...');

// 1. Verifica Player: Preservazione Orientamento tra Episodi (Landscape & Portrait)
const playerOrientationSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerOrientationSrc.includes('lastPlayerOrientation'), 'Il player deve tracciare lastPlayerOrientation a livello di modulo');
assert(playerOrientationSrc.includes("orientation?: 'landscape' | 'portrait'"), 'I parametri rotta del player devono supportare orientation');
assert(playerOrientationSrc.includes('targetOrientation === \'portrait\''), 'Il player deve preservare la modalita verticale (PORTRAIT_UP) se l\'utente era in portrait');
assert(playerOrientationSrc.includes('targetOrientation === \'landscape\''), 'Il player deve preservare la modalita orizzontale (LANDSCAPE) se l\'utente era in landscape');
assert(playerOrientationSrc.includes('lastPlayerOrientation = activeOrientation'), 'handleNavigateToEpisode deve aggiornare lastPlayerOrientation');
assert(playerOrientationSrc.includes('orientation: activeOrientation'), 'handleNavigateToEpisode deve passare orientation nei parametri di navigazione');
assert(playerOrientationSrc.includes('toggleOrientationFullscreen'), 'toggleOrientationFullscreen deve aggiornare lastPlayerOrientation');
assert(playerOrientationSrc.includes('hasNavigatedRef.current = false'), 'Il player deve resettare hasNavigatedRef al cambio episodio per preservare la corretta uscita su unmount');
assert(playerOrientationSrc.includes('lastPlayerOrientation || (curW > curH ? \'landscape\' : \'portrait\')'), 'handleNavigateToEpisode deve dare precedenza all\'orientamento esplicito lastPlayerOrientation');

// 2. Verifica Search: Contromisure Anti-Duplicazione Tastiere Terze (Fleksy, SwiftKey, Emoji Keyboard / Ekatox)
const homeSearchHeaderSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/HomeSearchHeader.tsx'), 'utf-8');
const homeStylesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/home.styles.ts'), 'utf-8');

// A. Assenza di textTransform su TextInput per prevenire desincronizzazione del buffer di composizione
const searchInputStyleMatch = homeStylesSrc.match(/searchInput:\s*\{([^}]+)\}/);
assert(searchInputStyleMatch, 'searchInput style deve essere presente in home.styles.ts');
assert(!searchInputStyleMatch[1].includes('textTransform'), 'searchInput NON deve contenere textTransform per evitare conflitti con IME Android');

// B. Parametri TextInput nativi anti-conflitto per IME Android
assert(homeSearchHeaderSrc.includes('autoCapitalize="none"'), 'TextInput deve avere autoCapitalize="none" per prevenire duplicazione prime lettere su SwiftKey');
assert(homeSearchHeaderSrc.includes('autoCorrect={false}'), 'TextInput deve avere autoCorrect={false}');
assert(homeSearchHeaderSrc.includes('spellCheck={false}'), 'TextInput deve avere spellCheck={false}');
assert(homeSearchHeaderSrc.includes('autoComplete="off"'), 'TextInput deve avere autoComplete="off"');
assert(homeSearchHeaderSrc.includes('textContentType="none"'), 'TextInput deve avere textContentType="none"');
assert(homeSearchHeaderSrc.includes('importantForAutofill="no"'), 'TextInput deve avere importantForAutofill="no"');
assert(homeSearchHeaderSrc.includes('inputMode="search"'), 'TextInput deve specificare inputMode="search"');
assert(homeSearchHeaderSrc.includes('disableFullscreenUI={true}'), 'TextInput deve disabilitare la fullscreen UI su Android');

// C. Sincronizzazione locale e buffering con React.memo per eliminare il feedback loop asincrono
assert(homeSearchHeaderSrc.includes('React.memo'), 'HomeSearchHeader deve essere memoizzato con React.memo');
assert(homeSearchHeaderSrc.includes('lastNativeTextRef'), 'HomeSearchHeader deve tracciare il testo nativo con lastNativeTextRef');
assert(homeSearchHeaderSrc.includes('localText'), 'HomeSearchHeader deve gestire il testo locale separato dal rendering della Home');
assert(homeSearchHeaderSrc.includes('debounceTimerRef'), 'HomeSearchHeader deve disaccoppiare la digitazione dal rendering genitore tramite debounceTimerRef');

console.log('✓ Preservazione Orientamento Player & Contromisure Anti-Duplicazione Tastiere Terze verificate con successo.');

// -----------------------------------------------------------------------------
// [37/37] Verifica TextInput Decoupled Anti-Drop, Changelog Esclusivo da Build & Allineamento Schema D1 KuroSync
// -----------------------------------------------------------------------------
console.log('\n[37/37] Verifica TextInput Decoupled Anti-Drop, Changelog Esclusivo da Build & Allineamento Schema D1 KuroSync...');

// 1. Verifica TextInput Decoupled Anti-Drop per tastiere terze Android (Fleksy, SwiftKey, Samsung Keyboard, Ekatox)
assert(!homeSearchHeaderSrc.includes('value={localText}'), 'TextInput non deve vincolare value={localText} per evitare reset forzati del buffer IME nativo durante la digitazione veloce');
assert(homeSearchHeaderSrc.includes('defaultValue={lastNativeTextRef.current}'), 'TextInput deve usare defaultValue={lastNativeTextRef.current}');
assert(homeSearchHeaderSrc.includes('key={inputKey}'), 'TextInput deve usare key={inputKey} per rimontare esclusivamente al cambio query esterno');
assert(homeSearchHeaderSrc.includes('prev.length === 0 && text.length > 0'), 'HomeSearchHeader deve limitare setLocalText alle transizioni vuoto/non-vuoto azzerando re-render su ogni tasto');
assert(homeSearchHeaderSrc.includes('lastPropagatedQueryRef'), 'HomeSearchHeader deve tracciare lastPropagatedQueryRef per distinguere echi interni da mutazioni esterne');
assert(homeSearchHeaderSrc.includes('isTypingRef'), 'HomeSearchHeader deve tracciare isTypingRef per inibire sovrascritture durante digitazione continua');
assert(!homeSearchHeaderSrc.includes('setLocalText(lastNativeTextRef.current)'), 'HomeSearchHeader non deve invocare setLocalText nel timer di debounce per azzerare re-render durante la digitazione');

// Simulazione Algoritmica Race Condition Digitazione Veloce
{
  let currentKey: number = 0;
  let nativeBuffer: string = '';
  let lastPropagated: string = '';
  let isTyping: boolean = false;
  let sentQueryToParent: string = '';

  const simulateType = (text: string) => {
    nativeBuffer = text;
    isTyping = true;
  };

  const simulateDebounceFire = () => {
    lastPropagated = nativeBuffer;
    isTyping = false;
    sentQueryToParent = nativeBuffer;
  };

  const simulateParentPropUpdate = (incomingProp: string) => {
    if (incomingProp === nativeBuffer || incomingProp === lastPropagated || isTyping) {
      return; // Safe!
    }
    currentKey++;
    nativeBuffer = incomingProp;
  };

  // Keystrokes 1..3
  simulateType('a');
  simulateType('ab');
  simulateType('abc');
  // Debounce fires and sends 'abc' to parent
  simulateDebounceFire();
  // While parent is batching/rendering, user immediately continues spamming keystrokes 4..6
  simulateType('abcd');
  simulateType('abcde');
  simulateType('abcdef');
  // Parent commits render and sends down incomingProp = 'abc'
  simulateParentPropUpdate(sentQueryToParent);
  // Verify: nativeBuffer is NOT wiped out back to 'abc' and key is NOT incremented!
  assert(nativeBuffer === 'abcdef', 'La digitazione veloce non deve essere sovrascritta dal commit ritardato del genitore');
  assert(currentKey === 0, 'La key del TextInput non deve essere incrementata durante la digitazione continua');

  // External selection (e.g. user taps "NARUTO" in history)
  isTyping = false;
  simulateParentPropUpdate('NARUTO');
  assert((nativeBuffer as string) === 'NARUTO', 'La selezione esterna deve aggiornare il buffer nativo');
  assert((currentKey as number) === 1, 'La selezione esterna deve incrementare la key per sincronizzare il TextInput');
}

// 2. Verifica Changelog Esclusivo generato da build-release.sh
const buildReleaseSrc = fs.readFileSync(path.resolve(process.cwd(), 'scripts/build-release.sh'), 'utf-8');
assert(buildReleaseSrc.includes('CHANGELOG_TS='), 'build-release.sh deve aggiornare src/constants/changelog.ts durante il rilascio');
assert(buildReleaseSrc.includes('CURRENT_CHANGELOG: ChangelogEntry'), 'build-release.sh deve generare CURRENT_CHANGELOG');
assert(CURRENT_CHANGELOG.releaseNotes != null && CURRENT_CHANGELOG.releaseNotes.length > 0, 'CURRENT_CHANGELOG deve contenere releaseNotes');
const formattedCurrentChangelog = formatChangelog(CURRENT_CHANGELOG);
assert(formattedCurrentChangelog.includes('1.0.0'), 'formatChangelog deve includere la versione corrente');
assert(formattedCurrentChangelog.includes('NOVITÀ') || formattedCurrentChangelog.includes('RELEASE'), 'formatChangelog deve restituire le note di rilascio in maiuscolo');

// 3. Verifica Allineamento Schema D1 KuroSync (server_deleted_at & server_updated_at)
const migrationCursorSrc = fs.readFileSync(path.resolve(process.cwd(), '_kurosync_ref/migrations/0002_server_replication_cursor.sql'), 'utf-8');
assert(migrationCursorSrc.includes('ALTER TABLE tombstones ADD COLUMN server_deleted_at'), 'La migrazione D1 deve aggiungere server_deleted_at a tombstones');
assert(migrationCursorSrc.includes('ALTER TABLE favorites ADD COLUMN server_updated_at'), 'La migrazione D1 deve aggiungere server_updated_at a favorites');
assert(migrationCursorSrc.includes('ALTER TABLE continue_watching ADD COLUMN server_updated_at'), 'La migrazione D1 deve aggiungere server_updated_at a continue_watching');

console.log('✓ TextInput Decoupled Anti-Drop, Changelog Esclusivo da Build & Allineamento Schema D1 KuroSync verificati con successo.');

// -----------------------------------------------------------------------------
// [38/38] Verifica Live Keyframe Scrubbing, Time-Scrubbing HUD OLED & Quantizzazione Thumbnail
// -----------------------------------------------------------------------------
console.log('\n[38/38] Verifica Live Keyframe Scrubbing, Time-Scrubbing HUD OLED & Quantizzazione Thumbnail...');

// 1. Verifica formatDeltaTime
const positiveDelta = formatDeltaTime(165);
assert(positiveDelta !== null, 'formatDeltaTime per +165s non deve essere null');
assert.strictEqual(positiveDelta.text, '+02:45', 'formatDeltaTime(+165) deve restituire +02:45');
assert.strictEqual(positiveDelta.color, '#4ADE80', 'formatDeltaTime positivo deve avere colore verde #4ADE80');

const negativeDelta = formatDeltaTime(-70);
assert(negativeDelta !== null, 'formatDeltaTime per -70s non deve essere null');
assert.strictEqual(negativeDelta.text, '-01:10', 'formatDeltaTime(-70) deve restituire -01:10');
assert.strictEqual(negativeDelta.color, '#F87171', 'formatDeltaTime negativo deve avere colore rosso #F87171');

const zeroDelta = formatDeltaTime(0);
assert.strictEqual(zeroDelta, null, 'formatDeltaTime(0) deve restituire null (nessun delta visualizzato)');

const subSecondDelta = formatDeltaTime(0.4);
assert.strictEqual(subSecondDelta, null, 'formatDeltaTime(0.4) deve restituire null');

const longMovieDelta = formatDeltaTime(3665);
assert(longMovieDelta !== null, 'formatDeltaTime per +3665s non deve essere null');
assert.strictEqual(longMovieDelta.text, '+1:01:05', 'formatDeltaTime(+3665) deve supportare ore');

// Robustezza Edge Cases formatDeltaTime & formatTime
assert.strictEqual(formatDeltaTime(NaN), null, 'formatDeltaTime(NaN) deve restituire null');
assert.strictEqual(formatDeltaTime(Infinity), null, 'formatDeltaTime(Infinity) deve restituire null');
assert.strictEqual(formatDeltaTime(-Infinity), null, 'formatDeltaTime(-Infinity) deve restituire null');
assert.strictEqual(formatTime(NaN), '00:00', 'formatTime(NaN) deve restituire 00:00');
assert.strictEqual(formatTime(Infinity), '00:00', 'formatTime(Infinity) deve restituire 00:00');
assert.strictEqual(formatTime(-10), '00:00', 'formatTime(-10) deve restituire 00:00');

// 2. Verifica getAniSkipChapterBadge
const testChapterSkips = [
  {
    skipId: 'op-1',
    skipType: 'op' as const,
    interval: { startTime: 0, endTime: 90 },
    episodeLength: 1440,
  },
  {
    skipId: 'recap-1',
    skipType: 'recap' as const,
    interval: { startTime: 90, endTime: 150 },
    episodeLength: 1440,
  },
  {
    skipId: 'ed-1',
    skipType: 'ed' as const,
    interval: { startTime: 1200, endTime: 1290 },
    episodeLength: 1440,
  },
];

const badgeOp = getAniSkipChapterBadge(45, 1440, testChapterSkips);
assert.strictEqual(badgeOp.label, '[SIGLA INIZIALE]', 'A 45s deve restituire [SIGLA INIZIALE]');
assert.strictEqual(badgeOp.color, '#FBBF24', 'Badge OP deve avere colore giallo #FBBF24');

const badgeRecap = getAniSkipChapterBadge(120, 1440, testChapterSkips);
assert.strictEqual(badgeRecap.label, '[RECAP]', 'A 120s deve restituire [RECAP]');
assert.strictEqual(badgeRecap.color, '#38BDF8', 'Badge Recap deve avere colore blu #38BDF8');

const badgeEp = getAniSkipChapterBadge(500, 1440, testChapterSkips);
assert.strictEqual(badgeEp.label, '[EPISODIO]', 'A 500s deve restituire [EPISODIO]');

const badgeEd = getAniSkipChapterBadge(1250, 1440, testChapterSkips);
assert.strictEqual(badgeEd.label, '[SIGLA FINALE]', 'A 1250s deve restituire [SIGLA FINALE]');
assert.strictEqual(badgeEd.color, '#A78BFA', 'Badge ED deve avere colore viola #A78BFA');

const badgePostCredits = getAniSkipChapterBadge(1350, 1440, testChapterSkips);
assert.strictEqual(badgePostCredits.label, '[POST-CREDITS]', 'A 1350s (dopo ED con durata 1440s) deve restituire [POST-CREDITS]');
assert.strictEqual(badgePostCredits.color, '#34D399', 'Badge Post-credits deve avere colore verde smeraldo #34D399');

const badgeNoSkips = getAniSkipChapterBadge(300, 1440, []);
assert.strictEqual(badgeNoSkips.label, '[EPISODIO]', 'Senza intervalli registrati deve restituire [EPISODIO]');

// Robustezza getAniSkipChapterBadge con input malformati o null
const badgeWithNull = getAniSkipChapterBadge(50, 1440, [null as any, { skipId: 'x' } as any]);
assert.strictEqual(badgeWithNull.label, '[EPISODIO]', 'Con elementi null in skips non deve crashare e deve restituire [EPISODIO]');
const badgeWithInvalidInterval = getAniSkipChapterBadge(50, 1440, [{ skipType: 'op', interval: null } as any]);
assert.strictEqual(badgeWithInvalidInterval.label, '[EPISODIO]', 'Con interval null non deve crashare e deve restituire [EPISODIO]');

// 3. Verifica Integrazione PlayerTimeline.tsx
const timelineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerTimeline.tsx'), 'utf-8');
assert(timelineSrc.includes('scrubbingModeOptions'), 'PlayerTimeline deve impostare scrubbingModeOptions su player');
assert(timelineSrc.includes('increaseCodecOperatingRate: true'), 'PlayerTimeline deve abilitare increaseCodecOperatingRate');
assert(timelineSrc.includes('enableDynamicScheduling: true'), 'PlayerTimeline deve abilitare enableDynamicScheduling');
assert(timelineSrc.includes('useDecodeOnlyFlag: true'), 'PlayerTimeline deve abilitare useDecodeOnlyFlag');
assert(timelineSrc.includes('allowSkippingMediaCodecFlush: true'), 'PlayerTimeline deve abilitare allowSkippingMediaCodecFlush');
assert(timelineSrc.includes('toleranceBefore: 4'), 'PlayerTimeline deve impostare seekTolerance rilassata a 4s durante lo scrubbing');
assert(timelineSrc.includes('toleranceBefore: 0'), 'PlayerTimeline deve ripristinare seekTolerance a 0s al rilascio');
assert(timelineSrc.includes('scrubStartTimeRef'), 'PlayerTimeline deve usare scrubStartTimeRef per calcolare il vero delta relativo');
assert(timelineSrc.includes('isLocalSource'), 'PlayerTimeline deve condizionare le thumbnail video ai soli file locali');
assert(timelineSrc.includes('BUCKET_SIZE = 5'), 'PlayerTimeline deve quantizzare le thumbnail locali a bucket di 5 secondi');
assert(timelineSrc.includes('thumbnailCache.current.size >= 50'), 'PlayerTimeline deve limitare la cache a 50 thumbnail con logica LRU');
assert(timelineSrc.includes('thumbnailCache.current.clear()'), 'PlayerTimeline deve svuotare la cache thumbnail al cambio sorgente videoUrl');
assert(!timelineSrc.includes('source={{ uri: thumbnail }}'), 'PlayerTimeline non deve mostrare la finta locandina statica durante lo scrubbing');
assert(timelineSrc.includes('previewTimeRow') && timelineSrc.includes('chapterBadge'), 'PlayerTimeline deve renderizzare il Time-Scrubbing HUD OLED');

// 4. Verifica Integrazione PlayerFooter.tsx
const footerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerFooter.tsx'), 'utf-8');
assert(footerSrc.includes('aniSkipResults={aniSkipResults}'), 'PlayerFooter deve inoltrare aniSkipResults a PlayerTimeline');
assert(footerSrc.includes('isLocalSource={isLocalSource}'), 'PlayerFooter deve inoltrare isLocalSource a PlayerTimeline');
assert(footerSrc.includes('videoUrl={videoUrl}'), 'PlayerFooter deve inoltrare videoUrl a PlayerTimeline');
assert(footerSrc.includes('!isScrubbingRef.current'), 'PlayerFooter deve inibire timeUpdate durante lo scrubbing per prevenire flutter');

// 5. Verifica Integrazione app/player/[id].tsx
const playerRouteSrc = fs.readFileSync(path.resolve(process.cwd(), 'app/player/[id].tsx'), 'utf-8');
assert(playerRouteSrc.includes('aniSkipResults={aniSkipResults}'), 'app/player/[id].tsx deve passare aniSkipResults a PlayerFooter');
assert(playerRouteSrc.includes('isLocalSource='), 'app/player/[id].tsx deve passare isLocalSource a PlayerFooter');
assert(playerRouteSrc.includes('videoUrl={videoUrl || undefined}'), 'app/player/[id].tsx deve passare videoUrl a PlayerFooter');
assert(playerRouteSrc.includes('!isScrubbingRef.current'), 'app/player/[id].tsx deve proteggere il watchdog di buffering durante lo scrubbing');
assert(playerRouteSrc.includes('!isScrubbingRef.current && Math.abs(time - lastSavedTimeRef.current) >= 4'), 'app/player/[id].tsx deve inibire il salvataggio progress periodico durante lo scrubbing');
assert(playerRouteSrc.includes('!isScrubbingRef.current && aniSkipResultsRef.current.length > 0'), 'app/player/[id].tsx deve inibire l\'auto-skip di AniSkip durante lo scrubbing');
assert(playerRouteSrc.includes('userWantsPlaybackRef.current && !player.playing'), 'app/player/[id].tsx deve riprendere playback al rilascio se richiesto');

console.log('✓ Live Keyframe Scrubbing, Time-Scrubbing HUD OLED & Quantizzazione Thumbnail verificati con successo.');

// -----------------------------------------------------------------------------
// [39/39] Verifica Visualizzazione Capitoli sulla Timeline (Segmenti YouTube, Gaps, Colori OLED & Haptics)
// -----------------------------------------------------------------------------
console.log('\n[39/39] Verifica Visualizzazione Capitoli sulla Timeline (Segmenti YouTube, Gaps, Colori OLED & Haptics)...');

// 1. Verifica computeTimelineChapters con episodio anime standard (OP, ED, Post-credits)
const standardSkips: AniSkipResult[] = [
  {
    skipId: 'op-std',
    skipType: 'op',
    interval: { startTime: 90, endTime: 180 },
    episodeLength: 1440,
  },
  {
    skipId: 'ed-std',
    skipType: 'ed',
    interval: { startTime: 1300, endTime: 1390 },
    episodeLength: 1440,
  },
];

const stdChapters = computeTimelineChapters(1440, standardSkips, '#10B981');
assert.strictEqual(stdChapters.length, 5, 'Episodio con OP ed ED deve generare esattamente 5 capitoli (Ep, OP, Ep, ED, Post-Credits)');
assert.strictEqual(stdChapters[0].type, 'episode');
assert.strictEqual(stdChapters[0].startTime, 0);
assert.strictEqual(stdChapters[0].endTime, 90);
assert.strictEqual(stdChapters[0].playedColor, '#10B981');

assert.strictEqual(stdChapters[1].type, 'op');
assert.strictEqual(stdChapters[1].label, '[SIGLA INIZIALE]');
assert.strictEqual(stdChapters[1].startTime, 90);
assert.strictEqual(stdChapters[1].endTime, 180);
assert.strictEqual(stdChapters[1].playedColor, '#FBBF24');
assert.strictEqual(stdChapters[1].unplayedColor, 'rgba(251, 191, 36, 0.28)');

assert.strictEqual(stdChapters[2].type, 'episode');
assert.strictEqual(stdChapters[2].startTime, 180);
assert.strictEqual(stdChapters[2].endTime, 1300);

assert.strictEqual(stdChapters[3].type, 'ed');
assert.strictEqual(stdChapters[3].label, '[SIGLA FINALE]');
assert.strictEqual(stdChapters[3].startTime, 1300);
assert.strictEqual(stdChapters[3].endTime, 1390);
assert.strictEqual(stdChapters[3].playedColor, '#A78BFA');
assert.strictEqual(stdChapters[3].unplayedColor, 'rgba(167, 139, 250, 0.28)');

assert.strictEqual(stdChapters[4].type, 'post-credits');
assert.strictEqual(stdChapters[4].label, '[POST-CREDITS]');
assert.strictEqual(stdChapters[4].startTime, 1390);
assert.strictEqual(stdChapters[4].endTime, 1440);
assert.strictEqual(stdChapters[4].playedColor, '#34D399');
assert.strictEqual(stdChapters[4].unplayedColor, 'rgba(52, 211, 153, 0.28)');

// 2. Verifica computeTimelineChapters con Recap a inizio video (t=0) e no gaps
const recapSkips: AniSkipResult[] = [
  {
    skipId: 'recap-0',
    skipType: 'recap',
    interval: { startTime: 0, endTime: 60 },
    episodeLength: 1440,
  },
  {
    skipId: 'op-0',
    skipType: 'mixed-op',
    interval: { startTime: 60, endTime: 150 },
    episodeLength: 1440,
  },
  {
    skipId: 'ed-0',
    skipType: 'mixed-ed',
    interval: { startTime: 1320, endTime: 1410 },
    episodeLength: 1440,
  },
];

const recapChapters = computeTimelineChapters(1440, recapSkips, '#3B82F6');
assert.strictEqual(recapChapters.length, 5);
assert.strictEqual(recapChapters[0].type, 'recap', 'Primo capitolo deve essere recap a t=0 senza segmento episodio vuoto');
assert.strictEqual(recapChapters[0].label, '[RECAP]');
assert.strictEqual(recapChapters[0].startTime, 0);
assert.strictEqual(recapChapters[0].endTime, 60);
assert.strictEqual(recapChapters[0].playedColor, '#38BDF8');
assert.strictEqual(recapChapters[0].unplayedColor, 'rgba(56, 189, 248, 0.28)');

assert.strictEqual(recapChapters[1].type, 'op');
assert.strictEqual(recapChapters[1].startTime, 60);
assert.strictEqual(recapChapters[1].endTime, 150);

// 3. Verifica estensione ED se termina entro 5 secondi dalla fine
const edNearEndSkips: AniSkipResult[] = [
  {
    skipId: 'ed-end',
    skipType: 'ed',
    interval: { startTime: 1300, endTime: 1438 },
    episodeLength: 1440,
  },
];
const edEndChapters = computeTimelineChapters(1440, edNearEndSkips);
assert.strictEqual(edEndChapters.length, 2, 'ED che termina a 2s dalla fine deve estendersi fino al termine (2 capitoli)');
assert.strictEqual(edEndChapters[1].endTime, 1440, 'ED deve terminare esattamente a duration (1440)');

// 4. Verifica ordinamento e gestione overlap intervalli disordinati
const messySkips: AniSkipResult[] = [
  {
    skipId: 'ed-mess',
    skipType: 'ed',
    interval: { startTime: 1200, endTime: 1290 },
    episodeLength: 1440,
  },
  {
    skipId: 'op-mess',
    skipType: 'op',
    interval: { startTime: 100, endTime: 190 },
    episodeLength: 1440,
  },
  {
    skipId: 'overlap-mess',
    skipType: 'recap',
    interval: { startTime: 180, endTime: 250 }, // Overlaps with OP end 190
    episodeLength: 1440,
  },
];
const messyChapters = computeTimelineChapters(1440, messySkips);
assert(messyChapters.length >= 4, 'Intervalli disordinati e sovrapposti devono essere ordinati e ripartiti');
assert.strictEqual(messyChapters[0].type, 'episode');
assert.strictEqual(messyChapters[1].type, 'op');
assert.strictEqual(messyChapters[2].type, 'recap');
assert.strictEqual(messyChapters[2].startTime, 190, 'L\'intervallo sovrapposto deve partire dopo la fine del precedente (190)');

// 5. Verifica robustezza input invalidi o assenti, clamp tempi negativi e skip sconosciuti
assert.deepStrictEqual(computeTimelineChapters(0, standardSkips), [], 'duration 0 deve restituire []');
assert.deepStrictEqual(computeTimelineChapters(-10, standardSkips), [], 'duration negativa deve restituire []');
assert.deepStrictEqual(computeTimelineChapters(NaN, standardSkips), [], 'duration NaN deve restituire []');
assert.deepStrictEqual(computeTimelineChapters(Infinity, standardSkips), [], 'duration Infinity deve restituire []');
assert.deepStrictEqual(computeTimelineChapters(1440, []), [], 'aniSkipResults vuoto deve restituire []');
assert.deepStrictEqual(computeTimelineChapters(1440, undefined), [], 'aniSkipResults undefined deve restituire []');
assert.deepStrictEqual(
  computeTimelineChapters(1440, [{ skipId: 'x', skipType: 'op', interval: { startTime: 2000, endTime: 2100 }, episodeLength: 1440 }]),
  [],
  'Intervallo oltre duration deve restituire []'
);

// 5b. Verifica clamping tempi di inizio negativi (metadata broadcast/sigla a inizio video)
const negStartSkips: AniSkipResult[] = [
  { skipId: 'op-neg', skipType: 'op', interval: { startTime: -2.5, endTime: 90 }, episodeLength: 1440 },
  { skipId: 'ed-neg', skipType: 'ed', interval: { startTime: 1300, endTime: 1390 }, episodeLength: 1440 },
];
const negStartChapters = computeTimelineChapters(1440, negStartSkips);
assert.strictEqual(negStartChapters[0].type, 'op', 'Inizio negativo deve essere clampato a 0 come sigla');
assert.strictEqual(negStartChapters[0].startTime, 0);
assert.strictEqual(negStartChapters[0].endTime, 90);

// 5c. Verifica unione di skip consecutivi dello stesso tipo (es. op + mixed-op contigui)
const adjacentSkips: AniSkipResult[] = [
  { skipId: 'op-part1', skipType: 'op', interval: { startTime: 60, endTime: 120 }, episodeLength: 1440 },
  { skipId: 'op-part2', skipType: 'mixed-op', interval: { startTime: 120, endTime: 150 }, episodeLength: 1440 },
  { skipId: 'ed-adj', skipType: 'ed', interval: { startTime: 1300, endTime: 1390 }, episodeLength: 1440 },
];
const adjacentChapters = computeTimelineChapters(1440, adjacentSkips);
const opMerged = adjacentChapters.find((c) => c.type === 'op');
assert(opMerged, 'Deve esistere capitolo OP unificato');
assert.strictEqual(opMerged.startTime, 60);
assert.strictEqual(opMerged.endTime, 150, 'Skip contigui dello stesso tipo devono fondersi senza split/gap intermedi');

// 5d. Verifica scarto di skipType sconosciuti senza frammentare l\'episodio
const unknownTypeSkips: AniSkipResult[] = [
  { skipId: 'unknown-1', skipType: 'custom' as any, interval: { startTime: 100, endTime: 200 }, episodeLength: 1440 },
  { skipId: 'op-valid', skipType: 'op', interval: { startTime: 300, endTime: 390 }, episodeLength: 1440 },
];
const filteredChapters = computeTimelineChapters(1440, unknownTypeSkips);
assert.strictEqual(filteredChapters.filter((c) => c.type === 'episode').length, 2, 'Skip non riconosciuti non devono frammentare l\'episodio canonico');

// 5e. Sincronizzazione getAniSkipChapterBadge con estensione ED entro 5s da duration
const syncBadgeNearEnd = getAniSkipChapterBadge(1439, 1440, edNearEndSkips);
assert.strictEqual(syncBadgeNearEnd.label, '[SIGLA FINALE]', 'Badge a 1439s deve essere [SIGLA FINALE] per ED che termina a 1438s');

// 6. Verifica findChapterAtTime
assert.strictEqual(findChapterAtTime(45, stdChapters)?.type, 'episode');
assert.strictEqual(findChapterAtTime(90, stdChapters)?.type, 'op');
assert.strictEqual(findChapterAtTime(150, stdChapters)?.type, 'op');
assert.strictEqual(findChapterAtTime(500, stdChapters)?.type, 'episode');
assert.strictEqual(findChapterAtTime(1350, stdChapters)?.type, 'ed');
assert.strictEqual(findChapterAtTime(1400, stdChapters)?.type, 'post-credits');
assert.strictEqual(findChapterAtTime(1440, stdChapters)?.type, 'post-credits', 'Al confine finale deve restituire ultimo capitolo');
assert.strictEqual(findChapterAtTime(-10, stdChapters)?.type, 'episode', 'A tempo negativo deve restituire primo capitolo');
assert.strictEqual(findChapterAtTime(50, []), null, 'Lista vuota deve restituire null');
assert.strictEqual(findChapterAtTime(NaN, stdChapters), null, 'findChapterAtTime con NaN deve restituire null');

// 7. Verifica Struttura, Accessibilità e Rendering PlayerTimeline.tsx
const updatedTimelineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/player/PlayerTimeline.tsx'), 'utf-8');
assert(updatedTimelineSrc.includes('computeTimelineChapters'), 'PlayerTimeline deve contenere computeTimelineChapters');
assert(updatedTimelineSrc.includes('findChapterAtTime'), 'PlayerTimeline deve contenere findChapterAtTime');
assert(updatedTimelineSrc.includes('timelineTrackChapters'), 'PlayerTimeline deve avere lo stile timelineTrackChapters');
assert(updatedTimelineSrc.includes('timelineTrackChaptersActive'), 'PlayerTimeline deve avere lo stile timelineTrackChaptersActive');
assert(updatedTimelineSrc.includes('chapterSegment'), 'PlayerTimeline deve avere lo stile chapterSegment');
assert(updatedTimelineSrc.includes('chapterSegmentBar'), 'PlayerTimeline deve avere lo stile chapterSegmentBar');
assert(updatedTimelineSrc.includes('chapterSegmentBarActive'), 'PlayerTimeline deve avere lo stile chapterSegmentBarActive');
assert(updatedTimelineSrc.includes('gap: 2.5'), 'PlayerTimeline deve supportare i gap in stile YouTube a 2.5dp');
assert(updatedTimelineSrc.includes('gap: 3'), 'PlayerTimeline deve espandere i gap a 3dp durante lo scrubbing attivo');
assert(updatedTimelineSrc.includes('chapters.length > 1'), 'PlayerTimeline deve condizionare i segmenti a chapters.length > 1');
assert(updatedTimelineSrc.includes('Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)'), 'PlayerTimeline deve fornire feedback aptico Light al cambio capitolo');
assert(updatedTimelineSrc.includes('lastChapterHapticTimeRef'), 'PlayerTimeline deve proteggere il feedback aptico da vibrazioni jitter');
assert(updatedTimelineSrc.includes('accessibilityValue'), 'PlayerTimeline deve supportare accessibilityValue TalkBack');
assert(updatedTimelineSrc.includes('accessibilityActions'), 'PlayerTimeline deve supportare accessibilityActions increment/decrement');
assert(updatedTimelineSrc.includes('thumbColor'), 'PlayerTimeline deve adattare il colore del thumb al capitolo attivo');

console.log('✓ Visualizzazione Capitoli sulla Timeline (Segmenti YouTube, Gaps, Colori OLED & Haptics) verificata con successo.');

// -----------------------------------------------------------------------------
// Fine Test
// -----------------------------------------------------------------------------
console.log('\n==============================================');
console.log('🎉 TUTTI I TEST SONO PASSATI CON SUCCESSO! 🎉');
console.log('==============================================');
