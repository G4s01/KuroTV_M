import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { AppStorage } from '@/services/storage';
import {
  DownloadService,
  type DownloadItem,
  type DownloadedAnimeGroup,
  type StorageUsageInfo,
} from '@/services/downloads';
import {
  downloadsStyles as styles,
  StorageUsageBar,
  ActiveDownloadGroupCard,
  DownloadedAnimeCard,
  DownloadedEpisodesSheet,
  type ActiveAnimeDownloadGroup,
} from '@/components/downloads';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function DownloadsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [allDownloads, setAllDownloads] = useState<DownloadItem[]>(() =>
    DownloadService.getAllDownloads()
  );
  const [animeGroups, setAnimeGroups] = useState<DownloadedAnimeGroup[]>(() =>
    DownloadService.getDownloadedAnimeList()
  );
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo>({
    appDownloadsBytes: 0,
    appDownloadsFormatted: '0 B',
  });

  const [selectedGroup, setSelectedGroup] = useState<DownloadedAnimeGroup | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [userExpandedSeries, setUserExpandedSeries] = useState<Record<string, boolean>>({});

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'CONFERMA',
    onConfirm: () => {},
  });

  // Refresh storage info
  const refreshStorage = useCallback(() => {
    DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
  }, []);

  // Listen to download list & progress changes
  useEffect(() => {
    refreshStorage();

    const unsubList = DownloadService.addListListener((items) => {
      setAllDownloads(items);
      const groups = DownloadService.getDownloadedAnimeList();
      setAnimeGroups(groups);
      refreshStorage();

      // If active group is open in sheet, update its reference
      setSelectedGroup((prev) => {
        if (!prev) return null;
        const updated = groups.find((g) => g.animeId === prev.animeId);
        return updated || null;
      });
    });

    const unsubProgress = DownloadService.addProgressListener((updatedItem) => {
      setAllDownloads((prev) =>
        prev.map((it) => (it.id === updatedItem.id ? { ...updatedItem } : it))
      );
    });

    return () => {
      unsubList();
      unsubProgress();
    };
  }, [refreshStorage]);

  // Separate active/queued from completed and group by anime with ascending episode ordering
  const activeDownloads = useMemo(() => {
    return allDownloads.filter((item) => item.status !== 'completed');
  }, [allDownloads]);

  const activeAnimeGroups = useMemo<ActiveAnimeDownloadGroup[]>(() => {
    const statusPriority = (status: DownloadItem['status']) => {
      if (status === 'downloading') return 0;
      if (status === 'queued') return 1;
      if (status === 'paused') return 2;
      return 3;
    };

    const groupsMap = new Map<string, ActiveAnimeDownloadGroup>();

    for (const item of activeDownloads) {
      let group = groupsMap.get(item.animeId);
      if (!group) {
        group = {
          animeId: item.animeId,
          animeTitle: item.animeTitle,
          animeThumbnail: item.animeThumbnail,
          items: [],
          hasDownloading: false,
          primaryStatusPriority: 3,
          earliestCreatedAt: item.createdAt,
        };
        groupsMap.set(item.animeId, group);
      }

      group.items.push(item);
      if (item.status === 'downloading') {
        group.hasDownloading = true;
      }
      const p = statusPriority(item.status);
      if (p < group.primaryStatusPriority) {
        group.primaryStatusPriority = p;
      }
      if (item.createdAt < group.earliestCreatedAt) {
        group.earliestCreatedAt = item.createdAt;
      }
    }

    // Inside each series: active downloading episode ALWAYS first, then ascending by episode number
    const groups = Array.from(groupsMap.values());
    for (const group of groups) {
      group.items.sort((a, b) => {
        const aDownloading = a.status === 'downloading' ? 0 : 1;
        const bDownloading = b.status === 'downloading' ? 0 : 1;
        if (aDownloading !== bDownloading) {
          return aDownloading - bDownloading;
        }
        return a.episodeNumber - b.episodeNumber;
      });
    }

    // Across multiple series: currently downloading series first, then FIFO queue order
    groups.sort((a, b) => {
      if (a.hasDownloading !== b.hasDownloading) {
        return a.hasDownloading ? -1 : 1;
      }
      if (a.primaryStatusPriority !== b.primaryStatusPriority) {
        return a.primaryStatusPriority - b.primaryStatusPriority;
      }
      if (a.earliestCreatedAt !== b.earliestCreatedAt) {
        return a.earliestCreatedAt - b.earliestCreatedAt;
      }
      return a.animeTitle.localeCompare(b.animeTitle);
    });

    return groups;
  }, [activeDownloads]);

  const handleToggleSeriesExpand = useCallback(
    (animeId: string, defaultExpanded: boolean) => {
      setUserExpandedSeries((prev) => {
        const current = prev[animeId] ?? defaultExpanded;
        return { ...prev, [animeId]: !current };
      });
    },
    []
  );

  // Handlers for active downloads
  const handlePause = useCallback((id: string) => {
    DownloadService.pauseDownload(id);
  }, []);

  const handleResume = useCallback((id: string) => {
    DownloadService.resumeDownload(id);
  }, []);

  const handleCancel = useCallback((id: string) => {
    setConfirmConfig({
      visible: true,
      title: 'ANNULLA DOWNLOAD',
      message: 'ANNULLARE IL DOWNLOAD DI QUESTO EPISODIO?',
      confirmText: 'ANNULLA',
      onConfirm: () => {
        DownloadService.cancelDownload(id);
      },
    });
  }, []);

  // Handlers for downloaded content
  const handleOpenGroup = useCallback((group: DownloadedAnimeGroup) => {
    setSelectedGroup(group);
    setIsSheetVisible(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setIsSheetVisible(false);
  }, []);

  const handlePlayEpisode = useCallback(
    (item: DownloadItem) => {
      setIsSheetVisible(false);
      Haptics.selectionAsync().catch(() => {});
      const savedProg = AppStorage.getWatchProgress(item.animeId, item.episodeNumber);
      // Navigate to player with complete episode metadata and offline fallback URI
      router.push({
        pathname: '/player/[id]',
        params: {
          id: item.id,
          animeId: item.animeId,
          episodeNumber: String(item.episodeNumber),
          animeTitle: item.animeTitle,
          thumbnail: item.animeThumbnail || '',
          position: String(savedProg && !savedProg.isCompleted ? savedProg.currentTime : 0),
          offline: '1',
          localUri: item.fileUri,
        },
      });
    },
    [router]
  );

  const handlePlayNext = useCallback(
    (group: DownloadedAnimeGroup) => {
      if (group.episodes.length > 0) {
        handlePlayEpisode(group.episodes[0]);
      }
    },
    [handlePlayEpisode]
  );

  const handleDeleteEpisode = useCallback(
    (item: DownloadItem) => {
      setConfirmConfig({
        visible: true,
        title: 'ELIMINA EPISODIO',
        message: `ELIMINARE ${item.episodeTitle.toUpperCase()}?`,
        confirmText: 'ELIMINA',
        onConfirm: () => {
          DownloadService.deleteDownload(item.id);
        },
      });
    },
    []
  );

  const handleDeleteGroup = useCallback(
    (group: DownloadedAnimeGroup) => {
      setConfirmConfig({
        visible: true,
        title: 'ELIMINA SERIE',
        message: `ELIMINARE I ${group.episodesCount} EPISODI DI ${group.animeTitle}?`,
        confirmText: 'ELIMINA',
        onConfirm: () => {
          DownloadService.deleteAnimeDownloads(group.animeId);
          if (selectedGroup?.animeId === group.animeId) {
            setIsSheetVisible(false);
          }
        },
      });
    },
    [selectedGroup]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(16, insets.top),
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="TORNA INDIETRO"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              SCARICATI
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}
            >
              CONTENUTI OFFLINE
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.headerSettingsBtn}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push({
              pathname: '/(tabs)/settings',
              params: { scrollTo: 'downloads' },
            });
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="APRI IMPOSTAZIONI SCARICATI"
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(40, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Bar */}
        <StorageUsageBar storage={storageInfo} />

        {/* Downloaded Content Library (Prima Sezione) */}
        <View style={activeAnimeGroups.length > 0 ? { marginBottom: 18 } : undefined}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              EPISODI SALVATI
            </Text>
            {animeGroups.length > 0 && (
              <View
                style={[
                  styles.sectionBadge,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionBadgeText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {animeGroups.length} {animeGroups.length === 1 ? 'SERIE' : 'SERIE'}
                </Text>
              </View>
            )}
          </View>

          {animeGroups.length === 0 ? (
            activeAnimeGroups.length > 0 ? (
              <View
                style={[
                  styles.emptyCompactCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color={theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.emptyCompactText,
                    { color: theme.colors.textMuted },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  NESSUN EPISODIO ANCORA COMPLETATO
                </Text>
              </View>
            ) : (
              <View style={styles.emptyWrapper}>
                <View
                  style={[
                    styles.emptyIconBox,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={32}
                    color={theme.colors.textMuted}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  NESSUN CONTENUTO SCARICATO
                </Text>
                <Text
                  style={[
                    styles.emptyDescription,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  SCARICA PUNTATE DALLA SCHEDA ANIME O DAL PLAYER PER LA VISIONE OFFLINE.
                </Text>
              </View>
            )
          ) : (
            animeGroups.map((group) => (
              <DownloadedAnimeCard
                key={group.animeId}
                group={group}
                onPress={handleOpenGroup}
                onPlayNext={handlePlayNext}
                onDeleteGroup={handleDeleteGroup}
              />
            ))
          )}
        </View>

        {/* Active & Queued Downloads (Seconda Sezione, ordinata con episodi espandibili) */}
        {activeAnimeGroups.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                IN CORSO & IN CODA
              </Text>
              <View
                style={[
                  styles.sectionBadge,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionBadgeText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {activeDownloads.length} ATTIVI
                </Text>
              </View>
            </View>

            {activeAnimeGroups.map((group, idx) => {
              const hasMultipleSeries = activeAnimeGroups.length > 1;
              const defaultExpanded = group.hasDownloading || idx === 0;
              const isSeriesExpanded =
                userExpandedSeries[group.animeId] ?? defaultExpanded;

              return (
                <ActiveDownloadGroupCard
                  key={group.animeId}
                  group={group}
                  hasMultipleSeries={hasMultipleSeries}
                  isSeriesExpanded={isSeriesExpanded}
                  onToggleSeriesExpand={(id) =>
                    handleToggleSeriesExpand(id, defaultExpanded)
                  }
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Episodes List BottomSheet */}
      <DownloadedEpisodesSheet
        visible={isSheetVisible}
        group={selectedGroup}
        onClose={handleCloseSheet}
        onPlayEpisode={handlePlayEpisode}
        onDeleteEpisode={handleDeleteEpisode}
      />

      {/* Unified Confirm Modal */}
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig((prev) => ({ ...prev, visible: false }));
        }}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
