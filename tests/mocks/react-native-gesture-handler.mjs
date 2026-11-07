export const GestureHandlerRootView = ({ children }) => children;

const chainableGesture = () => {
  const g = {
    numberOfTaps: () => g,
    maxDuration: () => g,
    maxDistance: () => g,
    minDistance: () => g,
    runOnJS: () => g,
    onBegin: () => g,
    onStart: () => g,
    onUpdate: () => g,
    onEnd: () => g,
    onFinalize: () => g,
    enabled: () => g,
  };
  return g;
};

export const Gesture = {
  Tap: () => chainableGesture(),
  Pan: () => chainableGesture(),
  Exclusive: (...gestures) => ({ gestures }),
  Race: (...gestures) => ({ gestures }),
  Simultaneous: (...gestures) => ({ gestures }),
};
export const GestureDetector = ({ children }) => children;

export default { GestureHandlerRootView, Gesture, GestureDetector };
