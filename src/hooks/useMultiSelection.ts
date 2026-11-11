import React from 'react';
import * as Haptics from 'expo-haptics';

export interface UseMultiSelectionResult<T> {
  selectedKeys: Set<string>;
  selectedCount: number;
  isSelectionMode: boolean;
  isAllSelected: boolean;
  isItemSelected: (item: T) => boolean;
  startSelection: (item: T) => void;
  toggleSelection: (item: T) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  getSelectedItems: () => T[];
}

/**
 * Manages multi-selection state for FlashList-backed screens (Favorites, History),
 * pruning stale keys automatically when the underlying data changes.
 */
export function useMultiSelection<T>(
  items: T[],
  getKey: (item: T) => string
): UseMultiSelectionResult<T> {
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev;
      const validKeys = new Set(items.map(getKey));
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (validKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items, getKey]);

  const selectedCount = selectedKeys.size;
  const isSelectionMode = selectedCount > 0;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  const isItemSelected = React.useCallback(
    (item: T) => selectedKeys.has(getKey(item)),
    [selectedKeys, getKey]
  );

  const toggleSelection = React.useCallback(
    (item: T) => {
      const key = getKey(item);
      Haptics.selectionAsync().catch(() => {});
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [getKey]
  );

  const startSelection = React.useCallback(
    (item: T) => {
      const key = getKey(item);
      setSelectedKeys((prev) => {
        if (prev.size === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          return new Set([key]);
        }
        Haptics.selectionAsync().catch(() => {});
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [getKey]
  );

  const toggleSelectAll = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedKeys((prev) => {
      if (items.length > 0 && prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map(getKey));
    });
  }, [items, getKey]);

  const clearSelection = React.useCallback(() => {
    setSelectedKeys((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const getSelectedItems = React.useCallback(() => {
    if (selectedKeys.size === 0) return [];
    return items.filter((item) => selectedKeys.has(getKey(item)));
  }, [items, selectedKeys, getKey]);

  return {
    selectedKeys,
    selectedCount,
    isSelectionMode,
    isAllSelected,
    isItemSelected,
    startSelection,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    getSelectedItems,
  };
}
