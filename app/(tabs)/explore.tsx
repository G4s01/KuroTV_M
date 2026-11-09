import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  useWindowDimensions,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AnimeWorldScraper } from '@/services/scraper';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import { ExploreScreenSkeleton } from '@/components/skeleton';
import { FilterBottomSheet, type FilterState } from '@/components/FilterBottomSheet';
import type { AnimeItem, SearchFilter } from '@/types';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = (windowWidth - 48) / 2;
  const cardHeight = cardWidth * 1.45;

  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [filterState, setFilterState] = React.useState<FilterState>({});
  const [isFilterSheetVisible, setIsFilterSheetVisible] = React.useState(false);

  // Debounce query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const activeFilterCount = [
    filterState.genre,
    filterState.type,
    filterState.status,
    filterState.sort,
  ].filter(Boolean).length;

  const { data: searchResults, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['search', debouncedQuery, filterState],
    queryFn: async () => {
      if (debouncedQuery) {
        return AnimeWorldScraper.searchAnime(debouncedQuery);
      }
      const filter: SearchFilter = {
        genre: filterState.genre,
        type: filterState.type,
        status: filterState.status,
        order: filterState.sort,
      };
      return AnimeWorldScraper.searchAnime(filter);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Proactive pre-fetching of top 4 search result images
  React.useEffect(() => {
    if (searchResults?.items && searchResults.items.length > 0) {
      const urls = searchResults.items
        .slice(0, 4)
        .map((item) => item.image || item.thumbnail || '')
        .filter(Boolean);
      if (urls.length > 0) {
        Image.prefetch(urls).catch(() => {});
      }
    }
  }, [searchResults]);

  const navigateToAnime = (animeId: string, title?: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/anime/[id]',
      params: { id: animeId, title: title || '' },
    });
  };

  const removeFilter = (key: keyof FilterState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFilterState((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const items: AnimeItem[] = searchResults?.items || [];

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="CERCA ANIME, SERIE, FILM..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={12}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.filterBtn,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            activeFilterCount > 0 && [styles.filterBtnActive, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsFilterSheetVisible(true);
          }}
          accessibilityLabel="FILTRI AVANZATI"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? getContrastTextColor(theme.colors.primary) : theme.colors.text}
          />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: getContrastTextColor(theme.colors.primary) }]}>
              <Text style={[styles.filterBadgeText, { color: theme.colors.primary }]}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <View style={[styles.chipsContainer, { borderBottomColor: theme.colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {filterState.genre && (
              <Pressable style={[styles.activeChip, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]} onPress={() => removeFilter('genre')}>
                <Text style={[styles.activeChipText, { color: getContrastTextColor(theme.colors.primary) }]}>{filterState.genre}</Text>
                <Ionicons name="close" size={14} color={getContrastTextColor(theme.colors.primary)} />
              </Pressable>
            )}
            {filterState.type && (
              <Pressable style={[styles.activeChip, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]} onPress={() => removeFilter('type')}>
                <Text style={[styles.activeChipText, { color: getContrastTextColor(theme.colors.primary) }]}>{filterState.type}</Text>
                <Ionicons name="close" size={14} color={getContrastTextColor(theme.colors.primary)} />
              </Pressable>
            )}
            {filterState.status && (
              <Pressable style={[styles.activeChip, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]} onPress={() => removeFilter('status')}>
                <Text style={[styles.activeChipText, { color: getContrastTextColor(theme.colors.primary) }]}>{filterState.status}</Text>
                <Ionicons name="close" size={14} color={getContrastTextColor(theme.colors.primary)} />
              </Pressable>
            )}
            {filterState.sort && (
              <Pressable style={[styles.activeChip, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]} onPress={() => removeFilter('sort')}>
                <Text style={[styles.activeChipText, { color: getContrastTextColor(theme.colors.primary) }]}>{filterState.sort}</Text>
                <Ionicons name="close" size={14} color={getContrastTextColor(theme.colors.primary)} />
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {/* Content List */}
      {isLoading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <ExploreScreenSkeleton cardWidth={cardWidth} cardHeight={cardHeight} itemCount={6} />
        </ScrollView>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error || oledTheme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error || oledTheme.colors.error }]}>ERRORE DURANTE LA RICERCA</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.retryBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>RIPROVA</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>NESSUN RISULTATO TROVATO</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>PROVA A CERCARE CON ALTRI TERMINI O RIMUOVI I FILTRI</Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlashList
            data={items}
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
                refreshing={isRefetching}
                onRefresh={() => {
                  refetch();
                }}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        </View>
      )}

      {/* Bottom Sheet Native */}
      <FilterBottomSheet
        isVisible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        filters={filterState}
        onApply={(newFilters) => setFilterState(newFilters)}
        onReset={() => setFilterState({})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  searchBar: {
    flex: 1,
    height: 44,
    backgroundColor: '#141414',
    borderRadius: oledTheme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    marginLeft: 8,
    height: '100%',
  },
  clearBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: oledTheme.radius.md,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: oledTheme.colors.primary,
    borderColor: oledTheme.colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: oledTheme.colors.primary,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  chipsContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  activeChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    color: oledTheme.colors.textMuted,
    fontSize: 14,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorText: {
    color: oledTheme.colors.error,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  retryBtn: {
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
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
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
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
