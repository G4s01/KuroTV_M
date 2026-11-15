import React from 'react';
import {
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { animeDetailQueryOptions } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { scraperConfig } from '@/services/scraper/config';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { EpisodeItem } from '@/components/EpisodeItem';
import { AnimeDetailScreenSkeleton } from '@/components/skeleton';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import { BatchBottomSheet, type EpisodeBatch } from '@/components/BatchBottomSheet';
import { DownloadService, type DownloadStatus } from '@/services/downloads';
import {
  AnimeHeaderBackdrop,
  AnimeSynopsis,
  AnimeInfoTable,
  AnimeControlsBar,
  DownloadOptionsSheet,
} from '@/components/anime';
import { useResponsiveLayout } from '@/hooks';
import type { Episode, VideoServer } from '@/types';
import { animeDetailStyles as styles } from '@/components/anime/anime.styles';

export default function AnimeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const {
    isMasterDetail,
    leftMasterWidth,
    rightDetailWidth,
    episodeColumns,
    portraitEpisodeColumns,
    isTablet,
  } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string; title?: string }>();

  const animeId = Array.isArray(id) ? id[0] : id || '';

  const { data: anime, isLoading, isError, refetch } = useQuery(
    animeDetailQueryOptions(animeId, queryClient)
  );

  const [isFavorite, setIsFavorite] = React.useState(false);
  const [selectedServerId, setSelectedServerId] = React.useState('9'); // Default AnimeWorld server
  const [isServerSheetVisible, setIsServerSheetVisible] = React.useState(false);
  const [isBatchSheetVisible, setIsBatchSheetVisible] = React.useState(false);
  const [isDownloadSheetVisible, setIsDownloadSheetVisible] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [activeBatchId, setActiveBatchId] = React.useState<string>('batch-0');
  const [focusTick, setFocusTick] = React.useState(0);

  React.useEffect(() => {
    setActiveBatchId('batch-0');
  }, [animeId]);

  useFocusEffect(
    React.useCallback(() => {
      if (animeId) {
        setIsFavorite(AppStorage.isFavorite(animeId));
      }
      setFocusTick((t) => t + 1);
    }, [animeId])
  );

  const toggleFavorite = () => {
    if (!anime) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const newState = AppStorage.toggleFavorite(anime);
    setIsFavorite(newState);
  };

  const handleShare = async () => {
    if (!anime) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const shareUrl = anime.link || `${scraperConfig.getBaseUrl()}/play/${anime.id}`;
      await Share.share({
        message: `GUARDA ${anime.title.toUpperCase()}: ${shareUrl}`,
      });
    } catch {
      // Ignore
    }
  };

  const navigateToEpisode = React.useCallback(
    (episode: Episode) => {
      if (!anime) return;
      Haptics.selectionAsync().catch(() => {});
      const savedProg = AppStorage.getWatchProgress(anime.id, episode.number);
      router.push({
        pathname: '/player/[id]',
        params: {
          id: episode.id,
          animeId: anime.id,
          episodeNumber: String(episode.number),
          episodeDataId: episode.dataId || '',
          animeTitle: anime.title,
          serverId: selectedServerId,
          thumbnail: anime.image || anime.thumbnail || '',
          position: String(savedProg && !savedProg.isCompleted ? savedProg.currentTime : 0),
          totalEpisodes: String(anime.totalEpisodes ?? (anime.episodes?.length || '')),
        },
      });
    },
    [anime, selectedServerId, router]
  );

  const handleRestartPlayback = React.useCallback(() => {
    const eps = anime?.episodes || [];
    if (!anime || eps.length === 0) return;
    const firstEp = eps[0];
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/player/[id]',
      params: {
        id: firstEp.id,
        animeId: anime.id,
        episodeNumber: String(firstEp.number),
        episodeDataId: firstEp.dataId || '',
        animeTitle: anime.title,
        serverId: selectedServerId,
        thumbnail: anime.image || anime.thumbnail || '',
        position: '0',
        totalEpisodes: String(anime.totalEpisodes ?? (eps.length || '')),
      },
    });
  }, [anime, selectedServerId, router]);

  const episodes: Episode[] = anime?.episodes || [];

  // Dynamic batch size: 50 for large anime (+500 episodes) to optimize memory and rendering, 25 for shorter series
  const batchSize = React.useMemo(() => {
    return episodes.length > 500 ? 50 : 25;
  }, [episodes.length]);

  // Generate batches (e.g. 1-25 or 1-50, etc.)
  const batches: EpisodeBatch[] = React.useMemo(() => {
    if (episodes.length <= batchSize) {
      const firstNum = typeof episodes[0]?.number === 'number' ? episodes[0].number : 1;
      const lastNum =
        typeof episodes[episodes.length - 1]?.number === 'number'
          ? episodes[episodes.length - 1].number
          : episodes.length || 1;
      return [
        {
          id: 'batch-0',
          label: `EP. ${firstNum} - ${lastNum}`,
          start: firstNum,
          end: lastNum,
          startIndex: 0,
          endIndex: episodes.length,
        },
      ];
    }
    const list: EpisodeBatch[] = [];
    for (let i = 0; i < episodes.length; i += batchSize) {
      const startEp = typeof episodes[i]?.number === 'number' ? episodes[i].number : i + 1;
      const endIdx = Math.min(i + batchSize - 1, episodes.length - 1);
      const endEp = typeof episodes[endIdx]?.number === 'number' ? episodes[endIdx].number : endIdx + 1;
      list.push({
        id: `batch-${i}`,
        label: `EP. ${startEp} - ${endEp}`,
        start: startEp,
        end: endEp,
        startIndex: i,
        endIndex: endIdx + 1,
      });
    }
    return list;
  }, [episodes, batchSize]);

  // Filter episodes by active batch
  const currentBatch = batches.find((b) => b.id === activeBatchId) || batches[0];
  const displayedEpisodes = React.useMemo(() => {
    if (!currentBatch || batches.length <= 1) return episodes;
    if (typeof currentBatch.startIndex === 'number' && typeof currentBatch.endIndex === 'number') {
      return episodes.slice(currentBatch.startIndex, currentBatch.endIndex);
    }
    return episodes.filter(
      (ep) => ep.number >= currentBatch.start && ep.number <= currentBatch.end
    );
  }, [episodes, currentBatch, batches.length]);



  const currentProgressList = React.useMemo(() => {
    return episodes.map((ep) => {
      const prog = AppStorage.getWatchProgress(animeId, ep.number);
      return {
        episode: ep,
        progress: prog?.percentage || 0,
        isCompleted: Boolean(prog?.isCompleted || (prog?.percentage || 0) >= 90),
      };
    });
  }, [episodes, animeId, focusTick]);

  const progressMap = React.useMemo(() => {
    const map = new Map<number, { progress: number; isCompleted: boolean }>();
    for (const item of currentProgressList) {
      map.set(item.episode.number, {
        progress: item.progress,
        isCompleted: item.isCompleted,
      });
    }
    return map;
  }, [currentProgressList]);

  // Download status map for all episodes of this anime
  const [downloadMap, setDownloadMap] = React.useState<Map<number, DownloadStatus>>(() => {
    const map = new Map<number, DownloadStatus>();
    const downloads = DownloadService.getAllDownloads();
    for (const d of downloads) {
      if (d.animeId === animeId) {
        map.set(d.episodeNumber, d.status);
      }
    }
    return map;
  });

  React.useEffect(() => {
    const updateMap = () => {
      const next = new Map<number, DownloadStatus>();
      const downloads = DownloadService.getAllDownloads();
      for (const d of downloads) {
        if (d.animeId === animeId) {
          next.set(d.episodeNumber, d.status);
        }
      }
      setDownloadMap((prev) => {
        if (prev.size === next.size) {
          let identical = true;
          for (const [k, v] of next) {
            if (prev.get(k) !== v) {
              identical = false;
              break;
            }
          }
          if (identical) return prev;
        }
        return next;
      });
    };

    const unsubList = DownloadService.addListListener(updateMap);
    const unsubProg = DownloadService.addProgressListener((item) => {
      if (item.animeId === animeId) {
        // Avoid re-rendering the entire detail screen on chunk ticks when episode status hasn't changed
        setDownloadMap((prev) => {
          if (prev.get(item.episodeNumber) === item.status) {
            return prev;
          }
          const next = new Map(prev);
          next.set(item.episodeNumber, item.status);
          return next;
        });
      }
    });

    return () => {
      unsubList();
      unsubProg();
    };
  }, [animeId]);

  const handleDownloadSingleEpisode = React.useCallback(
    (ep: Episode) => {
      const currentStatus = DownloadService.getEpisodeDownloadStatus(animeId, ep.number);
      if (currentStatus === 'completed') {
        Haptics.selectionAsync().catch(() => {});
        return;
      }
      if (currentStatus === 'downloading' || currentStatus === 'queued' || currentStatus === 'paused') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        DownloadService.cancelDownload(`${animeId}-ep-${ep.number}`);
        return;
      }
      DownloadService.startDownload(
        { id: animeId, title: anime?.title || 'Anime', thumbnail: anime?.thumbnail || anime?.image },
        ep
      );
    },
    [animeId, anime]
  );

  const handleDownloadBatches = React.useCallback(
    (selectedBatches: EpisodeBatch[]) => {
      setIsDownloadSheetVisible(false);
      if (selectedBatches.length === 0) return;
      const batchEps = episodes.filter((ep) =>
        selectedBatches.some((b) => ep.number >= b.start && ep.number <= b.end)
      );
      if (batchEps.length === 0) return;
      DownloadService.startBatchDownload(
        { id: animeId, title: anime?.title || 'Anime', thumbnail: anime?.thumbnail || anime?.image },
        batchEps
      );
    },
    [episodes, animeId, anime]
  );

  const handleDownloadAll = React.useCallback(() => {
    setIsDownloadSheetVisible(false);
    if (episodes.length === 0) return;
    DownloadService.startBatchDownload(
      { id: animeId, title: anime?.title || 'Anime', thumbnail: anime?.thumbnail || anime?.image },
      episodes
    );
  }, [episodes, animeId, anime]);

  const handleDownloadRange = React.useCallback(
    (startEpisode: number, endEpisode: number) => {
      setIsDownloadSheetVisible(false);
      const from = Math.min(startEpisode, endEpisode);
      const to = Math.max(startEpisode, endEpisode);
      const rangeEps = episodes.filter(
        (ep) => ep.number >= from && ep.number <= to
      );
      if (rangeEps.length === 0) return;
      DownloadService.startBatchDownload(
        { id: animeId, title: anime?.title || 'Anime', thumbnail: anime?.thumbnail || anime?.image },
        rangeEps
      );
    },
    [episodes, animeId, anime]
  );

  const firstUnwatched = React.useMemo(() => {
    return currentProgressList.find((p) => !p.isCompleted)?.episode || episodes[0];
  }, [currentProgressList, episodes]);

  const servers: VideoServer[] = anime?.servers || anime?.serverList || [
    { id: '9', name: 'AnimeWorld Server (Default)' },
  ];

  const hasStartedWatching = React.useMemo(() => {
    return currentProgressList.some((p) => p.progress > 0 && !p.isCompleted);
  }, [currentProgressList]);

  const portraitHeaderElement = React.useMemo(() => {
    if (!anime) return null;
    return (
      <View
        style={[
          styles.headerWrapper,
          { backgroundColor: theme.colors.background },
          isTablet && styles.tabletCenteredContainer,
        ]}
      >
        <AnimeHeaderBackdrop
          anime={anime}
          windowWidth={isTablet ? Math.min(windowWidth, 960) : windowWidth}
          theme={theme}
          firstUnwatched={firstUnwatched}
          hasStartedWatching={hasStartedWatching}
          onPlayEpisode={navigateToEpisode}
          onRestartPlayback={episodes.length > 0 ? handleRestartPlayback : undefined}
        />

        <AnimeSynopsis
          synopsis={anime.synopsis}
          description={anime.description}
          theme={theme}
        />

        <AnimeInfoTable
          anime={anime}
          theme={theme}
        />

        <AnimeControlsBar
          totalEpisodes={episodes.length}
          hasBatches={batches.length > 1}
          currentBatchLabel={currentBatch?.label || 'Batch'}
          viewMode={viewMode}
          theme={theme}
          onOpenBatchSheet={() => setIsBatchSheetVisible(true)}
          onChangeViewMode={(mode) => setViewMode(mode)}
        />
      </View>
    );
  }, [
    anime,
    theme,
    windowWidth,
    isTablet,
    firstUnwatched,
    hasStartedWatching,
    navigateToEpisode,
    episodes.length,
    handleRestartPlayback,
    batches.length,
    currentBatch?.label,
    viewMode,
  ]);

  const tabletDetailHeaderElement = React.useMemo(() => {
    if (!anime) return null;
    return (
      <View style={[styles.rightDetailHeader, { paddingTop: Math.max(insets.top + 60, 68) }]}>
        <AnimeSynopsis
          synopsis={anime.synopsis}
          description={anime.description}
          theme={theme}
        />
        <AnimeControlsBar
          totalEpisodes={episodes.length}
          hasBatches={batches.length > 1}
          currentBatchLabel={currentBatch?.label || 'Batch'}
          viewMode={viewMode}
          theme={theme}
          onOpenBatchSheet={() => setIsBatchSheetVisible(true)}
          onChangeViewMode={(mode) => setViewMode(mode)}
        />
      </View>
    );
  }, [
    anime,
    insets.top,
    theme,
    episodes.length,
    batches.length,
    currentBatch?.label,
    viewMode,
  ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Back & Share Floating Header */}
      <View style={[styles.topNav, { top: Math.max(insets.top + 8, 12) }]}>
        <Pressable
          style={styles.navIconBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          hitSlop={8}
          accessibilityLabel="TORNA INDIETRO"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.navRight}>
          <Pressable
            style={[
              styles.navIconBtn,
              episodes.length === 0 && { opacity: 0.45 },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setIsDownloadSheetVisible(true);
            }}
            disabled={episodes.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="SCARICA EPISODI"
          >
            <Ionicons name="cloud-download-outline" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={styles.navIconBtn}
            onPress={toggleFavorite}
            hitSlop={8}
            accessibilityLabel="PREFERITI"
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? theme.colors.primary : '#FFFFFF'}
            />
          </Pressable>
          <Pressable
            style={styles.navIconBtn}
            onPress={handleShare}
            hitSlop={8}
            accessibilityLabel="CONDIVIDI"
          >
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <AnimeDetailScreenSkeleton />
      ) : isError || !anime ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={oledTheme.colors.error} />
          <Text style={styles.errorTitle}>IMPOSSIBILE CARICARE L&apos;ANIME</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.retryBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>RIPROVA</Text>
          </Pressable>
        </View>
      ) : isMasterDetail ? (
        <View style={styles.masterDetailContainer}>
          {/* Left Master Column: Poster, Titles, Action Buttons, Metadata Table */}
          <ScrollView
            style={[styles.leftMasterColumn, { width: leftMasterWidth }]}
            contentContainerStyle={[
              styles.leftMasterScrollContent,
              {
                paddingTop: Math.max(insets.top + 60, 68),
                paddingBottom: 48 + Math.max(0, insets.bottom),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <AnimeHeaderBackdrop
              anime={anime}
              windowWidth={leftMasterWidth}
              theme={theme}
              firstUnwatched={firstUnwatched}
              hasStartedWatching={hasStartedWatching}
              onPlayEpisode={navigateToEpisode}
              onRestartPlayback={episodes.length > 0 ? handleRestartPlayback : undefined}
            />
            <AnimeInfoTable anime={anime} theme={theme} />
          </ScrollView>

          {/* Vertical Divider */}
          <View style={[styles.masterDetailDivider, { backgroundColor: theme.colors.border }]} />

          {/* Right Detail Column: Synopsis, Controls & Episode Grid */}
          <View style={[styles.rightDetailColumn, { width: rightDetailWidth }]}>
            <FlashList
              key={`master-detail-episodes-${viewMode}-${episodeColumns}`}
              data={displayedEpisodes}
              numColumns={viewMode === 'grid' ? episodeColumns : 1}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={tabletDetailHeaderElement}
              contentContainerStyle={[
                styles.rightDetailListContent,
                { paddingBottom: 48 + Math.max(0, insets.bottom) },
              ]}
              maintainVisibleContentPosition={{ disabled: true }}
              renderItem={({ item }) => {
                const prog = progressMap.get(item.number);
                return (
                  <EpisodeItem
                    episode={item}
                    variant={viewMode}
                    progressPercent={prog?.progress || 0}
                    downloadStatus={downloadMap.get(item.number) || 'none'}
                    onPress={() => navigateToEpisode(item)}
                    onDownloadPress={() => handleDownloadSingleEpisode(item)}
                  />
                );
              }}
            />
          </View>
        </View>
      ) : (
        <FlashList
          key={`portrait-episodes-${viewMode}-${portraitEpisodeColumns}`}
          data={displayedEpisodes}
          numColumns={viewMode === 'grid' ? portraitEpisodeColumns : 1}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={portraitHeaderElement}
          contentContainerStyle={[
            styles.listContentContainer,
            isTablet && styles.tabletCenteredContainer,
            { paddingBottom: 48 + Math.max(0, insets.bottom) },
          ]}
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={({ item }) => {
            const prog = progressMap.get(item.number);
            return (
              <EpisodeItem
                episode={item}
                variant={viewMode}
                progressPercent={prog?.progress || 0}
                downloadStatus={downloadMap.get(item.number) || 'none'}
                onPress={() => navigateToEpisode(item)}
                onDownloadPress={() => handleDownloadSingleEpisode(item)}
              />
            );
          }}
        />
      )}

      {/* Server Bottom Sheet */}
      <ServerBottomSheet
        isVisible={isServerSheetVisible}
        onClose={() => setIsServerSheetVisible(false)}
        servers={servers.map((s) => ({ id: s.id, name: s.name }))}
        currentServerId={selectedServerId}
        onSelectServer={(sId) => setSelectedServerId(sId)}
      />

      {/* Batch Bottom Sheet (visualizzazione intervallo episodi) */}
      <BatchBottomSheet
        isVisible={isBatchSheetVisible}
        onClose={() => setIsBatchSheetVisible(false)}
        batches={batches}
        currentBatchId={activeBatchId}
        onSelectBatch={(bId) => setActiveBatchId(bId)}
      />

      {/* Download Options Sheet (pre-menù Tutti / Batch multi-selezione / Intervallo) */}
      <DownloadOptionsSheet
        isVisible={isDownloadSheetVisible}
        onClose={() => setIsDownloadSheetVisible(false)}
        episodes={episodes}
        batches={batches}
        currentBatchId={activeBatchId}
        onDownloadAll={handleDownloadAll}
        onDownloadBatches={handleDownloadBatches}
        onDownloadRange={handleDownloadRange}
      />
    </View>
  );
}
