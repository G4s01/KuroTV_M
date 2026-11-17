import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { oledTheme } from '@/theme';
import type { AniSkipResult } from '@/types';
import { PlayerTimeline, PlayerTimeDisplay } from './PlayerTimeline';

export interface PlayerFooterProps {
  insets: {
    bottom: number;
    left: number;
    right: number;
  };
  player: any;
  duration: number;
  initialTime?: number;
  playbackSpeed: number;
  isLandscape: boolean;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
  textColor: string;
  thumbnail?: string;
  onSeek: (targetTime: number) => void;
  onCycleSpeed: () => void;
  onOpenSpeedSheet: () => void;
  onToggleFullscreen: () => void;
  onOpenEpisodes?: () => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
  aniSkipResults?: AniSkipResult[];
  isLocalSource?: boolean;
  videoUrl?: string;
}

export const PlayerFooter = React.memo<PlayerFooterProps>(function PlayerFooter({
  insets,
  player,
  duration,
  initialTime = 0,
  playbackSpeed,
  isLandscape,
  primaryColor,
  cardColor,
  borderColor,
  textColor,
  thumbnail,
  onSeek,
  onCycleSpeed,
  onOpenSpeedSheet,
  onToggleFullscreen,
  onOpenEpisodes,
  onScrubbingChange,
  aniSkipResults,
  isLocalSource = false,
  videoUrl,
}) {
  const [currentTime, setCurrentTime] = React.useState<number>(() => {
    if (typeof player?.currentTime === 'number' && !isNaN(player.currentTime)) {
      return player.currentTime;
    }
    return initialTime;
  });

  const isScrubbingRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof initialTime === 'number' && !isNaN(initialTime)) {
      setCurrentTime(initialTime);
    }
  }, [initialTime]);

  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    if (!isScrubbingRef.current) {
      setCurrentTime(time);
    }
  });

  const handleScrubbingChange = React.useCallback(
    (isScrubbing: boolean) => {
      isScrubbingRef.current = isScrubbing;
      onScrubbingChange?.(isScrubbing);
    },
    [onScrubbingChange]
  );

  const handleTimelineSeek = (targetTime: number) => {
    setCurrentTime(targetTime);
    onSeek(targetTime);
  };

  return (
    <View
      style={[
        styles.osdFooter,
        {
          paddingBottom: Math.max(16, insets.bottom),
          paddingLeft: Math.max(16, insets.left),
          paddingRight: Math.max(16, insets.right),
        },
      ]}
    >
      <PlayerTimeline
        player={player}
        duration={duration}
        primaryColor={primaryColor}
        onSeek={handleTimelineSeek}
        currentTime={currentTime}
        initialTime={initialTime}
        thumbnail={thumbnail}
        onScrubbingChange={handleScrubbingChange}
        aniSkipResults={aniSkipResults}
        isLocalSource={isLocalSource}
        videoUrl={videoUrl}
      />

      <View style={styles.footerControls}>
        <PlayerTimeDisplay
          player={player}
          duration={duration}
          currentTime={currentTime}
          initialTime={initialTime}
        />

        <View style={styles.footerRight}>
          {onOpenEpisodes && (
            <Pressable
              style={styles.fullscreenBtn}
              onPress={onOpenEpisodes}
              hitSlop={8}
              accessibilityLabel="LISTA EPISODI"
            >
              <Ionicons name="list-outline" size={22} color="#FFFFFF" />
            </Pressable>
          )}

          <Pressable
            style={[
              styles.speedBtn,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
            onPress={onCycleSpeed}
            onLongPress={onOpenSpeedSheet}
            hitSlop={8}
            accessibilityLabel={`VELOCITÀ ${playbackSpeed}X. TOCCA PER CAMBIARE, TIENI PREMUTO PER OPZIONI`}
          >
            <Text style={[styles.speedBtnText, { color: textColor }]}>
              {playbackSpeed}X
            </Text>
          </Pressable>

          <Pressable
            style={styles.fullscreenBtn}
            onPress={onToggleFullscreen}
            hitSlop={8}
            accessibilityLabel={
              isLandscape
                ? 'PASSA A VISUALIZZAZIONE VERTICALE'
                : 'PASSA A VISUALIZZAZIONE ORIZZONTALE'
            }
          >
            <Ionicons
              name={isLandscape ? 'phone-portrait-outline' : 'phone-landscape-outline'}
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  osdFooter: {
    paddingTop: 8,
  },
  footerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: oledTheme.radius.full,
    borderWidth: 1,
    minHeight: oledTheme.spacing.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  fullscreenBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
