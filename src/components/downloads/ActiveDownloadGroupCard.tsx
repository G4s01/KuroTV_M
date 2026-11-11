import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { downloadsStyles as styles } from './downloads.styles';
import { ActiveDownloadCard } from './ActiveDownloadCard';
import type { DownloadItem } from '@/services/downloads';

export interface ActiveAnimeDownloadGroup {
  animeId: string;
  animeTitle: string;
  animeThumbnail: string;
  items: DownloadItem[];
  hasDownloading: boolean;
  primaryStatusPriority: number;
  earliestCreatedAt: number;
}

export interface ActiveDownloadGroupCardProps {
  group: ActiveAnimeDownloadGroup;
  hasMultipleSeries: boolean;
  isSeriesExpanded: boolean;
  onToggleSeriesExpand: (animeId: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onCancelGroup: (group: ActiveAnimeDownloadGroup) => void;
}

function getCompactStatusInfo(
  item: DownloadItem,
  colors: {
    primary: string;
    warning: string;
    error: string;
    textMuted: string;
  }
) {
  if (item.status === 'downloading') {
    return {
      label: `IN CORSO • ${item.progress}%`,
      color: colors.primary,
    };
  }
  if (item.status === 'paused') {
    return {
      label:
        item.progress > 0 ? `IN PAUSA • ${item.progress}%` : 'IN PAUSA',
      color: colors.warning,
    };
  }
  if (item.status === 'error') {
    return {
      label: item.error ? item.error.toUpperCase() : 'ERRORE',
      color: colors.error,
    };
  }
  return {
    label: 'IN CODA',
    color: colors.textMuted,
  };
}

export const ActiveDownloadGroupCard = React.memo<ActiveDownloadGroupCardProps>(
  function ActiveDownloadGroupCard({
    group,
    hasMultipleSeries,
    isSeriesExpanded,
    onToggleSeriesExpand,
    onPause,
    onResume,
    onCancel,
    onCancelGroup,
  }) {
    const { theme } = useTheme();
    const [isQueueExpanded, setIsQueueExpanded] = React.useState(false);

    const leadItem = group.items[0];
    const remainingItems = React.useMemo(
      () => (group.items.length > 1 ? group.items.slice(1) : []),
      [group.items]
    );

    if (!leadItem) return null;

    const leadStatus = getCompactStatusInfo(leadItem, theme.colors);
    const shouldShowBody = !hasMultipleSeries || isSeriesExpanded;

    const firstQueueEp = remainingItems[0]?.episodeNumber;
    const lastQueueEp = remainingItems[remainingItems.length - 1]?.episodeNumber;
    const queueRangeLabel =
      remainingItems.length > 1 &&
      firstQueueEp !== undefined &&
      lastQueueEp !== undefined &&
      firstQueueEp !== lastQueueEp
        ? `EP. ${firstQueueEp}-${lastQueueEp}`
        : firstQueueEp !== undefined
        ? `EP. ${firstQueueEp}`
        : '';

    const seriesSummary = group.hasDownloading
      ? `IN CORSO EP. ${leadItem.episodeNumber} (${leadItem.progress}%) • ${group.items.length} EP.`
      : `${group.items.length} ${group.items.length === 1 ? 'EPISODIO' : 'EPISODI'} • ${leadStatus.label}`;

    return (
      <View style={styles.activeGroupContainer}>
        {/* Header espandibile serie quando ci sono più anime in coda/download */}
        {hasMultipleSeries && (
          <View
            style={[
              styles.seriesAccordionHeader,
              {
                backgroundColor: theme.colors.surface,
                borderColor: group.hasDownloading
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
          >
            <Pressable
              style={styles.seriesAccordionToggleArea}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggleSeriesExpand(group.animeId);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: isSeriesExpanded }}
              accessibilityLabel={`${isSeriesExpanded ? 'COMPRIMI' : 'ESPANDI'} DOWNLOAD DI ${group.animeTitle}`}
            >
              <Image
                source={
                  group.animeThumbnail ? { uri: group.animeThumbnail } : undefined
                }
                style={styles.seriesAccordionPoster}
                contentFit="cover"
                recyclingKey={`${group.animeId}-active-hdr`}
              />

              <View style={styles.seriesAccordionMeta}>
                <Text
                  style={[styles.seriesAccordionTitle, { color: theme.colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {group.animeTitle}
                </Text>
                <Text
                  style={[
                    styles.seriesAccordionSub,
                    {
                      color: group.hasDownloading
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {seriesSummary}
                </Text>
              </View>

              <View style={styles.seriesChevronBox}>
                <Ionicons
                  name={isSeriesExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={
                    group.hasDownloading
                      ? theme.colors.primary
                      : theme.colors.textMuted
                  }
                />
              </View>
            </Pressable>

            <Pressable
              style={styles.seriesCancelGroupBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onCancelGroup(group);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`ANNULLA TUTTI I ${group.items.length} EPISODI IN DOWNLOAD DI ${group.animeTitle}`}
            >
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={theme.colors.error}
              />
            </Pressable>
          </View>
        )}

        {/* Corpo visibile quando la serie è espansa o è l'unica in download */}
        {shouldShowBody && (
          <View style={hasMultipleSeries ? styles.seriesExpandedBody : undefined}>
            {/* Episodio principale in cima (in corso se presente, o primo episodio crescente) */}
            <ActiveDownloadCard
              item={leadItem}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              containerStyle={{ marginBottom: 0 }}
            />

            {/* Elemento espandibile dedicato se ci sono più episodi in coda nella serie */}
            {remainingItems.length > 0 && (
              <>
                <Pressable
                  style={[
                    styles.queueAccordionBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setIsQueueExpanded((prev) => !prev);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isQueueExpanded }}
                  accessibilityLabel={`${isQueueExpanded ? 'NASCONDI' : 'MOSTRA'} ${remainingItems.length} EPISODI IN CODA DI ${group.animeTitle}`}
                >
                  <View style={styles.queueAccordionLeft}>
                    <Ionicons
                      name="layers-outline"
                      size={15}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.queueAccordionLabel,
                        { color: theme.colors.text },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      ALTRI {remainingItems.length}{' '}
                      {remainingItems.length === 1 ? 'EPISODIO' : 'EPISODI'} IN CODA
                      {queueRangeLabel ? ` • ${queueRangeLabel}` : ''}
                    </Text>
                  </View>

                  <Ionicons
                    name={isQueueExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </Pressable>

                <Pressable
                  style={[
                    styles.cancelGroupBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onCancelGroup(group);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`ANNULLA TUTTI I ${group.items.length} EPISODI IN DOWNLOAD DI ${group.animeTitle}`}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[
                      styles.cancelGroupBtnText,
                      { color: theme.colors.error },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    ANNULLA TUTTI ({group.items.length} EP.)
                  </Text>
                </Pressable>

                {isQueueExpanded && (
                  <View
                    style={[
                      styles.queueEpisodesDrawer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    {remainingItems.map((subItem, idx) => {
                      const subStatus = getCompactStatusInfo(
                        subItem,
                        theme.colors
                      );
                      const isLast = idx === remainingItems.length - 1;
                      const isPausedOrError =
                        subItem.status === 'paused' ||
                        subItem.status === 'error';

                      return (
                        <View
                          key={subItem.id}
                          style={[
                            styles.queuedEpisodeRow,
                            {
                              borderBottomColor: theme.colors.border,
                            },
                            isLast && { borderBottomWidth: 0 },
                          ]}
                        >
                          <View style={styles.queuedEpisodeInfo}>
                            <Text
                              style={[
                                styles.queuedEpisodeTitle,
                                { color: theme.colors.text },
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {subItem.episodeTitle ||
                                `EPISODIO ${subItem.episodeNumber}`}
                            </Text>
                            <Text
                              style={[
                                styles.queuedEpisodeStatus,
                                { color: subStatus.color },
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {subStatus.label}
                            </Text>
                          </View>

                          <View style={styles.queuedEpisodeActions}>
                            {subItem.status === 'downloading' ? (
                              <Pressable
                                style={styles.activeActionBtn}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  onPause(subItem.id);
                                }}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`METTI IN PAUSA EPISODIO ${subItem.episodeNumber}`}
                              >
                                <Ionicons
                                  name="pause"
                                  size={18}
                                  color={theme.colors.warning}
                                />
                              </Pressable>
                            ) : isPausedOrError ? (
                              <Pressable
                                style={styles.activeActionBtn}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  onResume(subItem.id);
                                }}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`RIPRENDI EPISODIO ${subItem.episodeNumber}`}
                              >
                                <Ionicons
                                  name="play"
                                  size={18}
                                  color={theme.colors.primary}
                                />
                              </Pressable>
                            ) : (
                              <Pressable
                                style={styles.activeActionBtn}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  onPause(subItem.id);
                                }}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`METTI IN PAUSA EPISODIO ${subItem.episodeNumber}`}
                              >
                                <Ionicons
                                  name="pause-outline"
                                  size={18}
                                  color={theme.colors.textSecondary}
                                />
                              </Pressable>
                            )}

                            <Pressable
                              style={styles.activeActionBtn}
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                onCancel(subItem.id);
                              }}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`ANNULLA EPISODIO ${subItem.episodeNumber}`}
                            >
                              <Ionicons
                                name="close"
                                size={18}
                                color={theme.colors.textMuted}
                              />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  }
);
