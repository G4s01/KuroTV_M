import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  Animated,
  Platform,
  AppState,
  DeviceEventEmitter,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { AniSkipService } from '@/services/aniskip';
import { AppStorage } from '@/services/storage';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';
import { AniSkipButton } from '@/components/AniSkipButton';
import { PlayerSkeleton } from '@/components/skeleton';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import {
  PlayerHeader,
  PlayerFooter,
  PlayerEpisodesCarouselSheet,
  PlayerInfoSheet,
  formatTime,
} from '@/components/player';
import type { AniSkipResult, AnimeDetail, Episode } from '@/types';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

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
  }>();

  const episodeId = params.id || '';
  const animeId = params.animeId || '';
  const episodeNumber = parseInt(params.episodeNumber || '1', 10);
  const episodeDataId = params.episodeDataId || '';
  const animeTitle = params.animeTitle || 'Anime';

  const [serverId, setServerId] = React.useState(params.serverId || '9');
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = React.useState(true);
  const [sourceError, setSourceError] = React.useState<string | null>(null);

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
        nextEpisode: nextEp
          ? {
              id: nextEp.id,
              number: nextEp.number,
              dataId: nextEp.dataId,
            }
          : undefined,
      });
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
  // screenBrightness: 0.1 .. 1.0 or -1 for 'AUTOMATICA'
  const [screenBrightness, setScreenBrightness] = React.useState<number>(0.8);

  const startVolumeRef = React.useRef(1.0);
  const startBrightnessRef = React.useRef(0.8);
  const startPanTranslationYRef = React.useRef(0);
  const hudTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // AniSkip intervals
  const [aniSkipResults, setAniSkipResults] = React.useState<AniSkipResult[]>([]);
  const aniSkipResultsRef = React.useRef<AniSkipResult[]>([]);
  const [activeSkip, setActiveSkip] = React.useState<AniSkipResult | null>(null);
  const activeSkipRef = React.useRef<AniSkipResult | null>(null);
  const skipTriggeredTimeRef = React.useRef<number>(0);
  const autoSkippedIdsRef = React.useRef<Set<string>>(new Set());
  const aniSkipSettingsRef = React.useRef(AppStorage.getAniSkipSettings());

  // Subscribe to live AniSkip settings changes
  React.useEffect(() => {
    const unsub = AppStorage.addSettingsListener(() => {
      aniSkipSettingsRef.current = AppStorage.getAniSkipSettings();
    });
    return unsub;
  }, []);

  const videoViewRef = React.useRef<VideoView>(null);
  const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize video player with expo-video
  // staysActiveInBackground: false prevents persistent background playback when app or PiP is dismissed
  // showNowPlayingNotification: true provides notification shade playback controls on Android MediaSession
  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = false;
    p.volume = 1.0;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = true;
    p.timeUpdateEventInterval = 0.5; // Starts Android IntervalUpdateClock for timeUpdate
    p.play();
  });

  // Track player loading and playback status
  const [playerStatus, setPlayerStatus] = React.useState<string>('idle');
  useEventListener(player, 'statusChange', ({ status }) => {
    setPlayerStatus(status);
  });

  // Track playback time
  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    currentTimeRef.current = time;
    if (player.duration && player.duration > 0 && player.duration !== durationRef.current) {
      setDuration(player.duration);
      durationRef.current = player.duration;
    }

    // Periodically save progress to storage every ~4 seconds
    if (animeId && Math.abs(time - lastSavedTimeRef.current) >= 4) {
      saveProgress(time, player.duration || durationRef.current);
    }

    // Isolated AniSkip check: handles manual 10s button & auto skipping based on user settings
    if (aniSkipResultsRef.current.length > 0) {
      const settings = aniSkipSettingsRef.current;
      const matchingSkip =
        settings.mode !== 'disabled'
          ? aniSkipResultsRef.current.find((res) => {
              if (time < res.interval.startTime || time > res.interval.endTime) return false;
              if ((res.skipType === 'op' || res.skipType === 'mixed-op') && !settings.enableOpening) return false;
              if ((res.skipType === 'ed' || res.skipType === 'mixed-ed') && !settings.enableEnding) return false;
              if (res.skipType === 'recap' && !settings.enableRecap) return false;
              return true;
            }) || null
          : null;

      // Allow auto-skipped interval to be re-skipped if user seeks back before the interval start
      for (const res of aniSkipResultsRef.current) {
        if (time < res.interval.startTime - 2) {
          autoSkippedIdsRef.current.delete(res.skipId);
        }
      }

      if (matchingSkip) {
        if (settings.mode === 'auto') {
          if (!autoSkippedIdsRef.current.has(matchingSkip.skipId)) {
            autoSkippedIdsRef.current.add(matchingSkip.skipId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            const target = matchingSkip.interval.endTime + 0.5;
            player.currentTime = target;
            currentTimeRef.current = target;
            saveProgress(target, durationRef.current);
            activeSkipRef.current = null;
            setActiveSkip(null);
          }
        } else {
          // Manual mode: show button for max 10 seconds from interval start
          const maxDisplayEnd = Math.min(
            matchingSkip.interval.endTime,
            matchingSkip.interval.startTime + 10
          );
          const isIn10sWindow = time >= matchingSkip.interval.startTime && time < maxDisplayEnd;

          if (isIn10sWindow) {
            if (activeSkipRef.current?.skipId !== matchingSkip.skipId) {
              activeSkipRef.current = matchingSkip;
              setActiveSkip(matchingSkip);
            }
          } else {
            if (activeSkipRef.current !== null) {
              activeSkipRef.current = null;
              setActiveSkip(null);
            }
          }
        }
      } else if (activeSkipRef.current !== null) {
        activeSkipRef.current = null;
        setActiveSkip(null);
      }
    } else if (activeSkipRef.current !== null) {
      activeSkipRef.current = null;
      setActiveSkip(null);
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    setIsPlaying(playing);
    if (isInPiPRef.current) {
      wasPlayingInPiPRef.current = playing;
    }
    if (!playing && animeId) {
      saveProgress(currentTimeRef.current, durationRef.current);
    }
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay') {
      const dur = player.duration || durationRef.current;
      if (dur > 0) {
        setDuration(dur);
        durationRef.current = dur;
      }
      // Re-apply desired playback rate in case underlying player reset it
      player.playbackRate = playbackSpeedRef.current;

      if (!hasResumedRef.current && initialResumePosition > 0) {
        hasResumedRef.current = true;
        player.currentTime = initialResumePosition;
        currentTimeRef.current = initialResumePosition;
        saveProgress(initialResumePosition, dur);
      } else if (!hasResumedRef.current) {
        hasResumedRef.current = true;
        saveProgress(currentTimeRef.current, dur);
      }
    }
    if (error) {
      setSourceError(`ERRORE RIPRODUZIONE: ${error.message.toUpperCase()}`);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (animeId && episodeId) {
      const finalDuration = player.duration || durationRef.current;
      saveProgress(finalDuration, finalDuration);
    }
  });

  const currentAnimeIdRef = React.useRef(animeId);
  currentAnimeIdRef.current = animeId;
  const currentEpisodeIdRef = React.useRef(episodeId);
  currentEpisodeIdRef.current = episodeId;
  const saveProgressRef = React.useRef(saveProgress);
  saveProgressRef.current = saveProgress;

  // AppState listener: if app goes to background without PiP, pause playback and save progress
  React.useEffect(() => {
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Give Android PiP transition time to activate and fire onPictureInPictureStart
        backgroundTimer = setTimeout(() => {
          if (!isInPiPRef.current && AppState.currentState === 'background') {
            player.pause();
            player.showNowPlayingNotification = false;
            if (currentAnimeIdRef.current && currentEpisodeIdRef.current) {
              saveProgressRef.current(currentTimeRef.current, durationRef.current);
            }
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
        player.showNowPlayingNotification = true;
        // If returning from PiP and was playing, resume playback smoothly without pausing
        if (wasPlayingInPiPRef.current) {
          wasPlayingInPiPRef.current = false;
          player.play();
        }
      }
    });

    return () => {
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
      if (pipStopTimerRef.current) {
        clearTimeout(pipStopTimerRef.current);
      }
      sub.remove();
    };
  }, [player]);

  // Save latest progress on exit / screen unmount (only when leaving the screen)
  React.useEffect(() => {
    return () => {
      player.pause();
      player.showNowPlayingNotification = false;
      if (currentAnimeIdRef.current && currentEpisodeIdRef.current) {
        saveProgressRef.current(currentTimeRef.current, durationRef.current);
      }
    };
  }, [player]);

  // Open in full horizontal screen (landscape) on start & respond to device rotation
  React.useEffect(() => {
    // 1. Immediately request landscape fullscreen
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});

    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
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
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  };

  // Fetch direct video stream
  const loadStream = React.useCallback(async () => {
    setIsLoadingSource(true);
    setSourceError(null);

    try {
      let directUrl = '';
      const targetEp = {
        id: episodeId,
        number: episodeNumber,
        dataId: episodeDataId,
      };
      // Step 3: Resolve via ProviderRegistry with multi-provider fallback
      const directSource = await ProviderRegistry.resolveVideoWithFallback(targetEp, serverId);
      if (directSource?.url) {
        directUrl = directSource.url;
      }

      if (!directUrl && animeId) {
        // Fallback to scraping episode directly from detail page
        const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
        const ep = detail?.episodes?.find((e) => e.id === episodeId || e.number === episodeNumber);
        if (ep) {
          const direct = await ProviderRegistry.resolveVideoWithFallback(ep, serverId);
          if (direct?.url) {
            directUrl = direct.url;
          }
        }
      }

      if (directUrl) {
        setVideoUrl(directUrl);
        const formattedTitle = animeTitle
          ? `${animeTitle} - EPISODIO ${episodeNumber}`
          : `EPISODIO ${episodeNumber}`;
        const artworkUri = thumbnailRef.current || thumbnail || animeDetail?.image || animeDetail?.thumbnail || undefined;
        const videoSource = {
          uri: directUrl,
          metadata: {
            title: formattedTitle,
            artist: animeTitle ? String(animeTitle).toUpperCase() : 'KURO MOBILE',
            artwork: artworkUri,
          },
        };
        if (typeof player.replaceAsync === 'function') {
          await player.replaceAsync(videoSource).catch((err) => {
            console.warn('[VideoPlayer] replaceAsync error:', err);
          });
        } else {
          player.replace(videoSource);
        }
        player.playbackRate = playbackSpeedRef.current;
        player.showNowPlayingNotification = true;
        player.play();

        if (initialResumePosition > 0) {
          player.currentTime = initialResumePosition;
          currentTimeRef.current = initialResumePosition;
        }
      } else {
        setSourceError('NESSUN FLUSSO VIDEO TROVATO. RIPROVA TRA POCHI SECONDI.');
      }
    } catch (err: any) {
      setSourceError((err.message || 'ERRORE DURANTE LA RISOLUZIONE DEL VIDEO.').toUpperCase());
    } finally {
      setIsLoadingSource(false);
    }
  }, [episodeId, episodeNumber, episodeDataId, serverId, animeId, player, initialResumePosition]);

  React.useEffect(() => {
    loadStream();
  }, [loadStream]);

  // Reset player and metadata states when navigating to a different episode
  React.useEffect(() => {
    hasResumedRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    setDuration(0);
    setVideoUrl(null);
    setIsLoadingSource(true);
    setSourceError(null);
    setAniSkipResults([]);
    aniSkipResultsRef.current = [];
    setActiveSkip(null);
    activeSkipRef.current = null;
    autoSkippedIdsRef.current.clear();
    skipTriggeredTimeRef.current = 0;
  }, [episodeId, episodeNumber]);

  // Fetch AniSkip timestamps & episode batch metadata for advancing next episode
  React.useEffect(() => {
    async function loadMetadataAndAniSkip() {
      try {
        if (!detailLoadedRef.current && animeId) {
          const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
          detailLoadedRef.current = true;
          if (detail) {
            setAnimeDetail(detail);
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

  const isScrubbingRef = React.useRef(false);

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
      } else {
        resetControlsTimer();
      }
    },
    [resetControlsTimer]
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

  const toggleControls = () => {
    Haptics.selectionAsync().catch(() => {});
    setShowControls((prev) => !prev);
  };

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isPlaying) {
      player.pause();
    } else {
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
    (targetEp: Episode | { id: string; number: number; dataId?: string; thumbnail?: string }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      saveProgress(currentTimeRef.current, durationRef.current);
      hasResumedRef.current = false;
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
        },
      });
    },
    [animeId, animeTitle, serverId, episodesList.length, router, saveProgress]
  );

  // Notification Shade Next Episode Action listener
  React.useEffect(() => {
    const nextSub = DeviceEventEmitter.addListener('KuroNotificationNextEpisode', () => {
      const nextEp = nextEpisodeRef.current;
      if (nextEp) {
        handleNavigateToEpisode(nextEp);
      }
    });
    return () => {
      nextSub.remove();
    };
  }, [handleNavigateToEpisode]);

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
    const skip = activeSkip || activeSkipRef.current;
    if (!skip) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const target = skip.interval.endTime + 0.5;
    player.currentTime = target;
    currentTimeRef.current = target;
    saveProgress(target, durationRef.current);
    activeSkipRef.current = null;
    setActiveSkip(null);
  };

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

  // Pan gesture for volume and brightness: vertical only, guarded against horizontal gestures and accidental activation
  const panGesture = Gesture.Pan()
    .enabled(!showControls)
    .activeOffsetY([-18, 18])
    .failOffsetX([-14, 14])
    .onStart((e) => {
      startPanTranslationYRef.current = e.translationY;
      startVolumeRef.current = typeof player.volume === 'number' ? player.volume : 1.0;
      startBrightnessRef.current = screenBrightness === -1 ? 0.08 : screenBrightness;
    })
    .onUpdate((e) => {
      // Strictly ignore horizontal gestures: only adjust if vertical movement dominates
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        return;
      }
      const effectiveTranslationY = e.translationY - startPanTranslationYRef.current;
      const travelRange = Math.max(260, windowHeight * 0.7);
      const delta = -effectiveTranslationY / travelRange;
      if (e.x > windowWidth / 2) {
        // Volume adjustment (right side)
        const newVol = Math.max(0, Math.min(1, startVolumeRef.current + delta));
        player.volume = newVol;
        setHudIndicator({ type: 'volume', value: Math.round(newVol * 100) });
      } else {
        // Brightness adjustment (left side)
        // If swiped to the lowest peak, set value to 'AUTOMATICA'
        const raw = startBrightnessRef.current + delta;
        if (raw <= 0.08) {
          setScreenBrightness(-1);
          setHudIndicator({ type: 'brightness', value: 'AUTOMATICA' });
        } else {
          const newBright = Math.max(0.1, Math.min(1, raw));
          setScreenBrightness(newBright);
          setHudIndicator({ type: 'brightness', value: Math.round(newBright * 100) });
        }
      }
    })
    .onEnd(() => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
      hudTimeoutRef.current = setTimeout(() => setHudIndicator(null), 1200);
    })
    .runOnJS(true);

  // Combine Pan and Taps
  const composedGestures = Gesture.Race(panGesture, tapGestures);

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />

      {/* Screen Brightness Overlay (hidden when set to 'AUTOMATICA') */}
      {screenBrightness >= 0 && screenBrightness < 1.0 && (
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
        {videoUrl ? (
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
                  player.pause();
                  player.showNowPlayingNotification = false;
                  if (animeId && episodeId) {
                    saveProgress(currentTimeRef.current, durationRef.current);
                  }
                }
              }, 500);
              // Immediate check and staggered fallbacks for returning to active fullscreen
              if (AppState.currentState === 'active' && wasPlayingInPiPRef.current) {
                wasPlayingInPiPRef.current = false;
                if (!player.playing) {
                  player.play();
                }
              } else {
                setTimeout(() => {
                  if (AppState.currentState === 'active' && wasPlayingInPiPRef.current) {
                    wasPlayingInPiPRef.current = false;
                    if (!player.playing) {
                      player.play();
                    }
                  }
                }, 150);
                setTimeout(() => {
                  if (AppState.currentState === 'active' && wasPlayingInPiPRef.current) {
                    wasPlayingInPiPRef.current = false;
                    if (!player.playing) {
                      player.play();
                    }
                  }
                }, 300);
              }
            }}
          />
        ) : isLoadingSource ? (
          <PlayerSkeleton animeTitle={animeTitle} episodeNumber={episodeNumber} />
        ) : (
          <View style={styles.loadingWrapper}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error || oledTheme.colors.error} />
            <Text style={styles.errorText}>{(sourceError || 'IMPOSSIBILE RIPRODURRE').toUpperCase()}</Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={loadStream}
            >
              <Text style={[styles.retryBtnText, { color: getContrastTextColor(theme.colors.primary) }]}>RIPROVA</Text>
            </Pressable>
          </View>
        )}

        {/* Loading / Buffering Feedback Overlay during episode loading */}
        {videoUrl && (isLoadingSource || playerStatus === 'loading') && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <View
              style={[
                styles.loadingBox,
                { backgroundColor: 'rgba(0, 0, 0, 0.85)', borderColor: theme.colors.border },
              ]}
            >
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          </View>
        )}

        {/* Gesture detector touch surface over video (active when controls hidden) */}
        {!showControls && (
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
          <View style={[styles.hudBox, { top: Math.max(24, insets.top + 8) }]}>
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
        {showControls && Boolean(videoUrl) && (
          <View style={styles.osdOverlay}>
            {/* Background tap handler to dismiss controls */}
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} />

            {/* OSD Header */}
            <PlayerHeader
              animeTitle={animeTitle}
              episodeNumber={episodeNumber}
              insets={insets}
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
                accessibilityLabel={isPlaying ? 'PAUSA' : 'RIPRODUCI'}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={44}
                  color={getContrastTextColor(theme.colors.primary)}
                />
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
            />
          </View>
        )}

        {/* AniSkip Button (rendered on top of video & OSD, independent of controls touch) */}
        {activeSkip && (
          <AniSkipButton
            skipType={
              activeSkip.skipType === 'ed' || activeSkip.skipType === 'mixed-ed'
                ? 'outro'
                : activeSkip.skipType === 'recap'
                ? 'recap'
                : 'intro'
            }
            onSkip={handleAniSkip}
            onTimeout={() => {
              activeSkipRef.current = null;
              setActiveSkip(null);
            }}
            player={player}
            startTime={activeSkip.interval.startTime}
            endTime={activeSkip.interval.endTime}
            currentTime={currentTimeRef.current}
          />
        )}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    zIndex: 1,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadingWrapper: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    color: '#A3A3A3',
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorText: {
    color: oledTheme.colors.error,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  retryBtn: {
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  centerSkipFeedback: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  centerSkipLeft: {
    right: '50%',
    marginRight: 64,
  },
  centerSkipRight: {
    left: '50%',
    marginLeft: 64,
  },
  centerSkipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.5,
  },
  hudBox: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  osdOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    zIndex: 4,
  },
  osdCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    zIndex: 2,
  },
  navEpBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navEpBtnSpacer: {
    width: 48,
    height: 48,
  },
  centerPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
