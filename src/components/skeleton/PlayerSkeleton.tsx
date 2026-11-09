import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';

export interface PlayerSkeletonProps {
  animeTitle?: string;
  episodeNumber?: number | string;
}

export const PlayerSkeleton: React.FC<PlayerSkeletonProps> = ({
  animeTitle,
  episodeNumber,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Video Viewport Skeleton Placeholder */}
      <Skeleton width="100%" height="100%" borderRadius={0} style={styles.videoSkeleton} />

      {/* Simulated OSD Overlay */}
      <View style={styles.overlay}>
        {/* Top OSD Header */}
        <View
          style={[
            styles.osdHeader,
            {
              paddingTop: Math.max(16, insets.top),
              paddingLeft: Math.max(16, insets.left),
              paddingRight: Math.max(16, insets.right),
            },
          ]}
        >
          <Skeleton width={44} height={44} borderRadius={22} />

          <View style={styles.titleWrapper}>
            {animeTitle ? (
              <Text style={styles.titleText} numberOfLines={1}>
                {animeTitle}
              </Text>
            ) : (
              <Skeleton width={160} height={16} borderRadius={4} />
            )}
            {episodeNumber ? (
              <Text style={styles.subtitleText}>EPISODIO {episodeNumber}</Text>
            ) : (
              <Skeleton width={90} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            )}
          </View>

          <View style={styles.headerActions}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <Skeleton width={44} height={44} borderRadius={22} />
            <Skeleton width={44} height={44} borderRadius={22} />
          </View>
        </View>

        {/* Center Loading Status & Media Controls */}
        <View style={styles.centerLoading}>
          <View style={styles.centerControlsRow}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <Skeleton width={64} height={64} borderRadius={32} style={styles.centerPlayPlaceholder} />
            <Skeleton width={44} height={44} borderRadius={22} />
          </View>
          <View style={styles.statusBox}>
            <Skeleton width={180} height={14} borderRadius={4} />
            <Skeleton width={110} height={10} borderRadius={3} style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Bottom OSD Footer */}
        <View
          style={[
            styles.osdFooter,
            {
              paddingBottom: Math.max(16, insets.bottom),
              paddingLeft: Math.max(16, insets.left),
              paddingRight: Math.max(16, insets.right),
            },
          ]}
        >
          {/* Timeline Bar Skeleton */}
          <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 12 }} />

          {/* Bottom Bar Controls Skeleton */}
          <View style={styles.bottomControls}>
            <View style={styles.timeRow}>
              <Skeleton width={90} height={14} borderRadius={3} />
            </View>

            <View style={styles.chipsRow}>
              <Skeleton width={44} height={44} borderRadius={22} />
              <Skeleton width={56} height={34} borderRadius={17} />
              <Skeleton width={44} height={44} borderRadius={22} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoSkeleton: {
    borderColor: 'transparent',
    backgroundColor: '#0A0A0A',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  osdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  subtitleText: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  centerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  centerPlayPlaceholder: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333333',
  },
  statusBox: {
    alignItems: 'center',
  },
  osdFooter: {
    paddingTop: 8,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
