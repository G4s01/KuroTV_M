import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, getContrastTextColor, oledTheme } from '@/theme';

export interface ServerOption {
  id: string;
  name: string;
}

export interface ServerBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  servers?: ServerOption[];
  currentServerId?: string;
  onSelectServer?: (serverId: string) => void;
  currentSpeed?: number;
  onSelectSpeed?: (speed: number) => void;
  showServerSelection?: boolean; // Kept disabled/hidden by default; prepared for future multi-source providers
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export const ServerBottomSheet: React.FC<ServerBottomSheetProps> = ({
  isVisible,
  onClose,
  servers = [],
  currentServerId = '9',
  onSelectServer,
  currentSpeed = 1.0,
  onSelectSpeed,
  showServerSelection = false,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding,
              paddingBottom: Math.max(24, insets.bottom + 12),
            },
          ]}
          /* contentPadding={0} */
        >
          {/* Drag Handle Indicator */}
          <View style={styles.dragIndicatorWrapper}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Ionicons name="options" size={18} color={theme.colors.primary} />
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                OPZIONI DI RIPRODUZIONE
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI OPZIONI RIPRODUZIONE"
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: isLandscape ? 240 : Math.min(380, windowHeight * 0.55) }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Playback Speed Section */}
            {onSelectSpeed && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="speedometer-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    VELOCITÀ DI RIPRODUZIONE
                  </Text>
                </View>

                <View style={styles.speedRow}>
                  {SPEED_OPTIONS.map((speed) => {
                    const isSelected = Math.abs(currentSpeed - speed) < 0.05;
                    const contrastColor = isSelected
                      ? getContrastTextColor(theme.colors.primary)
                      : theme.colors.text;

                    return (
                      <Pressable
                        key={speed}
                        style={[
                          styles.speedChip,
                          {
                            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          onSelectSpeed(speed);
                          onClose();
                        }}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`VELOCITÀ ${speed}X${isSelected ? ' ATTIVA' : ''}`}
                      >
                        <Text
                          style={[
                            styles.speedText,
                            { color: contrastColor },
                            isSelected && styles.speedTextActive,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                        >
                          {speed}X
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Server Selection Section */}
            {showServerSelection && servers.length > 0 && onSelectServer && (
              <View style={[styles.section, { marginTop: 12 }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="server-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    SERVER SORGENTE VIDEO
                  </Text>
                </View>

                <View style={styles.serverList}>
                  {servers.map((server) => {
                    const isSelected = server.id === currentServerId;
                    return (
                      <Pressable
                        key={server.id}
                        style={[
                          styles.serverItem,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                          },
                          isSelected && [
                            styles.serverItemActive,
                            {
                              borderColor: theme.colors.primary,
                              backgroundColor: `${theme.colors.primary}18`,
                            },
                          ],
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          onSelectServer(server.id);
                          onClose();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`SERVER ${server.name}${isSelected ? ' ATTIVO' : ''}`}
                      >
                        <View style={styles.serverInfo}>
                          <Ionicons
                            name="hardware-chip-outline"
                            size={18}
                            color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.serverName,
                              { color: theme.colors.text },
                              isSelected && [
                                styles.serverNameActive,
                                { color: theme.colors.primary },
                              ],
                            ]}
                          >
                            {server.name.toUpperCase()}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={theme.colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 6,
  },
  dragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  speedChip: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  speedTextActive: {
    fontWeight: '900',
  },
  serverList: {
    gap: 8,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },
  serverItemActive: {
    borderWidth: 1.5,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serverName: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  serverNameActive: {
    fontWeight: '900',
  },
});
