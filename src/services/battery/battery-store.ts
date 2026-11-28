import React from 'react';
import { AppStorage } from '@/services/storage/app-storage';
import { BatteryService } from './battery-service';
import type {
  BatteryLaunchMethod,
  BatteryOptimizationStatus,
  BatterySettingsLaunchResult,
  BatteryVerificationState,
} from './types';

export interface StartupPromptEligibilityInput {
  startupUpdateCheckFinished: boolean;
  hasVisibleUpdateModal: boolean;
  isUpdateFlowActive: boolean;
  hasBlockingModal?: boolean;
  currentPathname?: string;
}

export interface BatteryStoreState {
  status: BatteryOptimizationStatus;
  isSilenced: boolean;
  isDismissedForSession: boolean;
  isStartupModalPresented: boolean;
  verificationState: BatteryVerificationState;
  lastLaunchMethod: BatteryLaunchMethod;
  hasAttemptedConfigure: boolean;
}

type BatteryStoreListener = () => void;

let status: BatteryOptimizationStatus = BatteryService.getStatus();
let isSilenced = false;
try {
  isSilenced = AppStorage.isBatteryPromptSilenced();
} catch {
  isSilenced = false;
}
let isDismissedForSession = false;
let isStartupModalPresented = false;
let verificationState: BatteryVerificationState = 'idle';
let lastLaunchMethod: BatteryLaunchMethod = 'none';
let hasAttemptedConfigure = false;
const listeners = new Set<BatteryStoreListener>();

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Safe listener catch
    }
  }
}

function getSnapshot(): BatteryStoreState {
  return {
    status,
    isSilenced,
    isDismissedForSession,
    isStartupModalPresented,
    verificationState,
    lastLaunchMethod,
    hasAttemptedConfigure,
  };
}

export const BatteryStore = {
  getState: (): BatteryStoreState => getSnapshot(),

  refreshStatus: (): BatteryOptimizationStatus => {
    const latest = BatteryService.getStatus();
    status = latest;
    try {
      isSilenced = AppStorage.isBatteryPromptSilenced();
    } catch {
      // Ignore in test fallback
    }
    if (latest.isUnrestricted && verificationState === 'awaiting_return') {
      verificationState = 'verified';
    } else if (latest.isUnrestricted && verificationState === 'not_applied') {
      verificationState = 'verified';
    } else if (!latest.isUnrestricted && verificationState === 'verified') {
      verificationState = 'idle';
    }
    notify();
    return latest;
  },

  applyNativeStatusUpdate: (latest: BatteryOptimizationStatus): void => {
    status = latest;
    if (latest.isUnrestricted) {
      if (verificationState === 'awaiting_return' || verificationState === 'not_applied' || hasAttemptedConfigure) {
        verificationState = 'verified';
      }
    } else if (verificationState === 'verified') {
      verificationState = 'idle';
    }
    notify();
  },

  verifyAfterReturn: (): BatteryOptimizationStatus => {
    const latest = BatteryService.getStatus();
    status = latest;
    if (latest.isUnrestricted) {
      if (verificationState === 'awaiting_return' || verificationState === 'not_applied' || hasAttemptedConfigure) {
        verificationState = 'verified';
      }
    } else if (verificationState === 'awaiting_return') {
      verificationState = 'not_applied';
    }
    notify();
    return latest;
  },

  startUnrestrictedRequest: (): BatterySettingsLaunchResult => {
    hasAttemptedConfigure = true;
    const current = BatteryService.getStatus();
    status = current;
    if (!current.isUnrestricted) {
      verificationState = 'awaiting_return';
      notify();
    }

    const result = BatteryService.requestUnrestricted();
    lastLaunchMethod = result.method;
    if (current.isUnrestricted) {
      verificationState = 'verified';
    } else if (result.alreadyUnrestricted) {
      status = {
        ...current,
        isIgnoringBatteryOptimizations: true,
        isBackgroundRestricted: false,
        isUnrestricted: true,
      };
      verificationState = 'verified';
    } else if (!result.launched) {
      verificationState = 'not_applied';
    }
    notify();
    return result;
  },

  openSystemSettings: (): BatterySettingsLaunchResult => {
    hasAttemptedConfigure = true;
    verificationState = 'awaiting_return';
    notify();

    const result = BatteryService.openSystemSettings();
    lastLaunchMethod = result.method;
    if (!result.launched) {
      verificationState = 'not_applied';
    }
    notify();
    return result;
  },

  setStartupModalPresented: (presented: boolean): void => {
    if (isStartupModalPresented !== presented) {
      isStartupModalPresented = presented;
      notify();
    }
  },

  dismissForSession: (): void => {
    isDismissedForSession = true;
    isStartupModalPresented = false;
    verificationState = 'idle';
    notify();
  },

  resetDismissedOnAppReopen: (): void => {
    let changed = false;
    if (isDismissedForSession) {
      isDismissedForSession = false;
      changed = true;
    }
    if (verificationState !== 'idle' && !isStartupModalPresented) {
      verificationState = 'idle';
      changed = true;
    }
    if (changed) {
      notify();
    }
  },

  silencePrompt: (silenced = true): void => {
    isSilenced = Boolean(silenced);
    AppStorage.setBatteryPromptSilenced(Boolean(silenced));
    if (silenced) {
      isDismissedForSession = true;
      isStartupModalPresented = false;
    }
    notify();
  },

  resetForTest: (): void => {
    status = BatteryService.getStatus();
    try {
      isSilenced = AppStorage.isBatteryPromptSilenced();
    } catch {
      isSilenced = false;
    }
    isDismissedForSession = false;
    isStartupModalPresented = false;
    verificationState = 'idle';
    lastLaunchMethod = 'none';
    hasAttemptedConfigure = false;
    notify();
  },

  shouldShowStartupModal: ({
    startupUpdateCheckFinished,
    hasVisibleUpdateModal,
    isUpdateFlowActive,
    hasBlockingModal = false,
    currentPathname,
  }: StartupPromptEligibilityInput): boolean => {
    if (!status.isSupported) return false;
    if (isStartupModalPresented && verificationState === 'verified' && !isDismissedForSession) {
      return true;
    }
    if (status.isUnrestricted) return false;
    if (isSilenced) return false;
    if (isDismissedForSession) return false;
    if (!startupUpdateCheckFinished) return false;
    if (hasVisibleUpdateModal) return false;
    if (isUpdateFlowActive) return false;
    if (hasBlockingModal) return false;
    if (
      currentPathname &&
      (currentPathname.startsWith('/player') || currentPathname.startsWith('/settings/about'))
    ) {
      return false;
    }
    return true;
  },

  subscribe: (listener: BatteryStoreListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useBatteryOptimization() {
  const [state, setState] = React.useState<BatteryStoreState>(() => BatteryStore.getState());

  React.useEffect(() => {
    setState(BatteryStore.getState());
    const unsubStore = BatteryStore.subscribe(() => {
      setState(BatteryStore.getState());
    });
    const unsubSettings = AppStorage.addSettingsListener(() => {
      const nextSilenced = AppStorage.isBatteryPromptSilenced();
      if (nextSilenced !== isSilenced) {
        isSilenced = nextSilenced;
        notify();
      }
    });
    return () => {
      unsubStore();
      unsubSettings();
    };
  }, []);

  return state;
}
