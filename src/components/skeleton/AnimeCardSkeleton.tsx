import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';

export interface AnimeCardSkeletonProps {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const AnimeCardSkeleton: React.FC<AnimeCardSkeletonProps> = ({
  width = 130,
  height = 190,
  style,
}) => {
  return (
    <View style={[styles.container, { width }, style]}>
      {/* Poster Skeleton */}
      <View style={[styles.posterWrapper, { height }]}>
        <Skeleton width="100%" height="100%" borderRadius={oledTheme.radius.md} />
        {/* Subtle Top Badge Skeleton */}
        <View style={styles.badgePlaceholder}>
          <Skeleton width={44} height={18} borderRadius={oledTheme.radius.xs} />
        </View>
      </View>

      {/* Title Skeletons */}
      <View style={styles.titleContainer}>
        <Skeleton width="88%" height={12} borderRadius={3} style={styles.titleLine} />
        <Skeleton width="55%" height={12} borderRadius={3} style={styles.titleLine} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    marginBottom: 16,
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  posterWrapper: {
    width: '100%',
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#262626',
  },
  badgePlaceholder: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  titleContainer: {
    marginTop: 6,
    paddingHorizontal: 2,
    gap: 4,
  },
  titleLine: {
    backgroundColor: '#1E1E1E',
  },
});
