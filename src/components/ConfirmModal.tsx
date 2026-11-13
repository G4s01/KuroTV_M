import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  confirmText?: string;
  confirmColor?: string;
  cancelText?: string;
  singleAction?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = React.memo(({
  visible,
  title,
  message,
  icon = 'trash-outline',
  iconColor,
  confirmText = 'CONFERMA',
  confirmColor,
  cancelText = 'ANNULLA',
  singleAction = false,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();

  const effectiveIconColor = iconColor || theme.colors.error || '#EF4444';
  const effectiveConfirmColor = confirmColor || theme.colors.error || '#EF4444';
  const confirmTextColor = getContrastTextColor(effectiveConfirmColor);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCancel?.();
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleCancel}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={handleCancel}
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
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon Badge */}
          <View
            style={[
              styles.modalIconBadge,
              {
                backgroundColor: `${effectiveIconColor}20`,
                borderColor: effectiveIconColor,
              },
            ]}
          >
            <Ionicons name={icon} size={24} color={effectiveIconColor} />
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: theme.colors.textSecondary }]}>
            {message}
          </Text>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            {!singleAction && (
              <Pressable
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
                onPress={handleCancel}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>
                  {cancelText}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.modalConfirmBtn,
                {
                  backgroundColor: effectiveConfirmColor,
                  flex: singleAction ? 1 : undefined,
                  minWidth: singleAction ? '100%' : 120,
                },
              ]}
              onPress={handleConfirm}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text style={[styles.modalConfirmBtnText, { color: confirmTextColor }]}>
                {confirmText}
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
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: oledTheme.radius.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    elevation: 12,
  },
  modalIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalMessage: {
    fontSize: 12,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  modalConfirmBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
});
