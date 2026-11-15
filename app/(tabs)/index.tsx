import React from 'react';
import {
  Text,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  Keyboard,
  BackHandler,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { homeQueryOptions, animeQueryKeys, animeDetailQueryOptions } from '@/services/queries';
import {
  AppStorage,
  syncCaughtUpWithHomeList,
  syncCaughtUpWithRemote,
  type SearchHistoryItem,
} from '@/services/storage';
import { SyncManager } from '@/services/sync';
import { AnimeWorldScraper } from '@/services/scraper';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  FilterBottomSheet,
  type FilterState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  HeroBannerSection,
  RecommendedCarouselSection,
} from '@/components/home';
import { HomeScreenSkeleton, ExploreScreenSkeleton } from '@/components/skeleton';
import { useResponsiveLayout } from '@/hooks';
import { DownloadService } from '@/services/downloads';
import type { AnimeItem, ContinueWatchingItem, SearchFilter } from '@/types';

const HERO_HEIGHT = 320;
const RECOMMENDED_ITEM_WIDTH = 114;
const RECOMMENDED_ITEM_GAP = 10;
const RECOMMENDED_ITEM_TOTAL = RECOMMENDED_ITEM_WIDTH + RECOMMENDED_ITEM_GAP;

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { isTablet, contentWidth, numColumns, cardWidth, cardHeight } = useResponsiveLayout();
  const heroHeight = isTablet ? 360 : HERO_HEIGHT;

  const { data: homeData, isLoading, isError, refetch, isRefetching } = useQuery(homeQueryOptions());
  const [continueWatching, setContinueWatching] = React.useState<ContinueWatchingItem[]>([]);
  const [itemToRemove, setItemToRemove] = React.useState<ContinueWatchingItem | null>(null);

  // Top recommended selection & focus state
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const currentFocusedIndexRef = React.useRef(0);
  const lastSettledRecommendedIndexRef = React.useRef(-1);
  const lastSettledHeroIndexRef = React.useRef(-1);
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

  // Active downloads count badge in Home header
  const [activeDownloadsCount, setActiveDownloadsCount] = React.useState<number>(() => {
    return DownloadService.getActiveDownloadsCount();
  });

  React.useEffect(() => {
    const unsub = DownloadService.addListListener(() => {
      setActiveDownloadsCount(DownloadService.getActiveDownloadsCount());
    });
    return unsub;
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchActiveRef = React.useRef(isSearchActive);
  isSearchActiveRef.current = isSearchActive;

  const isFilterSheetVisibleRef = React.useRef(isFilterSheetVisible);
  isFilterSheetVisibleRef.current = isFilterSheetVisible;

  // Handle hardware back button & Android system back gesture to dismiss search mode cleanly ONLY when actively focused
  useFocusEffect(
    React.useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isFilterSheetVisibleRef.current) {
          Haptics.selectionAsync().catch(() => {});
          setIsFilterSheetVisible(false);
          return true;
        }
        if (isSearchActiveRef.current) {
          Haptics.selectionAsync().catch(() => {});
          Keyboard.dismiss();
          setIsSearchActive(false);
          setSearchQuery('');
          setFilterState({});
          return true;
        }
        BackHandler.exitApp();
        return true;
      });

      return () => backSub.remove();
    }, [])
  );

  // Also dismiss search when user taps the Home tab while already on Home
  useFocusEffect(
    React.useCallback(() => {
      const unsub = navigation.addListener('tabPress' as any, () => {
        if (isSearchActiveRef.current) {
          Keyboard.dismiss();
          setIsSearchActive(false);
          setSearchQuery('');
          setFilterState({});
        }
      });
      return unsub;
    }, [navigation])
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

    // 1. Controllo passivo istantaneo tra le ultime uscite della Home e le serie in pari
    if (homeData) {
      const candidates = [
        ...(homeData.all || []),
        ...(homeData.newAdded || []),
        ...(homeData.sliders || []),
      ];
      syncCaughtUpWithHomeList(candidates).then((updated) => {
        if (updated) {
          setContinueWatching(AppStorage.getContinueWatching());
        }
      });
    }
  }, [homeData]);

  useFocusEffect(
    React.useCallback(() => {
      setContinueWatching(AppStorage.getContinueWatching());

      // 2. Controllo remoto periodico (Ibrido Smart: verifica ogni 4 ore in background)
      syncCaughtUpWithRemote(false).then((updated) => {
        if (updated) {
          setContinueWatching(AppStorage.getContinueWatching());
        }
      });
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
    if (SyncManager.isConnected()) {
      try {
        await SyncManager.pullDelta();
      } catch {
        // Safe catch
      }
    }
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: animeQueryKeys.all }),
    ]);
    // Forza la verifica remota delle serie in pari al pull-to-refresh
    await syncCaughtUpWithRemote(true);
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

  const handleContinueItemPress = (item: ContinueWatchingItem) => {
    if (item.isCaughtUp) {
      // Se l'utente è in pari con le uscite, il tap apre la scheda dettagli per consultare uscite o rewatch
      navigateToAnime(item.animeId, item.title);
    } else {
      navigateToPlayer(item);
    }
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
  }, [recommendedList]);

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
    lastSettledRecommendedIndexRef.current = -1;
    lastSettledHeroIndexRef.current = -1;

    const maxIndex = Math.max(0, recommendedList.length - 1);
    const targetIndex = Math.max(0, Math.min(index, maxIndex));

    currentFocusedIndexRef.current = targetIndex;
    setFocusedIndex(targetIndex);

    heroScrollRef.current?.scrollTo({
      x: targetIndex * contentWidth,
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

    if (lastSettledRecommendedIndexRef.current === targetIndex) {
      return;
    }
    lastSettledRecommendedIndexRef.current = targetIndex;

    // Keep the recommended card snapped exactly in place
    recommendedScrollRef.current?.scrollTo({
      x: targetIndex * RECOMMENDED_ITEM_TOTAL,
      animated: true,
    });

    currentFocusedIndexRef.current = targetIndex;
    setFocusedIndex(targetIndex);

    // Synchronize hero banner with the newly focused anime
    heroScrollRef.current?.scrollTo({
      x: targetIndex * contentWidth,
      animated: true,
    });

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
        Math.round(offsetX / contentWidth),
        maxIndex
      )
    );

    if (lastSettledHeroIndexRef.current === targetIndex) {
      return;
    }
    lastSettledHeroIndexRef.current = targetIndex;

    currentFocusedIndexRef.current = targetIndex;
    setFocusedIndex(targetIndex);

    // Synchronize recommended carousel with the newly focused anime
    recommendedScrollRef.current?.scrollTo({
      x: targetIndex * RECOMMENDED_ITEM_TOTAL,
      animated: true,
    });

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
      Haptics.selectionAsync().catch(() => {});
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
        Math.round(offsetX / contentWidth),
        maxIndex
      )
    );
    if (targetIndex !== currentFocusedIndexRef.current) {
      currentFocusedIndexRef.current = targetIndex;
      setFocusedIndex(targetIndex);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  // Start playback of the hero anime (check continue watching, saved progress, or fetch Episode 1)
  const handlePlayHero = async (item: AnimeItem) => {
    if (!item || !item.id) return;
    Haptics.selectionAsync().catch(() => {});

    // 1. Resume from active Continue Watching if present
    const continueItem = continueWatching.find((cw) => cw.animeId === item.id);
    if (continueItem) {
      if (continueItem.isCaughtUp) {
        navigateToAnime(item.id, item.title);
        return;
      }
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
          onSchedulePress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.navigate('/(tabs)/explore' as any);
          }}
          activeDownloadsCount={activeDownloadsCount}
          onDownloadsPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/downloads' as any);
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
              numColumns={numColumns}
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
            {/* 1. Hero Banner: Anime in evidenza (primo della top 8 dei raccomandati con swiper sincronizzato, pulsanti RIPRODUCI e INFO) */}
            <HeroBannerSection
              recommendedList={recommendedList}
              focusedItem={focusedItem}
              safeFocusedIndex={safeFocusedIndex}
              contentWidth={contentWidth}
              heroHeight={heroHeight}
              heroScrollRef={heroScrollRef}
              isHeroPlayLoading={isHeroPlayLoading}
              onPlayHero={handlePlayHero}
              onNavigateToAnime={navigateToAnime}
              onScrollBeginDrag={() => {
                if (resetSourceTimeoutRef.current) clearTimeout(resetSourceTimeoutRef.current);
                activeScrollSourceRef.current = 'hero';
                lastSettledHeroIndexRef.current = -1;
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
            />

            {/* 2. Carosello RACCOMANDATI con snapToOffsets e paddingRight: Math.max(16, contentWidth - RECOMMENDED_ITEM_WIDTH - 16) */}
            <RecommendedCarouselSection
              recommendedList={recommendedList}
              safeFocusedIndex={safeFocusedIndex}
              contentWidth={contentWidth}
              recommendedScrollRef={recommendedScrollRef}
              recommendedSnapOffsets={recommendedSnapOffsets}
              onSelectRecommended={handleSelectRecommended}
              onScrollBeginDrag={() => {
                if (resetSourceTimeoutRef.current) clearTimeout(resetSourceTimeoutRef.current);
                activeScrollSourceRef.current = 'recommended';
                lastSettledRecommendedIndexRef.current = -1;
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
            />

            {/* 3. Riprendi a guardare - Visibile SOLO quando vi sono serie con visione in corso */}
            {continueWatching.length > 0 && (
              <ContinueWatchingSection
                items={continueWatching}
                onItemPress={handleContinueItemPress}
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
