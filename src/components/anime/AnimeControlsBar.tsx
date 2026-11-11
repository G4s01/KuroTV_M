import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';

export interface AnimeControlsBarProps {
  totalEpisodes: number;
  hasBatches: boolean;
  currentBatchLabel: string;
  viewMode: 'grid' | 'list';
  theme: Theme;
  onOpenBatchSheet: () => void;
  onChangeViewMode: (mode: 'grid' | 'list') => void;
}

export const AnimeControlsBar = React.memo<AnimeControlsBarProps>(
  function AnimeControlsBar({
    totalEpisodes,
    hasBatches,
    currentBatchLabel,
    viewMode,
    theme,
    onOpenBatchSheet,
    onChangeViewMode,
  }) {
    const activeIconColor = getContrastTextColor(theme.colors.primary);
    const compactBatchLabel = currentBatchLabel
      .replace(/^EP\.\s*/i, '')
      .trim()
      .toUpperCase();

    return (
      <View
        style={[
          styles.controlsRow,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <View style={styles.controlsLeft}>
          <Text
            style={[styles.sectionHeading, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            PUNTATE ({totalEpisodes})
          </Text>
          {hasBatches && (
            <Pressable
              style={[
                styles.batchSelectorBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onOpenBatchSheet}
              hitSlop={6}
              accessibilityLabel="SELEZIONA BATCH EPISODI"
            >
              <Text
                style={[
                  styles.batchSelectorBtnText,
                  { color: theme.colors.primary },
                ]}
                numberOfLines={1}
              >
                {compactBatchLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={theme.colors.primary}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.controlsRight}>
          <View
            style={[
              styles.viewModeToggle,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Pressable
              style={[
                styles.toggleBtn,
                viewMode === 'grid' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChangeViewMode('grid');
              }}
              hitSlop={6}
              accessibilityLabel="VISTA A GRIGLIA"
            >
              <Ionicons
                name="grid"
                size={16}
                color={viewMode === 'grid' ? activeIconColor : theme.colors.textMuted}
              />
            </Pressable>

            <Pressable
              style={[
                styles.toggleBtn,
                viewMode === 'list' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChangeViewMode('list');
              }}
              hitSlop={6}
              accessibilityLabel="VISTA A LISTA"
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? activeIconColor : theme.colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    rowGap: 10,
    columnGap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    marginTop: 16,
    borderTopWidth: 1,
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  batchSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    minHeight: 36,
    flexShrink: 0,
  },
  batchSelectorBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    padding: 2,
  },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: oledTheme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
