import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';

export interface EpisodeBatch {
  id: string;
  label: string;
  start: number;
  end: number;
  startIndex?: number;
  endIndex?: number;
}

export interface RelatedSeason {
  id: string;
  title: string;
  badge?: string;
}

export interface BatchBottomSheetProps {
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
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(20, safeHorizontalInset);

  const handleSelectBatch = (batchId: string) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectBatch(batchId);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding,
              paddingBottom: Math.max(28, insets.bottom + 16),
            },
            isTablet && {
              maxWidth: 580,
              width: '100%',
              alignSelf: 'center',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderLeftWidth: 1,
              borderRightWidth: 1,
            },
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.dragIndicatorWrapper}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Header Row with Title & Close Icon */}
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              SELEZIONA BATCH EPISODI
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI SELEZIONE BATCH"
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
              INTERVALLO PUNTATE
            </Text>
            <ScrollView
              style={[styles.batchScroll, { maxHeight: isLandscape ? 220 : 380 }]}
              contentContainerStyle={styles.batchGrid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {batches.map((batch) => {
                const isSelected = batch.id === currentBatchId;
                return (
                  <Pressable
                    key={batch.id}
                    style={[
                      styles.batchItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                      isSelected && [
                        styles.batchItemActive,
                        {
                          borderColor: theme.colors.primary,
                          backgroundColor: `${theme.colors.primary}18`,
                        },
                      ],
                    ]}
                    onPress={() => handleSelectBatch(batch.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`SELEZIONA BATCH ${batch.label}`}
                  >
                    <Text
                      style={[
                        styles.batchText,
                        { color: theme.colors.text },
                        isSelected && [
                          styles.batchTextActive,
                          { color: theme.colors.primary },
                        ],
                      ]}
                    >
                      {batch.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={theme.colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 10,
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
  },
  dragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  batchScroll: {
    maxHeight: 380,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    minWidth: '47%',
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  batchItemActive: {
    borderWidth: 1,
  },
  batchText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
  },
  batchTextActive: {
    fontWeight: '700',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
  },
});
