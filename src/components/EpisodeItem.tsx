import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Episode } from '@/types';
import { oledTheme } from '@/theme';

interface EpisodeItemProps {
  episode: Episode;
  isCurrent?: boolean;
  progressPercent?: number;
  onPress: () => void;
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  isCurrent = false,
  progressPercent = 0,
  onPress,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const isCompleted = progressPercent >= 90;

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
        name={isCurrent ? "pause-circle-outline" : "play-circle-outline"}
        size={24}
        color={isCurrent ? oledTheme.colors.primary : oledTheme.colors.textMuted}
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
    borderColor: oledTheme.colors.border,
  },
  activeContainer: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: '#1C0D0E',
  },
  pressed: {
    opacity: 0.8,
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
    borderRadius: oledTheme.radius.sm,
    backgroundColor: oledTheme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeBadge: {
    backgroundColor: oledTheme.colors.primary,
  },
  numberText: {
    color: oledTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  title: {
    color: oledTheme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  activeText: {
    color: oledTheme.colors.primary,
    fontWeight: '700',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  completedBar: {
    backgroundColor: oledTheme.colors.success,
  },
});
