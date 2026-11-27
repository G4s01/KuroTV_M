import React from 'react';
import type { Theme } from '@/theme';
import type { PlayerTapDelayMs } from '@/services/storage';
import { StepSlider, type StepItem } from './StepSlider';

export type PlayerTapDelayStepItem = StepItem<PlayerTapDelayMs>;

export const PLAYER_TAP_DELAY_STEPS: PlayerTapDelayStepItem[] = [
  {
    label: 'OFF',
    value: 0,
    description:
      "APERTURA CONTROLLI IMMEDIATA (0 MS): L'OVERLAY APPARE SUBITO AL PRIMO TOCCO, ANCHE DURANTE IL DOPPIO TAP LATERALE",
  },
  {
    label: '100',
    value: 100,
    description:
      "ATTESA DI 100 MS SULLE FASCE LATERALI (35%): RIDUCE IL FLASH DELL'OVERLAY SE SKIPPI MOLTO VELOCEMENTE",
  },
  {
    label: '150',
    value: 150,
    description:
      "ATTESA DI 150 MS SULLE FASCE LATERALI (35%): EQUILIBRIO TRA REATTIVITÀ E SKIP SENZA OVERLAY",
  },
  {
    label: '200',
    value: 200,
    description:
      "ATTESA DI 200 MS SULLE FASCE LATERALI (35% · PREDEFINITO): DOPPIO TAP PULITO SENZA FLASH; FASCIA CENTRALE (30%) SEMPRE A 0 MS",
  },
  {
    label: '250',
    value: 250,
    description:
      "ATTESA DI 250 MS SULLE FASCE LATERALI (35%): MASSIMO MARGINE DI ATTESA PER IL DOPPIO TAP SENZA MOSTRARE L'OVERLAY",
  },
];

export interface PlayerTapDelaySliderProps {
  value: PlayerTapDelayMs;
  onChange: (newValue: PlayerTapDelayMs) => void;
  theme: Theme;
}

/**
 * Slider touch-native unificato per impostare il ritardo di apertura dell'overlay OSD
 * sulle fasce laterali di skip del player.
 */
export const PlayerTapDelaySlider = React.memo<PlayerTapDelaySliderProps>(
  function PlayerTapDelaySlider({ value, onChange, theme }) {
    const findActiveIndex = React.useCallback(
      (steps: StepItem<PlayerTapDelayMs>[], val: PlayerTapDelayMs) => {
        const exactIdx = steps.findIndex((s) => s.value === val);
        return exactIdx >= 0 ? exactIdx : 3; // default 200ms
      },
      []
    );

    return (
      <StepSlider<PlayerTapDelayMs>
        steps={PLAYER_TAP_DELAY_STEPS}
        value={value}
        onChange={onChange}
        theme={theme}
        findActiveIndex={findActiveIndex}
        accessibilityLabelPrefix="RITARDO OVERLAY TAP LATERALI"
        compactLabels={true}
      />
    );
  }
);
