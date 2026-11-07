export const Constants = {
  expoConfig: { version: '1.0.0', android: { versionCode: 1 } },
  nativeAppVersion: '1.0.0',
  nativeBuildVersion: '1',
};

export const cacheDirectory = '/tmp/';
export const documentDirectory = '/tmp/';
export const createDownloadResumable = () => ({
  downloadAsync: async () => ({ uri: '/tmp/test.apk' }),
});

export const startActivityAsync = async () => {};

export default { Constants };
