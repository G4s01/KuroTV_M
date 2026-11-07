import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { homeQueryOptions, animeQueryKeys } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { oledTheme } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import type { AnimeItem, ContinueWatchingItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: homeData, isLoading, isError, refetch, isRefetching } = useQuery(homeQueryOptions());
  const [continueWatching, setContinueWatching] = React.useState<ContinueWatchingItem[]>([]);

  React.useEffect(() => {
    const list = AppStorage.getContinueWatching();
    setContinueWatching(list);
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
      },
    });
  };

  const heroItem = homeData?.sliders?.[0] || homeData?.trending?.[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandPrefix}>KURO</Text>
          <Text style={styles.brandSuffix}>TV</Text>
          <View style={styles.mobileBadge}>
            <Text style={styles.mobileBadgeText}>MOBILE</Text>
          </View>
        </View>

        <Pressable
          style={styles.searchButton}
          onPress={() => router.push('/(tabs)/explore')}
          hitSlop={8}
          accessibilityLabel="Cerca anime"
        >
          <Ionicons name="search" size={20} color={oledTheme.colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={oledTheme.colors.primary}
            colors={[oledTheme.colors.primary]}
          />
        }
      >
        {isLoading && !homeData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={oledTheme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento catalogo...</Text>
          </View>
        ) : isError && !homeData ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={oledTheme.colors.error} />
            <Text style={styles.errorTitle}>Impossibile connettersi ad AnimeWorld</Text>
            <Text style={styles.errorSubtitle}>Verifica la connessione o cambia dominio nelle impostazioni</Text>
            <Pressable style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Riprova</Text>
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
                  resizeMode="cover"
                />
                <View style={styles.heroOverlay} />

                <View style={styles.heroContent}>
                  {heroItem.subOrDub && (
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>{heroItem.subOrDub}</Text>
                    </View>
                  )}
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {heroItem.title}
                  </Text>

                  <Pressable
                    style={styles.heroActionBtn}
                    onPress={() => navigateToAnime(heroItem.id, heroItem.title)}
                  >
                    <Ionicons name="play" size={16} color="#FFFFFF" />
                    <Text style={styles.heroActionBtnText}>Guarda Ora</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}

            {/* Continua a guardare */}
            {continueWatching.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Continua a guardare</Text>
                  <Text style={styles.sectionBadge}>{continueWatching.length}</Text>
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
                      <View style={styles.continueThumbWrapper}>
                        {item.thumbnail ? (
                          <Image
                            source={{ uri: item.thumbnail }}
                            style={styles.continueThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.continueThumb, styles.continueFallback]}>
                            <Ionicons name="film" size={24} color="#666" />
                          </View>
                        )}
                        <View style={styles.playOverlay}>
                          <Ionicons name="play-circle" size={32} color="#FFFFFF" />
                        </View>
                        <View style={styles.progressBarWrapper}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(100, item.percentage || 0)}%` },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.continueTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.continueSubtitle}>
                        Episodio {item.episodeNumber} ({item.percentage}%)
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
                  <Text style={styles.sectionTitle}>Ultime Uscite</Text>
                  <Pressable onPress={() => router.push('/(tabs)/explore')}>
                    <Text style={styles.seeAllText}>Vedi tutti</Text>
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
                  <Text style={styles.sectionTitle}>I Più Popolari</Text>
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
                  <Text style={styles.sectionTitle}>Nuove Aggiunte</Text>
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
    letterSpacing: -0.5,
  },
  brandSuffix: {
    color: oledTheme.colors.primary,
    fontSize: 20,
    fontWeight: '900',
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
  },
  errorSubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
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
  },
  heroContainer: {
    width: SCREEN_WIDTH,
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
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
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
  },
  sectionBadge: {
    backgroundColor: '#262626',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  seeAllText: {
    color: oledTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 6,
  },
  continueSubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
