import fs from 'node:fs';
import path from 'node:path';

const patches = [
  {
    src: 'scripts/patches/expo-video/ExpoVideoPlaybackService.kt',
    dest: 'node_modules/expo-video/android/src/main/java/expo/modules/video/playbackService/ExpoVideoPlaybackService.kt',
  },
  {
    src: 'scripts/patches/expo-video/VideoMediaSessionCallback.kt',
    dest: 'node_modules/expo-video/android/src/main/java/expo/modules/video/playbackService/VideoMediaSessionCallback.kt',
  },
];

for (const patch of patches) {
  const srcPath = path.resolve(process.cwd(), patch.src);
  const destPath = path.resolve(process.cwd(), patch.dest);
  if (fs.existsSync(srcPath) && fs.existsSync(path.dirname(destPath))) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`[Patch] Applied ${patch.src} -> ${patch.dest}`);
  }
}
