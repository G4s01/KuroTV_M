export const Constants = {
  expoConfig: {
    version: '1.0.0',
    extra: {},
  },
};

export const documentDirectory = '/mock/documents/';

export let mockFileContent = '';
export const setMockFileContent = (content) => { mockFileContent = content; };
export const readAsStringAsync = async () => mockFileContent;
export const makeDirectoryAsync = async () => {};
export const getInfoAsync = async () => ({ exists: true, size: 104857600 });
export const deleteAsync = async () => {};
export const getFreeDiskStorageAsync = async () => 50000000000;
export const StorageAccessFramework = {
  requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'content://mock/dir' }),
};

export const getNetworkStateAsync = async () => ({
  isConnected: true,
  isInternetReachable: true,
  type: 'WIFI',
});
export const NetworkStateType = {
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
  CELLULAR: 'CELLULAR',
  WIFI: 'WIFI',
  ETHERNET: 'ETHERNET',
};

export const createDownloadResumable = () => ({
  downloadAsync: async () => ({ uri: '/mock/downloaded.apk' }),
  pauseAsync: async () => ({ fileUri: '/mock/downloaded.apk' }),
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
  navigate: () => {},
});

export const useNavigation = () => ({
  addListener: () => () => {},
  navigate: () => {},
  dispatch: () => {},
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
export const setHidden = async () => {};
export const setStyle = () => {};
export const NavigationBar = ({ children }) => children;
NavigationBar.setStyle = () => {};
NavigationBar.setHidden = () => {};
NavigationBar.NavigationBar = NavigationBar;
export const OrientationLock = { LANDSCAPE: 'LANDSCAPE', PORTRAIT_UP: 'PORTRAIT_UP', DEFAULT: 'DEFAULT' };
export const selectionAsync = async () => {};
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };

export const openURL = async () => {};
export const canOpenURL = async () => true;
export const openSettings = async () => {};
export const getInitialURL = async () => null;
export const addEventListener = () => ({ remove: () => {} });

export const CameraView = ({ children }) => children || null;
export const useCameraPermissions = () => [
  { granted: true, canAskAgain: true, status: 'granted' },
  async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
  async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
];
export const Camera = {
  getCameraPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
  requestCameraPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
};

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
  CameraView,
  useCameraPermissions,
  Camera,
  useVideoPlayer,
  useEventListener,
  lockAsync,
  unlockAsync,
  setVisibilityAsync,
  setBehaviorAsync,
  setBackgroundColorAsync,
  getVisibilityAsync,
  NavigationBar,
  OrientationLock,
  selectionAsync,
  impactAsync,
  notificationAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  makeDirectoryAsync,
  readAsStringAsync,
  setMockFileContent,
  getInfoAsync,
  deleteAsync,
  getFreeDiskStorageAsync,
  StorageAccessFramework,
  getNetworkStateAsync,
  NetworkStateType,
};
