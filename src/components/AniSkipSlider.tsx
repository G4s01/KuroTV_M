import React from 'react';
import type { Theme } from '@/theme';
import type { AniSkipMode, AniSkipSettings } from '@/types';
import { StepSlider, type StepItem } from './StepSlider';

export type AniSkipStepItem = StepItem<AniSkipMode>;

export interface AniSkipSliderProps {
  value: AniSkipMode;
  onChange: (newValue: AniSkipMode) => void;
  theme: Theme;
  settings?: Partial<AniSkipSettings>;
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
    return "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER L'INTERA TOTALITÀ DELL'INTERVALLO (INFINITO)";
  }
  const seconds = typeof dur === 'number' && dur > 0 ? dur : 10;
  return `MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER ${seconds} SECONDI ALL'INIZIO DELL'INTERVALLO`;
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
    description: "MOSTRA I PULSANTI ANISKIP ('SALTA' / 'PROSSIMO') PER 10 SECONDI ALL'INIZIO DELL'INTERVALLO",
  },
  {
    label: 'AUTO',
    value: 'auto',
    description: "SALTA AUTOMATICAMENTE INTRO, OUTRO E RECAP ALL'INIZIO DELL'INTERVALLO",
  },
];

export const AniSkipSlider = React.memo<AniSkipSliderProps>(function AniSkipSlider({
  value,
  onChange,
  theme,
  settings,
}) {
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

  return (
    <StepSlider<AniSkipMode>
      steps={steps}
      value={value}
      onChange={onChange}
      theme={theme}
      isInactive={(step) => step.value === 'disabled'}
      accessibilityLabelPrefix="IMPOSTA MODALITÀ ANISKIP A"
    />
  );
});
