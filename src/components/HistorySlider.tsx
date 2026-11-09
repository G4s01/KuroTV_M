import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  PanResponder,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';
import type { HistoryRetentionDays } from '@/services/storage';

export interface HistorySliderProps {
  value: HistoryRetentionDays;
  onChange: (newValue: HistoryRetentionDays) => void;
  theme: Theme;
}

export interface StepItem {
  label: string;
  value: HistoryRetentionDays;
  description: string;
}

export const RETENTION_STEPS: StepItem[] = [
  {
    label: 'OFF',
    value: -1,
    description: "CRONOLOGIA DISATTIVATA (NASCOSTA DALL'APP E DALLA BARRA DI NAVIGAZIONE)",
  },
  {
    label: '30GG',
    value: 30,
    description: 'I CONTENUTI PIÙ VECCHI DI 30 GIORNI VENGONO ELIMINATI AUTOMATICAMENTE',
  },
  {
    label: '60GG',
    value: 60,
    description: 'I CONTENUTI PIÙ VECCHI DI 60 GIORNI VENGONO ELIMINATI AUTOMATICAMENTE',
  },
  {
    label: '90GG',
    value: 90,
    description: 'I CONTENUTI PIÙ VECCHI DI 90 GIORNI VENGONO ELIMINATI AUTOMATICAMENTE',
  },
  {
    label: 'ON',
    value: 0,
    description: 'CRONOLOGIA ATTIVA A TEMPO INDETERMINATO SENZA SCADENZA TEMPORALE',
  },
];

const THUMB_SIZE = 24;
const THUMB_RADIUS = THUMB_SIZE / 2;

export const HistorySlider = React.memo<HistorySliderProps>(function HistorySlider({
  value,
  onChange,
  theme,
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackWidthRef = React.useRef(0);
  const startLocationXRef = React.useRef(0);

  // Find index corresponding to current value (default to 90GG if not matched)
  const activeIndex = React.useMemo(() => {
    const idx = RETENTION_STEPS.findIndex((s) => s.value === value);
    return idx >= 0 ? idx : 3; // 90GG default
  }, [value]);

  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const selectStepByIndex = React.useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(RETENTION_STEPS.length - 1, index));
      if (clamped !== activeIndexRef.current) {
        Haptics.selectionAsync().catch(() => {});
        activeIndexRef.current = clamped;
        onChangeRef.current(RETENTION_STEPS[clamped].value);
      }
    },
    []
  );

  const updateFromPositionX = React.useCallback((posX: number) => {
    const w = trackWidthRef.current;
    if (w <= THUMB_SIZE) return;

    const usableWidth = w - THUMB_SIZE;
    const clampedX = Math.max(0, Math.min(usableWidth, posX - THUMB_RADIUS));
    const ratio = clampedX / usableWidth;
    const newIndex = Math.max(
      0,
      Math.min(RETENTION_STEPS.length - 1, Math.round(ratio * (RETENTION_STEPS.length - 1)))
    );

    if (newIndex !== activeIndexRef.current) {
      Haptics.selectionAsync().catch(() => {});
      activeIndexRef.current = newIndex;
      onChangeRef.current(RETENTION_STEPS[newIndex].value);
    }
  }, []);

  // Stable PanResponder: never recreated, prevents parent ScrollView from stealing touch
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
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

  const currentStep = RETENTION_STEPS[activeIndex];
  const activeRatio = activeIndex / (RETENTION_STEPS.length - 1);
  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const thumbLeft = activeRatio * usableWidth;

  return (
    <View style={styles.container}>
      {/* Interactive Slider Track with stable touch handling */}
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
                backgroundColor: currentStep.value === -1 ? theme.colors.textMuted : theme.colors.primary,
              },
            ]}
          />

          {/* Step tick dots aligned to thumb center */}
          {RETENTION_STEPS.map((s, idx) => {
            const isFilled = idx <= activeIndex;
            const dotRatio = idx / (RETENTION_STEPS.length - 1);
            const dotLeft = trackWidth > 0 ? THUMB_RADIUS + dotRatio * usableWidth : `${dotRatio * 100}%`;
            return (
              <View
                key={s.label}
                style={[
                  styles.tickDot,
                  {
                    left: dotLeft,
                    backgroundColor: isFilled
                      ? currentStep.value === -1
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
                backgroundColor: currentStep.value === -1 ? '#888888' : theme.colors.primary,
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
        {RETENTION_STEPS.map((s, idx) => {
          const isActive = idx === activeIndex;
          return (
            <Pressable
              key={s.label}
              style={styles.stepBtn}
              onPress={() => selectStepByIndex(idx)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`IMPOSTA CONSERVAZIONE CRONOLOGIA A ${s.label}`}
            >
              <Text
                style={[
                  styles.stepBtnText,
                  { color: theme.colors.textMuted },
                  isActive && [
                    styles.stepBtnTextActive,
                    {
                      color: s.value === -1 ? theme.colors.error || '#EF4444' : theme.colors.primary,
                    },
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
            borderColor: currentStep.value === -1 ? theme.colors.error || '#EF4444' : theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.descriptionText,
            {
              color:
                currentStep.value === -1
                  ? theme.colors.error || '#EF4444'
                  : theme.colors.textSecondary,
            },
          ]}
        >
          {currentStep.description}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  touchArea: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },
  trackActiveFill: {
    height: '100%',
    borderRadius: 4,
  },
  tickDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: -2,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  thumbCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stepBtn: {
    minHeight: 32,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  stepBtnTextActive: {
    fontWeight: '900',
    fontSize: 12,
  },
  descriptionBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
