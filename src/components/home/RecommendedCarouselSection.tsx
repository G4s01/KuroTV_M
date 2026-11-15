import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme, getContrastTextColor } from '@/theme';
import type { AnimeItem } from '@/types';
import {
  homeStyles as styles,
  RECOMMENDED_ITEM_WIDTH,
} from './home.styles';

export interface RecommendedCarouselSectionProps {
  recommendedList: AnimeItem[];
  safeFocusedIndex: number;
  contentWidth: number;
  recommendedScrollRef: React.RefObject<any>;
  recommendedSnapOffsets: number[];
  onSelectRecommended: (index: number) => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const RecommendedCarouselSection = React.memo(function RecommendedCarouselSection({
  recommendedList,
  safeFocusedIndex,
  contentWidth,
  recommendedScrollRef,
  recommendedSnapOffsets,
  onSelectRecommended,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onScroll,
}: RecommendedCarouselSectionProps) {
  const { theme } = useTheme();

  if (recommendedList.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          RACCOMANDATI
        </Text>
        <Text
          style={[
            styles.sectionBadge,
            {
              backgroundColor: theme.colors.primary,
              color: getContrastTextColor(theme.colors.primary),
            },
          ]}
        >
          {safeFocusedIndex + 1}/{recommendedList.length}
        </Text>
      </View>

      <ScrollView
        ref={recommendedScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.recommendedScrollContent,
          {
            paddingRight: Math.max(16, contentWidth - RECOMMENDED_ITEM_WIDTH - 16),
          },
        ]}
        snapToOffsets={recommendedSnapOffsets}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={onScroll}
      >
        {recommendedList.map((item, index) => {
          const isFocused = index === safeFocusedIndex;
          return (
            <Pressable
              key={`recommended-${item.id}-${index}`}
              style={[
                styles.recommendedCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: isFocused ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => onSelectRecommended(index)}
              accessibilityRole="button"
              accessibilityLabel={`RACCOMANDATO NUMERO ${index + 1}: ${item.title.toUpperCase()}`}
            >
              <Image
                source={{ uri: item.thumbnail || item.banner || item.image }}
                style={styles.recommendedImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.recommendedOverlay} />

              {/* Rank Badge top-left */}
              <View
                style={[
                  styles.rankBadge,
                  {
                    backgroundColor: isFocused ? theme.colors.primary : 'rgba(0, 0, 0, 0.75)',
                    borderColor: isFocused ? theme.colors.primary : 'rgba(255, 255, 255, 0.25)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rankBadgeText,
                    {
                      color: isFocused
                        ? getContrastTextColor(theme.colors.primary)
                        : '#FFFFFF',
                    },
                  ]}
                >
                  #{index + 1}
                </Text>
              </View>

              {/* Sub / Dub tag */}
              {item.subOrDub && (
                <View style={[styles.recommendedSubBadge, { backgroundColor: theme.colors.surface }]}>
                  <Text style={styles.recommendedSubBadgeText}>{item.subOrDub}</Text>
                </View>
              )}

              {/* Title Box */}
              <View style={styles.recommendedTitleBox}>
                <Text
                  style={[
                    styles.recommendedTitle,
                    { color: isFocused ? theme.colors.primary : theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});
