import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { homeQueryOptions, animeQueryKeys } from '@/services/queries';
import { AppStorage } from '@/services/storage';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { HomeScreenSkeleton } from '@/components/skeleton';
import type { AnimeItem, ContinueWatchingItem } from '@/types';

const HERO_HEIGHT = 280;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const { data: homeData, isLoading, isError, refetch, isRefetching } = useQuery(homeQueryOptions());
  const [continueWatching, setContinueWatching] = React.useState<ContinueWatchingItem[]>([]);
  const [itemToRemove, setItemToRemove] = React.useState<ContinueWatchingItem | null>(null);

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
      {/* App Bar */}
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
          onPress={() => router.push('/(tabs)/explore')}
          hitSlop={8}
          accessibilityLabel="CERCA ANIME"
        >
          <Ionicons name="search" size={20} color={theme.colors.text} />
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
                  <Pressable onPress={() => router.push('/(tabs)/explore')}>
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
