export const StyleSheet = {
  create: (s) => (typeof s === 'function' ? s({}, {}) : s),
  configure: () => {},
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: {},
  flatten: (s) => s,
  compose: (a, b) => ({ ...a, ...b }),
};

export const UnistylesRuntime = {
  themeName: 'oled',
  updateTheme: () => {},
  setTheme: () => {},
  colorScheme: 'dark',
  hasAdaptiveThemes: false,
  breakpoint: 'sm',
  breakpoints: {},
  addListener: () => () => {},
};

export const createStyleSheet = (s) => s;
export const useStyles = () => ({ styles: {}, theme: {}, breakpoint: 'sm' });
export const useTheme = () => ({});
export const ThemeContext = { Provider: ({ children }) => children, Consumer: ({ children }) => children({}) };
export const ThemeProvider = ({ children }) => children;

export default {
  StyleSheet,
  UnistylesRuntime,
  createStyleSheet,
  useStyles,
  useTheme,
  ThemeContext,
  ThemeProvider,
};
