import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { usePendingUpdate, UpdateStore } from '@/services/updater';

export interface UpdateModalProps {
  hasBlockingModal?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = React.memo(({ hasBlockingModal = false }) => {
  const router = useRouter();
  const { theme } = useTheme();
  const { update, isDismissed } = usePendingUpdate();

  if (hasBlockingModal || !update || !update.isUpdateAvailable || !update.manifest || isDismissed) {
    return null;
  }

  const manifest = update.manifest;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const handleLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    UpdateStore.dismissModal();
  };

  const handleUpdateNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    UpdateStore.setAutoDownloadRequested(true);
    UpdateStore.dismissModal();
    router.push({
      pathname: '/(tabs)/settings',
      params: { scrollTo: 'update' },
    });
  };

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
              borderColor: theme.colors.border,
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
                backgroundColor: `${theme.colors.primary}20`,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Ionicons name="cloud-download-outline" size={26} color={theme.colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            AGGIORNAMENTO DISPONIBILE
          </Text>

          {/* Version Info Badge */}
          <View
            style={[
              styles.versionBadge,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.versionText, { color: theme.colors.primary }]}>
              NUOVA VERSIONE V{manifest.version} (BUILD {manifest.versionCode})
            </Text>
          </View>

          {/* Release Notes */}
          {manifest.releaseNotes ? (
            <View style={styles.releaseNotesWrapper}>
              <Text style={[styles.releaseNotesHeader, { color: theme.colors.textMuted }]}>
                NOVITÀ DI QUESTO RILASCIO:
              </Text>
              <ScrollView
                style={[
                  styles.releaseNotesScroll,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.releaseNotesText, { color: theme.colors.textSecondary }]}>
                  {manifest.releaseNotes.toUpperCase()}
                </Text>
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.modalMessage, { color: theme.colors.textSecondary }]}>
              È DISPONIBILE UNA NUOVA VERSIONE DI KURO MOBILE. AGGIORNA ORA PER OTTENERE LE ULTIME FUNZIONALITÀ E MIGLIORAMENTI.
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleLater}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="AGGIORNA PIÙ TARDI"
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textMuted }]}>
                PIÙ TARDI
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={handleUpdateNow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="AGGIORNA ADESSO"
            >
              <Ionicons name="arrow-down-circle" size={16} color={primaryContrast} />
              <Text style={[styles.confirmButtonText, { color: primaryContrast }]}>
                AGGIORNA ORA
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  versionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  modalMessage: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  releaseNotesWrapper: {
    width: '100%',
    gap: 6,
  },
  releaseNotesHeader: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  releaseNotesScroll: {
    maxHeight: 120,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  releaseNotesText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 6,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
  },
  confirmButton: {},
  confirmButtonText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
  },
});
