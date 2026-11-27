import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import {
  AppStorage,
  type HistoryRetentionDays,
  type AniSkipSettings,
  type NavBarMode,
  type PlayerTapDelayMs,
} from '@/services/storage';
import { SyncManager, type SyncStatus } from '@/services/sync';
import { MalAuthService, addMalDataListener, type MalAuthStatus } from '@/services/mal';
import { DownloadService, type DownloadSettings, type StorageUsageInfo } from '@/services/downloads';
import { UpdaterService, UpdateStore, usePendingUpdate } from '@/services/updater';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  SettingsCategoryRow,
  SyncProfileModal,
  SyncConnectModal,
  settingsStyles as styles,
} from '@/components/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ scrollTo?: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const { update } = usePendingUpdate();

  // Android hardware back press: return to home tab if at the root of settings
  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          (navigation as any).navigate('index');
          router.replace('/(tabs)');
        }
        return true;
      });
      return () => backSub.remove();
    }, [router, navigation])
  );

  // Deep-link & auto-download retrocompatibility redirection
  const scrollToDownloadsSection = useCallback(() => {
    (navigation as any).setParams?.({ scrollTo: undefined });
    router.setParams({ scrollTo: '' as any });
    router.push('/settings/downloads' as any);
  }, [navigation, router]);

  useFocusEffect(
    useCallback(() => {
      if (params.scrollTo === 'downloads') {
        scrollToDownloadsSection();
      } else if (params.scrollTo === 'update' || UpdateStore.isAutoDownloadRequested()) {
        const isAuto = UpdateStore.isAutoDownloadRequested();
        (navigation as any).setParams?.({ scrollTo: undefined });
        router.setParams({ scrollTo: '' as any });
        router.push({
          pathname: '/settings/about',
          params: isAuto ? { autoDownload: 'true', scrollTo: 'update' } : { scrollTo: 'update' },
        } as any);
      }
    }, [params.scrollTo, navigation, router, scrollToDownloadsSection])
  );

  // --------------------------------------------------------------------------
  // Synchronous State Snapshots from Storage & Services (Refreshed on Focus)
  // --------------------------------------------------------------------------
  const [themeFamily, setThemeFamily] = useState<string>(() => AppStorage.getThemeFamily() || 'oled');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    const fam = AppStorage.getThemeFamily() || 'oled';
    const cleanFam = fam === 'default' ? 'oled' : fam;
    if (cleanFam === 'pikachu') return AppStorage.getPikachuMode() || 'dark';
    if (cleanFam === 'orchid') return AppStorage.getOrchidMode() || 'dark';
    if (cleanFam === 'rainbow') return AppStorage.getRainbowMode() || 'dark';
    return AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
  });
  const [navBarMode, setNavBarMode] = useState<NavBarMode>(() => AppStorage.getNavBarMode());
  const [aniSkipSettings, setAniSkipSettings] = useState<AniSkipSettings>(() => AppStorage.getAniSkipSettings());
  const [playerTapDelayMs, setPlayerTapDelayMs] = useState<PlayerTapDelayMs>(() => AppStorage.getPlayerTapDelayMs());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => SyncManager.getStatus());
  const [malStatus, setMalStatus] = useState<MalAuthStatus>(() => MalAuthService.getStatus());
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings>(() => DownloadService.getSettings());
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo>({
    appDownloadsBytes: 0,
    appDownloadsFormatted: '0 B',
  });
  const [watchRetention, setWatchRetention] = useState<HistoryRetentionDays>(() => AppStorage.getHistoryRetentionDays());
  const [searchRetention, setSearchRetention] = useState<HistoryRetentionDays>(() => AppStorage.getSearchHistoryRetentionDays());
  const [sourceDomain, setSourceDomain] = useState<string>(() => {
    const custom = AppStorage.getCustomDomain();
    if (custom) {
      try {
        const u = new URL(custom);
        return u.hostname;
      } catch {
        return custom;
      }
    }
    return `animeworld.${AppStorage.getTld() || 'ac'}`;
  });

  // Modals state for rapid hero card actions
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Refresh dynamic states on screen focus so subtitles update in real-time
  useFocusEffect(
    useCallback(() => {
      const fam = AppStorage.getThemeFamily() || 'oled';
      const cleanFam = fam === 'default' ? 'oled' : fam;
      setThemeFamily(cleanFam);
      if (cleanFam === 'pikachu') setThemeMode(AppStorage.getPikachuMode() || 'dark');
      else if (cleanFam === 'orchid') setThemeMode(AppStorage.getOrchidMode() || 'dark');
      else if (cleanFam === 'rainbow') setThemeMode(AppStorage.getRainbowMode() || 'dark');
      else setThemeMode(AppStorage.getThemeMode() === 'light' ? 'light' : 'dark');

      setNavBarMode(AppStorage.getNavBarMode());
      setAniSkipSettings(AppStorage.getAniSkipSettings());
      setPlayerTapDelayMs(AppStorage.getPlayerTapDelayMs());
      setSyncStatus(SyncManager.getStatus());
      setMalStatus(MalAuthService.getStatus());
      setDownloadSettings(DownloadService.getSettings());
      setWatchRetention(AppStorage.getHistoryRetentionDays());
      setSearchRetention(AppStorage.getSearchHistoryRetentionDays());

      const custom = AppStorage.getCustomDomain();
      if (custom) {
        try {
          const u = new URL(custom);
          setSourceDomain(u.hostname);
        } catch {
          setSourceDomain(custom);
        }
      } else {
        setSourceDomain(`animeworld.${AppStorage.getTld() || 'ac'}`);
      }

      DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    }, [])
  );

  // Live event listeners for settings & sync changes
  useEffect(() => {
    const unsubSync = SyncManager.addSyncListener(setSyncStatus);
    const unsubMal = addMalDataListener(() => {
      setMalStatus(MalAuthService.getStatus());
    });
    const unsubDownloads = DownloadService.addSettingsListener(setDownloadSettings);
    const unsubDownloadList = DownloadService.addListListener(() => {
      DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    });
    const unsubStorage = AppStorage.addSettingsListener(() => {
      setNavBarMode(AppStorage.getNavBarMode());
      setAniSkipSettings(AppStorage.getAniSkipSettings());
      setPlayerTapDelayMs(AppStorage.getPlayerTapDelayMs());
    });

    return () => {
      unsubSync();
      unsubMal();
      unsubDownloads();
      unsubDownloadList();
      unsubStorage();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Formatted Subtitles for Glanceability
  // --------------------------------------------------------------------------
  const appearanceSubtitle = `${themeFamily.toUpperCase()} • NAVBAR ${navBarMode === 'auto-hide' ? 'AUTO' : 'FISSA'}`;

  const aniskipLabel =
    aniSkipSettings.mode === 'auto'
      ? 'ANISKIP AUTOMATICO'
      : aniSkipSettings.mode === 'manual'
        ? `ANISKIP MANUALE (${aniSkipSettings.buttonDuration ?? 10}S)`
        : 'ANISKIP DISATTIVATO';
  const tapDelayLabel = playerTapDelayMs === 0 ? 'TAP OFF' : `TAP ${playerTapDelayMs}MS`;
  const playbackSubtitle = `${aniskipLabel} • ${tapDelayLabel}`;

  const syncSubtitle = syncStatus.isConnected
    ? `CONNESSO • ${(syncStatus.profileName || 'PRINCIPALE').toUpperCase()}`
    : 'NON CONNESSO';

  const malSubtitle = malStatus.isConnected
    ? `CONNESSO • @${(malStatus.username || 'UTENTE').toUpperCase()}${malStatus.isKuroSyncLinked ? ` • ${(malStatus.kuroSyncProfileName || 'KUROSYNC').toUpperCase()}` : ''}`
    : malStatus.isKuroSyncLinked
    ? `NON CONNESSO • ${(malStatus.kuroSyncProfileName || 'PRINCIPALE').toUpperCase()}`
    : 'NON CONNESSO • LISTE & SYNC';

  const downloadSubtitle = `${storageInfo.appDownloadsFormatted} OCCUPATI • SOLO WI-FI: ${downloadSettings.wifiOnly ? 'ON' : 'OFF'}`;

  const sourceSubtitle = `${sourceDomain.toUpperCase()} • CONNESSO`;

  const formatRetention = (days: HistoryRetentionDays) => {
    if (days === -1) return 'OFF';
    if (days === 0) return 'ILLIMITATA';
    return `${days}GG`;
  };
  const historySubtitle = `VISIONE: ${formatRetention(watchRetention)} • RICERCHE: ${formatRetention(searchRetention)}`;

  const currentVersion = UpdaterService.getCurrentVersion();
  const currentVersionCode = UpdaterService.getCurrentVersionCode();
  const hasUpdateFound = Boolean(update?.isUpdateAvailable && update?.manifest);
  const aboutSubtitle = `V${currentVersion} (BUILD ${currentVersionCode}) • ${hasUpdateFound ? 'AGGIORNAMENTO DISPONIBILE' : 'AGGIORNATA'}`;

  const profileInitial = (syncStatus.profileName || 'K').charAt(0).toUpperCase();

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
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* 1. HERO CARD: KUROSYNC & PROFILO ATTIVO                            */}
        {/* ================================================================= */}
        <Pressable
          style={({ pressed }) => [
            styles.hubHeroCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: syncStatus.isConnected ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/settings/sync' as any);
          }}
          accessibilityRole="button"
          accessibilityLabel={`KUROSYNC: ${syncStatus.isConnected ? `CONNESSO COME ${syncStatus.profileName}` : 'NON CONNESSO'}`}
        >
          <View style={styles.hubHeroTop}>
            {/* Avatar profilo circolare */}
            <Pressable
              style={[
                styles.hubHeroAvatar,
                {
                  borderColor: syncStatus.isConnected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: syncStatus.isConnected ? `${theme.colors.primary}18` : theme.colors.card,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                if (syncStatus.isConnected) {
                  setIsProfileModalOpen(true);
                } else {
                  setIsConnectModalOpen(true);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="CAMBIA PROFILO O ACCEDI"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {syncStatus.isConnected ? (
                <Text
                  style={[
                    styles.hubHeroAvatarText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {profileInitial}
                </Text>
              ) : (
                <Ionicons name="log-in-outline" size={24} color={theme.colors.textMuted} />
              )}
            </Pressable>

            {/* Informazioni Profilo & Stato KuroSync */}
            <View style={styles.hubHeroInfo}>
              <View style={styles.hubHeroTitleRow}>
                <Text
                  style={[
                    styles.hubHeroProfileName,
                    { color: syncStatus.isConnected ? theme.colors.text : theme.colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {syncStatus.isConnected
                    ? (syncStatus.profileName || 'PRINCIPALE').toUpperCase()
                    : 'KUROSYNC'}
                </Text>
              </View>

              <View style={styles.hubHeroStatusRow}>
                {syncStatus.isSyncing ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <View
                    style={[
                      styles.hubHeroStatusDot,
                      {
                        backgroundColor: syncStatus.isConnected
                          ? (theme.colors.success || '#22C55E')
                          : theme.colors.textMuted,
                      },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.hubHeroStatusText,
                    {
                      color: syncStatus.isConnected
                        ? (theme.colors.success || '#22C55E')
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {syncStatus.isSyncing
                    ? 'SINCRONIZZAZIONE...'
                    : syncStatus.isConnected
                      ? 'SINCRONIZZATO'
                      : 'OFFLINE'}
                </Text>
              </View>
            </View>

            {/* Pulsante rapido azione sulla destra */}
            <Pressable
              style={[
                styles.hubHeroActionBtn,
                {
                  backgroundColor: syncStatus.isConnected ? theme.colors.card : theme.colors.primary,
                  borderColor: syncStatus.isConnected ? theme.colors.border : theme.colors.primary,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                if (syncStatus.isConnected) {
                  setIsProfileModalOpen(true);
                } else {
                  setIsConnectModalOpen(true);
                }
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={syncStatus.isConnected ? 'CAMBIA PROFILO' : 'ACCEDI A KUROSYNC'}
            >
              <Text
                style={[
                  styles.hubHeroActionBtnText,
                  { color: syncStatus.isConnected ? theme.colors.text : primaryContrast },
                ]}
              >
                {syncStatus.isConnected ? 'CAMBIA' : 'ACCEDI'}
              </Text>
              <Ionicons
                name={syncStatus.isConnected ? 'people-outline' : 'qr-code-outline'}
                size={14}
                color={syncStatus.isConnected ? theme.colors.text : primaryContrast}
              />
            </Pressable>
          </View>

          {/* Banner di avviso se un nuovo aggiornamento è disponibile */}
          {hasUpdateFound ? (
            <Pressable
              style={[
                styles.hubHeroUpdateAlert,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                router.push('/settings/about' as any);
              }}
            >
              <Ionicons name="arrow-up-circle" size={18} color={theme.colors.primary} />
              <Text style={[styles.hubHeroUpdateText, { color: theme.colors.primary }]} numberOfLines={1}>
                NUOVO AGGIORNAMENTO DISPONIBILE: V{update?.manifest?.version}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </Pressable>

        {/* ================================================================= */}
        {/* 2. LE 7 RIGHE CATEGORIA (HUB & SPOKE)                             */}
        {/* ================================================================= */}
        <View style={styles.hubSectionHeader}>
          <Text style={[styles.hubSectionHeaderText, { color: theme.colors.textMuted }]}>
            CONFIGURAZIONI & PREFERENZE
          </Text>
        </View>

        {/* 1. Apparenza */}
        <SettingsCategoryRow
          icon="color-palette-outline"
          title="APPARENZA"
          subtitle={appearanceSubtitle}
          onPress={() => router.push('/settings/appearance' as any)}
        />

        {/* 2. Player */}
        <SettingsCategoryRow
          icon="play-skip-forward-outline"
          title="PLAYER"
          subtitle={playbackSubtitle}
          onPress={() => router.push('/settings/playback' as any)}
        />

        {/* 3. Sincronia */}
        <SettingsCategoryRow
          icon="cloud-done-outline"
          title="SINCRONIA"
          subtitle={syncSubtitle}
          onPress={() => router.push('/settings/sync' as any)}
        />

        {/* 3b. MyAnimeList */}
        <SettingsCategoryRow
          icon="bookmark-outline"
          title="MYANIMELIST"
          subtitle={malSubtitle}
          onPress={() => router.push('/mal' as any)}
        />

        {/* 4. Download */}
        <SettingsCategoryRow
          icon="cloud-download-outline"
          title="DOWNLOAD"
          subtitle={downloadSubtitle}
          onPress={() => router.push('/settings/downloads' as any)}
        />

        {/* 5. Sorgente */}
        <SettingsCategoryRow
          icon="globe-outline"
          title="SORGENTE"
          subtitle={sourceSubtitle}
          onPress={() => router.push('/settings/source' as any)}
        />

        {/* 6. Cronologia */}
        <SettingsCategoryRow
          icon="time-outline"
          title="CRONOLOGIA"
          subtitle={historySubtitle}
          onPress={() => router.push('/settings/history' as any)}
        />

        {/* 7. Applicazione */}
        <SettingsCategoryRow
          icon="information-circle-outline"
          title="APPLICAZIONE"
          subtitle={aboutSubtitle}
          badge={hasUpdateFound ? { text: `V${update?.manifest?.version}`, color: primaryContrast, bgColor: theme.colors.primary } : undefined}
          onPress={() => router.push('/settings/about' as any)}
        />
      </ScrollView>

      {/* Modali Rapidi KuroSync da Hero Card */}
      <SyncProfileModal
        visible={isProfileModalOpen}
        activeProfileId={syncStatus.profileId}
        theme={theme}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSelected={(_profile) => {
          setIsProfileModalOpen(false);
          setSyncStatus(SyncManager.getStatus());
        }}
        onProposeLogin={() => {
          setIsProfileModalOpen(false);
          setIsConnectModalOpen(true);
        }}
      />

      <SyncConnectModal
        visible={isConnectModalOpen}
        initialTab="qr"
        theme={theme}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => setIsConnectModalOpen(false)}
      />
    </View>
  );
}
