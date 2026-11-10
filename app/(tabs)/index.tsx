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
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { homeQueryOptions, animeQueryKeys, animeDetailQueryOptions } from '@/services/queries';
import { AppStorage, type SearchHistoryItem } from '@/services/storage';
import { AnimeWorldScraper } from '@/services/scraper';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  FilterBottomSheet,
  type FilterState,
  ANIME_GENRES,
  ANIME_TYPES,
  ANIME_STATUSES,
  ANIME_SORTS,
  ANIME_DUB,
} from '@/components/FilterBottomSheet';
import { HomeScreenSkeleton, ExploreScreenSkeleton } from '@/components/skeleton';
import type { AnimeItem, ContinueWatchingItem, SearchFilter } from '@/types';

const HERO_HEIGHT = 320;
const RECOMMENDED_ITEM_WIDTH = 114;
const RECOMMENDED_ITEM_GAP = 10;
const RECOMMENDED_ITEM_TOTAL = RECOMMENDED_ITEM_WIDTH + RECOMMENDED_ITEM_GAP;

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

  // Top recommended selection & focus state
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const currentFocusedIndexRef = React.useRef(0);
  const [isHeroPlayLoading, setIsHeroPlayLoading] = React.useState(false);
  const recommendedScrollRef = React.useRef<any>(null);
  const heroScrollRef = React.useRef<any>(null);
  const activeScrollSourceRef = React.useRef<'hero' | 'recommended' | 'tap' | 'idle'>('idle');
  const resetSourceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup pending scroll sync timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (resetSourceTimeoutRef.current) {
        clearTimeout(resetSourceTimeoutRef.current);
      }
    };
  }, []);

  const releaseScrollLock = (delay = 450) => {
    if (resetSourceTimeoutRef.current) {
      clearTimeout(resetSourceTimeoutRef.current);
    }
    resetSourceTimeoutRef.current = setTimeout(() => {
      activeScrollSourceRef.current = 'idle';
    }, delay);
  };

  // Search in Home state
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [filterState, setFilterState] = React.useState<FilterState>({});
  const [isFilterSheetVisible, setIsFilterSheetVisible] = React.useState(false);
  const [searchHistoryList, setSearchHistoryList] = React.useState<SearchHistoryItem[]>([]);
  const [isClearAllSearchConfirmOpen, setIsClearAllSearchConfirmOpen] = React.useState(false);

  const isSearchHistoryActive = AppStorage.isSearchHistoryEnabled();

  React.useEffect(() => {
    if (isSearchActive) {
      setSearchHistoryList(AppStorage.getSearchHistory());
    }
  }, [isSearchActive]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle hardware back button to dismiss search mode cleanly ONLY when this screen is actively focused
  useFocusEffect(
    React.useCallback(() => {
      if (!isSearchActive) return;
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Keyboard.dismiss();
        setIsSearchActive(false);
        setSearchQuery('');
        setFilterState({});
        return true;
      });
      return () => backSub.remove();
    }, [isSearchActive])
  );

  const activeGenres = filterState.genres || (filterState.genre ? [filterState.genre] : []);
  const activeFilterCount =
    activeGenres.length +
    (filterState.dub ? 1 : 0) +
    (filterState.type ? 1 : 0) +
    (filterState.status ? 1 : 0) +
    (filterState.sort ? 1 : 0);

  const hasSearchInput = Boolean(debouncedQuery || activeFilterCount > 0);

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    isError: isSearchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['home-search', debouncedQuery, filterState],
    queryFn: async () => {
      if (debouncedQuery && activeFilterCount === 0) {
        return AnimeWorldScraper.searchAnime(debouncedQuery);
      }
      const filter: SearchFilter = {
        query: debouncedQuery || undefined,
        genres: activeGenres.length > 0 ? activeGenres : undefined,
        genre: activeGenres.length === 1 ? activeGenres[0] : undefined,
        type: filterState.type,
        status: filterState.status,
        order: filterState.sort,
        sort: filterState.sort,
        dub: filterState.dub,
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

  // Auto-record search query to history only after user completely finishes typing (idle settling)
  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!isSearchActive || trimmed.length < 2) return;

    const timer = setTimeout(() => {
      AppStorage.addSearchHistory(trimmed);
      setSearchHistoryList(AppStorage.getSearchHistory());
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchActive]);

  const removeFilter = (key: keyof FilterState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFilterState((prev) => {
      const next = { ...prev };
      delete next[key];
      if (key === 'genre') delete next.genres;
      if (key === 'genres') delete next.genre;
      return next;
    });
  };

  const removeGenre = (genreId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFilterState((prev) => {
      const currentList = prev.genres || (prev.genre ? [prev.genre] : []);
      const remaining = currentList.filter((id) => id !== genreId);
      return {
        ...prev,
        genres: remaining.length > 0 ? remaining : undefined,
        genre: remaining.length === 1 ? remaining[0] : undefined,
      };
    });
  };

  const handleSelectSearchHistory = (queryText: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSearchQuery(queryText);
    setDebouncedQuery(queryText);
    Keyboard.dismiss();
  };

  const handleDeleteSearchHistoryItem = (queryText: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    AppStorage.removeSearchHistoryItem(queryText);
    setSearchHistoryList(AppStorage.getSearchHistory());
  };

  const handleConfirmClearAllSearch = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AppStorage.clearSearchHistory();
    setSearchHistoryList([]);
    setIsClearAllSearchConfirmOpen(false);
  };

  // Proactive pre-fetching of top images to eliminate visual loading latency on scroll
  React.useEffect(() => {
    if (!homeData) return;
    const urls: string[] = [];
    if (homeData.sliders && homeData.sliders.length > 0) {
      urls.push(
        ...homeData.sliders
          .slice(0, 8)
          .map((item) => item.banner || item.image || item.thumbnail || '')
          .filter(Boolean)
      );
    }
    if (homeData.all && homeData.all.length > 0) {
      urls.push(
        ...homeData.all
          .slice(0, 6)
          .map((item) => item.image || item.thumbnail || '')
          .filter(Boolean)
      );
    }
    if (homeData.trending && homeData.trending.length > 0) {
      urls.push(
        ...homeData.trending
          .slice(0, 6)
          .map((item) => item.image || item.thumbnail || '')
          .filter(Boolean)
      );
    }
    if (homeData.ongoing && homeData.ongoing.length > 0) {
      urls.push(
        ...homeData.ongoing
          .slice(0, 6)
          .map((item) => item.image || item.thumbnail || '')
          .filter(Boolean)
      );
    }
    if (homeData.upcoming && homeData.upcoming.length > 0) {
      urls.push(
        ...homeData.upcoming
          .slice(0, 6)
          .map((item) => item.image || item.thumbnail || '')
          .filter(Boolean)
      );
    }
    if (homeData.newAdded && homeData.newAdded.length > 0) {
      urls.push(
        ...homeData.newAdded
          .slice(0, 6)
          .map((item) => item.image || item.thumbnail || '')
          .filter(Boolean)
      );
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
    Keyboard.dismiss();
    if (isSearchActive && searchQuery.trim().length >= 2) {
      AppStorage.addSearchHistory(searchQuery.trim());
      setSearchHistoryList(AppStorage.getSearchHistory());
    }
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

  // Recommended list (Top 8 from AnimeWorld slider)
  const recommendedList: AnimeItem[] = React.useMemo(() => {
    return (homeData?.sliders || []).slice(0, 10);
  }, [homeData?.sliders]);

  // Stable memoized snap offsets to prevent layout thrashing on Android Fabric
  const recommendedSnapOffsets = React.useMemo(() => {
    return recommendedList.map((_, i) => i * RECOMMENDED_ITEM_TOTAL);
  }, [recommendedList.length]);

  // Safe index within bounds
  const safeFocusedIndex = Math.min(
    focusedIndex,
    Math.max(0, recommendedList.length - 1)
  );
  currentFocusedIndexRef.current = safeFocusedIndex;

  const focusedItem: AnimeItem | undefined =
    recommendedList[safeFocusedIndex] ||
    homeData?.sliders?.[0] ||
    homeData?.trending?.[0];

  // Selecting a recommended anime from the carousel (tap)
  const handleSelectRecommended = (index: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (resetSourceTimeoutRef.current) clearTimeout(resetSourceTimeoutRef.current);
    activeScrollSourceRef.current = 'tap';

    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(0, Math.min(index, maxIndex));

    currentFocusedIndexRef.current = targetIndex;
    setFocusedIndex(targetIndex);

    heroScrollRef.current?.scrollTo({
      x: targetIndex * windowWidth,
      animated: true,
    });
    recommendedScrollRef.current?.scrollTo({
      x: targetIndex * RECOMMENDED_ITEM_TOTAL,
      animated: true,
    });

    releaseScrollLock(450);
  };

  // Settling handler when recommended carousel scroll finishes (drag release without momentum or momentum end)
  const settleRecommendedScroll = (offsetX: number) => {
    // CRITICAL: Only settle if the scroll originated from an active user gesture on the recommended carousel.
    // Prevents reverse ping-pong scrollTo loops when receiving programmatic scroll events.
    if (activeScrollSourceRef.current !== 'recommended') {
      return;
    }

    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(
      0,
      Math.min(
        Math.round(offsetX / RECOMMENDED_ITEM_TOTAL),
        maxIndex
      )
    );

    // Keep the recommended card snapped exactly in place
    recommendedScrollRef.current?.scrollTo({
      x: targetIndex * RECOMMENDED_ITEM_TOTAL,
      animated: true,
    });

    if (targetIndex !== currentFocusedIndexRef.current) {
      currentFocusedIndexRef.current = targetIndex;
      setFocusedIndex(targetIndex);

      heroScrollRef.current?.scrollTo({
        x: targetIndex * windowWidth,
        animated: true,
      });
    }

    releaseScrollLock(450);
  };

  // Settling handler when hero banner scroll finishes (drag release without momentum or momentum end)
  const settleHeroScroll = (offsetX: number) => {
    // CRITICAL: Only settle if the scroll originated from an active user gesture on the hero banner.
    // Prevents reverse ping-pong scrollTo loops when receiving programmatic scroll events.
    if (activeScrollSourceRef.current !== 'hero') {
      return;
    }

    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(
      0,
      Math.min(
        Math.round(offsetX / windowWidth),
        maxIndex
      )
    );

    if (targetIndex !== currentFocusedIndexRef.current) {
      currentFocusedIndexRef.current = targetIndex;
      setFocusedIndex(targetIndex);

      recommendedScrollRef.current?.scrollTo({
        x: targetIndex * RECOMMENDED_ITEM_TOTAL,
        animated: true,
      });
    }

    releaseScrollLock(450);
  };

  // Synchronizing focus while scrolling the horizontal recommended carousel
  const handleRecommendedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeScrollSourceRef.current !== 'recommended') {
      return;
    }
    const offsetX = e.nativeEvent.contentOffset.x;
    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(
      0,
      Math.min(
        Math.round(offsetX / RECOMMENDED_ITEM_TOTAL),
        maxIndex
      )
    );
    if (targetIndex !== currentFocusedIndexRef.current) {
      currentFocusedIndexRef.current = targetIndex;
      setFocusedIndex(targetIndex);
    }
  };

  // Synchronizing focus while scrolling the Hero Banner
  const handleHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeScrollSourceRef.current !== 'hero') {
      return;
    }
    const offsetX = e.nativeEvent.contentOffset.x;
    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(
      0,
      Math.min(
        Math.round(offsetX / windowWidth),
        maxIndex
      )
    );
    if (targetIndex !== currentFocusedIndexRef.current) {
      currentFocusedIndexRef.current = targetIndex;
      setFocusedIndex(targetIndex);
    }
  };

  // Start playback of the hero anime (check continue watching, saved progress, or fetch Episode 1)
  const handlePlayHero = async (item: AnimeItem) => {
    if (!item || !item.id) return;
    Haptics.selectionAsync().catch(() => {});

    // 1. Resume from active Continue Watching if present
    const continueItem = continueWatching.find((cw) => cw.animeId === item.id);
    if (continueItem) {
      navigateToPlayer(continueItem);
      return;
    }

    // 2. Check latest watch progress in MMKV storage
    const latestProgress = AppStorage.getLatestAnimeProgress(item.id);
    if (latestProgress) {
      router.push({
        pathname: '/player/[id]',
        params: {
          id: latestProgress.episodeId,
          animeId: latestProgress.animeId,
          episodeNumber: String(latestProgress.episodeNumber),
          animeTitle: item.title,
          thumbnail: item.banner || item.image || item.thumbnail || latestProgress.thumbnail || '',
          position: String(latestProgress.isCompleted ? 0 : latestProgress.currentTime || 0),
          episodeDataId: latestProgress.dataId || '',
          serverId: latestProgress.serverId || '',
          totalEpisodes: String(latestProgress.totalEpisodes || ''),
        },
      });
      return;
    }

    // 3. Not in history: fetch details to get Episode 1
    setIsHeroPlayLoading(true);
    try {
      const detail = await queryClient.fetchQuery(
        animeDetailQueryOptions(item.id, queryClient)
      );

      const episodes = detail?.episodes || [];
      if (episodes.length > 0) {
        const firstEp = episodes[0];
        router.push({
          pathname: '/player/[id]',
          params: {
            id: firstEp.id,
            animeId: detail.id,
            episodeNumber: String(firstEp.number),
            episodeDataId: firstEp.dataId || '',
            animeTitle: detail.title,
            thumbnail: detail.image || detail.thumbnail || item.thumbnail || '',
            position: '0',
            totalEpisodes: String(detail.totalEpisodes ?? (episodes.length || '')),
            serverId: firstEp.servers?.[0]?.id || '9',
          },
        });
      } else {
        navigateToAnime(item.id, item.title);
      }
    } catch {
      navigateToAnime(item.id, item.title);
    } finally {
      setIsHeroPlayLoading(false);
    }
  };

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
              onSubmitEditing={() => {
                if (searchQuery.trim().length >= 2) {
                  AppStorage.addSearchHistory(searchQuery.trim());
                  setSearchHistoryList(AppStorage.getSearchHistory());
                }
              }}
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
                {filterState.dub && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('dub')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                      AUDIO: {filterState.dub === '1' ? 'DOPPIATI (ITA)' : 'SUB ITA'}
                    </Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.type && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('type')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                      TIPO: {(ANIME_TYPES.find((t) => t.value === filterState.type)?.label || filterState.type).toUpperCase()}
                    </Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.status && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('status')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                      STATO: {(ANIME_STATUSES.find((s) => s.value === filterState.status)?.label || filterState.status).toUpperCase()}
                    </Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {filterState.sort && (
                  <Pressable
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => removeFilter('sort')}
                  >
                    <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                      ORDINA: {(ANIME_SORTS.find((s) => s.value === filterState.sort)?.label || filterState.sort).toUpperCase()}
                    </Text>
                    <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                )}
                {activeGenres.map((gId) => {
                  const genreLabel = ANIME_GENRES.find((g) => g.id === gId)?.label || gId;
                  return (
                    <Pressable
                      key={`active-genre-${gId}`}
                      style={[styles.activeFilterChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      onPress={() => removeGenre(gId)}
                    >
                      <Text style={[styles.activeFilterText, { color: theme.colors.text }]}>
                        GENERE: {genreLabel.toUpperCase()}
                      </Text>
                      <Ionicons name="close-circle" size={14} color={theme.colors.textMuted} />
                    </Pressable>
                  );
                })}
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
            <ScrollView
              style={styles.searchHistoryContainer}
              contentContainerStyle={styles.searchHistoryContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isSearchHistoryActive ? (
                searchHistoryList.length > 0 ? (
                  <>
                    <View style={styles.searchHistoryHeader}>
                      <View style={styles.searchHistoryTitleRow}>
                        <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.searchHistoryTitle, { color: theme.colors.textSecondary }]}>
                          RICERCHE RECENTI
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setIsClearAllSearchConfirmOpen(true)}
                        hitSlop={8}
                        style={styles.clearAllSearchBtn}
                        accessibilityRole="button"
                        accessibilityLabel="CANCELLA TUTTA LA CRONOLOGIA DI RICERCA"
                      >
                        <Text style={[styles.clearAllSearchText, { color: theme.colors.textMuted }]}>
                          CANCELLA TUTTE
                        </Text>
                      </Pressable>
                    </View>

                    <View style={[styles.searchHistoryList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                      {searchHistoryList.map((item, index) => (
                        <View
                          key={`${item.query}-${item.timestamp}-${index}`}
                          style={[
                            styles.searchHistoryItem,
                            index < searchHistoryList.length - 1 && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Pressable
                            style={styles.searchHistoryItemContent}
                            onPress={() => handleSelectSearchHistory(item.query)}
                            hitSlop={4}
                            accessibilityRole="button"
                            accessibilityLabel={`CERCA ${item.query.toUpperCase()}`}
                          >
                            <Ionicons name="time-outline" size={18} color={theme.colors.textMuted} style={styles.searchHistoryItemIcon} />
                            <Text style={[styles.searchHistoryItemText, { color: theme.colors.text }]} numberOfLines={1}>
                              {item.query.toUpperCase()}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.searchHistoryDeleteBtn}
                            onPress={() => handleDeleteSearchHistoryItem(item.query)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel={`ELIMINA ${item.query.toUpperCase()} DALLA CRONOLOGIA`}
                          >
                            <Ionicons name="close-outline" size={20} color={theme.colors.textMuted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.centerBox}>
                    <Ionicons name="search-outline" size={44} color={theme.colors.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                      DIGITA UN TITOLO PER CERCARE O UTILIZZA I FILTRI
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="time-outline" size={44} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                    CRONOLOGIA DI RICERCA DISATTIVATA
                  </Text>
                  <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>
                    PUOI ATTIVARLA NELLA SCHEDA IMPOSTAZIONI DELL&apos;APP
                  </Text>
                </View>
              )}
            </ScrollView>
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
            {/* 1. Hero Banner: Anime in evidenza (primo della top 8 dei raccomandati con swiper sincronizzato) */}
            {recommendedList.length > 0 ? (
              <View style={[styles.heroContainer, { width: windowWidth, height: HERO_HEIGHT }]}>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onScrollBeginDrag={() => {
                    if (resetSourceTimeoutRef.current) clearTimeout(resetSourceTimeoutRef.current);
                    activeScrollSourceRef.current = 'hero';
                  }}
                  onScrollEndDrag={(e) => {
                    const velocity = e.nativeEvent.velocity?.x ?? 0;
                    if (Math.abs(velocity) < 0.1) {
                      settleHeroScroll(e.nativeEvent.contentOffset.x);
                    }
                  }}
                  onMomentumScrollEnd={(e) => {
                    settleHeroScroll(e.nativeEvent.contentOffset.x);
                  }}
                  onScroll={handleHeroScroll}
                  style={{ width: windowWidth, height: HERO_HEIGHT }}
                >
                  {recommendedList.map((item, index) => {
                    const isCurrent = index === safeFocusedIndex;
                    return (
                      <Pressable
                        key={`hero-slide-${item.id}-${index}`}
                        style={[styles.heroSlide, { width: windowWidth, height: HERO_HEIGHT }]}
                        onPress={() => navigateToAnime(item.id, item.title)}
                        accessibilityRole="button"
                        accessibilityLabel={`DETTAGLI ${item.title.toUpperCase()}`}
                      >
                        <Image
                          source={{ uri: item.banner || item.image || item.thumbnail }}
                          style={styles.heroImage}
                          contentFit="cover"
                          transition={300}
                          priority="high"
                        />
                        <View style={styles.heroOverlay} />

                        <View style={styles.heroContent}>
                          <View style={styles.heroBadgeRow}>
                            <View style={[styles.heroRankBadge, { backgroundColor: theme.colors.primary }]}>
                              <Text style={[styles.heroRankBadgeText, { color: getContrastTextColor(theme.colors.primary) }]}>
                                #{index + 1} RACCOMANDATO
                              </Text>
                            </View>
                            {item.subOrDub && (
                              <View style={[styles.heroSubBadge, { backgroundColor: theme.colors.surface }]}>
                                <Text style={[styles.heroSubBadgeText, { color: theme.colors.textSecondary }]}>
                                  {item.subOrDub}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.heroTitle} numberOfLines={2}>
                            {item.title}
                          </Text>

                          {item.synopsis ? (
                            <Text style={styles.heroSynopsis} numberOfLines={2}>
                              {item.synopsis}
                            </Text>
                          ) : null}

                          {/* Pulsanti d'azione: PLAY (inizia riproduzione) e INFO (scheda dettagli) */}
                          <View style={styles.heroActionsRow}>
                            <Pressable
                              style={[
                                styles.heroPlayBtn,
                                { backgroundColor: theme.colors.primary },
                                isHeroPlayLoading && isCurrent && styles.heroBtnDisabled,
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handlePlayHero(item);
                              }}
                              hitSlop={8}
                              disabled={isHeroPlayLoading && isCurrent}
                              accessibilityRole="button"
                              accessibilityLabel={`RIPRODUCI ${item.title.toUpperCase()}`}
                            >
                              {isHeroPlayLoading && isCurrent ? (
                                <ActivityIndicator size="small" color={getContrastTextColor(theme.colors.primary)} />
                              ) : (
                                <>
                                  <Ionicons name="play" size={18} color={getContrastTextColor(theme.colors.primary)} />
                                  <Text
                                    style={[
                                      styles.heroPlayBtnText,
                                      { color: getContrastTextColor(theme.colors.primary) },
                                    ]}
                                  >
                                    RIPRODUCI
                                  </Text>
                                </>
                              )}
                            </Pressable>

                            <Pressable
                              style={[
                                styles.heroInfoBtn,
                                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                navigateToAnime(item.id, item.title);
                              }}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`INFO ${item.title.toUpperCase()}`}
                            >
                              <Ionicons name="information-circle-outline" size={18} color={theme.colors.text} />
                              <Text style={[styles.heroInfoBtnText, { color: theme.colors.text }]}>INFO</Text>
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : focusedItem ? (
              <Pressable
                style={styles.heroContainer}
                onPress={() => navigateToAnime(focusedItem.id, focusedItem.title)}
                accessibilityRole="button"
                accessibilityLabel={`DETTAGLI ${focusedItem.title.toUpperCase()}`}
              >
                <Image
                  source={{ uri: focusedItem.banner || focusedItem.image || focusedItem.thumbnail }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={300}
                />
                <View style={styles.heroOverlay} />

                <View style={styles.heroContent}>
                  <View style={styles.heroBadgeRow}>
                    <View style={[styles.heroRankBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={[styles.heroRankBadgeText, { color: getContrastTextColor(theme.colors.primary) }]}>
                        #1 RACCOMANDATO
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {focusedItem.title}
                  </Text>

                  {focusedItem.synopsis ? (
                    <Text style={styles.heroSynopsis} numberOfLines={2}>
                      {focusedItem.synopsis}
                    </Text>
                  ) : null}

                  <View style={styles.heroActionsRow}>
                    <Pressable
                      style={[
                        styles.heroPlayBtn,
                        { backgroundColor: theme.colors.primary },
                        isHeroPlayLoading && styles.heroBtnDisabled,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePlayHero(focusedItem);
                      }}
                      hitSlop={8}
                      disabled={isHeroPlayLoading}
                      accessibilityRole="button"
                      accessibilityLabel={`RIPRODUCI ${focusedItem.title.toUpperCase()}`}
                    >
                      {isHeroPlayLoading ? (
                        <ActivityIndicator size="small" color={getContrastTextColor(theme.colors.primary)} />
                      ) : (
                        <>
                          <Ionicons name="play" size={18} color={getContrastTextColor(theme.colors.primary)} />
                          <Text
                            style={[
                              styles.heroPlayBtnText,
                              { color: getContrastTextColor(theme.colors.primary) },
                            ]}
                          >
                            RIPRODUCI
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={[
                        styles.heroInfoBtn,
                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigateToAnime(focusedItem.id, focusedItem.title);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`INFO ${focusedItem.title.toUpperCase()}`}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={theme.colors.text} />
                      <Text style={[styles.heroInfoBtnText, { color: theme.colors.text }]}>INFO</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {/* 2. Carosello Raccomandati Numerati in Ordine (#1 .. #8) */}
            {recommendedList.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    RACCOMANDATI
                  </Text>
                  <Text
                    style={[
                      styles.sectionBadge,
                      {
                        backgroundColor: theme.colors.primary,
                        color: getContrastTextColor(theme.colors.primary),
                      },
                    ]}
                  >
                    {safeFocusedIndex + 1}/{recommendedList.length}
                  </Text>
                </View>

                <ScrollView
                  ref={recommendedScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.recommendedScrollContent,
                    {
                      paddingRight: Math.max(16, windowWidth - RECOMMENDED_ITEM_WIDTH - 16),
                    },
                  ]}
                  snapToOffsets={recommendedSnapOffsets}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onScrollBeginDrag={() => {
                    if (resetSourceTimeoutRef.current) clearTimeout(resetSourceTimeoutRef.current);
                    activeScrollSourceRef.current = 'recommended';
                  }}
                  onScrollEndDrag={(e) => {
                    const velocity = e.nativeEvent.velocity?.x ?? 0;
                    if (Math.abs(velocity) < 0.1) {
                      settleRecommendedScroll(e.nativeEvent.contentOffset.x);
                    }
                  }}
                  onMomentumScrollEnd={(e) => {
                    settleRecommendedScroll(e.nativeEvent.contentOffset.x);
                  }}
                  onScroll={handleRecommendedScroll}
                >
                  {recommendedList.map((item, index) => {
                    const isFocused = index === safeFocusedIndex;
                    return (
                      <Pressable
                        key={`recommended-${item.id}-${index}`}
                        style={[
                          styles.recommendedCard,
                          {
                            backgroundColor: theme.colors.card,
                            borderColor: isFocused ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                        onPress={() => handleSelectRecommended(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`RACCOMANDATO NUMERO ${index + 1}: ${item.title.toUpperCase()}`}
                      >
                        <Image
                          source={{ uri: item.thumbnail || item.banner || item.image }}
                          style={styles.recommendedImage}
                          contentFit="cover"
                          transition={200}
                        />
                        <View style={styles.recommendedOverlay} />

                        {/* Rank Badge top-left */}
                        <View
                          style={[
                            styles.rankBadge,
                            {
                              backgroundColor: isFocused ? theme.colors.primary : 'rgba(0, 0, 0, 0.75)',
                              borderColor: isFocused ? theme.colors.primary : 'rgba(255, 255, 255, 0.25)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rankBadgeText,
                              {
                                color: isFocused
                                  ? getContrastTextColor(theme.colors.primary)
                                  : '#FFFFFF',
                              },
                            ]}
                          >
                            #{index + 1}
                          </Text>
                        </View>

                        {/* Sub / Dub tag */}
                        {item.subOrDub && (
                          <View style={[styles.recommendedSubBadge, { backgroundColor: theme.colors.surface }]}>
                            <Text style={styles.recommendedSubBadgeText}>{item.subOrDub}</Text>
                          </View>
                        )}

                        {/* Title Box */}
                        <View style={styles.recommendedTitleBox}>
                          <Text
                            style={[
                              styles.recommendedTitle,
                              { color: isFocused ? theme.colors.primary : theme.colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3. Riprendi a guardare - Visibile SOLO quando vi sono serie con visione in corso */}
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

                        {/* Tasto rimozione in alto a destra */}
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

            {/* 4. Ultime Uscite (Ultimi Episodi Usciti) */}
            {homeData?.all && homeData.all.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>ULTIMI EPISODI USCITI</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsSearchActive(true);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="VEDI TUTTI GLI EPISODI"
                  >
                    <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>VEDI TUTTI</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.all.slice(0, 20).map((anime: AnimeItem) => (
                    <AnimeCard
                      key={`all-${anime.id}`}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 5. Tendenze */}
            {homeData?.trending && homeData.trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>TENDENZE</Text>
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

            {/* 6. Anime in Corso */}
            {homeData?.ongoing && homeData.ongoing.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>ANIME IN CORSO</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.ongoing.map((anime: AnimeItem) => (
                    <AnimeCard
                      key={`ongoing-${anime.id}`}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 7. Uscite della stagione corrente (Upcoming) */}
            {homeData?.upcoming && homeData.upcoming.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {(homeData.upcomingTitle || 'PROSSIME USCITE').toUpperCase()}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsSearchActive(true);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="VEDI TUTTE LE PROSSIME USCITE"
                  >
                    <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>VEDI TUTTI</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {homeData.upcoming.map((anime: AnimeItem) => (
                    <AnimeCard
                      key={`upcoming-${anime.id}`}
                      anime={anime}
                      onPress={() => navigateToAnime(anime.id, anime.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 8. Nuove Aggiunte */}
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

      {/* Modal di Conferma Svuota Cronologia Ricerche */}
      <ConfirmModal
        visible={isClearAllSearchConfirmOpen}
        title="SVUOTA CRONOLOGIA RICERCHE"
        message="VUOI DAVVERO CANCELLARE TUTTE LE RICERCHE RECENTI? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="CANCELLA TUTTO"
        onConfirm={handleConfirmClearAllSearch}
        onCancel={() => setIsClearAllSearchConfirmOpen(false)}
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
  searchHistoryContainer: {
    flex: 1,
  },
  searchHistoryContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  searchHistoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchHistoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAllSearchBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clearAllSearchText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  searchHistoryList: {
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchHistoryItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  searchHistoryItemIcon: {
    marginRight: 2,
  },
  searchHistoryItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  searchHistoryDeleteBtn: {
    width: 44,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySubText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: -4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
  heroSlide: {
    height: HERO_HEIGHT,
    position: 'relative',
    backgroundColor: '#0D0D0D',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroRankBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: oledTheme.radius.xs,
  },
  heroRankBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroSubBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroSubBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroSynopsis: {
    color: '#D4D4D4',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    minHeight: 44,
  },
  heroPlayBtnText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    minHeight: 44,
    borderWidth: 1,
  },
  heroInfoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBtnDisabled: {
    opacity: 0.7,
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
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  horizontalScroll: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  recommendedScrollContent: {
    paddingLeft: 16,
    paddingRight: 6,
    gap: RECOMMENDED_ITEM_GAP,
  },
  recommendedCard: {
    width: RECOMMENDED_ITEM_WIDTH,
    height: 160,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
  },
  recommendedImage: {
    width: '100%',
    height: '100%',
  },
  recommendedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  recommendedSubBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  recommendedSubBadgeText: {
    color: '#E5E5E5',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  recommendedTitleBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  recommendedTitle: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    textAlign: 'center',
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
