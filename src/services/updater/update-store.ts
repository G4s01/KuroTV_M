import React from 'react';
import type { UpdateCheckResult } from './types';

type UpdateListener = () => void;

let pendingUpdate: UpdateCheckResult | null = null;
let isModalDismissed = false;
let autoDownloadRequested = false;
let startupCheckFinished = false;
let updateFlowAccepted = false;
const listeners = new Set<UpdateListener>();

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Safe listener catch
    }
  }
}

export const UpdateStore = {
  getPendingUpdate: (): UpdateCheckResult | null => pendingUpdate,

  setPendingUpdate: (update: UpdateCheckResult | null): void => {
    pendingUpdate = update;
    isModalDismissed = false;
    notify();
  },

  isModalDismissed: (): boolean => isModalDismissed,

  dismissModal: (): void => {
    isModalDismissed = true;
    notify();
  },

  isAutoDownloadRequested: (): boolean => autoDownloadRequested,

  setAutoDownloadRequested: (flag: boolean): void => {
    autoDownloadRequested = flag;
    if (flag) {
      updateFlowAccepted = true;
    }
    notify();
  },

  isStartupCheckFinished: (): boolean => startupCheckFinished,

  setStartupCheckFinished: (finished: boolean): void => {
    startupCheckFinished = finished;
    notify();
  },

  isUpdateFlowAccepted: (): boolean => updateFlowAccepted,

  resetStartupPriorityState: (): void => {
    startupCheckFinished = false;
    updateFlowAccepted = false;
    notify();
  },

  clearUpdate: (): void => {
    pendingUpdate = null;
    isModalDismissed = false;
    autoDownloadRequested = false;
    notify();
  },

  subscribe: (listener: UpdateListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function usePendingUpdate() {
  const [state, setState] = React.useState(() => ({
    update: UpdateStore.getPendingUpdate(),
    isDismissed: UpdateStore.isModalDismissed(),
    autoDownload: UpdateStore.isAutoDownloadRequested(),
    startupCheckFinished: UpdateStore.isStartupCheckFinished(),
    updateFlowAccepted: UpdateStore.isUpdateFlowAccepted(),
  }));

  React.useEffect(() => {
    return UpdateStore.subscribe(() => {
      setState({
        update: UpdateStore.getPendingUpdate(),
        isDismissed: UpdateStore.isModalDismissed(),
        autoDownload: UpdateStore.isAutoDownloadRequested(),
        startupCheckFinished: UpdateStore.isStartupCheckFinished(),
        updateFlowAccepted: UpdateStore.isUpdateFlowAccepted(),
      });
    });
  }, []);

  return state;
}
