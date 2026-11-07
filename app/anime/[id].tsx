import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { animeDetailQueryOptions } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { oledTheme } from '@/theme';
import { EpisodeItem } from '@/components/EpisodeItem';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import type { Episode, VideoServer } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKDROP_HEIGHT = 260;

export default function AnimeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Find next unwatched episode or episode 1
  const episodes: Episode[] = anime?.episodes || [];
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
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Backdrop Header */}
          <View style={styles.backdropWrapper}>
            <Image
              source={{ uri: anime.image || anime.thumbnail }}
              style={styles.backdrop}
              resizeMode="cover"
            />
            <View style={styles.backdropGradient} />
          </View>

          {/* Details Section */}
          <View style={styles.mainInfo}>
            <View style={styles.posterAndMeta}>
              <Image
                source={{ uri: anime.image || anime.thumbnail }}
                style={styles.poster}
                resizeMode="cover"
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
                <Text style={styles.sectionHeading}>Episodi ({episodes.length})</Text>
                <Text style={styles.serverCurrentText}>
                  Server: {servers.find((s) => s.id === selectedServerId)?.name || 'AnimeWorld'}
                </Text>
              </View>

              <Pressable
                style={styles.serverPickerBtn}
                onPress={() => setIsServerSheetVisible(true)}
              >
                <Ionicons name="server" size={16} color={oledTheme.colors.primary} />
                <Text style={styles.serverPickerBtnText}>Cambia Server</Text>
              </Pressable>
            </View>

            {/* Virtualized Episodes List */}
            <View style={styles.episodesListContainer}>
              <FlashList
                data={episodes}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const prog = currentProgressList.find((p) => p.episode.number === item.number);
                  return (
                    <EpisodeItem
                      episode={item}
                      progressPercent={prog?.progress || 0}
                      onPress={() => navigateToEpisode(item)}
                    />
                  );
                }}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Server Bottom Sheet */}
      <ServerBottomSheet
        isVisible={isServerSheetVisible}
        onClose={() => setIsServerSheetVisible(false)}
        servers={servers.map((s) => ({ id: s.id, name: s.name }))}
        currentServerId={selectedServerId}
        onSelectServer={(sId) => setSelectedServerId(sId)}
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
  scroll: {
    flex: 1,
  },
  backdropWrapper: {
    width: SCREEN_WIDTH,
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
    paddingBottom: 40,
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
    backgroundColor: '#111',
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
    marginBottom: 6,
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
    marginTop: 20,
    marginBottom: 12,
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
    paddingHorizontal: 12,
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
  episodesListContainer: {
    marginTop: 4,
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
