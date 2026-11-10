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
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';
import type { AniSkipMode, AniSkipSettings } from '@/types';

export interface AniSkipSliderProps {
  value: AniSkipMode;
  onChange: (newValue: AniSkipMode) => void;
  theme: Theme;
  settings?: Partial<AniSkipSettings>;
}

export interface AniSkipStepItem {
  label: string;
  value: AniSkipMode;
  description: string;
}

export function formatAniSkipAutoDescription(settings?: Partial<AniSkipSettings>): string {
  const op = settings?.enableOpening ?? true;
  const recap = settings?.enableRecap ?? true;
  const ed = settings?.enableEnding ?? true;

  const items: string[] = [];
  if (op) items.push('INTRO');
  if (recap) items.push('RECAP');
  if (ed) items.push('OUTRO');

  if (items.length === 0) {
    return 'NESSUN INTERVALLO SELEZIONATO. SELEZIONA ALMENO UN ELEMENTO DA SALTARE';
  }

  if (items.length === 1) {
    return `SALTA AUTOMATICAMENTE ${items[0]} ALL'INIZIO DELL'INTERVALLO`;
  }

  if (items.length === 2) {
    return `SALTA AUTOMATICAMENTE ${items[0]} E ${items[1]} ALL'INIZIO DELL'INTERVALLO`;
  }

  return `SALTA AUTOMATICAMENTE ${items[0]}, ${items[1]} E ${items[2]} ALL'INIZIO DELL'INTERVALLO`;
}

export function formatAniSkipManualDescription(settings?: Partial<AniSkipSettings>): string {
  const dur = settings?.buttonDuration;
  if (dur === 0) {
    return "MOSTRA IL PULSANTE 'SALTA' PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)";
  }
  const seconds = typeof dur === 'number' && dur > 0 ? dur : 10;
  return `MOSTRA IL PULSANTE 'SALTA' PER ${seconds} SECONDI ALL'INIZIO DELL'INTERVALLO`;
}

export const ANISKIP_STEPS: AniSkipStepItem[] = [
  {
    label: 'OFF',
    value: 'disabled',
    description: 'SALTO DI SIGLE E RECAP COMPLETAMENTE DISATTIVATO',
  },
  {
    label: 'MANUALE',
    value: 'manual',
    description: "MOSTRA IL PULSANTE 'SALTA' PER 10 SECONDI ALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: 'AUTO',
    value: 'auto',
    description: "SALTA AUTOMATICAMENTE INTRO, OUTRO E RECAP ALL'INIZIO DELL'INTERVALLO",
  },
];

const THUMB_SIZE = 24;
const THUMB_RADIUS = THUMB_SIZE / 2;

export const AniSkipSlider = React.memo<AniSkipSliderProps>(function AniSkipSlider({
  value,
  onChange,
  theme,
  settings,
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackWidthRef = React.useRef(0);
  const startLocationXRef = React.useRef(0);

  const steps = React.useMemo<AniSkipStepItem[]>(() => {
    return [
      {
        label: 'OFF',
        value: 'disabled',
        description: 'SALTO DI SIGLE E RECAP COMPLETAMENTE DISATTIVATO',
      },
      {
        label: 'MANUALE',
        value: 'manual',
        description: formatAniSkipManualDescription(settings),
      },
      {
        label: 'AUTO',
        value: 'auto',
        description: formatAniSkipAutoDescription(settings),
      },
    ];
  }, [settings]);

  const activeIndex = React.useMemo(() => {
    const idx = steps.findIndex((s) => s.value === value);
    return idx >= 0 ? idx : 1; // Default to 'manual' (index 1)
  }, [steps, value]);

  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const selectStepByIndex = React.useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    if (clamped !== activeIndexRef.current) {
      Haptics.selectionAsync().catch(() => {});
      activeIndexRef.current = clamped;
      onChangeRef.current(steps[clamped].value);
    }
  }, [steps]);

  const updateFromPositionX = React.useCallback((posX: number) => {
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
  }, [steps]);

  // PanResponder to prevent ScrollView conflict
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

  const currentStep = steps[activeIndex];
  const activeRatio = activeIndex / (steps.length - 1);
  const primaryContrast = getContrastTextColor(theme.colors.primary);
  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const thumbLeft = activeRatio * usableWidth;

  return (
    <View style={styles.container}>
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
                backgroundColor: currentStep.value === 'disabled' ? theme.colors.textMuted : theme.colors.primary,
              },
            ]}
          />

          {/* Step tick dots aligned to thumb center */}
          {steps.map((s, idx) => {
            const isFilled = idx <= activeIndex;
            const dotRatio = idx / (steps.length - 1);
            const dotLeft = trackWidth > 0 ? THUMB_RADIUS + dotRatio * usableWidth : `${dotRatio * 100}%`;
            return (
              <View
                key={s.label}
                style={[
                  styles.tickDot,
                  {
                    left: dotLeft,
                    backgroundColor: isFilled
                      ? currentStep.value === 'disabled'
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
                backgroundColor: currentStep.value === 'disabled' ? '#888888' : theme.colors.primary,
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
        {steps.map((s, idx) => {
          const isActive = idx === activeIndex;
          return (
            <Pressable
              key={s.label}
              style={styles.stepBtn}
              onPress={() => selectStepByIndex(idx)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`IMPOSTA MODALITÀ ANISKIP A ${s.label}`}
            >
              <Text
                style={[
                  styles.stepBtnText,
                  { color: theme.colors.textMuted },
                  isActive && [
                    styles.stepBtnTextActive,
                    {
                      color: s.value === 'disabled' ? theme.colors.error || '#EF4444' : theme.colors.primary,
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
            borderColor: currentStep.value === 'disabled' ? theme.colors.error || '#EF4444' : theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.descriptionText,
            {
              color:
                currentStep.value === 'disabled'
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
