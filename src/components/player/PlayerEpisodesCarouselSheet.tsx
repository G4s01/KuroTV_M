import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Episode } from '@/types';
import { AppStorage } from '@/services/storage';
import { useTheme, getContrastTextColor, oledTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { useBottomSheetDragDismiss } from '../useBottomSheetDragDismiss';

export interface PlayerEpisodesCarouselSheetProps {
  isVisible: boolean;
  onClose: () => void;
  episodes: Episode[];
  currentEpisodeNumber: number;
  animeId?: string;
  animeImage?: string;
  onSelectEpisode: (episode: Episode) => void;
}

const CARD_WIDTH = 176;
const CARD_GAP = 12;

export const PlayerEpisodesCarouselSheet: React.FC<PlayerEpisodesCarouselSheetProps> = React.memo(({
  isVisible,
  onClose,
  episodes,
  currentEpisodeNumber,
  animeId,
  animeImage,
  onSelectEpisode,
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

  // Symmetric horizontal padding to ensure perfect centering in both portrait and landscape
  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

  const flatListRef = React.useRef<any>(null);
  const isMountedRef = React.useRef(true);
  const isSelectingRef = React.useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset selection lock when visibility changes
  React.useEffect(() => {
    if (isVisible) {
      isSelectingRef.current = false;
    }
  }, [isVisible]);

  const initialIndex = React.useMemo(() => {
    if (!episodes || episodes.length === 0) return 0;
    const idx = episodes.findIndex((e) => e?.number === currentEpisodeNumber);
    return idx >= 0 ? Math.max(0, idx - 1) : 0;
  }, [episodes, currentEpisodeNumber]);

  // Safe programmatic scroll to the active episode with promise catch
  const handleScrollToActive = React.useCallback(() => {
    if (!flatListRef.current || !episodes || episodes.length === 0) return;
    try {
      const targetIdx = episodes.findIndex((e) => e?.number === currentEpisodeNumber);
      if (targetIdx >= 0 && targetIdx < episodes.length) {
        flatListRef.current?.scrollToIndex?.({
          index: Math.max(0, targetIdx - 1),
          animated: true,
        });
      }
    } catch {
      // Ignore layout not ready errors gracefully
    }
  }, [episodes, currentEpisodeNumber]);

  React.useEffect(() => {
    if (isVisible && episodes.length > 0) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          handleScrollToActive();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, episodes.length, handleScrollToActive]);

  const cardWidth = isLandscape ? CARD_WIDTH : 152;

  const renderEpisodeCard = React.useCallback(
    ({ item }: { item: Episode }) => {
      if (!item) return null;

      const isCurrent = item.number === currentEpisodeNumber;
      const progress = animeId ? AppStorage.getWatchProgress(animeId, item.number) : null;
      const progressPercent =
        progress && progress.duration > 0
          ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100))
          : 0;

      const coverUri = item.thumbnail || animeImage;

      return (
        <Pressable
          style={[
            styles.card,
            {
              width: cardWidth,
              backgroundColor: theme.colors.surface,
              borderColor: isCurrent ? theme.colors.primary : theme.colors.border,
            },
            isCurrent && styles.cardActive,
          ]}
          onPress={() => {
            if (isSelectingRef.current) return;
            isSelectingRef.current = true;
            Haptics.selectionAsync().catch(() => {});
            onClose();
            if (!isCurrent) {
              setTimeout(() => {
                if (isMountedRef.current) {
                  onSelectEpisode(item);
                }
              }, 60);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={`EPISODIO ${item.number}${isCurrent ? ' IN RIPRODUZIONE' : ''}`}
        >
          <View style={styles.imageContainer}>
            {coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={styles.cardImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.placeholderThumb, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="film-outline" size={28} color={theme.colors.textMuted} />
                <Text style={[styles.placeholderText, { color: theme.colors.textMuted }]}>
                  EP. {item.number}
                </Text>
              </View>
            )}

            {isCurrent ? (
              <View
                style={[
                  styles.currentBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Ionicons
                  name="play"
                  size={12}
                  color={getContrastTextColor(theme.colors.primary)}
                />
                <Text
                  style={[
                    styles.currentBadgeText,
                    { color: getContrastTextColor(theme.colors.primary) },
                  ]}
                >
                  ATTIVO
                </Text>
              </View>
            ) : (
              <View style={styles.epNumberBadge}>
                <Text style={styles.epNumberBadgeText}>EP. {item.number}</Text>
              </View>
            )}

            {progressPercent > 0 && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          <View style={styles.cardMeta}>
            <Text
              style={[
                styles.cardTitle,
                { color: theme.colors.text },
                isCurrent && { color: theme.colors.primary, fontWeight: '800' },
              ]}
              numberOfLines={1}
            >
              {item.title ? String(item.title).toUpperCase() : `EPISODIO ${item.number}`}
            </Text>
            <Text
              style={[styles.cardDesc, { color: theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description
                ? String(item.description).toUpperCase()
                : 'TOCCA PER RIPRODURRE LA PUNTATA'}
            </Text>
          </View>
        </Pressable>
      );
    },
    [currentEpisodeNumber, animeId, animeImage, theme, onSelectEpisode, onClose]
  );

  const keyExtractor = React.useCallback(
    (item: Episode, index: number) =>
      item?.id ? `${item.id}-${item.number ?? index}` : `ep-${item?.number ?? index}-${index}`,
    []
  );

  const ItemSeparator = React.useCallback(
    () => <View style={styles.itemSeparator} />,
    []
  );

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
              paddingBottom: Math.max(24, insets.bottom + 12),
            },
            isTablet && {
              maxWidth: 720,
              width: '100%',
              alignSelf: 'center',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderLeftWidth: 1,
              borderRightWidth: 1,
            },
          ]}
          /* contentPadding={0} */
        >
          {/* Draggable Header Area (Drag Handle + Header Row) */}
          <View {...panHandlers} style={styles.dragHeaderArea}>
            {/* Drag Handle Indicator */}
            <View style={styles.dragIndicatorWrapper}>
              <View style={styles.dragIndicator} />
            </View>

            <View
              style={[
                styles.headerRow,
                {
                  paddingHorizontal: horizontalPadding,
                },
              ]}
            >
              <View style={styles.headerTitleGroup}>
                <Ionicons name="list-outline" size={18} color={theme.colors.primary} />
                <Text
                  style={[styles.sheetTitle, { color: theme.colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  CAROSELLO EPISODI
                </Text>
              </View>

              <View style={styles.headerRightActions}>
                <Text style={[styles.sheetSubtitle, { color: theme.colors.textSecondary }]}>
                  {episodes.length} EPISODI
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="CHIUDI CAROSELLO EPISODI"
                >
                  <Ionicons name="close" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            </View>
          </View>

          <FlashList
            ref={flatListRef}
            data={episodes}
            keyExtractor={keyExtractor}
            renderItem={renderEpisodeCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            maintainVisibleContentPosition={{ disabled: true }}
            initialScrollIndex={initialIndex}
            style={styles.flashList}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
            overrideItemLayout={(layout) => {
              layout.span = 1;
            }}
            ItemSeparatorComponent={ItemSeparator}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            extraData={currentEpisodeNumber}
            onLoad={handleScrollToActive}
          />
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
    maxWidth: 820,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRightActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  sheetSubtitle: {
    fontSize: 10,
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  itemSeparator: {
    width: CARD_GAP,
  },
  flashList: {
    height: 196,
  },
  listContent: {
    minHeight: 184,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardActive: {
    borderWidth: 2,
  },
  imageContainer: {
    width: '100%',
    height: 98,
    position: 'relative',
    backgroundColor: '#0A0A0A',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  currentBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  epNumberBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  epNumberBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressBar: {
    height: '100%',
  },
  cardMeta: {
    padding: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: oledTheme.typography.title.fontFamily,
  },
  cardDesc: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
});
