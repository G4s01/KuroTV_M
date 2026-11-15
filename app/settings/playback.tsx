import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import {
  AppStorage,
  type AniSkipSettings,
  type AniSkipMode,
} from '@/services/storage';
import { AniSkipSlider } from '@/components/AniSkipSlider';
import { AniSkipDurationSlider } from '@/components/AniSkipDurationSlider';
import { useResponsiveLayout } from '@/hooks';
import {
  SettingsHeader,
  settingsStyles as styles,
} from '@/components/settings';

export default function PlaybackSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

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

  const [aniSkipSettings, setAniSkipSettings] = useState<AniSkipSettings>(() => {
    return AppStorage.getAniSkipSettings();
  });

  useFocusEffect(
    useCallback(() => {
      setAniSkipSettings(AppStorage.getAniSkipSettings());
    }, [])
  );

  const handleUpdateAniSkipMode = (mode: AniSkipMode) => {
    Haptics.selectionAsync().catch(() => {});
    let newSettings: Partial<AniSkipSettings> = { mode };
    if (mode !== 'disabled') {
      const hasAnyActive =
        aniSkipSettings.enableOpening ||
        aniSkipSettings.enableEnding ||
        aniSkipSettings.enableRecap;
      if (!hasAnyActive) {
        newSettings = {
          mode,
          enableOpening: true,
          enableEnding: true,
          enableRecap: true,
        };
      }
    }
    const updated = AppStorage.saveAniSkipSettings(newSettings);
    setAniSkipSettings(updated);
  };

  const handleToggleAniSkipType = (key: 'enableOpening' | 'enableEnding' | 'enableRecap') => {
    Haptics.selectionAsync().catch(() => {});
    const nextVal = !aniSkipSettings[key];
    const newSettings = {
      ...aniSkipSettings,
      [key]: nextVal,
    };

    const hasAnyActive =
      newSettings.enableOpening ||
      newSettings.enableEnding ||
      newSettings.enableRecap;

    if (!hasAnyActive) {
      newSettings.mode = 'disabled';
    }

    const updated = AppStorage.saveAniSkipSettings(newSettings);
    setAniSkipSettings(updated);
  };

  const handleUpdateAniSkipDuration = (duration: number) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = AppStorage.saveAniSkipSettings({ buttonDuration: duration });
    setAniSkipSettings(updated);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="PLAYER"
        subtitle="SALTO AUTOMATICO O MANUALE DI INTRO, RECAP ED ENDING"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ANISKIP (Salto automatico o manuale, selezione sezioni) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>ANISKIP</Text>

          <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
            MODALITÀ DI SALTO
          </Text>
          <AniSkipSlider
            value={aniSkipSettings.mode}
            onChange={handleUpdateAniSkipMode}
            theme={theme}
            settings={aniSkipSettings}
          />

          {aniSkipSettings.mode === 'manual' && (
            <>
              <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginTop: 14, marginBottom: 8 }]}>
                DURATA PULSANTI ANISKIP
              </Text>
              <AniSkipDurationSlider
                value={aniSkipSettings.buttonDuration ?? 10}
                onChange={handleUpdateAniSkipDuration}
                theme={theme}
              />
            </>
          )}

          {aniSkipSettings.mode !== 'disabled' && (
            <>
              <Text style={[styles.aniskipSubTitle, { color: theme.colors.textSecondary, marginTop: 14 }]}>
                COSA SALTARE
              </Text>
              <View style={styles.aniskipRow}>
                {[
                  { key: 'enableOpening' as const, label: 'INTRO' },
                  { key: 'enableRecap' as const, label: 'RECAP' },
                  { key: 'enableEnding' as const, label: 'OUTRO' },
                ].map((item) => {
                  const active = aniSkipSettings[item.key];
                  const contrastColor = active ? getContrastTextColor(theme.colors.primary) : theme.colors.text;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.aniskipChip,
                        {
                          backgroundColor: active ? theme.colors.primary : theme.colors.card,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => handleToggleAniSkipType(item.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`SALTA ${item.label}: ${active ? 'ATTIVO' : 'DISATTIVATO'}`}
                    >
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={contrastColor}
                      />
                      <Text
                        style={[
                          styles.aniskipChipText,
                          { color: contrastColor },
                          active && styles.aniskipChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
