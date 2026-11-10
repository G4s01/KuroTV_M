import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { SearchHistoryItem } from '@/services/storage';
import { homeStyles as styles } from './home.styles';

export interface SearchHistoryListProps {
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  items: SearchHistoryItem[];
  isHistoryActive: boolean;
  onSelectQuery: (query: string) => void;
  onDeleteItem: (query: string) => void;
  onClearAll: () => void;
}

export function SearchHistoryList({
  title = 'RICERCHE RECENTI',
  icon = 'time-outline',
  items,
  isHistoryActive,
  onSelectQuery,
  onDeleteItem,
  onClearAll,
}: SearchHistoryListProps) {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={styles.searchHistoryContainer}
      contentContainerStyle={styles.searchHistoryContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {isHistoryActive ? (
        items.length > 0 ? (
          <>
            <View style={styles.searchHistoryHeader}>
              <View style={styles.searchHistoryTitleRow}>
                <Ionicons name={icon} size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.searchHistoryTitle, { color: theme.colors.textSecondary }]}>
                  {title}
                </Text>
              </View>
              <Pressable
                onPress={onClearAll}
                hitSlop={8}
                style={styles.clearAllSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="CANCELLA TUTTA LA CRONOLOGIA DI RICERCA"
              >
                <Text style={[styles.clearAllSearchText, { color: theme.colors.textMuted }]}>
                  CANCELLA TUTTE
                </Text>
              </Pressable>
            </View>

            <View style={[styles.searchHistoryList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {items.map((item, index) => (
                <View
                  key={`${item.query}-${item.timestamp}-${index}`}
                  style={[
                    styles.searchHistoryItem,
                    index < items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}
                >
                  <Pressable
                    style={styles.searchHistoryItemContent}
                    onPress={() => onSelectQuery(item.query)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`CERCA ${item.query.toUpperCase()}`}
                  >
                    <Ionicons name={icon} size={18} color={theme.colors.textMuted} style={styles.searchHistoryItemIcon} />
                    <Text style={[styles.searchHistoryItemText, { color: theme.colors.text }]} numberOfLines={1}>
                      {item.query.toUpperCase()}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.searchHistoryDeleteBtn}
                    onPress={() => onDeleteItem(item.query)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`ELIMINA ${item.query.toUpperCase()} DALLA CRONOLOGIA`}
                  >
                    <Ionicons name="close-outline" size={20} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.centerBox}>
            <Ionicons name="search-outline" size={44} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              DIGITA UN TITOLO PER CERCARE O UTILIZZA I FILTRI
            </Text>
          </View>
        )
      ) : (
        <View style={styles.centerBox}>
          <Ionicons name={icon} size={44} color={theme.colors.textMuted} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            CRONOLOGIA DI RICERCA DISATTIVATA
          </Text>
          <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>
            PUOI ATTIVARLA NELLA SCHEDA IMPOSTAZIONI DELL&apos;APP
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
