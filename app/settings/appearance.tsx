import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, applyThemeFamily, getContrastTextColor } from '@/theme';
import { AppStorage, type NavBarMode } from '@/services/storage';
import { useResponsiveLayout } from '@/hooks';
import {
  SettingsHeader,
  ThemeSettingsCard,
  settingsStyles as styles,
} from '@/components/settings';

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings' as any);
        }
        return true;
      });
      return () => backSub.remove();
    }, [router])
  );

  const [activeTheme, setActiveTheme] = useState<string>(() => {
    const fam = AppStorage.getThemeFamily() || 'oled';
    return fam === 'default' ? 'oled' : fam;
  });

  const [activeMode, setActiveMode] = useState<'dark' | 'light'>(() => {
    const fam = AppStorage.getThemeFamily() || 'oled';
    const cleanFam = fam === 'default' ? 'oled' : fam;
    if (cleanFam === 'pikachu') return AppStorage.getPikachuMode() || 'dark';
    if (cleanFam === 'orchid') return AppStorage.getOrchidMode() || 'dark';
    if (cleanFam === 'rainbow') return AppStorage.getRainbowMode() || 'dark';
    return AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
  });

  const [navBarMode, setNavBarMode] = useState<NavBarMode>(() => {
    return AppStorage.getNavBarMode();
  });

  useFocusEffect(
    useCallback(() => {
      const fam = AppStorage.getThemeFamily() || 'oled';
      const cleanFam = fam === 'default' ? 'oled' : fam;
      setActiveTheme(cleanFam);
      if (cleanFam === 'pikachu') setActiveMode(AppStorage.getPikachuMode() || 'dark');
      else if (cleanFam === 'orchid') setActiveMode(AppStorage.getOrchidMode() || 'dark');
      else if (cleanFam === 'rainbow') setActiveMode(AppStorage.getRainbowMode() || 'dark');
      else setActiveMode(AppStorage.getThemeMode() === 'light' ? 'light' : 'dark');
      setNavBarMode(AppStorage.getNavBarMode());
    }, [])
  );

  const handleSelectTheme = (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (activeTheme === themeId) {
      const newMode: 'dark' | 'light' = activeMode === 'dark' ? 'light' : 'dark';
      setActiveMode(newMode);
      if (themeId === 'pikachu') {
        AppStorage.setPikachuMode(newMode);
      } else if (themeId === 'orchid') {
        AppStorage.setOrchidMode(newMode);
      } else if (themeId === 'rainbow') {
        AppStorage.setRainbowMode(newMode);
      } else {
        AppStorage.setThemeMode(newMode === 'light' ? 'light' : 'oled');
      }
      applyThemeFamily(themeId, newMode);
    } else {
      let targetMode: 'dark' | 'light' = 'dark';
      if (themeId === 'pikachu') {
        targetMode = AppStorage.getPikachuMode() || 'dark';
      } else if (themeId === 'orchid') {
        targetMode = AppStorage.getOrchidMode() || 'dark';
      } else if (themeId === 'rainbow') {
        targetMode = AppStorage.getRainbowMode() || 'dark';
      } else {
        targetMode = AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
      }
      setActiveTheme(themeId);
      setActiveMode(targetMode);
      AppStorage.setThemeFamily(themeId as any);
      applyThemeFamily(themeId, targetMode);
    }
  };

  const handleUpdateNavBarMode = (mode: NavBarMode) => {
    Haptics.selectionAsync().catch(() => {});
    AppStorage.setNavBarMode(mode);
    setNavBarMode(mode);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="APPARENZA"
        subtitle="TEMA, COLORI & BARRA ANDROID"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* TEMA (con invertibilità chiaro/scuro al click) */}
        <ThemeSettingsCard
          activeTheme={activeTheme}
          activeMode={activeMode}
          onSelectTheme={handleSelectTheme}
          theme={theme}
          primaryContrast={primaryContrast}
        />

        {/* NAVBAR DI SISTEMA ANDROID */}
        {Platform.OS === 'android' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>NAVBAR DI SISTEMA</Text>
            <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary }]}>
              COMPORTAMENTO BARRA ANDROID
            </Text>
            <View style={styles.navBarRow}>
              {[
                {
                  mode: 'auto-hide' as NavBarMode,
                  label: 'NASCONDI (SWIPE)',
                },
                {
                  mode: 'visible' as NavBarMode,
                  label: 'SEMPRE VISIBILE',
                },
              ].map((item) => {
                const active = navBarMode === item.mode;
                const contrastColor = active ? getContrastTextColor(theme.colors.primary) : theme.colors.text;
                return (
                  <Pressable
                    key={item.mode}
                    style={[
                      styles.navBarChip,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.card,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleUpdateNavBarMode(item.mode)}
                    accessibilityRole="button"
                    accessibilityLabel={`NAVBAR ${item.label}${active ? ' ATTIVA' : ''}`}
                  >
                    <Ionicons
                      name={item.mode === 'auto-hide' ? 'phone-portrait-outline' : 'ellipsis-horizontal'}
                      size={15}
                      color={contrastColor}
                    />
                    <Text
                      style={[
                        styles.navBarChipText,
                        { color: contrastColor },
                        active && styles.navBarChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.navBarHelpText, { color: theme.colors.textMuted }]}>
              {navBarMode === 'auto-hide'
                ? 'A SCOMPARSA, RICHIAMABILE CON SWIPE DAL BASSO.'
                : 'SEMPRE FISSA E VISIBILE IN-APP.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
