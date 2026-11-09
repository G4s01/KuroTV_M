export const Constants = {
  expoConfig: {
    version: '1.0.0',
    extra: {},
  },
};

export const documentDirectory = '/mock/documents/';

export const createDownloadResumable = () => ({
  downloadAsync: async () => ({ uri: '/mock/downloaded.apk' }),
});

export const startActivityAsync = async () => {};

export const Stack = ({ children }) => children;
Stack.Screen = () => null;

export const Tabs = ({ children }) => children;
Tabs.Screen = () => null;

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
});

export const useFocusEffect = (cb) => {
  if (typeof cb === 'function') {
    try {
      const res = cb();
      if (typeof res === 'function') res();
    } catch {
      // ignore
    }
  }
};

export const useLocalSearchParams = () => ({ id: '1' });

export const StatusBar = () => null;

export const Image = () => null;
export const VideoView = () => null;
export const useVideoPlayer = () => ({
  play: () => {},
  pause: () => {},
  replace: () => {},
  replaceAsync: async () => {},
  addListener: () => ({ remove: () => {} }),
  generateThumbnailsAsync: async (times) =>
    (Array.isArray(times) ? times : [times]).map((t) => ({ actualTime: t, width: 160, height: 90 })),
  currentTime: 0,
  duration: 0,
  playing: false,
});
export const useEventListener = () => {};
export const lockAsync = async () => {};
export const unlockAsync = async () => {};
export const setVisibilityAsync = async () => {};
export const setBehaviorAsync = async () => {};
export const setBackgroundColorAsync = async () => {};
export const getVisibilityAsync = async () => 'visible';
export const OrientationLock = { LANDSCAPE: 'LANDSCAPE', PORTRAIT_UP: 'PORTRAIT_UP', DEFAULT: 'DEFAULT' };
export const selectionAsync = async () => {};
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };

export default {
  Constants,
  Stack,
  Tabs,
  useRouter,
  useFocusEffect,
  useLocalSearchParams,
  StatusBar,
  Image,
  VideoView,
  useVideoPlayer,
  useEventListener,
  lockAsync,
  unlockAsync,
  setVisibilityAsync,
  setBehaviorAsync,
  setBackgroundColorAsync,
  getVisibilityAsync,
  OrientationLock,
  selectionAsync,
  impactAsync,
  notificationAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};
