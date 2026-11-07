import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

export const oledTheme = {
  name: 'oled' as const,
  colors: {
    background: '#000000',
    card: '#0D0D0D',
    surface: '#171717',
    surfaceSubtle: '#262626',
    border: '#333333',
    borderActive: '#FFFFFF',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#737373',
    primary: '#E50914',
    primaryHover: '#F40612',
    accent: '#E50914',
    focusGlow: 'rgba(255, 255, 255, 0.25)',
    focusRing: '#FFFFFF',
    focusCard: '#1C1C1C',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    overlay: 'rgba(0, 0, 0, 0.85)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    screenHorizontal: 56, // 10-foot TV overscan safe margin
    screenVertical: 40,
  },
  typography: {
    hero: {
      fontSize: 48,
      fontWeight: 'bold' as const,
      lineHeight: 56,
      textTransform: 'uppercase' as const,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold' as const,
      lineHeight: 40,
      textTransform: 'uppercase' as const,
    },
    subtitle: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      textTransform: 'uppercase' as const,
    },
    body: {
      fontSize: 18,
      fontWeight: 'normal' as const,
      lineHeight: 26,
      textTransform: 'uppercase' as const,
    },
    caption: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 20,
      textTransform: 'uppercase' as const,
    },
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },
};

export const lightTheme = {
  name: 'light' as const,
  colors: {
    background: '#FFFFFF',
    card: '#F5F5F5',
    surface: '#EEEEEE',
    surfaceSubtle: '#E0E0E0',
    border: '#CCCCCC',
    borderActive: '#000000',
    text: '#000000',
    textSecondary: '#4A4A4A',
    textMuted: '#7A7A7A',
    primary: '#E50914',
    primaryHover: '#D00812',
    accent: '#E50914',
    focusGlow: 'rgba(0, 0, 0, 0.2)',
    focusRing: '#000000',
    focusCard: '#E2E2E2',
    error: '#DC2626',
    success: '#059669',
    warning: '#D97706',
    overlay: 'rgba(255, 255, 255, 0.85)',
  },
  spacing: oledTheme.spacing,
  typography: oledTheme.typography,
  radius: oledTheme.radius,
};

export type ThemeColors = typeof oledTheme.colors;
export type ColorKey = keyof ThemeColors;

export interface MaterialYouPalette {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  accent: string;
  focusRing: string;
  focusCard: string;
}

export const MATERIAL_YOU_PALETTES: MaterialYouPalette[] = [
  {
    id: 'kuro-red',
    name: 'ROSSO KURO',
    primary: '#E50914',
    primaryHover: '#F40612',
    accent: '#E50914',
    focusRing: '#FFFFFF',
    focusCard: '#1C1C1C',
  },
  {
    id: 'ocean-blue',
    name: 'BLU OCEANO',
    primary: '#3B82F6',
    primaryHover: '#60A5FA',
    accent: '#3B82F6',
    focusRing: '#93C5FD',
    focusCard: '#131D2E',
  },
  {
    id: 'emerald-green',
    name: 'SMERALDO',
    primary: '#10B981',
    primaryHover: '#34D399',
    accent: '#10B981',
    focusRing: '#6EE7B7',
    focusCard: '#0F261F',
  },
  {
    id: 'amethyst-purple',
    name: 'AMETISTA',
    primary: '#8B5CF6',
    primaryHover: '#A78BFA',
    accent: '#8B5CF6',
    focusRing: '#C4B5FD',
    focusCard: '#1E1730',
  },
  {
    id: 'amber-sunset',
    name: 'AMBRA',
    primary: '#F59E0B',
    primaryHover: '#FBBF24',
    accent: '#F59E0B',
    focusRing: '#FDE68A',
    focusCard: '#2B200E',
  },
  {
    id: 'monochrome',
    name: 'MONOCROMO',
    primary: '#E5E7EB',
    primaryHover: '#FFFFFF',
    accent: '#E5E7EB',
    focusRing: '#FFFFFF',
    focusCard: '#262626',
  },
  {
    id: 'pikachu',
    name: 'PIKACHU',
    primary: '#FAD61D',
    primaryHover: '#E19720',
    accent: '#FAD61D',
    focusRing: '#FAD61D',
    focusCard: '#241E00',
  },
  {
    id: 'orchid',
    name: 'ORCHIDEA',
    primary: '#E941FB',
    primaryHover: '#6A26F2',
    accent: '#E941FB',
    focusRing: '#E941FB',
    focusCard: '#1E0F3D',
  },
  {
    id: 'rainbow',
    name: 'RAINBOW',
    primary: '#73FEC8',
    primaryHover: '#81DBFF',
    accent: '#73FEC8',
    focusRing: '#73FEC8',
    focusCard: '#132B25',
  },
];

export const PIKACHU_DARK_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#FAD61D',
  primaryHover: '#E19720',
  accent: '#FAD61D',
  focusRing: '#FAD61D',
  focusCard: '#241E00',
  error: '#F62D14',
  warning: '#E19720',
  text: '#FFFFFF',
  textSecondary: '#D4D4D4',
  textMuted: '#A3A3A3',
  background: '#000000',
  card: '#0D0D0D',
  surface: '#171717',
  surfaceSubtle: '#262626',
  border: '#333333',
  borderActive: '#FAD61D',
});

export const PIKACHU_LIGHT_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#F62D14',
  primaryHover: '#811E09',
  accent: '#F62D14',
  focusRing: '#811E09',
  focusCard: '#FEF3C7',
  error: '#F62D14',
  warning: '#E19720',
  text: '#000000',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  background: '#FFFFFF',
  card: '#FFFBEB',
  surface: '#FEF3C7',
  surfaceSubtle: '#FDE68A',
  border: '#FAD61D',
  borderActive: '#811E09',
});

export const ORCHID_DARK_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#E941FB',
  primaryHover: '#6A26F2',
  accent: '#E941FB',
  focusRing: '#E941FB',
  focusCard: '#1E0F3D',
  error: '#E8114E',
  warning: '#F59E0B',
  text: '#F5F1E6',
  textSecondary: '#D4CEE8',
  textMuted: '#8B82A8',
  background: '#000000',
  card: '#0D0D0D',
  surface: '#171717',
  surfaceSubtle: '#331A84',
  border: '#331A84',
  borderActive: '#E941FB',
});

export const ORCHID_LIGHT_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#9334C2',
  primaryHover: '#BB55D3',
  accent: '#DB6ED6',
  focusRing: '#9334C2',
  focusCard: '#C1E6EC',
  error: '#E8114E',
  warning: '#D97706',
  text: '#1A0B2E',
  textSecondary: '#4A3E56',
  textMuted: '#766E82',
  background: '#E9EDF0',
  card: '#FFFFFF',
  surface: '#F4F8FA',
  surfaceSubtle: '#C1E6EC',
  border: '#DB6ED6',
  borderActive: '#9334C2',
});

export const RAINBOW_DARK_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#73FEC8',
  primaryHover: '#81DBFF',
  accent: '#73FEC8',
  focusRing: '#73FEC8',
  focusCard: '#132B25',
  error: '#FF575B',
  warning: '#FEA55D',
  text: '#FAFEDD',
  textSecondary: '#81DBFF',
  textMuted: '#64B5D6',
  background: '#000000',
  card: '#0D0D0D',
  surface: '#171717',
  surfaceSubtle: '#1A2936',
  border: '#1E3A4B',
  borderActive: '#73FEC8',
});

export const RAINBOW_LIGHT_COLORS: Readonly<Partial<ThemeColors>> = Object.freeze({
  primary: '#FB6EFF',
  primaryHover: '#FF575B',
  accent: '#FB6EFF',
  focusRing: '#FB6EFF',
  focusCard: '#EAF8FF',
  error: '#FF575B',
  warning: '#FEA55D',
  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  background: '#FAFEDD',
  card: '#FFFFFF',
  surface: '#F4F9EA',
  surfaceSubtle: '#E2FBEF',
  border: '#81DBFF',
  borderActive: '#FB6EFF',
});

export const customTheme = {
  name: 'custom' as const,
  colors: {
    ...oledTheme.colors,
  },
  spacing: oledTheme.spacing,
  typography: oledTheme.typography,
  radius: oledTheme.radius,
};

export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
  tv: 1920,
};

export const appThemes = {
  oled: oledTheme,
  light: lightTheme,
  custom: customTheme,
};

StyleSheet.configure({
  settings: {
    initialTheme: 'oled',
    adaptiveThemes: false, // Default to OLED Black for TV
  },
  breakpoints,
  themes: appThemes,
});

export const DEFAULT_OLED_COLORS: Readonly<ThemeColors> = Object.freeze({ ...oledTheme.colors });
export const DEFAULT_LIGHT_COLORS: Readonly<ThemeColors> = Object.freeze({ ...lightTheme.colors });

export function applyThemeColors(themeName: 'oled' | 'light', colors: Partial<ThemeColors>): void {
  const targetTheme = themeName === 'light' ? lightTheme : oledTheme;
  Object.assign(targetTheme.colors, colors);
  UnistylesRuntime.updateTheme(themeName, (oldTheme) => ({
    ...oldTheme,
    colors: {
      ...oldTheme.colors,
      ...colors,
    },
  }));
}

export function resetThemeToDefaults(themeName: 'oled' | 'light' | 'custom'): void {
  if (themeName === 'custom') {
    Object.assign(customTheme.colors, DEFAULT_OLED_COLORS);
    UnistylesRuntime.updateTheme('custom', (oldTheme) => ({
      ...oldTheme,
      colors: {
        ...DEFAULT_OLED_COLORS,
      },
    }));
    return;
  }
  const defaults = themeName === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_OLED_COLORS;
  const targetTheme = themeName === 'light' ? lightTheme : oledTheme;
  Object.assign(targetTheme.colors, defaults);
  UnistylesRuntime.updateTheme(themeName, (oldTheme) => ({
    ...oldTheme,
    colors: {
      ...defaults,
    },
  }));
  if (themeName === 'oled') {
    Object.assign(customTheme.colors, defaults);
    UnistylesRuntime.updateTheme('custom', (oldTheme) => ({
      ...oldTheme,
      colors: {
        ...defaults,
      },
    }));
  }
}

export function applyCustomColors(colors: Partial<ThemeColors>): void {
  Object.assign(customTheme.colors, colors);
  UnistylesRuntime.updateTheme('custom', (oldTheme) => ({
    ...oldTheme,
    colors: {
      ...oldTheme.colors,
      ...colors,
    },
  }));
}

export function applyPikachuTheme(themeName: 'oled' | 'light'): void {
  const baseColors = themeName === 'light' ? PIKACHU_LIGHT_COLORS : PIKACHU_DARK_COLORS;
  applyThemeColors(themeName, baseColors);
  if (themeName === 'oled') {
    applyCustomColors(baseColors);
  }
}

export function applyOrchidTheme(themeName: 'oled' | 'light'): void {
  const baseColors = themeName === 'light' ? ORCHID_LIGHT_COLORS : ORCHID_DARK_COLORS;
  applyThemeColors(themeName, baseColors);
  if (themeName === 'oled') {
    applyCustomColors(baseColors);
  }
}

export function applyRainbowTheme(themeName: 'oled' | 'light'): void {
  const baseColors = themeName === 'light' ? RAINBOW_LIGHT_COLORS : RAINBOW_DARK_COLORS;
  applyThemeColors(themeName, baseColors);
  if (themeName === 'oled') {
    applyCustomColors(baseColors);
  }
}

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

