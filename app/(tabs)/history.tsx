import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppStorage } from '@/services/storage';
import { oledTheme, useTheme } from '@/theme';
import type { WatchHistoryItem } from '@/types';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [history, setHistory] = React.useState<WatchHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadHistory = React.useCallback(() => {
    const list = AppStorage.getWatchHistory();
    setHistory(list);
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    loadHistory();
    setTimeout(() => setIsRefreshing(false), 300);
  }, [loadHistory]);

  const handleClearHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      'Svuota Cronologia',
      'Vuoi davvero cancellare tutta la cronologia di visione? L\'operazione non è reversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Cancella Tutto',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            AppStorage.clearWatchHistory();
            loadHistory();
          },
        },
      ]
    );
  };

  const resumePlayback = (item: WatchHistoryItem) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/player/[id]',
      params: {
        id: item.episodeId,
        animeId: item.animeId,
        episodeNumber: String(item.episodeNumber),
        animeTitle: item.title,
      },
    });
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Cronologia</Text>
          {history.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>{history.length}</Text>
            </View>
          )}
        </View>

        {history.length > 0 && (
          <Pressable
            style={styles.clearBtn}
            onPress={handleClearHistory}
            hitSlop={8}
            accessibilityLabel="Svuota cronologia"
          >
            <Ionicons name="trash-outline" size={20} color={oledTheme.colors.error} />
          </Pressable>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="time-outline" size={48} color={oledTheme.colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nessuna cronologia</Text>
          <Text style={styles.emptySubtitle}>
            Gli anime e gli episodi che guardi appariranno qui con il punto esatto di interruzione.
          </Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlashList
            data={history}
            keyExtractor={(item) => `${item.animeId}-${item.episodeId}`}
            renderItem={({ item }) => {
              const progress = Math.min(100, item.progressPercent || 0);
              const isDone = progress >= 90;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.historyItem,
                    pressed && styles.itemPressed,
                  ]}
                  onPress={() => resumePlayback(item)}
                >
                  <View style={styles.posterWrapper}>
                    {item.thumbnail ? (
                      <Image
                        source={{ uri: item.thumbnail }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]}>
                        <Ionicons name="film-outline" size={20} color="#777" />
                      </View>
                    )}
                    <View style={styles.itemProgressTrack}>
                      <View
                        style={[
                          styles.itemProgressBar,
                          { width: `${progress}%`, backgroundColor: theme.colors.primary },
                          isDone && styles.itemProgressDone,
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.info}>
                    <Text style={styles.animeTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.episodeText}>
                      Episodio {item.episodeNumber} {isDone ? '• Completato' : `• ${progress}%`}
                    </Text>
                    {item.updatedAt ? (
                      <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.playBtn, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="play" size={16} color="#FFFFFF" />
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appBar: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    borderColor: '#333333',
  },
  countBadgeText: {
    color: oledTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: oledTheme.colors.surface,
    padding: 12,
    borderRadius: oledTheme.radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262626',
    minHeight: oledTheme.spacing.minTouchTarget,
  },
  itemPressed: {
    opacity: 0.85,
    backgroundColor: '#1F1F1F',
  },
  posterWrapper: {
    width: 60,
    height: 60,
    borderRadius: oledTheme.radius.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  itemProgressBar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  itemProgressDone: {
    backgroundColor: oledTheme.colors.success,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  animeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  episodeText: {
    color: oledTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  dateText: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: oledTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
