import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { useBottomSheetDragDismiss } from './useBottomSheetDragDismiss';

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

  const { translateY, dragStripHandlers, headerPanHandlers } =
    useBottomSheetDragDismiss({
      isVisible,
      onClose,
    });

  const handleSelectBatch = (batchId: string) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectBatch(batchId);
    onClose();
  };

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(20, safeHorizontalInset);
  const maxScrollHeight = isLandscape ? 220 : Math.min(360, windowHeight * 0.55);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ translateY }],
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
          {/* Striscia Drag Handle a tutta larghezza — zona di presa primaria per swipe-down */}
          <View {...dragStripHandlers} style={styles.dragStripArea}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Header Row with Title & Close Icon */}
          <View {...headerPanHandlers} style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              INTERVALLO PUNTATE
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

          <ScrollView
            style={{ maxHeight: maxScrollHeight }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.batchGrid}>
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
                      isSelected && {
                        borderColor: theme.colors.primary,
                        backgroundColor: `${theme.colors.primary}18`,
                      },
                    ]}
                    onPress={() => handleSelectBatch(batch.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`VISUALIZZA BATCH ${batch.label}`}
                  >
                    <Text
                      style={[
                        styles.batchText,
                        { color: theme.colors.text },
                        isSelected && {
                          fontWeight: 'bold',
                          color: theme.colors.primary,
                        },
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
            </View>
          </ScrollView>
        </Animated.View>
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
    paddingTop: 2,
  },
  dragStripArea: {
    width: '100%',
    minHeight: 44,
    paddingTop: 14,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8,
  },
  batchItem: {
    width: '48.2%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    minHeight: 50,
  },
  batchText: {
    fontSize: 13,
    fontFamily: oledTheme.typography.caption.fontFamily,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
