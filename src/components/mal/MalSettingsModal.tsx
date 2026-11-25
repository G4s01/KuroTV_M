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
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MalAuthService,
  MalSyncService,
  clearMalIgnoredAnimeIds,
  getEffectiveMalClientId,
  getMalIgnoredAnimeIds,
  getMalSettings,
  isValidMalClientId,
  saveMalSettings,
  setStoredMalClientId,
  type MalAudioPreference,
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

  React.useEffect(() => {
    if (isVisible) {
      setSettings(getMalSettings());
      setIgnoredCount(getMalIgnoredAnimeIds().length);
      setPendingCount(MalSyncService.getPendingUpdatesCount());
      setFeedbackMsg(null);
      lastClientIdRef.current = getEffectiveMalClientId();
      setInputKey((k) => k + 1);
    }
  }, [isVisible]);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const { translateY, dragStripHandlers, headerPanHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose: handleClose,
  });

  const authStatus = MalAuthService.getStatus();

  const handleToggleAutoSync = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const next = saveMalSettings({ autoSyncOnComplete: !settings.autoSyncOnComplete });
    setSettings(next);
    onSettingsChanged?.();
  }, [settings.autoSyncOnComplete, onSettingsChanged]);

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
              {/* Auto-Sync Player Opt-In Toggle */}
              <Pressable
                style={[
                  styles.diffRow,
                  {
                    marginBottom: 0,
                    backgroundColor: theme.colors.surface,
                    borderColor: settings.autoSyncOnComplete
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                onPress={handleToggleAutoSync}
                accessibilityRole="switch"
                accessibilityState={{ checked: settings.autoSyncOnComplete }}
                accessibilityLabel="AUTO-SYNC AL COMPLETAMENTO EPISODIO"
              >
                <View style={styles.diffBody}>
                  <Text style={[styles.diffTitle, { color: theme.colors.text }]}>
                    AUTO-SYNC AL COMPLETAMENTO
                  </Text>
                  <Text style={[styles.diffTransition, { color: theme.colors.textSecondary }]}>
                    AGGIORNA MAL AUTOMATICAMENTE QUANDO COMPLETI UN EPISODIO NEL PLAYER
                  </Text>
                </View>

                <View
                  style={{
                    minWidth: 50,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    backgroundColor: settings.autoSyncOnComplete
                      ? theme.colors.primary
                      : theme.colors.card,
                    borderColor: settings.autoSyncOnComplete
                      ? theme.colors.primary
                      : theme.colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={[
                      styles.secondaryBtnText,
                      {
                        color: settings.autoSyncOnComplete
                          ? primaryContrast
                          : theme.colors.textMuted,
                      },
                    ]}
                  >
                    {settings.autoSyncOnComplete ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </Pressable>

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
