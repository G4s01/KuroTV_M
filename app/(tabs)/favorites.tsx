import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppStorage } from '@/services/storage';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import type { AnimeItem } from '@/types';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { theme } = useTheme();

  const cardWidth = (windowWidth - 48) / 2;
  const cardHeight = cardWidth * 1.45;

  const [favorites, setFavorites] = React.useState<AnimeItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadFavorites = React.useCallback(() => {
    const items = AppStorage.getFavorites();
    setFavorites(items);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    loadFavorites();
    setTimeout(() => setIsRefreshing(false), 300);
  }, [loadFavorites]);

  const navigateToAnime = (animeId: string, title?: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/anime/[id]',
      params: { id: animeId, title: title || '' },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* App Bar */}
      <View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>I MIEI PREFERITI</Text>
          {favorites.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>{favorites.length}</Text>
            </View>
          )}
        </View>
      </View>

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
            data={favorites}
            numColumns={2}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AnimeCard
                anime={item}
                width={cardWidth}
                height={cardHeight}
                onPress={() => navigateToAnime(item.id, item.title)}
              />
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appBar: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    borderColor: '#333333',
  },
  countBadgeText: {
    color: oledTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
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
