import React from 'react';
import {
  Animated,
  PanResponder,
  type PanResponderGestureState,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface UseBottomSheetDragDismissOptions {
  isVisible: boolean;
  onClose: () => void;
  dismissThreshold?: number;
  velocityThreshold?: number;
}

/**
 * Hook touch-native per abilitare la chiusura tramite scorrimento/swipe-down
 * sui menù e fogli a comparsa (bottom sheets).
 *
 * Utilizza driver nativo 60/120 FPS su Fabric per traslare la modale verso il basso
 * seguendo il dito dell'utente quando la gesture parte dall'intestazione / drag indicator.
 */
export function useBottomSheetDragDismiss({
  isVisible,
  onClose,
  dismissThreshold = 60,
  velocityThreshold = 0.4,
}: UseBottomSheetDragDismissOptions) {
  const translateY = React.useRef(new Animated.Value(0)).current;

  // Reset vertical offset whenever sheet visibility changes
  React.useEffect(() => {
    if (isVisible) {
      translateY.setValue(0);
    }
  }, [isVisible, translateY]);

  const panResponder = React.useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture: PanResponderGestureState) => {
        // Cattura gesture verso il basso con intenzione verticale netta (> 4dp e dy dominante)
        return gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2;
      },
      onPanResponderGrant: () => {
        translateY.stopAnimation?.();
      },
      onPanResponderMove: (_, gesture: PanResponderGestureState) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        } else {
          // Resistenza elastica verso l'alto
          translateY.setValue(gesture.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, gesture: PanResponderGestureState) => {
        if (
          gesture.dy > dismissThreshold ||
          (gesture.dy > 25 && gesture.vy > velocityThreshold)
        ) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [onClose, dismissThreshold, velocityThreshold, translateY]);

  return {
    translateY,
    panHandlers: panResponder.panHandlers,
  };
}
