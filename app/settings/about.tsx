import React, { useState, useRef, useCallback } from 'react';
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
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import {
  UpdaterService,
  UpdateStore,
  formatBytes,
  getDeviceSupportedAbis,
  type UpdateCheckResult,
  type DownloadProgress,
} from '@/services/updater';
import { BatteryStore } from '@/services/battery';
import { CURRENT_CHANGELOG, formatChangelog } from '@/constants/changelog';
import {
  SettingsHeader,
  BatterySettingsCard,
  settingsStyles as styles,
} from '@/components/settings';

export default function AboutSettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scrollTo?: string; autoDownload?: string }>();
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const shouldScrollToUpdateRef = useRef(false);
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings' as any);
        }
        return true;
      });
      return () => backSub.remove();
    }, [router])
  );

  // OTA state (strictly in-app, zero native Alert dialogs)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error'
  >('idle');
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);

  // Changelog active view tab: 'new' | 'current'
  const [changelogTab, setChangelogTab] = useState<'new' | 'current'>('current');

  const handleStartDownloadUpdate = useCallback(async (manifestOverride?: any) => {
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

  const scrollToUpdateSection = useCallback(() => {
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

  // Handle auto-download from startup modal or pending update synchronization
  useFocusEffect(
    useCallback(() => {
      BatteryStore.refreshStatus();
      const isAuto = UpdateStore.isAutoDownloadRequested() || params.autoDownload === 'true';
      const shouldScroll = isAuto || params.scrollTo === 'update';

      if (isAuto) {
        (navigation as any).setParams?.({ autoDownload: undefined, scrollTo: undefined });
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

      if (shouldScroll) {
        (navigation as any).setParams?.({ scrollTo: undefined });
        scrollToUpdateSection();
      }
    }, [handleStartDownloadUpdate, navigation, params.autoDownload, params.scrollTo, scrollToUpdateSection])
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
        UpdateStore.dismissModal();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setUpdateStatus('available');
        setChangelogTab('new');
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
      <SettingsHeader
        title="APPLICAZIONE"
        subtitle="VERSIONE APP, SPECIFICHE HARDWARE, CHANGELOG E UPDATER OTA"
      />

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
        {/* RISPARMIO ENERGETICO */}
        <BatterySettingsCard />

        {/* INFORMAZIONI SCHEDA TECNICA */}
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
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="CHANGELOG NUOVA VERSIONE"
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
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="CHANGELOG VERSIONE CORRENTE"
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="VERIFICA NUOVAMENTE AGGIORNAMENTI"
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="RIPROVA VERIFICA AGGIORNAMENTI"
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
    </View>
  );
}
