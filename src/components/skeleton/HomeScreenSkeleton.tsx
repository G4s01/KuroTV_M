import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';
import { AnimeCardSkeleton } from './AnimeCardSkeleton';

const HERO_HEIGHT = 300;

export interface HomeScreenSkeletonProps {
  hasContinueWatching?: boolean;
}

export const HomeScreenSkeleton: React.FC<HomeScreenSkeletonProps> = ({
  hasContinueWatching = false,
}) => {
  return (
    <View style={styles.container}>
      {/* Hero Banner Skeleton */}
      <View style={styles.heroContainer}>
        <Skeleton width="100%" height={HERO_HEIGHT} borderRadius={0} style={styles.heroBg} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Skeleton width={64} height={20} borderRadius={oledTheme.radius.xs} style={styles.heroBadge} />
          <Skeleton width="80%" height={24} borderRadius={4} style={styles.heroTitleLine1} />
          <Skeleton width="50%" height={24} borderRadius={4} style={styles.heroTitleLine2} />
          <View style={styles.heroActionsRow}>
            <Skeleton width={120} height={44} borderRadius={oledTheme.radius.full} />
            <Skeleton width={90} height={44} borderRadius={oledTheme.radius.full} />
          </View>
        </View>
      </View>

      {/* Top 8 Recommended Carousel Skeleton */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={180} height={18} borderRadius={4} />
          <Skeleton width={40} height={18} borderRadius={8} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4, 5].map((key) => (
            <View key={`skeleton-rec-${key}`} style={styles.recommendedCardSkeleton}>
              <Skeleton width="100%" height="100%" borderRadius={oledTheme.radius.md} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Optional Continue Watching Skeleton */}
      {hasContinueWatching && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Skeleton width={170} height={18} borderRadius={4} />
            <Skeleton width={24} height={18} borderRadius={8} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {[1, 2, 3].map((key) => (
              <View key={`continue-skeleton-${key}`} style={styles.continueCard}>
                <View style={styles.continueThumbWrapper}>
                  <Skeleton width="100%" height="100%" borderRadius={oledTheme.radius.md} />
                </View>
                <Skeleton width={120} height={13} borderRadius={3} style={styles.continueTitleLine} />
                <Skeleton width={80} height={11} borderRadius={3} style={styles.continueSubtitleLine} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Section 1: Ultime Uscite */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={160} height={18} borderRadius={4} />
          <Skeleton width={75} height={14} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4].map((key) => (
            <AnimeCardSkeleton key={`skeleton-latest-${key}`} />
          ))}
        </ScrollView>
      </View>

      {/* Section 2: Tendenze */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={130} height={18} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4].map((key) => (
            <AnimeCardSkeleton key={`skeleton-popular-${key}`} />
          ))}
        </ScrollView>
      </View>

      {/* Section 3: Anime in Corso */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={160} height={18} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4].map((key) => (
            <AnimeCardSkeleton key={`skeleton-ongoing-${key}`} />
          ))}
        </ScrollView>
      </View>

      {/* Section 4: Uscite Stagione (Upcoming) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={170} height={18} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4].map((key) => (
            <AnimeCardSkeleton key={`skeleton-upcoming-${key}`} />
          ))}
        </ScrollView>
      </View>

      {/* Section 5: Nuove Aggiunte */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Skeleton width={150} height={18} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {[1, 2, 3, 4].map((key) => (
            <AnimeCardSkeleton key={`skeleton-new-${key}`} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0D0D0D',
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderColor: 'transparent',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
  },
  heroTitleLine1: {
    marginBottom: 2,
  },
  heroTitleLine2: {
    marginBottom: 4,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
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
  horizontalScroll: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  recommendedCardSkeleton: {
    width: 114,
    height: 160,
    marginRight: 10,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
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
    borderWidth: 1,
    borderColor: '#262626',
  },
  continueTitleLine: {
    marginTop: 6,
  },
  continueSubtitleLine: {
    marginTop: 4,
  },
});
