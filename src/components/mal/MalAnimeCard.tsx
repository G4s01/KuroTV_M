import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { getContrastTextColor, useTheme } from '@/theme';
import type { MalAnimeListEntry, MalSyncProposal } from '@/services/mal';
import { malStyles as styles } from './mal.styles';

export interface MalAnimeCardProps {
  entry: MalAnimeListEntry;
  mappedAnimeId?: string | null;
  mappedAudio?: 'sub' | 'ita';
  pendingProposal?: MalSyncProposal;
  isResolving?: boolean;
  onPress: (entry: MalAnimeListEntry) => void;
  onLongPress: (entry: MalAnimeListEntry) => void;
  onEditPress?: (entry: MalAnimeListEntry) => void;
}

export const MalAnimeCard = React.memo<MalAnimeCardProps>(function MalAnimeCard({
  entry,
  mappedAnimeId,
  mappedAudio,
  pendingProposal,
  isResolving = false,
  onPress,
  onLongPress,
  onEditPress,
}) {
  const { theme } = useTheme();
  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const posterUri = entry.mainPicture?.large || entry.mainPicture?.medium;

  const totalLabel = entry.numEpisodes > 0 ? String(entry.numEpisodes) : '?';
  const epLabel = `EP. ${entry.watchedEpisodes} / ${totalLabel}`;

  let syncHintText: string | null = null;
  if (pendingProposal) {
    if (pendingProposal.targetStatus === 'completed') {
      syncHintText = '→ COMPLETATO';
    } else if (pendingProposal.reason === 'promote_ptw') {
      syncHintText = `→ IN CORSO (${pendingProposal.targetEpisodes})`;
    } else {
      const diff = Math.max(0, pendingProposal.targetEpisodes - entry.watchedEpisodes);
      syncHintText = diff > 0 ? `+${diff} EP DA INVIARE` : 'DA SINCRONIZZARE';
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: pendingProposal ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress(entry);
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onLongPress(entry);
      }}
      delayLongPress={320}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${epLabel}`}
    >
      {/* Poster */}
      <View style={[styles.cardPosterBox, { borderColor: theme.colors.border }]}>
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            style={styles.cardPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`mal-${entry.malId}`}
            transition={200}
          />
        ) : (
          <View style={[styles.cardPosterFallback, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="film-outline" size={22} color={theme.colors.textMuted} />
          </View>
        )}

        {isResolving && (
          <View style={styles.cardResolvingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {entry.title}
        </Text>

        <View style={styles.cardMetaRow}>
          <View
            style={[
              styles.metaChip,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.metaChipText, { color: theme.colors.text }]}>{epLabel}</Text>
          </View>

          {entry.score > 0 && (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="star" size={10} color="#FBBF24" />
              <Text style={[styles.metaChipText, { color: theme.colors.text }]}>
                {entry.score}
              </Text>
            </View>
          )}

          {entry.mediaType ? (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.metaChipText, { color: theme.colors.textMuted }]}>
                {entry.mediaType}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardMetaRow}>
          {syncHintText ? (
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={11} color={primaryContrast} />
              <Text style={[styles.metaChipText, { color: primaryContrast }]}>
                {syncHintText}
              </Text>
            </View>
          ) : null}

          {mappedAnimeId ? (
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: `${theme.colors.success || '#10B981'}18`,
                  borderColor: theme.colors.success || '#10B981',
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={11}
                color={theme.colors.success || '#10B981'}
              />
              <Text
                style={[
                  styles.metaChipText,
                  { color: theme.colors.success || '#10B981' },
                ]}
              >
                {mappedAudio ? `PRONTO • ${mappedAudio.toUpperCase()}` : 'PRONTO'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="link-outline" size={11} color={theme.colors.textMuted} />
              <Text style={[styles.metaChipText, { color: theme.colors.textMuted }]}>
                TAP PER ANIMEWORLD
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Edit Button */}
      {onEditPress && (
        <Pressable
          style={[
            styles.cardEditBtn,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.selectionAsync().catch(() => {});
            onEditPress(entry);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`MODIFICA STATO MAL PER ${entry.title}`}
        >
          <Ionicons name="create-outline" size={18} color={theme.colors.text} />
        </Pressable>
      )}
    </Pressable>
  );
});
