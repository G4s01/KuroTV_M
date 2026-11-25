import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MalSyncService,
  addMalIgnoredAnimeIds,
  type MalDiffResult,
  type MalSyncApplyResult,
  type MalSyncProposal,
  type MalUnmappedLocalSeries,
} from '@/services/mal';
import { malStyles as styles } from './mal.styles';

export interface MalSyncDiffModalProps {
  isVisible: boolean;
  onClose: () => void;
  diff: MalDiffResult | null;
  isLoadingDiff: boolean;
  mappingProgress?: { completed: number; total: number } | null;
  onProposalsApplied: (result: MalSyncApplyResult) => void;
  onIgnoredChanged: () => void;
  onOpenUnmappedAnime?: (item: MalUnmappedLocalSeries) => void;
}

function formatProposalTransition(p: MalSyncProposal): string {
  const totalStr = p.totalEpisodes && p.totalEpisodes > 0 ? `/${p.totalEpisodes}` : '';
  if (p.reason === 'promote_ptw') {
    return `DA GUARDARE → IN CORSO (EP. ${p.targetEpisodes}${totalStr})`;
  }
  if (p.reason === 'complete_series') {
    const fromLabel =
      p.currentMalStatus === 'plan_to_watch'
        ? 'DA GUARDARE'
        : p.currentMalStatus === 'not_in_list'
        ? 'NUOVO'
        : 'IN CORSO';
    return `${fromLabel} → COMPLETATO (EP. ${p.targetEpisodes}${totalStr})`;
  }
  if (p.reason === 'add_to_list') {
    return `AGGIUNGI • IN CORSO (EP. ${p.targetEpisodes}${totalStr})`;
  }
  return `EP. ${p.currentMalEpisodes} → EP. ${p.targetEpisodes}${totalStr}`;
}

export const MalSyncDiffModal: React.FC<MalSyncDiffModalProps> = ({
  isVisible,
  onClose,
  diff,
  isLoadingDiff,
  mappingProgress,
  onProposalsApplied,
  onIgnoredChanged,
  onOpenUnmappedAnime,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [proposals, setProposals] = React.useState<MalSyncProposal[]>([]);
  const [unmappedExpanded, setUnmappedExpanded] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (diff?.proposals) {
      setProposals(diff.proposals.map((p) => ({ ...p })));
    } else {
      setProposals([]);
    }
    setApplyError(null);
  }, [diff, isVisible]);

  const { translateY, dragStripHandlers, headerPanHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose,
  });

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);
  const listHeight = isLandscape
    ? Math.min(200, Math.max(130, windowHeight * 0.4))
    : Math.min(340, Math.max(200, windowHeight * 0.44));

  const selectedCount = React.useMemo(
    () => proposals.filter((p) => p.selected).length,
    [proposals]
  );

  const allSelected = proposals.length > 0 && selectedCount === proposals.length;

  const toggleProposal = React.useCallback((malId: number) => {
    Haptics.selectionAsync().catch(() => {});
    setProposals((prev) =>
      prev.map((p) => (p.malId === malId ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const toggleSelectAll = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setProposals((prev) => {
      const nextVal = !prev.every((p) => p.selected);
      return prev.map((p) => ({ ...p, selected: nextVal }));
    });
  }, []);

  const handleIgnoreProposal = React.useCallback(
    (proposal: MalSyncProposal) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      addMalIgnoredAnimeIds(proposal.animeIds);
      setProposals((prev) => prev.filter((p) => p.malId !== proposal.malId));
      onIgnoredChanged();
    },
    [onIgnoredChanged]
  );

  const handleApplyConfirmed = React.useCallback(async () => {
    setIsConfirmVisible(false);
    if (selectedCount === 0 || isApplying) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      const result = await MalSyncService.applyAppToMalProposals(proposals);
      if (result.failed > 0 && result.succeeded === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setApplyError(
          result.errors[0]?.message?.toUpperCase() || 'AGGIORNAMENTO MYANIMELIST FALLITO.'
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onProposalsApplied(result);
        onClose();
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setApplyError((err?.message || 'ERRORE DURANTE LA SINCRONIZZAZIONE.').toUpperCase());
    } finally {
      setIsApplying(false);
    }
  }, [selectedCount, isApplying, proposals, onProposalsApplied, onClose]);

  const unmappedList = diff?.unmapped || [];

  const renderProposalRow = React.useCallback(
    ({ item }: { item: MalSyncProposal }) => (
      <View
        style={[
          styles.diffRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: item.selected ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Pressable
          style={styles.diffCheckBtn}
          onPress={() => toggleProposal(item.malId)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.selected }}
          accessibilityLabel={`SELEZIONA ${item.title}`}
        >
          <Ionicons
            name={item.selected ? 'checkbox' : 'square-outline'}
            size={22}
            color={item.selected ? theme.colors.primary : theme.colors.textMuted}
          />
        </Pressable>

        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ width: 38, height: 54, borderRadius: 6, backgroundColor: '#161616' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}

        <Pressable style={styles.diffBody} onPress={() => toggleProposal(item.malId)}>
          <Text style={[styles.diffTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text
            style={[
              styles.diffTransition,
              {
                color:
                  item.targetStatus === 'completed'
                    ? theme.colors.success || '#10B981'
                    : theme.colors.primary,
              },
            ]}
            numberOfLines={1}
          >
            {formatProposalTransition(item)}
          </Text>
        </Pressable>

        <Pressable
          style={styles.diffCheckBtn}
          onPress={() => handleIgnoreProposal(item)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`IGNORA ${item.title} NELLA SINCRONIZZAZIONE`}
        >
          <Ionicons name="eye-off-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    ),
    [theme, toggleProposal, handleIgnoreProposal]
  );

  return (
    <>
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                transform: [{ translateY }],
                paddingHorizontal: horizontalPadding,
                paddingBottom: Math.max(24, insets.bottom + 14),
              },
              isTablet && {
                maxWidth: 620,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              },
            ]}
          >
            <View {...dragStripHandlers} style={styles.dragStripArea}>
              <View style={styles.dragIndicator} />
            </View>

            <View
              {...headerPanHandlers}
              style={[styles.sheetHeaderRow, { borderBottomColor: theme.colors.border }]}
            >
              <View style={styles.sheetHeaderLeft}>
                <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  SINCRONIZZA APP → MAL
                </Text>
              </View>

              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI SINCRONIZZAZIONE MAL"
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {isLoadingDiff ? (
              <View style={{ paddingVertical: 36, alignItems: 'center', gap: 12 }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  {mappingProgress && mappingProgress.total > 0
                    ? `VERIFICA ID MAL IN CORSO (${mappingProgress.completed}/${mappingProgress.total})...`
                    : 'CALCOLO DIFFERENZE APP → MAL...'}
                </Text>
              </View>
            ) : (
              <View style={{ paddingTop: 12, gap: 10 }}>
                {proposals.length > 0 ? (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.sheetSectionLabel,
                          { color: theme.colors.textSecondary, marginBottom: 0 },
                        ]}
                      >
                        PROPOSTE PRONTE ({selectedCount}/{proposals.length})
                      </Text>

                      <Pressable
                        style={[
                          styles.secondaryBtn,
                          {
                            minHeight: 44,
                            paddingVertical: 8,
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                          },
                        ]}
                        onPress={toggleSelectAll}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={allSelected ? 'DESELEZIONA TUTTE' : 'SELEZIONA TUTTE'}
                      >
                        <Text
                          style={[styles.secondaryBtnText, { color: theme.colors.primary }]}
                        >
                          {allSelected ? 'AZZERA' : 'TUTTE'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ height: listHeight, width: '100%' }}>
                      <FlashList
                        data={proposals}
                        keyExtractor={(item) => String(item.malId)}
                        renderItem={renderProposalRow}
                        maintainVisibleContentPosition={{ disabled: true }}
                        nestedScrollEnabled={true}
                      />
                    </View>
                  </>
                ) : (
                  <View
                    style={{
                      paddingVertical: 20,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={36}
                      color={theme.colors.success || '#10B981'}
                    />
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                      MYANIMELIST GIÀ ALLINEATO
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                      NESSUN EPISODIO O STATO DA INVIARE RISPETTO ALLE TUE VISIONI LOCALI.
                    </Text>
                  </View>
                )}

                {/* Unmapped local series section */}
                {unmappedList.length > 0 && (
                  <View
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      style={{
                        minHeight: 44,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setUnmappedExpanded((v) => !v);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`SERIE SENZA ID MAL (${unmappedList.length})`}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                        <Text
                          style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          NON ASSOCIATI A MAL ({unmappedList.length})
                        </Text>
                      </View>
                      <Ionicons
                        name={unmappedExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>

                    {unmappedExpanded && (
                      <ScrollView
                        style={{ maxHeight: 130, borderTopWidth: 1, borderTopColor: theme.colors.border }}
                        nestedScrollEnabled={true}
                      >
                        {unmappedList.map((u) => (
                          <Pressable
                            key={u.animeId}
                            style={{
                              minHeight: 44,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottomWidth: 1,
                              borderBottomColor: theme.colors.border,
                              gap: 8,
                            }}
                            onPress={() => onOpenUnmappedAnime?.(u)}
                          >
                            <Text
                              style={[styles.diffTitle, { color: theme.colors.text, flex: 1 }]}
                              numberOfLines={1}
                            >
                              {u.title} (EP. {u.watchedEpisodes})
                            </Text>
                            <Text
                              style={[styles.secondaryBtnText, { color: theme.colors.primary }]}
                            >
                              APRI
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {applyError ? (
                  <View
                    style={[
                      styles.inlineBanner,
                      {
                        marginHorizontal: 0,
                        marginTop: 0,
                        backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                        borderColor: theme.colors.error || '#EF4444',
                      },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle"
                      size={16}
                      color={theme.colors.error || '#EF4444'}
                    />
                    <Text
                      style={[
                        styles.inlineBannerText,
                        { color: theme.colors.error || '#EF4444' },
                      ]}
                    >
                      {applyError}
                    </Text>
                  </View>
                ) : null}

                {proposals.length > 0 && (
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor:
                          selectedCount > 0 ? theme.colors.primary : theme.colors.surfaceSubtle,
                        opacity: isApplying ? 0.7 : 1,
                      },
                    ]}
                    disabled={selectedCount === 0 || isApplying}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsConfirmVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`INVIA ${selectedCount} AGGIORNAMENTI A MYANIMELIST`}
                  >
                    {isApplying ? (
                      <ActivityIndicator size="small" color={primaryContrast} />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={18}
                          color={selectedCount > 0 ? primaryContrast : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.primaryBtnText,
                            { color: selectedCount > 0 ? primaryContrast : theme.colors.textMuted },
                          ]}
                        >
                          INVIA A MYANIMELIST ({selectedCount})
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isConfirmVisible}
        title="CONFERMA INVIO A MAL"
        message={`VUOI AGGIORNARE ${selectedCount} ${
          selectedCount === 1 ? 'TITOLO' : 'TITOLI'
        } SU MYANIMELIST? LO STORICO LOCALE DI KUROTV NON VERRÀ MODIFICATO.`}
        icon="cloud-upload-outline"
        iconColor={theme.colors.primary}
        confirmText="SINCRONIZZA"
        confirmColor={theme.colors.primary}
        onConfirm={handleApplyConfirmed}
        onCancel={() => setIsConfirmVisible(false)}
      />
    </>
  );
};
