import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme } from '@/theme';

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);

  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export interface PlayerTimelineProps {
  player: any;
  duration: number;
  primaryColor: string;
  onSeek: (targetTime: number) => void;
  initialTime?: number;
  currentTime?: number;
  thumbnail?: string;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

const PREVIEW_WIDTH = 120;
const PREVIEW_HALF = PREVIEW_WIDTH / 2;

export const PlayerTimeline = React.memo<PlayerTimelineProps>(function PlayerTimeline({
  player,
  duration,
  primaryColor,
  onSeek,
  initialTime = 0,
  currentTime: controlledTime,
  thumbnail,
  onScrubbingChange,
}) {
  const [internalTime, setInternalTime] = React.useState<number>(() => {
    if (typeof controlledTime === 'number' && !isNaN(controlledTime)) {
      return controlledTime;
    }
    if (typeof player?.currentTime === 'number' && !isNaN(player.currentTime)) {
      return player.currentTime;
    }
    return initialTime;
  });
  const [timelineWidth, setTimelineWidth] = React.useState(1);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [scrubPosition, setScrubPosition] = React.useState<{ time: number; x: number } | null>(null);

  // Real frame thumbnail extraction during scrubbing
  const [frameThumbnail, setFrameThumbnail] = React.useState<any>(null);
  const thumbnailCache = React.useRef<Map<number, any>>(new Map());
  const isGeneratingRef = React.useRef(false);
  const pendingTimeRef = React.useRef<number | null>(null);
  const latestRequestedTimeRef = React.useRef<number | null>(null);

  const isScrubbingRef = React.useRef(false);
  const scrubPositionRef = React.useRef<{ time: number; x: number } | null>(null);

  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    if (controlledTime === undefined && !isScrubbingRef.current) {
      setInternalTime(time);
    }
  });

  const displayTime = controlledTime !== undefined ? controlledTime : internalTime;

  // Find nearest cached thumbnail frame for instant responsive scrubbing
  const getClosestCachedFrame = React.useCallback((targetSec: number): any | null => {
    let bestThumb: any = null;
    let minDiff = 12; // within 12 seconds
    for (const [cachedTime, thumb] of thumbnailCache.current.entries()) {
      const diff = Math.abs(cachedTime - targetSec);
      if (diff < minDiff) {
        minDiff = diff;
        bestThumb = thumb;
      }
    }
    return bestThumb;
  }, []);

  // Request actual video frame at target time from video player
  const requestFrameAtTime = React.useCallback(
    (targetSeconds: number) => {
      if (!player || typeof player.generateThumbnailsAsync !== 'function') return;

      const rounded = Math.max(0, Math.round(targetSeconds));
      latestRequestedTimeRef.current = rounded;

      if (thumbnailCache.current.has(rounded)) {
        setFrameThumbnail(thumbnailCache.current.get(rounded));
        return;
      }

      // Check nearest cached frame for instant feedback while fetching exact frame
      const closest = getClosestCachedFrame(rounded);
      if (closest) {
        setFrameThumbnail(closest);
      }

      if (isGeneratingRef.current) {
        pendingTimeRef.current = rounded;
        return;
      }

      isGeneratingRef.current = true;
      player
        .generateThumbnailsAsync([rounded], { maxWidth: 160 })
        .then((results: any[]) => {
          if (results && results.length > 0) {
            const thumb = results[0];
            thumbnailCache.current.set(rounded, thumb);
            if (
              isScrubbingRef.current &&
              (latestRequestedTimeRef.current === rounded ||
                (scrubPositionRef.current &&
                  Math.abs(scrubPositionRef.current.time - rounded) <= 15))
            ) {
              setFrameThumbnail(thumb);
            }
          }
        })
        .catch(() => {
          // Fallback to static thumbnail or closest cached on decoder error
        })
        .finally(() => {
          isGeneratingRef.current = false;
          if (pendingTimeRef.current !== null && isScrubbingRef.current) {
            const next = pendingTimeRef.current;
            pendingTimeRef.current = null;
            requestFrameAtTime(next);
          }
        });
    },
    [player, getClosestCachedFrame]
  );

  const updateScrub = (locationX: number) => {
    if (duration <= 0 || timelineWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(timelineWidth, locationX));
    const ratio = clampedX / timelineWidth;
    const targetTime = ratio * duration;
    const pos = { time: targetTime, x: clampedX };
    scrubPositionRef.current = pos;
    setScrubPosition(pos);
    requestFrameAtTime(targetTime);
  };

  const handleTouchStart = (e: any) => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    onScrubbingChange?.(true);
    updateScrub(e.nativeEvent.locationX);
  };

  const handleTouchMove = (e: any) => {
    if (!isScrubbingRef.current) return;
    updateScrub(e.nativeEvent.locationX);
  };

  const handleTouchEnd = () => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    const finalPos = scrubPositionRef.current;
    setIsScrubbing(false);
    setScrubPosition(null);
    scrubPositionRef.current = null;
    pendingTimeRef.current = null;
    setFrameThumbnail(null);
    onScrubbingChange?.(false);

    if (finalPos && duration > 0) {
      Haptics.selectionAsync().catch(() => {});
      if (player) {
        player.currentTime = finalPos.time;
      }
      setInternalTime(finalPos.time);
      onSeek(finalPos.time);
    }
  };

  const activePercent =
    isScrubbing && scrubPosition && timelineWidth > 0
      ? Math.min(100, Math.max(0, (scrubPosition.x / timelineWidth) * 100))
      : duration > 0
      ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
      : 0;

  const currentScrubX = scrubPosition?.x ?? 0;
  const maxSafeBubbleLeft = Math.max(0, timelineWidth - PREVIEW_WIDTH);
  const clampedBubbleLeft = Math.max(
    0,
    Math.min(maxSafeBubbleLeft, currentScrubX - PREVIEW_HALF)
  );

  const deltaSeconds = scrubPosition ? Math.round(scrubPosition.time - displayTime) : 0;

  return (
    <View
      style={styles.timelineWrapper}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
      onResponderTerminate={handleTouchEnd}
      accessibilityRole="adjustable"
      accessibilityLabel="BARRA DI AVANZAMENTO VIDEO CON ANTEPRIMA FRAME"
    >
      {/* Floating Scrub Preview Card with Real Frame Preview */}
      {isScrubbing && scrubPosition && (
        <View
          pointerEvents="none"
          style={[
            styles.previewBubble,
            {
              left: clampedBubbleLeft,
              width: PREVIEW_WIDTH,
            },
          ]}
        >
          {frameThumbnail ? (
            <Image
              source={frameThumbnail}
              style={styles.previewThumb}
              contentFit="cover"
            />
          ) : thumbnail ? (
            <Image
              source={{ uri: thumbnail }}
              style={styles.previewThumb}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.previewThumb, styles.previewPlaceholder]}>
              <Ionicons name="film-outline" size={24} color="#888888" />
            </View>
          )}

          <Text style={styles.previewTimeText}>
            {formatTime(scrubPosition.time)}
          </Text>

          {Math.abs(deltaSeconds) >= 2 && (
            <Text
              style={[
                styles.previewDeltaText,
                { color: deltaSeconds > 0 ? '#4ADE80' : '#F87171' },
              ]}
            >
              {deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`}
            </Text>
          )}
        </View>
      )}

      {/* Timeline Track & Active Bar */}
      <View
        pointerEvents="none"
        style={[styles.timelineTrack, isScrubbing && styles.timelineTrackActive]}
      >
        <View
          style={[
            styles.timelineBar,
            {
              backgroundColor: primaryColor,
              width: `${activePercent}%`,
            },
          ]}
        />
      </View>

      {/* Scrub Thumb Indicator */}
      {isScrubbing && scrubPosition && (
        <View
          pointerEvents="none"
          style={[
            styles.scrubThumb,
            {
              left: Math.max(0, Math.min(Math.max(0, timelineWidth - 14), scrubPosition.x - 7)),
              backgroundColor: primaryColor,
            },
          ]}
        />
      )}
    </View>
  );
});

export interface PlayerTimeDisplayProps {
  player: any;
  duration: number;
  initialTime?: number;
  currentTime?: number;
}

export const PlayerTimeDisplay = React.memo<PlayerTimeDisplayProps>(function PlayerTimeDisplay({
  player,
  duration,
  initialTime = 0,
  currentTime: controlledTime,
}) {
  const [internalTime, setInternalTime] = React.useState<number>(() => {
    if (typeof controlledTime === 'number' && !isNaN(controlledTime)) {
      return controlledTime;
    }
    if (typeof player?.currentTime === 'number' && !isNaN(player.currentTime)) {
      return player.currentTime;
    }
    return initialTime;
  });

  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    if (controlledTime === undefined) {
      setInternalTime(time);
    }
  });

  const displayTime = controlledTime !== undefined ? controlledTime : internalTime;

  return (
    <Text style={styles.timeText}>
      {formatTime(displayTime)} / {formatTime(duration)}
    </Text>
  );
});

const styles = StyleSheet.create({
  timelineWrapper: {
    minHeight: 44,
    paddingVertical: 14,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  timelineTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timelineTrackActive: {
    height: 6,
    borderRadius: 3,
  },
  timelineBar: {
    height: '100%',
    borderRadius: 2,
  },
  scrubThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 3,
  },
  previewBubble: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(15, 15, 15, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  previewThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 5,
    backgroundColor: '#0A0A0A',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTimeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.5,
  },
  previewDeltaText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  timeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: oledTheme.typography.caption.fontFamily,
    fontWeight: 'bold',
  },
});
