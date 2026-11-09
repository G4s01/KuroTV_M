import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
  Keyboard,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { homeQueryOptions, animeQueryKeys } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { AnimeWorldScraper } from '@/services/scraper';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FilterBottomSheet, type FilterState } from '@/components/FilterBottomSheet';
import { HomeScreenSkeleton, ExploreScreenSkeleton } from '@/components/skeleton';
import type { AnimeItem, ContinueWatchingItem, SearchFilter } from '@/types';

const HERO_HEIGHT = 280;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = (windowWidth - 48) / 2;
  const cardHeight = cardWidth * 1.45;

  const { data: homeData, isLoading, isError, refetch, isRefetching } = useQuery(homeQueryOptions());
  const [continueWatching, setContinueWatching] = React.useState<ContinueWatchingItem[]>([]);
  const [itemToRemove, setItemToRemove] = React.useState<ContinueWatchingItem | null>(null);

  // Search in Home state
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [filterState, setFilterState] = React.useState<FilterState>({});
  const [isFilterSheetVisible, setIsFilterSheetVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle hardware back button to dismiss search mode cleanly
  React.useEffect(() => {
    if (!isSearchActive) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      setIsSearchActive(false);
      setSearchQuery('');
      setFilterState({});
      return true;
    });
    return () => backSub.remove();
  }, [isSearchActive]);

  const activeFilterCount = [
    filterState.genre,
    filterState.type,
    filterState.status,
    filterState.sort,
  ].filter(Boolean).length;

  const hasSearchInput = Boolean(debouncedQuery || activeFilterCount > 0);

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    isError: isSearchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['home-search', debouncedQuery, filterState],
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
    enabled: isSearchActive && hasSearchInput,
    staleTime: 5 * 60 * 1000,
  });

  // Pre-fetching of top 4 search result images
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

  const removeFilter = (key: keyof FilterState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFilterState((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Proactive pre-fetching of top images to eliminate visual loading latency on scroll
  React.useEffect(() => {
    if (!homeData) return;
    const urls: string[] = [];
    if (homeData.sliders && homeData.sliders.length > 0) {
      urls.push(...homeData.sliders.slice(0, 3).map((item) => item.image || item.thumbnail || '').filter(Boolean));
    }
    if (homeData.trending && homeData.trending.length > 0) {
      urls.push(...homeData.trending.slice(0, 6).map((item) => item.image || item.thumbnail || '').filter(Boolean));
    }
    if (homeData.newAdded && homeData.newAdded.length > 0) {
      urls.push(...homeData.newAdded.slice(0, 6).map((item) => item.image || item.thumbnail || '').filter(Boolean));
    }
    if (urls.length > 0) {
      Image.prefetch(urls).catch(() => {});
    }
  }, [homeData]);

  useFocusEffect(
    React.useCallback(() => {
      setContinueWatching(AppStorage.getContinueWatching());
    }, [])
  );

  React.useEffect(() => {
    const unsub = AppStorage.addSettingsListener(() => {
      setContinueWatching(AppStorage.getContinueWatching());
    });
    return unsub;
  }, []);

  const handleRefresh = React.useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: animeQueryKeys.all }),
    ]);
    setContinueWatching(AppStorage.getContinueWatching());
  }, [refetch, queryClient]);

  const navigateToAnime = (animeId: string, title?: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/anime/[id]',
      params: { id: animeId, title: title || '' },
    });
  };

  const navigateToPlayer = (item: ContinueWatchingItem) => {
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
        position: String(item.position || 0),
      },
    });
  };

  const handleRemoveContinue = (item: ContinueWatchingItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItemToRemove(item);
  };

  const handleConfirmRemoveContinue = () => {
    if (!itemToRemove) return;
    AppStorage.removeContinueWatching(itemToRemove.animeId);
    setContinueWatching(AppStorage.getContinueWatching());
    setItemToRemove(null);
  };

  const heroItem = homeData?.sliders?.[0] || homeData?.trending?.[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* App Bar / Search Header */}
      {isSearchActive ? (
        <View style={[styles.searchHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
          <Pressable
            style={styles.searchBackBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsSearchActive(false);
              setSearchQuery('');
              setFilterState({});
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="CHIUDI RICERCA"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>

          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="CERCA ANIME, SERIE, FILM..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus={true}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={12}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="CANCELLA TESTO"
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>

          <Pressable
            style={[
              styles.filterBtn,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              activeFilterCount > 0 && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              Keyboard.dismiss();
              setIsFilterSheetVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="FILTRI DI RICERCA"
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
      ) : (
        <View style={[styles.appBar, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
          <View style={styles.brandRow}>
            <Text style={[styles.brandPrefix, { color: theme.colors.text }]}>KURO</Text>
            <Text style={[styles.brandSuffix, { color: theme.colors.primary }]}>TV</Text>
            <View style={[styles.mobileBadge, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.mobileBadgeText, { color: theme.colors.textSecondary }]}>MOBILE</Text>
            </View>
          </View>

          <Pressable
            style={[styles.searchButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setIsSearchActive(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="CERCA ANIME"
          >
            <Ionicons name="search" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      )}

      {isSearchActive ? (
        <View style={styles.searchContainer}>
          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <View style={styles.activeFiltersRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
                {filterState.type && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('type')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>TIPO: {filterState.type.toUpperCase()}</Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.status && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('status')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>STATO: {filterState.status.toUpperCase()}</Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.sort && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('sort')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>ORDINA: {filterState.sort.toUpperCase()}</Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.genre && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('genre')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>GENERE: {filterState.genre.toUpperCase()}</Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}

          {isSearchLoading ? (
            <ExploreScreenSkeleton cardWidth={cardWidth} cardHeight={cardHeight} />
          ) : isSearchError ? (
            <View style={styles.centerBox}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                ERRORE DURANTE LA RICERCA
              </Text>
              <Pressable
                style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => refetchSearch()}
              >
                <Text style={[styles.retryBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>
                  RIPROVA
                </Text>
              </Pressable>
            </View>
          ) : hasSearchInput ? (
            (searchResults?.items || []).length > 0 ? (
              <FlashList
                data={searchResults?.items || []}
                keyExtractor={(item, index) => item.id || `search-${index}`}
                numColumns={2}
                contentContainerStyle={styles.searchListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                renderItem={({ item }) => (
                  <View style={styles.searchCardWrapper}>
                    <AnimeCard
                      anime={item}
                      width={cardWidth}
                      height={cardHeight}
                      onPress={() => navigateToAnime(item.id, item.title)}
                    />
                  </View>
                )}
              />
            ) : (
              <View style={styles.centerBox}>
                <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  NESSUN ANIME TROVATO CON I CRITERI INDICATI
                </Text>
              </View>
            )
          ) : (
            <View style={styles.searchSuggestionsBox}>
              <Text style={[styles.suggestionTitle, { color: theme.colors.textSecondary }]}>
                SUGGERIMENTI RAPIDI
              </Text>
              <View style={styles.suggestionChips}>
                {['Azione', 'Avventura', 'Fantasy', 'Commedia', 'Romantico', 'Fantascienza', 'Sport', 'Horror'].map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.suggestionChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setFilterState((prev) => ({ ...prev, genre: g }));
                    }}
                  >
                    <Text style={[styles.suggestionChipText, { color: theme.colors.text }]}>
                      {g.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
        {isLoading && !homeData ? (
          <HomeScreenSkeleton hasContinueWatching={continueWatching.length > 0} />
        ) : isError && !homeData ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={oledTheme.colors.error} />
            <Text style={styles.errorTitle}>IMPOSSIBILE CONNETTERSI AD ANIMEWORLD</Text>
            <Text style={styles.errorSubtitle}>VERIFICA LA CONNESSIONE O CAMBIA DOMINIO NELLE IMPOSTAZIONI</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>RIPROVA</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Hero Banner */}
            {heroItem && (
              <Pressable
                style={styles.heroContainer}
                onPress={() => navigateToAnime(heroItem.id, heroItem.title)}
              >
                <Image
                  source={{ uri: heroItem.image || heroItem.thumbnail }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={300}
                />
                <View style={styles.heroOverlay} />

                <View style={styles.heroContent}>
                  {heroItem.subOrDub && (
                    <View style={[styles.heroBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={[styles.heroBadgeText, { color: getContrastTextColor(theme.colors.primary) }]}>{heroItem.subOrDub}</Text>
                    </View>
                  )}
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {heroItem.title}
                  </Text>

                  <Pressable
                    style={[styles.heroActionBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => navigateToAnime(heroItem.id, heroItem.title)}
                  >
                    <Ionicons name="play" size={16} color={getContrastTextColor(theme.colors.primary)} />
                    <Text style={[styles.heroActionBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>GUARDA ORA</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}

            {/* Riprendi a guardare - Visibile SOLO quando vi sono serie con visione in corso */}
            {continueWatching.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>RIPRENDI A GUARDARE</Text>
                  <Text style={[styles.sectionBadge, { backgroundColor: theme.colors.primary, color: getContrastTextColor(theme.colors.primary) }]}>{continueWatching.length}</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {continueWatching.map((item) => (
                    <Pressable
                      key={`${item.animeId}-${item.episodeId}`}
                      style={styles.continueCard}
                      onPress={() => navigateToPlayer(item)}
                    >
                      <View style={[styles.continueThumbWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        {item.thumbnail ? (
                          <Image
                            source={{ uri: item.thumbnail }}
                            style={styles.continueThumb}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={[styles.continueThumb, styles.continueFallback, { backgroundColor: theme.colors.card }]}>
                            <Ionicons name="film" size={24} color={theme.colors.textMuted} />
                          </View>
                        )}

                        {/* Tasto meno in alto a destra per rimuovere da 'riprendi a guardare' con conferma */}
                        <Pressable
                          style={styles.removeContinueBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleRemoveContinue(item);
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel={`RIMUOVI ${item.title.toUpperCase()} DA RIPRENDI A GUARDARE`}
                        >
                          <View style={styles.removeContinueIconWrapper}>
                            <Ionicons name="remove" size={14} color="#FFFFFF" />
                          </View>
                        </Pressable>

                        <View style={styles.playOverlay}>
                          <Ionicons name="play-circle" size={32} color="#FFFFFF" />
                        </View>
                        <View style={styles.progressBarWrapper}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min(100, item.percentage || 0)}%`,
                                backgroundColor: theme.colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[styles.continueTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.continueSubtitle, { color: theme.colors.textMuted }]}>
                        EPISODIO {item.episodeNumber} ({item.percentage}%)
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Ultime Uscite */}
            {homeData?.all && homeData.all.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>ULTIME USCITE</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsSearchActive(true);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="VEDI TUTTI GLI ANIME"
                  >
                    <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>VEDI TUTTI</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.all.slice(0, 15).map((anime: AnimeItem) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Popolari / Trending */}
            {homeData?.trending && homeData.trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>I PIÙ POPOLARI</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.trending.map((anime: AnimeItem) => (
                    <AnimeCard
                      key={`trending-${anime.id}`}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Nuove Aggiunte */}
            {homeData?.newAdded && homeData.newAdded.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>NUOVE AGGIUNTE</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.newAdded.map((anime: AnimeItem) => (
                    <AnimeCard
                      key={`new-${anime.id}`}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
      )}

      {/* Modal di Conferma Rimozione In-App (Zero Alert nativo Android) */}
      <ConfirmModal
        visible={itemToRemove !== null}
        title="RIMUOVI DA RIPRENDI A GUARDARE"
        message={
          itemToRemove
            ? `VUOI RIMUOVERE "${itemToRemove.title.toUpperCase()}" DALLA VISIONE IN CORSO?`
            : ''
        }
        icon="remove-circle-outline"
        confirmText="RIMUOVI"
        onConfirm={handleConfirmRemoveContinue}
        onCancel={() => setItemToRemove(null)}
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        isVisible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        filters={filterState}
        onApply={(f) => setFilterState(f)}
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
  appBar: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
    backgroundColor: '#000000',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandPrefix: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  brandSuffix: {
    color: oledTheme.colors.primary,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  mobileBadge: {
    marginLeft: 8,
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mobileBadgeText: {
    color: '#A3A3A3',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: oledTheme.radius.full,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  searchContainer: {
    flex: 1,
  },
  activeFiltersRow: {
    paddingVertical: 8,
  },
  activeFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    minHeight: 32,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  searchListContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  searchCardWrapper: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
    minHeight: 320,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  searchSuggestionsBox: {
    padding: 20,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: oledTheme.colors.textMuted,
    fontSize: 14,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorTitle: {
    color: oledTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorSubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  heroContainer: {
    width: '100%',
    height: HERO_HEIGHT,
    position: 'relative',
    backgroundColor: '#0D0D0D',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: oledTheme.radius.xs,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroActionBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    minHeight: 44,
  },
  heroActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: oledTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  sectionBadge: {
    backgroundColor: '#262626',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  seeAllText: {
    color: oledTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  horizontalScroll: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  continueCard: {
    width: 160,
    marginRight: 12,
    minHeight: 44,
  },
  continueThumbWrapper: {
    width: 160,
    height: 96,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#171717',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#262626',
  },
  continueThumb: {
    width: '100%',
    height: '100%',
  },
  continueFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  continueTitle: {
    color: oledTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  continueSubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  removeContinueBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeContinueIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
