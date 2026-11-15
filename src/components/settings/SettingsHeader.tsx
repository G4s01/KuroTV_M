import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { settingsStyles as styles } from './settings.styles';

export interface SettingsHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = React.memo(({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

  const handleBack = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings' as any);
    }
  }, [onBack, router]);

  return (
    <View
      style={[
        styles.subPageHeader,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
        isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.subPageBackBtn,
          {
            backgroundColor: pressed ? `${theme.colors.text}12` : 'transparent',
          },
        ]}
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="TORNA INDIETRO"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
      </Pressable>

      <View style={styles.subPageTitleBox}>
        <Text style={[styles.subPageTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subPageSubtitle, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
});
