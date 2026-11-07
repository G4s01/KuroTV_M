import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppStorage } from '@/services/storage';
import { oledTheme } from '@/theme';
import type { WatchHistoryItem } from '@/types';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
              <Text style={styles.countBadgeText}>{history.length}</Text>
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
                        resizeMode="cover"
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
                          { width: `${progress}%` },
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

                  <View style={styles.playBtn}>
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
                tintColor={oledTheme.colors.primary}
                colors={[oledTheme.colors.primary]}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  countBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: oledTheme.radius.full,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: oledTheme.colors.surface,
    padding: 10,
    borderRadius: oledTheme.radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
    minHeight: 64,
  },
  itemPressed: {
    opacity: 0.8,
  },
  posterWrapper: {
    width: 90,
    height: 56,
    borderRadius: oledTheme.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
    marginRight: 12,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  },
  animeTitle: {
    color: oledTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  episodeText: {
    color: oledTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  dateText: {
    color: oledTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: oledTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: oledTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
