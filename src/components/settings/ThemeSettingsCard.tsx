import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '@/theme';
import { settingsStyles } from './settings.styles';

import themeOledSvg from '../../../assets/icons/theme-oled.svg';
import themePikachuSvg from '../../../assets/icons/theme-pikachu.svg';
import themeOrchidSvg from '../../../assets/icons/theme-orchid.svg';
import themeRainbowSvg from '../../../assets/icons/theme-rainbow.svg';

export const THEMES = [
  {
    id: 'oled',
    icon: themeOledSvg,
    accessibilityLabel: 'TEMA OLED',
  },
  {
    id: 'pikachu',
    icon: themePikachuSvg,
    accessibilityLabel: 'TEMA PIKACHU',
  },
  {
    id: 'orchid',
    icon: themeOrchidSvg,
    accessibilityLabel: 'TEMA ORCHIDEA',
  },
  {
    id: 'rainbow',
    icon: themeRainbowSvg,
    accessibilityLabel: 'TEMA RAINBOW',
  },
];

export interface ThemeSettingsCardProps {
  activeTheme: string;
  activeMode: 'dark' | 'light';
  onSelectTheme: (themeId: string) => void;
  theme: Theme;
  primaryContrast: string;
}

export function ThemeSettingsCard({
  activeTheme,
  activeMode,
  onSelectTheme,
  theme,
  primaryContrast,
}: ThemeSettingsCardProps) {
  return (
    <View style={[settingsStyles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[settingsStyles.cardTitle, { color: theme.colors.text }]}>TEMA</Text>
      <View style={settingsStyles.themeGrid}>
        {THEMES.map((t) => {
          const active = activeTheme === t.id;
          return (
            <Pressable
              key={t.id}
              style={[
                settingsStyles.themeIconBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
                active && {
                  borderWidth: 2,
                  backgroundColor: `${theme.colors.primary}22`,
                },
              ]}
              onPress={() => onSelectTheme(t.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t.accessibilityLabel} (${active ? (activeMode === 'light' ? 'CHIARO' : 'SCURO') : 'NON ATTIVO'})`}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Image source={t.icon} style={settingsStyles.themeSvgIcon} contentFit="contain" />
              {active && (
                <View style={[settingsStyles.modeIndicatorBadge, { backgroundColor: theme.colors.primary }]}>
                  <Ionicons
                    name={activeMode === 'light' ? 'sunny' : 'moon'}
                    size={9}
                    color={primaryContrast}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
