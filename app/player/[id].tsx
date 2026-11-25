import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  Dimensions,
  Animated,
  Platform,
  AppState,
  DeviceEventEmitter,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AnimeWorldScraper, ProviderRegistry } from '@/services/scraper';
import {
  AniSkipService,
  computeAniSkipOverlayState,
  type AniSkipNextPrompt,
  type AniSkipOverlayState,
} from '@/services/aniskip';
import { AppStorage } from '@/services/storage';
import { SyncManager } from '@/services/sync';
import { DownloadService, type DownloadStatus } from '@/services/downloads';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AniSkipButton } from '@/components/AniSkipButton';
import { PlayerSkeleton } from '@/components/skeleton';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import {
  PlayerHeader,
  PlayerFooter,
  PlayerEpisodesCarouselSheet,
  PlayerInfoSheet,
  resolvePlayingChangeState,
  resolveStatusChangeState,
  syncPlayerSnapshot,
  evaluatePlaybackStall,
  computeVerticalGestureTravelRange,
  computeSystemVolumeGesture,
  computeWindowBrightnessGesture,
} from '@/components/player';
import KuroDeviceControls from '../../modules/kuro-device-controls';
import { playerStyles as styles } from '@/components/player/player.styles';
import type { AniSkipResult, AnimeDetail, Episode } from '@/types';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
let isNavigatingToEpisode = false;
let lastPlayerOrientation: 'landscape' | 'portrait' | null = null;

export default function VideoPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const params = useLocalSearchParams<{
    id: string;
    animeId: string;
    episodeNumber: string;
    episodeDataId?: string;
    animeTitle?: string;
    serverId?: string;
    thumbnail?: string;
    position?: string;
    totalEpisodes?: string;
    offline?: string;
    localUri?: string;
    episode?: string;
    orientation?: 'landscape' | 'portrait';
  }>();

  const episodeId = params.id || '';
  const animeId = params.animeId || '';
  const parsedEpNumber = parseInt(params.episodeNumber || params.episode || '1', 10);
  const episodeNumber = Number.isFinite(parsedEpNumber) && parsedEpNumber > 0 ? parsedEpNumber : 1;
  const episodeDataId = params.episodeDataId || '';
  const animeTitle = params.animeTitle || 'Anime';

  const [serverId, setServerId] = React.useState(params.serverId || '9');
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = React.useState(true);
  const [sourceError, setSourceError] = React.useState<string | null>(null);

  // Offline and download status tracking
  const [isOffline, setIsOffline] = React.useState<boolean>(() => {
    return params.offline === '1' || DownloadService.isEpisodeDownloaded(animeId, episodeNumber);
  });
  const [downloadStatus, setDownloadStatus] = React.useState<DownloadStatus | 'none'>(() => {
    return DownloadService.getEpisodeDownloadStatus(animeId, episodeNumber);
  });
  const [downloadProgress, setDownloadProgress] = React.useState<number>(() => {
    const item = DownloadService.getDownloadItem(`${animeId}-ep-${episodeNumber}`);
    return item ? item.progress : 0;
  });

  React.useEffect(() => {
    const currentId = `${animeId}-ep-${episodeNumber}`;
    setDownloadStatus(DownloadService.getEpisodeDownloadStatus(animeId, episodeNumber));
    setIsOffline(params.offline === '1' || DownloadService.isEpisodeDownloaded(animeId, episodeNumber));

    const unsubProgress = DownloadService.addProgressListener((item) => {
      if (item.id === currentId) {
        setDownloadStatus(item.status);
        setDownloadProgress(item.progress);
        if (item.status === 'completed') {
          setIsOffline(true);
        }
      }
    });

    const unsubList = DownloadService.addListListener(() => {
      setDownloadStatus(DownloadService.getEpisodeDownloadStatus(animeId, episodeNumber));
      setIsOffline(params.offline === '1' || DownloadService.isEpisodeDownloaded(animeId, episodeNumber));
    });

    return () => {
      unsubProgress();
      unsubList();
    };
  }, [animeId, episodeNumber, params.offline]);

  // OSD controls
  const [showControls, setShowControls] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [duration, setDuration] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0);
  const playbackSpeedRef = React.useRef(1.0);
  const [isServerSheetVisible, setIsServerSheetVisible] = React.useState(false);
  const [isEpisodesSheetVisible, setIsEpisodesSheetVisible] = React.useState(false);
  const [isInfoSheetVisible, setIsInfoSheetVisible] = React.useState(false);
  const [animeDetail, setAnimeDetail] = React.useState<AnimeDetail | null>(null);
  const [episodesList, setEpisodesList] = React.useState<Episode[]>([]);

  // Picture-in-picture tracking ref
  const isInPiPRef = React.useRef(false);
  const wasPlayingInPiPRef = React.useRef(false);
  const pipStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Next episode & total episodes metadata refs
  const totalEpisodesRef = React.useRef<number | string | undefined>(
    params.totalEpisodes || undefined
  );
  const isOngoingRef = React.useRef<boolean>(
    params.totalEpisodes ? String(params.totalEpisodes).includes('?') : false
  );
  const nextEpisodeRef = React.useRef<{ id: string; number: number; dataId?: string } | null>(null);
  const hasResumedRef = React.useRef(false);
  const detailLoadedRef = React.useRef(false);
  const malIdRef = React.useRef<number | null>(null);

  // Resume from saved position or navigation param
  const initialResumePosition = React.useMemo(() => {
    const fromParam = params.position ? parseFloat(params.position) : 0;
    if (fromParam > 5) return fromParam;
    const fromStorage = AppStorage.getWatchProgress(animeId, episodeNumber);
    if (fromStorage && fromStorage.currentTime > 5 && !fromStorage.isCompleted) {
      return fromStorage.currentTime;
    }
    return 0;
  }, [params.position, animeId, episodeNumber]);

  // Refs for tracking playback time & immediate/unmount saving
  const currentTimeRef = React.useRef(0);
  const durationRef = React.useRef(0);
  const lastSavedTimeRef = React.useRef(-1);
  const [thumbnail, setThumbnail] = React.useState<string>(() => {
    return params.thumbnail || AppStorage.getWatchProgress(animeId, episodeNumber)?.thumbnail || '';
  });
  const thumbnailRef = React.useRef(thumbnail);
  React.useEffect(() => {
    thumbnailRef.current = thumbnail;
  }, [thumbnail]);

  const saveProgress = React.useCallback(
    (pos: number, dur?: number) => {
      if (!animeId || !episodeId) return;
      const currentDuration = dur && dur > 0 ? dur : durationRef.current;
      const nextEp = nextEpisodeRef.current;
      AppStorage.saveWatchProgress({
        animeId,
        animeTitle,
        episodeId,
        episodeNumber,
        totalEpisodes: totalEpisodesRef.current,
        currentTime: pos,
        duration: currentDuration,
        dataId: episodeDataId,
        serverId,
        thumbnail: thumbnailRef.current,
        isOngoing: isOngoingRef.current,
        nextEpisode: nextEp
          ? {
              id: nextEp.id,
              number: nextEp.number,
              dataId: nextEp.dataId,
            }
          : undefined,
      });

      if (SyncManager.isConnected()) {
        const isCompleted =
          currentDuration > 0 &&
          (pos / currentDuration >= 0.9 ||
            currentDuration - pos <= (AppStorage.getEndingThreshold() || 90));
        SyncManager.recordPlaybackProgress(
          {
            animeId,
            animeTitle,
            episodeId,
            episodeNumber,
            totalEpisodes: totalEpisodesRef.current,
            currentTime: pos,
            duration: currentDuration,
            dataId: episodeDataId,
            serverId,
            thumbnail: thumbnailRef.current,
            isOngoing: isOngoingRef.current,
            isCompleted,
            nextEpisode: nextEp
              ? {
                  id: nextEp.id,
                  number: nextEp.number,
                  dataId: nextEp.dataId,
                }
              : undefined,
          },
          isCompleted
        ).catch(() => {});
      }

      lastSavedTimeRef.current = pos;
    },
    [animeId, animeTitle, episodeId, episodeNumber, episodeDataId, serverId]
  );

  // Cumulative skip feedback
  const [cumulativeSkip, setCumulativeSkip] = React.useState<{
    direction: 'left' | 'right';
    seconds: number;
  } | null>(null);
  const accumulatedSkipRef = React.useRef<{
    direction: 'left' | 'right';
    seconds: number;
  } | null>(null);
  const skipTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skipAnim] = React.useState(new Animated.Value(0));

  // Volume / Brightness / Speed indicator
  const [hudIndicator, setHudIndicator] = React.useState<{
    type: 'volume' | 'brightness' | 'speed';
    value: string | number;
  } | null>(null);
  // screenBrightness: 0.005 .. 1.0 or -1 for 'AUTOMATICA' (window-scoped inside player only)
  const [screenBrightness, setScreenBrightness] = React.useState<number>(-1);
  const screenBrightnessRef = React.useRef<number>(-1);
  const hasNativeDeviceControls = Boolean(Platform.OS === 'android' && KuroDeviceControls);

  const startVolumeRef = React.useRef(1.0);
  const volumeMaxStepsRef = React.useRef(15);
  const lastVolumeStepRef = React.useRef(-1);
  const startBrightnessRef = React.useRef(0.5);
  const startPanTranslationYRef = React.useRef(0);
  const hudTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // AniSkip intervals
  const [aniSkipResults, setAniSkipResults] = React.useState<AniSkipResult[]>([]);
  const aniSkipResultsRef = React.useRef<AniSkipResult[]>([]);
  const [primarySkipState, setPrimarySkipState] =
    React.useState<AniSkipOverlayState['primarySkip']>(null);
  const primarySkipRef = React.useRef<AniSkipOverlayState['primarySkip']>(null);
  const [separateNextState, setSeparateNextState] =
    React.useState<AniSkipNextPrompt | null>(null);
  const separateNextRef = React.useRef<AniSkipNextPrompt | null>(null);
  const autoNavigatedEpisodeRef = React.useRef<boolean>(false);
  const skipTriggeredTimeRef = React.useRef<number>(0);
  const autoSkippedIdsRef = React.useRef<Set<string>>(new Set());
  const aniSkipSettingsRef = React.useRef(AppStorage.getAniSkipSettings());
  const handleNavigateToEpisodeRef = React.useRef<
    | ((
        targetEp: Episode | { id: string; number: number; dataId?: string; thumbnail?: string },
        options?: { markCurrentCompleted?: boolean }
      ) => void)
    | null
  >(null);

  const syncAniSkipButtons = React.useCallback((nextState: AniSkipOverlayState) => {
    const prevPrimary = primarySkipRef.current;
    const nextPrimary = nextState.primarySkip;
    if (
      prevPrimary?.skip.skipId !== nextPrimary?.skip.skipId ||
      prevPrimary?.action !== nextPrimary?.action
    ) {
      primarySkipRef.current = nextPrimary;
      setPrimarySkipState(nextPrimary);
    }

    const prevNext = separateNextRef.current;
    const nextSeparate = nextState.separateNext;
    if (prevNext?.promptId !== nextSeparate?.promptId) {
      separateNextRef.current = nextSeparate;
      setSeparateNextState(nextSeparate);
    }
  }, []);

  // Subscribe to live AniSkip settings changes
  React.useEffect(() => {
    const unsub = AppStorage.addSettingsListener(() => {
      aniSkipSettingsRef.current = AppStorage.getAniSkipSettings();
    });
    return unsub;
  }, []);

  const videoViewRef = React.useRef<VideoView>(null);
  const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize video player with null source so loadStream owns all replaceAsync calls
  // without triggering duplicate source replacements or empty-URI native errors
  // staysActiveInBackground: false prevents persistent background playback when app or PiP is dismissed
  // showNowPlayingNotification: true provides notification shade playback controls on Android MediaSession
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.volume = 1.0;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = true;
    p.timeUpdateEventInterval = 0.5; // Starts Android IntervalUpdateClock for timeUpdate
    p.bufferOptions = {
      preferredForwardBufferDuration: 20,
      minBufferForPlayback: 2,
      waitsToMinimizeStalling: true,
    };
    p.play();
  });

  // Track player loading, playback and active buffering status
  const [playerStatus, setPlayerStatus] = React.useState<string>('idle');
  const playerStatusRef = React.useRef<string>('idle');
  const [isBuffering, setIsBuffering] = React.useState(false);
  const [showManualReload, setShowManualReload] = React.useState(false);
  const userWantsPlaybackRef = React.useRef(true);
  const hasEndedRef = React.useRef(false);
  const isScrubbingRef = React.useRef(false);
  const lastAdvanceTimeRef = React.useRef(0);
  const lastAdvanceTimestampRef = React.useRef(0);
  const softKickAttemptedRef = React.useRef(false);
  const stallReloadAttemptsRef = React.useRef(0);
  const isReloadingStreamRef = React.useRef(false);
  const loadRequestIdRef = React.useRef(0);
  const pendingResumePositionRef = React.useRef<number>(initialResumePosition);
  const loadStreamRef = React.useRef<((overrideResumePosition?: number) => Promise<void>) | null>(null);

  const syncPlayerStateFromNative = React.useCallback(() => {
    if (!player) return;
    const nativeStatus = player.status || playerStatusRef.current;
    playerStatusRef.current = nativeStatus;
    setPlayerStatus(nativeStatus);
    const snapshot = syncPlayerSnapshot({
      playerPlaying: Boolean(player.playing),
      playerStatus: nativeStatus,
      userWantsPlayback: userWantsPlaybackRef.current,
      hasEnded: hasEndedRef.current,
      isScrubbing: isScrubbingRef.current,
    });
    userWantsPlaybackRef.current = snapshot.userWantsPlayback;
    setIsPlaying(snapshot.isPlaying);
    setIsBuffering(snapshot.isBuffering);
    lastAdvanceTimestampRef.current = Date.now();
    if (!snapshot.isBuffering) {
      setShowManualReload(false);
    }
  }, [player]);

  // Track playback time & active stall detection with progressive recovery
  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    currentTimeRef.current = time;
    if (player.duration && player.duration > 0 && player.duration !== durationRef.current) {
      setDuration(player.duration);
      durationRef.current = player.duration;
    }

    // Monitor real playback progress to identify silent network stalls & trigger recovery
    const now = Date.now();
    const stallEval = evaluatePlaybackStall({
      time,
      duration: durationRef.current,
      lastAdvanceTime: lastAdvanceTimeRef.current,
      lastAdvanceTimestamp: lastAdvanceTimestampRef.current,
      now,
      userWantsPlayback: userWantsPlaybackRef.current,
      hasEnded: hasEndedRef.current,
      isScrubbing: isScrubbingRef.current,
      playerPlaying: Boolean(player.playing),
      playerStatus: player.status || playerStatusRef.current,
      isBuffering,
      softKickAttempted: softKickAttemptedRef.current,
      reloadAttempts: stallReloadAttemptsRef.current,
    });

    if (stallEval.advanced) {
      lastAdvanceTimeRef.current = time;
      lastAdvanceTimestampRef.current = now;
      softKickAttemptedRef.current = false;
      stallReloadAttemptsRef.current = 0;
      if (isBuffering) {
        setIsBuffering(false);
      }
      if (showManualReload) {
        setShowManualReload(false);
      }
    } else if (userWantsPlaybackRef.current && !hasEndedRef.current && !isScrubbingRef.current) {
      if (stallEval.nextIsBuffering !== isBuffering) {
        setIsBuffering(stallEval.nextIsBuffering);
      }
      if (stallEval.showManualReload && !showManualReload) {
        setShowManualReload(true);
      }
      if (stallEval.recoveryAction === 'soft_kick') {
        softKickAttemptedRef.current = true;
        try {
          const resumePos = currentTimeRef.current;
          if (resumePos > 0) {
            player.currentTime = resumePos;
          }
          player.playbackRate = playbackSpeedRef.current;
          player.play();
        } catch {}
      } else if (
        stallEval.recoveryAction === 'reload_stream' &&
        !isReloadingStreamRef.current
      ) {
        stallReloadAttemptsRef.current += 1;
        lastAdvanceTimestampRef.current = now;
        softKickAttemptedRef.current = false;
        setShowManualReload(false);
        const resumePos = currentTimeRef.current > 1 ? currentTimeRef.current : undefined;
        loadStreamRef.current?.(resumePos);
      }
    }

    // Periodically save progress to storage every ~4 seconds
    if (animeId && !isScrubbingRef.current && Math.abs(time - lastSavedTimeRef.current) >= 4) {
      saveProgress(time, player.duration || durationRef.current);
    }

    // Isolated AniSkip check: handles manual buttons ('SALTA'/'PROSSIMO') & auto skipping based on user settings
    if (!isScrubbingRef.current && aniSkipResultsRef.current.length > 0) {
      // Allow auto-skipped interval to be re-skipped if user seeks back before the interval start
      for (const res of aniSkipResultsRef.current) {
        if (time < res.interval.startTime - 2) {
          autoSkippedIdsRef.current.delete(res.skipId);
        }
      }

      const settings = aniSkipSettingsRef.current;
      const overlayState = computeAniSkipOverlayState({
        currentTime: time,
        episodeDuration: durationRef.current,
        skips: aniSkipResultsRef.current,
        settings,
        hasNextEpisode: Boolean(nextEpisodeRef.current),
        autoSkippedIds: autoSkippedIdsRef.current,
      });

      if (overlayState.autoAction) {
        autoSkippedIdsRef.current.add(overlayState.autoAction.skip.skipId);
        if (overlayState.autoAction.action === 'next' && nextEpisodeRef.current) {
          if (!autoNavigatedEpisodeRef.current) {
            autoNavigatedEpisodeRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            syncAniSkipButtons({ primarySkip: null, separateNext: null, autoAction: null });
            handleNavigateToEpisodeRef.current?.(nextEpisodeRef.current, {
              markCurrentCompleted: true,
            });
          }
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const target = overlayState.autoAction.targetTime;
        player.currentTime = target;
        currentTimeRef.current = target;
        saveProgress(target, durationRef.current);

        // Immediately evaluate post-skip state so a separate 'PROSSIMO' button appears without lag when post-ending starts
        const postSkipState = computeAniSkipOverlayState({
          currentTime: target,
          episodeDuration: durationRef.current,
          skips: aniSkipResultsRef.current,
          settings,
          hasNextEpisode: Boolean(nextEpisodeRef.current),
          autoSkippedIds: autoSkippedIdsRef.current,
        });
        syncAniSkipButtons(postSkipState);
      } else {
        syncAniSkipButtons(overlayState);
      }
    } else if (primarySkipRef.current !== null || separateNextRef.current !== null) {
      syncAniSkipButtons({ primarySkip: null, separateNext: null, autoAction: null });
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    const next = resolvePlayingChangeState({
      playing,
      status: player.status || playerStatusRef.current,
      userWantsPlayback: userWantsPlaybackRef.current,
      hasEnded: hasEndedRef.current,
      isScrubbing: isScrubbingRef.current,
    });
    userWantsPlaybackRef.current = next.userWantsPlayback;
    setIsPlaying(next.isPlaying);
    setIsBuffering(next.isBuffering);
    if (next.shouldResetAdvanceTimestamp) {
      lastAdvanceTimestampRef.current = Date.now();
      softKickAttemptedRef.current = false;
      stallReloadAttemptsRef.current = 0;
      setShowManualReload(false);
    }
    if (!playing && animeId && !isScrubbingRef.current) {
      saveProgress(currentTimeRef.current, durationRef.current);
      if (!next.userWantsPlayback) {
        SyncManager.flushPlaybackProgress().catch(() => {});
      }
    }
    if (isInPiPRef.current) {
      wasPlayingInPiPRef.current = playing;
    }
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    playerStatusRef.current = status;
    setPlayerStatus(status);
    const next = resolveStatusChangeState({
      status,
      hasError: Boolean(error),
      playerPlaying: Boolean(player.playing),
      userWantsPlayback: userWantsPlaybackRef.current,
      hasEnded: hasEndedRef.current,
      isScrubbing: isScrubbingRef.current,
    });
    userWantsPlaybackRef.current = next.userWantsPlayback;
    setIsBuffering(next.isBuffering);
    if (status !== 'loading') {
      setShowManualReload(false);
    }
    if (status === 'readyToPlay') {
      setSourceError(null);
      setIsPlaying(next.isPlaying);
      lastAdvanceTimestampRef.current = Date.now();
      const dur = player.duration || durationRef.current;
      if (dur > 0) {
        setDuration(dur);
        durationRef.current = dur;
      }
      // Re-apply desired playback rate in case underlying player reset it
      player.playbackRate = playbackSpeedRef.current;

      const targetResumePos = pendingResumePositionRef.current;
      if (!hasResumedRef.current && targetResumePos > 0) {
        hasResumedRef.current = true;
        player.currentTime = targetResumePos;
        currentTimeRef.current = targetResumePos;
        lastAdvanceTimeRef.current = targetResumePos;
        saveProgress(targetResumePos, dur);
      } else if (!hasResumedRef.current) {
        hasResumedRef.current = true;
        saveProgress(currentTimeRef.current, dur);
      }
    }
    if (error) {
      setIsPlaying(false);
      setIsBuffering(false);
      setShowManualReload(false);
      setSourceError(`ERRORE RIPRODUZIONE: ${error.message.toUpperCase()}`);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    hasEndedRef.current = true;
    userWantsPlaybackRef.current = false;
    setIsPlaying(false);
    setIsBuffering(false);
    setShowManualReload(false);
    if (animeId && episodeId) {
      const finalDuration = player.duration || durationRef.current;
      currentTimeRef.current = finalDuration;
      saveProgress(finalDuration, finalDuration);
    }
  });

  const currentAnimeIdRef = React.useRef(animeId);
  currentAnimeIdRef.current = animeId;
  const currentEpisodeIdRef = React.useRef(episodeId);
  currentEpisodeIdRef.current = episodeId;
  const saveProgressRef = React.useRef(saveProgress);
  saveProgressRef.current = saveProgress;
  const hasNavigatedRef = React.useRef(false);

  // AppState listener: if app goes to background without PiP, pause playback and save progress;
  // on return to active foreground, resynchronize native player state to prevent stuck buffering spinners.
  React.useEffect(() => {
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    let foregroundSyncTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        if (foregroundSyncTimer) {
          clearTimeout(foregroundSyncTimer);
          foregroundSyncTimer = null;
        }
        if (Platform.OS === 'android' && KuroDeviceControls) {
          KuroDeviceControls.restoreSystemBrightness();
        }
        // Give Android PiP transition time to activate and fire onPictureInPictureStart
        backgroundTimer = setTimeout(() => {
          if (!isInPiPRef.current && AppState.currentState === 'background') {
            userWantsPlaybackRef.current = false;
            setIsPlaying(false);
            setIsBuffering(false);
            setShowManualReload(false);
            player.pause();
            player.showNowPlayingNotification = false;
            if (currentAnimeIdRef.current && currentEpisodeIdRef.current) {
              saveProgressRef.current(currentTimeRef.current, durationRef.current);
            }
            SyncManager.flushPlaybackProgress().catch(() => {});
          }
        }, 600);
      } else if (nextAppState === 'active') {
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        if (pipStopTimerRef.current) {
          clearTimeout(pipStopTimerRef.current);
          pipStopTimerRef.current = null;
        }
        if (foregroundSyncTimer) {
          clearTimeout(foregroundSyncTimer);
          foregroundSyncTimer = null;
        }
        player.showNowPlayingNotification = true;
        player.playbackRate = playbackSpeedRef.current;
        if (Platform.OS === 'android' && KuroDeviceControls) {
          if (screenBrightnessRef.current >= 0) {
            KuroDeviceControls.setWindowBrightness(screenBrightnessRef.current);
          } else {
            KuroDeviceControls.restoreSystemBrightness();
          }
        }
        softKickAttemptedRef.current = false;
        stallReloadAttemptsRef.current = 0;
        lastAdvanceTimestampRef.current = Date.now();
        // If returning from PiP and was playing, resume playback smoothly without pausing
        if (wasPlayingInPiPRef.current) {
          wasPlayingInPiPRef.current = false;
          userWantsPlaybackRef.current = true;
          setIsPlaying(true);
          setIsBuffering(false);
          setShowManualReload(false);
          player.play();
        } else {
          syncPlayerStateFromNative();
          foregroundSyncTimer = setTimeout(() => {
            syncPlayerStateFromNative();
          }, 250);
        }
      }
    });

    return () => {
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
      if (foregroundSyncTimer) {
        clearTimeout(foregroundSyncTimer);
      }
      if (pipStopTimerRef.current) {
        clearTimeout(pipStopTimerRef.current);
      }
      sub.remove();
    };
  }, [player, syncPlayerStateFromNative]);

  // Ensure player-only window brightness is active exclusively while player is focused/mounted
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android' && KuroDeviceControls) {
        if (screenBrightnessRef.current >= 0) {
          KuroDeviceControls.setWindowBrightness(screenBrightnessRef.current);
        } else {
          KuroDeviceControls.restoreSystemBrightness();
        }
      }
      return () => {
        if (
          Platform.OS === 'android' &&
          KuroDeviceControls &&
          !hasNavigatedRef.current &&
          !isNavigatingToEpisode
        ) {
          KuroDeviceControls.restoreSystemBrightness();
        }
      };
    }, [])
  );

  // Save latest progress on exit / screen unmount (only when leaving the screen)
  React.useEffect(() => {
    return () => {
      player.pause();
      player.showNowPlayingNotification = false;
      if (
        Platform.OS === 'android' &&
        KuroDeviceControls &&
        !hasNavigatedRef.current &&
        !isNavigatingToEpisode
      ) {
        KuroDeviceControls.restoreSystemBrightness();
      }
      if (!hasNavigatedRef.current && currentAnimeIdRef.current && currentEpisodeIdRef.current) {
        saveProgressRef.current(currentTimeRef.current, durationRef.current);
      }
      SyncManager.flushPlaybackProgress().catch(() => {});
    };
  }, [player]);

  // Open in full horizontal screen (landscape) on start & respond to device rotation
  React.useEffect(() => {
    const wasNavigating = isNavigatingToEpisode;
    isNavigatingToEpisode = false;

    // Determine target orientation:
    // If transitioning within player (wasNavigating or params.orientation), preserve active orientation.
    // If opening fresh from outside the player, lock to LANDSCAPE.
    const targetOrientation =
      params.orientation || (wasNavigating ? lastPlayerOrientation : null);

    if (targetOrientation === 'portrait') {
      lastPlayerOrientation = 'portrait';
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    } else if (targetOrientation === 'landscape') {
      lastPlayerOrientation = 'landscape';
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    } else {
      // 1. Immediately request landscape fullscreen on fresh open from outside
      lastPlayerOrientation = 'landscape';
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }

    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    return () => {
      if (hasNavigatedRef.current || isNavigatingToEpisode) {
        // Episode transition within player: retain active orientation and hidden navbar
        return;
      }
      lastPlayerOrientation = null;
      isNavigatingToEpisode = false;
      const { width: curW, height: curH } = Dimensions.get('window');
      const isTabletDevice = Math.min(curW, curH) >= 600;
      if (isTabletDevice) {
        ScreenOrientation.unlockAsync().catch(() => {});
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      if (Platform.OS === 'android') {
        const mode = AppStorage.getNavBarMode();
        NavigationBar.setVisibilityAsync(mode === 'auto-hide' ? 'hidden' : 'visible').catch(() => {});
      }
    };
  }, []);

  // Video playback always maintains hidden navigation bar for full immersion
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
  }, [isLandscape]);

  const toggleOrientationFullscreen = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      if (isLandscape) {
        lastPlayerOrientation = 'portrait';
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } else {
        lastPlayerOrientation = 'landscape';
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
    } catch (err) {
      console.warn('[VideoPlayer] toggleOrientationFullscreen error:', err);
    }
  };

  // Fetch direct video stream (supports reloading at current position during stall recovery)
  const loadStream = React.useCallback(
    async (overrideResumePosition?: number) => {
      const requestId = ++loadRequestIdRef.current;
      const hasOverrideResume =
        typeof overrideResumePosition === 'number' &&
        Number.isFinite(overrideResumePosition) &&
        overrideResumePosition > 0;

      if (hasOverrideResume) {
        pendingResumePositionRef.current = overrideResumePosition;
        hasResumedRef.current = false;
      } else if (!hasResumedRef.current) {
        pendingResumePositionRef.current = initialResumePosition;
      }

      isReloadingStreamRef.current = true;
      setIsLoadingSource(true);
      setSourceError(null);
      setShowManualReload(false);
      setVideoUrl(null);

      try {
        let directUrl = '';
        let directHeaders: Record<string, string> | undefined;
        const verifiedLocalUri = await DownloadService.resolvePlayableLocalUri(
          animeId,
          episodeNumber,
          params.localUri
        );
        if (requestId !== loadRequestIdRef.current) return;

        if (verifiedLocalUri) {
          setIsOffline(true);
          directUrl = verifiedLocalUri;
        } else {
          setIsOffline(false);
          const targetEp = {
            id: episodeId,
            number: episodeNumber,
            dataId: episodeDataId,
          };
          // Step 3: Resolve via ProviderRegistry with multi-provider fallback (when online identifiers exist)
          if (episodeDataId || (episodeId && !episodeId.endsWith(`-ep-${episodeNumber}`))) {
            const directSource = await ProviderRegistry.resolveVideoWithFallback(targetEp, serverId);
            if (requestId !== loadRequestIdRef.current) return;
            if (directSource?.url) {
              directUrl = directSource.url;
              directHeaders = directSource.headers;
            }
          }

          if (!directUrl && animeId) {
            // Fallback to scraping episode directly from detail page
            const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
            if (requestId !== loadRequestIdRef.current) return;
            const ep = detail?.episodes?.find((e) => e.id === episodeId || e.number === episodeNumber);
            if (ep) {
              const direct = await ProviderRegistry.resolveVideoWithFallback(ep, serverId);
              if (requestId !== loadRequestIdRef.current) return;
              if (direct?.url) {
                directUrl = direct.url;
                directHeaders = direct.headers;
              }
            }
          }
        }

        if (requestId !== loadRequestIdRef.current) return;

        if (directUrl) {
          setVideoUrl(directUrl);
          const episodeTitle = `EPISODIO ${episodeNumber}`;
          const seriesSubtitle = params.animeTitle || animeDetail?.title;
          const artworkUri =
            thumbnailRef.current || thumbnail || animeDetail?.image || animeDetail?.thumbnail || undefined;
          const isLocalSource = directUrl.startsWith('file://') || directUrl.startsWith('content://');
          const videoSource = {
            uri: directUrl,
            ...(!isLocalSource && directHeaders && Object.keys(directHeaders).length > 0
              ? { headers: directHeaders }
              : {}),
            metadata: {
              title: episodeTitle,
              artist: seriesSubtitle ? String(seriesSubtitle).toUpperCase() : 'KURO MOBILE',
              artwork: artworkUri,
            },
          };
          try {
            if (typeof player.replaceAsync === 'function') {
              await player.replaceAsync(videoSource);
            } else {
              player.replace(videoSource);
            }
          } catch (replaceErr: any) {
            if (requestId !== loadRequestIdRef.current) return;
            console.warn('[VideoPlayer] replaceAsync error:', replaceErr);
            setVideoUrl(null);
            setSourceError(
              (replaceErr?.message || 'ERRORE DURANTE IL CARICAMENTO DEL VIDEO.').toUpperCase()
            );
            return;
          }
          if (requestId !== loadRequestIdRef.current) return;

          const targetPos = pendingResumePositionRef.current;
          player.playbackRate = playbackSpeedRef.current;
          player.showNowPlayingNotification = true;
          userWantsPlaybackRef.current = true;
          hasEndedRef.current = false;
          softKickAttemptedRef.current = false;
          setShowManualReload(false);
          setIsPlaying(true);
          lastAdvanceTimeRef.current = targetPos;
          lastAdvanceTimestampRef.current = Date.now();

          if (targetPos > 0) {
            player.currentTime = targetPos;
            currentTimeRef.current = targetPos;
          }
          player.play();
        } else {
          setSourceError(
            params.offline === '1'
              ? "FILE OFFLINE NON TROVATO O DANNEGGIATO. SCARICA DI NUOVO L'EPISODIO."
              : 'NESSUN FLUSSO VIDEO TROVATO. RIPROVA TRA POCHI SECONDI.'
          );
        }
      } catch (err: any) {
        if (requestId !== loadRequestIdRef.current) return;
        if (params.offline === '1') {
          setSourceError("FILE OFFLINE NON TROVATO O DANNEGGIATO. SCARICA DI NUOVO L'EPISODIO.");
        } else {
          setSourceError((err.message || 'ERRORE DURANTE LA RISOLUZIONE DEL VIDEO.').toUpperCase());
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsLoadingSource(false);
          isReloadingStreamRef.current = false;
        }
      }
    },
    [
      episodeId,
      episodeNumber,
      episodeDataId,
      serverId,
      animeId,
      player,
      initialResumePosition,
      params.localUri,
      params.offline,
    ]
  );

  loadStreamRef.current = loadStream;

  const handleManualReloadStream = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stallReloadAttemptsRef.current = 0;
    softKickAttemptedRef.current = false;
    lastAdvanceTimestampRef.current = Date.now();
    const resumePos = currentTimeRef.current > 1 ? currentTimeRef.current : undefined;
    loadStream(resumePos);
  }, [loadStream]);

  React.useEffect(() => {
    loadStream();
  }, [loadStream]);

  // Reset player and metadata states when navigating to a different episode
  React.useEffect(() => {
    hasNavigatedRef.current = false;
    isNavigatingToEpisode = false;

    // Enforce preserved orientation on in-place episode route updates
    const targetOrientation = params.orientation || lastPlayerOrientation;
    if (targetOrientation === 'portrait') {
      lastPlayerOrientation = 'portrait';
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    } else if (targetOrientation === 'landscape') {
      lastPlayerOrientation = 'landscape';
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }

    hasResumedRef.current = false;
    pendingResumePositionRef.current = initialResumePosition;
    hasEndedRef.current = false;
    userWantsPlaybackRef.current = true;
    playerStatusRef.current = 'idle';
    setPlayerStatus('idle');
    setIsPlaying(true);
    setIsBuffering(false);
    setShowManualReload(false);
    softKickAttemptedRef.current = false;
    stallReloadAttemptsRef.current = 0;
    isReloadingStreamRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    lastAdvanceTimeRef.current = 0;
    lastAdvanceTimestampRef.current = Date.now();
    setDuration(0);
    setVideoUrl(null);
    setIsLoadingSource(true);
    setSourceError(null);
    setAniSkipResults([]);
    aniSkipResultsRef.current = [];
    setPrimarySkipState(null);
    primarySkipRef.current = null;
    setSeparateNextState(null);
    separateNextRef.current = null;
    autoNavigatedEpisodeRef.current = false;
    autoSkippedIdsRef.current.clear();
    skipTriggeredTimeRef.current = 0;
  }, [episodeId, episodeNumber, params.orientation, initialResumePosition]);

  // Fetch AniSkip timestamps & episode batch metadata for advancing next episode
  React.useEffect(() => {
    async function loadMetadataAndAniSkip() {
      try {
        if (!detailLoadedRef.current && animeId) {
          const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
          detailLoadedRef.current = true;
          if (detail) {
            setAnimeDetail(detail);
            const statusStr = (detail.status || detail.state || '').toLowerCase();
            const totalStr = String(detail.totalEpisodes || '').trim();
            isOngoingRef.current =
              totalStr.includes('?') || statusStr.includes('in corso') || statusStr.includes('ongoing');
            if (detail.image) {
              thumbnailRef.current = detail.image;
              setThumbnail((prev) => prev || detail.image || '');
            }
            if (detail.episodes && Array.isArray(detail.episodes)) {
              setEpisodesList(detail.episodes);
              totalEpisodesRef.current = detail.totalEpisodes ?? detail.episodes.length;
              const currIdx = detail.episodes.findIndex(
                (e) => e.id === episodeId || e.number === episodeNumber
              );
              if (currIdx >= 0 && currIdx + 1 < detail.episodes.length) {
                const nextEp = detail.episodes[currIdx + 1];
                nextEpisodeRef.current = {
                  id: nextEp.id,
                  number: nextEp.number,
                  dataId: nextEp.dataId,
                };
              } else {
                nextEpisodeRef.current = null;
              }
            }
            const malId = detail.malId || detail.anilistId;
            if (malId) {
              malIdRef.current = Number(malId);
            }
          }
        }

        if (malIdRef.current && aniSkipResultsRef.current.length === 0) {
          const skips = await AniSkipService.getSkipTimes({
            malId: malIdRef.current,
            episodeNumber,
            episodeLength: durationRef.current || duration,
          });
          aniSkipResultsRef.current = skips || [];
          setAniSkipResults(skips || []);
        }
      } catch {
        // AniSkip is optional, ignore failure
      }
    }

    if (animeId && episodeNumber) {
      loadMetadataAndAniSkip();
    }
  }, [animeId, episodeNumber, episodeId]);

  // Auto-hide controls after 4 seconds of inactivity
  const resetControlsTimer = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isScrubbingRef.current) {
      return;
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, []);

  const handleScrubbingChange = React.useCallback(
    (scrubbing: boolean) => {
      isScrubbingRef.current = scrubbing;
      if (scrubbing) {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        if (isBuffering) {
          setIsBuffering(false);
        }
        if (showManualReload) {
          setShowManualReload(false);
        }
      } else {
        lastAdvanceTimestampRef.current = Date.now();
        softKickAttemptedRef.current = false;
        if (userWantsPlaybackRef.current && !player.playing) {
          player.playbackRate = playbackSpeedRef.current;
          player.play();
        }
        resetControlsTimer();
      }
    },
    [player, isBuffering, showManualReload, resetControlsTimer]
  );

  React.useEffect(() => {
    if (showControls) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, resetControlsTimer]);

  const isBufferingOrLoading = Boolean(
    videoUrl && (isLoadingSource || playerStatus === 'loading' || isBuffering)
  );

  const toggleControls = () => {
    Haptics.selectionAsync().catch(() => {});
    setShowControls((prev) => !prev);
  };

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const effectivelyActive =
      Boolean(player.playing) ||
      (userWantsPlaybackRef.current && (player.status || playerStatusRef.current) === 'loading');

    if (effectivelyActive) {
      userWantsPlaybackRef.current = false;
      setIsPlaying(false);
      setIsBuffering(false);
      setShowManualReload(false);
      player.pause();
    } else {
      userWantsPlaybackRef.current = true;
      hasEndedRef.current = false;
      softKickAttemptedRef.current = false;
      stallReloadAttemptsRef.current = 0;
      lastAdvanceTimestampRef.current = Date.now();
      setShowManualReload(false);
      setIsPlaying(true);
      player.playbackRate = playbackSpeedRef.current;
      player.play();
    }
    resetControlsTimer();
  };

  const currEpIndex = React.useMemo(() => {
    return episodesList.findIndex((e) => e.id === episodeId || e.number === episodeNumber);
  }, [episodesList, episodeId, episodeNumber]);

  const prevEpisode = currEpIndex > 0 ? episodesList[currEpIndex - 1] : null;
  const nextEpisode =
    currEpIndex >= 0 && currEpIndex + 1 < episodesList.length
      ? episodesList[currEpIndex + 1]
      : null;

  const prevEpisodeRef = React.useRef<{
    id: string;
    number: number;
    dataId?: string;
  } | null>(null);

  React.useEffect(() => {
    if (prevEpisode) {
      prevEpisodeRef.current = {
        id: prevEpisode.id,
        number: prevEpisode.number,
        dataId: prevEpisode.dataId,
      };
    } else {
      prevEpisodeRef.current = null;
    }
  }, [prevEpisode]);

  React.useEffect(() => {
    if (nextEpisode) {
      nextEpisodeRef.current = {
        id: nextEpisode.id,
        number: nextEpisode.number,
        dataId: nextEpisode.dataId,
      };
    } else {
      nextEpisodeRef.current = null;
    }
  }, [nextEpisode]);

  const handleNavigateToEpisode = React.useCallback(
    (
      targetEp: Episode | { id: string; number: number; dataId?: string; thumbnail?: string },
      options?: { markCurrentCompleted?: boolean }
    ) => {
      isNavigatingToEpisode = true;
      hasNavigatedRef.current = true;
      const { width: curW, height: curH } = Dimensions.get('window');
      const activeOrientation: 'landscape' | 'portrait' =
        lastPlayerOrientation || (curW > curH ? 'landscape' : 'portrait');
      lastPlayerOrientation = activeOrientation;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const savePos =
        options?.markCurrentCompleted && durationRef.current > 0
          ? durationRef.current
          : currentTimeRef.current;
      currentTimeRef.current = savePos;
      saveProgress(savePos, durationRef.current);
      SyncManager.flushPlaybackProgress().catch(() => {});
      hasResumedRef.current = false;
      primarySkipRef.current = null;
      setPrimarySkipState(null);
      separateNextRef.current = null;
      setSeparateNextState(null);
      const nextThumb = targetEp.thumbnail || thumbnailRef.current;
      setThumbnail(nextThumb);
      const savedProg = AppStorage.getWatchProgress(animeId, targetEp.number);
      router.replace({
        pathname: '/player/[id]',
        params: {
          id: targetEp.id,
          animeId,
          episodeNumber: String(targetEp.number),
          episodeDataId: targetEp.dataId || '',
          animeTitle,
          serverId,
          thumbnail: nextThumb,
          position: String(savedProg && !savedProg.isCompleted ? savedProg.currentTime : 0),
          totalEpisodes: String(totalEpisodesRef.current ?? (episodesList.length || '')),
          orientation: activeOrientation,
        },
      });
    },
    [animeId, animeTitle, serverId, episodesList.length, router, saveProgress]
  );
  handleNavigateToEpisodeRef.current = handleNavigateToEpisode;

  // Notification Shade Next & Prev Episode Action listeners
  React.useEffect(() => {
    const nextSub = DeviceEventEmitter.addListener('KuroNotificationNextEpisode', () => {
      const nextEp = nextEpisodeRef.current;
      if (nextEp) {
        handleNavigateToEpisode(nextEp);
      }
    });
    const prevSub = DeviceEventEmitter.addListener('KuroNotificationPrevEpisode', () => {
      const prevEp = prevEpisodeRef.current;
      if (prevEp) {
        handleNavigateToEpisode(prevEp);
      } else if (player) {
        player.currentTime = 0;
      }
    });
    return () => {
      nextSub.remove();
      prevSub.remove();
    };
  }, [handleNavigateToEpisode, player]);

  const handleDoubleTap = (direction: 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const delta = direction === 'left' ? -10 : 10;
    player.seekBy(delta);
    const newPos =
      direction === 'left'
        ? Math.max(0, currentTimeRef.current - 10)
        : currentTimeRef.current + 10;
    currentTimeRef.current = newPos;
    saveProgress(newPos, durationRef.current);

    const totalSeconds =
      accumulatedSkipRef.current && accumulatedSkipRef.current.direction === direction
        ? accumulatedSkipRef.current.seconds + 10
        : 10;
    const isConsecutive = totalSeconds > 10;

    accumulatedSkipRef.current = { direction, seconds: totalSeconds };
    setCumulativeSkip({ direction, seconds: totalSeconds });

    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    if (!isConsecutive) {
      skipAnim.setValue(0);
      Animated.spring(skipAnim, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.sequence([
        Animated.timing(skipAnim, {
          toValue: 1.15,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.spring(skipAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }

    skipTimeoutRef.current = setTimeout(() => {
      Animated.timing(skipAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setCumulativeSkip(null);
        accumulatedSkipRef.current = null;
      });
    }, 900);
  };

  const handleStartPiP = async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      isInPiPRef.current = true;
      player.showNowPlayingNotification = true;
      if (videoViewRef.current) {
        await videoViewRef.current.startPictureInPicture();
      }
    } catch (e: any) {
      isInPiPRef.current = false;
      console.warn('PiP error:', e);
    }
  };

  const handleSpeedChange = (speed: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    player.playbackRate = speed;
    resetControlsTimer();
    setHudIndicator({ type: 'speed', value: `${speed}X` });
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setHudIndicator(null), 1200);
  };

  const handleCycleSpeed = () => {
    resetControlsTimer();
    const currentIdx = SPEED_OPTIONS.findIndex((s) => Math.abs(s - playbackSpeed) < 0.01);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    handleSpeedChange(SPEED_OPTIONS[nextIdx]);
  };

  const handleAniSkip = () => {
    const primary = primarySkipState || primarySkipRef.current;
    if (!primary) return;

    if (primary.action === 'next') {
      const targetNext = nextEpisode || nextEpisodeRef.current;
      if (targetNext) {
        handleNavigateToEpisode(targetNext, { markCurrentCompleted: true });
      }
      return;
    }

    const skip = primary.skip;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const target = skip.interval.endTime + 0.5;
    player.currentTime = target;
    currentTimeRef.current = target;
    saveProgress(target, durationRef.current);

    const postSkipState = computeAniSkipOverlayState({
      currentTime: target,
      episodeDuration: durationRef.current,
      skips: aniSkipResultsRef.current,
      settings: aniSkipSettingsRef.current,
      hasNextEpisode: Boolean(nextEpisode || nextEpisodeRef.current),
      autoSkippedIds: autoSkippedIdsRef.current,
    });
    syncAniSkipButtons(postSkipState);
  };

  const handlePrimarySkipTimeout = React.useCallback(() => {
    primarySkipRef.current = null;
    setPrimarySkipState(null);
  }, []);

  const handleSeparateNextSkip = React.useCallback(() => {
    const targetNext = nextEpisodeRef.current;
    if (targetNext) {
      handleNavigateToEpisodeRef.current?.(targetNext, { markCurrentCompleted: true });
    }
  }, []);

  const handleSeparateNextTimeout = React.useCallback(() => {
    separateNextRef.current = null;
    setSeparateNextState(null);
  }, []);

  // Timeline scrub seek
  const handleTimelineSeek = (targetTime: number) => {
    currentTimeRef.current = targetTime;
    saveProgress(targetTime, durationRef.current);
    resetControlsTimer();
  };

  // Gesture Handlers
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((e) => {
      // If a cumulative skip is currently active on this side, advance it!
      if (accumulatedSkipRef.current) {
        const side = e.x < windowWidth / 2 ? 'left' : 'right';
        if (accumulatedSkipRef.current.direction === side) {
          handleDoubleTap(side);
          return;
        }
      }
      toggleControls();
    })
    .runOnJS(true);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (e.x < windowWidth / 2) {
        handleDoubleTap('left');
      } else {
        handleDoubleTap('right');
      }
    })
    .runOnJS(true);

  // Exclusive taps: doubleTap takes precedence over singleTap
  const tapGestures = Gesture.Exclusive(doubleTap, singleTap);

  // Pan gesture for real system volume and player-window brightness: vertical only, calibrated to available vertical space
  const panGesture = Gesture.Pan()
    .enabled(!showControls)
    .activeOffsetY([-18, 18])
    .failOffsetX([-14, 14])
    .onStart((e) => {
      startPanTranslationYRef.current = e.translationY;
      if (hasNativeDeviceControls && KuroDeviceControls) {
        const volInfo = KuroDeviceControls.getSystemVolumeInfo();
        startVolumeRef.current = volInfo.volume;
        volumeMaxStepsRef.current = volInfo.maxSteps;
        lastVolumeStepRef.current = volInfo.currentStep;
        player.volume = 1.0;

        if (screenBrightnessRef.current < 0) {
          startBrightnessRef.current = KuroDeviceControls.getSystemBrightness();
        } else {
          startBrightnessRef.current = screenBrightnessRef.current;
        }
      } else {
        startVolumeRef.current = typeof player.volume === 'number' ? player.volume : 1.0;
        startBrightnessRef.current = screenBrightnessRef.current < 0 ? 0.5 : screenBrightnessRef.current;
      }
    })
    .onUpdate((e) => {
      // Strictly ignore horizontal gestures: only adjust if vertical movement dominates
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        return;
      }
      const effectiveTranslationY = e.translationY - startPanTranslationYRef.current;
      const travelRange = computeVerticalGestureTravelRange(windowHeight, insets.top, insets.bottom);
      const delta = -effectiveTranslationY / travelRange;

      if (e.x > windowWidth / 2) {
        // Real system media volume adjustment (STREAM_MUSIC, right side)
        if (hasNativeDeviceControls && KuroDeviceControls) {
          const volRes = computeSystemVolumeGesture(
            startVolumeRef.current,
            delta,
            volumeMaxStepsRef.current
          );
          if (volRes.stepIndex !== lastVolumeStepRef.current) {
            lastVolumeStepRef.current = volRes.stepIndex;
            const applied = KuroDeviceControls.setSystemVolume(volRes.targetVolume);
            setHudIndicator({ type: 'volume', value: Math.round(applied.volume * 100) });
          } else {
            setHudIndicator({ type: 'volume', value: volRes.percentage });
          }
        } else {
          const newVol = Math.max(0, Math.min(1, startVolumeRef.current + delta));
          player.volume = newVol;
          setHudIndicator({ type: 'volume', value: Math.round(newVol * 100) });
        }
      } else {
        // Player-scoped window brightness adjustment (left side): 0%..100% or AUTOMATICA (-1)
        const brightRes = computeWindowBrightnessGesture(startBrightnessRef.current, delta);
        screenBrightnessRef.current = brightRes.brightness;
        setScreenBrightness(brightRes.brightness);
        if (hasNativeDeviceControls && KuroDeviceControls) {
          if (brightRes.isAuto) {
            KuroDeviceControls.restoreSystemBrightness();
          } else {
            KuroDeviceControls.setWindowBrightness(brightRes.brightness);
          }
        }
        setHudIndicator({ type: 'brightness', value: brightRes.hudValue });
      }
    })
    .onEnd(() => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
      hudTimeoutRef.current = setTimeout(() => setHudIndicator(null), 1200);
    })
    .runOnJS(true);

  // Combine Pan and Taps
  const composedGestures = Gesture.Race(panGesture, tapGestures);

  const handleDownloadPress = React.useCallback(() => {
    if (downloadStatus === 'completed') {
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (downloadStatus === 'downloading') {
      DownloadService.pauseDownload(`${animeId}-ep-${episodeNumber}`);
      return;
    }
    if (downloadStatus === 'paused') {
      DownloadService.resumeDownload(`${animeId}-ep-${episodeNumber}`);
      return;
    }
    DownloadService.startDownload(
      { id: animeId, title: animeTitle, thumbnail: thumbnailRef.current || thumbnail },
      {
        id: episodeId,
        number: episodeNumber,
        title: `Episodio ${episodeNumber}`,
        dataId: episodeDataId,
        servers: [],
      }
    );
  }, [downloadStatus, animeId, episodeNumber, animeTitle, thumbnail, episodeId, episodeDataId]);

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />

      {/* Fallback Screen Brightness Overlay (used only when native Android window brightness is unavailable) */}
      {!hasNativeDeviceControls && screenBrightness >= 0 && screenBrightness < 1.0 && (
        <View
          pointerEvents="none"
          style={[
            styles.brightnessOverlay,
            { opacity: (1.0 - screenBrightness) * 0.75 },
          ]}
        />
      )}

      {/* Video Content & Interaction Area */}
      <View style={styles.videoContainer}>
        {videoUrl && !sourceError ? (
          <VideoView
            ref={videoViewRef}
            style={styles.video}
            player={player}
            allowsPictureInPicture={true}
            startsPictureInPictureAutomatically={true}
            contentFit="contain"
            nativeControls={false}
            fullscreenOptions={{
              enable: true,
              orientation: 'landscape',
              autoExitOnRotate: true,
            }}
            onPictureInPictureStart={() => {
              isInPiPRef.current = true;
              wasPlayingInPiPRef.current = player.playing;
              player.showNowPlayingNotification = true;
              if (Platform.OS === 'android' && KuroDeviceControls) {
                KuroDeviceControls.restoreSystemBrightness();
              }
            }}
            onPictureInPictureStop={() => {
              isInPiPRef.current = false;
              // Preserve playback status: if player was active in PiP, keep flag true so expanding
              // to fullscreen will resume playback smoothly without pausing
              wasPlayingInPiPRef.current = wasPlayingInPiPRef.current || player.playing;
              // If user pressed 'X' to close PiP, Android stops the window while app remains in background.
              // Wait for activity transition: only pause if app is STILL in background after 500ms.
              // If user restored fullscreen with the Android button, the app becomes 'active' and playback continues without pausing.
              if (pipStopTimerRef.current) {
                clearTimeout(pipStopTimerRef.current);
              }
              pipStopTimerRef.current = setTimeout(() => {
                if (AppState.currentState !== 'active') {
                  wasPlayingInPiPRef.current = false;
                  userWantsPlaybackRef.current = false;
                  setIsPlaying(false);
                  setIsBuffering(false);
                  setShowManualReload(false);
                  player.pause();
                  player.showNowPlayingNotification = false;
                  if (animeId && episodeId) {
                    saveProgress(currentTimeRef.current, durationRef.current);
                  }
                }
              }, 500);
              const resumeFromPiP = () => {
                if (AppState.currentState === 'active') {
                  if (Platform.OS === 'android' && KuroDeviceControls) {
                    if (screenBrightnessRef.current >= 0) {
                      KuroDeviceControls.setWindowBrightness(screenBrightnessRef.current);
                    } else {
                      KuroDeviceControls.restoreSystemBrightness();
                    }
                  }
                }
                if (AppState.currentState === 'active' && wasPlayingInPiPRef.current) {
                  wasPlayingInPiPRef.current = false;
                  userWantsPlaybackRef.current = true;
                  softKickAttemptedRef.current = false;
                  stallReloadAttemptsRef.current = 0;
                  lastAdvanceTimestampRef.current = Date.now();
                  setIsPlaying(true);
                  setIsBuffering(false);
                  setShowManualReload(false);
                  player.playbackRate = playbackSpeedRef.current;
                  if (!player.playing) {
                    player.play();
                  }
                } else if (AppState.currentState === 'active') {
                  syncPlayerStateFromNative();
                }
              };
              // Immediate check and staggered fallbacks for returning to active fullscreen
              if (AppState.currentState === 'active' && wasPlayingInPiPRef.current) {
                resumeFromPiP();
              } else {
                setTimeout(resumeFromPiP, 150);
                setTimeout(resumeFromPiP, 300);
              }
            }}
          />
        ) : isLoadingSource ? (
          <PlayerSkeleton animeTitle={animeTitle} episodeNumber={episodeNumber} />
        ) : (
          <View style={styles.loadingWrapper}>
            <Pressable
              style={[
                styles.errorBackBtn,
                {
                  top: Math.max(16, insets.top + 8),
                  left: Math.max(16, insets.left + 8),
                },
              ]}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="TORNA INDIETRO"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>

            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error || oledTheme.colors.error} />
            <Text style={styles.errorText}>{(sourceError || 'IMPOSSIBILE RIPRODURRE').toUpperCase()}</Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleManualReloadStream}
              hitSlop={8}
              accessibilityLabel="RIPROVA CARICAMENTO STREAMING"
            >
              <Text style={[styles.retryBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>RIPROVA</Text>
            </Pressable>
          </View>
        )}

        {/* Integrated Loading / Buffering feedback indicator when OSD controls are hidden */}
        {!showControls && isBufferingOrLoading && !sourceError && (
          <View style={styles.loadingOverlay} pointerEvents="box-none">
            <View
              pointerEvents="none"
              style={[styles.centerPlayBtn, { backgroundColor: `${theme.colors.primary}E0` }]}
            >
              <ActivityIndicator size="large" color={getContrastTextColor(theme.colors.primary)} />
            </View>
            {showManualReload && (
              <Pressable
                style={styles.stallReloadBtn}
                onPress={handleManualReloadStream}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="RICARICA FLUSSO VIDEO"
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.stallReloadText}>RICARICA STREAM</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Gesture detector touch surface over video (active only when controls are hidden and video is healthy) */}
        {!showControls && !sourceError && !isLoadingSource && (
          <GestureDetector gesture={composedGestures}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>
        )}

        {/* Cumulative Double-Tap Skip Feedback (centered beside central play/pause symbol) */}
        {cumulativeSkip && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerSkipFeedback,
              cumulativeSkip.direction === 'left' ? styles.centerSkipLeft : styles.centerSkipRight,
              {
                opacity: skipAnim.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: skipAnim.interpolate({
                      inputRange: [0, 1, 1.15],
                      outputRange: [0.85, 1, 1.15],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons
              name={cumulativeSkip.direction === 'left' ? 'play-back' : 'play-forward'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.centerSkipText}>
              {cumulativeSkip.direction === 'left'
                ? `-${cumulativeSkip.seconds}s`
                : `+${cumulativeSkip.seconds}s`}
            </Text>
          </Animated.View>
        )}

        {/* HUD Volume / Brightness / Speed Indicator */}
        {hudIndicator && (
          <View pointerEvents="none" style={[styles.hudBox, { top: Math.max(24, insets.top + 8) }]}>
            <Ionicons
              name={
                hudIndicator.type === 'volume'
                  ? 'volume-high'
                  : hudIndicator.type === 'brightness'
                  ? hudIndicator.value === 'AUTOMATICA'
                    ? 'sunny-outline'
                    : 'sunny'
                  : 'speedometer'
              }
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.hudText}>
              {typeof hudIndicator.value === 'string'
                ? hudIndicator.value
                : `${hudIndicator.value}%`}
            </Text>
          </View>
        )}

        {/* OSD Controls Overlay */}
        {showControls && Boolean(videoUrl) && !sourceError && (
          <View style={styles.osdOverlay}>
            {/* Background tap handler to dismiss controls */}
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} />

            {/* OSD Header */}
            <PlayerHeader
              animeTitle={animeTitle}
              episodeNumber={episodeNumber}
              insets={insets}
              isOffline={isOffline}
              downloadStatus={downloadStatus}
              downloadProgress={downloadProgress}
              onDownloadPress={handleDownloadPress}
              onBack={() => router.back()}
              onStartPiP={handleStartPiP}
              onOpenOptions={() => {
                resetControlsTimer();
                setIsServerSheetVisible(true);
              }}
              onOpenInfo={() => {
                resetControlsTimer();
                setIsInfoSheetVisible(true);
              }}
            />

            {/* Central Controls: Prev Ep - Play/Pause - Next Ep */}
            <View
              style={[
                styles.osdCenterRow,
                { gap: isLandscape ? 40 : 24 },
              ]}
              pointerEvents="box-none"
            >
              {prevEpisode ? (
                <Pressable
                  style={styles.navEpBtn}
                  onPress={() => handleNavigateToEpisode(prevEpisode)}
                  hitSlop={12}
                  accessibilityLabel={`EPISODIO PRECEDENTE: ${prevEpisode.number}`}
                >
                  <Ionicons name="play-skip-back" size={26} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View style={styles.navEpBtnSpacer} />
              )}

              <Pressable
                style={[styles.centerPlayBtn, { backgroundColor: `${theme.colors.primary}E0` }]}
                onPress={handlePlayPause}
                hitSlop={16}
                accessibilityLabel={isBufferingOrLoading ? 'CARICAMENTO' : isPlaying ? 'PAUSA' : 'RIPRODUCI'}
              >
                {isBufferingOrLoading ? (
                  <ActivityIndicator
                    size="large"
                    color={getContrastTextColor(theme.colors.primary)}
                  />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={44}
                    color={getContrastTextColor(theme.colors.primary)}
                  />
                )}
              </Pressable>

              {nextEpisode ? (
                <Pressable
                  style={styles.navEpBtn}
                  onPress={() => handleNavigateToEpisode(nextEpisode)}
                  hitSlop={12}
                  accessibilityLabel={`EPISODIO SUCCESSIVO: ${nextEpisode.number}`}
                >
                  <Ionicons name="play-skip-forward" size={26} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View style={styles.navEpBtnSpacer} />
              )}
            </View>

            {showManualReload && isBufferingOrLoading && (
              <View style={styles.osdManualReloadWrap} pointerEvents="box-none">
                <Pressable
                  style={styles.stallReloadBtn}
                  onPress={handleManualReloadStream}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="RICARICA FLUSSO VIDEO"
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.stallReloadText}>RICARICA STREAM</Text>
                </Pressable>
              </View>
            )}

            {/* OSD Footer */}
            <PlayerFooter
              insets={insets}
              player={player}
              duration={duration}
              initialTime={currentTimeRef.current || initialResumePosition}
              playbackSpeed={playbackSpeed}
              isLandscape={isLandscape}
              primaryColor={theme.colors.primary}
              cardColor={theme.colors.card}
              borderColor={theme.colors.border}
              textColor={theme.colors.text}
              thumbnail={thumbnail}
              onSeek={handleTimelineSeek}
              onCycleSpeed={handleCycleSpeed}
              onOpenSpeedSheet={() => {
                resetControlsTimer();
                setIsServerSheetVisible(true);
              }}
              onToggleFullscreen={toggleOrientationFullscreen}
              onOpenEpisodes={() => {
                resetControlsTimer();
                setIsEpisodesSheetVisible(true);
              }}
              onScrubbingChange={handleScrubbingChange}
              aniSkipResults={aniSkipResults}
              isLocalSource={Boolean(videoUrl && (videoUrl.startsWith('file://') || videoUrl.startsWith('content://')))}
              videoUrl={videoUrl || undefined}
            />
          </View>
        )}

        {/* AniSkip Button (mutually exclusive: never shows 'SALTA' and 'PROSSIMO' together) */}
        {primarySkipState ? (
          <AniSkipButton
            key={
              primarySkipState.action === 'next'
                ? `${primarySkipState.skip.skipId}-next`
                : primarySkipState.skip.skipId
            }
            variant={primarySkipState.action === 'next' ? 'next' : 'skip'}
            skipType={
              primarySkipState.skip.skipType === 'ed' ||
              primarySkipState.skip.skipType === 'mixed-ed'
                ? 'outro'
                : primarySkipState.skip.skipType === 'recap'
                ? 'recap'
                : 'intro'
            }
            durationSeconds={
              typeof aniSkipSettingsRef.current?.buttonDuration === 'number'
                ? aniSkipSettingsRef.current.buttonDuration
                : 10
            }
            onSkip={handleAniSkip}
            onTimeout={handlePrimarySkipTimeout}
            player={player}
            startTime={primarySkipState.skip.interval.startTime}
            endTime={primarySkipState.skip.interval.endTime}
            currentTime={currentTimeRef.current}
          />
        ) : separateNextState && (nextEpisode || nextEpisodeRef.current) ? (
          <AniSkipButton
            key={separateNextState.promptId}
            variant="next"
            skipType="outro"
            durationSeconds={
              typeof aniSkipSettingsRef.current?.buttonDuration === 'number'
                ? aniSkipSettingsRef.current.buttonDuration
                : 10
            }
            onSkip={handleSeparateNextSkip}
            onTimeout={handleSeparateNextTimeout}
            player={player}
            startTime={separateNextState.startTime}
            endTime={separateNextState.endTime}
            currentTime={currentTimeRef.current}
          />
        ) : null}
      </View>

      {/* Playback Options & Speed Sheet (server selection enabled if multiple providers exist) */}
      <ServerBottomSheet
        isVisible={isServerSheetVisible}
        onClose={() => setIsServerSheetVisible(false)}
        currentSpeed={playbackSpeed}
        onSelectSpeed={handleSpeedChange}
        showServerSelection={ProviderRegistry.hasMultipleProviders()}
      />

      {/* Episodes Carousel Bottom Sheet */}
      <PlayerEpisodesCarouselSheet
        isVisible={isEpisodesSheetVisible}
        onClose={() => setIsEpisodesSheetVisible(false)}
        episodes={episodesList}
        currentEpisodeNumber={episodeNumber}
        animeId={animeId}
        animeImage={thumbnail}
        onSelectEpisode={handleNavigateToEpisode}
      />

      {/* Anime & Episode Info Bottom Sheet */}
      <PlayerInfoSheet
        isVisible={isInfoSheetVisible}
        onClose={() => setIsInfoSheetVisible(false)}
        animeTitle={animeTitle}
        episodeNumber={episodeNumber}
        totalEpisodes={totalEpisodesRef.current ?? animeDetail?.totalEpisodes}
        episodeTitle={episodesList[currEpIndex]?.title}
        episodeDescription={episodesList[currEpIndex]?.description}
        animeImage={thumbnail || animeDetail?.image || animeDetail?.thumbnail}
        description={animeDetail?.synopsis || animeDetail?.description}
        genres={animeDetail?.genres}
        status={animeDetail?.status}
        releaseYear={animeDetail?.releaseYear}
      />
    </View>
  );
}
