import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  clearMalPrimaryMapping,
  getMappingByMalId,
  searchAnimeWorldCandidatesForMalPicker,
  setManualAnimeMalMapping,
  type MalAnimeListEntry,
  type MalPickerCandidate,
} from '@/services/mal';
import { malStyles as styles } from './mal.styles';

export interface MalMatchPickerModalProps {
  isVisible: boolean;
  entry: MalAnimeListEntry | null;
  reason?: 'multiple_variants' | 'no_exact_match' | 'manual_remap';
  initialCandidates: MalPickerCandidate[];
  onClose: () => void;
  onSelectCandidate: (candidate: MalPickerCandidate) => void;
  onMappingCleared?: (malId: number) => void;
}

export const MalMatchPickerModal: React.FC<MalMatchPickerModalProps> = ({
  isVisible,
  entry,
  reason = 'multiple_variants',
  initialCandidates,
  onClose,
  onSelectCandidate,
  onMappingCleared,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [candidates, setCandidates] = React.useState<MalPickerCandidate[]>(initialCandidates);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [inputKey, setInputKey] = React.useState(0);
  const searchInputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const lastQueryRef = React.useRef('');
  const [hasSearchText, setHasSearchText] = React.useState(false);

  React.useEffect(() => {
    if (isVisible && entry) {
      setCandidates(initialCandidates);
      setSearchError(null);
      const q = entry.title || '';
      lastQueryRef.current = q;
      setHasSearchText(q.trim().length > 0);
      setInputKey((k) => k + 1);
    }
  }, [isVisible, entry, initialCandidates]);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const { translateY, dragStripHandlers, headerPanHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose: handleClose,
  });

  const handleQueryChange = React.useCallback((text: string) => {
    lastQueryRef.current = text;
    const nextHas = text.trim().length > 0;
    setHasSearchText((prev) => (prev !== nextHas ? nextHas : prev));
  }, []);

  const handleSearch = React.useCallback(async () => {
    const q = lastQueryRef.current.trim();
    if (!q || isSearching) return;
    Keyboard.dismiss();
    Haptics.selectionAsync().catch(() => {});
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchAnimeWorldCandidatesForMalPicker(q);
      setCandidates(results);
      if (results.length === 0) {
        setSearchError('NESSUN RISULTATO TROVATO SU ANIMEWORLD.');
      }
    } catch (err: any) {
      setSearchError((err?.message || 'RICERCA FALLITA.').toUpperCase());
    } finally {
      setIsSearching(false);
    }
  }, [isSearching]);

  const handleClearSearch = React.useCallback(() => {
    lastQueryRef.current = '';
    setHasSearchText(false);
    setInputKey((k) => k + 1);
  }, []);

  const handlePick = React.useCallback(
    (cand: MalPickerCandidate) => {
      if (!entry) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setManualAnimeMalMapping({
        malId: entry.malId,
        animeId: cand.id,
        title: cand.title,
        totalEpisodes: cand.totalEpisodes,
        status: cand.status,
        state: cand.state,
        audio: cand.audio,
      });
      onSelectCandidate(cand);
    },
    [entry, onSelectCandidate]
  );

  const currentMapping = entry ? getMappingByMalId(entry.malId) : null;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);
  const listHeight = isLandscape
    ? Math.min(180, Math.max(120, windowHeight * 0.36))
    : Math.min(310, Math.max(180, windowHeight * 0.42));

  const subtitleText =
    reason === 'multiple_variants'
      ? 'TROVATE PIÙ VERSIONI (SUB / ITA). SCEGLI QUALE APRIRE:'
      : reason === 'manual_remap'
      ? 'SCEGLI O CERCA LA SCHEDA ANIMEWORLD DA ASSOCIARE:'
      : 'NESSUN ID MAL ESATTO TROVATO. SELEZIONA O CERCA MANUALMENTE:';

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.sheetOverlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ translateY }],
              paddingHorizontal: horizontalPadding,
              paddingBottom: Math.max(24, insets.bottom + 14),
            },
            isTablet && {
              maxWidth: 620,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            },
          ]}
        >
          <View {...dragStripHandlers} style={styles.dragStripArea}>
            <View style={styles.dragIndicator} />
          </View>

          <View
            {...headerPanHandlers}
            style={[styles.sheetHeaderRow, { borderBottomColor: theme.colors.border }]}
          >
            <View style={styles.sheetHeaderLeft}>
              <Ionicons name="git-branch-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {entry?.title || 'ASSOCIA ANIMEWORLD'}
              </Text>
            </View>

            <Pressable
              style={styles.sheetCloseBtn}
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI SELEZIONE ANIMEWORLD"
            >
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ paddingTop: 12, gap: 10 }}>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, textAlign: 'left', maxWidth: '100%' }]}>
              {subtitleText}
            </Text>

            {/* Uncontrolled Search Box */}
            <View style={styles.searchAndSortRow}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="search" size={16} color={theme.colors.textMuted} />
                <TextInput
                  key={inputKey}
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="CERCA SU ANIMEWORLD..."
                  placeholderTextColor={theme.colors.textMuted}
                  defaultValue={lastQueryRef.current}
                  onChangeText={handleQueryChange}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  disableFullscreenUI={true}
                />
                {hasSearchText && (
                  <Pressable
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                    onPress={handleClearSearch}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="CANCELLA TESTO RICERCA"
                  >
                    <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.colors.primary, paddingHorizontal: 14 },
                ]}
                onPress={handleSearch}
                disabled={isSearching}
                accessibilityRole="button"
                accessibilityLabel="CERCA CANDIDATI ANIMEWORLD"
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={primaryContrast} />
                ) : (
                  <Text style={[styles.primaryBtnText, { color: primaryContrast }]}>CERCA</Text>
                )}
              </Pressable>
            </View>

            {searchError ? (
              <Text style={[styles.inlineBannerText, { color: theme.colors.warning || '#F59E0B', flex: 0 }]}>
                {searchError}
              </Text>
            ) : null}

            <View style={{ height: listHeight, width: '100%' }}>
              <FlashList
                data={candidates}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition={{ disabled: true }}
                nestedScrollEnabled={true}
                renderItem={({ item }) => {
                  const isCurrentPrimary = currentMapping?.primaryAnimeId === item.id;
                  return (
                    <Pressable
                      style={[
                        styles.diffRow,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: isCurrentPrimary
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                      onPress={() => handlePick(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`SELEZIONA ${item.title} (${item.audio.toUpperCase()})`}
                    >
                      {item.thumbnail ? (
                        <Image
                          source={{ uri: item.thumbnail }}
                          style={{ width: 40, height: 56, borderRadius: 6, backgroundColor: '#161616' }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View
                          style={{
                            width: 40,
                            height: 56,
                            borderRadius: 6,
                            backgroundColor: theme.colors.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="film-outline" size={18} color={theme.colors.textMuted} />
                        </View>
                      )}

                      <View style={styles.diffBody}>
                        <Text
                          style={[styles.diffTitle, { color: theme.colors.text }]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        <View style={styles.cardMetaRow}>
                          <View
                            style={[
                              styles.metaChip,
                              {
                                backgroundColor:
                                  item.audio === 'ita'
                                    ? `${theme.colors.primary}20`
                                    : theme.colors.card,
                                borderColor:
                                  item.audio === 'ita'
                                    ? theme.colors.primary
                                    : theme.colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.metaChipText,
                                {
                                  color:
                                    item.audio === 'ita'
                                      ? theme.colors.primary
                                      : theme.colors.text,
                                },
                              ]}
                            >
                              {item.audio.toUpperCase()}
                            </Text>
                          </View>

                          {item.exactMalMatch && (
                            <View
                              style={[
                                styles.metaChip,
                                {
                                  backgroundColor: `${theme.colors.success || '#10B981'}18`,
                                  borderColor: theme.colors.success || '#10B981',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.metaChipText,
                                  { color: theme.colors.success || '#10B981' },
                                ]}
                              >
                                ID MAL ESATTO
                              </Text>
                            </View>
                          )}

                          {isCurrentPrimary && (
                            <View
                              style={[
                                styles.metaChip,
                                {
                                  backgroundColor: theme.colors.primary,
                                  borderColor: theme.colors.primary,
                                },
                              ]}
                            >
                              <Text style={[styles.metaChipText, { color: primaryContrast }]}>
                                ATTUALE
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
                    <Ionicons name="search-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                      {isSearching
                        ? 'RICERCA SU ANIMEWORLD IN CORSO...'
                        : 'NESSUN RISULTATO. MODIFICA IL TITOLO E PREMI CERCA.'}
                    </Text>
                  </View>
                }
              />
            </View>

            {currentMapping?.primaryAnimeId && entry && (
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  clearMalPrimaryMapping(entry.malId);
                  onMappingCleared?.(entry.malId);
                  handleClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="RIPRISTINA ASSOCIAZIONE AUTOMATICA"
              >
                <Ionicons name="refresh-outline" size={16} color={theme.colors.textMuted} />
                <Text style={[styles.secondaryBtnText, { color: theme.colors.textMuted }]}>
                  RESETTA ASSOCIAZIONE SALVATA
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
