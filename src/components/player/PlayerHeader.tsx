import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

export interface PlayerHeaderProps {
  animeTitle: string;
  episodeNumber: number;
  insets: {
    top: number;
    left: number;
    right: number;
  };
  isOffline?: boolean;
  downloadStatus?: 'none' | 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
  downloadProgress?: number;
  onDownloadPress?: () => void;
  onBack: () => void;
  onStartPiP: () => void;
  onOpenOptions: () => void;
  onOpenInfo?: () => void;
}

export const PlayerHeader = React.memo<PlayerHeaderProps>(function PlayerHeader({
  animeTitle,
  episodeNumber,
  insets,
  isOffline = false,
  downloadStatus = 'none',
  downloadProgress = 0,
  onDownloadPress,
  onBack,
  onStartPiP,
  onOpenOptions,
  onOpenInfo,
}) {
  return (
    <View
      style={[
        styles.osdHeader,
        {
          paddingTop: Math.max(16, insets.top),
          paddingLeft: Math.max(16, insets.left),
          paddingRight: Math.max(16, insets.right),
        },
      ]}
    >
      <Pressable
        style={styles.osdBackBtn}
        onPress={onBack}
        hitSlop={12}
        accessibilityLabel="ESCI DAL PLAYER"
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </Pressable>

      <View style={styles.osdTitleWrapper}>
        <Text style={styles.osdTitle} numberOfLines={1}>
          {animeTitle}
        </Text>
        <Text style={styles.osdSubtitle}>
          EPISODIO {episodeNumber}
          {isOffline && ' • LOCALE / OFFLINE'}
        </Text>
      </View>

      <View style={styles.osdHeaderActions}>
        {onDownloadPress && (
          <Pressable
            style={styles.osdIconBtn}
            onPress={onDownloadPress}
            hitSlop={8}
            accessibilityLabel={
              downloadStatus === 'completed'
                ? 'EPISODIO SCARICATO IN LOCALE'
                : downloadStatus === 'downloading'
                ? `DOWNLOAD IN CORSO ${downloadProgress}%`
                : 'SCARICA EPISODIO'
            }
          >
            {downloadStatus === 'completed' ? (
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            ) : downloadStatus === 'downloading' ? (
              <Ionicons name="cloud-download" size={22} color="#3B82F6" />
            ) : downloadStatus === 'queued' ? (
              <Ionicons name="time-outline" size={22} color="#F59E0B" />
            ) : (
              <Ionicons name="cloud-download-outline" size={22} color="#FFFFFF" />
            )}
          </Pressable>
        )}

        {onOpenInfo && (
          <Pressable
            style={styles.osdIconBtn}
            onPress={onOpenInfo}
            hitSlop={8}
            accessibilityLabel="INFORMAZIONI EPISODIO E ANIME"
          >
            <Ionicons name="information-circle-outline" size={22} color="#FFFFFF" />
          </Pressable>
        )}

        <Pressable
          style={styles.osdIconBtn}
          onPress={onStartPiP}
          hitSlop={8}
          accessibilityLabel="PICTURE IN PICTURE"
        >
          <Ionicons name="open-outline" size={22} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={styles.osdIconBtn}
          onPress={onOpenOptions}
          hitSlop={8}
          accessibilityLabel="OPZIONI RIPRODUZIONE E VELOCITÀ"
        >
          <Ionicons name="options" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  osdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  osdBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  osdTitleWrapper: {
    flex: 1,
    marginHorizontal: 16,
  },
  osdTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
  },
  osdSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  osdHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  osdIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
