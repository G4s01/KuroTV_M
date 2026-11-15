import React from 'react';
import {
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { scheduleQueryOptions } from '@/services/queries';
import { useTheme, getContrastTextColor } from '@/theme';
import { ScheduleScreenSkeleton } from '@/components/skeleton';
import { useResponsiveLayout } from '@/hooks';
import { exploreStyles as styles } from '@/components/explore/explore.styles';

export default function ExploreScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { theme } = useTheme();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const {
    data: scheduleData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery(scheduleQueryOptions());

  // Active selected day: 'mon' | 'tue' | ...
  const [selectedDayId, setSelectedDayId] = React.useState<string>('');

  // Automatically select today when schedule data loads
  React.useEffect(() => {
    if (scheduleData?.days && scheduleData.days.length > 0) {
      setSelectedDayId((prev) => {
        if (prev && scheduleData.days.some((d) => d.dayId === prev)) return prev;
        const todayDay = scheduleData.days.find((d) => d.isToday);
        return todayDay ? todayDay.dayId : scheduleData.days[0].dayId;
      });
    }
  }, [scheduleData]);

  // Proactive image prefetching of hero and initial releases
  React.useEffect(() => {
    if (scheduleData?.days) {
      const urls: string[] = [];
      if (scheduleData.hero?.poster) urls.push(scheduleData.hero.poster);
      for (const d of scheduleData.days) {
        for (const it of d.items.slice(0, 4)) {
          if (it.poster) urls.push(it.poster);
        }
      }
      if (urls.length > 0) {
        Image.prefetch(urls.slice(0, 16)).catch(() => {});
      }
    }
  }, [scheduleData]);

  const navigateToAnime = (animeId: string, title?: string) => {
    if (!animeId) return;
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/anime/[id]',
      params: { id: animeId, title: title || '' },
    });
  };

  const handleSelectDay = (dayId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedDayId(dayId);
  };

  const onRefresh = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refetch();
  }, [refetch]);

  const activeDay =
    scheduleData?.days?.find((d) => d.dayId === selectedDayId) ||
    scheduleData?.days?.[0];
  const showHero =
    Boolean(scheduleData?.hero) &&
    Boolean(activeDay?.isToday || !activeDay);

  const heroItem = scheduleData?.hero;

  useFocusEffect(
    React.useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          (navigation as any).navigate('index');
          router.replace('/(tabs)');
        }
        return true;
      });
      return () => backSub.remove();
    }, [router, navigation])
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* App Bar */}
      <View
        style={[
          styles.appBar,
          { borderBottomColor: theme.colors.border },
          isTablet && { maxWidth: 960, width: '100%', alignSelf: 'center' },
        ]}
      >
        <View style={styles.appBarHeader}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (router.canGoBack()) {
                router.back();
              } else {
                (navigation as any).navigate('index');
                router.replace('/(tabs)');
              }
            }}
            hitSlop={10}
            style={styles.touchTarget}
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
            <View style={styles.titleRow}>
              <Ionicons name="calendar" size={16} color={theme.colors.primary} />
              <Text style={[styles.appBarTitle, { color: theme.colors.text }]} numberOfLines={1}>
                PALINSESTO
              </Text>
            </View>
            {scheduleData?.weekLabel ? (
              <Text
                style={[styles.weekSubtitle, styles.weekLabel, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {scheduleData.weekLabel.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {isLoading && !scheduleData ? (
        <ScheduleScreenSkeleton />
      ) : isError && !scheduleData ? (
        <View style={styles.centerContainer}>
          <View style={[styles.errorIconCircle, { backgroundColor: `${theme.colors.error || '#EF4444'}18` }]}>
            <Ionicons name="alert-circle-outline" size={44} color={theme.colors.error || '#EF4444'} />
          </View>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            IMPOSSIBILE CARICARE IL PALINSESTO
          </Text>
          <Text style={[styles.errorSubtitle, { color: theme.colors.textSecondary }]}>
            VERIFICA LA CONNESSIONE O LA SORGENTE E RIPROVA.
          </Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="RIPROVA"
          >
            <Ionicons name="refresh" size={16} color={primaryContrast} />
            <Text style={[styles.retryBtnText, { color: primaryContrast }]}>RIPROVA</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {/* Day Selector Tabs (Horizontal Scroll) */}
          <View
            style={[
              styles.daySelectorWrapper,
              { borderBottomColor: theme.colors.border },
              isTablet && { maxWidth: 900, width: '100%', alignSelf: 'center' },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.daySelectorScroll}
            >
              {scheduleData?.days?.map((d) => {
                const isActive = selectedDayId === d.dayId;
                const tabContrast = isActive ? primaryContrast : theme.colors.text;
                const dayAbbr = d.dayName.slice(0, 3).toUpperCase();
                const dayNum = d.dayLabel.split(' ')[0] || '';
                const dayTitle = dayNum ? `${dayAbbr} ${dayNum}` : dayAbbr;

                return (
                  <Pressable
                    key={d.dayId}
                    style={[
                      styles.dayTabBtn,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleSelectDay(d.dayId)}
                    accessibilityRole="tab"
                    accessibilityLabel={`${dayTitle}${d.isToday ? ' (Oggi)' : ''}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.dayTabLabel, { color: tabContrast }]}>
                      {dayTitle}
                    </Text>
                    {d.isToday && (
                      <View
                        style={[
                          styles.todayDot,
                          { backgroundColor: isActive ? tabContrast : theme.colors.primary },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* List of Scheduled Items for Active Day */}
          <FlashList
            data={activeDay?.items || []}
            keyExtractor={(item, index) => `${item.id}-${item.time}-${index}`}
              renderItem={({ item }) => {
                const isDone = Boolean(item.isDone);
                const isPause = Boolean(item.isPause);

                return (
                  <View style={styles.scheduleRowWrapper}>
                    {/* Time Column */}
                    <View style={styles.timeColumn}>
                      <View
                        style={[
                          styles.timeBadge,
                          {
                            backgroundColor: theme.colors.card,
                            borderColor: isDone
                              ? theme.colors.success
                              : isPause
                              ? '#F59E0B'
                              : theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeText,
                            {
                              color: isDone
                                ? theme.colors.success
                                : isPause
                                ? '#F59E0B'
                                : theme.colors.text,
                            },
                          ]}
                        >
                          {item.time || '--:--'}
                        </Text>
                      </View>
                      <View style={[styles.timelineTrack, { backgroundColor: theme.colors.border }]} />
                    </View>

                    {/* Anime Card */}
                    <Pressable
                      style={[
                        styles.itemCard,
                        styles.scheduleItemCard,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => navigateToAnime(item.id, item.title)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}, ${item.episode || ''}, alle ${item.time}`}
                    >
                      <Image
                        source={{ uri: item.poster }}
                        style={styles.itemPoster}
                        contentFit="cover"
                        transition={200}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.japaneseTitle ? (
                          <Text
                            style={[styles.itemJTitle, { color: theme.colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.japaneseTitle}
                          </Text>
                        ) : null}

                        <View style={styles.itemMetaRow}>
                          {item.episode ? (
                            <View
                              style={[
                                styles.episodeBadge,
                                {
                                  backgroundColor: theme.colors.card,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.episodeBadgeText,
                                  { color: theme.colors.textSecondary },
                                ]}
                              >
                                {item.episode.toUpperCase()}
                              </Text>
                            </View>
                          ) : null}

                          {item.status ? (
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: isDone
                                    ? `${theme.colors.success}18`
                                    : isPause
                                    ? '#F59E0B18'
                                    : `${theme.colors.primary}18`,
                                  borderColor: isDone
                                    ? theme.colors.success
                                    : isPause
                                    ? '#F59E0B'
                                    : theme.colors.primary,
                                },
                              ]}
                            >
                              {isDone && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={11}
                                  color={theme.colors.success}
                                  style={{ marginRight: 3 }}
                                />
                              )}
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  {
                                    color: isDone
                                      ? theme.colors.success
                                      : isPause
                                      ? '#F59E0B'
                                      : theme.colors.primary,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                );
              }}
              contentContainerStyle={[
                styles.listContent,
                isTablet && { maxWidth: 900, width: '100%', alignSelf: 'center' },
              ]}
              ListHeaderComponent={
                showHero && heroItem ? (
                  <Pressable
                    style={[
                      styles.heroBanner,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => navigateToAnime(heroItem.id, heroItem.title)}
                    accessibilityRole="button"
                    accessibilityLabel={`Prossima uscita: ${heroItem.title}`}
                  >
                    <Image
                      source={{ uri: heroItem.poster }}
                      style={styles.heroPoster}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={styles.heroInfo}>
                      <View style={styles.heroBadgeRow}>
                        <View
                          style={[
                            styles.heroBadge,
                            {
                              backgroundColor: theme.colors.primary,
                            },
                          ]}
                        >
                          <Ionicons
                            name="flame"
                            size={12}
                            color={primaryContrast}
                            style={{ marginRight: 3 }}
                          />
                          <Text style={[styles.heroBadgeText, { color: primaryContrast }]}>
                            PROSSIMA USCITA
                          </Text>
                        </View>
                        {heroItem.timeLabel ? (
                          <Text style={[styles.heroTimeLabel, { color: theme.colors.textMuted }]}>
                            {heroItem.timeLabel.toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.heroTitle, { color: theme.colors.text }]} numberOfLines={2}>
                        {heroItem.title}
                      </Text>
                      {heroItem.episode ? (
                        <Text style={[styles.heroEpisode, { color: theme.colors.primary }]}>
                          {heroItem.episode.toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="play-circle" size={26} color={theme.colors.primary} />
                  </Pressable>
                ) : null
              }
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    NESSUNA USCITA IN PROGRAMMA PER QUESTO GIORNO
                  </Text>
                </View>
              }
            />
        </View>
      )}
    </View>
  );
}
