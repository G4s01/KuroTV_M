import React from 'react';
import {
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/skeleton';
import {
  MalAnimeCard,
  MalConnectCard,
  MalEntrySheet,
  MalMatchPickerModal,
  MalSettingsModal,
  MalSyncDiffModal,
  malStyles as styles,
} from '@/components/mal';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MalAuthService,
  MalClient,
  MalSyncService,
  addMalDataListener,
  computeLocalAppToMalDiffSnapshot,
  getMalIdMapStore,
  getMalListCache,
  resolveMalToAnimeWorld,
  type MalAnimeListEntry,
  type MalDiffResult,
  type MalListCache,
  type MalListStatusValue,
  type MalPickerCandidate,
  type MalSortOption,
  type MalSyncApplyResult,
  type MalSyncProposal,
  type MalUnmappedLocalSeries,
} from '@/services/mal';
import malSvg from '../../assets/icons/myanimelist.svg';

const MAL_QUERY_KEY = ['mal', 'lists'] as const;

const SORT_LABELS: Record<MalSortOption, string> = {
  recent: 'RECENTI',
  title: 'A-Z',
  score: 'VOTO',
};

const SORT_CYCLE: MalSortOption[] = ['recent', 'title', 'score'];

function MalListSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
      {Array.from({ length: 6 }, (_, idx) => (
        <View
          key={`mal-skel-${idx}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#262626',
            backgroundColor: '#121212',
            minHeight: 96,
          }}
        >
          <Skeleton width={60} height={86} borderRadius={8} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="82%" height={14} borderRadius={4} />
            <Skeleton width="46%" height={18} borderRadius={6} />
            <Skeleton width="58%" height={18} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = !isTablet && windowWidth < 390;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [authStatus, setAuthStatus] = React.useState(() => MalAuthService.getStatus());
  const [activeTab, setActiveTab] = React.useState<MalListStatusValue>('watching');
  const [sortBy, setSortBy] = React.useState<MalSortOption>('recent');

  // Uncontrolled search filter state (AGENTS.md rule #9: zero re-render per keystroke)
  const searchInputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const lastNativeSearchRef = React.useRef('');
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterQuery, setFilterQuery] = React.useState('');
  const [hasSearchText, setHasSearchText] = React.useState(false);
  const [searchInputKey, setSearchInputKey] = React.useState(0);

  // Sync, mapping, and modal states
  const [dataRevision, setDataRevision] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [resolvingMalId, setResolvingMalId] = React.useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = React.useState<{
    text: string;
    type: 'info' | 'error' | 'success';
  } | null>(null);

  const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);
  const [isDiffModalVisible, setIsDiffModalVisible] = React.useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = React.useState(false);
  const [mappingProgress, setMappingProgress] = React.useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [diffResult, setDiffResult] = React.useState<MalDiffResult | null>(null);

  const [pickerState, setPickerState] = React.useState<{
    visible: boolean;
    entry: MalAnimeListEntry | null;
    reason: 'multiple_variants' | 'no_exact_match' | 'manual_remap';
    candidates: MalPickerCandidate[];
  }>({
    visible: false,
    entry: null,
    reason: 'multiple_variants',
    candidates: [],
  });

  const [editingEntry, setEditingEntry] = React.useState<MalAnimeListEntry | null>(null);

  const isMountedRef = React.useRef(true);
  const isScreenFocusedRef = React.useRef(true);

  const syncCacheIntoQuery = React.useCallback(() => {
    const latestCache = getMalListCache();
    if (!latestCache) return;
    const existing = queryClient.getQueryData<MalListCache>(MAL_QUERY_KEY);
    if (!existing || latestCache.updatedAt > (existing.updatedAt || 0)) {
      queryClient.setQueryData(MAL_QUERY_KEY, latestCache);
    }
  }, [queryClient]);

  React.useEffect(() => {
    isMountedRef.current = true;
    const unsubAuth = MalAuthService.addAuthListener((next) => {
      setAuthStatus(next);
    });
    const unsubData = addMalDataListener(() => {
      syncCacheIntoQuery();
      setDataRevision((r) => r + 1);
    });
    return () => {
      isMountedRef.current = false;
      unsubAuth();
      unsubData();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [syncCacheIntoQuery]);

  const listsQuery = useQuery<MalListCache>({
    queryKey: MAL_QUERY_KEY,
    enabled: authStatus.isConnected,
    queryFn: async () => {
      await MalSyncService.flushPendingUpdates().catch(() => {});
      return await MalClient.fetchAllTrackedLists();
    },
    initialData: () => getMalListCache() ?? undefined,
    initialDataUpdatedAt: () => getMalListCache()?.updatedAt || 0,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  useFocusEffect(
    React.useCallback(() => {
      isScreenFocusedRef.current = true;
      setAuthStatus(MalAuthService.getStatus());
      syncCacheIntoQuery();
      setDataRevision((r) => r + 1);
      if (MalAuthService.isConnected()) {
        MalSyncService.flushPendingUpdates().catch(() => {});
      }
      return () => {
        isScreenFocusedRef.current = false;
      };
    }, [syncCacheIntoQuery])
  );

  const handleClearSearch = React.useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    lastNativeSearchRef.current = '';
    setHasSearchText(false);
    setFilterQuery('');
    setSearchInputKey((k) => k + 1);
  }, []);

  const isAnyModalOpenRef = React.useRef(false);
  isAnyModalOpenRef.current = Boolean(
    isSettingsVisible || isDiffModalVisible || pickerState.visible || editingEntry
  );
  const hasFilterQueryRef = React.useRef(false);
  hasFilterQueryRef.current = Boolean(filterQuery.trim() || lastNativeSearchRef.current.trim());

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isSettingsVisible) {
          setIsSettingsVisible(false);
          return true;
        }
        if (isDiffModalVisible) {
          setIsDiffModalVisible(false);
          return true;
        }
        if (pickerState.visible) {
          setPickerState((prev) => ({ ...prev, visible: false }));
          return true;
        }
        if (editingEntry) {
          setEditingEntry(null);
          return true;
        }
        if (hasFilterQueryRef.current) {
          handleClearSearch();
          return true;
        }
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
        return true;
      });
      return () => sub.remove();
    }, [
      isSettingsVisible,
      isDiffModalVisible,
      pickerState.visible,
      editingEntry,
      handleClearSearch,
      router,
    ])
  );

  const handleSearchChange = React.useCallback((text: string) => {
    lastNativeSearchRef.current = text;
    const nextHas = text.length > 0;
    setHasSearchText((prev) => (prev !== nextHas ? nextHas : prev));

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setFilterQuery(lastNativeSearchRef.current);
    }, 180);
  }, []);

  const handleCycleSort = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSortBy((prev) => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }, []);

  const handleRefresh = React.useCallback(async () => {
    if (!authStatus.isConnected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRefreshing(true);
    setBannerMessage(null);
    try {
      await MalSyncService.flushPendingUpdates().catch(() => {});
      const fresh = await MalClient.fetchAllTrackedLists();
      queryClient.setQueryData(MAL_QUERY_KEY, fresh);
      setDataRevision((r) => r + 1);
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: (err?.message || 'IMPOSSIBILE AGGIORNARE LE LISTE MAL.').toUpperCase(),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [authStatus.isConnected, queryClient]);

  const handleOpenSyncDiff = React.useCallback(async () => {
    if (!authStatus.isConnected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsDiffModalVisible(true);
    setIsLoadingDiff(true);
    setMappingProgress(null);

    try {
      let currentLists = listsQuery.data || getMalListCache();
      if (!currentLists) {
        currentLists = await MalClient.fetchAllTrackedLists();
        queryClient.setQueryData(MAL_QUERY_KEY, currentLists);
      }
      const res = await MalSyncService.computeAppToMalDiff({
        resolveMissingMappings: true,
        malLists: currentLists,
        onMappingProgress: (completed, total) => {
          setMappingProgress({ completed, total });
        },
      });
      setDiffResult(res);
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: (err?.message || 'ERRORE CALCOLO SINCRONIZZAZIONE.').toUpperCase(),
      });
      setIsDiffModalVisible(false);
    } finally {
      setIsLoadingDiff(false);
      setMappingProgress(null);
    }
  }, [authStatus.isConnected, listsQuery.data, queryClient]);

  const handleProposalsApplied = React.useCallback(
    (result: MalSyncApplyResult) => {
      const updatedCache = getMalListCache();
      if (updatedCache) {
        queryClient.setQueryData(MAL_QUERY_KEY, updatedCache);
      } else {
        queryClient.invalidateQueries({ queryKey: MAL_QUERY_KEY }).catch(() => {});
      }
      setDataRevision((r) => r + 1);
      setBannerMessage({
        type: result.failed > 0 ? 'info' : 'success',
        text:
          result.failed > 0
            ? `SINCRONIZZATI ${result.succeeded}/${result.total} TITOLI SU MYANIMELIST.`
            : `SINCRONIZZAZIONE COMPLETATA (${result.succeeded} AGGIORNATI SU MAL).`,
      });
    },
    [queryClient]
  );

  const handleCardPress = React.useCallback(
    async (entry: MalAnimeListEntry) => {
      if (resolvingMalId !== null) return;
      setResolvingMalId(entry.malId);
      setBannerMessage(null);
      try {
        const res = await resolveMalToAnimeWorld(entry);
        if (!isMountedRef.current || !isScreenFocusedRef.current) return;
        if (res.status === 'resolved') {
          router.push({
            pathname: '/anime/[id]',
            params: { id: res.animeId, title: entry.title },
          });
        } else {
          setPickerState({
            visible: true,
            entry,
            reason: res.reason,
            candidates: res.candidates,
          });
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setBannerMessage({
          type: 'error',
          text: (err?.message || 'IMPOSSIBILE CERCARE LA SERIE SU ANIMEWORLD.').toUpperCase(),
        });
      } finally {
        if (isMountedRef.current) {
          setResolvingMalId(null);
        }
      }
    },
    [resolvingMalId, router]
  );

  const handleCardLongPress = React.useCallback(
    async (entry: MalAnimeListEntry) => {
      if (resolvingMalId !== null) return;
      setResolvingMalId(entry.malId);
      try {
        const res = await resolveMalToAnimeWorld(entry, { forcePicker: true });
        if (!isMountedRef.current || !isScreenFocusedRef.current) return;
        setPickerState({
          visible: true,
          entry,
          reason: 'manual_remap',
          candidates: res.status === 'needs_picker' ? res.candidates : [],
        });
      } catch {
        if (!isMountedRef.current || !isScreenFocusedRef.current) return;
        setPickerState({
          visible: true,
          entry,
          reason: 'manual_remap',
          candidates: [],
        });
      } finally {
        if (isMountedRef.current) {
          setResolvingMalId(null);
        }
      }
    },
    [resolvingMalId]
  );

  const handleSelectPickerCandidate = React.useCallback(
    (cand: MalPickerCandidate) => {
      const targetTitle = pickerState.entry?.title || cand.title;
      setPickerState((prev) => ({ ...prev, visible: false }));
      setDataRevision((r) => r + 1);
      router.push({
        pathname: '/anime/[id]',
        params: { id: cand.id, title: targetTitle },
      });
    },
    [pickerState.entry?.title, router]
  );

  const handleOpenUnmappedAnime = React.useCallback(
    (item: MalUnmappedLocalSeries) => {
      setIsDiffModalVisible(false);
      router.push({
        pathname: '/anime/[id]',
        params: { id: item.animeId, title: item.title },
      });
    },
    [router]
  );

  const listCache = React.useMemo(
    () =>
      listsQuery.data || {
        watching: [],
        plan_to_watch: [],
        completed: [],
        updatedAt: 0,
      },
    [listsQuery.data]
  );

  // Instant local diff snapshot for header badge & per-card sync hint
  const localDiffSnapshot = React.useMemo(() => {
    if (!authStatus.isConnected) {
      return { proposals: [], unmapped: [], alreadySyncedCount: 0 };
    }
    return computeLocalAppToMalDiffSnapshot(listCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus.isConnected, listCache, dataRevision]);

  const proposalByMalId = React.useMemo(() => {
    const map = new Map<number, MalSyncProposal>();
    for (const p of localDiffSnapshot.proposals) {
      map.set(p.malId, p);
    }
    return map;
  }, [localDiffSnapshot.proposals]);

  const idMapStore = React.useMemo(() => {
    return getMalIdMapStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRevision]);

  const activeEntries = React.useMemo(() => {
    const rawList =
      activeTab === 'watching'
        ? listCache.watching
        : activeTab === 'plan_to_watch'
        ? listCache.plan_to_watch
        : listCache.completed;

    const queryLower = filterQuery.trim().toLowerCase();
    const filtered = queryLower
      ? rawList.filter((item) => {
          if (item.title.toLowerCase().includes(queryLower)) return true;
          if (item.alternativeTitles?.en?.toLowerCase().includes(queryLower)) return true;
          if (item.alternativeTitles?.ja?.toLowerCase().includes(queryLower)) return true;
          if (
            Array.isArray(item.alternativeTitles?.synonyms) &&
            item.alternativeTitles!.synonyms!.some((s) => s.toLowerCase().includes(queryLower))
          ) {
            return true;
          }
          return false;
        })
      : rawList;

    if (sortBy === 'title') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'score') {
      return [...filtered].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.mean || 0) - (a.mean || 0);
      });
    }
    // recent (MAL already sorts by list_updated_at, preserve order or sort by updatedAt desc)
    return [...filtered].sort((a, b) => {
      const taRaw = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tbRaw = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      const ta = Number.isFinite(taRaw) ? taRaw : 0;
      const tb = Number.isFinite(tbRaw) ? tbRaw : 0;
      return tb - ta;
    });
  }, [activeTab, listCache, filterQuery, sortBy]);

  const syncProposalsCount = localDiffSnapshot.proposals.length;
  const isInitialLoading = Boolean(
    authStatus.isConnected && listsQuery.isLoading && !listsQuery.data
  );

  const tabContainerStyle = isTablet
    ? { maxWidth: 920, width: '100%' as const, alignSelf: 'center' as const }
    : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background },
          tabContainerStyle,
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.touchTarget}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="TORNA INDIETRO"
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
            </View>
          </Pressable>

          <View style={styles.headerTitleBlock}>
            <View style={styles.headerTitleRow}>
              <Image source={malSvg} style={styles.headerLogo} contentFit="contain" />
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.colors.text },
                  isNarrow && { fontSize: 14 },
                ]}
                numberOfLines={1}
              >
                MYANIMELIST
              </Text>
            </View>
            {authStatus.isConnected && authStatus.username ? (
              <Text
                style={[styles.headerUsername, { color: theme.colors.primary }]}
                numberOfLines={1}
              >
                @{authStatus.username}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          {authStatus.isConnected && (
            <Pressable
              style={[
                styles.syncHeaderBtn,
                isNarrow && { paddingHorizontal: 10, gap: 4 },
                {
                  backgroundColor:
                    syncProposalsCount > 0 ? theme.colors.primary : theme.colors.card,
                  borderColor:
                    syncProposalsCount > 0 ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={handleOpenSyncDiff}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`SINCRONIZZA APP SU MYANIMELIST (${syncProposalsCount} PROPOSTE)`}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={syncProposalsCount > 0 ? primaryContrast : theme.colors.text}
              />
              <Text
                style={[
                  styles.syncHeaderBtnText,
                  isNarrow && { fontSize: 10 },
                  { color: syncProposalsCount > 0 ? primaryContrast : theme.colors.text },
                ]}
                numberOfLines={1}
              >
                {isNarrow ? 'SYNC' : 'SINCRONIZZA'}
              </Text>
              {syncProposalsCount > 0 && (
                <View style={[styles.syncBadge, { backgroundColor: primaryContrast }]}>
                  <Text style={[styles.syncBadgeText, { color: theme.colors.primary }]}>
                    {syncProposalsCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          <Pressable
            style={styles.touchTarget}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setIsSettingsVisible(true);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="IMPOSTAZIONI MYANIMELIST"
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="settings-outline" size={19} color={theme.colors.text} />
            </View>
          </Pressable>
        </View>
      </View>

      {!authStatus.isConnected ? (
        <ScrollView
          contentContainerStyle={[
            styles.connectScrollContent,
            isTablet && { maxWidth: 640, width: '100%', alignSelf: 'center' },
            { paddingBottom: Math.max(40, insets.bottom + 24) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MalConnectCard
            onConnected={() => {
              setAuthStatus(MalAuthService.getStatus());
              queryClient.invalidateQueries({ queryKey: MAL_QUERY_KEY }).catch(() => {});
            }}
          />
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, tabContainerStyle]}>
          {/* 3 Segmented Tabs & Search + Sort */}
          <View
            style={[
              styles.controlsSection,
              {
                borderBottomColor: theme.colors.border,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            <View style={styles.tabsRow}>
              {(
                [
                  { id: 'watching', label: `IN CORSO (${listCache.watching.length})` },
                  { id: 'plan_to_watch', label: `DA GUARDARE (${listCache.plan_to_watch.length})` },
                  { id: 'completed', label: `COMPLETATI (${listCache.completed.length})` },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    style={[
                      styles.tabBtn,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setActiveTab(tab.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tab.label}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: active ? primaryContrast : theme.colors.text },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.78}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.searchAndSortRow}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="search" size={16} color={theme.colors.textMuted} />
                <TextInput
                  key={searchInputKey}
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="FILTRA TITOLI IN LISTA..."
                  placeholderTextColor={theme.colors.textMuted}
                  defaultValue={lastNativeSearchRef.current}
                  onChangeText={handleSearchChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  disableFullscreenUI={true}
                  returnKeyType="search"
                />
                {hasSearchText && (
                  <Pressable
                    style={{
                      minWidth: 40,
                      minHeight: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={handleClearSearch}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="CANCELLA FILTRO RICERCA"
                  >
                    <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <Pressable
                style={[
                  styles.sortChip,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
                onPress={handleCycleSort}
                accessibilityRole="button"
                accessibilityLabel={`ORDINAMENTO: ${SORT_LABELS[sortBy]}`}
              >
                <Ionicons name="swap-vertical-outline" size={15} color={theme.colors.primary} />
                <Text style={[styles.sortChipText, { color: theme.colors.text }]}>
                  {SORT_LABELS[sortBy]}
                </Text>
              </Pressable>
            </View>
          </View>

          {bannerMessage ? (
            <Pressable
              style={[
                styles.inlineBanner,
                {
                  backgroundColor:
                    bannerMessage.type === 'error'
                      ? `${theme.colors.error || '#EF4444'}18`
                      : bannerMessage.type === 'success'
                      ? `${theme.colors.success || '#10B981'}18`
                      : `${theme.colors.primary}18`,
                  borderColor:
                    bannerMessage.type === 'error'
                      ? theme.colors.error || '#EF4444'
                      : bannerMessage.type === 'success'
                      ? theme.colors.success || '#10B981'
                      : theme.colors.primary,
                },
              ]}
              onPress={() => setBannerMessage(null)}
            >
              <Ionicons
                name={
                  bannerMessage.type === 'error'
                    ? 'alert-circle'
                    : bannerMessage.type === 'success'
                    ? 'checkmark-circle'
                    : 'information-circle'
                }
                size={16}
                color={
                  bannerMessage.type === 'error'
                    ? theme.colors.error || '#EF4444'
                    : bannerMessage.type === 'success'
                    ? theme.colors.success || '#10B981'
                    : theme.colors.primary
                }
              />
              <Text
                style={[
                  styles.inlineBannerText,
                  {
                    color:
                      bannerMessage.type === 'error'
                        ? theme.colors.error || '#EF4444'
                        : bannerMessage.type === 'success'
                        ? theme.colors.success || '#10B981'
                        : theme.colors.primary,
                  },
                ]}
              >
                {bannerMessage.text}
              </Text>
            </Pressable>
          ) : listsQuery.isError && listsQuery.data ? (
            <Pressable
              style={[
                styles.inlineBanner,
                {
                  backgroundColor: `${theme.colors.warning || '#F59E0B'}18`,
                  borderColor: theme.colors.warning || '#F59E0B',
                },
              ]}
              onPress={handleRefresh}
            >
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={theme.colors.warning || '#F59E0B'}
              />
              <Text
                style={[
                  styles.inlineBannerText,
                  { color: theme.colors.warning || '#F59E0B' },
                ]}
              >
                MODALITÀ OFFLINE: MOSTRATI DATI IN CACHE. TOCCA PER RIPROVARE.
              </Text>
            </Pressable>
          ) : null}

          {isInitialLoading ? (
            <MalListSkeleton />
          ) : listsQuery.isError && !listsQuery.data ? (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIconCircle,
                  {
                    backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                    borderColor: theme.colors.error || '#EF4444',
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={34}
                  color={theme.colors.error || '#EF4444'}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                IMPOSSIBILE CARICARE LE LISTE MAL
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                {(listsQuery.error as any)?.message?.toUpperCase() ||
                  'CONTROLLA LA CONNESSIONE E RIPROVA.'}
              </Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleRefresh}
                accessibilityRole="button"
                accessibilityLabel="RIPROVA CARICAMENTO MYANIMELIST"
              >
                <Ionicons name="refresh" size={18} color={primaryContrast} />
                <Text style={[styles.primaryBtnText, { color: primaryContrast }]}>RIPROVA</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              <FlashList
                data={activeEntries}
                keyExtractor={(item) => `${activeTab}-${item.malId}`}
                maintainVisibleContentPosition={{ disabled: true }}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: Math.max(28, insets.bottom + 16) },
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primary}
                    colors={[theme.colors.primary]}
                  />
                }
                renderItem={({ item }) => {
                  const malMap = idMapStore.byMalId[item.malId];
                  const animeMap = malMap?.primaryAnimeId
                    ? idMapStore.byAnimeId[malMap.primaryAnimeId]
                    : undefined;
                  return (
                    <MalAnimeCard
                      entry={item}
                      mappedAnimeId={malMap?.primaryAnimeId}
                      mappedAudio={animeMap?.audio}
                      pendingProposal={proposalByMalId.get(item.malId)}
                      isResolving={resolvingMalId === item.malId}
                      onPress={handleCardPress}
                      onLongPress={handleCardLongPress}
                      onEditPress={(e) => setEditingEntry(e)}
                    />
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <View
                      style={[
                        styles.emptyIconCircle,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={filterQuery.trim() ? 'search-outline' : 'albums-outline'}
                        size={32}
                        color={theme.colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                      {filterQuery.trim()
                        ? 'NESSUN TITOLO TROVATO'
                        : 'NESSUN ANIME IN QUESTA LISTA'}
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                      {filterQuery.trim()
                        ? 'MODIFICA O AZZERA IL FILTRO DI RICERCA PER VEDERE TUTTI I TITOLI.'
                        : activeTab === 'watching'
                        ? 'INIZIA UNA SERIE O SINCRONIZZA I PROGRESSI DALL\'APP SU MYANIMELIST.'
                        : 'AGGIUNGI TITOLI DALLA SCHEDA DETTAGLI ANIME O DIRETTAMENTE SU MAL.'}
                    </Text>
                    {filterQuery.trim() ? (
                      <Pressable
                        style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleClearSearch}
                      >
                        <Text style={[styles.primaryBtnText, { color: primaryContrast }]}>
                          AZZERA FILTRO
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                }
              />
            </View>
          )}
        </View>
      )}

      {/* Sync Diff Preview Modal */}
      <MalSyncDiffModal
        isVisible={isDiffModalVisible}
        onClose={() => setIsDiffModalVisible(false)}
        diff={diffResult}
        isLoadingDiff={isLoadingDiff}
        mappingProgress={mappingProgress}
        onProposalsApplied={handleProposalsApplied}
        onIgnoredChanged={() => setDataRevision((r) => r + 1)}
        onOpenUnmappedAnime={handleOpenUnmappedAnime}
      />

      {/* Match Picker Modal (SUB vs ITA or Manual Search) */}
      <MalMatchPickerModal
        isVisible={pickerState.visible}
        entry={pickerState.entry}
        reason={pickerState.reason}
        initialCandidates={pickerState.candidates}
        onClose={() => setPickerState((prev) => ({ ...prev, visible: false }))}
        onSelectCandidate={handleSelectPickerCandidate}
        onMappingCleared={() => setDataRevision((r) => r + 1)}
      />

      {/* Quick Entry Editor Sheet */}
      <MalEntrySheet
        isVisible={Boolean(editingEntry)}
        malId={editingEntry?.malId || null}
        animeId={
          editingEntry ? idMapStore.byMalId[editingEntry.malId]?.primaryAnimeId : undefined
        }
        animeTitle={editingEntry?.title || ''}
        totalEpisodesHint={editingEntry?.numEpisodes}
        thumbnail={editingEntry?.mainPicture?.large || editingEntry?.mainPicture?.medium}
        initialEntry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onUpdated={() => {
          const updatedCache = getMalListCache();
          if (updatedCache) {
            queryClient.setQueryData(MAL_QUERY_KEY, updatedCache);
          }
          setDataRevision((r) => r + 1);
        }}
      />

      {/* MAL Settings Modal */}
      <MalSettingsModal
        isVisible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onLoggedOut={() => {
          queryClient.removeQueries({ queryKey: MAL_QUERY_KEY });
          setAuthStatus(MalAuthService.getStatus());
          setDataRevision((r) => r + 1);
        }}
        onSettingsChanged={() => setDataRevision((r) => r + 1)}
      />
    </View>
  );
}
