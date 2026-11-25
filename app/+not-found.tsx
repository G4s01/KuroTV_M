import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler } from 'react-native';
import { useRouter, useFocusEffect, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const handleGoHome = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleGoHome();
        return true;
      });
      return () => sub.remove();
    }, [handleGoHome])
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: `${theme.colors.primary}18`,
            borderColor: theme.colors.primary,
          },
        ]}
      >
        <Ionicons name="compass-outline" size={34} color={theme.colors.primary} />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        PERCORSO NON TROVATO
      </Text>

      <Text style={[styles.message, { color: theme.colors.textMuted }]}>
        La schermata o il collegamento richiesto non è disponibile in questa versione dell&apos;app.
      </Text>

      {!!pathname && pathname !== '/' && (
        <Text
          style={[
            styles.pathChip,
            {
              color: theme.colors.textSecondary || theme.colors.textMuted,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          numberOfLines={2}
        >
          {pathname}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={handleGoHome}
        accessibilityRole="button"
        accessibilityLabel="TORNA ALLA HOME"
      >
        <Ionicons name="home-outline" size={18} color={primaryContrast} />
        <Text style={[styles.buttonText, { color: primaryContrast }]}>
          TORNA ALLA HOME
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 340,
  },
  pathChip: {
    fontFamily: 'monospace',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  button: {
    marginTop: 8,
    minHeight: 46,
    minWidth: 190,
    paddingHorizontal: 22,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },
});
