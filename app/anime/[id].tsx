import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { animeDetailQueryOptions } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { oledTheme } from '@/theme';
import { EpisodeItem } from '@/components/EpisodeItem';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import { BatchBottomSheet, type EpisodeBatch, type RelatedSeason } from '@/components/BatchBottomSheet';
import type { Episode, VideoServer } from '@/types';

const BACKDROP_HEIGHT = 260;
const BATCH_SIZE = 25;

export default function AnimeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string; title?: string }>();

  const animeId = Array.isArray(id) ? id[0] : id || '';

  const { data: anime, isLoading, isError, refetch } = useQuery(
    animeDetailQueryOptions(animeId, queryClient)
  );

  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = React.useState(false);
  const [selectedServerId, setSelectedServerId] = React.useState('9'); // Default AnimeWorld server
  const [isServerSheetVisible, setIsServerSheetVisible] = React.useState(false);
  const [isBatchSheetVisible, setIsBatchSheetVisible] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [activeBatchId, setActiveBatchId] = React.useState<string>('batch-0');

  React.useEffect(() => {
    if (animeId) {
      setIsFavorite(AppStorage.isFavorite(animeId));
    }
  }, [animeId]);

  const toggleFavorite = () => {
    if (!anime) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const newState = AppStorage.toggleFavorite(anime);
    setIsFavorite(newState);
  };

  const handleShare = async () => {
    if (!anime) return;
    try {
      await Share.share({
        message: `Guarda ${anime.title} su KuroTV! https://www.animeworld.${AppStorage.getTld()}/play/${anime.id}`,
      });
    } catch {
      // Ignore
    }
  };

  const navigateToEpisode = (episode: Episode) => {
    if (!anime) return;
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/player/[id]',
      params: {
        id: episode.id,
        animeId: anime.id,
        episodeNumber: String(episode.number),
        episodeDataId: episode.dataId || '',
        animeTitle: anime.title,
        serverId: selectedServerId,
      },
    });
  };

  const episodes: Episode[] = anime?.episodes || [];

  // Generate batches (e.g. 1-25, 26-50, etc.)
  const batches: EpisodeBatch[] = React.useMemo(() => {
    if (episodes.length <= BATCH_SIZE) {
      return [{ id: 'batch-0', label: `Ep. 1 - ${episodes.length || 1}`, start: 1, end: episodes.length || 1 }];
    }
    const list: EpisodeBatch[] = [];
    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const startEp = episodes[i]?.number || i + 1;
      const endIdx = Math.min(i + BATCH_SIZE - 1, episodes.length - 1);
      const endEp = episodes[endIdx]?.number || endIdx + 1;
      list.push({
        id: `batch-${i}`,
        label: `Ep. ${startEp} - ${endEp}`,
        start: startEp,
        end: endEp,
      });
    }
    return list;
  }, [episodes]);

  // Filter episodes by active batch
  const currentBatch = batches.find((b) => b.id === activeBatchId) || batches[0];
  const displayedEpisodes = React.useMemo(() => {
    if (!currentBatch || batches.length <= 1) return episodes;
    return episodes.filter(
      (ep) => ep.number >= currentBatch.start && ep.number <= currentBatch.end
    );
  }, [episodes, currentBatch, batches.length]);

  // Related seasons for season selector
  const relatedSeasons: RelatedSeason[] = React.useMemo(() => {
    const list: RelatedSeason[] = [];
    if (anime?.related && Array.isArray(anime.related)) {
      anime.related.forEach((rel) => {
        if (rel.id && rel.title) {
          list.push({ id: rel.id, title: rel.title });
        }
      });
    }
    return list;
  }, [anime]);

  const currentProgressList = episodes.map((ep) => {
    const prog = AppStorage.getWatchProgress(animeId, ep.number);
    return {
      episode: ep,
      progress: prog?.percentage || 0,
      isCompleted: Boolean(prog?.isCompleted || (prog?.percentage || 0) >= 90),
    };
  });

  const firstUnwatched = currentProgressList.find((p) => !p.isCompleted)?.episode || episodes[0];

  const servers: VideoServer[] = anime?.servers || anime?.serverList || [
    { id: '9', name: 'AnimeWorld Server (Default)' },
  ];

  const renderHeader = () => {
    if (!anime) return null;
    return (
      <View style={styles.headerWrapper}>
        {/* Backdrop Header */}
        <View style={[styles.backdropWrapper, { width: windowWidth }]}>
          <Image
            source={{ uri: anime.image || anime.thumbnail }}
            style={styles.backdrop}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.backdropGradient} />
        </View>

        {/* Details Section */}
        <View style={styles.mainInfo}>
          <View style={styles.posterAndMeta}>
            <Image
              source={{ uri: anime.image || anime.thumbnail }}
              style={styles.poster}
              contentFit="cover"
              transition={300}
            />

            <View style={styles.metaRight}>
              <Text style={styles.title} numberOfLines={3}>
                {anime.title}
              </Text>

              <View style={styles.badgeRow}>
                {anime.subOrDub && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{anime.subOrDub}</Text>
                  </View>
                )}
                {anime.state && (
                  <View style={styles.badgeSubtle}>
                    <Text style={styles.badgeSubtleText}>{anime.state}</Text>
                  </View>
                )}
                {anime.score ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={styles.ratingText}>{anime.score}</Text>
                  </View>
                ) : null}
              </View>

              {anime.genres && anime.genres.length > 0 && (
                <Text style={styles.genresText} numberOfLines={2}>
                  {anime.genres.join(' • ')}
                </Text>
              )}
            </View>
          </View>

          {/* Primary Action Button */}
          {firstUnwatched && (
            <Pressable
              style={styles.playActionBtn}
              onPress={() => navigateToEpisode(firstUnwatched)}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.playActionText}>
                {currentProgressList.some((p) => p.progress > 0 && !p.isCompleted)
                  ? `Riprendi Ep. ${firstUnwatched.number}`
                  : `Inizia Ep. ${firstUnwatched.number}`}
              </Text>
            </Pressable>
          )}

          {/* Synopsis */}
          {(anime.synopsis || anime.description) ? (
            <View style={styles.synopsisContainer}>
              <Text style={styles.sectionHeading}>Trama</Text>
              <Text
                style={styles.synopsis}
                numberOfLines={isSynopsisExpanded ? undefined : 3}
              >
                {anime.synopsis || anime.description}
              </Text>
              <Pressable
                onPress={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                hitSlop={8}
              >
                <Text style={styles.readMore}>
                  {isSynopsisExpanded ? 'Mostra meno' : 'Leggi tutto'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Server Selector Bar */}
          <View style={styles.serverRow}>
            <View>
              <Text style={styles.sectionHeading}>Server Video</Text>
              <Text style={styles.serverCurrentText}>
                {servers.find((s) => s.id === selectedServerId)?.name || 'AnimeWorld'}
              </Text>
            </View>

            <Pressable
              style={styles.serverPickerBtn}
              onPress={() => setIsServerSheetVisible(true)}
            >
              <Ionicons name="server" size={16} color={oledTheme.colors.primary} />
              <Text style={styles.serverPickerBtnText}>Cambia</Text>
            </Pressable>
          </View>

          {/* Season & Batch / Grid Controls */}
          <View style={styles.controlsRow}>
            <View style={styles.controlsLeft}>
              <Text style={styles.sectionHeading}>
                Puntate ({episodes.length})
              </Text>
              {batches.length > 1 && (
                <Pressable
                  style={styles.batchSelectorBtn}
                  onPress={() => setIsBatchSheetVisible(true)}
                >
                  <Text style={styles.batchSelectorBtnText}>{currentBatch?.label || 'Batch'}</Text>
                  <Ionicons name="chevron-down" size={14} color={oledTheme.colors.primary} />
                </Pressable>
              )}
            </View>

            <View style={styles.viewModeToggle}>
              <Pressable
                style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode('grid');
                }}
                hitSlop={6}
                accessibilityLabel="Vista a griglia"
              >
                <Ionicons
                  name="grid"
                  size={16}
                  color={viewMode === 'grid' ? '#FFFFFF' : oledTheme.colors.textMuted}
                />
              </Pressable>

              <Pressable
                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode('list');
                }}
                hitSlop={6}
                accessibilityLabel="Vista a lista"
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={viewMode === 'list' ? '#FFFFFF' : oledTheme.colors.textMuted}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back & Share Floating Header */}
      <View style={styles.topNav}>
        <Pressable
          style={styles.navIconBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Torna indietro"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.navRight}>
          <Pressable
            style={styles.navIconBtn}
            onPress={toggleFavorite}
            hitSlop={8}
            accessibilityLabel="Preferiti"
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? oledTheme.colors.primary : '#FFFFFF'}
            />
          </Pressable>
          <Pressable
            style={styles.navIconBtn}
            onPress={handleShare}
            hitSlop={8}
            accessibilityLabel="Condividi"
          >
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={oledTheme.colors.primary} />
          <Text style={styles.loadingText}>Caricamento dettagli anime...</Text>
        </View>
      ) : isError || !anime ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={oledTheme.colors.error} />
          <Text style={styles.errorTitle}>Impossibile caricare l&apos;anime</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Riprova</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          key={viewMode}
          data={displayedEpisodes}
          numColumns={viewMode === 'grid' ? 4 : 1}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContentContainer}
          renderItem={({ item }) => {
            const prog = currentProgressList.find((p) => p.episode.number === item.number);
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

      {/* Batch & Season Bottom Sheet */}
      <BatchBottomSheet
        isVisible={isBatchSheetVisible}
        onClose={() => setIsBatchSheetVisible(false)}
        batches={batches}
        currentBatchId={activeBatchId}
        onSelectBatch={(bId) => setActiveBatchId(bId)}
        seasons={relatedSeasons}
        currentSeasonId={animeId}
        onSelectSeason={(seasonId) => {
          router.push({
            pathname: '/anime/[id]',
            params: { id: seasonId },
          });
        }}
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
    top: 40,
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
  backdropWrapper: {
    height: BACKDROP_HEIGHT,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mainInfo: {
    marginTop: -40,
    borderTopLeftRadius: oledTheme.radius.xl,
    borderTopRightRadius: oledTheme.radius.xl,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  posterAndMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  poster: {
    width: 110,
    height: 160,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
  },
  metaRight: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgeSubtle: {
    backgroundColor: '#262626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSubtleText: {
    color: '#D4D4D4',
    fontSize: 10,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  genresText: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  playActionBtn: {
    backgroundColor: oledTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: oledTheme.radius.full,
    marginTop: 18,
  },
  playActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  synopsisContainer: {
    marginTop: 20,
    paddingBottom: 8,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  synopsis: {
    color: oledTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  readMore: {
    color: oledTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  serverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  serverCurrentText: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  serverPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#171717',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    borderColor: '#262626',
    minHeight: 44,
  },
  serverPickerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batchSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    minHeight: 36,
  },
  batchSelectorBtnText: {
    color: oledTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderRadius: oledTheme.radius.sm,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 2,
  },
  toggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: oledTheme.colors.primary,
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
    fontSize: 14,
  },
  errorTitle: {
    color: oledTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 14,
  },
});
