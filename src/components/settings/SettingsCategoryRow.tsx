import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { settingsStyles as styles } from './settings.styles';

export interface SettingsCategoryRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    color?: string;
    bgColor?: string;
  };
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export const SettingsCategoryRow: React.FC<SettingsCategoryRowProps> = React.memo(({
  icon,
  iconColor,
  title,
  subtitle,
  badge,
  onPress,
  accessibilityLabel,
  testID,
}) => {
  const { theme } = useTheme();

  const handlePress = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  const activeIconColor = iconColor || theme.colors.primary;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.categoryRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title}${subtitle ? `: ${subtitle}` : ''}`}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <View
        style={[
          styles.categoryIconBox,
          {
            backgroundColor: `${activeIconColor}18`,
            borderColor: `${activeIconColor}40`,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={activeIconColor} />
      </View>

      <View style={styles.categoryContent}>
        <Text style={[styles.categoryTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.categorySubtitle, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.categoryRight}>
        {badge ? (
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: badge.bgColor || `${theme.colors.primary}20`,
                borderColor: badge.color || theme.colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryBadgeText,
                { color: badge.color || theme.colors.primary },
              ]}
            >
              {badge.text}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
});
