import React from 'react';
import { StyleSheet, Text, Pressable, View, Animated, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { oledTheme, useTheme } from '@/theme';

export interface AniSkipButtonProps {
  skipType?: 'intro' | 'outro' | 'recap';
  variant?: 'skip' | 'next';
  onSkip: () => void;
  player?: any;
  startTime?: number;
  endTime?: number;
  currentTime?: number;
  durationSeconds?: number;
  onTimeout?: () => void;
}

const BUTTON_DURATION = 10;

export const AniSkipButton: React.FC<AniSkipButtonProps> = ({
  skipType,
  variant = 'skip',
  onSkip,
  player,
  startTime,
  endTime,
  currentTime: controlledTime,
  durationSeconds,
  onTimeout,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const totalInterval =
    typeof endTime === 'number' && typeof startTime === 'number' && endTime > startTime
      ? Math.max(1, endTime - startTime)
      : BUTTON_DURATION;

  const targetDuration =
    typeof durationSeconds === 'number' && durationSeconds > 0
      ? durationSeconds
      : durationSeconds === 0
      ? totalInterval
      : BUTTON_DURATION;

  const maxDuration = Math.min(targetDuration, totalInterval);

  const getInitialProgress = React.useCallback(() => {
    const time =
      controlledTime !== undefined
        ? controlledTime
        : typeof player?.currentTime === 'number'
        ? player.currentTime
        : startTime ?? 0;
    const start = startTime ?? time;
    const elapsed = Math.max(0, time - start);
    const remaining = Math.max(0, maxDuration - elapsed);
    return Math.max(0, Math.min(1, remaining / maxDuration));
  }, [controlledTime, player?.currentTime, startTime, maxDuration]);

  const progressAnim = React.useRef(new Animated.Value(getInitialProgress())).current;

  const updateProgress = React.useCallback(
    (time: number) => {
      const start = startTime ?? time;
      const elapsed = Math.max(0, time - start);
      if (elapsed >= maxDuration && onTimeout) {
        onTimeout();
      }
      const remaining = Math.max(0, maxDuration - elapsed);
      const ratio = Math.max(0, Math.min(1, remaining / maxDuration));
      Animated.timing(progressAnim, {
        toValue: ratio,
        duration: 350,
        useNativeDriver: false,
      }).start();
    },
    [startTime, maxDuration, progressAnim, onTimeout]
  );

  React.useEffect(() => {
    progressAnim.setValue(getInitialProgress());
  }, [getInitialProgress, progressAnim]);

  React.useEffect(() => {
    if (controlledTime !== undefined) {
      updateProgress(controlledTime);
    }
  }, [controlledTime, updateProgress]);

  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    updateProgress(time);
  });

  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSkip();
  };

  const isNextVariant = variant === 'next';
  const label = isNextVariant ? 'PROSSIMO' : 'SALTA';
  const iconName = isNextVariant ? 'play-skip-forward' : 'play-forward';
  const accessibilityLabel = isNextVariant
    ? "PROSSIMO EPISODIO. TOCCA PER PASSARE ALL'EPISODIO SUCCESSIVO"
    : `${label}. TOCCA PER SALTARE`;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const dynamicBottom = isLandscape
    ? Math.max(68, insets.bottom + 48)
    : Math.max(84, insets.bottom + 68);
  const dynamicRight = Math.max(20, insets.right + 12);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          bottom: dynamicBottom,
          right: dynamicRight,
        },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Depleting Top Border Track & Indicator */}
      <View style={styles.topBorderTrack}>
        <Animated.View
          style={[
            styles.depletingBorderTop,
            {
              width: progressWidth,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </View>

      <View style={styles.content}>
        <Ionicons name={iconName} size={16} color={theme.colors.primary} />
        <Text style={styles.text}>{label}</Text>
      </View>

      {/* Depleting Bottom Border Track & Indicator */}
      <View style={styles.bottomBorderTrack}>
        <Animated.View
          style={[
            styles.depletingBorderBottom,
            {
              width: progressWidth,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'rgba(16, 16, 16, 0.94)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: oledTheme.radius.full,
    minHeight: oledTheme.spacing.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  topBorderTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  depletingBorderTop: {
    height: '100%',
  },
  bottomBorderTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  depletingBorderBottom: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
