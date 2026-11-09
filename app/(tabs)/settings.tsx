import React from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
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
import { HistorySlider } from '@/components/HistorySlider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { scraperConfig } from '@/services/scraper/config';
import {
  UpdaterService,
  UpdateStore,
  formatBytes,
  getDeviceSupportedAbis,
} from '@/services/updater';
import type { UpdateCheckResult, DownloadProgress } from '@/services/updater';
import { CURRENT_CHANGELOG, formatChangelog } from '@/constants/changelog';

import themeOledSvg from '../../assets/icons/theme-oled.svg';
import themePikachuSvg from '../../assets/icons/theme-pikachu.svg';
import themeOrchidSvg from '../../assets/icons/theme-orchid.svg';
import themeRainbowSvg from '../../assets/icons/theme-rainbow.svg';

const THEMES = [
  {
    id: 'oled',
    icon: themeOledSvg,
    accessibilityLabel: 'TEMA OLED',
  },
  {
    id: 'pikachu',
    icon: themePikachuSvg,
    accessibilityLabel: 'TEMA PIKACHU',
  },
  {
    id: 'orchid',
    icon: themeOrchidSvg,
    accessibilityLabel: 'TEMA ORCHIDEA',
  },
  {
    id: 'rainbow',
    icon: themeRainbowSvg,
    accessibilityLabel: 'TEMA RAINBOW',
  },
];

const QUICK_DOMAINS = ['ac', 'so', 'tv'] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

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
        if (candidate && QUICK_DOMAINS.includes(candidate as any)) {
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

  // AniSkip settings state
  const [aniSkipSettings, setAniSkipSettings] = React.useState<AniSkipSettings>(() => {
    return AppStorage.getAniSkipSettings();
  });

  const handleUpdateAniSkipMode = (mode: AniSkipMode) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = AppStorage.saveAniSkipSettings({ mode });
    setAniSkipSettings(updated);
  };

  const handleToggleAniSkipType = (key: 'enableOpening' | 'enableEnding' | 'enableRecap') => {
    Haptics.selectionAsync().catch(() => {});
    const updated = AppStorage.saveAniSkipSettings({ [key]: !aniSkipSettings[key] });
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
    if (!trimmed.includes('.') && !trimmed.includes('/')) {
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
      if (tldCandidate && QUICK_DOMAINS.includes(tldCandidate as any)) {
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
    const targetManifest = manifestOverride || updateResult?.manifest;
    if (!targetManifest) return;
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
      setUpdateError((err.message || 'DOWNLOAD INTERROTTO').toUpperCase());
    }
  }, [updateResult]);

  // Handle auto-download from startup modal or pending update synchronization
  useFocusEffect(
    React.useCallback(() => {
      if (UpdateStore.isAutoDownloadRequested()) {
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
          setUpdateStatus((prev) => (prev === 'idle' ? 'available' : prev));
        }
      }
    }, [handleStartDownloadUpdate])
  );

  const handleCheckUpdates = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setUpdateStatus('checking');
    setUpdateError(null);
    setDownloadedApkUri(null);

    try {
      const result = await UpdaterService.checkForUpdates();
      setUpdateResult(result);

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
      setUpdateError((err.message || 'IMPOSSIBILE VERIFICARE GLI AGGIORNAMENTI').toUpperCase());
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
      <View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.appBarTitle, { color: theme.colors.text }]}>IMPOSTAZIONI</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TEMA (con invertibilità chiaro/scuro al click) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>TEMA</Text>
          <View style={styles.themeGrid}>
            {THEMES.map((t) => {
              const active = activeTheme === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.themeIconBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                    active && {
                      borderWidth: 2,
                      backgroundColor: `${theme.colors.primary}22`,
                    },
                  ]}
                  onPress={() => handleSelectTheme(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.accessibilityLabel} (${active ? (activeMode === 'light' ? 'CHIARO' : 'SCURO') : 'NON ATTIVO'})`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Image source={t.icon} style={styles.themeSvgIcon} contentFit="contain" />
                  {active && (
                    <View style={[styles.modeIndicatorBadge, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons
                        name={activeMode === 'light' ? 'sunny' : 'moon'}
                        size={9}
                        color={primaryContrast}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

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

        {/* ANISKIP (Salto automatico o manuale, selezione sezioni) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>ANISKIP</Text>

          <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary }]}>
            MODALITÀ DI SALTO
          </Text>
          <View style={styles.aniskipRow}>
            {[
              { mode: 'manual' as AniSkipMode, label: 'MANUALE' },
              { mode: 'auto' as AniSkipMode, label: 'AUTOMATICO' },
              { mode: 'disabled' as AniSkipMode, label: 'DISATTIVATO' },
            ].map((item) => {
              const active = aniSkipSettings.mode === item.mode;
              const contrastColor = active ? getContrastTextColor(theme.colors.primary) : theme.colors.text;
              return (
                <Pressable
                  key={item.mode}
                  style={[
                    styles.aniskipChip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => handleUpdateAniSkipMode(item.mode)}
                  accessibilityRole="button"
                  accessibilityLabel={`MODALITÀ ANISKIP ${item.label}${active ? ' ATTIVA' : ''}`}
                >
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
                ? 'LA BARRA DI SISTEMA SPARISCE AUTOMATICAMENTE DURANTE L\'USO DELL\'APP PER UN\'ESPERIENZA IMMERSIVA. PUOI RICHIAMARLA IN QUALSIASI MOMENTO CON UNO SWIPE DAL BORDO INFERIORE.'
                : 'I PULSANTI DI SISTEMA RIMANGONO SEMPRE VISIBILI CON SPAZIATURA DI SICUREZZA PER NON COPRIRE LE TAB DI NAVIGAZIONE.'}
            </Text>
          </View>
        )}

        {/* SORGENTE (.ac, .so, .tv o scrivibile a mano) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>SORGENTE</Text>
          <View style={styles.quickDomainsRow}>
            {QUICK_DOMAINS.map((domain) => {
              const active = selectedTld === domain;
              return (
                <Pressable
                  key={domain}
                  style={[
                    styles.domainChip,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                    active && {
                      backgroundColor: `${theme.colors.primary}25`,
                    },
                  ]}
                  onPress={() => handleSelectQuickDomain(domain)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text
                    style={[
                      styles.domainChipText,
                      { color: theme.colors.textSecondary },
                      active && { color: theme.colors.primary, fontWeight: '800' },
                    ]}
                  >
                    .{domain.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customUrlRow}>
            <TextInput
              style={[
                styles.customUrlInput,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={customUrl}
              onChangeText={setCustomUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="HTTPS://..."
              placeholderTextColor={theme.colors.textMuted}
            />
            <Pressable
              style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleApplyCustomUrl}
            >
              <Text style={styles.applyBtnText}>APPLICA</Text>
            </Pressable>
          </View>

          {sourceNotice ? (
            <View style={[styles.sourceNoticeBox, { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary }]}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={[styles.sourceNoticeText, { color: theme.colors.primary }]}>{sourceNotice}</Text>
            </View>
          ) : null}
        </View>

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
                  onPress={handleStartDownloadUpdate}
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
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  themeIconBtn: {
    width: 54,
    height: 54,
    borderRadius: oledTheme.radius.md,
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themeSvgIcon: {
    width: 28,
    height: 28,
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  clearHistoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  inlineConfirmCard: {
    padding: 14,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1.5,
    marginTop: 10,
    gap: 10,
  },
  inlineConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    lineHeight: 16,
    textAlign: 'center',
  },
  inlineConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineConfirmCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
  },
  inlineConfirmCancelText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  inlineConfirmDeleteBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineConfirmDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  modeIndicatorBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDomainsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  domainChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainChipText: {
    color: '#D4D4D4',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  aniskipSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  aniskipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  aniskipChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  aniskipChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  aniskipChipTextActive: {
    fontWeight: '900',
  },
  navBarRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  navBarChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
  },
  navBarChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  navBarChipTextActive: {
    fontWeight: '900',
  },
  navBarHelpText: {
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  customUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customUrlInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#000000',
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: oledTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  sourceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
  },
  sourceNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },
  infoLabel: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: oledTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  changelogCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#121212',
    gap: 8,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  changelogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changelogTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changelogTabSwitch: {
    flexDirection: 'row',
    gap: 6,
  },
  changelogTabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1E1E1E',
  },
  changelogTabBtnActive: {
    borderColor: 'transparent',
  },
  changelogTabBtnText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#888888',
    textTransform: 'uppercase',
  },
  changelogTabBtnTextActive: {
    color: '#FFFFFF',
  },
  changelogContentBox: {
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    maxHeight: 220,
  },
  changelogScrollContent: {
    padding: 10,
  },
  changelogText: {
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  updateContainer: {
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.md,
    minHeight: 44,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  updateAvailableBanner: {
    padding: 14,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1.5,
    gap: 12,
  },
  updateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateAvailableTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  downloadProgressWrapper: {
    padding: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    gap: 8,
  },
  downloadProgressText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
  bytesText: {
    fontSize: 11,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  inlineStatusBox: {
    padding: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    gap: 8,
  },
  inlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineStatusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    lineHeight: 15,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  upToDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  upToDateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upToDateText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
