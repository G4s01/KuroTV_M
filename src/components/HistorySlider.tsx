import React from 'react';
import type { Theme } from '@/theme';
import type { HistoryRetentionDays } from '@/services/storage';
import { StepSlider, type StepItem } from './StepSlider';

export interface HistorySliderProps {
  value: HistoryRetentionDays;
  onChange: (newValue: HistoryRetentionDays) => void;
  theme: Theme;
  steps?: StepItem<HistoryRetentionDays>[];
}

export const RETENTION_STEPS: StepItem<HistoryRetentionDays>[] = [
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

export const SEARCH_RETENTION_STEPS: StepItem<HistoryRetentionDays>[] = [
  {
    label: 'OFF',
    value: -1,
    description: 'CRONOLOGIA DI RICERCA DISATTIVATA (NON MEMORIZZA LE RICERCHE FUTURE)',
  },
  {
    label: '30GG',
    value: 30,
    description: 'LE RICERCHE PIÙ VECCHIE DI 30 GIORNI VENGONO ELIMINATE AUTOMATICAMENTE',
  },
  {
    label: '60GG',
    value: 60,
    description: 'LE RICERCHE PIÙ VECCHIE DI 60 GIORNI VENGONO ELIMINATE AUTOMATICAMENTE',
  },
  {
    label: '90GG',
    value: 90,
    description: 'LE RICERCHE PIÙ VECCHIE DI 90 GIORNI VENGONO ELIMINATE AUTOMATICAMENTE',
  },
  {
    label: 'ON',
    value: 0,
    description: 'CRONOLOGIA DI RICERCA ATTIVA A TEMPO INDETERMINATO SENZA SCADENZA',
  },
];

/**
 * HistorySlider encapsulates the retention period selector using StepSlider.
 * - Stable PanResponder with onPanResponderTerminationRequest: () => false blocks parent ScrollView from stealing touch.
 * - pointerEvents="none" on the track background, tick dots and thumb prevents touch coordinate jumping.
 */
export const HistorySlider = React.memo<HistorySliderProps>(function HistorySlider({
  value,
  onChange,
  theme,
  steps = RETENTION_STEPS,
}) {
  return (
    <StepSlider<HistoryRetentionDays>
      steps={steps}
      value={value}
      onChange={onChange}
      theme={theme}
      isInactive={(step) => step.value === -1}
      accessibilityLabelPrefix="IMPOSTA CONSERVAZIONE CRONOLOGIA A"
    />
  );
});
