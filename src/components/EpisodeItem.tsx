import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Episode } from '@/types';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';

interface EpisodeItemProps {
  episode: Episode;
  isCurrent?: boolean;
  progressPercent?: number;
  variant?: 'list' | 'grid';
  downloadStatus?: 'none' | 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
  onPress: () => void;
  onDownloadPress?: () => void;
}

export const EpisodeItem: React.FC<EpisodeItemProps> = React.memo(({
  episode,
  isCurrent = false,
  progressPercent = 0,
  variant = 'list',
  downloadStatus = 'none',
  onPress,
  onDownloadPress,
}) => {
  const { theme } = useTheme();
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const isCompleted = progressPercent >= 90;

  if (variant === 'grid') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.gridContainer,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          isCurrent && [styles.activeGridContainer, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }],
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`EPISODIO ${episode.number}`}
      >
        <View style={styles.gridContent}>
          {isCurrent ? (
            <Ionicons name="play" size={16} color={getContrastTextColor(theme.colors.primary)} />
          ) : isCompleted ? (
            <Ionicons name="checkmark" size={16} color={theme.colors.success || oledTheme.colors.success} />
          ) : (
            <Text style={[styles.gridNumber, { color: theme.colors.text }, isCurrent && styles.activeGridNumber]}>
              {episode.number}
            </Text>
          )}
        </View>

        {onDownloadPress && (
          <Pressable
            style={styles.gridDownloadBtn}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.selectionAsync().catch(() => {});
              onDownloadPress();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              downloadStatus === 'downloading' || downloadStatus === 'queued' || downloadStatus === 'paused'
                ? `ANNULLA DOWNLOAD EPISODIO ${episode.number}`
                : `SCARICA EPISODIO ${episode.number}`
            }
          >
            {downloadStatus === 'completed' ? (
              <Ionicons name="checkmark-circle" size={13} color={theme.colors.success || oledTheme.colors.success} />
            ) : downloadStatus === 'downloading' ? (
              <Ionicons
                name="cloud-download"
                size={13}
                color={isCurrent ? getContrastTextColor(theme.colors.primary) : theme.colors.primary}
              />
            ) : downloadStatus === 'queued' ? (
              <Ionicons
                name="time-outline"
                size={13}
                color={isCurrent ? getContrastTextColor(theme.colors.primary) : theme.colors.warning || oledTheme.colors.warning}
              />
            ) : downloadStatus === 'paused' ? (
              <Ionicons
                name="pause-circle"
                size={13}
                color={isCurrent ? getContrastTextColor(theme.colors.primary) : theme.colors.warning || oledTheme.colors.warning}
              />
            ) : (
              <Ionicons
                name="cloud-download-outline"
                size={13}
                color={isCurrent ? getContrastTextColor(theme.colors.primary) : theme.colors.textMuted}
              />
            )}
          </Pressable>
        )}

        {progressPercent > 0 && !isCompleted && (
          <View style={styles.gridProgressTrack}>
            <View
              style={[
                styles.gridProgressBar,
                {
                  width: `${Math.min(100, progressPercent)}%`,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        isCurrent && [
          styles.activeContainer,
          { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}18` },
        ],
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`EPISODIO ${episode.number}`}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.numberBadge,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 },
            isCurrent && [styles.activeBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
          ]}
        >
          {isCurrent ? (
            <Ionicons name="play" size={14} color={getContrastTextColor(theme.colors.primary)} />
          ) : isCompleted ? (
            <Ionicons name="checkmark" size={14} color={theme.colors.success || oledTheme.colors.success} />
          ) : (
            <Text style={[styles.numberText, { color: theme.colors.text }]}>{episode.number}</Text>
          )}
        </View>

        <View style={styles.info}>
          <Text
            style={[
              styles.title,
              { color: theme.colors.text },
              isCurrent && [styles.activeText, { color: theme.colors.primary }],
            ]}
            numberOfLines={1}
          >
            {episode.title || `EPISODIO ${episode.number}`}
          </Text>
          {progressPercent > 0 && (
            <Text style={[styles.progressText, { color: theme.colors.textMuted }]}>
              {isCompleted ? 'COMPLETATO' : `VISTO ${progressPercent}%`}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        {onDownloadPress && (
          <Pressable
            style={styles.downloadBtn}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.selectionAsync().catch(() => {});
              onDownloadPress();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              downloadStatus === 'downloading' || downloadStatus === 'queued' || downloadStatus === 'paused'
                ? `ANNULLA DOWNLOAD EPISODIO ${episode.number}`
                : `SCARICA EPISODIO ${episode.number}`
            }
          >
            {downloadStatus === 'completed' ? (
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success || oledTheme.colors.success} />
            ) : downloadStatus === 'downloading' ? (
              <Ionicons name="cloud-download" size={20} color={theme.colors.primary} />
            ) : downloadStatus === 'queued' ? (
              <Ionicons name="time-outline" size={20} color={theme.colors.warning || oledTheme.colors.warning} />
            ) : downloadStatus === 'paused' ? (
              <Ionicons name="pause-circle" size={20} color={theme.colors.warning || oledTheme.colors.warning} />
            ) : (
              <Ionicons name="cloud-download-outline" size={20} color={theme.colors.textMuted} />
            )}
          </Pressable>
        )}

        <Ionicons
          name={isCurrent ? 'pause-circle-outline' : 'play-circle-outline'}
          size={24}
          color={isCurrent ? theme.colors.primary : theme.colors.textMuted}
        />
      </View>

      {progressPercent > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(100, progressPercent)}%`,
                backgroundColor: theme.colors.primary,
              },
              isCompleted && styles.completedBar,
            ]}
          />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // List styles
  container: {
    minHeight: oledTheme.spacing.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: oledTheme.colors.surface,
    borderRadius: oledTheme.radius.md,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  activeContainer: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: '#1E1415',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeBadge: {
    backgroundColor: oledTheme.colors.primary,
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  activeText: {
    color: oledTheme.colors.primary,
  },
  progressText: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  completedBar: {
    backgroundColor: oledTheme.colors.success,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDownloadBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gridDownloadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  // Grid styles
  gridContainer: {
    flex: 1,
    minHeight: oledTheme.spacing.minTouchTarget,
    height: 52,
    margin: 4,
    backgroundColor: oledTheme.colors.surface,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  activeGridContainer: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: oledTheme.colors.primary,
  },
  gridContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  activeGridNumber: {
    color: '#FFFFFF',
  },
  gridProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  gridProgressBar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
});
