export const Platform = {
  OS: 'android',
  select: (obj) => obj.android || obj.default,
  constants: {
    supportedAbis: ['arm64-v8a', 'armeabi-v7a'],
  },
};

export const NativeModules = {};
export const StyleSheet = {
  create: (styles) => (typeof styles === 'function' ? styles({}, {}) : styles),
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
  flatten: (s) => s,
  compose: (a, b) => ({ ...a, ...b }),
};
export const Dimensions = {
  get: () => ({ width: 400, height: 800 }),
};

export const View = ({ children }) => children;
export const Text = ({ children }) => children;
export const ScrollView = ({ children }) => children;
export const Pressable = ({ children }) => children;
export const TouchableOpacity = Pressable;
export const TouchableHighlight = Pressable;
export const TouchableWithoutFeedback = Pressable;
export const TextInput = () => null;
export const Alert = { alert: () => {} };
export const ActivityIndicator = () => null;
export const RefreshControl = () => null;
export const useWindowDimensions = () => ({ width: 400, height: 800 });
export const BackHandler = { addEventListener: () => ({ remove: () => {} }) };
export const Share = { share: async () => ({ action: 'sharedAction' }) };
export const Modal = ({ children }) => children;
export const StatusBar = {
  setBarStyle: () => {},
  setBackgroundColor: () => {},
  setTranslucent: () => {},
  currentHeight: 24,
};
export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};
export const processColor = (color) => color;
export const unstable_createElement = () => null;
export const useColorScheme = () => 'dark';
export const Appearance = {
  getColorScheme: () => 'dark',
  addChangeListener: () => ({ remove: () => {} }),
};
export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  roundToNearestPixel: (n) => n,
};
export const I18nManager = { isRTL: false };
export const PanResponder = {
  create: (config) => ({
    panHandlers: {},
    config,
  }),
};
export const FlatList = ({ children }) => children;
export const SectionList = ({ children }) => children;

const createAnimatedComponent = (comp) => comp;
export const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  ScrollView: createAnimatedComponent(ScrollView),
  Value: function (val) {
    this.value = val;
    this.setValue = (v) => {
      this.value = v;
    };
    this.interpolate = () => this;
  },
  timing: () => ({
    start: (cb) => {
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  }),
  spring: () => ({
    start: (cb) => {
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  }),
  sequence: () => ({
    start: (cb) => {
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  }),
  parallel: () => ({
    start: (cb) => {
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  }),
  loop: (anim) => ({
    start: (cb) => {
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  }),
};

export default {
  Platform,
  NativeModules,
  StyleSheet,
  Dimensions,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  BackHandler,
  Share,
  Modal,
  StatusBar,
  AppState,
  processColor,
  unstable_createElement,
  useColorScheme,
  Appearance,
  PixelRatio,
  I18nManager,
  FlatList,
  SectionList,
  PanResponder,
  Animated,
};
