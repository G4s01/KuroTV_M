import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { useBottomSheetDragDismiss } from '../useBottomSheetDragDismiss';
import { downloadsStyles as styles } from './downloads.styles';
import {
  formatDownloadBytes,
  type DownloadedAnimeGroup,
  type DownloadItem,
} from '@/services/downloads';

export interface DownloadedEpisodesSheetProps {
  visible: boolean;
  group: DownloadedAnimeGroup | null;
  onClose: () => void;
  onPlayEpisode: (item: DownloadItem) => void;
  onDeleteEpisode: (item: DownloadItem) => void;
}

export const DownloadedEpisodesSheet = React.memo<DownloadedEpisodesSheetProps>(
  function DownloadedEpisodesSheet({
    visible,
    group,
    onClose,
    onPlayEpisode,
    onDeleteEpisode,
  }) {
    const { theme } = useTheme();
    const playIconColor = getContrastTextColor(theme.colors.primary);

    const { translateY, dragStripHandlers, headerPanHandlers } =
      useBottomSheetDragDismiss({
        isVisible: visible,
        onClose,
      });

    if (!group) return null;

    const renderEpisodeItem = ({ item }: { item: DownloadItem }) => {
      const sizeFormatted = formatDownloadBytes(item.totalBytes || item.downloadedBytes);

      return (
        <View
          style={[
            styles.episodeRow,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.episodeRowLeft}>
            <Text
              style={[styles.episodeRowTitle, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {item.episodeTitle || `EPISODIO ${item.episodeNumber}`}
            </Text>
            <Text
              style={[
                styles.episodeRowMeta,
                { color: theme.colors.textSecondary },
              ]}
            >
              EP. {item.episodeNumber} • {sizeFormatted}
            </Text>
          </View>

          <View style={styles.episodeRowActions}>
            <Pressable
              style={[
                styles.episodePlayBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPlayEpisode(item);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`RIPRODUCI EPISODIO ${item.episodeNumber}`}
            >
              <Ionicons name="play" size={16} color={playIconColor} />
            </Pressable>

            <Pressable
              style={styles.episodeDeleteBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onDeleteEpisode(item);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`ELIMINA EPISODIO ${item.episodeNumber}`}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      );
    };

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Drag Handle Area */}
            <View {...dragStripHandlers} style={styles.dragStripArea}>
              <View style={styles.dragIndicator} />
            </View>

            {/* Header */}
            <View
              {...headerPanHandlers}
              style={[
                styles.sheetHeader,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              <Text
                style={[styles.sheetHeaderTitle, { color: theme.colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {group.animeTitle}
              </Text>

              <Pressable
                style={styles.sheetCloseBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onClose();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI ELENCO EPISODI"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </View>

            {/* FlashList of Episodes */}
            <View style={{ minHeight: 180, maxHeight: 420 }}>
              <FlashList
                data={group.episodes}
                renderItem={renderEpisodeItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.sheetListContent}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }
);
