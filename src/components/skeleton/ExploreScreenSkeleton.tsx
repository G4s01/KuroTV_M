import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimeCardSkeleton } from './AnimeCardSkeleton';

export interface ExploreScreenSkeletonProps {
  cardWidth: number;
  cardHeight: number;
  itemCount?: number;
}

export const ExploreScreenSkeleton: React.FC<ExploreScreenSkeletonProps> = ({
  cardWidth,
  cardHeight,
  itemCount = 6,
}) => {
  const items = Array.from({ length: itemCount }, (_, i) => i);

  return (
    <View style={styles.gridContainer}>
      {items.map((idx) => (
        <AnimeCardSkeleton
          key={`explore-skeleton-${idx}`}
          width={cardWidth}
          height={cardHeight}
          style={styles.cardItem}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 0,
  },
  cardItem: {
    marginRight: 0,
    marginBottom: 16,
  },
});
