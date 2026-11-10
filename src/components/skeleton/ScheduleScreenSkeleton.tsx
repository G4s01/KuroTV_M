import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';

export const ScheduleScreenSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Hero Prossima Uscita Skeleton */}
      <View style={styles.heroWrapper}>
        <Skeleton width="100%" height={108} borderRadius={oledTheme.radius.md} />
      </View>

      {/* Week Tabs Bar Skeleton */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <View key={`tab-skel-${k}`} style={styles.tabItem}>
              <Skeleton width={76} height={44} borderRadius={oledTheme.radius.md} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Schedule Items Skeleton */}
      <View style={styles.listContainer}>
        {[1, 2, 3, 4, 5].map((k) => (
          <View key={`item-skel-${k}`} style={styles.rowItem}>
            {/* Time badge */}
            <View style={styles.timeCol}>
              <Skeleton width={44} height={20} borderRadius={oledTheme.radius.xs} />
            </View>
            {/* Card */}
            <View style={styles.cardItem}>
              <Skeleton width={56} height={80} borderRadius={oledTheme.radius.sm} />
              <View style={styles.cardContent}>
                <Skeleton width="85%" height={16} borderRadius={4} style={styles.titleLine} />
                <Skeleton width="55%" height={12} borderRadius={4} style={styles.jtitleLine} />
                <View style={styles.badgesRow}>
                  <Skeleton width={64} height={18} borderRadius={oledTheme.radius.xs} />
                  <Skeleton width={50} height={18} borderRadius={oledTheme.radius.xs} style={styles.statusBadge} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  heroWrapper: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsScroll: {
    paddingHorizontal: 16,
  },
  tabItem: {
    marginRight: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeCol: {
    width: 52,
    alignItems: 'flex-start',
  },
  cardItem: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: oledTheme.colors.surface,
    borderColor: oledTheme.colors.border,
    borderWidth: 1,
    borderRadius: oledTheme.radius.md,
    padding: 8,
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  titleLine: {
    marginBottom: 6,
  },
  jtitleLine: {
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    marginLeft: 6,
  },
});
