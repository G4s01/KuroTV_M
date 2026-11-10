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
import {
  homeStyles as styles,
  HomeSection,
  ContinueWatchingSection,
  HomeSearchHeader,
  HomeAppBar,
  SearchFilterChips,
  SearchResultsGrid,
  SearchHistoryList,
} from '@/components/home';
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
        <HomeSearchHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSubmitSearch={(q) => {
            if (q.trim().length >= 2) {
              AppStorage.addSearchHistory(q.trim());
              setSearchHistoryList(AppStorage.getSearchHistory());
            }
          }}
          onClose={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setIsSearchActive(false);
            setSearchQuery('');
            setFilterState({});
          }}
          activeFilterCount={activeFilterCount}
          onOpenFilters={() => {
            Haptics.selectionAsync().catch(() => {});
            Keyboard.dismiss();
            setIsFilterSheetVisible(true);
          }}
        />
      ) : (
        <HomeAppBar
          onSearchPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsSearchActive(true);
          }}
        />
      )}

      {isSearchActive ? (
        <View style={styles.searchContainer}>
          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <SearchFilterChips
              filterState={filterState}
              activeGenres={activeGenres}
              onRemoveFilter={removeFilter}
              onRemoveGenre={removeGenre}
            />
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
            <SearchResultsGrid
              items={searchResults?.items || []}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              onItemPress={(item) => navigateToAnime(item.id, item.title)}
            />
          ) : (
            <SearchHistoryList
              title="RICERCHE RECENTI"
              icon="time-outline"
              items={searchHistoryList}
              isHistoryActive={isSearchHistoryActive}
              onSelectQuery={handleSelectSearchHistory}
              onDeleteItem={handleDeleteSearchHistoryItem}
              onClearAll={() => setIsClearAllSearchConfirmOpen(true)}
            />
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
              <ContinueWatchingSection
                items={continueWatching}
                onItemPress={navigateToPlayer}
                onRemoveItem={handleRemoveContinue}
              />
            )}

            {/* 4. Ultime Uscite (Ultimi Episodi Usciti) */}
            {homeData?.all && homeData.all.length > 0 && (
              <HomeSection
                title="ULTIMI EPISODI USCITI"
                items={homeData.all}
                maxItems={20}
                onItemPress={(anime) => navigateToAnime(anime.id, anime.title)}
                onSeeAll={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsSearchActive(true);
                }}
              />
            )}

            {/* 5. Tendenze */}
            {homeData?.trending && homeData.trending.length > 0 && (
              <HomeSection
                title="TENDENZE"
                items={homeData.trending}
                onItemPress={(anime) => navigateToAnime(anime.id, anime.title)}
              />
            )}

            {/* 6. Anime in Corso */}
            {homeData?.ongoing && homeData.ongoing.length > 0 && (
              <HomeSection
                title="ANIME IN CORSO"
                items={homeData.ongoing}
                onItemPress={(anime) => navigateToAnime(anime.id, anime.title)}
              />
            )}

            {/* 7. Uscite della stagione corrente (Upcoming) */}
            {homeData?.upcoming && homeData.upcoming.length > 0 && (
              <HomeSection
                title={(homeData.upcomingTitle || 'PROSSIME USCITE').toUpperCase()}
                items={homeData.upcoming}
                onItemPress={(anime) => navigateToAnime(anime.id, anime.title)}
                onSeeAll={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsSearchActive(true);
                }}
              />
            )}

            {/* 8. Nuove Aggiunte */}
            {homeData?.newAdded && homeData.newAdded.length > 0 && (
              <HomeSection
                title="NUOVE AGGIUNTE"
                items={homeData.newAdded}
                onItemPress={(anime) => navigateToAnime(anime.id, anime.title)}
              />
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
