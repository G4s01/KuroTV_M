import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
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
import {
  AnimeHeaderBackdrop,
  AnimeSynopsis,
  AnimeInfoTable,
  AnimeControlsBar,
} from '@/components/anime';
import type { Episode, VideoServer } from '@/types';

export default function AnimeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
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

  const navigateToEpisode = (episode: Episode) => {
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
        totalEpisodes: String(anime.totalEpisodes ?? (episodes.length || '')),
      },
    });
  };

  const handleRestartPlayback = () => {
    if (!anime || !episodes || episodes.length === 0) return;
    const firstEp = episodes[0];
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
        totalEpisodes: String(anime.totalEpisodes ?? (episodes.length || '')),
      },
    });
  };

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

  const firstUnwatched = React.useMemo(() => {
    return currentProgressList.find((p) => !p.isCompleted)?.episode || episodes[0];
  }, [currentProgressList, episodes]);

  const servers: VideoServer[] = anime?.servers || anime?.serverList || [
    { id: '9', name: 'AnimeWorld Server (Default)' },
  ];

  const renderHeader = () => {
    if (!anime) return null;
    const hasStartedWatching = currentProgressList.some((p) => p.progress > 0 && !p.isCompleted);
    return (
      <View style={[styles.headerWrapper, { backgroundColor: theme.colors.background }]}>
        <AnimeHeaderBackdrop
          anime={anime}
          windowWidth={windowWidth}
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
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Back & Share Floating Header */}
      <View style={[styles.topNav, { top: Math.max(insets.top + 8, 12) }]}>
        <Pressable
          style={styles.navIconBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="TORNA INDIETRO"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.navRight}>
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
      ) : (
        <FlashList
          key={viewMode}
          data={displayedEpisodes}
          numColumns={viewMode === 'grid' ? 4 : 1}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.listContentContainer, { paddingBottom: 48 + Math.max(0, insets.bottom) }]}
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={({ item }) => {
            const prog = progressMap.get(item.number);
            return (
              <EpisodeItem
                episode={item}
                variant={viewMode}
                progressPercent={prog?.progress || 0}
                onPress={() => navigateToEpisode(item)}
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

      {/* Batch Bottom Sheet */}
      <BatchBottomSheet
        isVisible={isBatchSheetVisible}
        onClose={() => setIsBatchSheetVisible(false)}
        batches={batches}
        currentBatchId={activeBatchId}
        onSelectBatch={(bId) => setActiveBatchId(bId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    gap: 8,
  },
  navIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerWrapper: {
    backgroundColor: '#000000',
  },
  listContentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 40,
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
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorTitle: {
    color: oledTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
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
});
