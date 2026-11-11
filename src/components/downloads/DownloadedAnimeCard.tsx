import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { downloadsStyles as styles } from './downloads.styles';
import { formatDownloadBytes, type DownloadedAnimeGroup } from '@/services/downloads';

export interface DownloadedAnimeCardProps {
  group: DownloadedAnimeGroup;
  onPress: (group: DownloadedAnimeGroup) => void;
  onPlayNext: (group: DownloadedAnimeGroup) => void;
  onDeleteGroup: (group: DownloadedAnimeGroup) => void;
}

export const DownloadedAnimeCard = React.memo<DownloadedAnimeCardProps>(
  function DownloadedAnimeCard({ group, onPress, onPlayNext, onDeleteGroup }) {
    const { theme } = useTheme();
    const playTextColor = getContrastTextColor(theme.colors.primary);

    const totalFormatted = formatDownloadBytes(group.totalBytes);

    return (
      <Pressable
        style={[
          styles.animeCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress(group);
        }}
        accessibilityRole="button"
        accessibilityLabel={`SERIE SCARICATA ${group.animeTitle}`}
      >
        <Image
          source={group.animeThumbnail ? { uri: group.animeThumbnail } : undefined}
          style={styles.animePoster}
          contentFit="cover"
          recyclingKey={group.animeId}
        />

        <View style={styles.animeDetails}>
          <Text
            style={[styles.animeTitle, { color: theme.colors.text }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {group.animeTitle}
          </Text>

          <View style={styles.animeBadgesRow}>
            <View
              style={[
                styles.metaBadge,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.metaBadgeText, { color: theme.colors.primary }]}>
                {group.episodesCount} {group.episodesCount === 1 ? 'EPISODIO' : 'EPISODI'}
              </Text>
            </View>

            <View
              style={[
                styles.metaBadge,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.metaBadgeText, { color: theme.colors.textSecondary }]}>
                {totalFormatted}
              </Text>
            </View>
          </View>

          <View style={styles.animeCardActions}>
            <Pressable
              style={[styles.playNextBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPlayNext(group);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`RIPRODUCI SUCCESSIVO EPISODIO DI ${group.animeTitle}`}
            >
              <Ionicons name="play" size={14} color={playTextColor} />
              <Text style={[styles.playNextText, { color: playTextColor }]}>
                RIPRODUCI
              </Text>
            </Pressable>

            <Pressable
              style={styles.deleteAnimeBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onDeleteGroup(group);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`ELIMINA TUTTI GLI EPISODI DI ${group.animeTitle}`}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }
);
