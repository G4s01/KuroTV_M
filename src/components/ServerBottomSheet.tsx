import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { BottomSheet } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

interface ServerOption {
  id: string;
  name: string;
}

interface ServerBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  servers: ServerOption[];
  currentServerId: string;
  onSelectServer: (serverId: string) => void;
  currentSpeed?: number;
  onSelectSpeed?: (speed: number) => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export const ServerBottomSheet: React.FC<ServerBottomSheetProps> = ({
  isVisible,
  onClose,
  servers,
  currentServerId,
  onSelectServer,
  currentSpeed = 1.0,
  onSelectSpeed,
}) => {
  return (
    <BottomSheet
      isPresented={isVisible}
      onDismiss={onClose}
      showDragIndicator={true}
      containerColor={oledTheme.colors.card}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Sorgente Video & Server</Text>

        <Text style={styles.sectionHeader}>Seleziona Server</Text>
        <View style={styles.serverList}>
          {servers.map((server) => {
            const isSelected = server.id === currentServerId;
            return (
              <Pressable
                key={server.id}
                style={[styles.serverItem, isSelected && styles.serverItemActive]}
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
                    color={isSelected ? oledTheme.colors.primary : oledTheme.colors.textMuted}
                  />
                  <Text style={[styles.serverName, isSelected && styles.serverNameActive]}>
                    {server.name}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={oledTheme.colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>

        {onSelectSpeed && (
          <>
            <Text style={styles.sectionHeader}>Velocità di Riproduzione</Text>
            <View style={styles.speedRow}>
              {SPEED_OPTIONS.map((speed) => {
                const isSelected = currentSpeed === speed;
                return (
                  <Pressable
                    key={speed}
                    style={[styles.speedChip, isSelected && styles.speedChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      onSelectSpeed(speed);
                    }}
                  >
                    <Text style={[styles.speedText, isSelected && styles.speedTextActive]}>
                      {speed}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: oledTheme.colors.card,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: oledTheme.colors.text,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: oledTheme.colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  serverList: {
    gap: 8,
    marginBottom: 16,
  },
  serverItem: {
    minHeight: oledTheme.spacing.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: oledTheme.colors.surface,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
  serverItemActive: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: '#1C0D0E',
  },
  serverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serverName: {
    fontSize: 14,
    color: oledTheme.colors.text,
    fontWeight: '500',
  },
  serverNameActive: {
    color: oledTheme.colors.primary,
    fontWeight: '700',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  speedChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: oledTheme.colors.surface,
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
  speedChipActive: {
    backgroundColor: oledTheme.colors.primary,
    borderColor: oledTheme.colors.primary,
  },
  speedText: {
    fontSize: 13,
    color: oledTheme.colors.textSecondary,
    fontWeight: '600',
  },
  speedTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
