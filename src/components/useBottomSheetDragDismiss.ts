import React from 'react';
import {
  Animated,
  Dimensions,
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
 *
 * Restituisce due set di panHandlers:
 * - `dragStripHandlers`: per la striscia drag handle a tutta larghezza (nessun figlio interattivo).
 *   Utilizza `onStartShouldSetPanResponder` per catturare immediatamente il tocco.
 * - `panHandlers` (legacy/header): per aree che contengono figli interattivi (Pressable, bottoni).
 *   Utilizza la fase di cattura (`onMoveShouldSetPanResponderCapture`) per intercettare
 *   la gesture verticale *prima* che i figli la consumino, senza interferire con i tap.
 */
export function useBottomSheetDragDismiss({
  isVisible,
  onClose,
  dismissThreshold = 60,
  velocityThreshold = 0.4,
}: UseBottomSheetDragDismissOptions) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const onCloseRef = React.useRef(onClose);
  const isVisibleRef = React.useRef(isVisible);
  const wasVisibleRef = React.useRef(false);
  const isDismissingRef = React.useRef(false);

  onCloseRef.current = onClose;
  isVisibleRef.current = isVisible;

  const useSyncLayoutEffect =
    typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

  // Reset vertical offset synchronously only when the sheet transitions to visible.
  // Keeping translateY off-screen after a swipe-down dismiss avoids the snap-back
  // glitch before Modal completes its native close transition.
  useSyncLayoutEffect(() => {
    if (isVisible) {
      if (!wasVisibleRef.current) {
        wasVisibleRef.current = true;
        isDismissingRef.current = false;
        translateY.stopAnimation?.();
        translateY.setValue(0);
      }
    } else {
      wasVisibleRef.current = false;
      isDismissingRef.current = false;
    }
  }, [isVisible, translateY]);

  // Shared move/release/terminate handlers
  const handleMove = React.useCallback(
    (_: any, gesture: PanResponderGestureState) => {
      if (isDismissingRef.current) return;
      if (gesture.dy > 0) {
        translateY.setValue(gesture.dy);
      } else {
        // Resistenza elastica verso l'alto
        translateY.setValue(gesture.dy * 0.15);
      }
    },
    [translateY]
  );

  const handleRelease = React.useCallback(
    (_: any, gesture: PanResponderGestureState) => {
      if (isDismissingRef.current) return;

      if (
        gesture.dy > dismissThreshold ||
        (gesture.dy > 25 && gesture.vy > velocityThreshold)
      ) {
        isDismissingRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const windowHeight = Dimensions.get('window').height || 800;
        const dismissTarget = Math.max(windowHeight, 800);
        Animated.timing(translateY, {
          toValue: dismissTarget,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          if (isDismissingRef.current && isVisibleRef.current) {
            onCloseRef.current();
          }
        });
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      }
    },
    [dismissThreshold, velocityThreshold, translateY]
  );

  const handleTerminate = React.useCallback(() => {
    if (isDismissingRef.current) return;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const handleGrant = React.useCallback(() => {
    if (isDismissingRef.current) return;
    translateY.stopAnimation?.();
  }, [translateY]);

  /**
   * PanResponder per la striscia drag handle dedicata (tutta larghezza, nessun figlio interattivo):
   * cattura al tocco iniziale per risposta istantanea.
   */
  const dragStripResponder = React.useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !isDismissingRef.current,
      onMoveShouldSetPanResponder: () => !isDismissingRef.current,
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleTerminate,
    });
  }, [handleGrant, handleMove, handleRelease, handleTerminate]);

  /**
   * PanResponder per l'header row (contiene bottone chiudi e testi interattivi):
   * utilizza la fase di cattura per intercettare gesture verticali nette
   * *prima* che i figli Pressable le consumino, senza bloccare i tap.
   */
  const headerResponder = React.useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture: PanResponderGestureState) => {
        return (
          !isDismissingRef.current &&
          gesture.dy > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2
        );
      },
      // Fase di cattura: intercetta PRIMA dei figli se la gesture è verticale netta
      onMoveShouldSetPanResponderCapture: (_, gesture: PanResponderGestureState) => {
        return (
          !isDismissingRef.current &&
          gesture.dy > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5
        );
      },
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleTerminate,
    });
  }, [handleGrant, handleMove, handleRelease, handleTerminate]);

  return {
    translateY,
    /** @deprecated Usa dragStripHandlers + headerPanHandlers per separazione ottimale */
    panHandlers: headerResponder.panHandlers,
    /** Handlers per la striscia drag handle a tutta larghezza (senza figli interattivi) */
    dragStripHandlers: dragStripResponder.panHandlers,
    /** Handlers per l'header row contenente bottoni/testi interattivi (fase di cattura) */
    headerPanHandlers: headerResponder.panHandlers,
  };
}
