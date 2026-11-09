import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, getContrastTextColor } from '@/theme';

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
    <BottomSheet
      isPresented={isVisible}
      onDismiss={onClose}
      showDragIndicator={true}
      containerColor={theme.colors.card}
      contentPadding={0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.card,
            paddingLeft: horizontalPadding,
            paddingRight: horizontalPadding,
            paddingBottom: Math.max(28, insets.bottom + 12),
          },
        ]}
      >
        <ScrollView
          style={{ maxHeight: isLandscape ? 280 : 480 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {showServerSelection ? 'SORGENTE VIDEO & SERVER' : 'OPZIONI RIPRODUZIONE'}
          </Text>

          {showServerSelection && servers.length > 0 && onSelectServer && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
                SELEZIONA SERVER
              </Text>
              <View style={styles.serverList}>
                {servers.map((server) => {
                  const isSelected = server.id === currentServerId;
                  return (
                    <Pressable
                      key={server.id}
                      style={[
                        styles.serverItem,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        isSelected && [
                          styles.serverItemActive,
                          {
                            borderColor: theme.colors.primary,
                            backgroundColor: `${theme.colors.primary}15`,
                          },
                        ],
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        onSelectServer(server.id);
                        onClose();
                      }}
                    >
                      <View style={styles.serverLeft}>
                        <Ionicons
                          name="server-outline"
                          size={18}
                          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.serverName,
                            { color: theme.colors.text },
                            isSelected && [styles.serverNameActive, { color: theme.colors.primary }],
                          ]}
                        >
                          {server.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {onSelectSpeed && (
            <View style={styles.speedSection}>
              <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
                VELOCITÀ DI RIPRODUZIONE
              </Text>
              <View style={styles.speedRow}>
                {SPEED_OPTIONS.map((speed) => {
                  const isSelected = Math.abs(currentSpeed - speed) < 0.01;
                  return (
                    <Pressable
                      key={speed}
                      style={[
                        styles.speedChip,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        isSelected && [
                          styles.speedChipActive,
                          { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                        ],
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        onSelectSpeed(speed);
                        onClose();
                      }}
                    >
                      <Text
                        style={[
                          styles.speedText,
                          {
                            color: isSelected
                              ? getContrastTextColor(theme.colors.primary)
                              : theme.colors.textSecondary,
                          },
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
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  serverList: {
    gap: 8,
    marginBottom: 16,
  },
  serverItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  serverItemActive: {
    borderWidth: 1.5,
  },
  serverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serverName: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  serverNameActive: {
    fontWeight: '700',
  },
  speedSection: {
    width: '100%',
    marginTop: 4,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  speedChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 2,
  },
  speedChipActive: {
    borderWidth: 1.5,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  speedTextActive: {
    fontWeight: '800',
  },
});
