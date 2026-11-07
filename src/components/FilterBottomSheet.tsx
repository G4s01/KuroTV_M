import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { BottomSheet } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

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
  { label: 'Tutti i tipi', value: '' },
  { label: 'Serie TV', value: 'tv' },
  { label: 'Film Anime', value: 'movie' },
  { label: 'OAV / Special', value: 'ova' },
];

const STATUSES = [
  { label: 'Tutti gli stati', value: '' },
  { label: 'In corso', value: 'ongoing' },
  { label: 'Completato', value: 'completed' },
];

const SORTS = [
  { label: 'Più popolari', value: 'popular' },
  { label: 'Più recenti', value: 'recent' },
  { label: 'Valutazione', value: 'rating' },
];

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  isVisible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
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
      containerColor={oledTheme.colors.card}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Filtri di Ricerca</Text>
          <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reimposta</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Tipo */}
          <Text style={styles.sectionTitle}>Formato</Text>
          <View style={styles.chipRow}>
            {TYPES.map((item) => {
              const active = selectedType === item.value || (!selectedType && !item.value);
              return (
                <Pressable
                  key={item.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedType(item.value || undefined);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stato */}
          <Text style={styles.sectionTitle}>Stato di Uscita</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((item) => {
              const active = selectedStatus === item.value || (!selectedStatus && !item.value);
              return (
                <Pressable
                  key={item.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedStatus(item.value || undefined);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Ordinamento */}
          <Text style={styles.sectionTitle}>Ordina per</Text>
          <View style={styles.chipRow}>
            {SORTS.map((item) => {
              const active = selectedSort === item.value;
              return (
                <Pressable
                  key={item.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedSort(item.value);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Generi */}
          <Text style={styles.sectionTitle}>Generi</Text>
          <View style={styles.chipRow}>
            {GENRES.map((g) => {
              const active = selectedGenre === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedGenre(active ? undefined : g);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.applyBtn} onPress={handleApply}>
            <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
            <Text style={styles.applyBtnText}>Applica Filtri</Text>
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
    fontSize: 18,
    fontWeight: '700',
    color: oledTheme.colors.text,
  },
  resetBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 13,
    color: oledTheme.colors.textMuted,
    fontWeight: '600',
  },
  scrollArea: {
    maxHeight: 380,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: oledTheme.colors.textSecondary,
    marginTop: 14,
    marginBottom: 8,
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
    fontSize: 13,
    color: oledTheme.colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '700',
  },
});
