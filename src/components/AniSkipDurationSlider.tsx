import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  PanResponder,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';

export interface DurationStepItem {
  label: string;
  value: number; // in seconds, 0 = infinito / full interval
  description: string;
}

export const ANISKIP_DURATION_STEPS: DurationStepItem[] = [
  {
    label: '5S',
    value: 5,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 5 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '10S',
    value: 10,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 10 SECONDI DALL'INIZIO DELL'INTERVALLO (PREDEFINITO)",
  },
  {
    label: '15S',
    value: 15,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 15 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '20S',
    value: 20,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 20 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '30S',
    value: 30,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 30 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '45S',
    value: 45,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 45 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '60S',
    value: 60,
    description: "MOSTRA IL PULSANTE 'SALTA' PER 60 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '∞',
    value: 0,
    description: "MOSTRA IL PULSANTE 'SALTA' PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)",
  },
];

export interface AniSkipDurationSliderProps {
  value: number;
  onChange: (newValue: number) => void;
  theme: Theme;
  disabled?: boolean;
}

const THUMB_SIZE = 24;
const THUMB_RADIUS = THUMB_SIZE / 2;

export const AniSkipDurationSlider = React.memo<AniSkipDurationSliderProps>(
  function AniSkipDurationSlider({ value, onChange, theme, disabled = false }) {
    const [trackWidth, setTrackWidth] = React.useState(0);
    const trackWidthRef = React.useRef(0);
    const startLocationXRef = React.useRef(0);

    const activeIndex = React.useMemo(() => {
      if (value === 0) {
        const idx = ANISKIP_DURATION_STEPS.findIndex((s) => s.value === 0);
        return idx >= 0 ? idx : ANISKIP_DURATION_STEPS.length - 1;
      }
      const exactIdx = ANISKIP_DURATION_STEPS.findIndex((s) => s.value === value);
      if (exactIdx >= 0) return exactIdx;

      let nearestIdx = 1; // default 10S
      let minDiff = Infinity;
      ANISKIP_DURATION_STEPS.forEach((step, i) => {
        if (step.value > 0) {
          const diff = Math.abs(step.value - value);
          if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = i;
          }
        }
      });
      return nearestIdx;
    }, [value]);

    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;

    const selectStepByIndex = React.useCallback(
      (index: number) => {
        if (disabled) return;
        const clamped = Math.max(0, Math.min(ANISKIP_DURATION_STEPS.length - 1, index));
        if (clamped !== activeIndexRef.current) {
          Haptics.selectionAsync().catch(() => {});
          activeIndexRef.current = clamped;
          onChangeRef.current(ANISKIP_DURATION_STEPS[clamped].value);
        }
      },
      [disabled]
    );

    const updateFromPositionX = React.useCallback(
      (posX: number) => {
        if (disabled) return;
        const w = trackWidthRef.current;
        if (w <= THUMB_SIZE) return;

        const usableWidth = w - THUMB_SIZE;
        const clampedX = Math.max(0, Math.min(usableWidth, posX - THUMB_RADIUS));
        const ratio = clampedX / usableWidth;
        const newIndex = Math.max(
          0,
          Math.min(
            ANISKIP_DURATION_STEPS.length - 1,
            Math.round(ratio * (ANISKIP_DURATION_STEPS.length - 1))
          )
        );

        if (newIndex !== activeIndexRef.current) {
          Haptics.selectionAsync().catch(() => {});
          activeIndexRef.current = newIndex;
          onChangeRef.current(ANISKIP_DURATION_STEPS[newIndex].value);
        }
      },
      [disabled]
    );

    const panResponder = React.useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gesture) => !disabled && Math.abs(gesture.dx) > 3,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          startLocationXRef.current = evt.nativeEvent.locationX;
          updateFromPositionX(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (_, gesture) => {
          const currentX = startLocationXRef.current + gesture.dx;
          updateFromPositionX(currentX);
        },
        onPanResponderRelease: () => {},
        onPanResponderTerminate: () => {},
      })
    ).current;

    const handleLayout = (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) {
        trackWidthRef.current = w;
        setTrackWidth(w);
      }
    };

    const currentStep = ANISKIP_DURATION_STEPS[activeIndex];
    const activeRatio = activeIndex / (ANISKIP_DURATION_STEPS.length - 1);
    const primaryContrast = getContrastTextColor(theme.colors.primary);
    const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
    const thumbLeft = activeRatio * usableWidth;

    return (
      <View style={[styles.container, disabled && styles.containerDisabled]}>
        {/* Interactive Slider Track */}
        <View
          style={styles.touchArea}
          onLayout={handleLayout}
          {...panResponder.panHandlers}
        >
          <View
            pointerEvents="none"
            style={[
              styles.trackBackground,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            {/* Active fill matching thumb center */}
            <View
              style={[
                styles.trackActiveFill,
                {
                  width: trackWidth > 0 ? thumbLeft + THUMB_RADIUS : `${activeRatio * 100}%`,
                  backgroundColor: disabled ? theme.colors.textMuted : theme.colors.primary,
                },
              ]}
            />

            {/* Step tick dots aligned to thumb center */}
            {ANISKIP_DURATION_STEPS.map((s, idx) => {
              const isFilled = idx <= activeIndex;
              const dotRatio = idx / (ANISKIP_DURATION_STEPS.length - 1);
              const dotLeft =
                trackWidth > 0
                  ? THUMB_RADIUS + dotRatio * usableWidth
                  : `${dotRatio * 100}%`;
              return (
                <View
                  key={s.label}
                  style={[
                    styles.tickDot,
                    {
                      left: dotLeft,
                      backgroundColor: isFilled
                        ? disabled
                          ? theme.colors.textMuted
                          : theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Thumb */}
          {trackWidth > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                {
                  left: thumbLeft,
                  backgroundColor: disabled ? '#888888' : theme.colors.primary,
                  borderColor: '#FFFFFF',
                },
              ]}
            >
              <View
                style={[
                  styles.thumbCenterDot,
                  { backgroundColor: primaryContrast },
                ]}
              />
            </View>
          )}
        </View>

        {/* Discrete Step Labels (Tap-to-jump) */}
        <View style={styles.labelsRow}>
          {ANISKIP_DURATION_STEPS.map((s, idx) => {
            const isActive = idx === activeIndex;
            return (
              <Pressable
                key={s.label}
                style={styles.stepBtn}
                onPress={() => selectStepByIndex(idx)}
                hitSlop={8}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`DURATA PULSANTE SALTA ${s.label}`}
              >
                <Text
                  style={[
                    styles.stepBtnText,
                    { color: theme.colors.textMuted },
                    isActive && [
                      styles.stepBtnTextActive,
                      { color: disabled ? theme.colors.textMuted : theme.colors.primary },
                    ],
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Dynamic Description Box */}
        <View
          style={[
            styles.descriptionBox,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.descriptionText,
              {
                color: disabled ? theme.colors.textMuted : theme.colors.textSecondary,
              },
            ]}
          >
            {disabled
              ? "ATTIVO SOLO QUANDO LA MODALITÀ ANISKIP È IMPOSTATA SU 'MANUALE'"
              : currentStep.description}
          </Text>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  containerDisabled: {
    opacity: 0.65,
  },
  touchArea: {
    height: 44,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  trackActiveFill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tickDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    top: 0,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  thumbCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  stepBtn: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    flex: 1,
  },
  stepBtnText: {
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '700',
    letterSpacing: 0,
  },
  stepBtnTextActive: {
    fontWeight: '900',
    transform: [{ scale: 1.05 }],
  },
  descriptionBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  descriptionText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    letterSpacing: 0.5,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
});
