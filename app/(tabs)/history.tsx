import React from 'react';
import {
  Text,
  View,
  Pressable,
  RefreshControl,
  Animated,
  PanResponder,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppStorage } from '@/services/storage';
import { SyncManager } from '@/services/sync';
import { useTheme, getContrastTextColor } from '@/theme';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SelectionAppBar } from '@/components/SelectionAppBar';
import { useResponsiveLayout, useMultiSelection } from '@/hooks';
import type { WatchHistoryItem } from '@/types';
import { historyStyles as styles } from '@/components/history/history.styles';

const getHistoryItemKey = (item: WatchHistoryItem) =>
  `${item.animeId}::${item.episodeId}::${item.episodeNumber}`;

interface HistoryItemRowProps {
  item: WatchHistoryItem;
  theme: any;
  selectionMode?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onRequestDelete: (item: WatchHistoryItem) => void;
  formatDate: (timestamp?: number) => string;
}

const HistoryItemRow = React.memo<HistoryItemRowProps>(function HistoryItemRow({
  item,
  theme,
  selectionMode = false,
  isSelected = false,
  onPress,
  onLongPress,
  onRequestDelete,
  formatDate,
}) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const isSwipedRef = React.useRef(false);

  React.useEffect(() => {
    translateX.setValue(0);
    isSwipedRef.current = false;
  }, [item.animeId, item.episodeId, item.episodeNumber, translateX]);

  React.useEffect(() => {
    if (selectionMode && isSwipedRef.current) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      isSwipedRef.current = false;
    }
  }, [selectionMode, translateX]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (selectionMode) return false;
          return Math.abs(gesture.dx) > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
        },
        onPanResponderMove: (_, gesture) => {
          if (selectionMode) return;
          if (gesture.dx < 0) {
            translateX.setValue(Math.max(-120, gesture.dx));
          } else if (isSwipedRef.current) {
            translateX.setValue(Math.min(0, -90 + gesture.dx));
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (selectionMode) return;
          if (gesture.dx < -160) {
            // Strong swipe: trigger in-app delete confirmation directly
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            isSwipedRef.current = false;
            onRequestDelete(item);
          } else if (gesture.dx < -50 || (isSwipedRef.current && gesture.dx < 30)) {
            // Open state: reveal red delete button
            Animated.spring(translateX, {
              toValue: -90,
              useNativeDriver: true,
            }).start();
            isSwipedRef.current = true;
          } else {
            // Snap back closed
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            isSwipedRef.current = false;
          }
        },
      }),
    [item, onRequestDelete, selectionMode, translateX]
  );

  const progress = Math.min(100, item.progressPercent || 0);
  const isDone = progress >= 90;

  return (
    <View style={styles.swipeContainer}>
      {/* Background delete action revealed by slide */}
      {!selectionMode && (
        <Pressable
          style={[styles.swipeDeleteAction, { backgroundColor: theme.colors.error || '#EF4444' }]}
          onPress={() => {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            isSwipedRef.current = false;
            onRequestDelete(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={`ELIMINA ${item.title.toUpperCase()}`}
        >
          <Ionicons name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>ELIMINA</Text>
        </Pressable>
      )}

      {/* Foreground sliding card */}
      <Animated.View
        style={[
          styles.historyItem,
          {
            backgroundColor: isSelected ? `${theme.colors.primary}16` : theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={styles.cardContentPressable}
          onPress={() => {
            if (!selectionMode && isSwipedRef.current) {
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
              isSwipedRef.current = false;
            } else {
              onPress();
            }
          }}
          onLongPress={onLongPress}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        >
          <View
            style={[
              styles.posterWrapper,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={styles.poster}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Ionicons name="film-outline" size={20} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={styles.itemProgressTrack}>
              <View
                style={[
                  styles.itemProgressBar,
                  { width: `${progress}%`, backgroundColor: theme.colors.primary },
                  isDone && styles.itemProgressDone,
                ]}
              />
            </View>
          </View>

          <View style={styles.info}>
            <Text style={[styles.animeTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.episodeText, { color: theme.colors.textSecondary }]}>
              EPISODIO {item.episodeNumber} {isDone ? '• COMPLETATO' : `• ${progress}%`}
            </Text>
            {item.updatedAt ? (
              <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
                {formatDate(item.updatedAt)}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/* Action icons row or multi-selection checkbox */}
        <View style={styles.itemActions}>
          {selectionMode ? (
            <Pressable
              style={styles.selectionCheckTouch}
              onPress={onPress}
              onLongPress={onLongPress}
              delayLongPress={300}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={
                isSelected
                  ? `DESELEZIONA ${item.title.toUpperCase()} EPISODIO ${item.episodeNumber}`
                  : `SELEZIONA ${item.title.toUpperCase()} EPISODIO ${item.episodeNumber}`
              }
            >
              <View
                style={[
                  styles.selectionCircle,
                  isSelected
                    ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    : { borderColor: theme.colors.textMuted },
                ]}
              >
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={getContrastTextColor(theme.colors.primary)}
                  />
                )}
              </View>
            </Pressable>
          ) : (
            <>
              {/* Tasto meno con touch target >= 44dp */}
              <Pressable
                style={styles.minusBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onRequestDelete(item);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`RIMUOVI EPISODIO ${item.episodeNumber} DI ${item.title.toUpperCase()}`}
              >
                <View
                  style={[
                    styles.minusIconCircle,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                >
                  <Ionicons name="remove" size={16} color={theme.colors.error || '#EF4444'} />
                </View>
              </Pressable>

              {/* Tasto Play per riprendere */}
              <Pressable
                style={[styles.playBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onPress}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="RIPRODUCI EPISODIO"
              >
                <Ionicons name="play" size={15} color={getContrastTextColor(theme.colors.primary)} />
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

type HistoryDeleteTarget = WatchHistoryItem | 'all' | 'selected' | null;

export default function HistoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { theme } = useTheme();
  const [history, setHistory] = React.useState<WatchHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState<boolean>(() => {
    return AppStorage.isHistoryEnabled();
  });

  // Target for in-app deletion confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<HistoryDeleteTarget>(null);

  const {
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
  } = useMultiSelection(history, getHistoryItemKey);

  const loadHistory = React.useCallback(() => {
    const enabled = AppStorage.isHistoryEnabled();
    setIsHistoryEnabled(enabled);
    if (!enabled) {
      setHistory([]);
      return;
    }
    const list = AppStorage.getWatchHistory();
    setHistory(list);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  useFocusEffect(
    React.useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isSelectionMode) {
          clearSelection();
          return true;
        }
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          (navigation as any).navigate('index');
          router.replace('/(tabs)');
        }
        return true;
      });
      return () => backSub.remove();
    }, [isSelectionMode, clearSelection, router, navigation])
  );

  React.useEffect(() => {
    const unsub = AppStorage.addSettingsListener(() => {
      loadHistory();
    });
    return unsub;
  }, [loadHistory]);

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (SyncManager.isConnected()) {
      try {
        await SyncManager.performFullSync();
      } catch {
        // Safe sync error catch
      }
    }
    loadHistory();
    setIsRefreshing(false);
  }, [loadHistory]);

  const handleRequestClearAll = React.useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setDeleteTarget('all');
  }, []);

  const handleRequestDeleteSelected = React.useCallback(() => {
    if (selectedCount === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setDeleteTarget('selected');
  }, [selectedCount]);

  const handleRequestDeleteItem = React.useCallback((item: WatchHistoryItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setDeleteTarget(item);
  }, []);

  const handleConfirmDelete = React.useCallback(() => {
    if (!deleteTarget) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (deleteTarget === 'all') {
      AppStorage.clearWatchHistory();
      clearSelection();
    } else if (deleteTarget === 'selected') {
      const selectedItems = getSelectedItems();
      if (selectedItems.length > 0) {
        AppStorage.removeWatchHistoryItems(
          selectedItems.map((item) => ({
            animeId: item.animeId,
            episodeId: item.episodeId,
            episodeNumber: item.episodeNumber,
          }))
        );
      }
      clearSelection();
    } else {
      AppStorage.removeWatchHistoryItem(
        deleteTarget.animeId,
        deleteTarget.episodeId,
        deleteTarget.episodeNumber
      );
    }

    setDeleteTarget(null);
    loadHistory();
  }, [deleteTarget, clearSelection, getSelectedItems, loadHistory]);

  const resumePlayback = React.useCallback(
    (item: WatchHistoryItem) => {
      Haptics.selectionAsync().catch(() => {});
      router.push({
        pathname: '/player/[id]',
        params: {
          id: item.episodeId,
          animeId: item.animeId,
          episodeNumber: String(item.episodeNumber),
          animeTitle: item.title,
          thumbnail: item.thumbnail || '',
          episodeDataId: item.dataId || '',
          serverId: item.serverId || '',
        },
      });
    },
    [router]
  );

  const formatDate = React.useCallback((timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const selectedItems = React.useMemo(() => getSelectedItems(), [getSelectedItems]);
  const selectionExtraData = React.useMemo(
    () => ({ selectedKeys, isSelectionMode }),
    [selectedKeys, isSelectionMode]
  );

  const modalTitle =
    deleteTarget === 'all'
      ? 'SVUOTA CRONOLOGIA'
      : deleteTarget === 'selected'
        ? 'RIMUOVI SELEZIONATI'
        : 'RIMUOVI ELEMENTO';

  const modalMessage = React.useMemo(() => {
    if (deleteTarget === 'all') {
      return "VUOI DAVVERO CANCELLARE TUTTA LA CRONOLOGIA DI VISIONE? L'OPERAZIONE NON È REVERSIBILE.";
    }
    if (deleteTarget === 'selected') {
      if (selectedItems.length === 1) {
        const single = selectedItems[0];
        return `VUOI RIMUOVERE L'EPISODIO ${single.episodeNumber} DI "${single.title.toUpperCase()}" DALLA CRONOLOGIA?`;
      }
      return `VUOI RIMUOVERE ${selectedCount} ELEMENTI SELEZIONATI DALLA CRONOLOGIA?`;
    }
    if (deleteTarget) {
      return `VUOI RIMUOVERE L'EPISODIO ${deleteTarget.episodeNumber} DI "${deleteTarget.title.toUpperCase()}" DALLA CRONOLOGIA?`;
    }
    return '';
  }, [deleteTarget, selectedItems, selectedCount]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SelectionAppBar
        title="CRONOLOGIA"
        totalCount={history.length}
        showCountBadge={isHistoryEnabled && history.length > 0}
        selectedCount={selectedCount}
        isAllSelected={isAllSelected}
        onCancelSelection={clearSelection}
        onToggleSelectAll={toggleSelectAll}
        onTrashPress={isSelectionMode ? handleRequestDeleteSelected : handleRequestClearAll}
        showNormalTrash={isHistoryEnabled && history.length > 0}
        normalTrashLabel="SVUOTA CRONOLOGIA"
        selectionTrashLabel="RIMUOVI ELEMENTI SELEZIONATI"
      />

      {!isHistoryEnabled ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>CRONOLOGIA DISATTIVATA</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            LA CRONOLOGIA È DISABILITATA NELLE IMPOSTAZIONI. PUOI RIATTIVARLA CON LO SLIDER DEDICATO.
          </Text>
          <Pressable
            style={[styles.settingsShortcutBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityRole="button"
            accessibilityLabel="APRI IMPOSTAZIONI"
          >
            <Text
              style={[
                styles.settingsShortcutBtnText,
                { color: getContrastTextColor(theme.colors.primary) },
              ]}
            >
              APRI IMPOSTAZIONI
            </Text>
          </Pressable>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>NESSUNA CRONOLOGIA</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            GLI ANIME E GLI EPISODI CHE GUARDI APPARIRANNO QUI CON IL PUNTO ESATTO DI INTERRUZIONE.
          </Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlashList
            data={history}
            extraData={selectionExtraData}
            keyExtractor={getHistoryItemKey}
            renderItem={({ item }) => (
              <HistoryItemRow
                item={item}
                theme={theme}
                selectionMode={isSelectionMode}
                isSelected={isItemSelected(item)}
                onPress={() => (isSelectionMode ? toggleSelection(item) : resumePlayback(item))}
                onLongPress={() => startSelection(item)}
                onRequestDelete={handleRequestDeleteItem}
                formatDate={formatDate}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              isTablet && { maxWidth: 900, width: '100%', alignSelf: 'center' },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        </View>
      )}

      {/* Modal di Conferma a Schermo Integrata nella UI (Zero Alert di sistema) */}
      <ConfirmModal
        visible={deleteTarget !== null && (deleteTarget !== 'selected' || selectedCount > 0)}
        title={modalTitle}
        message={modalMessage}
        icon="trash-outline"
        confirmText={deleteTarget === 'all' ? 'CANCELLA TUTTO' : 'RIMUOVI'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}
