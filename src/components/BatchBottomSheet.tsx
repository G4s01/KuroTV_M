import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { BottomSheet } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

export interface EpisodeBatch {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface RelatedSeason {
  id: string;
  title: string;
  badge?: string;
}

interface BatchBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  batches: EpisodeBatch[];
  currentBatchId: string;
  onSelectBatch: (batchId: string) => void;
  seasons?: RelatedSeason[];
  currentSeasonId?: string;
  onSelectSeason?: (seasonId: string) => void;
}

export const BatchBottomSheet: React.FC<BatchBottomSheetProps> = ({
  isVisible,
  onClose,
  batches,
  currentBatchId,
  onSelectBatch,
  seasons = [],
  currentSeasonId,
  onSelectSeason,
}) => {
  return (
    <BottomSheet
      isPresented={isVisible}
      onDismiss={onClose}
      showDragIndicator={true}
      containerColor={oledTheme.colors.card}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Stagioni & Batch Episodi</Text>

        {/* Stagioni correlate (se disponibili) */}
        {seasons.length > 0 && onSelectSeason && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Stagioni Correlate</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonsScroll}
            >
              {seasons.map((season) => {
                const isSelected = season.id === currentSeasonId;
                return (
                  <Pressable
                    key={season.id}
                    style={[styles.seasonChip, isSelected && styles.seasonChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      onSelectSeason(season.id);
                      onClose();
                    }}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color={isSelected ? '#FFFFFF' : oledTheme.colors.textMuted}
                    />
                    <Text
                      style={[styles.seasonText, isSelected && styles.seasonTextActive]}
                      numberOfLines={1}
                    >
                      {season.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Batch di puntate */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Intervallo Puntate</Text>
          <View style={styles.batchGrid}>
            {batches.map((batch) => {
              const isSelected = batch.id === currentBatchId;
              return (
                <Pressable
                  key={batch.id}
                  style={[styles.batchItem, isSelected && styles.batchItemActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onSelectBatch(batch.id);
                    onClose();
                  }}
                >
                  <Text style={[styles.batchText, isSelected && styles.batchTextActive]}>
                    {batch.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color={oledTheme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    color: oledTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  seasonsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    borderColor: '#333333',
    minHeight: oledTheme.spacing.minTouchTarget,
    maxWidth: 220,
  },
  seasonChipActive: {
    backgroundColor: oledTheme.colors.primary,
    borderColor: oledTheme.colors.primary,
  },
  seasonText: {
    color: oledTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  seasonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    borderColor: '#333333',
    minWidth: '47%',
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  batchItemActive: {
    borderColor: oledTheme.colors.primary,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  batchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  batchTextActive: {
    color: oledTheme.colors.primary,
    fontWeight: '700',
  },
});
