import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StepSlider, type StepItem } from '@/components/StepSlider';
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MAX_MAL_WATCHING_THRESHOLD_EPISODES,
  MIN_MAL_WATCHING_THRESHOLD_EPISODES,
  MalAuthService,
  MalSyncService,
  addMalDataListener,
  clearMalIgnoredAnimeIds,
  getEffectiveMalClientId,
  getMalIgnoredAnimeIds,
  getMalSettings,
  isValidMalClientId,
  saveMalSettings,
  setStoredMalClientId,
  type MalAudioPreference,
  type MalAutoSyncMode,
  type MalSettings,
} from '@/services/mal';
import { malStyles as styles } from './mal.styles';

export interface MalSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLoggedOut?: () => void;
  onSettingsChanged?: () => void;
}

const AUDIO_OPTIONS: Array<{ value: MalAudioPreference; label: string }> = [
  { value: 'ask', label: 'CHIEDI' },
  { value: 'sub', label: 'SUB' },
  { value: 'ita', label: 'ITA' },
];

const AUTO_SYNC_STEPS: StepItem<MalAutoSyncMode>[] = [
  {
    value: 'off',
    label: 'OFF',
    description: 'DISATTIVATO — AGGIORNA MAL SOLO MANUALMENTE DALL\'APP.',
  },
  {
    value: 'episodes',
    label: 'EPISODI',
    description: 'AGGIORNA AUTOMATICAMENTE OGNI EPISODIO COMPLETATO NEL PLAYER.',
  },
  {
    value: 'completed_only',
    label: 'SOLO FINITI',
    description: 'AGGIORNA MAL SOLO AL COMPLETAMENTO FINALE DELLA SERIE (NON ONGOING).',
  },
];

export const MalSettingsModal: React.FC<MalSettingsModalProps> = ({
  isVisible,
  onClose,
  onLoggedOut,
  onSettingsChanged,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [authStatus, setAuthStatus] = React.useState(() => MalAuthService.getStatus());
  const [settings, setSettings] = React.useState<MalSettings>(() => getMalSettings());
  const [ignoredCount, setIgnoredCount] = React.useState(() => getMalIgnoredAnimeIds().length);
  const [pendingCount, setPendingCount] = React.useState(() =>
    MalSyncService.getPendingUpdatesCount()
  );
  const [isFlushingQueue, setIsFlushingQueue] = React.useState(false);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = React.useState(false);
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  const [inputKey, setInputKey] = React.useState(0);
  const clientIdInputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const lastClientIdRef = React.useRef(getEffectiveMalClientId());

  const refreshModalState = React.useCallback(() => {
    setAuthStatus(MalAuthService.getStatus());
    setSettings(getMalSettings());
    setIgnoredCount(getMalIgnoredAnimeIds().length);
    setPendingCount(MalSyncService.getPendingUpdatesCount());
  }, []);

  React.useEffect(() => {
    if (isVisible) {
      refreshModalState();
      setFeedbackMsg(null);
      lastClientIdRef.current = getEffectiveMalClientId();
      setInputKey((k) => k + 1);
    }
  }, [isVisible, refreshModalState]);

  React.useEffect(() => {
    const unsub = addMalDataListener(refreshModalState);
    return unsub;
  }, [refreshModalState]);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const { translateY, dragStripHandlers, headerPanHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose: handleClose,
  });

  const handleSelectAutoSyncMode = React.useCallback(
    (mode: MalAutoSyncMode) => {
      const next = saveMalSettings({ autoSyncMode: mode });
      setSettings(next);
      onSettingsChanged?.();
    },
    [onSettingsChanged]
  );

  const handleToggleWatchingThreshold = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const next = saveMalSettings({
      watchingThresholdEnabled: !settings.watchingThresholdEnabled,
    });
    setSettings(next);
    onSettingsChanged?.();
  }, [settings.watchingThresholdEnabled, onSettingsChanged]);

  const handleStepWatchingThreshold = React.useCallback(
    (delta: number) => {
      Haptics.selectionAsync().catch(() => {});
      const nextCount = Math.max(
        MIN_MAL_WATCHING_THRESHOLD_EPISODES,
        Math.min(
          MAX_MAL_WATCHING_THRESHOLD_EPISODES,
          settings.watchingThresholdEpisodes + delta
        )
      );
      if (nextCount === settings.watchingThresholdEpisodes) return;
      const next = saveMalSettings({ watchingThresholdEpisodes: nextCount });
      setSettings(next);
      onSettingsChanged?.();
    },
    [settings.watchingThresholdEpisodes, onSettingsChanged]
  );

  const handleSelectAudio = React.useCallback(
    (pref: MalAudioPreference) => {
      Haptics.selectionAsync().catch(() => {});
      const next = saveMalSettings({ audioPreference: pref });
      setSettings(next);
      onSettingsChanged?.();
    },
    [onSettingsChanged]
  );

  const handleSaveClientId = React.useCallback(() => {
    Keyboard.dismiss();
    const candidate = lastClientIdRef.current.trim();
    if (!isValidMalClientId(candidate)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setFeedbackMsg('CLIENT ID NON VALIDO (MIN. 16 CARATTERI ALFANUMERICI).');
      return;
    }
    setStoredMalClientId(candidate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFeedbackMsg('CLIENT ID SALVATO IN LOCALE.');
    onSettingsChanged?.();
  }, [onSettingsChanged]);

  const handleFlushQueue = React.useCallback(async () => {
    if (isFlushingQueue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsFlushingQueue(true);
    try {
      const res = await MalSyncService.flushPendingUpdates();
      setPendingCount(res.remaining);
      setFeedbackMsg(
        res.remaining === 0
          ? `CODA OFFLINE INVIATA (${res.flushed} AGGIORNAMENTI).`
          : `INVIATI ${res.flushed}, RIMASTI ${res.remaining} IN CODA.`
      );
      onSettingsChanged?.();
    } catch {
      setFeedbackMsg('RETE NON DISPONIBILE PER L\'INVIO DELLA CODA.');
    } finally {
      setIsFlushingQueue(false);
    }
  }, [isFlushingQueue, onSettingsChanged]);

  const handleClearIgnored = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    clearMalIgnoredAnimeIds();
    setIgnoredCount(0);
    setFeedbackMsg('SERIE IGNORATE RIPRISTINATE.');
    onSettingsChanged?.();
  }, [onSettingsChanged]);

  const handleConfirmLogout = React.useCallback(() => {
    setIsLogoutConfirmVisible(false);
    MalAuthService.logout();
    onLoggedOut?.();
    handleClose();
  }, [onLoggedOut, handleClose]);

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);
  const maxBodyHeight = isLandscape
    ? Math.min(240, windowHeight * 0.56)
    : Math.min(480, windowHeight * 0.68);

  return (
    <>
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                transform: [{ translateY }],
                paddingHorizontal: horizontalPadding,
                paddingBottom: Math.max(24, insets.bottom + 14),
              },
              isTablet && {
                maxWidth: 600,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              },
            ]}
          >
            <View {...dragStripHandlers} style={styles.dragStripArea}>
              <View style={styles.dragIndicator} />
            </View>

            <View
              {...headerPanHandlers}
              style={[styles.sheetHeaderRow, { borderBottomColor: theme.colors.border }]}
            >
              <View style={styles.sheetHeaderLeft}>
                <Ionicons name="settings-outline" size={18} color={theme.colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sheetTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    IMPOSTAZIONI MYANIMELIST
                  </Text>
                  {authStatus.username ? (
                    <Text style={[styles.headerUsername, { color: theme.colors.primary }]}>
                      @{authStatus.username}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                style={styles.sheetCloseBtn}
                onPress={handleClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI IMPOSTAZIONI MYANIMELIST"
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: maxBodyHeight }}
              contentContainerStyle={{ paddingTop: 14, gap: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {/* KuroSync Profile Scope Info */}
              <View
                style={[
                  styles.inlineBanner,
                  {
                    marginHorizontal: 0,
                    marginTop: 0,
                    backgroundColor: theme.colors.surface,
                    borderColor: authStatus.isKuroSyncLinked
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={authStatus.isKuroSyncLinked ? 'sync-outline' : 'phone-portrait-outline'}
                  size={16}
                  color={authStatus.isKuroSyncLinked ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.inlineBannerText,
                    {
                      color: authStatus.isKuroSyncLinked
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {authStatus.isKuroSyncLinked
                    ? `PROFILO KUROSYNC: ${(authStatus.kuroSyncProfileName || 'PRINCIPALE').toUpperCase()} • LOGIN E TOKEN MAL ISOLATI PER PROFILO.`
                    : 'PROFILO LOCALE • COLLEGA KUROSYNC PER SEPARARE E SINCRONIZZARE I TOKEN MAL TRA PROFILI.'}
                </Text>
              </View>

              {/* Auto-Sync Player Mode (StepSlider) */}
              <View>
                <Text style={[styles.sheetSectionLabel, { color: theme.colors.textSecondary }]}>
                  MODALITÀ AUTO-SYNC NEL PLAYER
                </Text>
                <StepSlider<MalAutoSyncMode>
                  steps={AUTO_SYNC_STEPS}
                  value={settings.autoSyncMode}
                  onChange={handleSelectAutoSyncMode}
                  theme={theme}
                  isInactive={(step) => step.value === 'off'}
                  accessibilityLabelPrefix="AUTO-SYNC MYANIMELIST"
                  compactLabels={true}
                />
              </View>

              {/* Watching Threshold Setting (for episode mode) */}
              <View style={{ opacity: settings.autoSyncMode === 'episodes' ? 1 : 0.55 }}>
                <Pressable
                  style={[
                    styles.diffRow,
                    {
                      marginBottom: settings.watchingThresholdEnabled ? 10 : 0,
                      backgroundColor: theme.colors.surface,
                      borderColor:
                        settings.autoSyncMode === 'episodes' && settings.watchingThresholdEnabled
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={handleToggleWatchingThreshold}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: settings.watchingThresholdEnabled }}
                  accessibilityLabel="ABILITA SOGLIA EPISODI PER IN CORSO"
                >
                  <View style={styles.diffBody}>
                    <Text style={[styles.diffTitle, { color: theme.colors.text }]}>
                      SOGLIA &quot;IN CORSO&quot; ({settings.watchingThresholdEpisodes} EP.)
                    </Text>
                    <Text style={[styles.diffTransition, { color: theme.colors.textSecondary }]}>
                      {settings.autoSyncMode === 'completed_only'
                        ? 'NON ATTIVA CON MODALITÀ SOLO FINITI.'
                        : `PASSA AUTOMATICAMENTE IN "IN CORSO" SU MAL SOLO DA EP. ${settings.watchingThresholdEpisodes} IN POI (NON BLOCCA LE SERIE COMPLETATE).`}
                    </Text>
                  </View>

                  <View
                    style={{
                      minWidth: 50,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      backgroundColor: settings.watchingThresholdEnabled
                        ? theme.colors.primary
                        : theme.colors.card,
                      borderColor: settings.watchingThresholdEnabled
                        ? theme.colors.primary
                        : theme.colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        {
                          color: settings.watchingThresholdEnabled
                            ? primaryContrast
                            : theme.colors.textMuted,
                        },
                      ]}
                    >
                      {settings.watchingThresholdEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </Pressable>

                {settings.watchingThresholdEnabled && (
                  <View
                    style={[
                      styles.episodeStepperCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleStepWatchingThreshold(-1)}
                      disabled={
                        settings.watchingThresholdEpisodes <= MIN_MAL_WATCHING_THRESHOLD_EPISODES
                      }
                      accessibilityRole="button"
                      accessibilityLabel="RIDUCI SOGLIA EPISODI IN CORSO"
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={
                          settings.watchingThresholdEpisodes <= MIN_MAL_WATCHING_THRESHOLD_EPISODES
                            ? theme.colors.textMuted
                            : theme.colors.text
                        }
                      />
                    </Pressable>

                    <View style={styles.stepperValueBox}>
                      <Text style={[styles.stepperValueText, { color: theme.colors.primary }]}>
                        DA EPISODIO {settings.watchingThresholdEpisodes}
                      </Text>
                    </View>

                    <Pressable
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => handleStepWatchingThreshold(1)}
                      disabled={
                        settings.watchingThresholdEpisodes >= MAX_MAL_WATCHING_THRESHOLD_EPISODES
                      }
                      accessibilityRole="button"
                      accessibilityLabel="AUMENTA SOGLIA EPISODI IN CORSO"
                    >
                      <Ionicons
                        name="add"
                        size={18}
                        color={
                          settings.watchingThresholdEpisodes >= MAX_MAL_WATCHING_THRESHOLD_EPISODES
                            ? theme.colors.textMuted
                            : theme.colors.text
                        }
                      />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Audio Preference SUB vs ITA */}
              <View>
                <Text style={[styles.sheetSectionLabel, { color: theme.colors.textSecondary }]}>
                  PREFERENZA AUDIO ANIMEWORLD (MAL → APP)
                </Text>
                <View style={styles.tabsRow}>
                  {AUDIO_OPTIONS.map((opt) => {
                    const active = settings.audioPreference === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[
                          styles.tabBtn,
                          {
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surface,
                            borderColor: active
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                        onPress={() => handleSelectAudio(opt.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`PREFERENZA AUDIO ${opt.label}`}
                      >
                        <Text
                          style={[
                            styles.tabBtnText,
                            { color: active ? primaryContrast : theme.colors.text },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Client ID Uncontrolled Edit */}
              <View>
                <Text style={[styles.sheetSectionLabel, { color: theme.colors.textSecondary }]}>
                  CLIENT ID PERSONALE
                </Text>
                <View style={styles.searchAndSortRow}>
                  <View
                    style={[
                      styles.searchBox,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons name="key-outline" size={16} color={theme.colors.textMuted} />
                    <TextInput
                      key={inputKey}
                      ref={clientIdInputRef}
                      style={[styles.searchInput, { color: theme.colors.text }]}
                      placeholder="CLIENT ID MAL..."
                      placeholderTextColor={theme.colors.textMuted}
                      defaultValue={lastClientIdRef.current}
                      onChangeText={(t) => {
                        lastClientIdRef.current = t;
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      disableFullscreenUI={true}
                    />
                  </View>
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={handleSaveClientId}
                    accessibilityRole="button"
                    accessibilityLabel="SALVA CLIENT ID MYANIMELIST"
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.colors.primary }]}>
                      SALVA
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Pending Offline Queue */}
              {pendingCount > 0 && (
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: `${theme.colors.primary}18`,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                  onPress={handleFlushQueue}
                  disabled={isFlushingQueue}
                  accessibilityRole="button"
                  accessibilityLabel={`INVIA CODA OFFLINE (${pendingCount})`}
                >
                  {isFlushingQueue ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.primary} />
                      <Text style={[styles.secondaryBtnText, { color: theme.colors.primary }]}>
                        INVIA CODA OFFLINE ({pendingCount} IN ATTESA)
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Ignored Series Reset */}
              {ignoredCount > 0 && (
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={handleClearIgnored}
                  accessibilityRole="button"
                  accessibilityLabel={`RIPRISTINA ${ignoredCount} SERIE IGNORATE`}
                >
                  <Ionicons name="eye-outline" size={16} color={theme.colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                    RIPRISTINA SERIE IGNORATE ({ignoredCount})
                  </Text>
                </Pressable>
              )}

              {feedbackMsg ? (
                <View
                  style={[
                    styles.inlineBanner,
                    {
                      marginHorizontal: 0,
                      marginTop: 0,
                      backgroundColor: `${theme.colors.primary}18`,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
                  <Text style={[styles.inlineBannerText, { color: theme.colors.primary }]}>
                    {feedbackMsg}
                  </Text>
                </View>
              ) : null}

              {/* Logout */}
              {authStatus.isConnected && (
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: `${theme.colors.error || '#EF4444'}14`,
                      borderColor: theme.colors.error || '#EF4444',
                    },
                  ]}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                      () => {}
                    );
                    setIsLogoutConfirmVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="DISCONNETTI ACCOUNT MYANIMELIST"
                >
                  <Ionicons
                    name="log-out-outline"
                    size={16}
                    color={theme.colors.error || '#EF4444'}
                  />
                  <Text
                    style={[
                      styles.secondaryBtnText,
                      { color: theme.colors.error || '#EF4444' },
                    ]}
                  >
                    DISCONNETTI ACCOUNT
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isLogoutConfirmVisible}
        title="DISCONNETTI MYANIMELIST"
        message="VUOI DISCONNETTERE IL TUO ACCOUNT MYANIMELIST DA QUESTO DISPOSITIVO? LA CRONOLOGIA E I PREFERITI LOCALI NON VERRANNO TOCCATI."
        icon="log-out-outline"
        confirmText="DISCONNETTI"
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutConfirmVisible(false)}
      />
    </>
  );
};
