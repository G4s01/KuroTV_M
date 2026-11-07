import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

interface AniSkipButtonProps {
  skipType: 'intro' | 'outro';
  onSkip: () => void;
}

export const AniSkipButton: React.FC<AniSkipButtonProps> = ({ skipType, onSkip }) => {
  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSkip();
  };

  const label = skipType === 'intro' ? 'Salta Intro' : 'Salta Outro';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.content}>
        <Ionicons name="play-forward" size={16} color="#FFFFFF" />
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: oledTheme.radius.full,
    minHeight: oledTheme.spacing.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
