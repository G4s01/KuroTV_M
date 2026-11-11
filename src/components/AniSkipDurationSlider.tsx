import React from 'react';
import type { Theme } from '@/theme';
import { StepSlider, type StepItem } from './StepSlider';

export type DurationStepItem = StepItem<number>;

export const ANISKIP_DURATION_STEPS: DurationStepItem[] = [
  {
    label: '5S',
    value: 5,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 5 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '10S',
    value: 10,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 10 SECONDI DALL'INIZIO DELL'INTERVALLO (PREDEFINITO)",
  },
  {
    label: '15S',
    value: 15,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 15 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '20S',
    value: 20,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 20 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '30S',
    value: 30,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 30 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '45S',
    value: 45,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 45 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '60S',
    value: 60,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 60 SECONDI DALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: '∞',
    value: 0,
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)",
  },
];

export interface AniSkipDurationSliderProps {
  value: number;
  onChange: (newValue: number) => void;
  theme: Theme;
  disabled?: boolean;
}

export const AniSkipDurationSlider = React.memo<AniSkipDurationSliderProps>(
  function AniSkipDurationSlider({ value, onChange, theme, disabled = false }) {
    const findActiveIndex = React.useCallback((steps: StepItem<number>[], val: number) => {
      if (val === 0) {
        const idx = steps.findIndex((s) => s.value === 0);
        return idx >= 0 ? idx : steps.length - 1;
      }
      const exactIdx = steps.findIndex((s) => s.value === val);
      if (exactIdx >= 0) return exactIdx;

      let nearestIdx = 1; // default 10S
      let minDiff = Infinity;
      steps.forEach((step, i) => {
        if (step.value > 0) {
          const diff = Math.abs(step.value - val);
          if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = i;
          }
        }
      });
      return nearestIdx;
    }, []);

    return (
      <StepSlider<number>
        steps={ANISKIP_DURATION_STEPS}
        value={value}
        onChange={onChange}
        theme={theme}
        disabled={disabled}
        disabledDescription="ATTIVO SOLO QUANDO LA MODALITÀ ANISKIP È IMPOSTATA SU 'MANUALE'"
        findActiveIndex={findActiveIndex}
        accessibilityLabelPrefix="DURATA PULSANTI ANISKIP"
        compactLabels={true}
      />
    );
  }
);
