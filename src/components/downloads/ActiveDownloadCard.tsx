import React from 'react';
import { View, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { downloadsStyles as styles } from './downloads.styles';
import { formatDownloadBytes, type DownloadItem } from '@/services/downloads';

export interface ActiveDownloadCardProps {
  item: DownloadItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ActiveDownloadCard = React.memo<ActiveDownloadCardProps>(
  function ActiveDownloadCard({ item, onPause, onResume, onCancel, containerStyle }) {
    const { theme } = useTheme();

    const isDownloading = item.status === 'downloading';
    const isPaused = item.status === 'paused';
    const isError = item.status === 'error';
    const isQueued = item.status === 'queued';

    let statusLabel = 'IN CODA';
    let statusColor = theme.colors.textMuted;

    if (isDownloading) {
      statusLabel = 'IN CORSO';
      statusColor = theme.colors.primary;
    } else if (isPaused) {
      statusLabel = 'IN PAUSA';
      statusColor = theme.colors.warning;
    } else if (isError) {
      statusLabel = item.error ? item.error.toUpperCase() : 'ERRORE';
      statusColor = theme.colors.error;
    }

    const writtenFormatted = formatDownloadBytes(item.downloadedBytes);
    const totalFormatted = item.totalBytes > 0 ? formatDownloadBytes(item.totalBytes) : '';

    return (
      <View
        style={[
          styles.activeCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isDownloading ? theme.colors.primary : theme.colors.border,
          },
          containerStyle,
        ]}
      >
        <Image
          source={item.animeThumbnail ? { uri: item.animeThumbnail } : undefined}
          style={styles.activePoster}
          contentFit="cover"
          recyclingKey={item.id}
        />

        <View style={styles.activeDetails}>
          <Text
            style={[styles.activeTitle, { color: theme.colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.animeTitle}
          </Text>
          <Text
            style={[styles.activeEpisode, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.episodeTitle || `EPISODIO ${item.episodeNumber}`}
          </Text>

          <View style={styles.activeProgressTrack}>
            <View
              style={[
                styles.activeProgressFill,
                {
                  width: `${Math.max(0, Math.min(100, item.progress))}%`,
                  backgroundColor: isError
                    ? theme.colors.error
                    : isPaused
                    ? theme.colors.warning
                    : theme.colors.primary,
                },
              ]}
            />
          </View>

          <View style={styles.activeStatsRow}>
            <Text
              style={[styles.activeProgressText, { color: theme.colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.progress}%{totalFormatted ? ` • ${writtenFormatted} / ${totalFormatted}` : ` • ${writtenFormatted}`}
            </Text>
            <Text
              style={[styles.activeStatusText, { color: statusColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.activeActions}>
          {isDownloading ? (
            <Pressable
              style={styles.activeActionBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPause(item.id);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="METTI IN PAUSA DOWNLOAD"
            >
              <Ionicons name="pause" size={20} color={theme.colors.warning} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.activeActionBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onResume(item.id);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="RIPRENDI DOWNLOAD"
            >
              <Ionicons name="play" size={20} color={theme.colors.primary} />
            </Pressable>
          )}

          <Pressable
            style={styles.activeActionBtn}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onCancel(item.id);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ANNULLA DOWNLOAD"
          >
            <Ionicons name="close" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }
);
