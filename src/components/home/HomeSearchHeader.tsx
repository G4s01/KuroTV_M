import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getContrastTextColor } from '@/theme';
import { homeStyles as styles } from './home.styles';

export interface HomeSearchHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSubmitSearch?: (query: string) => void;
  onClose: () => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function HomeSearchHeader({
  searchQuery,
  onSearchChange,
  onSubmitSearch,
  onClose,
  activeFilterCount,
  onOpenFilters,
}: HomeSearchHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.searchHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <Pressable
        style={styles.searchBackBtn}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="CHIUDI RICERCA"
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </Pressable>

      <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="CERCA ANIME, SERIE, FILM..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
          onSubmitEditing={() => onSubmitSearch?.(searchQuery)}
          returnKeyType="search"
          autoFocus={true}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => onSearchChange('')}
            hitSlop={12}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA TESTO"
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Pressable
        style={[
          styles.filterBtn,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          activeFilterCount > 0 && {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          },
        ]}
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel="FILTRI DI RICERCA"
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={activeFilterCount > 0 ? getContrastTextColor(theme.colors.primary) : theme.colors.text}
        />
        {activeFilterCount > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: getContrastTextColor(theme.colors.primary) }]}>
            <Text style={[styles.filterBadgeText, { color: theme.colors.primary }]}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export interface HomeAppBarProps {
  onSearchPress: () => void;
  activeDownloadsCount?: number;
  onDownloadsPress?: () => void;
}

export function HomeAppBar({
  onSearchPress,
  activeDownloadsCount = 0,
  onDownloadsPress,
}: HomeAppBarProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.appBar, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <View style={styles.brandRow}>
        <Text style={[styles.brandPrefix, { color: theme.colors.text }]}>KURO</Text>
        <Text style={[styles.brandSuffix, { color: theme.colors.primary }]}>TV</Text>
        <View style={[styles.mobileBadge, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.mobileBadgeText, { color: theme.colors.textSecondary }]}>MOBILE</Text>
        </View>
      </View>

      <View style={styles.appBarActions}>
        {onDownloadsPress && (
          <Pressable
            style={[
              styles.downloadButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: activeDownloadsCount > 0 ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={onDownloadsPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="SCARICATI"
          >
            <Ionicons
              name={activeDownloadsCount > 0 ? 'cloud-download' : 'cloud-download-outline'}
              size={20}
              color={activeDownloadsCount > 0 ? theme.colors.primary : theme.colors.text}
            />
            {activeDownloadsCount > 0 && (
              <View
                style={[
                  styles.downloadBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.downloadBadgeText,
                    { color: getContrastTextColor(theme.colors.primary) },
                  ]}
                >
                  {activeDownloadsCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.searchButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
          onPress={onSearchPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="CERCA ANIME"
        >
          <Ionicons name="search" size={20} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
