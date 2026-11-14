import React from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  oledTheme,
  useTheme,
  applyThemeFamily,
  getContrastTextColor,
} from '@/theme';
import {
  AppStorage,
  type HistoryRetentionDays,
  type AniSkipSettings,
  type AniSkipMode,
  type NavBarMode,
} from '@/services/storage';
import { HistorySlider, SEARCH_RETENTION_STEPS } from '@/components/HistorySlider';
import { AniSkipSlider } from '@/components/AniSkipSlider';
import { AniSkipDurationSlider } from '@/components/AniSkipDurationSlider';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  settingsStyles as styles,
  ThemeSettingsCard,
  SourceSettingsCard,
  DownloadSettingsCard,
  SyncSettingsCard,
  QUICK_DOMAINS,
} from '@/components/settings';
import { DownloadService, type DownloadSettings, type StorageUsageInfo } from '@/services/downloads';
import { scraperConfig } from '@/services/scraper/config';
import {
  UpdaterService,
  UpdateStore,
  formatBytes,
  getDeviceSupportedAbis,
} from '@/services/updater';
import type { UpdateCheckResult, DownloadProgress } from '@/services/updater';
import { CURRENT_CHANGELOG, formatChangelog } from '@/constants/changelog';
import { useResponsiveLayout } from '@/hooks';

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const shouldScrollToUpdateRef = React.useRef(false);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useFocusEffect(
    React.useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
        return true;
      });
      return () => backSub.remove();
    }, [router])
  );

  const [activeTheme, setActiveTheme] = React.useState<string>(() => {
    const fam = AppStorage.getThemeFamily() || 'oled';
    return fam === 'default' ? 'oled' : fam;
  });

  const [activeMode, setActiveMode] = React.useState<'dark' | 'light'>(() => {
    const fam = AppStorage.getThemeFamily() || 'oled';
    const cleanFam = fam === 'default' ? 'oled' : fam;
    if (cleanFam === 'pikachu') return AppStorage.getPikachuMode() || 'dark';
    if (cleanFam === 'orchid') return AppStorage.getOrchidMode() || 'dark';
    if (cleanFam === 'rainbow') return AppStorage.getRainbowMode() || 'dark';
    return AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
  });

  const [selectedTld, setSelectedTld] = React.useState<string>(() => {
    const custom = AppStorage.getCustomDomain();
    if (custom) {
      try {
        const parsed = new URL(custom);
        const hostParts = parsed.hostname.split('.');
        const candidate = hostParts[hostParts.length - 1]?.toLowerCase();
        if (candidate && Array.isArray(QUICK_DOMAINS) && QUICK_DOMAINS.includes(candidate as any)) {
          return candidate;
        }
        return '';
      } catch {
        return '';
      }
    }
    return AppStorage.getTld();
  });

  const [customUrl, setCustomUrl] = React.useState<string>(() => {
    const customDomain = AppStorage.getCustomDomain();
    if (customDomain) {
      return customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
    }
    return scraperConfig.getBaseUrl();
  });

  // Inline feedback for source updates (no Alert.alert)
  const [sourceNotice, setSourceNotice] = React.useState<string | null>(null);

  // History settings state
  const [historyRetention, setHistoryRetention] = React.useState<HistoryRetentionDays>(() => {
    return AppStorage.getHistoryRetentionDays();
  });
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = React.useState(false);
  const [historyNotice, setHistoryNotice] = React.useState<string | null>(null);

  // Download settings state
  const [downloadSettings, setDownloadSettings] = React.useState<DownloadSettings>(() => {
    return DownloadService.getSettings();
  });
  const [storageInfo, setStorageInfo] = React.useState<StorageUsageInfo>({
    appDownloadsBytes: 0,
    appDownloadsFormatted: '0 B',
  });
  const [isClearAllDownloadsConfirmOpen, setIsClearAllDownloadsConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    const unsubSettings = DownloadService.addSettingsListener((s) => {
      setDownloadSettings(s);
    });
    const unsubList = DownloadService.addListListener(() => {
      DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    });
    return () => {
      unsubSettings();
      unsubList();
    };
  }, []);

  // AniSkip settings state
  const [aniSkipSettings, setAniSkipSettings] = React.useState<AniSkipSettings>(() => {
    return AppStorage.getAniSkipSettings();
  });

  const handleUpdateAniSkipMode = (mode: AniSkipMode) => {
    Haptics.selectionAsync().catch(() => {});
    let newSettings: Partial<AniSkipSettings> = { mode };
    if (mode !== 'disabled') {
      const hasAnyActive =
        aniSkipSettings.enableOpening ||
        aniSkipSettings.enableEnding ||
        aniSkipSettings.enableRecap;
      if (!hasAnyActive) {
        newSettings = {
          mode,
          enableOpening: true,
          enableEnding: true,
          enableRecap: true,
        };
      }
    }
    const updated = AppStorage.saveAniSkipSettings(newSettings);
    setAniSkipSettings(updated);
  };

  const handleToggleAniSkipType = (key: 'enableOpening' | 'enableEnding' | 'enableRecap') => {
    Haptics.selectionAsync().catch(() => {});
    const nextVal = !aniSkipSettings[key];
    const newSettings = {
      ...aniSkipSettings,
      [key]: nextVal,
    };

    const hasAnyActive =
      newSettings.enableOpening ||
      newSettings.enableEnding ||
      newSettings.enableRecap;

    if (!hasAnyActive) {
      newSettings.mode = 'disabled';
    }

    const updated = AppStorage.saveAniSkipSettings(newSettings);
    setAniSkipSettings(updated);
  };

  const handleUpdateAniSkipDuration = (duration: number) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = AppStorage.saveAniSkipSettings({ buttonDuration: duration });
    setAniSkipSettings(updated);
  };

  // System Navigation Bar state
  const [navBarMode, setNavBarMode] = React.useState<NavBarMode>(() => {
    return AppStorage.getNavBarMode();
  });

  const handleUpdateNavBarMode = (mode: NavBarMode) => {
    Haptics.selectionAsync().catch(() => {});
    AppStorage.setNavBarMode(mode);
    setNavBarMode(mode);
  };

  const showHistoryNotice = (msg: string) => {
    setHistoryNotice(msg);
    setTimeout(() => {
      setHistoryNotice(null);
    }, 4000);
  };

  const handleChangeHistoryRetention = (days: HistoryRetentionDays) => {
    setHistoryRetention(days);
    AppStorage.setHistoryRetentionDays(days);
    if (days === -1) {
      showHistoryNotice('CRONOLOGIA DISATTIVATA (NASCOSTA DAI TAB)');
    } else if (days === 0) {
      showHistoryNotice('CRONOLOGIA SENZA SCADENZA (ATTIVA)');
    } else {
      showHistoryNotice(`CONSERVAZIONE IMPOSTATA A ${days} GIORNI`);
    }
  };

  const handleConfirmClearHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AppStorage.clearWatchHistory();
    setIsClearHistoryConfirmOpen(false);
    showHistoryNotice('CRONOLOGIA COMPLETAMENTE CANCELLATA');
  };

  // Search History settings state
  const [searchHistoryRetention, setSearchHistoryRetention] = React.useState<HistoryRetentionDays>(() => {
    return AppStorage.getSearchHistoryRetentionDays();
  });
  const [isClearSearchHistoryConfirmOpen, setIsClearSearchHistoryConfirmOpen] = React.useState(false);
  const [searchHistoryNotice, setSearchHistoryNotice] = React.useState<string | null>(null);

  const showSearchHistoryNotice = (msg: string) => {
    setSearchHistoryNotice(msg);
    setTimeout(() => {
      setSearchHistoryNotice(null);
    }, 4000);
  };

  const handleChangeSearchHistoryRetention = (days: HistoryRetentionDays) => {
    setSearchHistoryRetention(days);
    AppStorage.setSearchHistoryRetentionDays(days);
    if (days === -1) {
      showSearchHistoryNotice('CRONOLOGIA DI RICERCA DISATTIVATA');
    } else if (days === 0) {
      showSearchHistoryNotice('CRONOLOGIA DI RICERCA SENZA SCADENZA (ATTIVA)');
    } else {
      showSearchHistoryNotice(`CONSERVAZIONE RICERCHE IMPOSTATA A ${days} GIORNI`);
    }
  };

  const handleConfirmClearSearchHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AppStorage.clearSearchHistory();
    setIsClearSearchHistoryConfirmOpen(false);
    showSearchHistoryNotice('CRONOLOGIA RICERCHE CANCELLATA CON SUCCESSO');
  };

  const handleChangeDownloadDirectory = async () => {
    await DownloadService.requestCustomDirectoryPermissions();
  };

  const handleResetDownloadDirectory = () => {
    DownloadService.setCustomDirectoryUri(null);
  };

  const handleToggleWifiOnly = (enabled: boolean) => {
    DownloadService.setWifiOnly(enabled);
  };

  // OTA state (strictly in-app, zero native Alert dialogs)
  const [updateStatus, setUpdateStatus] = React.useState<
    'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error'
  >('idle');
  const [updateResult, setUpdateResult] = React.useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState<DownloadProgress | null>(null);
  const [downloadedApkUri, setDownloadedApkUri] = React.useState<string | null>(null);

  // Changelog active view tab: 'new' | 'current'
  const [changelogTab, setChangelogTab] = React.useState<'new' | 'current'>('current');

  const showSourceNotice = (msg: string) => {
    setSourceNotice(msg);
    setTimeout(() => {
      setSourceNotice(null);
    }, 4000);
  };

  const handleSelectTheme = (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (activeTheme === themeId) {
      // Re-clicking the active theme button: INVERT between Dark and Light!
      const newMode: 'dark' | 'light' = activeMode === 'dark' ? 'light' : 'dark';
      setActiveMode(newMode);
      if (themeId === 'pikachu') {
        AppStorage.setPikachuMode(newMode);
      } else if (themeId === 'orchid') {
        AppStorage.setOrchidMode(newMode);
      } else if (themeId === 'rainbow') {
        AppStorage.setRainbowMode(newMode);
      } else {
        AppStorage.setThemeMode(newMode === 'light' ? 'light' : 'oled');
      }
      applyThemeFamily(themeId, newMode);
    } else {
      // Switching to a different theme: load saved mode for that family
      let targetMode: 'dark' | 'light' = 'dark';
      if (themeId === 'pikachu') {
        targetMode = AppStorage.getPikachuMode() || 'dark';
      } else if (themeId === 'orchid') {
        targetMode = AppStorage.getOrchidMode() || 'dark';
      } else if (themeId === 'rainbow') {
        targetMode = AppStorage.getRainbowMode() || 'dark';
      } else {
        targetMode = AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
      }
      setActiveTheme(themeId);
      setActiveMode(targetMode);
      AppStorage.setThemeFamily(themeId as any);
      applyThemeFamily(themeId, targetMode);
    }
  };

  const handleSelectQuickDomain = (tld: string) => {
    Haptics.selectionAsync().catch(() => {});
    const clean = tld.replace(/^\.+/, '').trim().toLowerCase();
    setSelectedTld(clean);
    const newBase = `https://www.animeworld.${clean}`;
    setCustomUrl(newBase);
    AppStorage.setTld(clean);
    showSourceNotice(`SORGENTE AGGIORNATA: .${clean.toUpperCase()}`);
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Check if user entered just a TLD or full domain/URL
    if (typeof trimmed === 'string' && !trimmed.includes('.') && !trimmed.includes('/')) {
      const cleanTld = trimmed.toLowerCase();
      setSelectedTld(cleanTld);
      AppStorage.setTld(cleanTld);
      setCustomUrl(`https://www.animeworld.${cleanTld}`);
      showSourceNotice(`SORGENTE AGGIORNATA: .${cleanTld.toUpperCase()}`);
      return;
    }

    const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(fullUrl);
      const hostParts = parsed.hostname.split('.');
      const tldCandidate = hostParts[hostParts.length - 1]?.toLowerCase();
      if (tldCandidate && Array.isArray(QUICK_DOMAINS) && QUICK_DOMAINS.includes(tldCandidate as any)) {
        setSelectedTld(tldCandidate);
      } else {
        setSelectedTld('');
      }
    } catch {
      setSelectedTld('');
    }

    AppStorage.setCustomDomain(fullUrl);
    setCustomUrl(fullUrl);
    showSourceNotice(`URL SORGENTE IMPOSTATO: ${fullUrl.toUpperCase()}`);
  };

  const handleStartDownloadUpdate = React.useCallback(async (manifestOverride?: any) => {
    // Only accept manifestOverride if it is a valid UpdateManifest object (guards against Pressable event objects)
    const isManifest = (m: any): boolean =>
      Boolean(
        m &&
        typeof m === 'object' &&
        typeof m.version === 'string' &&
        typeof m.versionCode === 'number' &&
        (typeof m.apkUrl === 'string' || typeof m.apks === 'object')
      );

    const targetManifest = isManifest(manifestOverride)
      ? manifestOverride
      : (isManifest(updateResult?.manifest)
          ? updateResult?.manifest
          : UpdateStore.getPendingUpdate()?.manifest);

    if (!targetManifest || typeof targetManifest !== 'object') {
      setUpdateStatus('error');
      setUpdateError('MANIFEST DI AGGIORNAMENTO NON DISPONIBILE');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setUpdateStatus('downloading');
    setDownloadProgress(null);
    setUpdateError(null);

    try {
      const apkUri = await UpdaterService.downloadApk(
        targetManifest,
        (progress: DownloadProgress) => {
          setDownloadProgress(progress);
        }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDownloadedApkUri(apkUri);
      setUpdateStatus('downloaded');
      UpdateStore.clearUpdate();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setUpdateStatus('error');
      setUpdateError((err?.message || 'DOWNLOAD INTERROTTO').toUpperCase());
    }
  }, [updateResult]);

  const scrollToUpdateSection = React.useCallback(() => {
    shouldScrollToUpdateRef.current = true;
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 600);
    setTimeout(() => {
      shouldScrollToUpdateRef.current = false;
    }, 1500);
  }, []);

  const downloadSectionYRef = React.useRef<number>(0);

  const scrollToDownloadsSection = React.useCallback(() => {
    setTimeout(() => {
      if (downloadSectionYRef.current > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, downloadSectionYRef.current - 16), animated: true });
      }
    }, 100);
    setTimeout(() => {
      if (downloadSectionYRef.current > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, downloadSectionYRef.current - 16), animated: true });
      }
    }, 350);
  }, []);

  // Handle auto-download from startup modal or pending update synchronization
  useFocusEffect(
    React.useCallback(() => {
      const isAuto = UpdateStore.isAutoDownloadRequested();
      const shouldScroll = isAuto || params.scrollTo === 'update';
      const shouldScrollDownloads = params.scrollTo === 'downloads';

      if (isAuto) {
        UpdateStore.setAutoDownloadRequested(false);
        const pending = UpdateStore.getPendingUpdate();
        if (pending && pending.isUpdateAvailable && pending.manifest) {
          setUpdateResult(pending);
          setUpdateStatus('available');
          setChangelogTab('new');
          handleStartDownloadUpdate(pending.manifest);
        }
      } else {
        const pending = UpdateStore.getPendingUpdate();
        if (pending && pending.isUpdateAvailable && pending.manifest) {
          setUpdateResult((prev) => prev || pending);
          setUpdateStatus((prev) => (prev === 'idle' || prev === 'error' ? 'available' : prev));
        }
      }

      if (shouldScrollDownloads) {
        scrollToDownloadsSection();
      } else if (shouldScroll) {
        scrollToUpdateSection();
      }
    }, [handleStartDownloadUpdate, params.scrollTo, scrollToDownloadsSection, scrollToUpdateSection])
  );

  const handleCheckUpdates = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setUpdateStatus('checking');
    setUpdateError(null);
    setDownloadedApkUri(null);

    try {
      const result = await UpdaterService.checkForUpdates();
      setUpdateResult(result);

      if (result.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setUpdateStatus('error');
        setUpdateError(result.error.toUpperCase());
        return;
      }

      if (result.isUpdateAvailable) {
        UpdateStore.setPendingUpdate(result);
        UpdateStore.dismissModal(); // User is already in Settings, avoid redundant popup
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setUpdateStatus('available');
        setChangelogTab('new'); // Automatically switch changelog tab to preview new version
      } else {
        UpdateStore.clearUpdate();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setUpdateStatus('up-to-date');
        setChangelogTab('current');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setUpdateStatus('error');
      setUpdateError((err?.message || 'IMPOSSIBILE VERIFICARE GLI AGGIORNAMENTI').toUpperCase());
    }
  };

  const handleInstallApk = () => {
    if (!downloadedApkUri) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    UpdateStore.clearUpdate();
    UpdaterService.installApk(downloadedApkUri);
  };

  const currentAbi = (getDeviceSupportedAbis()[0] || 'arm64-v8a').toUpperCase();
  const currentVersion = UpdaterService.getCurrentVersion();
  const currentVersionCode = UpdaterService.getCurrentVersionCode();
  const hasUpdateFound = Boolean(updateResult?.isUpdateAvailable && updateResult?.manifest);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* App Bar */}
      <View
        style={[
          styles.appBar,
          { borderBottomColor: theme.colors.border },
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
      >
        <Text style={[styles.appBarTitle, { color: theme.colors.text }]}>IMPOSTAZIONI</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (shouldScrollToUpdateRef.current) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        {/* TEMA (con invertibilità chiaro/scuro al click) */}
        <ThemeSettingsCard
          activeTheme={activeTheme}
          activeMode={activeMode}
          onSelectTheme={handleSelectTheme}
          theme={theme}
          primaryContrast={primaryContrast}
        />

        {/* CRONOLOGIA (Slider durata conservazione & cancellazione comoda) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>CRONOLOGIA</Text>

          <HistorySlider
            value={historyRetention}
            onChange={handleChangeHistoryRetention}
            theme={theme}
          />

          {/* Pulsante per cancellare comodamente la cronologia */}
          <Pressable
            style={[
              styles.clearHistoryBtn,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsClearHistoryConfirmOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA CRONOLOGIA"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error || '#EF4444'} />
            <Text style={[styles.clearHistoryBtnText, { color: theme.colors.error || '#EF4444' }]}>
              CANCELLA TUTTA LA CRONOLOGIA
            </Text>
          </Pressable>

          {historyNotice ? (
            <View
              style={[
                styles.sourceNoticeBox,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                  marginTop: 10,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={[styles.sourceNoticeText, { color: theme.colors.primary }]}>
                {historyNotice}
              </Text>
            </View>
          ) : null}
        </View>

        {/* CRONOLOGIA DI RICERCA (Google Style search history retention & clear) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>CRONOLOGIA DI RICERCA</Text>

          <HistorySlider
            value={searchHistoryRetention}
            onChange={handleChangeSearchHistoryRetention}
            theme={theme}
            steps={SEARCH_RETENTION_STEPS}
          />

          <Pressable
            style={[
              styles.clearHistoryBtn,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsClearSearchHistoryConfirmOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA CRONOLOGIA RICERCHE"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error || '#EF4444'} />
            <Text style={[styles.clearHistoryBtnText, { color: theme.colors.error || '#EF4444' }]}>
              CANCELLA TUTTA LA CRONOLOGIA RICERCHE
            </Text>
          </Pressable>

          {searchHistoryNotice ? (
            <View
              style={[
                styles.sourceNoticeBox,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                  marginTop: 10,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={[styles.sourceNoticeText, { color: theme.colors.primary }]}>
                {searchHistoryNotice}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ANISKIP (Salto automatico o manuale, selezione sezioni) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>ANISKIP</Text>

          <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
            MODALITÀ DI SALTO
          </Text>
          <AniSkipSlider
            value={aniSkipSettings.mode}
            onChange={handleUpdateAniSkipMode}
            theme={theme}
            settings={aniSkipSettings}
          />

          {aniSkipSettings.mode === 'manual' && (
            <>
              <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginTop: 14, marginBottom: 8 }]}>
                DURATA PULSANTI ANISKIP
              </Text>
              <AniSkipDurationSlider
                value={aniSkipSettings.buttonDuration ?? 10}
                onChange={handleUpdateAniSkipDuration}
                theme={theme}
              />
            </>
          )}

          {aniSkipSettings.mode !== 'disabled' && (
            <>
              <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginTop: 14 }]}>
                COSA SALTARE
              </Text>
              <View style={styles.aniskipRow}>
                {[
                  { key: 'enableOpening' as const, label: 'INTRO' },
                  { key: 'enableRecap' as const, label: 'RECAP' },
                  { key: 'enableEnding' as const, label: 'OUTRO' },
                ].map((item) => {
                  const active = aniSkipSettings[item.key];
                  const contrastColor = active ? getContrastTextColor(theme.colors.primary) : theme.colors.text;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.aniskipChip,
                        {
                          backgroundColor: active ? theme.colors.primary : theme.colors.card,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => handleToggleAniSkipType(item.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`SALTA ${item.label}: ${active ? 'ATTIVO' : 'DISATTIVATO'}`}
                    >
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={contrastColor}
                      />
                      <Text
                        style={[
                          styles.aniskipChipText,
                          { color: contrastColor },
                          active && styles.aniskipChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* NAVBAR DI SISTEMA ANDROID */}
        {Platform.OS === 'android' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>NAVBAR DI SISTEMA</Text>
            <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary }]}>
              COMPORTAMENTO BARRA ANDROID
            </Text>
            <View style={styles.navBarRow}>
              {[
                {
                  mode: 'auto-hide' as NavBarMode,
                  label: 'NASCONDI (SWIPE)',
                },
                {
                  mode: 'visible' as NavBarMode,
                  label: 'SEMPRE VISIBILE',
                },
              ].map((item) => {
                const active = navBarMode === item.mode;
                const contrastColor = active ? getContrastTextColor(theme.colors.primary) : theme.colors.text;
                return (
                  <Pressable
                    key={item.mode}
                    style={[
                      styles.navBarChip,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.card,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleUpdateNavBarMode(item.mode)}
                    accessibilityRole="button"
                    accessibilityLabel={`NAVBAR ${item.label}${active ? ' ATTIVA' : ''}`}
                  >
                    <Ionicons
                      name={item.mode === 'auto-hide' ? 'phone-portrait-outline' : 'ellipsis-horizontal'}
                      size={15}
                      color={contrastColor}
                    />
                    <Text
                      style={[
                        styles.navBarChipText,
                        { color: contrastColor },
                        active && styles.navBarChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.navBarHelpText, { color: theme.colors.textMuted }]}>
              {navBarMode === 'auto-hide'
                ? 'A SCOMPARSA, RICHIAMABILE CON SWIPE DAL BASSO.'
                : 'SEMPRE FISSA E VISIBILE IN-APP.'}
            </Text>
          </View>
        )}

        {/* SORGENTE (.ac, .so, .tv o scrivibile a mano) */}
        <SourceSettingsCard
          selectedTld={selectedTld}
          customUrl={customUrl}
          onChangeCustomUrl={setCustomUrl}
          onSelectQuickDomain={handleSelectQuickDomain}
          onApplyCustomUrl={handleApplyCustomUrl}
          sourceNotice={sourceNotice}
          theme={theme}
        />

        {/* DOWNLOAD & STORAGE */}
        <View
          onLayout={(e) => {
            downloadSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <DownloadSettingsCard
            settings={downloadSettings}
            storageInfo={storageInfo}
            onChangeDirectory={handleChangeDownloadDirectory}
            onResetDirectory={handleResetDownloadDirectory}
            onToggleWifiOnly={handleToggleWifiOnly}
            onClearAllDownloads={() => setIsClearAllDownloadsConfirmOpen(true)}
            onOpenDownloadsScreen={() => router.push('/downloads' as any)}
          />
        </View>

        {/* KUROSYNC (SINCRONIZZAZIONE SELF-HOSTED CON KUROTV_S & ANDROID TV) */}
        <SyncSettingsCard theme={theme} />

        {/* INFORMAZIONI, CHANGELOG & UPDATER INTEGRATO */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>INFORMAZIONI</Text>

          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>NOME</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>KUROTV MOBILE</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>STACK</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>EXPO SDK 58 (RN 0.88)</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>PACKAGE</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>com.kurotv.mobile</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>VERSIONE</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              V{currentVersion} (BUILD {currentVersionCode})
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>ARCHITETTURA</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>{currentAbi}</Text>
          </View>

          {/* SEZIONE CHANGELOG (SEMPRE VISIONABILE: CORRENTE O FUTURO) */}
          <View style={[styles.changelogCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.changelogHeader}>
              <View style={styles.changelogTitleRow}>
                <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} />
                <Text style={[styles.changelogTitle, { color: theme.colors.text }]}>
                  {hasUpdateFound && changelogTab === 'new'
                    ? `CHANGELOG V${updateResult?.manifest?.version} (FUTURO)`
                    : `CHANGELOG V${currentVersion} (CORRENTE)`}
                </Text>
              </View>

              {hasUpdateFound ? (
                <View style={styles.changelogTabSwitch}>
                  <Pressable
                    style={[
                      styles.changelogTabBtn,
                      changelogTab === 'new' && [styles.changelogTabBtnActive, { backgroundColor: theme.colors.primary }],
                    ]}
                    onPress={() => setChangelogTab('new')}
                  >
                    <Text
                      style={[
                        styles.changelogTabBtnText,
                        changelogTab === 'new' && [styles.changelogTabBtnTextActive, { color: primaryContrast }],
                      ]}
                    >
                      NUOVA V{updateResult?.manifest?.version}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.changelogTabBtn,
                      changelogTab === 'current' && [styles.changelogTabBtnActive, { backgroundColor: theme.colors.primary }],
                    ]}
                    onPress={() => setChangelogTab('current')}
                  >
                    <Text
                      style={[
                        styles.changelogTabBtnText,
                        changelogTab === 'current' && [styles.changelogTabBtnTextActive, { color: primaryContrast }],
                      ]}
                    >
                      CORRENTE
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={[styles.changelogContentBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              contentContainerStyle={styles.changelogScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.changelogText, { color: theme.colors.textSecondary }]}>
                {hasUpdateFound && changelogTab === 'new'
                  ? (updateResult?.manifest?.releaseNotes
                      ? updateResult.manifest.releaseNotes.toUpperCase()
                      : 'NESSUNA NOTA DI RILASCIO DISPONIBILE.')
                  : formatChangelog(CURRENT_CHANGELOG)}
              </Text>
            </ScrollView>
          </View>

          {/* SEZIONE AGGIORNAMENTO IN-APP INTEGRATO (ZERO ALERT.ALERT) */}
          <View style={styles.updateContainer}>
            {updateStatus === 'checking' ? (
              <View style={[styles.inlineStatusBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.inlineStatusText, { color: theme.colors.text }]}>
                  VERIFICA AGGIORNAMENTI IN CORSO...
                </Text>
              </View>
            ) : updateStatus === 'up-to-date' ? (
              <Pressable
                style={[styles.upToDateRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={handleCheckUpdates}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="APP AGGIORNATA. TOCCA PER RIVERIFICARE"
              >
                <View style={styles.upToDateLeft}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <Text style={[styles.upToDateText, { color: theme.colors.textSecondary }]}>
                    APP AGGIORNATA
                  </Text>
                </View>
                <Ionicons name="refresh" size={14} color={theme.colors.textMuted} />
              </Pressable>
            ) : updateStatus === 'available' ? (
              <View style={[styles.updateAvailableBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}>
                <View style={styles.updateBadgeRow}>
                  <Ionicons name="arrow-up-circle" size={20} color={theme.colors.primary} />
                  <Text style={[styles.updateAvailableTitle, { color: theme.colors.text }]}>
                    NUOVO AGGIORNAMENTO DISPONIBILE: V{updateResult?.manifest?.version} (BUILD {updateResult?.manifest?.versionCode})
                  </Text>
                </View>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleStartDownloadUpdate()}
                >
                  <Ionicons name="download-outline" size={18} color={primaryContrast} />
                  <Text style={[styles.actionBtnText, { color: primaryContrast }]}>SCARICA E INSTALLA</Text>
                </Pressable>
              </View>
            ) : updateStatus === 'downloading' ? (
              <View style={[styles.downloadProgressWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.downloadProgressText, { color: theme.colors.text }]}>
                  SCARICAMENTO APK: {downloadProgress?.percentage || 0}%
                </Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${downloadProgress?.percentage || 0}%`,
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  />
                </View>
                {downloadProgress && (
                  <Text style={[styles.bytesText, { color: theme.colors.textMuted }]}>
                    {formatBytes(downloadProgress.totalBytesWritten)} /{' '}
                    {formatBytes(downloadProgress.totalBytesExpectedToWrite)}
                  </Text>
                )}
              </View>
            ) : updateStatus === 'downloaded' ? (
              <View style={[styles.inlineStatusBox, { backgroundColor: `${theme.colors.success}18`, borderColor: theme.colors.success }]}>
                <View style={styles.inlineStatusRow}>
                  <Ionicons name="checkmark-done-circle" size={20} color={theme.colors.success} />
                  <Text style={[styles.inlineStatusText, { color: theme.colors.success, flex: 1, fontWeight: '800' }]}>
                    APK SCARICATO CON SUCCESSO!
                  </Text>
                </View>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.colors.primary, marginTop: 8 }]}
                  onPress={handleInstallApk}
                >
                  <Ionicons name="flash" size={18} color={primaryContrast} />
                  <Text style={[styles.actionBtnText, { color: primaryContrast }]}>INSTALLA ORA</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallActionBtn, { borderColor: theme.colors.border, marginTop: 6 }]}
                  onPress={handleCheckUpdates}
                >
                  <Ionicons name="refresh" size={13} color={theme.colors.textMuted} />
                  <Text style={[styles.smallActionBtnText, { color: theme.colors.textMuted }]}>VERIFICA NUOVAMENTE</Text>
                </Pressable>
              </View>
            ) : updateStatus === 'error' ? (
              <View style={[styles.inlineStatusBox, { backgroundColor: `${theme.colors.error || oledTheme.colors.error}18`, borderColor: theme.colors.error || oledTheme.colors.error }]}>
                <View style={styles.inlineStatusRow}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error || oledTheme.colors.error} />
                  <Text style={[styles.inlineStatusText, { color: theme.colors.error || oledTheme.colors.error, flex: 1 }]}>
                    {updateError || 'ERRORE DURANTE LA VERIFICA DEGLI AGGIORNAMENTI'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.smallActionBtn, { borderColor: theme.colors.error || oledTheme.colors.error, marginTop: 6 }]}
                  onPress={handleCheckUpdates}
                >
                  <Ionicons name="refresh" size={13} color={theme.colors.error || oledTheme.colors.error} />
                  <Text style={[styles.smallActionBtnText, { color: theme.colors.error || oledTheme.colors.error }]}>RIPROVA</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleCheckUpdates}
              >
                <Ionicons name="cloud-download-outline" size={18} color={primaryContrast} />
                <Text style={[styles.actionBtnText, { color: primaryContrast }]}>VERIFICA AGGIORNAMENTI</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal di Conferma Svuota Cronologia Integrato nella UI */}
      <ConfirmModal
        visible={isClearHistoryConfirmOpen}
        title="SVUOTA CRONOLOGIA"
        message="VUOI DAVVERO CANCELLARE TUTTA LA CRONOLOGIA DI VISIONE? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="CANCELLA TUTTO"
        onConfirm={handleConfirmClearHistory}
        onCancel={() => setIsClearHistoryConfirmOpen(false)}
      />

      {/* Modal di Conferma Svuota Cronologia Ricerche */}
      <ConfirmModal
        visible={isClearSearchHistoryConfirmOpen}
        title="SVUOTA CRONOLOGIA RICERCHE"
        message="VUOI DAVVERO CANCELLARE TUTTE LE RICERCHE RECENTI? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="CANCELLA TUTTO"
        onConfirm={handleConfirmClearSearchHistory}
        onCancel={() => setIsClearSearchHistoryConfirmOpen(false)}
      />

      {/* Modal di Conferma Svuota Tutti i Download */}
      <ConfirmModal
        visible={isClearAllDownloadsConfirmOpen}
        title="SVUOTA SCARICATI"
        message="VUOI ELIMINARE TUTTI GLI EPISODI SCARICATI? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="SVUOTA"
        onConfirm={() => {
          DownloadService.clearAllDownloads();
          setIsClearAllDownloadsConfirmOpen(false);
        }}
        onCancel={() => setIsClearAllDownloadsConfirmOpen(false)}
      />
    </View>
  );
}
