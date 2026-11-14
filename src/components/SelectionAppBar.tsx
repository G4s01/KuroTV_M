import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme } from '@/theme';

export interface SelectionAppBarProps {
  title: string;
  totalCount: number;
  showCountBadge?: boolean;
  selectedCount: number;
  isAllSelected: boolean;
  onCancelSelection: () => void;
  onToggleSelectAll: () => void;
  onTrashPress?: () => void;
  showNormalTrash?: boolean;
  normalTrashLabel?: string;
  selectionTrashLabel?: string;
}

/**
 * Shared top app bar supporting both standard header mode and contextual
 * multi-selection mode with select-all, cancel, and top-right trash actions.
 */
export const SelectionAppBar = React.memo<SelectionAppBarProps>(
  function SelectionAppBar({
    title,
    totalCount,
    showCountBadge = true,
    selectedCount,
    isAllSelected,
    onCancelSelection,
    onToggleSelectAll,
    onTrashPress,
    showNormalTrash = false,
    normalTrashLabel = 'SVUOTA',
    selectionTrashLabel = 'RIMUOVI SELEZIONATI',
  }) {
    const { theme } = useTheme();
    const isSelectionMode = selectedCount > 0;
    const errorColor = theme.colors.error || oledTheme.colors.error;

    if (isSelectionMode) {
      return (
        <View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.selectionLeft}>
            <Pressable
              style={styles.touchTarget}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onCancelSelection();
              }}
              accessibilityRole="button"
              accessibilityLabel="ANNULLA SELEZIONE"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="close" size={19} color={theme.colors.text} />
              </View>
            </Pressable>

            <Text
              style={[styles.selectionTitle, { color: theme.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedCount === 1 ? '1 SELEZIONATO' : `${selectedCount} SELEZIONATI`}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.touchTarget}
              onPress={onToggleSelectAll}
              accessibilityRole="button"
              accessibilityLabel={isAllSelected ? 'DESELEZIONA TUTTI' : 'SELEZIONA TUTTI'}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: isAllSelected
                      ? `${theme.colors.primary}20`
                      : theme.colors.card,
                    borderColor: isAllSelected
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-done"
                  size={18}
                  color={isAllSelected ? theme.colors.primary : theme.colors.text}
                />
              </View>
            </Pressable>

            {onTrashPress && (
              <Pressable
                style={styles.touchTarget}
                onPress={onTrashPress}
                accessibilityRole="button"
                accessibilityLabel={selectionTrashLabel}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: `${errorColor}20`,
                      borderColor: errorColor,
                    },
                  ]}
                >
                  <Ionicons name="trash" size={18} color={errorColor} />
                </View>
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {showCountBadge && totalCount > 0 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                {totalCount}
              </Text>
            </View>
          )}
        </View>

        {showNormalTrash && onTrashPress && (
          <Pressable
            style={styles.touchTarget}
            onPress={onTrashPress}
            accessibilityRole="button"
            accessibilityLabel={normalTrashLabel}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="trash-outline" size={20} color={errorColor} />
            </View>
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  appBar: {
    height: 60,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 8,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  selectionLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  touchTarget: {
    minWidth: oledTheme.spacing.minTouchTarget,
    minHeight: oledTheme.spacing.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
