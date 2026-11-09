import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';

export interface EpisodeItemSkeletonProps {
  variant?: 'grid' | 'list';
  style?: StyleProp<ViewStyle>;
}

export const EpisodeItemSkeleton: React.FC<EpisodeItemSkeletonProps> = ({
  variant = 'grid',
  style,
}) => {
  if (variant === 'grid') {
    return (
      <View style={[styles.gridContainer, style]}>
        <Skeleton width="100%" height={52} borderRadius={oledTheme.radius.md} />
      </View>
    );
  }

  return (
    <View style={[styles.listContainer, style]}>
      <View style={styles.listLeft}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <View style={styles.listInfo}>
          <Skeleton width="65%" height={14} borderRadius={3} />
          <Skeleton width="35%" height={11} borderRadius={3} style={{ marginTop: 4 }} />
        </View>
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    minHeight: oledTheme.spacing.minTouchTarget,
    height: 52,
    margin: 4,
  },
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0E0E0E',
    borderRadius: oledTheme.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#262626',
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
  },
});
