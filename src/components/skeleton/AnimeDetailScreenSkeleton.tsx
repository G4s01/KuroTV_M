import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { oledTheme } from '@/theme';
import { Skeleton } from './Skeleton';
import { EpisodeItemSkeleton } from './EpisodeItemSkeleton';

export const AnimeDetailScreenSkeleton: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. Main Header Info (Poster, Metadata & Circular Action Buttons - Clean Header without backdrop) */}
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

      {/* 2. Synopsis Skeleton */}
      <View style={styles.synopsisContainer}>
        <Skeleton width={60} height={14} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="100%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="95%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="60%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width={80} height={12} borderRadius={3} style={{ marginTop: 4 }} />
      </View>

      {/* 3. Technical Metadata Table (AnimeInfoTable Skeleton) */}
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
              <Skeleton width={50} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.tableCell}>
              <Skeleton width={45} height={10} borderRadius={2} />
              <Skeleton width={90} height={12} borderRadius={3} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>

        {/* 3 Quick Links Skeleton */}
        <View style={styles.linksRow}>
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
          <Skeleton width="31%" height={44} borderRadius={oledTheme.radius.md} />
        </View>
      </View>

      {/* 4. Controls Bar (Puntate + Selettore Batch & Modalità Griglia/Lista) */}
      <View style={styles.controlsRow}>
        <View style={styles.controlsLeft}>
          <Skeleton width={120} height={18} borderRadius={4} />
          <Skeleton width={100} height={28} borderRadius={14} />
        </View>
        <Skeleton width={32} height={32} borderRadius={6} />
      </View>

      {/* 5. Episodi Grid Skeleton (12 chip da 52dp) */}
      <View style={styles.episodesGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={`ep-skel-${i}`} style={styles.gridChipWrapper}>
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
  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 68,
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
