import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';
import { Skeleton } from '@/components/skeleton';
import type { AnimeDetail, Episode } from '@/types';

export interface AnimeHeaderBackdropProps {
  anime: AnimeDetail;
  windowWidth: number;
  theme: Theme;
  firstUnwatched?: Episode;
  hasStartedWatching: boolean;
  onPlayEpisode: (episode: Episode) => void;
  onRestartPlayback?: () => void;
}

export const AnimeHeaderBackdrop = React.memo<AnimeHeaderBackdropProps>(
  function AnimeHeaderBackdrop({
    anime,
    theme,
    firstUnwatched,
    hasStartedWatching,
    onPlayEpisode,
    onRestartPlayback,
  }) {
    const [isPosterLoaded, setIsPosterLoaded] = React.useState(false);
    const [isCoverExpanded, setIsCoverExpanded] = React.useState(false);
    const { height: windowHeight } = useWindowDimensions();

    const primaryContrast = getContrastTextColor(theme.colors.primary);

    const handleOpenCoverModal = () => {
      Haptics.selectionAsync().catch(() => {});
      setIsCoverExpanded(true);
    };

    const handleCloseCoverModal = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setIsCoverExpanded(false);
    };

    return (
      <View style={[styles.headerContainer, { backgroundColor: theme.colors.background }]}>
        {/* Main Info Section (Clean Header without enlarged backdrop) */}
        <View style={styles.mainInfo}>
          <View style={styles.posterAndMeta}>
            {/* Clickable Poster Cover -> Expands into full screen card */}
            <Pressable
              style={[styles.posterContainer, { borderColor: theme.colors.border }]}
              onPress={handleOpenCoverModal}
              accessibilityRole="button"
              accessibilityLabel="INGRANDISCI COPERTINA A SCHERMO INTERO"
              hitSlop={4}
            >
              {!isPosterLoaded && (
                <Skeleton
                  width={110}
                  height={160}
                  borderRadius={oledTheme.radius.md}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Image
                source={{ uri: anime.image || anime.thumbnail }}
                style={styles.poster}
                contentFit="cover"
                transition={300}
                onLoad={() => setIsPosterLoaded(true)}
                onError={() => setIsPosterLoaded(true)}
              />
              <View style={styles.expandIconOverlay}>
                <Ionicons name="expand" size={13} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.metaRight}>
              <Text
                style={[styles.title, { color: theme.colors.text }]}
                numberOfLines={3}
              >
                {anime.title}
              </Text>

              <View style={styles.badgeRow}>
                {anime.subOrDub ? (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: primaryContrast }]}
                    >
                      {anime.subOrDub}
                    </Text>
                  </View>
                ) : null}
                {anime.state ? (
                  <View
                    style={[
                      styles.badgeSubtle,
                      { backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeSubtleText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {anime.state}
                    </Text>
                  </View>
                ) : null}
                {anime.score ? (
                  <View
                    style={[
                      styles.ratingBadge,
                      { backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text
                      style={[styles.ratingText, { color: theme.colors.text }]}
                    >
                      {anime.score}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Buttons (Play & Restart Playback - Symbols Only) */}
              <View style={styles.actionButtonsRow}>
                {firstUnwatched && (
                  <Pressable
                    style={[
                      styles.symbolBtn,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => onPlayEpisode(firstUnwatched)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasStartedWatching
                        ? `RIPRENDI EPISODIO ${firstUnwatched.number}`
                        : `INIZIA EPISODIO ${firstUnwatched.number}`
                    }
                  >
                    <Ionicons
                      name="play"
                      size={22}
                      color={primaryContrast}
                      style={{ marginLeft: 2 }}
                    />
                  </Pressable>
                )}

                {onRestartPlayback && (
                  <Pressable
                    style={[
                      styles.symbolBtn,
                      styles.symbolBtnSecondary,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={onRestartPlayback}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="RINIZIA DA CAPO DALL'EPISODIO 1"
                  >
                    <Ionicons
                      name="reload"
                      size={19}
                      color={theme.colors.text}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Full-Screen Cover Card Modal */}
        <Modal
          visible={isCoverExpanded}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseCoverModal}
          statusBarTranslucent={true}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={handleCloseCoverModal}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View
              style={[
                styles.expandedCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  maxHeight: Math.min(windowHeight * 0.85, 620),
                },
              ]}
            >
              {/* Header Card con Titolo e Bottone Chiudi */}
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.cardTitle, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {anime.title}
                </Text>
                <Pressable
                  style={styles.cardCloseBtn}
                  onPress={handleCloseCoverModal}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="CHIUDI COPERTINA"
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </View>

              {/* Copertina in alta definizione contenuta nella Card */}
              <View style={styles.expandedImageWrapper}>
                <Image
                  source={{ uri: anime.image || anime.thumbnail }}
                  style={styles.expandedImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
  },
  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 68,
  },
  posterAndMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  posterContainer: {
    width: 110,
    height: 160,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#161616',
    borderWidth: 1,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  expandIconOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  metaRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  badgeSubtle: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeSubtleText: {
    fontSize: 10,
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  symbolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  symbolBtnSecondary: {
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  expandedCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: oledTheme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    marginRight: 8,
  },
  cardCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedImageWrapper: {
    width: '100%',
    height: 440,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
});
