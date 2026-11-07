import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { AnimeItem } from '@/types';
import { oledTheme } from '@/theme';

interface AnimeCardProps {
  anime: AnimeItem;
  onPress: () => void;
  width?: number;
  height?: number;
  showEpisodeBadge?: boolean;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onPress,
  width = 130,
  height = 190,
  showEpisodeBadge = true,
}) => {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  const imageUrl = anime.image || anime.thumbnail;
  const episodeText = anime.episode ? `Ep. ${anime.episode}` : anime.subOrDub || null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={anime.title}
    >
      <View style={[styles.posterWrapper, { height }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.poster}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={[styles.poster, styles.fallbackPoster]}>
            <Ionicons name="film-outline" size={32} color={oledTheme.colors.textMuted} />
          </View>
        )}

        {showEpisodeBadge && episodeText && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {episodeText}
            </Text>
          </View>
        )}

        {anime.score ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#FBBF24" />
            <Text style={styles.ratingText}>{anime.score}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {anime.title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    marginBottom: 16,
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  posterWrapper: {
    width: '100%',
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    backgroundColor: oledTheme.colors.surface,
    position: 'relative',
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.xs,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.xs,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: oledTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 18,
  },
});
