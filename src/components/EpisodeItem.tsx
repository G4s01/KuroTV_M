import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Episode } from '@/types';
import { oledTheme, useTheme } from '@/theme';

interface EpisodeItemProps {
  episode: Episode;
  isCurrent?: boolean;
  progressPercent?: number;
  variant?: 'list' | 'grid';
  onPress: () => void;
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  isCurrent = false,
  progressPercent = 0,
  variant = 'list',
  onPress,
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
          isCurrent && [styles.activeGridContainer, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }],
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`Episodio ${episode.number}`}
      >
        <View style={styles.gridContent}>
          {isCurrent ? (
            <Ionicons name="play" size={16} color="#FFFFFF" />
          ) : isCompleted ? (
            <Ionicons name="checkmark" size={16} color={oledTheme.colors.success} />
          ) : (
            <Text style={[styles.gridNumber, isCurrent && styles.activeGridNumber]}>
              {episode.number}
            </Text>
          )}
        </View>

        {progressPercent > 0 && !isCompleted && (
          <View style={styles.gridProgressTrack}>
            <View
              style={[
                styles.gridProgressBar,
                { width: `${Math.min(100, progressPercent)}%` },
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
        isCurrent && styles.activeContainer,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`Episodio ${episode.number}`}
    >
      <View style={styles.left}>
        <View style={[styles.numberBadge, isCurrent && styles.activeBadge]}>
          {isCurrent ? (
            <Ionicons name="play" size={14} color="#FFFFFF" />
          ) : isCompleted ? (
            <Ionicons name="checkmark" size={14} color={oledTheme.colors.success} />
          ) : (
            <Text style={styles.numberText}>{episode.number}</Text>
          )}
        </View>

        <View style={styles.info}>
          <Text
            style={[styles.title, isCurrent && styles.activeText]}
            numberOfLines={1}
          >
            {episode.title || `Episodio ${episode.number}`}
          </Text>
          {progressPercent > 0 && (
            <Text style={styles.progressText}>
              {isCompleted ? 'Completato' : `Visto ${progressPercent}%`}
            </Text>
          )}
        </View>
      </View>

      <Ionicons
        name={isCurrent ? 'pause-circle-outline' : 'play-circle-outline'}
        size={24}
        color={isCurrent ? theme.colors.primary : oledTheme.colors.textMuted}
      />

      {progressPercent > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(100, progressPercent)}%` },
              isCompleted && styles.completedBar,
            ]}
          />
        </View>
      )}
    </Pressable>
  );
};

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
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    color: oledTheme.colors.primary,
  },
  progressText: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
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
    fontSize: 14,
    fontWeight: '700',
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
