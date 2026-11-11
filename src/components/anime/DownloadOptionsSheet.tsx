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
  TextInput,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import type { EpisodeBatch } from '@/components/BatchBottomSheet';
import type { Episode } from '@/types';

type DownloadMenuStep = 'menu' | 'batch' | 'range';

export interface DownloadOptionsSheetProps {
  isVisible: boolean;
  onClose: () => void;
  episodes: Episode[];
  batches: EpisodeBatch[];
  currentBatchId: string;
  onDownloadAll: () => void;
  onDownloadBatches: (selectedBatches: EpisodeBatch[]) => void;
  onDownloadRange: (startEpisode: number, endEpisode: number) => void;
}

export const DownloadOptionsSheet: React.FC<DownloadOptionsSheetProps> = ({
  isVisible,
  onClose,
  episodes,
  batches,
  currentBatchId,
  onDownloadAll,
  onDownloadBatches,
  onDownloadRange,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [step, setStep] = React.useState<DownloadMenuStep>('menu');
  const [selectedBatchIds, setSelectedBatchIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [overlayHeight, setOverlayHeight] = React.useState(windowHeight);
  const baseOverlayHeightRef = React.useRef(windowHeight);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const { translateY, dragStripHandlers, headerPanHandlers } =
    useBottomSheetDragDismiss({
      isVisible,
      onClose: handleClose,
    });

  React.useEffect(() => {
    if (!isVisible) {
      setKeyboardHeight(0);
      baseOverlayHeightRef.current = windowHeight;
      setOverlayHeight(windowHeight);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isVisible, windowHeight]);

  const { minEpisode, maxEpisode, totalEpisodesCount } = React.useMemo(() => {
    if (episodes.length > 0) {
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (const ep of episodes) {
        if (ep.number < minVal) minVal = ep.number;
        if (ep.number > maxVal) maxVal = ep.number;
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
        return {
          minEpisode: minVal,
          maxEpisode: maxVal,
          totalEpisodesCount: episodes.length,
        };
      }
    }
    if (batches.length > 0) {
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (const b of batches) {
        if (b.start < minVal) minVal = b.start;
        if (b.end > maxVal) maxVal = b.end;
      }
      return {
        minEpisode: minVal,
        maxEpisode: maxVal,
        totalEpisodesCount: Math.max(0, maxVal - minVal + 1),
      };
    }
    return { minEpisode: 1, maxEpisode: 1, totalEpisodesCount: 0 };
  }, [episodes, batches]);

  const [startText, setStartText] = React.useState(String(minEpisode));
  const [endText, setEndText] = React.useState(String(maxEpisode));

  // Reset sub-menu, pre-selected batch, and range defaults whenever modal opens
  React.useEffect(() => {
    if (isVisible) {
      setStep('menu');
      const initialSet = new Set<string>();
      const activeExists = batches.some((b) => b.id === currentBatchId);
      if (activeExists) {
        initialSet.add(currentBatchId);
      } else if (batches.length > 0) {
        initialSet.add(batches[0].id);
      }
      setSelectedBatchIds(initialSet);
      setStartText(String(minEpisode));
      setEndText(String(maxEpisode));
    }
  }, [isVisible, batches, currentBatchId, minEpisode, maxEpisode]);

  const clampEpisode = React.useCallback(
    (val: number) => Math.max(minEpisode, Math.min(maxEpisode, val)),
    [minEpisode, maxEpisode]
  );

  const parsedStart = clampEpisode(parseInt(startText, 10) || minEpisode);
  const parsedEnd = clampEpisode(parseInt(endText, 10) || maxEpisode);
  const effectiveStart = Math.min(parsedStart, parsedEnd);
  const effectiveEnd = Math.max(parsedStart, parsedEnd);

  const selectedRangeCount = React.useMemo(() => {
    if (totalEpisodesCount === 0) return 0;
    if (episodes.length > 0) {
      return episodes.filter(
        (ep) => ep.number >= effectiveStart && ep.number <= effectiveEnd
      ).length;
    }
    return Math.max(0, effectiveEnd - effectiveStart + 1);
  }, [episodes, totalEpisodesCount, effectiveStart, effectiveEnd]);

  const selectedBatches = React.useMemo(
    () => batches.filter((b) => selectedBatchIds.has(b.id)),
    [batches, selectedBatchIds]
  );

  const selectedBatchEpisodesCount = React.useMemo(() => {
    if (selectedBatches.length === 0) return 0;
    if (episodes.length > 0) {
      return episodes.filter((ep) =>
        selectedBatches.some((b) => ep.number >= b.start && ep.number <= b.end)
      ).length;
    }
    return selectedBatches.reduce(
      (sum, b) => sum + Math.max(0, b.end - b.start + 1),
      0
    );
  }, [episodes, selectedBatches]);

  const getBatchEpisodeCount = React.useCallback(
    (batch: EpisodeBatch) => {
      if (episodes.length > 0) {
        return episodes.filter(
          (ep) => ep.number >= batch.start && ep.number <= batch.end
        ).length;
      }
      return Math.max(0, batch.end - batch.start + 1);
    },
    [episodes]
  );

  const toggleBatchSelection = (batchId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleAllBatches = () => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedBatchIds((prev) => {
      if (prev.size === batches.length) {
        return new Set();
      }
      return new Set(batches.map((b) => b.id));
    });
  };

  const stepStart = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = clampEpisode(parsedStart + delta);
    setStartText(String(next));
    if (next > parsedEnd) {
      setEndText(String(next));
    }
  };

  const stepEnd = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = clampEpisode(parsedEnd + delta);
    setEndText(String(next));
    if (next < parsedStart) {
      setStartText(String(next));
    }
  };

  const normalizeRangeInputs = () => {
    setStartText(String(parsedStart));
    setEndText(String(parsedEnd));
  };

  const handleConfirmBatchDownload = () => {
    if (selectedBatches.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onDownloadBatches(selectedBatches);
    handleClose();
  };

  const handleConfirmRangeDownload = () => {
    if (selectedRangeCount <= 0) return;
    Haptics.selectionAsync().catch(() => {});
    onDownloadRange(effectiveStart, effectiveEnd);
    handleClose();
  };

  const handleConfirmAllDownload = () => {
    if (totalEpisodesCount === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onDownloadAll();
    handleClose();
  };

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(20, safeHorizontalInset);
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const windowShrunkByKeyboard =
    baseOverlayHeightRef.current - overlayHeight > 80;
  const effectiveKeyboardPadding =
    keyboardHeight > 0 && !windowShrunkByKeyboard ? keyboardHeight : 0;
  const availableSheetHeight = Math.max(
    240,
    overlayHeight - effectiveKeyboardPadding - Math.max(insets.top + 16, 48)
  );
  const maxScrollHeight = Math.min(
    isLandscape ? 230 : Math.min(340, windowHeight * 0.48),
    Math.max(150, availableSheetHeight - 150)
  );

  const stepTitle =
    step === 'batch'
      ? 'SCARICA BATCH'
      : step === 'range'
      ? 'INTERVALLO PERSONALIZZATO'
      : 'SCARICA EPISODI';

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (step !== 'menu') {
          Keyboard.dismiss();
          setStep('menu');
        } else {
          handleClose();
        }
      }}
      statusBarTranslucent={true}
    >
      <View
        style={styles.modalOverlay}
        onLayout={(e) => {
          const nextHeight = e.nativeEvent.layout.height;
          if (nextHeight > 0) {
            setOverlayHeight(nextHeight);
            if (keyboardHeight === 0) {
              baseOverlayHeightRef.current = nextHeight;
            }
          }
        }}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
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
              paddingBottom:
                Math.max(28, insets.bottom + 16) + effectiveKeyboardPadding,
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

          {/* Header Row — cattura gesture verticali in fase di cattura senza bloccare bottoni */}
          <View {...headerPanHandlers} style={styles.headerRow}>
            <View style={styles.headerLeftGroup}>
              {step !== 'menu' && (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.selectionAsync().catch(() => {});
                    setStep('menu');
                  }}
                  hitSlop={10}
                  style={styles.backBtn}
                  accessibilityRole="button"
                  accessibilityLabel="TORNA AL MENÙ DOWNLOAD"
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={theme.colors.text}
                  />
                </Pressable>
              )}
              <Text
                style={[styles.title, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {stepTitle}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI OPZIONI DOWNLOAD"
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Pre-Menù Ordinato */}
          {step === 'menu' && (
            <View style={styles.menuList}>
              <Text
                style={[styles.menuCaption, { color: theme.colors.textSecondary }]}
              >
                DISPONIBILI: {totalEpisodesCount}{' '}
                {totalEpisodesCount === 1 ? 'EPISODIO' : 'EPISODI'}
              </Text>

              {/* Opzione 1: Scarica Tutti */}
              <Pressable
                style={[
                  styles.menuCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                  totalEpisodesCount === 0 && styles.disabledBtn,
                ]}
                onPress={handleConfirmAllDownload}
                disabled={totalEpisodesCount === 0}
                accessibilityRole="button"
                accessibilityLabel={`SCARICA TUTTI I ${totalEpisodesCount} EPISODI`}
              >
                <View
                  style={[
                    styles.menuIconBox,
                    { backgroundColor: `${theme.colors.primary}1F` },
                  ]}
                >
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={[styles.menuCardTitle, { color: theme.colors.text }]}>
                    SCARICA TUTTI
                  </Text>
                  <Text
                    style={[
                      styles.menuCardSubtitle,
                      { color: theme.colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {totalEpisodesCount}{' '}
                    {totalEpisodesCount === 1 ? 'EPISODIO' : 'EPISODI COMPLETI'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>

              {/* Opzione 2: Scarica per Batch (multi-selezione) */}
              {batches.length > 1 && (
                <Pressable
                  style={[
                    styles.menuCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setStep('batch');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="SELEZIONA UNA O PIÙ BATCH DA SCARICARE"
                >
                  <View
                    style={[
                      styles.menuIconBox,
                      { backgroundColor: `${theme.colors.primary}1F` },
                    ]}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text
                      style={[styles.menuCardTitle, { color: theme.colors.text }]}
                    >
                      SCARICA PER BATCH
                    </Text>
                    <Text
                      style={[
                        styles.menuCardSubtitle,
                        { color: theme.colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      SELEZIONE MULTIPLA ({batches.length} BATCH)
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              )}

              {/* Opzione 3: Intervallo Personalizzato */}
              {totalEpisodesCount > 1 && (
                <Pressable
                  style={[
                    styles.menuCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setStep('range');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="SCEGLI INTERVALLO EPISODI DA SCARICARE"
                >
                  <View
                    style={[
                      styles.menuIconBox,
                      { backgroundColor: `${theme.colors.primary}1F` },
                    ]}
                  >
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text
                      style={[styles.menuCardTitle, { color: theme.colors.text }]}
                    >
                      INTERVALLO PERSONALIZZATO
                    </Text>
                    <Text
                      style={[
                        styles.menuCardSubtitle,
                        { color: theme.colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      DA EP. {minEpisode} A EP. {maxEpisode}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              )}
            </View>
          )}

          {/* Sotto-schermata Multi-Batch con pulsante "SCARICA BATCH" adiacente */}
          {step === 'batch' && (
            <View style={styles.batchStepContainer}>
              <View style={styles.batchStatusRow}>
                <Text
                  style={[
                    styles.batchStatusText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  SELEZIONATE: {selectedBatches.length} BATCH (
                  {selectedBatchEpisodesCount} EP.)
                </Text>

                <Pressable
                  onPress={toggleAllBatches}
                  hitSlop={8}
                  style={[
                    styles.selectAllChip,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedBatchIds.size === batches.length
                      ? 'DESELEZIONA TUTTE LE BATCH'
                      : 'SELEZIONA TUTTE LE BATCH'
                  }
                >
                  <Text
                    style={[
                      styles.selectAllChipText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {selectedBatchIds.size === batches.length
                      ? 'AZZERA'
                      : 'TUTTE'}
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: maxScrollHeight }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                <View style={styles.batchGrid}>
                  {batches.map((batch) => {
                    const isSelected = selectedBatchIds.has(batch.id);
                    const epCount = getBatchEpisodeCount(batch);
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
                        onPress={() => toggleBatchSelection(batch.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`SELEZIONA BATCH ${batch.label}`}
                      >
                        <View style={styles.batchItemInfo}>
                          <Text
                            style={[
                              styles.batchText,
                              { color: theme.colors.text },
                              isSelected && {
                                fontWeight: 'bold',
                                color: theme.colors.primary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {batch.label}
                          </Text>
                          <Text
                            style={[
                              styles.batchSubText,
                              { color: theme.colors.textMuted },
                            ]}
                            numberOfLines={1}
                          >
                            {epCount} EP.
                          </Text>
                        </View>
                        <Ionicons
                          name={
                            isSelected ? 'checkmark-circle' : 'ellipse-outline'
                          }
                          size={20}
                          color={
                            isSelected
                              ? theme.colors.primary
                              : theme.colors.textMuted
                          }
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <Pressable
                style={[
                  styles.primaryDownloadBtn,
                  { backgroundColor: theme.colors.primary },
                  selectedBatches.length === 0 && styles.disabledBtn,
                ]}
                onPress={handleConfirmBatchDownload}
                disabled={selectedBatches.length === 0}
                accessibilityRole="button"
                accessibilityLabel={`SCARICA BATCH SELEZIONATE (${selectedBatchEpisodesCount} EPISODI)`}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color={primaryContrast}
                />
                <Text
                  style={[
                    styles.primaryDownloadBtnText,
                    { color: primaryContrast },
                  ]}
                >
                  SCARICA BATCH ({selectedBatchEpisodesCount} EP.)
                </Text>
              </Pressable>
            </View>
          )}

          {/* Sotto-schermata Intervallo Personalizzato DA / A */}
          {step === 'range' && (
            <View style={styles.rangeStepContainer}>
              <Text
                style={[styles.menuCaption, { color: theme.colors.textSecondary }]}
              >
                SCEGLI DA QUALE EPISODIO SCARICARE ({minEpisode} – {maxEpisode})
              </Text>

              <View style={styles.rangeInputsRow}>
                {/* DA */}
                <View
                  style={[
                    styles.rangeFieldCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepperLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    DA
                  </Text>
                  <View style={styles.stepperControls}>
                    <Pressable
                      style={[
                        styles.stepperBtn,
                        parsedStart <= minEpisode && styles.disabledBtn,
                      ]}
                      onPress={() => stepStart(-1)}
                      disabled={parsedStart <= minEpisode}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel="DIMINUISCI EPISODIO INIZIALE"
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={theme.colors.text}
                      />
                    </Pressable>

                    <TextInput
                      value={startText}
                      onChangeText={(txt) => setStartText(txt.replace(/[^0-9]/g, ''))}
                      onBlur={normalizeRangeInputs}
                      onSubmitEditing={normalizeRangeInputs}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={5}
                      selectTextOnFocus={true}
                      style={[styles.stepperInput, { color: theme.colors.text }]}
                      accessibilityLabel="NUMERO EPISODIO INIZIALE"
                    />

                    <Pressable
                      style={[
                        styles.stepperBtn,
                        parsedStart >= maxEpisode && styles.disabledBtn,
                      ]}
                      onPress={() => stepStart(1)}
                      disabled={parsedStart >= maxEpisode}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel="AUMENTA EPISODIO INIZIALE"
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={theme.colors.text}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* A */}
                <View
                  style={[
                    styles.rangeFieldCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepperLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    A
                  </Text>
                  <View style={styles.stepperControls}>
                    <Pressable
                      style={[
                        styles.stepperBtn,
                        parsedEnd <= minEpisode && styles.disabledBtn,
                      ]}
                      onPress={() => stepEnd(-1)}
                      disabled={parsedEnd <= minEpisode}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel="DIMINUISCI EPISODIO FINALE"
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={theme.colors.text}
                      />
                    </Pressable>

                    <TextInput
                      value={endText}
                      onChangeText={(txt) => setEndText(txt.replace(/[^0-9]/g, ''))}
                      onBlur={normalizeRangeInputs}
                      onSubmitEditing={normalizeRangeInputs}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={5}
                      selectTextOnFocus={true}
                      style={[styles.stepperInput, { color: theme.colors.text }]}
                      accessibilityLabel="NUMERO EPISODIO FINALE"
                    />

                    <Pressable
                      style={[
                        styles.stepperBtn,
                        parsedEnd >= maxEpisode && styles.disabledBtn,
                      ]}
                      onPress={() => stepEnd(1)}
                      disabled={parsedEnd >= maxEpisode}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel="AUMENTA EPISODIO FINALE"
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={theme.colors.text}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                style={[
                  styles.primaryDownloadBtn,
                  { backgroundColor: theme.colors.primary },
                  selectedRangeCount === 0 && styles.disabledBtn,
                ]}
                onPress={handleConfirmRangeDownload}
                disabled={selectedRangeCount === 0}
                accessibilityRole="button"
                accessibilityLabel={`SCARICA INTERVALLO DA ${effectiveStart} A ${effectiveEnd}`}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={primaryContrast}
                />
                <Text
                  style={[
                    styles.primaryDownloadBtnText,
                    { color: primaryContrast },
                  ]}
                >
                  SCARICA INTERVALLO ({selectedRangeCount} EP.)
                </Text>
              </Pressable>
            </View>
          )}
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
    marginBottom: 14,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  menuList: {
    gap: 10,
  },
  menuCaption: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    minHeight: 62,
    gap: 12,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: oledTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  menuCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCardSubtitle: {
    fontSize: 11,
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  batchStepContainer: {
    gap: 12,
  },
  batchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  batchStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  selectAllChip: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  batchItem: {
    width: '48.2%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    minHeight: 54,
    gap: 6,
  },
  batchItemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  batchText: {
    fontSize: 13,
    fontFamily: oledTheme.typography.caption.fontFamily,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  batchSubText: {
    fontSize: 10,
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
  rangeStepContainer: {
    gap: 12,
  },
  rangeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeFieldCard: {
    flex: 1,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: oledTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    minWidth: 36,
    height: 44,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textAlign: 'center',
    paddingVertical: 0,
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: oledTheme.radius.md,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  primaryDownloadBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
