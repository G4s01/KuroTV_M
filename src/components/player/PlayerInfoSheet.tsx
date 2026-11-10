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
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, oledTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { useBottomSheetDragDismiss } from '../useBottomSheetDragDismiss';

export interface PlayerInfoSheetProps {
  isVisible: boolean;
  onClose: () => void;
  animeTitle: string;
  episodeNumber: number;
  totalEpisodes?: number | string;
  episodeTitle?: string;
  episodeDescription?: string;
  animeImage?: string;
  description?: string;
  genres?: string[];
  status?: string;
  releaseYear?: number;
}

export const PlayerInfoSheet: React.FC<PlayerInfoSheetProps> = React.memo(({
  isVisible,
  onClose,
  animeTitle,
  episodeNumber,
  totalEpisodes,
  episodeTitle,
  episodeDescription,
  animeImage,
  description,
  genres = [],
  status,
  releaseYear,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const { translateY, panHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose,
  });

  const safeGenres = Array.isArray(genres) ? genres : [];
  const activeDescription = episodeDescription || description;

  const episodeBadgeText = React.useMemo(() => {
    let text = `EPISODIO ${episodeNumber}`;
    if (totalEpisodes !== undefined && totalEpisodes !== null && totalEpisodes !== '') {
      const str = String(totalEpisodes).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        text += `/${parts[parts.length - 1].trim()}`;
      } else {
        text += `/${str}`;
      }
    }
    return text;
  }, [episodeNumber, totalEpisodes]);

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

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

        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ translateY }],
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
          {/* Draggable Header Area (Drag Handle + Header Row) */}
          <View {...panHandlers} style={styles.dragHeaderArea}>
            {/* Drag Handle Indicator */}
            <View style={styles.dragIndicatorWrapper}>
              <View style={styles.dragIndicator} />
            </View>

            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleGroup}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                <Text
                  style={[styles.headerTitle, { color: theme.colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  SCHEDA INFORMAZIONI
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI SCHEDA INFORMAZIONI"
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: isLandscape ? 260 : Math.min(480, windowHeight * 0.65) }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.topRow, { gap: isLandscape ? 14 : 10 }]}>
              {animeImage ? (
                <Image
                  source={{ uri: animeImage }}
                  style={[
                    styles.poster,
                    {
                      width: isLandscape ? 84 : 76,
                      height: isLandscape ? 120 : 108,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.posterPlaceholder,
                    {
                      width: isLandscape ? 84 : 76,
                      height: isLandscape ? 120 : 108,
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="film-outline" size={32} color={theme.colors.textMuted} />
                </View>
              )}

              <View style={styles.mainInfo}>
                <Text style={[styles.animeTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {animeTitle ? String(animeTitle).toUpperCase() : 'ANIME'}
                </Text>

                <View
                  style={[
                    styles.episodeBadge,
                    { backgroundColor: `${theme.colors.primary}25`, borderColor: theme.colors.primary },
                  ]}
                >
                  <Ionicons name="play-circle" size={14} color={theme.colors.primary} />
                  <Text
                    style={[styles.episodeBadgeText, { color: theme.colors.primary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {episodeBadgeText}
                  </Text>
                </View>

                {(releaseYear || status || totalEpisodes) && (
                  <Text
                    style={[styles.metaText, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {[
                      releaseYear,
                      status,
                      totalEpisodes
                        ? String(totalEpisodes).includes('?')
                          ? `TOT. ${totalEpisodes}`
                          : `${totalEpisodes} EPISODI`
                        : null,
                    ]
                      .filter(Boolean)
                      .map(String)
                      .join(' • ')
                      .toUpperCase()}
                  </Text>
                )}

                {safeGenres.length > 0 && (
                  <View style={styles.genresRow}>
                    {safeGenres.slice(0, 4).map((g) => (
                      <View
                        key={String(g)}
                        style={[
                          styles.genreChip,
                          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        ]}
                      >
                        <Text
                          style={[styles.genreText, { color: theme.colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {String(g).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.synopsisSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                {episodeDescription ? 'TRAMA EPISODIO' : 'TRAMA'}
              </Text>
              <View
                style={[
                  styles.synopsisBox,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.synopsisText, { color: theme.colors.text }]}>
                  {activeDescription
                    ? String(activeDescription).toUpperCase()
                    : 'NESSUNA DESCRIZIONE DISPONIBILE PER QUESTO TITOLO.'}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.bottomCloseBtn,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI SCHEDA INFORMAZIONI"
            >
              <Text style={[styles.bottomCloseBtnText, { color: theme.colors.text }]}>CHIUDI</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

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
  dragHeaderArea: {
    width: '100%',
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  dragIndicator: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  poster: {
    width: 84,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  posterPlaceholder: {
    width: 84,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mainInfo: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
  },
  animeTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
  },
  episodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  episodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  genreChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  genreText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  synopsisSection: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.5,
  },
  synopsisBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  synopsisText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  bottomCloseBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bottomCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: oledTheme.typography.title.fontFamily,
  },
});
