import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { BottomSheet } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';

export interface FilterState {
  genre?: string;
  year?: string;
  type?: string;
  status?: string;
  sort?: string;
}

interface FilterBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (newFilters: FilterState) => void;
  onReset: () => void;
}

const GENRES = [
  'Azione',
  'Avventura',
  'Commedia',
  'Drammatico',
  'Fantasy',
  'Fantascienza',
  'Horror',
  'Mistero',
  'Psicologico',
  'Romantico',
  'Soprannaturale',
  'Slice of Life',
  'Sport',
];

const TYPES = [
  { label: 'TUTTI I TIPI', value: '' },
  { label: 'SERIE TV', value: 'tv' },
  { label: 'FILM ANIME', value: 'movie' },
  { label: 'OAV / SPECIAL', value: 'ova' },
];

const STATUSES = [
  { label: 'TUTTI GLI STATI', value: '' },
  { label: 'IN CORSO', value: 'ongoing' },
  { label: 'COMPLETATO', value: 'completed' },
];

const SORTS = [
  { label: 'PIÙ POPOLARI', value: 'popular' },
  { label: 'PIÙ RECENTI', value: 'recent' },
  { label: 'VALUTAZIONE', value: 'rating' },
];

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  isVisible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  const { theme } = useTheme();
  const [selectedGenre, setSelectedGenre] = React.useState<string | undefined>(filters.genre);
  const [selectedType, setSelectedType] = React.useState<string | undefined>(filters.type);
  const [selectedStatus, setSelectedStatus] = React.useState<string | undefined>(filters.status);
  const [selectedSort, setSelectedSort] = React.useState<string | undefined>(filters.sort);

  React.useEffect(() => {
    setSelectedGenre(filters.genre);
    setSelectedType(filters.type);
    setSelectedStatus(filters.status);
    setSelectedSort(filters.sort);
  }, [filters, isVisible]);

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onApply({
      genre: selectedGenre,
      type: selectedType,
      status: selectedStatus,
      sort: selectedSort,
    });
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedGenre(undefined);
    setSelectedType(undefined);
    setSelectedStatus(undefined);
    setSelectedSort(undefined);
    onReset();
    onClose();
  };

  return (
    <BottomSheet
      isPresented={isVisible}
      onDismiss={onClose}
      showDragIndicator={true}
      containerColor={theme.colors.card}
    >
      <View style={[styles.content, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>FILTRI DI RICERCA</Text>
          <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
            <Text style={[styles.resetText, { color: theme.colors.textMuted }]}>REIMPOSTA</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Tipo */}
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FORMATO</Text>
          <View style={styles.chipRow}>
            {TYPES.map((item) => {
              const active = selectedType === item.value || (!selectedType && !item.value);
              return (
                <Pressable
                  key={item.label}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    active && [
                      styles.chipActive,
                      { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedType(item.value || undefined);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? getContrastTextColor(theme.colors.primary) : theme.colors.textSecondary },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stato */}
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>STATO DI USCITA</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((item) => {
              const active = selectedStatus === item.value || (!selectedStatus && !item.value);
              return (
                <Pressable
                  key={item.label}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    active && [
                      styles.chipActive,
                      { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedStatus(item.value || undefined);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? getContrastTextColor(theme.colors.primary) : theme.colors.textSecondary },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Ordinamento */}
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ORDINA PER</Text>
          <View style={styles.chipRow}>
            {SORTS.map((item) => {
              const active = selectedSort === item.value;
              return (
                <Pressable
                  key={item.label}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    active && [
                      styles.chipActive,
                      { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedSort(item.value);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? getContrastTextColor(theme.colors.primary) : theme.colors.textSecondary },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Generi */}
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>GENERI</Text>
          <View style={styles.chipRow}>
            {GENRES.map((g) => {
              const active = selectedGenre === g;
              return (
                <Pressable
                  key={g}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    active && [
                      styles.chipActive,
                      { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedGenre(active ? undefined : g);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? getContrastTextColor(theme.colors.primary) : theme.colors.textSecondary },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleApply}
          >
            <Ionicons name="checkmark-sharp" size={18} color={getContrastTextColor(theme.colors.primary)} />
            <Text style={[styles.applyBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>APPLICA FILTRI</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: 520,
    backgroundColor: oledTheme.colors.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: oledTheme.colors.text,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  resetBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 12,
    color: oledTheme.colors.textMuted,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  scrollArea: {
    maxHeight: 380,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: oledTheme.colors.textSecondary,
    marginTop: 14,
    marginBottom: 8,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.full,
    backgroundColor: oledTheme.colors.surface,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: oledTheme.colors.primary,
    borderColor: oledTheme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: oledTheme.colors.textSecondary,
    fontWeight: '500',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 16,
  },
  applyBtn: {
    minHeight: oledTheme.spacing.minTouchTarget,
    backgroundColor: oledTheme.colors.primary,
    borderRadius: oledTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
});
