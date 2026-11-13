import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppStorage } from '@/services/storage';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SelectionAppBar } from '@/components/SelectionAppBar';
import { useResponsiveLayout, useMultiSelection } from '@/hooks';
import type { AnimeItem } from '@/types';

const getFavoriteKey = (item: AnimeItem) => item.id;

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { numColumns, cardWidth, cardHeight } = useResponsiveLayout();

  const [favorites, setFavorites] = React.useState<AnimeItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isConfirmRemoveVisible, setIsConfirmRemoveVisible] = React.useState(false);

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
  } = useMultiSelection(favorites, getFavoriteKey);

  const loadFavorites = React.useCallback(() => {
    const items = AppStorage.getFavorites();
    setFavorites(items);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  React.useEffect(() => {
    const unsub = AppStorage.addSettingsListener(() => {
      loadFavorites();
    });
    return unsub;
  }, [loadFavorites]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isSelectionMode) return;
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        clearSelection();
        return true;
      });
      return () => backSub.remove();
    }, [isSelectionMode, clearSelection])
  );

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    loadFavorites();
    setTimeout(() => setIsRefreshing(false), 300);
  }, [loadFavorites]);

  const navigateToAnime = React.useCallback(
    (animeId: string, title?: string) => {
      Haptics.selectionAsync().catch(() => {});
      router.push({
        pathname: '/anime/[id]',
        params: { id: animeId, title: title || '' },
      });
    },
    [router]
  );

  const handleRemoveSingleFavorite = React.useCallback((item: AnimeItem) => {
    AppStorage.removeFavorite(item.id);
    setFavorites((prev) => prev.filter((fav) => fav.id !== item.id));
  }, []);

  const handleRequestRemoveSelected = React.useCallback(() => {
    if (selectedCount === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setIsConfirmRemoveVisible(true);
  }, [selectedCount]);

  const handleConfirmRemoveSelected = React.useCallback(() => {
    const idsToRemove = Array.from(selectedKeys);
    if (idsToRemove.length > 0) {
      AppStorage.removeFavorites(idsToRemove);
    }
    clearSelection();
    setIsConfirmRemoveVisible(false);
    loadFavorites();
  }, [selectedKeys, clearSelection, loadFavorites]);

  const selectedItems = React.useMemo(() => getSelectedItems(), [getSelectedItems]);
  const confirmMessage = React.useMemo(() => {
    if (selectedItems.length === 1) {
      return `VUOI RIMUOVERE "${selectedItems[0].title.toUpperCase()}" DAI PREFERITI?`;
    }
    return `VUOI RIMUOVERE ${selectedCount} TITOLI SELEZIONATI DAI PREFERITI?`;
  }, [selectedItems, selectedCount]);

  const selectionExtraData = React.useMemo(
    () => ({ selectedKeys, isSelectionMode }),
    [selectedKeys, isSelectionMode]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SelectionAppBar
        title="I MIEI PREFERITI"
        totalCount={favorites.length}
        showCountBadge={favorites.length > 0}
        selectedCount={selectedCount}
        isAllSelected={isAllSelected}
        onCancelSelection={clearSelection}
        onToggleSelectAll={toggleSelectAll}
        onTrashPress={handleRequestRemoveSelected}
        showNormalTrash={false}
        selectionTrashLabel="RIMUOVI PREFERITI SELEZIONATI"
      />

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Ionicons name="heart-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>NESSUN ANIME NEI PREFERITI</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            AGGIUNGI LE TUE SERIE E I TUOI FILM PREFERITI TOCCANDO L&apos;ICONA DEL CUORE NELLA PAGINA DI DETTAGLIO.
          </Text>
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/(tabs)')}
          >
            <Ionicons name="compass-outline" size={18} color={getContrastTextColor(theme.colors.primary)} />
            <Text style={[styles.exploreBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>ESPLORA CATALOGO</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlashList
            key={`favorites-grid-${numColumns}`}
            data={favorites}
            numColumns={numColumns}
            extraData={selectionExtraData}
            keyExtractor={getFavoriteKey}
            renderItem={({ item }) => {
              const selected = isItemSelected(item);
              return (
                <AnimeCard
                  anime={item}
                  width={cardWidth}
                  height={cardHeight}
                  selectionMode={isSelectionMode}
                  isSelected={selected}
                  onPress={() =>
                    isSelectionMode
                      ? toggleSelection(item)
                      : navigateToAnime(item.id, item.title)
                  }
                  onLongPress={() => startSelection(item)}
                  onRemoveFavorite={() => handleRemoveSingleFavorite(item)}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
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

      <ConfirmModal
        visible={isConfirmRemoveVisible && selectedCount > 0}
        title="RIMUOVI DAI PREFERITI"
        message={confirmMessage}
        icon="trash-outline"
        confirmText="RIMUOVI"
        onConfirm={handleConfirmRemoveSelected}
        onCancel={() => setIsConfirmRemoveVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  emptySubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  exploreBtn: {
    backgroundColor: oledTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.full,
    marginTop: 12,
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
});
