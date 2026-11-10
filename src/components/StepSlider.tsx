import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { oledTheme, getContrastTextColor, type Theme, FONT_MONO } from '@/theme';

export interface StepItem<T> {
  label: string;
  value: T;
  description?: string;
}

export interface StepSliderProps<T> {
  steps: StepItem<T>[];
  value: T;
  onChange: (newValue: T) => void;
  theme: Theme;
  disabled?: boolean;
  disabledDescription?: string;
  isInactive?: (step: StepItem<T>) => boolean;
  findActiveIndex?: (steps: StepItem<T>[], value: T) => number;
  accessibilityLabelPrefix?: string;
  compactLabels?: boolean;
}

const THUMB_SIZE = 24;
const THUMB_RADIUS = THUMB_SIZE / 2;

export function StepSlider<T>({
  steps,
  value,
  onChange,
  theme,
  disabled = false,
  disabledDescription,
  isInactive,
  findActiveIndex,
  accessibilityLabelPrefix = 'SELEZIONA',
  compactLabels = false,
}: StepSliderProps<T>) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackWidthRef = React.useRef(0);
  const startLocationXRef = React.useRef(0);

  // Compute active index based on custom matcher or exact value match
  const activeIndex = React.useMemo(() => {
    if (findActiveIndex) {
      return findActiveIndex(steps, value);
    }
    const idx = steps.findIndex((s) => s.value === value);
    return idx >= 0 ? idx : 0;
  }, [findActiveIndex, steps, value]);

  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const selectStepByIndex = React.useCallback(
    (index: number) => {
      if (disabled) return;
      const clamped = Math.max(0, Math.min(steps.length - 1, index));
      if (clamped !== activeIndexRef.current) {
        Haptics.selectionAsync().catch(() => {});
        activeIndexRef.current = clamped;
        onChangeRef.current(steps[clamped].value);
      }
    },
    [disabled, steps]
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
        Math.min(steps.length - 1, Math.round(ratio * (steps.length - 1)))
      );

      if (newIndex !== activeIndexRef.current) {
        Haptics.selectionAsync().catch(() => {});
        activeIndexRef.current = newIndex;
        onChangeRef.current(steps[newIndex].value);
      }
    },
    [disabled, steps]
  );

  // Stable PanResponder: never recreated, prevents parent ScrollView from stealing touch
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

  const currentStep = steps[activeIndex] || steps[0];
  const stepCount = Math.max(1, steps.length - 1);
  const activeRatio = activeIndex / stepCount;
  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const thumbLeft = activeRatio * usableWidth;

  const inactive = isInactive ? isInactive(currentStep) : false;
  const errorColor = theme.colors.error || '#EF4444';
  const fillColor = disabled
    ? theme.colors.textMuted
    : inactive
    ? theme.colors.textMuted
    : theme.colors.primary;
  const thumbColor = disabled
    ? '#888888'
    : inactive
    ? '#888888'
    : theme.colors.primary;

  const descriptionColor = disabled
    ? theme.colors.textMuted
    : inactive
    ? errorColor
    : theme.colors.textSecondary;

  const descriptionBorderColor = disabled
    ? theme.colors.border
    : inactive
    ? errorColor
    : theme.colors.border;

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
                backgroundColor: fillColor,
              },
            ]}
          />

          {/* Step tick dots aligned to thumb center */}
          {steps.map((s, idx) => {
            const isFilled = idx <= activeIndex;
            const dotRatio = idx / stepCount;
            const dotLeft =
              trackWidth > 0
                ? THUMB_RADIUS + dotRatio * usableWidth
                : `${dotRatio * 100}%`;
            return (
              <View
                key={`dot-${s.label}-${idx}`}
                style={[
                  styles.tickDot,
                  {
                    left: dotLeft,
                    backgroundColor: isFilled
                      ? fillColor
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
                backgroundColor: thumbColor,
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
      <View style={[styles.labelsRow, compactLabels && styles.labelsRowCompact]}>
        {steps.map((s, idx) => {
          const isActive = idx === activeIndex;
          const stepInactive = isInactive ? isInactive(s) : false;
          return (
            <Pressable
              key={`btn-${s.label}-${idx}`}
              style={[styles.stepBtn, compactLabels && styles.stepBtnCompact]}
              onPress={() => selectStepByIndex(idx)}
              hitSlop={8}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabelPrefix} ${s.label}`}
            >
              <Text
                style={[
                  styles.stepBtnText,
                  { color: theme.colors.textMuted },
                  isActive && [
                    styles.stepBtnTextActive,
                    {
                      color: disabled
                        ? theme.colors.textMuted
                        : stepInactive
                        ? errorColor
                        : theme.colors.primary,
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
            borderColor: descriptionBorderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.descriptionText,
            { color: descriptionColor },
          ]}
        >
          {disabled && disabledDescription ? disabledDescription : currentStep.description || ''}
        </Text>
      </View>
    </View>
  );
}

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
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
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
  labelsRowCompact: {
    alignItems: 'center',
  },
  stepBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_MONO,
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
    fontFamily: FONT_MONO,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
