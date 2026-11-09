import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';
import { EpisodeItemSkeleton } from './EpisodeItemSkeleton';

const BACKDROP_HEIGHT = 260;

export const AnimeDetailScreenSkeleton: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. Backdrop Skeleton */}
      <View style={styles.backdropContainer}>
        <Skeleton width="100%" height={BACKDROP_HEIGHT} borderRadius={0} style={styles.backdrop} />
        <View style={styles.backdropGradient} />
      </View>

      {/* 2. Main Header Info (Poster, Metadata & Circular Action Buttons) */}
      <View style={styles.mainInfo}>
        <View style={styles.posterAndMeta}>
          {/* Poster */}
          <View style={styles.posterContainer}>
            <Skeleton width={110} height={160} borderRadius={oledTheme.radius.md} />
          </View>

          {/* Meta Right */}
          <View style={styles.metaRight}>
            <Skeleton width="90%" height={18} borderRadius={4} />
            <Skeleton width="65%" height={18} borderRadius={4} />

            <View style={styles.badgeRow}>
              <Skeleton width={50} height={20} borderRadius={oledTheme.radius.sm} />
              <Skeleton width={60} height={20} borderRadius={oledTheme.radius.sm} />
              <Skeleton width={44} height={20} borderRadius={oledTheme.radius.sm} />
            </View>

            {/* Action Buttons Row (Play & Reload - Circles >= 44dp) */}
            <View style={styles.actionButtonsRow}>
              <Skeleton width={44} height={44} borderRadius={22} />
              <Skeleton width={44} height={44} borderRadius={22} />
            </View>
          </View>
        </View>
      </View>

      {/* 3. Synopsis Skeleton */}
      <View style={styles.synopsisContainer}>
        <Skeleton width={60} height={14} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="100%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="95%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="60%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width={80} height={12} borderRadius={3} style={{ marginTop: 4 }} />
      </View>

      {/* 4. Technical Metadata Table (AnimeInfoTable Skeleton) */}
      <View style={styles.tableContainer}>
        <View style={styles.sectionHeadingRow}>
          <Skeleton width={180} height={14} borderRadius={3} />
        </View>

        <View style={styles.tableCard}>
          {/* Row 1: Audio & Stato */}
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
          </View>

          {/* Row 2: Uscita & Durata */}
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
          </View>

          {/* Row 3: Studio & Episodi */}
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
          </View>

          {/* Row 4: Voto & Genere */}
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={75} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={90} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>

        {/* Quick Links Row (Trailer, MAL, AniList >= 44dp) */}
        <View style={styles.linksRow}>
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
        </View>
      </View>

      {/* 5. Controls Row Skeleton (Episodes count & view mode toggle) */}
      <View style={styles.controlsRow}>
        <View style={styles.controlsLeft}>
          <Skeleton width={110} height={16} borderRadius={3} />
          <Skeleton width={80} height={28} borderRadius={oledTheme.radius.sm} />
        </View>
        <Skeleton width={72} height={36} borderRadius={oledTheme.radius.md} />
      </View>

      {/* 6. Episodes Grid Skeletons (2 rows of 4) */}
      <View style={styles.episodesGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
          <View key={`ep-skeleton-${idx}`} style={styles.gridChipWrapper}>
            <EpisodeItemSkeleton variant="grid" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdropContainer: {
    height: BACKDROP_HEIGHT,
    width: '100%',
    backgroundColor: '#000000',
    position: 'relative',
  },
  backdrop: {
    borderColor: 'transparent',
  },
  backdropGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  posterAndMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  posterContainer: {
    width: 110,
    height: 160,
    borderRadius: oledTheme.radius.md,
    overflow: 'hidden',
  },
  metaRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  synopsisContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tableContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableCard: {
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#0E0E0E',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cellDivider: {
    width: 1,
    backgroundColor: '#262626',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  episodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  gridChipWrapper: {
    width: '25%',
  },
});
