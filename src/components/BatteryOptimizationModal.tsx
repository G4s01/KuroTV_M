import React, { useEffect, useRef } from 'react';
import {
  AppState,
  type AppStateStatus,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { usePendingUpdate } from '@/services/updater';
import { BatteryService, BatteryStore, useBatteryOptimization } from '@/services/battery';

export interface BatteryOptimizationModalProps {
  hasBlockingModal?: boolean;
}

export const BatteryOptimizationModal: React.FC<BatteryOptimizationModalProps> = React.memo(({
  hasBlockingModal = false,
}) => {
  const { theme } = useTheme();
  const pathname = usePathname();
  const {
    update,
    isDismissed: isUpdateDismissed,
    autoDownload,
    startupCheckFinished,
    updateFlowAccepted,
  } = usePendingUpdate();
  const batteryState = useBatteryOptimization();

  const hasVisibleUpdateModal = Boolean(
    update?.isUpdateAvailable && update?.manifest && !isUpdateDismissed
  );
  const isUpdateFlowActive = Boolean(autoDownload || updateFlowAccepted);

  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAppStateRef = useRef<AppStateStatus>((AppState.currentState || 'active') as AppStateStatus);
  const wentToBackgroundRef = useRef<boolean>((AppState.currentState || 'active') === 'background');
  const pathnameRef = useRef<string>(pathname);
  pathnameRef.current = pathname;
  const hasPlayedSuccessHapticRef = useRef(false);

  const clearVerifyTimer = () => {
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  };

  // Refresh battery status once on mount
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    BatteryStore.refreshStatus();
  }, []);

  // Coordinate startup presentation with secondary priority relative to UpdateModal
  const isEligibleToReveal = BatteryStore.shouldShowStartupModal({
    startupUpdateCheckFinished: startupCheckFinished,
    hasVisibleUpdateModal,
    isUpdateFlowActive,
    hasBlockingModal,
    currentPathname: pathname,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (!isEligibleToReveal || batteryState.isStartupModalPresented) {
      return;
    }

    revealTimerRef.current = setTimeout(() => {
      const latest = BatteryStore.refreshStatus();
      const stillEligible = BatteryStore.shouldShowStartupModal({
        startupUpdateCheckFinished: startupCheckFinished,
        hasVisibleUpdateModal,
        isUpdateFlowActive,
        hasBlockingModal,
        currentPathname: pathname,
      });
      if (stillEligible && !latest.isUnrestricted) {
        hasPlayedSuccessHapticRef.current = false;
        BatteryStore.setStartupModalPresented(true);
      }
    }, 350);

    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [
    isEligibleToReveal,
    batteryState.isStartupModalPresented,
    startupCheckFinished,
    hasVisibleUpdateModal,
    isUpdateFlowActive,
    hasBlockingModal,
    pathname,
  ]);

  // Listen for native return events and AppState transitions to verify application
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const scheduleVerificationFallback = () => {
      clearVerifyTimer();
      verifyTimerRef.current = setTimeout(() => {
        BatteryStore.verifyAfterReturn();
      }, 250);
    };

    const unsubNative = BatteryService.subscribeNativeStatusChange((latestStatus) => {
      BatteryStore.applyNativeStatusUpdate(latestStatus);
      const currentVerState = BatteryStore.getState().verificationState;
      if (!latestStatus.isUnrestricted && currentVerState === 'awaiting_return') {
        scheduleVerificationFallback();
      } else if (latestStatus.isUnrestricted) {
        clearVerifyTimer();
      }
    });

    const subAppState = AppState.addEventListener('change', (nextState) => {
      const prevState = prevAppStateRef.current;
      prevAppStateRef.current = nextState;

      if (nextState === 'background') {
        wentToBackgroundRef.current = true;
        return;
      }

      if (prevState !== 'active' && nextState === 'active') {
        const returnedFromBackground = wentToBackgroundRef.current || prevState === 'background';
        wentToBackgroundRef.current = false;

        const latestStatus = BatteryStore.refreshStatus();
        const currentVerState = BatteryStore.getState().verificationState;
        if (!latestStatus.isUnrestricted && currentVerState === 'awaiting_return') {
          scheduleVerificationFallback();
        } else if (latestStatus.isUnrestricted) {
          clearVerifyTimer();
        }

        const currentPath = pathnameRef.current || '';
        const isExcludedRoute =
          currentPath.startsWith('/player') || currentPath.startsWith('/settings/about');
        if (returnedFromBackground && !latestStatus.isUnrestricted && !isExcludedRoute) {
          BatteryStore.resetDismissedOnAppReopen();
        }
      }
    });

    return () => {
      clearVerifyTimer();
      unsubNative();
      subAppState.remove();
    };
  }, []);

  const isVisible =
    Platform.OS === 'android' &&
    batteryState.isStartupModalPresented &&
    BatteryStore.shouldShowStartupModal({
      startupUpdateCheckFinished: startupCheckFinished,
      hasVisibleUpdateModal,
      isUpdateFlowActive,
      hasBlockingModal,
      currentPathname: pathname,
    });

  // Celebrate verification success and auto-dismiss cleanly
  useEffect(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (isVisible && batteryState.verificationState === 'verified') {
      if (!hasPlayedSuccessHapticRef.current) {
        hasPlayedSuccessHapticRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      autoCloseTimerRef.current = setTimeout(() => {
        BatteryStore.dismissForSession();
      }, 1800);
    }

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [isVisible, batteryState.verificationState]);

  if (!isVisible) {
    return null;
  }

  const isVerified = batteryState.verificationState === 'verified';
  const isAwaiting = batteryState.verificationState === 'awaiting_return';
  const isNotApplied = batteryState.verificationState === 'not_applied';

  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const warningColor = theme.colors.warning || '#F59E0B';
  const successColor = theme.colors.success || '#22C55E';
  const badgeColor = isVerified
    ? successColor
    : isNotApplied
      ? warningColor
      : theme.colors.primary;

  const handleLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    clearVerifyTimer();
    BatteryStore.dismissForSession();
  };

  const handleSilenceForever = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    clearVerifyTimer();
    BatteryStore.silencePrompt(true);
  };

  const handlePrimaryAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isVerified) {
      BatteryStore.dismissForSession();
      return;
    }
    if (isNotApplied) {
      BatteryStore.openSystemSettings();
      return;
    }
    if (isAwaiting) {
      const latest = BatteryStore.verifyAfterReturn();
      if (!latest.isUnrestricted) {
        BatteryStore.openSystemSettings();
      }
      return;
    }
    BatteryStore.startUnrestrictedRequest();
  };

  const handleOpenAppSettingsManual = () => {
    Haptics.selectionAsync().catch(() => {});
    BatteryStore.openSystemSettings();
  };

  const handleManualVerify = () => {
    Haptics.selectionAsync().catch(() => {});
    BatteryStore.verifyAfterReturn();
  };

  const statusText = isVerified
    ? 'STATO: NESSUNA RESTRIZIONE'
    : isAwaiting
      ? 'IN ATTESA DI CONFERMA...'
      : isNotApplied
        ? 'RESTRIZIONE ANCORA ATTIVA'
        : 'STATO: CON RESTRIZIONI';

  const messageText = isVerified
    ? 'OTTIMIZZAZIONE BATTERIA DISABILITATA CON SUCCESSO. DOWNLOAD, PLAYER IN BACKGROUND E KUROSYNC OPERERANNO SENZA RESTRIZIONI.'
    : isNotApplied
      ? "L'IMPOSTAZIONE NON È ANCORA STATA APPLICATA. APRI LE IMPOSTAZIONI BATTERIA DELL'APP E SELEZIONA 'NESSUNA RESTRIZIONE'."
      : isAwaiting
        ? "CONFERMA LA RICHIESTA DI SISTEMA OPPURE IMPOSTA 'NESSUNA RESTRIZIONE' NELLE IMPOSTAZIONI BATTERIA DELL'APP."
        : "PER EVITARE INTERRUZIONI DI DOWNLOAD, RIPRODUZIONE IN BACKGROUND E SINCRONIZZAZIONE, IMPOSTA IL RISPARMIO ENERGETICO DI KUROTV SU 'NESSUNA RESTRIZIONE'.";

  const primaryBtnText = isVerified
    ? 'CONTINUA'
    : isNotApplied || isAwaiting
      ? 'APRI IMPOSTAZIONI BATTERIA'
      : 'IMPOSTA NESSUNA RESTRIZIONE';

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleLater}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={handleLater}
        accessibilityRole="none"
      >
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: isVerified ? successColor : theme.colors.border,
            },
          ]}
          onPress={(e) => {
            if (e && typeof e.stopPropagation === 'function') {
              e.stopPropagation();
            }
          }}
        >
          {/* Icon Badge */}
          <View
            style={[
              styles.modalIconBadge,
              {
                backgroundColor: `${badgeColor}20`,
                borderColor: badgeColor,
              },
            ]}
          >
            <Ionicons
              name={
                isVerified
                  ? 'checkmark-circle-outline'
                  : isNotApplied
                    ? 'alert-circle-outline'
                    : 'battery-charging-outline'
              }
              size={26}
              color={badgeColor}
            />
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {isVerified ? 'NESSUNA RESTRIZIONE ATTIVA' : 'RISPARMIO ENERGETICO'}
          </Text>

          {/* Status Pill */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isVerified
                  ? `${successColor}18`
                  : isNotApplied
                    ? `${warningColor}18`
                    : theme.colors.card,
                borderColor: isVerified
                  ? successColor
                  : isNotApplied
                    ? warningColor
                    : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: isVerified
                    ? successColor
                    : isNotApplied
                      ? warningColor
                      : theme.colors.primary,
                },
              ]}
            >
              {statusText}
            </Text>
          </View>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: theme.colors.textSecondary }]}>
            {messageText}
          </Text>

          {/* Primary Action */}
          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: isVerified ? successColor : theme.colors.primary,
                borderColor: isVerified ? successColor : theme.colors.primary,
              },
            ]}
            onPress={handlePrimaryAction}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={primaryBtnText}
          >
            <Ionicons
              name={isVerified ? 'checkmark-done' : 'settings-outline'}
              size={17}
              color={isVerified ? getContrastTextColor(successColor) : primaryContrast}
            />
            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: isVerified ? getContrastTextColor(successColor) : primaryContrast,
                },
              ]}
            >
              {primaryBtnText}
            </Text>
          </Pressable>

          {/* Verification / Manual Settings quick actions when restricted */}
          {!isVerified && (isAwaiting || isNotApplied) ? (
            <Pressable
              style={[
                styles.verifyButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleManualVerify}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="VERIFICA APPLICAZIONE"
            >
              <Ionicons name="refresh-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.verifyButtonText, { color: theme.colors.primary }]}>
                HO GIÀ IMPOSTATO • VERIFICA STATO
              </Text>
            </Pressable>
          ) : !isVerified ? (
            <Pressable
              style={[
                styles.verifyButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleOpenAppSettingsManual}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="APRI DIRETTAMENTE IMPOSTAZIONI BATTERIA"
            >
              <Ionicons name="open-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.verifyButtonText, { color: theme.colors.textSecondary }]}>
                APRI DIRETTAMENTE IMPOSTAZIONI BATTERIA
              </Text>
            </Pressable>
          ) : null}

          {/* Secondary Dismiss / Silence Actions */}
          {!isVerified ? (
            <View style={styles.secondaryRow}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={handleLater}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="PIÙ TARDI"
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.textMuted }]}>
                  PIÙ TARDI
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={handleSilenceForever}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="NON CHIEDERE PIÙ"
              >
                <Ionicons name="notifications-off-outline" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.secondaryButtonText, { color: theme.colors.textMuted }]}>
                  NON CHIEDERE PIÙ
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: oledTheme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  modalIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  primaryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  verifyButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  verifyButtonText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
