import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { oledTheme } from '@/theme';
import type { AniSkipResult } from '@/types';

export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);

  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDeltaTime(
  deltaSeconds: number
): { text: string; color: string } | null {
  if (typeof deltaSeconds !== 'number' || isNaN(deltaSeconds) || !isFinite(deltaSeconds)) {
    return null;
  }
  const rounded = Math.round(deltaSeconds);
  if (Math.abs(rounded) < 1) {
    return null;
  }
  const sign = rounded > 0 ? '+' : '-';
  const formattedTime = formatTime(Math.abs(rounded));
  return {
    text: `${sign}${formattedTime}`,
    color: rounded > 0 ? '#4ADE80' : '#F87171',
  };
}

export type ChapterType = 'op' | 'ed' | 'recap' | 'post-credits' | 'episode';

export interface TimelineChapter {
  id: string;
  type: ChapterType;
  label: string;
  startTime: number;
  endTime: number;
  playedColor: string;
  unplayedColor: string;
  flex: number;
}

export function computeTimelineChapters(
  duration: number,
  aniSkipResults?: AniSkipResult[],
  primaryColor: string = '#10B981'
): TimelineChapter[] {
  if (
    typeof duration !== 'number' ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0 ||
    !Array.isArray(aniSkipResults) ||
    aniSkipResults.length === 0
  ) {
    return [];
  }

  interface CleanInterval {
    startTime: number;
    endTime: number;
    type: ChapterType;
    label: string;
    playedColor: string;
    unplayedColor: string;
  }

  const rawIntervals: CleanInterval[] = [];

  for (const item of aniSkipResults) {
    if (!item || !item.interval) continue;
    const { startTime, endTime } = item.interval;
    if (
      typeof startTime !== 'number' ||
      typeof endTime !== 'number' ||
      isNaN(startTime) ||
      isNaN(endTime)
    ) {
      continue;
    }

    const clampedStart = Math.max(0, startTime);
    const clampedEnd = Math.min(duration, endTime);
    if (clampedEnd <= clampedStart || clampedStart >= duration) {
      continue;
    }

    let type: ChapterType;
    let label: string;
    let playedColor: string;
    let unplayedColor: string;

    if (item.skipType === 'op' || item.skipType === 'mixed-op') {
      type = 'op';
      label = '[SIGLA INIZIALE]';
      playedColor = '#FBBF24';
      unplayedColor = 'rgba(251, 191, 36, 0.28)';
    } else if (item.skipType === 'ed' || item.skipType === 'mixed-ed') {
      type = 'ed';
      label = '[SIGLA FINALE]';
      playedColor = '#A78BFA';
      unplayedColor = 'rgba(167, 139, 250, 0.28)';
    } else if (item.skipType === 'recap') {
      type = 'recap';
      label = '[RECAP]';
      playedColor = '#38BDF8';
      unplayedColor = 'rgba(56, 189, 248, 0.28)';
    } else {
      // Discard unrecognized skip types to avoid fragmenting the episode
      continue;
    }

    rawIntervals.push({
      startTime: clampedStart,
      endTime: clampedEnd,
      type,
      label,
      playedColor,
      unplayedColor,
    });
  }

  if (rawIntervals.length === 0) {
    return [];
  }

  // Sort by startTime ascending
  rawIntervals.sort((a, b) => a.startTime - b.startTime);

  // Merge/clamp overlapping intervals if any
  const sortedIntervals: CleanInterval[] = [];
  for (const cur of rawIntervals) {
    if (sortedIntervals.length === 0) {
      sortedIntervals.push(cur);
      continue;
    }
    const prev = sortedIntervals[sortedIntervals.length - 1];
    // Merge consecutive identical types if touching or overlapping
    if (cur.type === prev.type && cur.startTime <= prev.endTime) {
      prev.endTime = Math.max(prev.endTime, cur.endTime);
      continue;
    }
    if (cur.startTime < prev.endTime) {
      cur.startTime = prev.endTime;
    }
    if (cur.endTime > cur.startTime) {
      sortedIntervals.push(cur);
    }
  }

  if (sortedIntervals.length === 0) {
    return [];
  }

  // Check if ending skip is present and ends close to duration (within 5 seconds)
  const lastInterval = sortedIntervals[sortedIntervals.length - 1];
  if (lastInterval.type === 'ed' && duration - lastInterval.endTime <= 5) {
    lastInterval.endTime = duration;
  }

  // Build contiguous timeline chapters across [0, duration]
  const chapters: TimelineChapter[] = [];
  let cursor = 0;
  let segIndex = 0;

  for (const interval of sortedIntervals) {
    // Gap before interval -> Episode segment
    if (interval.startTime > cursor) {
      const len = interval.startTime - cursor;
      chapters.push({
        id: `chapter-${segIndex++}-episode`,
        type: 'episode',
        label: '[EPISODIO]',
        startTime: cursor,
        endTime: interval.startTime,
        playedColor: primaryColor,
        unplayedColor: 'rgba(255, 255, 255, 0.24)',
        flex: Math.max(0.1, len),
      });
    }

    // The AniSkip chapter segment
    const intLen = interval.endTime - interval.startTime;
    chapters.push({
      id: `chapter-${segIndex++}-${interval.type}`,
      type: interval.type,
      label: interval.label,
      startTime: interval.startTime,
      endTime: interval.endTime,
      playedColor: interval.playedColor,
      unplayedColor: interval.unplayedColor,
      flex: Math.max(0.1, intLen),
    });

    cursor = interval.endTime;
  }

  // Tail after last interval
  if (cursor < duration) {
    const isAfterEnding = sortedIntervals.some((i) => i.type === 'ed');
    const isPostCredits = isAfterEnding && duration - cursor > 5;
    const tailLen = duration - cursor;

    chapters.push({
      id: `chapter-${segIndex++}-${isPostCredits ? 'post-credits' : 'episode'}`,
      type: isPostCredits ? 'post-credits' : 'episode',
      label: isPostCredits ? '[POST-CREDITS]' : '[EPISODIO]',
      startTime: cursor,
      endTime: duration,
      playedColor: isPostCredits ? '#34D399' : primaryColor,
      unplayedColor: isPostCredits
        ? 'rgba(52, 211, 153, 0.28)'
        : 'rgba(255, 255, 255, 0.24)',
      flex: Math.max(0.1, tailLen),
    });
  }

  // If only 1 chapter resulted (no segments/breaks), return empty for standard bar
  if (chapters.length <= 1) {
    return [];
  }

  return chapters;
}

export function findChapterAtTime(
  time: number,
  chapters: TimelineChapter[]
): TimelineChapter | null {
  if (
    typeof time !== 'number' ||
    isNaN(time) ||
    !Array.isArray(chapters) ||
    chapters.length === 0
  ) {
    return null;
  }
  for (const ch of chapters) {
    if (time >= ch.startTime && time < ch.endTime) {
      return ch;
    }
  }
  const last = chapters[chapters.length - 1];
  if (time >= last.endTime) return last;
  if (time <= chapters[0].startTime) return chapters[0];
  return null;
}

export function getAniSkipChapterBadge(
  targetTime: number,
  duration: number,
  aniSkipResults?: AniSkipResult[]
): { label: string; color: string; borderColor: string; bgColor: string } {
  if (
    typeof targetTime === 'number' &&
    !isNaN(targetTime) &&
    isFinite(targetTime) &&
    Array.isArray(aniSkipResults) &&
    aniSkipResults.length > 0
  ) {
    // 1. Check if targetTime falls inside an active AniSkip interval
    for (const skip of aniSkipResults) {
      if (
        skip &&
        skip.interval &&
        typeof skip.interval.startTime === 'number' &&
        typeof skip.interval.endTime === 'number'
      ) {
        let effEnd = skip.interval.endTime;
        if (
          (skip.skipType === 'ed' || skip.skipType === 'mixed-ed') &&
          duration > 0 &&
          duration - effEnd <= 5
        ) {
          effEnd = duration;
        }
        if (targetTime >= skip.interval.startTime && targetTime <= effEnd) {
          if (skip.skipType === 'op' || skip.skipType === 'mixed-op') {
            return {
              label: '[SIGLA INIZIALE]',
              color: '#FBBF24',
              borderColor: 'rgba(251, 191, 36, 0.45)',
              bgColor: 'rgba(251, 191, 36, 0.12)',
            };
          }
          if (skip.skipType === 'ed' || skip.skipType === 'mixed-ed') {
            return {
              label: '[SIGLA FINALE]',
              color: '#A78BFA',
              borderColor: 'rgba(167, 139, 250, 0.45)',
              bgColor: 'rgba(167, 139, 250, 0.12)',
            };
          }
          if (skip.skipType === 'recap') {
            return {
              label: '[RECAP]',
              color: '#38BDF8',
              borderColor: 'rgba(56, 189, 248, 0.45)',
              bgColor: 'rgba(56, 189, 248, 0.12)',
            };
          }
        }
      }
    }

    // 2. Check if targetTime is after the ending (post-credits)
    const endingSkip = aniSkipResults.find(
      (s) => s && (s.skipType === 'ed' || s.skipType === 'mixed-ed')
    );
    if (
      endingSkip &&
      endingSkip.interval &&
      typeof endingSkip.interval.endTime === 'number' &&
      targetTime > endingSkip.interval.endTime &&
      duration > 0 &&
      endingSkip.interval.endTime < duration - 5
    ) {
      return {
        label: '[POST-CREDITS]',
        color: '#34D399',
        borderColor: 'rgba(52, 211, 153, 0.45)',
        bgColor: 'rgba(52, 211, 153, 0.12)',
      };
    }
  }

  // 3. Default: standard episode segment
  return {
    label: '[EPISODIO]',
    color: '#D1D5DB',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    bgColor: 'rgba(255, 255, 255, 0.06)',
  };
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
  aniSkipResults?: AniSkipResult[];
  isLocalSource?: boolean;
  videoUrl?: string;
}

const PREVIEW_WIDTH = 136;
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
  aniSkipResults,
  isLocalSource = false,
  videoUrl,
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

  const chapters = React.useMemo(() => {
    return computeTimelineChapters(duration, aniSkipResults, primaryColor);
  }, [duration, aniSkipResults, primaryColor]);

  const currentChapterIdRef = React.useRef<string | null>(null);
  const lastChapterHapticTimeRef = React.useRef<number>(0);

  // Real frame thumbnail extraction during scrubbing (local sources only)
  const [frameThumbnail, setFrameThumbnail] = React.useState<any>(null);
  const thumbnailCache = React.useRef<Map<number, any>>(new Map());
  const isGeneratingRef = React.useRef(false);
  const pendingTimeRef = React.useRef<number | null>(null);
  const latestRequestedTimeRef = React.useRef<number | null>(null);

  const isScrubbingRef = React.useRef(false);
  const scrubPositionRef = React.useRef<{ time: number; x: number } | null>(null);
  const scrubStartTimeRef = React.useRef(0);
  const lastSeekTimestampRef = React.useRef(0);
  const pendingSeekTimeRef = React.useRef<number | null>(null);
  const seekThrottleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    thumbnailCache.current.clear();
    setFrameThumbnail(null);
  }, [videoUrl]);

  React.useEffect(() => {
    return () => {
      if (seekThrottleTimerRef.current) {
        clearTimeout(seekThrottleTimerRef.current);
        seekThrottleTimerRef.current = null;
      }
      if (isScrubbingRef.current && player) {
        try {
          player.scrubbingModeOptions = { scrubbingModeEnabled: false };
          player.seekTolerance = { toleranceBefore: 0, toleranceAfter: 0 };
        } catch {}
      }
    };
  }, [player]);

  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    if (controlledTime === undefined && !isScrubbingRef.current) {
      setInternalTime(time);
    }
  });

  const displayTime = controlledTime !== undefined ? controlledTime : internalTime;

  // Find nearest cached thumbnail frame for instant responsive scrubbing
  const getClosestCachedFrame = React.useCallback((targetSec: number): any | null => {
    let bestThumb: any = null;
    let minDiff = 15; // within 15 seconds
    for (const [cachedTime, thumb] of thumbnailCache.current.entries()) {
      const diff = Math.abs(cachedTime - targetSec);
      if (diff < minDiff) {
        minDiff = diff;
        bestThumb = thumb;
      }
    }
    return bestThumb;
  }, []);

  // Request actual video frame at target time from video player (local downloads only)
  const requestFrameAtTime = React.useCallback(
    (targetSeconds: number) => {
      if (!isLocalSource || !player || typeof player.generateThumbnailsAsync !== 'function') return;

      // 5-second bucket quantization to prevent overloading the decoder
      const BUCKET_SIZE = 5;
      const bucket = Math.max(0, Math.round(targetSeconds / BUCKET_SIZE) * BUCKET_SIZE);
      latestRequestedTimeRef.current = bucket;

      if (thumbnailCache.current.has(bucket)) {
        setFrameThumbnail(thumbnailCache.current.get(bucket));
        return;
      }

      // Check nearest cached frame for instant feedback while fetching exact frame
      const closest = getClosestCachedFrame(bucket);
      if (closest) {
        setFrameThumbnail(closest);
      }

      if (isGeneratingRef.current) {
        pendingTimeRef.current = bucket;
        return;
      }

      isGeneratingRef.current = true;
      player
        .generateThumbnailsAsync([bucket], { maxWidth: 160 })
        .then((results: any[]) => {
          if (results && results.length > 0 && results[0]) {
            const thumb = results[0];
            // LRU eviction: cap thumbnail cache at 50 items to prevent RAM bloat
            if (thumbnailCache.current.size >= 50) {
              const oldestKey = thumbnailCache.current.keys().next().value;
              if (oldestKey !== undefined) {
                thumbnailCache.current.delete(oldestKey);
              }
            }
            thumbnailCache.current.set(bucket, thumb);
            if (
              isScrubbingRef.current &&
              (latestRequestedTimeRef.current === bucket ||
                (scrubPositionRef.current &&
                  Math.abs(scrubPositionRef.current.time - bucket) <= 15))
            ) {
              setFrameThumbnail(thumb);
            }
          }
        })
        .catch(() => {
          // Decoder error fallback
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
    [player, getClosestCachedFrame, isLocalSource]
  );

  const updateScrub = (locationX: number, isInitial = false) => {
    if (typeof locationX !== 'number' || isNaN(locationX) || !isFinite(locationX)) return;
    if (duration <= 0 || timelineWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(timelineWidth, locationX));
    const ratio = clampedX / timelineWidth;
    const targetTime = Math.max(0, Math.min(duration, ratio * duration));
    const pos = { time: targetTime, x: clampedX };
    scrubPositionRef.current = pos;
    setScrubPosition(pos);

    if (isLocalSource) {
      requestFrameAtTime(targetTime);
    }

    if (chapters.length > 1) {
      const activeChapter = findChapterAtTime(targetTime, chapters);
      if (activeChapter && activeChapter.id !== currentChapterIdRef.current) {
        if (currentChapterIdRef.current !== null) {
          const now = Date.now();
          if (now - lastChapterHapticTimeRef.current >= 100) {
            lastChapterHapticTimeRef.current = now;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
        currentChapterIdRef.current = activeChapter.id;
      }
    }

    if (isInitial) {
      lastSeekTimestampRef.current = Date.now();
      if (player) {
        try {
          player.currentTime = targetTime;
        } catch {}
      }
      return;
    }

    // Throttled live keyframe seek to prevent bridge flooding (~45ms)
    const now = Date.now();
    const THROTTLE_MS = 45;
    const timeSinceLastSeek = now - lastSeekTimestampRef.current;
    pendingSeekTimeRef.current = targetTime;

    if (timeSinceLastSeek >= THROTTLE_MS) {
      lastSeekTimestampRef.current = now;
      if (seekThrottleTimerRef.current) {
        clearTimeout(seekThrottleTimerRef.current);
        seekThrottleTimerRef.current = null;
      }
      if (player) {
        try {
          player.currentTime = targetTime;
        } catch {}
      }
    } else if (!seekThrottleTimerRef.current) {
      seekThrottleTimerRef.current = setTimeout(() => {
        seekThrottleTimerRef.current = null;
        if (isScrubbingRef.current && pendingSeekTimeRef.current !== null) {
          lastSeekTimestampRef.current = Date.now();
          const nextTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
          if (player) {
            try {
              player.currentTime = nextTime;
            } catch {}
          }
        }
      }, THROTTLE_MS - timeSinceLastSeek);
    }
  };

  const handleTouchStart = (e: any) => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    onScrubbingChange?.(true);

    scrubStartTimeRef.current =
      typeof displayTime === 'number' && !isNaN(displayTime) ? displayTime : 0;

    if (player) {
      try {
        player.scrubbingModeOptions = {
          scrubbingModeEnabled: true,
          increaseCodecOperatingRate: true,
          enableDynamicScheduling: true,
          useDecodeOnlyFlag: true,
          allowSkippingMediaCodecFlush: true,
        };
        player.seekTolerance = {
          toleranceBefore: 4,
          toleranceAfter: 4,
        };
      } catch {}
    }

    updateScrub(e.nativeEvent.locationX, true);
  };

  const handleTouchMove = (e: any) => {
    if (!isScrubbingRef.current) return;
    updateScrub(e.nativeEvent.locationX, false);
  };

  const handleTouchEnd = () => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (seekThrottleTimerRef.current) {
      clearTimeout(seekThrottleTimerRef.current);
      seekThrottleTimerRef.current = null;
    }
    pendingSeekTimeRef.current = null;

    const finalPos = scrubPositionRef.current;
    currentChapterIdRef.current = null;
    lastChapterHapticTimeRef.current = 0;
    setIsScrubbing(false);
    setScrubPosition(null);
    scrubPositionRef.current = null;
    pendingTimeRef.current = null;
    setFrameThumbnail(null);

    if (player) {
      try {
        player.scrubbingModeOptions = { scrubbingModeEnabled: false };
        player.seekTolerance = { toleranceBefore: 0, toleranceAfter: 0 };
      } catch {}
    }

    if (finalPos && duration > 0) {
      Haptics.selectionAsync().catch(() => {});
      if (player) {
        try {
          player.currentTime = finalPos.time;
        } catch {}
      }
      setInternalTime(finalPos.time);
      onSeek(finalPos.time);
    }

    onScrubbingChange?.(false);
  };

  const activePercent =
    isScrubbing && scrubPosition && timelineWidth > 0
      ? Math.min(100, Math.max(0, (scrubPosition.x / timelineWidth) * 100))
      : duration > 0
      ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
      : 0;

  const effectiveTime =
    isScrubbing && scrubPosition
      ? scrubPosition.time
      : duration > 0
      ? displayTime
      : 0;

  const currentScrubX = scrubPosition?.x ?? 0;
  const maxSafeBubbleLeft = Math.max(0, timelineWidth - PREVIEW_WIDTH);
  const clampedBubbleLeft = Math.max(
    0,
    Math.min(maxSafeBubbleLeft, currentScrubX - PREVIEW_HALF)
  );

  const deltaSeconds = scrubPosition
    ? Math.round(scrubPosition.time - scrubStartTimeRef.current)
    : 0;
  const formattedDelta = formatDeltaTime(deltaSeconds);

  // Synchronize chapter badge with active chapter segment on timeline
  const activeScrubChapter =
    chapters.length > 1 && scrubPosition
      ? findChapterAtTime(scrubPosition.time, chapters)
      : null;

  const chapterBadge = activeScrubChapter
    ? {
        label: activeScrubChapter.label,
        color:
          activeScrubChapter.type === 'episode'
            ? '#D1D5DB'
            : activeScrubChapter.playedColor,
        borderColor:
          activeScrubChapter.type === 'episode'
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.45)',
        bgColor:
          activeScrubChapter.type === 'episode'
            ? 'rgba(255, 255, 255, 0.06)'
            : activeScrubChapter.unplayedColor,
      }
    : getAniSkipChapterBadge(
        scrubPosition?.time ?? 0,
        duration,
        aniSkipResults
      );

  const thumbColor =
    chapterBadge.label === '[EPISODIO]'
      ? primaryColor
      : chapterBadge.color || primaryColor;

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
      accessibilityLabel={
        chapters.length > 1
          ? `BARRA DI AVANZAMENTO VIDEO CON ${chapters.length} CAPITOLI`
          : 'BARRA DI AVANZAMENTO VIDEO CON ANTEPRIMA FRAME'
      }
      accessibilityValue={{
        min: 0,
        max: Math.round(duration),
        now: Math.round(effectiveTime),
        text: `${formatTime(effectiveTime)} di ${formatTime(duration)}`,
      }}
      accessibilityActions={[
        { name: 'increment', label: 'AVANZA 10 SECONDI' },
        { name: 'decrement', label: 'INDIETRO 10 SECONDI' },
      ]}
      onAccessibilityAction={(event) => {
        if (duration <= 0) return;
        if (event.nativeEvent.actionName === 'increment') {
          const nextTime = Math.min(duration, displayTime + 10);
          onSeek(nextTime);
          if (player) {
            try {
              player.currentTime = nextTime;
            } catch {}
          }
        } else if (event.nativeEvent.actionName === 'decrement') {
          const nextTime = Math.max(0, displayTime - 10);
          onSeek(nextTime);
          if (player) {
            try {
              player.currentTime = nextTime;
            } catch {}
          }
        }
      }}
    >
      {/* Floating Scrub Preview Card with Live Time-Scrubbing HUD OLED */}
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
          {isLocalSource && frameThumbnail ? (
            <Image
              source={frameThumbnail}
              style={styles.previewThumb}
              contentFit="cover"
            />
          ) : null}

          <View style={styles.previewTimeRow}>
            <Text style={styles.previewTimeText}>
              {formatTime(scrubPosition.time)}
            </Text>

            {formattedDelta ? (
              <Text
                style={[
                  styles.previewDeltaText,
                  { color: formattedDelta.color },
                ]}
              >
                {formattedDelta.text}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.chapterBadge,
              {
                borderColor: chapterBadge.borderColor,
                backgroundColor: chapterBadge.bgColor,
              },
            ]}
          >
            <Text style={[styles.chapterBadgeText, { color: chapterBadge.color }]}>
              {chapterBadge.label}
            </Text>
          </View>
        </View>
      )}

      {/* Timeline Track & Active Bar */}
      {chapters.length > 1 ? (
        <View
          pointerEvents="none"
          style={[
            styles.timelineTrackChapters,
            isScrubbing && styles.timelineTrackChaptersActive,
          ]}
        >
          {chapters.map((ch) => {
            const chLen = ch.endTime - ch.startTime;
            let fillPercent = 0;
            if (chLen > 0) {
              if (effectiveTime >= ch.endTime) {
                fillPercent = 100;
              } else if (effectiveTime > ch.startTime) {
                fillPercent = Math.min(
                  100,
                  Math.max(0, ((effectiveTime - ch.startTime) / chLen) * 100)
                );
              }
            }

            return (
              <View
                key={ch.id}
                style={[
                  styles.chapterSegment,
                  isScrubbing && styles.chapterSegmentActive,
                  {
                    flex: ch.flex,
                    backgroundColor: ch.unplayedColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.chapterSegmentBar,
                    isScrubbing && styles.chapterSegmentBarActive,
                    {
                      backgroundColor: ch.playedColor,
                      width: `${fillPercent}%`,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : (
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
      )}

      {/* Scrub Thumb Indicator */}
      {isScrubbing && scrubPosition && (
        <View
          pointerEvents="none"
          style={[
            styles.scrubThumb,
            {
              left: Math.max(0, Math.min(Math.max(0, timelineWidth - 14), scrubPosition.x - 7)),
              backgroundColor: thumbColor,
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
  timelineTrackChapters: {
    height: 4,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  timelineTrackChaptersActive: {
    height: 6,
    gap: 3,
  },
  chapterSegment: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  chapterSegmentActive: {
    borderRadius: 3,
  },
  chapterSegmentBar: {
    height: '100%',
    borderRadius: 2,
  },
  chapterSegmentBarActive: {
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
    bottom: 32,
    backgroundColor: 'rgba(10, 10, 10, 0.96)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },
  previewThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 5,
    backgroundColor: '#0A0A0A',
    marginBottom: 2,
  },
  previewTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewTimeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.5,
  },
  previewDeltaText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  chapterBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.6,
  },
  timeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: oledTheme.typography.caption.fontFamily,
    fontWeight: 'bold',
  },
});
