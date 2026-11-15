import React from 'react';
import { StyleSheet as RNStyleSheet, Platform } from 'react-native';

export const FONT_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const oledTheme = {
  name: 'oled' as const,
  colors: {
    background: '#000000',
    card: '#0D0D0D',
    surface: '#171717',
    surfaceSubtle: '#262626',
    border: '#2A2A2A',
    borderActive: '#E50914',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#737373',
    primary: '#E50914',
    primaryHover: '#F40612',
    accent: '#E50914',
    focusGlow: 'transparent',
    focusRing: '#E50914',
    focusCard: '#171717',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    overlay: 'rgba(0, 0, 0, 0.85)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    screenHorizontal: 16, // Mobile screen edge padding
    screenVertical: 12,
    minTouchTarget: 44, // Mobile minimum touch target >= 44dp
  },
  typography: {
    fontFamily: FONT_MONO,
    hero: {
      fontFamily: FONT_MONO,
      fontSize: 28,
      fontWeight: 'bold' as const,
      lineHeight: 34,
      textTransform: 'uppercase' as const,
    },
    title: {
      fontFamily: FONT_MONO,
      fontSize: 22,
      fontWeight: 'bold' as const,
      lineHeight: 28,
      textTransform: 'uppercase' as const,
    },
    subtitle: {
      fontFamily: FONT_MONO,
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
      textTransform: 'uppercase' as const,
    },
    body: {
      fontFamily: FONT_MONO,
      fontSize: 15,
      fontWeight: 'normal' as const,
      lineHeight: 22,
      textTransform: 'uppercase' as const,
    },
    caption: {
      fontFamily: FONT_MONO,
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 18,
      textTransform: 'uppercase' as const,
    },
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};

export const darkTheme = {
  name: 'dark' as const,
  colors: {
    ...oledTheme.colors,
  },
  spacing: oledTheme.spacing,
  typography: oledTheme.typography,
  radius: oledTheme.radius,
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

export interface AppTheme {
  name: string;
  colors: ThemeColors;
  spacing: typeof oledTheme.spacing;
  typography: typeof oledTheme.typography;
  radius: typeof oledTheme.radius;
}

export type Theme = AppTheme;

export interface MaterialYouPalette {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  accent: string;
  focusRing: string;
  focusCard: string;
  category?: string;
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
    category: 'custom',
  },
  {
    id: 'orchid',
    name: 'ORCHIDEA',
    primary: '#E941FB',
    primaryHover: '#6A26F2',
    accent: '#E941FB',
    focusRing: '#E941FB',
    focusCard: '#1E0F3D',
    category: 'custom',
  },
  {
    id: 'rainbow',
    name: 'RAINBOW',
    primary: '#73FEC8',
    primaryHover: '#81DBFF',
    accent: '#73FEC8',
    focusRing: '#73FEC8',
    focusCard: '#132B25',
    category: 'custom',
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
  sm: 360,
  md: 480,
  lg: 768,
  xl: 1024,
};

export const appThemes: Record<string, AppTheme> = {
  oled: oledTheme,
  dark: darkTheme,
  light: lightTheme,
  custom: customTheme,
};

export type ThemeName = 'oled' | 'dark' | 'light' | 'custom';

let currentThemeName: ThemeName = 'oled';
type ThemeListener = (themeName: ThemeName, theme: AppTheme) => void;
const themeListeners = new Set<ThemeListener>();

function notifyThemeListeners(name: ThemeName, theme: AppTheme): void {
  themeListeners.forEach((listener) => {
    try {
      listener(name, theme);
    } catch {
      // Ignore listener errors
    }
  });
}

export const UnistylesRuntime = {
  get themeName(): ThemeName {
    return currentThemeName;
  },
  setTheme(name: ThemeName): void {
    if (appThemes[name]) {
      currentThemeName = name;
      notifyThemeListeners(currentThemeName, appThemes[currentThemeName]);
    }
  },
  updateTheme(name: ThemeName, updater: (oldTheme: AppTheme) => AppTheme): void {
    if (appThemes[name]) {
      const updated = updater(appThemes[name]);
      if (updated && updated.colors) {
        Object.assign(appThemes[name].colors, updated.colors);
      }
      notifyThemeListeners(name, {
        ...appThemes[name],
        colors: { ...appThemes[name].colors },
      });
    }
  },
  get colorScheme(): 'dark' | 'light' {
    return currentThemeName === 'light' ? 'light' : 'dark';
  },
  get hasAdaptiveThemes(): boolean {
    return false;
  },
  get breakpoints(): typeof breakpoints {
    return breakpoints;
  },
  get breakpoint(): string {
    return 'sm';
  },
  get enabled(): boolean {
    return true;
  },
  get insets(): { top: number; bottom: number; left: number; right: number } {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  },
  get screen(): { width: number; height: number } {
    return { width: 360, height: 800 };
  },
  setRootViewBackgroundColor(_color?: string): void {},
  statusBar: {
    setColor(_color?: string): void {},
    setHidden(_hidden?: boolean): void {},
  },
  navigationBar: {
    setColor(_color?: string): void {},
    setHidden(_hidden?: boolean): void {},
  },
  addListener(listener: ThemeListener): () => void {
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  },
};

export const StyleSheet = {
  ...RNStyleSheet,
  configure(config?: {
    settings?: { initialTheme?: string; adaptiveThemes?: boolean };
    breakpoints?: Record<string, number>;
    themes?: Record<string, any>;
  }): void {
    if (config?.settings?.initialTheme && appThemes[config.settings.initialTheme]) {
      currentThemeName = config.settings.initialTheme as ThemeName;
    }
  },
  create<T extends Record<string, any>>(
    styles: T | ((theme: AppTheme, rt: typeof UnistylesRuntime) => T)
  ): T {
    if (typeof styles === 'function') {
      const fn = styles;
      const targetObj = Object.assign(
        (...args: any[]) => (fn as any)(...args),
        { __builder: fn, __isUnistyles: true }
      );
      let cachedThemeName: string | null = null;
      let cachedEvaluated: any = null;

      return new Proxy(targetObj as any, {
        get(target, prop, receiver) {
          if (prop === '__builder' || prop === '__isUnistyles') {
            return fn;
          }
          if (cachedThemeName !== currentThemeName || !cachedEvaluated) {
            cachedThemeName = currentThemeName;
            const activeTheme = appThemes[currentThemeName] || oledTheme;
            cachedEvaluated = RNStyleSheet.create(fn(activeTheme, UnistylesRuntime));
          }
          return Reflect.get(cachedEvaluated, prop, receiver);
        },
      });
    }
    return RNStyleSheet.create(styles);
  },
};

StyleSheet.configure({
  settings: {
    initialTheme: 'oled',
    adaptiveThemes: false, // Default to pure OLED Black
  },
  breakpoints,
  themes: appThemes,
});

export const DEFAULT_OLED_COLORS: Readonly<ThemeColors> = Object.freeze({ ...oledTheme.colors });
export const DEFAULT_DARK_COLORS: Readonly<ThemeColors> = DEFAULT_OLED_COLORS;
export const DEFAULT_LIGHT_COLORS: Readonly<ThemeColors> = Object.freeze({ ...lightTheme.colors });

export function applyThemeColors(
  themeName: 'oled' | 'light' | 'dark',
  colors: Partial<ThemeColors>
): void {
  const targetTheme =
    themeName === 'light' ? lightTheme : themeName === 'dark' ? darkTheme : oledTheme;
  Object.assign(targetTheme.colors, colors);
  if (themeName === 'oled') {
    Object.assign(darkTheme.colors, colors);
  }
  UnistylesRuntime.updateTheme(themeName, (oldTheme) => ({
    ...oldTheme,
    colors: {
      ...oldTheme.colors,
      ...colors,
    },
  }));
}

export function resetThemeToDefaults(themeName: 'oled' | 'light' | 'custom' | 'dark'): void {
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
  const targetTheme =
    themeName === 'light' ? lightTheme : themeName === 'dark' ? darkTheme : oledTheme;
  Object.assign(targetTheme.colors, defaults);
  if (themeName === 'oled') {
    Object.assign(darkTheme.colors, defaults);
  }
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

export function applyThemeFamily(family: string, mode: 'dark' | 'light' = 'dark'): void {
  const isLight = mode === 'light';
  const targetThemeName: ThemeName = isLight ? 'light' : 'oled';

  if (family === 'pikachu') {
    applyPikachuTheme(isLight ? 'light' : 'oled');
  } else if (family === 'orchid') {
    applyOrchidTheme(isLight ? 'light' : 'oled');
  } else if (family === 'rainbow') {
    applyRainbowTheme(isLight ? 'light' : 'oled');
  } else if (family === 'oled' || family === 'default') {
    resetThemeToDefaults(isLight ? 'light' : 'oled');
  }

  UnistylesRuntime.setTheme(targetThemeName);
}

export function initThemeFromStorage(): void {
  try {
    // Dynamic require prevents circular dependency issues at early bundle initialization
    const { AppStorage } = require('@/services/storage');
    if (AppStorage && typeof AppStorage.getThemeFamily === 'function') {
      const family = AppStorage.getThemeFamily() || 'default';
      const cleanFamily = family === 'default' ? 'oled' : family;
      let mode: 'dark' | 'light' = 'dark';
      if (cleanFamily === 'pikachu') {
        mode = AppStorage.getPikachuMode() || 'dark';
      } else if (cleanFamily === 'orchid') {
        mode = AppStorage.getOrchidMode() || 'dark';
      } else if (cleanFamily === 'rainbow') {
        mode = AppStorage.getRainbowMode() || 'dark';
      } else {
        mode = AppStorage.getThemeMode() === 'light' ? 'light' : 'dark';
      }
      applyThemeFamily(cleanFamily, mode);
    }
  } catch {
    // Safely ignore if storage is not yet initialized or mocked
  }
}

// Safely attempt initial load of saved theme
try {
  initThemeFromStorage();
} catch {
  // Ignored
}

export function createStyleSheet<T extends Record<string, any>>(
  styles: T | ((theme: AppTheme, rt: typeof UnistylesRuntime) => T)
): T {
  return StyleSheet.create(styles);
}

export interface ThemeContextValue {
  theme: AppTheme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  updateTheme: (name: ThemeName, colors: Partial<ThemeColors>) => void;
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: oledTheme,
  themeName: 'oled',
  setTheme: () => {},
  updateTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = React.useState<ThemeName>(currentThemeName);
  const [themeVersion, setThemeVersion] = React.useState(0);
  const [activeTheme, setActiveTheme] = React.useState<AppTheme>(() => ({
    ...(appThemes[currentThemeName] || oledTheme),
    colors: { ...(appThemes[currentThemeName]?.colors || oledTheme.colors) },
  }));

  React.useEffect(() => {
    initThemeFromStorage();
    const current = appThemes[currentThemeName] || oledTheme;
    setActiveTheme({
      ...current,
      colors: { ...current.colors },
    });

    const unsubscribe = UnistylesRuntime.addListener((name, updatedTheme) => {
      setThemeName(name);
      const target = updatedTheme || appThemes[name] || oledTheme;
      setActiveTheme({
        ...target,
        colors: { ...target.colors },
      });
      setThemeVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme: activeTheme,
      themeName,
      setTheme: (name: ThemeName) => {
        UnistylesRuntime.setTheme(name);
      },
      updateTheme: (name: ThemeName, colors: Partial<ThemeColors>) => {
        applyThemeColors(name === 'light' ? 'light' : 'oled', colors);
      },
    }),
    [activeTheme, themeName, themeVersion]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function getContrastTextColor(hexColor?: string): string {
  if (!hexColor || typeof hexColor !== 'string') return '#FFFFFF';
  const clean = hexColor.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#000000' : '#FFFFFF';
  }
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#000000' : '#FFFFFF';
  }
  return '#FFFFFF';
}

export type UseThemeResult = AppTheme & { theme: AppTheme };

export function useTheme(): UseThemeResult {
  const context = React.useContext(ThemeContext);
  const activeTheme = context?.theme || appThemes[currentThemeName] || oledTheme;
  return Object.assign(activeTheme, { theme: activeTheme });
}

export function useUnistyles(): { theme: AppTheme; rt: typeof UnistylesRuntime } {
  const theme = useTheme();
  return {
    theme,
    rt: UnistylesRuntime,
  };
}

export function withUnistyles<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  return Component;
}

export const mq = {
  only: {
    width: (val: number) => val,
    height: (val: number) => val,
  },
  width: (val: number) => val,
  height: (val: number) => val,
};

export const ColorScheme = {
  Dark: 'dark',
  Light: 'light',
  Unspecified: 'unspecified',
} as const;

export const Orientation = {
  Portrait: 'portrait',
  Landscape: 'landscape',
} as const;

export const StatusBarStyle = {
  Light: 'light',
  Dark: 'dark',
} as const;

export const UnistyleDependency = {
  Theme: 1,
  ThemeName: 2,
  AdaptiveThemes: 3,
  Breakpoints: 4,
  Breakpoint: 5,
  ColorScheme: 6,
  Dimensions: 7,
  Orientation: 8,
  ContentSizeCategory: 9,
  Insets: 10,
  StatusBar: 11,
  NavigationBar: 12,
} as const;

export const Display: React.FC<{ children?: React.ReactNode; [key: string]: any }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);
export const Hide: React.FC<{ children?: React.ReactNode; [key: string]: any }> = () => null;
export const ScopedTheme: React.FC<{ children?: React.ReactNode; [key: string]: any }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

export function useStyles<T extends Record<string, any>>(
  stylesheet?: T | ((theme: AppTheme, rt: typeof UnistylesRuntime) => T)
): {
  styles: T;
  theme: AppTheme;
  breakpoint: string;
} {
  const theme = useTheme();
  const styles = React.useMemo(() => {
    if (!stylesheet) return {} as T;
    const builder =
      (stylesheet as any)?.__builder || (typeof stylesheet === 'function' ? stylesheet : null);
    if (builder) {
      return RNStyleSheet.create(builder(theme, UnistylesRuntime));
    }
    return RNStyleSheet.create(stylesheet as any);
  }, [theme, stylesheet]);

  return { styles, theme, breakpoint: 'sm' };
}

export default {
  StyleSheet,
  UnistylesRuntime,
  createStyleSheet,
  useStyles,
  useUnistyles,
  withUnistyles,
  useTheme,
  ThemeProvider,
  ThemeContext,
  mq,
  ColorScheme,
  Orientation,
  StatusBarStyle,
  UnistyleDependency,
  Display,
  Hide,
  ScopedTheme,
  oledTheme,
  darkTheme,
  lightTheme,
  customTheme,
  breakpoints,
  appThemes,
  MATERIAL_YOU_PALETTES,
  PIKACHU_DARK_COLORS,
  PIKACHU_LIGHT_COLORS,
  ORCHID_DARK_COLORS,
  ORCHID_LIGHT_COLORS,
  RAINBOW_DARK_COLORS,
  RAINBOW_LIGHT_COLORS,
  DEFAULT_OLED_COLORS,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  applyThemeColors,
  resetThemeToDefaults,
  applyCustomColors,
  getContrastTextColor,
  FONT_MONO,
  applyPikachuTheme,
  applyOrchidTheme,
  applyRainbowTheme,
  applyThemeFamily,
  initThemeFromStorage,
};
