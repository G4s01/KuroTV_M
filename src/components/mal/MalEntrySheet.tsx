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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useBottomSheetDragDismiss } from '@/components/useBottomSheetDragDismiss';
import { useResponsiveLayout } from '@/hooks';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MalClient,
  findEntryInMalListCache,
  getLocalCompletedEpisodesForAnime,
  parsePositiveTotalEpisodes,
  type MalAnimeListEntry,
  type MalEditableStatus,
} from '@/services/mal';
import { malStyles as styles } from './mal.styles';

export interface MalEntrySheetProps {
  isVisible: boolean;
  malId: number | null;
  animeId?: string;
  animeTitle: string;
  totalEpisodesHint?: number | string | null;
  thumbnail?: string;
  initialEntry?: MalAnimeListEntry | null;
  onClose: () => void;
  onUpdated?: (entry: MalAnimeListEntry | null) => void;
}

const STATUS_OPTIONS: Array<{ value: MalEditableStatus; label: string }> = [
  { value: 'watching', label: 'IN CORSO' },
  { value: 'plan_to_watch', label: 'DA GUARDARE' },
  { value: 'completed', label: 'COMPLETATI' },
  { value: 'on_hold', label: 'IN PAUSA' },
  { value: 'dropped', label: 'ABBANDONATO' },
];

export const MalEntrySheet: React.FC<MalEntrySheetProps> = ({
  isVisible,
  malId,
  animeId,
  animeTitle,
  totalEpisodesHint,
  thumbnail,
  initialEntry,
  onClose,
  onUpdated,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [isConfirmRemoveVisible, setIsConfirmRemoveVisible] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [existsOnMal, setExistsOnMal] = React.useState(false);
  const [knownTotalEpisodes, setKnownTotalEpisodes] = React.useState<number>(0);
  const [mediaStatus, setMediaStatus] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<MalEditableStatus>('plan_to_watch');
  const [watchedEpisodes, setWatchedEpisodes] = React.useState<number>(0);
  const [score, setScore] = React.useState<number>(0);

  const [localCompletedCount, setLocalCompletedCount] = React.useState<number>(0);
  const initialEntryRef = React.useRef(initialEntry);
  initialEntryRef.current = initialEntry;
  const cachedMetadataRef = React.useRef<Partial<MalAnimeListEntry> | null>(null);

  React.useEffect(() => {
    if (!isVisible || !malId || malId <= 0) return;

    let cancelled = false;
    setErrorMsg(null);

    const freshLocalCompleted = animeId ? getLocalCompletedEpisodesForAnime(animeId, malId) : 0;
    setLocalCompletedCount(freshLocalCompleted);

    const cached = initialEntryRef.current || findEntryInMalListCache(malId);
    cachedMetadataRef.current = cached || null;
    const parsedHintTotal = parsePositiveTotalEpisodes(totalEpisodesHint) || 0;
    if (cached) {
      setExistsOnMal(true);
      setStatus(cached.status);
      setWatchedEpisodes(cached.watchedEpisodes);
      setScore(cached.score);
      setKnownTotalEpisodes(cached.numEpisodes > 0 ? cached.numEpisodes : parsedHintTotal);
      setMediaStatus(cached.mediaStatus);
    } else {
      setExistsOnMal(false);
      setStatus(freshLocalCompleted > 0 ? 'watching' : 'plan_to_watch');
      setWatchedEpisodes(freshLocalCompleted > 0 ? freshLocalCompleted : 0);
      setScore(0);
      setKnownTotalEpisodes(parsedHintTotal);
      setMediaStatus(undefined);
    }

    setIsLoadingDetails(true);
    MalClient.getAnimeUserStatus(malId)
      .then((details) => {
        if (cancelled) return;
        const resolvedTotal = details.numEpisodes > 0 ? details.numEpisodes : parsedHintTotal;
        setKnownTotalEpisodes(resolvedTotal);
        setMediaStatus(details.mediaStatus);
        cachedMetadataRef.current = {
          ...(cachedMetadataRef.current || {}),
          mainPicture: details.mainPicture || cachedMetadataRef.current?.mainPicture,
          alternativeTitles:
            details.alternativeTitles || cachedMetadataRef.current?.alternativeTitles,
          mediaType: details.mediaType || cachedMetadataRef.current?.mediaType,
          mean: details.mean ?? cachedMetadataRef.current?.mean,
        };
        if (details.listEntry) {
          setExistsOnMal(true);
          setStatus(details.listEntry.status);
          setWatchedEpisodes(details.listEntry.watchedEpisodes);
          setScore(details.listEntry.score);
        } else {
          setExistsOnMal(false);
        }
      })
      .catch(() => {
        // Keep cached / local preview offline safely
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible, animeId, malId, totalEpisodesHint]);

  const { translateY, dragStripHandlers, headerPanHandlers } = useBottomSheetDragDismiss({
    isVisible,
    onClose,
  });

  const clampEp = React.useCallback(
    (val: number) => {
      const nonNeg = Math.max(0, Math.floor(val));
      return knownTotalEpisodes > 0 ? Math.min(knownTotalEpisodes, nonNeg) : nonNeg;
    },
    [knownTotalEpisodes]
  );

  const handleSelectStatus = React.useCallback(
    (nextStatus: MalEditableStatus) => {
      Haptics.selectionAsync().catch(() => {});
      setStatus(nextStatus);
      if (nextStatus === 'completed' && knownTotalEpisodes > 0) {
        setWatchedEpisodes(knownTotalEpisodes);
      }
    },
    [knownTotalEpisodes]
  );

  const handleAlignFromApp = React.useCallback(() => {
    if (localCompletedCount <= 0) return;
    Haptics.selectionAsync().catch(() => {});
    const clamped = clampEp(localCompletedCount);
    setWatchedEpisodes(clamped);
    const isOngoing =
      mediaStatus === 'currently_airing' || mediaStatus === 'not_yet_aired';
    if (knownTotalEpisodes > 0 && clamped >= knownTotalEpisodes && !isOngoing) {
      setStatus('completed');
    } else if (status === 'plan_to_watch') {
      setStatus('watching');
    }
  }, [localCompletedCount, clampEp, mediaStatus, knownTotalEpisodes, status]);

  const handleSave = React.useCallback(async () => {
    if (!malId || malId <= 0 || isSaving || isRemoving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const meta = cachedMetadataRef.current || findEntryInMalListCache(malId);
      const resolvedPicture =
        meta?.mainPicture || (thumbnail ? { medium: thumbnail, large: thumbnail } : undefined);
      const result = await MalClient.updateAnimeListStatus(malId, {
        status,
        numWatchedEpisodes: clampEp(watchedEpisodes),
        score,
        animeSnapshot: {
          malId,
          title: animeTitle,
          numEpisodes: knownTotalEpisodes,
          mediaStatus,
          mediaType: meta?.mediaType,
          mean: meta?.mean,
          alternativeTitles: meta?.alternativeTitles,
          mainPicture: resolvedPicture,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setExistsOnMal(true);
      onUpdated?.({
        malId,
        title: animeTitle,
        mainPicture: resolvedPicture,
        status: result.status,
        score: result.score,
        watchedEpisodes: result.watchedEpisodes,
        numEpisodes: knownTotalEpisodes,
        mediaStatus,
        mediaType: meta?.mediaType,
        mean: meta?.mean,
        alternativeTitles: meta?.alternativeTitles,
        updatedAt: result.updatedAt,
      });
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg((err?.message || 'IMPOSSIBILE SALVARE SU MYANIMELIST.').toUpperCase());
    } finally {
      setIsSaving(false);
    }
  }, [
    malId,
    isSaving,
    isRemoving,
    status,
    clampEp,
    watchedEpisodes,
    score,
    animeTitle,
    knownTotalEpisodes,
    mediaStatus,
    thumbnail,
    onUpdated,
    onClose,
  ]);

  const handleConfirmRemove = React.useCallback(async () => {
    setIsConfirmRemoveVisible(false);
    if (!malId || malId <= 0 || isRemoving) return;

    setIsRemoving(true);
    setErrorMsg(null);
    try {
      await MalClient.deleteAnimeListEntry(malId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setExistsOnMal(false);
      onUpdated?.(null);
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg((err?.message || 'IMPOSSIBILE RIMUOVERE DA MYANIMELIST.').toUpperCase());
    } finally {
      setIsRemoving(false);
    }
  }, [malId, isRemoving, onUpdated, onClose]);

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);
  const maxBodyHeight = isLandscape
    ? Math.min(240, windowHeight * 0.56)
    : Math.min(480, windowHeight * 0.68);

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
                maxWidth: 600,
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
                <Ionicons name="bookmark-outline" size={18} color={theme.colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sheetTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {animeTitle}
                  </Text>
                  <Text style={[styles.headerUsername, { color: theme.colors.textMuted }]}>
                    {knownTotalEpisodes > 0
                      ? `MYANIMELIST • ${knownTotalEpisodes} EPISODI TOTALI`
                      : 'MYANIMELIST • EPISODI TOTALI SCONOSCIUTI'}
                  </Text>
                </View>
              </View>

              {isLoadingDetails && (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              )}

              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI GESTIONE MYANIMELIST"
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: maxBodyHeight }}
              contentContainerStyle={{ paddingTop: 14, gap: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {/* Status Selector */}
              <View>
                <Text style={[styles.sheetSectionLabel, { color: theme.colors.textSecondary }]}>
                  STATO LISTA
                </Text>
                <View style={styles.statusGrid}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = status === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surface,
                            borderColor: active
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                        onPress={() => handleSelectStatus(opt.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`IMPOSTA STATO ${opt.label}`}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: active ? primaryContrast : theme.colors.text },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Episodes Stepper + Align from App */}
              <View style={{ gap: 8 }}>
                <Text
                  style={[
                    styles.sheetSectionLabel,
                    { color: theme.colors.textSecondary, marginBottom: 0 },
                  ]}
                >
                  EPISODI VISTI
                </Text>

                <View
                  style={[
                    styles.episodeStepperCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        opacity: watchedEpisodes <= 0 ? 0.45 : 1,
                      },
                    ]}
                    disabled={watchedEpisodes <= 0}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setWatchedEpisodes((v) => clampEp(v - 1));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="DIMINUISCI EPISODI VISTI"
                  >
                    <Ionicons name="remove" size={20} color={theme.colors.text} />
                  </Pressable>

                  <View style={styles.stepperValueBox}>
                    <Text style={[styles.stepperValueText, { color: theme.colors.text }]}>
                      {watchedEpisodes}
                      {knownTotalEpisodes > 0 ? ` / ${knownTotalEpisodes}` : ' / ?'}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        opacity:
                          knownTotalEpisodes > 0 && watchedEpisodes >= knownTotalEpisodes ? 0.45 : 1,
                      },
                    ]}
                    disabled={knownTotalEpisodes > 0 && watchedEpisodes >= knownTotalEpisodes}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setWatchedEpisodes((v) => clampEp(v + 1));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="AUMENTA EPISODI VISTI"
                  >
                    <Ionicons name="add" size={20} color={theme.colors.text} />
                  </Pressable>
                </View>

                {localCompletedCount > 0 && (
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: `${theme.colors.primary}18`,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={handleAlignFromApp}
                    accessibilityRole="button"
                    accessibilityLabel={`ALLINEA DA APP EPISODIO ${localCompletedCount}`}
                  >
                    <Ionicons name="sync-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.secondaryBtnText, { color: theme.colors.primary }]}>
                      ALLINEA DA APP (EP. {clampEp(localCompletedCount)})
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Score Selector (1..10 + 0 clear) */}
              <View>
                <Text style={[styles.sheetSectionLabel, { color: theme.colors.textSecondary }]}>
                  VOTO PERSONALE ({score > 0 ? `★ ${score}/10` : 'NESSUNO'})
                </Text>
                <View style={styles.scoreGrid}>
                  <Pressable
                    style={[
                      styles.scoreChip,
                      {
                        backgroundColor:
                          score === 0 ? theme.colors.primary : theme.colors.surface,
                        borderColor:
                          score === 0 ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setScore(0);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="RIMUOVI VOTO"
                  >
                    <Text
                      style={[
                        styles.scoreChipText,
                        { color: score === 0 ? primaryContrast : theme.colors.textMuted },
                      ]}
                    >
                      —
                    </Text>
                  </Pressable>

                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                    const active = score === val;
                    return (
                      <Pressable
                        key={val}
                        style={[
                          styles.scoreChip,
                          {
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surface,
                            borderColor: active
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setScore(val);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`VOTO ${val}`}
                      >
                        <Text
                          style={[
                            styles.scoreChipText,
                            { color: active ? primaryContrast : theme.colors.text },
                          ]}
                        >
                          {val}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {errorMsg ? (
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
                    {errorMsg}
                  </Text>
                </View>
              ) : null}

              {/* Save & Optional Delete */}
              <View style={{ gap: 8, paddingTop: 2 }}>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: isSaving || isRemoving ? 0.7 : 1,
                    },
                  ]}
                  disabled={isSaving || isRemoving}
                  onPress={handleSave}
                  accessibilityRole="button"
                  accessibilityLabel="SALVA SU MYANIMELIST"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={primaryContrast} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={primaryContrast} />
                      <Text style={[styles.primaryBtnText, { color: primaryContrast }]}>
                        SALVA SU MAL
                      </Text>
                    </>
                  )}
                </Pressable>

                {existsOnMal && (
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: `${theme.colors.error || '#EF4444'}14`,
                        borderColor: theme.colors.error || '#EF4444',
                      },
                    ]}
                    disabled={isSaving || isRemoving}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                        () => {}
                      );
                      setIsConfirmRemoveVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="RIMUOVI DA LISTA MYANIMELIST"
                  >
                    {isRemoving ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.error || '#EF4444'}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={theme.colors.error || '#EF4444'}
                        />
                        <Text
                          style={[
                            styles.secondaryBtnText,
                            { color: theme.colors.error || '#EF4444' },
                          ]}
                        >
                          RIMUOVI DA LISTA MAL
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isConfirmRemoveVisible}
        title="RIMUOVI DA MYANIMELIST"
        message={`VUOI RIMUOVERE "${animeTitle.toUpperCase()}" DALLA TUA LISTA SU MYANIMELIST?`}
        icon="trash-outline"
        confirmText="RIMUOVI"
        onConfirm={handleConfirmRemove}
        onCancel={() => setIsConfirmRemoveVisible(false)}
      />
    </>
  );
};
