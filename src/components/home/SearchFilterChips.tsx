import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import {
  type FilterState,
  ANIME_GENRES,
  ANIME_TYPES,
  ANIME_STATUSES,
  ANIME_SORTS,
} from '@/components/FilterBottomSheet';
import { homeStyles as styles } from './home.styles';

export interface SearchFilterChipsProps {
  filterState: FilterState;
  activeGenres: string[];
  onRemoveFilter: (key: keyof FilterState) => void;
  onRemoveGenre: (genreId: string) => void;
}

export function SearchFilterChips({
  filterState,
  activeGenres,
  onRemoveFilter,
  onRemoveGenre,
}: SearchFilterChipsProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.activeFiltersRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
        {filterState.dub && (
          <Pressable
            style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onRemoveFilter('dub')}
          >
            <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
              AUDIO: {filterState.dub === '1' ? 'DOPPIATI (ITA)' : 'SUB ITA'}
            </Text>
            <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
          </Pressable>
        )}
        {filterState.type && (
          <Pressable
            style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onRemoveFilter('type')}
          >
            <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
              TIPO: {(ANIME_TYPES.find((t) => t.value === filterState.type)?.label || filterState.type).toUpperCase()}
            </Text>
            <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
          </Pressable>
        )}
        {filterState.status && (
          <Pressable
            style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onRemoveFilter('status')}
          >
            <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
              STATO: {(ANIME_STATUSES.find((s) => s.value === filterState.status)?.label || filterState.status).toUpperCase()}
            </Text>
            <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
          </Pressable>
        )}
        {filterState.sort && (
          <Pressable
            style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onRemoveFilter('sort')}
          >
            <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
              ORDINA: {(ANIME_SORTS.find((s) => s.value === filterState.sort)?.label || filterState.sort).toUpperCase()}
            </Text>
            <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
          </Pressable>
        )}
        {activeGenres.map((gId) => {
          const genreLabel = ANIME_GENRES.find((g) => g.id === gId)?.label || gId;
          return (
            <Pressable
              key={`active-genre-${gId}`}
              style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => onRemoveGenre(gId)}
            >
              <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                GENERE: {genreLabel.toUpperCase()}
              </Text>
              <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
