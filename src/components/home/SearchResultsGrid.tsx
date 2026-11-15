import React from 'react';
import { View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { AnimeCard } from '@/components/AnimeCard';
import type { AnimeItem } from '@/types';
import { homeStyles as styles } from './home.styles';

export interface SearchResultsGridProps {
  items: AnimeItem[];
  cardWidth: number;
  cardHeight: number;
  numColumns?: number;
  onItemPress: (item: AnimeItem) => void;
}

export const SearchResultsGrid = React.memo(function SearchResultsGrid({
  items,
  cardWidth,
  cardHeight,
  numColumns = 2,
  onItemPress,
}: SearchResultsGridProps) {
  const { theme } = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          NESSUN ANIME TROVATO CON I CRITERI INDICATI
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      key={`search-grid-${numColumns}`}
      data={items}
      keyExtractor={(item, index) => item.id || `search-${index}`}
      numColumns={numColumns}
      contentContainerStyle={styles.searchListContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={({ item }) => (
        <View style={styles.searchCardWrapper}>
          <AnimeCard
            anime={item}
            width={cardWidth}
            height={cardHeight}
            onPress={() => onItemPress(item)}
          />
        </View>
      )}
    />
  );
});
