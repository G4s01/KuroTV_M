import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import type { AnimeItem } from '@/types';
import { homeStyles as styles } from './home.styles';

export interface HomeSectionProps {
  title: string;
  items: AnimeItem[];
  onItemPress: (item: AnimeItem) => void;
  onSeeAll?: () => void;
  seeAllText?: string;
  maxItems?: number;
}

export function HomeSection({
  title,
  items,
  onItemPress,
  onSeeAll,
  seeAllText = 'VEDI TUTTI',
  maxItems,
}: HomeSectionProps) {
  const { theme } = useTheme();
  const displayItems = maxItems ? items.slice(0, maxItems) : items;

  if (displayItems.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${seeAllText}: ${title}`}
          >
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
              {seeAllText}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {displayItems.map((anime: AnimeItem, idx: number) => (
          <AnimeCard
            key={`${anime.id || idx}-${title}`}
            anime={anime}
            onPress={() => onItemPress(anime)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
