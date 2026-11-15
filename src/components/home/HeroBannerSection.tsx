import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getContrastTextColor } from '@/theme';
import type { AnimeItem } from '@/types';
import { homeStyles as styles } from './home.styles';

export interface HeroBannerSectionProps {
  recommendedList: AnimeItem[];
  focusedItem?: AnimeItem;
  safeFocusedIndex: number;
  contentWidth: number;
  heroHeight: number;
  heroScrollRef: React.RefObject<any>;
  isHeroPlayLoading: boolean;
  onPlayHero: (item: AnimeItem) => void;
  onNavigateToAnime: (animeId: string, title?: string) => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const HeroBannerSection = React.memo(function HeroBannerSection({
  recommendedList,
  focusedItem,
  safeFocusedIndex,
  contentWidth,
  heroHeight,
  heroScrollRef,
  isHeroPlayLoading,
  onPlayHero,
  onNavigateToAnime,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onScroll,
}: HeroBannerSectionProps) {
  const { theme } = useTheme();

  if (recommendedList.length > 0) {
    return (
      <View style={[styles.heroContainer, { width: contentWidth, height: heroHeight }]}>
        <ScrollView
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScroll={onScroll}
          style={{ width: contentWidth, height: heroHeight }}
        >
          {recommendedList.map((item, index) => {
            const isCurrent = index === safeFocusedIndex;
            return (
              <Pressable
                key={`hero-slide-${item.id}-${index}`}
                style={[styles.heroSlide, { width: contentWidth, height: heroHeight }]}
                onPress={() => onNavigateToAnime(item.id, item.title)}
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
                      <Text
                        style={[
                          styles.heroRankBadgeText,
                          { color: getContrastTextColor(theme.colors.primary) },
                        ]}
                      >
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

                  {/* Pulsanti d'azione: PLAY e INFO */}
                  <View style={styles.heroActionsRow}>
                    <Pressable
                      style={[
                        styles.heroPlayBtn,
                        { backgroundColor: theme.colors.primary },
                        isHeroPlayLoading && isCurrent && styles.heroBtnDisabled,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayHero(item);
                      }}
                      hitSlop={8}
                      disabled={isHeroPlayLoading && isCurrent}
                      accessibilityRole="button"
                      accessibilityLabel={`RIPRODUCI ${item.title.toUpperCase()}`}
                    >
                      {isHeroPlayLoading && isCurrent ? (
                        <ActivityIndicator
                          size="small"
                          color={getContrastTextColor(theme.colors.primary)}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="play"
                            size={18}
                            color={getContrastTextColor(theme.colors.primary)}
                          />
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
                        onNavigateToAnime(item.id, item.title);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`INFO ${item.title.toUpperCase()}`}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={18}
                        color={theme.colors.text}
                      />
                      <Text style={[styles.heroInfoBtnText, { color: theme.colors.text }]}>INFO</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (focusedItem) {
    return (
      <Pressable
        style={styles.heroContainer}
        onPress={() => onNavigateToAnime(focusedItem.id, focusedItem.title)}
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
              <Text
                style={[
                  styles.heroRankBadgeText,
                  { color: getContrastTextColor(theme.colors.primary) },
                ]}
              >
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
                onPlayHero(focusedItem);
              }}
              hitSlop={8}
              disabled={isHeroPlayLoading}
              accessibilityRole="button"
              accessibilityLabel={`RIPRODUCI ${focusedItem.title.toUpperCase()}`}
            >
              {isHeroPlayLoading ? (
                <ActivityIndicator
                  size="small"
                  color={getContrastTextColor(theme.colors.primary)}
                />
              ) : (
                <>
                  <Ionicons
                    name="play"
                    size={18}
                    color={getContrastTextColor(theme.colors.primary)}
                  />
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
                onNavigateToAnime(focusedItem.id, focusedItem.title);
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
    );
  }

  return null;
});
