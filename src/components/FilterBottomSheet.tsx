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

export interface FilterState {
  genre?: string;
  year?: string;
  type?: string;
  status?: string;
  sort?: string;
}

export interface FilterBottomSheetProps {
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

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

  const primaryContrast = getContrastTextColor(theme.colors.primary);

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
            style={{ maxHeight: isLandscape ? 260 : Math.min(460, windowHeight * 0.62) }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Formato / Tipo */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FORMATO</Text>
            <View style={styles.chipRow}>
              {TYPES.map((item) => {
                const active = selectedType === item.value || (!selectedType && !item.value);
                const contrastColor = active ? primaryContrast : theme.colors.textSecondary;
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
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`FORMATO ${item.label}${active ? ' ATTIVO' : ''}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: contrastColor },
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
                const contrastColor = active ? primaryContrast : theme.colors.textSecondary;
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
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`STATO ${item.label}${active ? ' ATTIVO' : ''}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: contrastColor },
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
                const contrastColor = active ? primaryContrast : theme.colors.textSecondary;
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
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`ORDINA PER ${item.label}${active ? ' ATTIVO' : ''}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: contrastColor },
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
                const contrastColor = active ? primaryContrast : theme.colors.textSecondary;
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
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`GENERE ${g}${active ? ' SELEZIONATO' : ''}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: contrastColor },
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {},
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  chipTextActive: {
    fontWeight: '800',
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
