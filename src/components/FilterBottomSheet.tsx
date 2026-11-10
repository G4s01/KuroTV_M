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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { useResponsiveLayout } from '@/hooks';

export interface FilterState {
  genres?: string[]; // IDs dei generi multipli, es. ['1', '9']
  genre?: string;    // ID del genere singolo (retrocompatibilità)
  year?: string;
  type?: string;     // '0' (Serie), '4' (Film), '1' (OVA), '2' (ONA), '3' (Special)
  status?: string;   // '0' (In corso), '1' (Completato), '2' (Non rilasciato)
  sort?: string;     // '5' (Più recenti data uscita), '1' (Ultime aggiunte), '6' (Più visti), '7' (Meglio valutati), '2' (A-Z), '3' (Z-A)
  dub?: string;      // '1' (Doppiati ITA), '0' (Sottotitolati SUB)
}

export interface FilterBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (newFilters: FilterState) => void;
  onReset: () => void;
}

export const ANIME_GENRES = [
  { id: '3', label: 'Arti Marziali' },
  { id: '5', label: 'Avanguardia' },
  { id: '2', label: 'Avventura' },
  { id: '1', label: 'Azione' },
  { id: '47', label: 'Bambini' },
  { id: '4', label: 'Commedia' },
  { id: '6', label: 'Demoni' },
  { id: '7', label: 'Drammatico' },
  { id: '8', label: 'Ecchi' },
  { id: '9', label: 'Fantasy' },
  { id: '10', label: 'Gioco' },
  { id: '11', label: 'Harem' },
  { id: '43', label: 'Hentai' },
  { id: '13', label: 'Horror' },
  { id: '49', label: 'Isekai' },
  { id: '14', label: 'Josei' },
  { id: '16', label: 'Magia' },
  { id: '18', label: 'Mecha' },
  { id: '19', label: 'Militari' },
  { id: '21', label: 'Mistero' },
  { id: '20', label: 'Musicale' },
  { id: '22', label: 'Parodia' },
  { id: '23', label: 'Polizia' },
  { id: '24', label: 'Psicologico' },
  { id: '46', label: 'Romantico' },
  { id: '26', label: 'Samurai' },
  { id: '28', label: 'Sci-Fi' },
  { id: '27', label: 'Scolastico' },
  { id: '29', label: 'Seinen' },
  { id: '25', label: 'Sentimentale' },
  { id: '30', label: 'Shoujo' },
  { id: '31', label: 'Shoujo Ai' },
  { id: '32', label: 'Shounen' },
  { id: '33', label: 'Shounen Ai' },
  { id: '34', label: 'Slice of Life' },
  { id: '37', label: 'Soprannaturale' },
  { id: '35', label: 'Spazio' },
  { id: '36', label: 'Sport' },
  { id: '12', label: 'Storico' },
  { id: '38', label: 'Superpoteri' },
  { id: '39', label: 'Thriller' },
  { id: '40', label: 'Vampiri' },
  { id: '48', label: 'Veicoli' },
  { id: '41', label: 'Yaoi' },
  { id: '42', label: 'Yuri' },
];

export const ANIME_DUB = [
  { label: 'DOPPIATI', value: '1' },
  { label: 'SOTTOTITOLATI', value: '0' },
];

export const ANIME_TYPES = [
  { label: 'SERIE TV', value: '0' },
  { label: 'FILM ANIME', value: '4' },
  { label: 'OAV', value: '1' },
  { label: 'ONA', value: '2' },
  { label: 'SPECIAL', value: '3' },
];

export const ANIME_STATUSES = [
  { label: 'IN CORSO', value: '0' },
  { label: 'COMPLETATO', value: '1' },
  { label: 'NON RILASCIATO', value: '2' },
];

export const ANIME_SORTS = [
  { label: 'PIÙ RECENTI', value: '5' },
  { label: 'ULTIME AGGIUNTE', value: '1' },
  { label: 'PIÙ VISTI', value: '6' },
  { label: 'MEGLIO VALUTATI', value: '7' },
  { label: 'A-Z', value: '2' },
  { label: 'Z-A', value: '3' },
];

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  isVisible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

  const [selectedGenres, setSelectedGenres] = React.useState<string[]>(() => {
    if (filters.genres && filters.genres.length > 0) return filters.genres;
    if (filters.genre) return [filters.genre];
    return [];
  });
  const [selectedDub, setSelectedDub] = React.useState<string | undefined>(filters.dub);
  const [selectedType, setSelectedType] = React.useState<string | undefined>(filters.type);
  const [selectedStatus, setSelectedStatus] = React.useState<string | undefined>(filters.status);
  const [selectedSort, setSelectedSort] = React.useState<string | undefined>(filters.sort);

  React.useEffect(() => {
    if (filters.genres && filters.genres.length > 0) {
      setSelectedGenres(filters.genres);
    } else if (filters.genre) {
      setSelectedGenres([filters.genre]);
    } else {
      setSelectedGenres([]);
    }
    setSelectedDub(filters.dub);
    setSelectedType(filters.type);
    setSelectedStatus(filters.status);
    setSelectedSort(filters.sort);
  }, [filters, isVisible]);

  const toggleDub = (val: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedDub((prev) => (prev === val ? undefined : val));
  };

  const toggleType = (val: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedType((prev) => (prev === val ? undefined : val));
  };

  const toggleStatus = (val: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedStatus((prev) => (prev === val ? undefined : val));
  };

  const toggleSort = (val: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedSort((prev) => (prev === val ? undefined : val));
  };

  const toggleGenre = (genreId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedGenres((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((id) => id !== genreId);
      }
      return [...prev, genreId];
    });
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onApply({
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      genre: selectedGenres.length === 1 ? selectedGenres[0] : undefined,
      dub: selectedDub,
      type: selectedType,
      status: selectedStatus,
      sort: selectedSort,
    });
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedGenres([]);
    setSelectedDub(undefined);
    setSelectedType(undefined);
    setSelectedStatus(undefined);
    setSelectedSort(undefined);
    onReset();
    onClose();
  };

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const totalActiveInSheet =
    selectedGenres.length +
    (selectedDub ? 1 : 0) +
    (selectedType ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedSort ? 1 : 0);

  const renderFilterButton = (
    item: { label: string; value: string },
    isSelected: boolean,
    onPress: () => void,
    flex = 1,
    accessibilityPrefix = ''
  ) => {
    const contrastColor = isSelected ? primaryContrast : theme.colors.textSecondary;
    return (
      <Pressable
        key={item.value}
        style={[
          styles.chip,
          {
            flex,
            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={onPress}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityPrefix} ${item.label}${isSelected ? ' ATTIVO' : ''}`}
      >
        {isSelected && (
          <Ionicons
            name="checkmark-sharp"
            size={13}
            color={contrastColor}
            style={styles.chipCheckIcon}
          />
        )}
        <Text
          style={[
            styles.chipText,
            { color: contrastColor },
            isSelected && styles.chipTextActive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

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
            isTablet && {
              maxWidth: 620,
              width: '100%',
              alignSelf: 'center',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderLeftWidth: 1,
              borderRightWidth: 1,
            },
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.dragIndicatorWrapper}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Ionicons name="filter-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.title, { color: theme.colors.text }]}>FILTRI DI RICERCA</Text>
              {totalActiveInSheet > 0 && (
                <View style={[styles.headerCountBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[styles.headerCountBadgeText, { color: primaryContrast }]}>
                    {totalActiveInSheet}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerRightActions}>
              <Pressable
                onPress={handleReset}
                hitSlop={12}
                style={styles.resetBtn}
                accessibilityRole="button"
                accessibilityLabel="REIMPOSTA TUTTI I FILTRI"
              >
                <Text style={[styles.resetText, { color: theme.colors.textMuted }]}>REIMPOSTA</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI FILTRI"
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: isLandscape ? 260 : Math.min(480, windowHeight * 0.65) }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Audio: Doppiati e Sottotitolati (Simmetria 50% / 50%) */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>AUDIO</Text>
            <View style={styles.row}>
              {ANIME_DUB.map((item) =>
                renderFilterButton(
                  item,
                  selectedDub === item.value,
                  () => toggleDub(item.value),
                  1,
                  'AUDIO'
                )
              )}
            </View>

            {/* 2. Formato: Row 1 (Serie TV, Film Anime - 50%/50%), Row 2 (OAV, ONA, Special - 33.3% each) */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FORMATO</Text>
            <View style={styles.row}>
              {ANIME_TYPES.slice(0, 2).map((item) =>
                renderFilterButton(
                  item,
                  selectedType === item.value,
                  () => toggleType(item.value),
                  1,
                  'FORMATO'
                )
              )}
            </View>
            <View style={styles.row}>
              {ANIME_TYPES.slice(2).map((item) =>
                renderFilterButton(
                  item,
                  selectedType === item.value,
                  () => toggleType(item.value),
                  1,
                  'FORMATO'
                )
              )}
            </View>

            {/* 3. Stato di Uscita: Row 1 (In Corso, Completato - 50%/50%), Row 2 (Non Rilasciato - 100%) */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>STATO</Text>
            <View style={styles.row}>
              {ANIME_STATUSES.slice(0, 2).map((item) =>
                renderFilterButton(
                  item,
                  selectedStatus === item.value,
                  () => toggleStatus(item.value),
                  1,
                  'STATO'
                )
              )}
            </View>
            <View style={styles.row}>
              {renderFilterButton(
                ANIME_STATUSES[2],
                selectedStatus === ANIME_STATUSES[2].value,
                () => toggleStatus(ANIME_STATUSES[2].value),
                1,
                'STATO'
              )}
            </View>

            {/* 4. Ordinamento: 3 righe simmetriche a 2 colonne (50%/50%) */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ORDINA PER</Text>
            <View style={styles.row}>
              {ANIME_SORTS.slice(0, 2).map((item) =>
                renderFilterButton(
                  item,
                  selectedSort === item.value,
                  () => toggleSort(item.value),
                  1,
                  'ORDINA'
                )
              )}
            </View>
            <View style={styles.row}>
              {ANIME_SORTS.slice(2, 4).map((item) =>
                renderFilterButton(
                  item,
                  selectedSort === item.value,
                  () => toggleSort(item.value),
                  1,
                  'ORDINA'
                )
              )}
            </View>
            <View style={styles.row}>
              {ANIME_SORTS.slice(4, 6).map((item) =>
                renderFilterButton(
                  item,
                  selectedSort === item.value,
                  () => toggleSort(item.value),
                  1,
                  'ORDINA'
                )
              )}
            </View>

            {/* 5. Generi: Griglia simmetrica a 2 colonne (48.8% / 48.8%) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                GENERI {selectedGenres.length > 0 ? `(${selectedGenres.length} SELEZIONATI)` : ''}
              </Text>
              {selectedGenres.length > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedGenres([]);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.clearSectionText, { color: theme.colors.primary }]}>AZZERA</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.genresGrid}>
              {ANIME_GENRES.map((g) => {
                const active = selectedGenres.includes(g.id);
                const contrastColor = active ? primaryContrast : theme.colors.textSecondary;
                return (
                  <Pressable
                    key={g.id}
                    style={[
                      styles.genreCard,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => toggleGenre(g.id)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`GENERE ${g.label}${active ? ' SELEZIONATO' : ''}`}
                  >
                    {active && (
                      <Ionicons
                        name="checkmark-sharp"
                        size={12}
                        color={contrastColor}
                        style={styles.chipCheckIcon}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        { color: contrastColor },
                        active && styles.chipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleApply}
              accessibilityRole="button"
              accessibilityLabel="APPLICA FILTRI SELEZIONATI"
            >
              <Ionicons name="checkmark-sharp" size={18} color={primaryContrast} />
              <Text style={[styles.applyBtnText, { color: primaryContrast }]}>APPLICA FILTRI</Text>
            </Pressable>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  clearSectionText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipCheckIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  chipTextActive: {
    fontWeight: '800',
  },
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  genreCard: {
    width: '48.8%',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: 14,
  },
  applyBtn: {
    minHeight: oledTheme.spacing.minTouchTarget,
    borderRadius: oledTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
});
