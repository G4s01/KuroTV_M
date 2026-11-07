import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  oledTheme,
  useTheme,
  applyThemeFamily,
} from '@/theme';
import { AppStorage } from '@/services/storage';
import { UpdaterService, getManifestUrl, formatBytes } from '@/services/updater';
import type { UpdateCheckResult, DownloadProgress } from '@/services/updater';

import themeOledSvg from '../../assets/icons/theme-oled.svg';
import themePikachuSvg from '../../assets/icons/theme-pikachu.svg';
import themeOrchidSvg from '../../assets/icons/theme-orchid.svg';
import themeRainbowSvg from '../../assets/icons/theme-rainbow.svg';

const THEMES = [
  {
    id: 'oled',
    name: 'OLED Puro',
    color: '#000000',
    border: '#FFFFFF',
    icon: themeOledSvg,
  },
  {
    id: 'pikachu',
    name: 'Pikachu',
    color: '#FAD61D',
    border: '#FAD61D',
    icon: themePikachuSvg,
  },
  {
    id: 'orchid',
    name: 'Orchidea',
    color: '#E941FB',
    border: '#E941FB',
    icon: themeOrchidSvg,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    color: '#73FEC8',
    border: '#73FEC8',
    icon: themeRainbowSvg,
  },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [activeTheme, setActiveTheme] = React.useState<string>(
    AppStorage.getThemeFamily() || 'oled'
  );
  const [tld, setTld] = React.useState<string>(AppStorage.getTld());
  const manifestUrl = getManifestUrl();

  // OTA state
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [updateResult, setUpdateResult] = React.useState<UpdateCheckResult | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState<DownloadProgress | null>(null);

  const handleSelectTheme = (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setActiveTheme(themeId);
    AppStorage.setThemeFamily(themeId as any);
    applyThemeFamily(themeId);
  };

  const handleSaveTld = () => {
    const clean = tld.replace(/^\.+/, '').trim().toLowerCase();
    if (clean) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AppStorage.setTld(clean);
      Alert.alert('Dominio Aggiornato', `AnimeWorld TLD impostato su: .${clean}`);
    }
  };

  const handleCheckUpdates = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsCheckingUpdate(true);
    setUpdateResult(null);

    try {
      const result = await UpdaterService.checkForUpdates();
      setUpdateResult(result);

      if (result.isUpdateAvailable) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          'Nuovo Aggiornamento Disponibile!',
          `Versione: ${result.manifest?.version} (Build ${result.manifest?.versionCode})\n\nNote:\n${result.manifest?.releaseNotes || 'Nessuna nota'}`,
          [
            { text: 'Più tardi', style: 'cancel' },
            {
              text: 'Scarica e Installa',
              onPress: () => startDownloadUpdate(result),
            },
          ]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('App Aggiornata', `Sei all'ultima versione disponibile: ${result.currentVersion}`);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Errore Controllo Aggiornamenti', err.message || 'Impossibile scaricare il manifest');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadAndInstall = () => {
    if (updateResult) {
      startDownloadUpdate(updateResult);
    }
  };

  const startDownloadUpdate = async (res: UpdateCheckResult) => {
    if (!res.manifest) return;
    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      const apkUri = await UpdaterService.downloadApk(
        res.manifest,
        (progress: DownloadProgress) => {
          setDownloadProgress(progress);
        }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsDownloading(false);

      Alert.alert(
        'Download Completato!',
        'Vuoi procedere con l\'installazione del pacchetto APK?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Installa Ora',
            onPress: () => UpdaterService.installApk(apkUri),
          },
        ]
      );
    } catch (err: any) {
      setIsDownloading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Errore Download APK', err.message || 'Download interrotto');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Impostazioni</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tema & Aspetto */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tema & Aspetto</Text>
          <Text style={styles.cardSubtitle}>
            Scegli il tema dell&apos;interfaccia grafica ottimizzato per display OLED
          </Text>

          <View style={styles.themeGrid}>
            {THEMES.map((t) => {
              const active = activeTheme === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.themeChip,
                    active && {
                      borderColor: theme.colors.primary,
                      backgroundColor: `${theme.colors.primary}18`,
                    },
                  ]}
                  onPress={() => handleSelectTheme(t.id)}
                >
                  <Image source={t.icon} style={styles.themeSvgIcon} contentFit="contain" />
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                    {t.name}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Aggiornamenti OTA & Cloudflare */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Aggiornamenti In-App (OTA)</Text>
              <Text style={styles.cardSubtitle}>
                Versione installata: v{UpdaterService.getCurrentVersion()} (Build {UpdaterService.getCurrentVersionCode()})
              </Text>
            </View>
          </View>

          {isDownloading ? (
            <View style={styles.downloadProgressWrapper}>
              <Text style={styles.downloadProgressText}>
                Scaricamento APK: {downloadProgress?.percentage || 0}%
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
                <Text style={styles.bytesText}>
                  {formatBytes(downloadProgress.totalBytesWritten)} / {formatBytes(downloadProgress.totalBytesExpectedToWrite)}
                </Text>
              )}
            </View>
          ) : updateResult?.isUpdateAvailable ? (
            <View style={styles.updateAvailableBanner}>
              <View style={styles.updateBadgeRow}>
                <Ionicons name="arrow-up-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.updateAvailableTitle}>
                  Nuova versione disponibile: v{updateResult.manifest?.version}
                </Text>
              </View>
              {updateResult.manifest?.releaseNotes ? (
                <Text style={styles.releaseNotesText}>
                  {updateResult.manifest.releaseNotes}
                </Text>
              ) : null}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleDownloadAndInstall}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Scarica e Installa APK</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleCheckUpdates}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Verifica Aggiornamenti</Text>
                </>
              )}
            </Pressable>
          )}

          {/* Endpoint Manifest OTA Mobile (Read-Only) */}
          <View style={styles.fieldSection}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>Endpoint OTA Mobile</Text>
              <Text style={styles.fieldLockBadge}>Predefinito</Text>
            </View>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {manifestUrl}
            </Text>
          </View>
        </View>

        {/* Sorgenti & Dominio */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sorgente AnimeWorld</Text>
          <Text style={styles.cardSubtitle}>
            Configura il dominio di primo livello (TLD) utilizzato per lo scraping dei cataloghi
          </Text>

          <View style={styles.tldRow}>
            <View style={styles.tldInputWrapper}>
              <Text style={styles.tldPrefix}>https://www.animeworld.</Text>
              <TextInput
                style={styles.tldInput}
                value={tld}
                onChangeText={setTld}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
              />
            </View>
            <Pressable style={styles.saveTldBtn} onPress={handleSaveTld}>
              <Text style={styles.saveTldBtnText}>Applica</Text>
            </Pressable>
          </View>
        </View>

        {/* Info App */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informazioni</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Applicazione</Text>
            <Text style={styles.infoValue}>KuroTV Mobile</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Architettura</Text>
            <Text style={styles.infoValue}>Expo SDK 58 (New Architecture)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Video Player</Text>
            <Text style={styles.infoValue}>androidx.media3 / ExoPlayer</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Package Name</Text>
            <Text style={styles.infoValue}>com.kurotv.mobile</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appBar: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  appBarTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: oledTheme.colors.surface,
    padding: 16,
    borderRadius: oledTheme.radius.lg,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
  cardTitle: {
    color: oledTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.md,
    backgroundColor: oledTheme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
    minHeight: 44,
  },
  themeChipActive: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: '#1C0D0E',
  },
  themeSvgIcon: {
    width: 22,
    height: 22,
  },
  themeChipText: {
    color: oledTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  themeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: oledTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.md,
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  updateAvailableBanner: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 8,
  },
  updateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateAvailableTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  releaseNotesText: {
    color: oledTheme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  downloadProgressWrapper: {
    marginTop: 8,
    gap: 6,
  },
  downloadProgressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  bytesText: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  fieldSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    color: oledTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldLockBadge: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    backgroundColor: '#0F261F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldValue: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
  },
  editManifestRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: oledTheme.radius.sm,
    paddingHorizontal: 10,
    color: '#FFFFFF',
    fontSize: 12,
  },
  saveMiniBtn: {
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: oledTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveMiniBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  tldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  tldInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#000000',
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
  },
  tldPrefix: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
  },
  tldInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    height: '100%',
  },
  saveTldBtn: {
    backgroundColor: oledTheme.colors.primary,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: oledTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTldBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  infoLabel: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: oledTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
