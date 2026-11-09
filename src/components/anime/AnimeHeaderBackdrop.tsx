import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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

const BACKDROP_HEIGHT = 260;

export const AnimeHeaderBackdrop = React.memo<AnimeHeaderBackdropProps>(
  function AnimeHeaderBackdrop({
    anime,
    windowWidth,
    theme,
    firstUnwatched,
    hasStartedWatching,
    onPlayEpisode,
    onRestartPlayback,
  }) {
    const [isBackdropLoaded, setIsBackdropLoaded] = React.useState(false);
    const [isPosterLoaded, setIsPosterLoaded] = React.useState(false);

    const primaryContrast = getContrastTextColor(theme.colors.primary);

    return (
      <View style={[styles.headerContainer, { backgroundColor: theme.colors.background }]}>
        {/* Backdrop Header */}
        <View style={[styles.backdropWrapper, { width: windowWidth }]}>
          {!isBackdropLoaded && (
            <Skeleton
              width="100%"
              height={BACKDROP_HEIGHT}
              borderRadius={0}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Image
            source={{ uri: anime.image || anime.thumbnail }}
            style={styles.backdrop}
            contentFit="cover"
            transition={300}
            onLoad={() => setIsBackdropLoaded(true)}
            onError={() => setIsBackdropLoaded(true)}
          />
          <View style={styles.backdropGradient} />
        </View>

        {/* Main Info Section */}
        <View style={styles.mainInfo}>
          <View style={styles.posterAndMeta}>
            <View style={styles.posterContainer}>
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
            </View>

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
      </View>
    );
  }
);

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
  },
  backdropWrapper: {
    height: BACKDROP_HEIGHT,
    position: 'relative',
    backgroundColor: '#000000',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  poster: {
    width: '100%',
    height: '100%',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.sm,
  },
  ratingText: {
    fontSize: 11,
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
  },
  symbolBtnSecondary: {
    borderWidth: 1,
  },
});
