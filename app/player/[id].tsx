import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AnimeWorldScraper } from '@/services/scraper';
import { AniSkipService } from '@/services/aniskip';
import { AppStorage } from '@/services/storage';
import { oledTheme } from '@/theme';
import { AniSkipButton } from '@/components/AniSkipButton';
import { ServerBottomSheet } from '@/components/ServerBottomSheet';
import type { AniSkipResult } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatTime(seconds: number): string {
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

export default function VideoPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    animeId: string;
    episodeNumber: string;
    episodeDataId?: string;
    animeTitle?: string;
    serverId?: string;
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
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0);
  const [isServerSheetVisible, setIsServerSheetVisible] = React.useState(false);

  // Skip feedback animation
  const [seekFeedback, setSeekFeedback] = React.useState<'left' | 'right' | null>(null);
  const [seekFeedbackAnim] = React.useState(new Animated.Value(0));

  // Volume / Brightness indicator
  const [hudIndicator, setHudIndicator] = React.useState<{
    type: 'volume' | 'brightness';
    value: number;
  } | null>(null);

  // AniSkip intervals
  const [aniSkipResults, setAniSkipResults] = React.useState<AniSkipResult[]>([]);

  const videoViewRef = React.useRef<VideoView>(null);
  const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize video player with expo-video
  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = false;
    p.play();
  });

  // Track playback time
  useEventListener(player, 'timeUpdate', ({ currentTime: time }) => {
    setCurrentTime(time);
    if (player.duration && player.duration > 0 && player.duration !== duration) {
      setDuration(player.duration);
    }

    // Periodically save progress to storage
    if (animeId && time > 5) {
      AppStorage.saveWatchProgress({
        animeId,
        animeTitle,
        episodeId,
        episodeNumber,
        currentTime: time,
        duration: player.duration || 0,
        dataId: episodeDataId,
        serverId,
      });
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    setIsPlaying(playing);
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay' && player.duration) {
      setDuration(player.duration);
    }
    if (error) {
      setSourceError(`Errore riproduzione: ${error.message}`);
    }
  });

  // Fetch direct video stream
  React.useEffect(() => {
    let isCancelled = false;

    async function loadStream() {
      setIsLoadingSource(true);
      setSourceError(null);

      try {
        let directUrl = '';
        const targetEp = {
          id: episodeId,
          number: episodeNumber,
          dataId: episodeDataId,
        };
        const directSource = await AnimeWorldScraper.resolveEpisodeVideo(targetEp, serverId);
        if (directSource?.url) {
          directUrl = directSource.url;
        }

        if (!directUrl && animeId) {
          // Fallback to scraping episode directly
          const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
          const ep = detail?.episodes?.find((e) => e.id === episodeId || e.number === episodeNumber);
          if (ep) {
            const direct = await AnimeWorldScraper.resolveEpisodeVideo(ep, serverId);
            if (direct?.url) {
              directUrl = direct.url;
            }
          }
        }

        if (!isCancelled) {
          if (directUrl) {
            setVideoUrl(directUrl);
            player.replace(directUrl);
            player.play();

            // Resume from last saved position if available
            const savedProg = AppStorage.getWatchProgress(animeId, episodeNumber);
            if (savedProg && savedProg.currentTime > 5 && !savedProg.isCompleted) {
              player.currentTime = savedProg.currentTime;
            }
          } else {
            setSourceError('Nessun flusso video trovato per questo server.');
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setSourceError(err.message || 'Errore durante la risoluzione del video.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSource(false);
        }
      }
    }

    loadStream();

    return () => {
      isCancelled = true;
    };
  }, [animeId, episodeId, episodeNumber, episodeDataId, serverId]);

  // Fetch AniSkip timestamps
  React.useEffect(() => {
    async function loadAniSkip() {
      try {
        const detail = await AnimeWorldScraper.getAnimeDetail(animeId);
        const malId = detail?.malId || detail?.anilistId;
        if (malId) {
          const skips = await AniSkipService.getSkipTimes({
            malId: Number(malId),
            episodeNumber,
            episodeLength: duration,
          });
          setAniSkipResults(skips || []);
        }
      } catch {
        // AniSkip is optional, ignore failure
      }
    }

    if (animeId && episodeNumber) {
      loadAniSkip();
    }
  }, [animeId, episodeNumber, duration]);

  // Auto-hide controls after 4 seconds of inactivity
  const resetControlsTimer = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, []);

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

  const triggerSeekAnimation = (side: 'left' | 'right') => {
    setSeekFeedback(side);
    seekFeedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(seekFeedbackAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(seekFeedbackAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => setSeekFeedback(null));
  };

  const handleDoubleTapLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    player.seekBy(-10);
    triggerSeekAnimation('left');
  };

  const handleDoubleTapRight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    player.seekBy(10);
    triggerSeekAnimation('right');
  };

  const handleStartPiP = async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      if (videoViewRef.current) {
        await videoViewRef.current.startPictureInPicture();
      }
    } catch (e: any) {
      console.warn('PiP error:', e);
    }
  };

  const handleSpeedChange = (speed: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPlaybackSpeed(speed);
    player.playbackRate = speed;
  };

  // Determine active AniSkip interval
  const activeSkip = React.useMemo(() => {
    if (!aniSkipResults.length) return null;
    return aniSkipResults.find(
      (res) =>
        currentTime >= res.interval.startTime &&
        currentTime <= res.interval.endTime
    );
  }, [aniSkipResults, currentTime]);

  const handleAniSkip = () => {
    if (!activeSkip) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    player.currentTime = activeSkip.interval.endTime + 0.5;
  };

  // Setup Gesture Handlers
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      toggleControls();
    })
    .runOnJS(true);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (e.x < SCREEN_WIDTH / 2) {
        handleDoubleTapLeft();
      } else {
        handleDoubleTapRight();
      }
    })
    .runOnJS(true);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Vertical swipe on right side for volume / left for brightness
      const delta = -e.translationY / 200;
      const clamped = Math.max(0, Math.min(1, 0.5 + delta));
      if (e.x > SCREEN_WIDTH / 2) {
        setHudIndicator({ type: 'volume', value: Math.round(clamped * 100) });
      } else {
        setHudIndicator({ type: 'brightness', value: Math.round(clamped * 100) });
      }
    })
    .onEnd(() => {
      setTimeout(() => setHudIndicator(null), 1000);
    })
    .runOnJS(true);

  const composedGestures = Gesture.Race(doubleTap, singleTap, panGesture);

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />

      {/* Gestures Area */}
      <GestureDetector gesture={composedGestures}>
        <View style={styles.videoContainer}>
          {videoUrl ? (
            <VideoView
              ref={videoViewRef}
              style={styles.video}
              player={player}
              allowsPictureInPicture={true}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <View style={styles.loadingWrapper}>
              {isLoadingSource ? (
                <>
                  <ActivityIndicator size="large" color={oledTheme.colors.primary} />
                  <Text style={styles.loadingText}>Connessione al server video...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle-outline" size={48} color={oledTheme.colors.error} />
                  <Text style={styles.errorText}>{sourceError || 'Impossibile riprodurre'}</Text>
                  <Pressable
                    style={styles.retryBtn}
                    onPress={() => setIsServerSheetVisible(true)}
                  >
                    <Text style={styles.retryBtnText}>Scegli un altro server</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Double Tap Feedback Overlay */}
          {seekFeedback && (
            <Animated.View
              style={[
                styles.seekFeedbackBox,
                seekFeedback === 'left' ? styles.seekLeft : styles.seekRight,
                { opacity: seekFeedbackAnim },
              ]}
            >
              <Ionicons
                name={seekFeedback === 'left' ? 'play-back' : 'play-forward'}
                size={36}
                color="#FFFFFF"
              />
              <Text style={styles.seekFeedbackText}>
                {seekFeedback === 'left' ? '-10s' : '+10s'}
              </Text>
            </Animated.View>
          )}

          {/* HUD Volume / Brightness Indicator */}
          {hudIndicator && (
            <View style={styles.hudBox}>
              <Ionicons
                name={hudIndicator.type === 'volume' ? 'volume-high' : 'sunny'}
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.hudText}>{hudIndicator.value}%</Text>
            </View>
          )}

          {/* AniSkip Button */}
          {activeSkip && (
            <AniSkipButton
              skipType={activeSkip.skipType === 'ed' ? 'outro' : 'intro'}
              onSkip={handleAniSkip}
            />
          )}

          {/* OSD Controls Overlay */}
          {showControls && (
            <View style={styles.osdOverlay}>
              {/* OSD Header */}
              <View style={[styles.osdHeader, { paddingTop: Math.max(16, insets.top) }]}>
                <Pressable
                  style={styles.osdBackBtn}
                  onPress={() => router.back()}
                  hitSlop={12}
                  accessibilityLabel="Esci dal player"
                >
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>

                <View style={styles.osdTitleWrapper}>
                  <Text style={styles.osdTitle} numberOfLines={1}>
                    {animeTitle}
                  </Text>
                  <Text style={styles.osdSubtitle}>Episodio {episodeNumber}</Text>
                </View>

                <View style={styles.osdHeaderActions}>
                  <Pressable
                    style={styles.osdIconBtn}
                    onPress={handleStartPiP}
                    hitSlop={8}
                    accessibilityLabel="Picture in Picture"
                  >
                    <Ionicons name="open-outline" size={22} color="#FFFFFF" />
                  </Pressable>

                  <Pressable
                    style={styles.osdIconBtn}
                    onPress={() => setIsServerSheetVisible(true)}
                    hitSlop={8}
                    accessibilityLabel="Server e opzioni"
                  >
                    <Ionicons name="options" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* Central Play/Pause Button */}
              <View style={styles.osdCenter}>
                <Pressable
                  style={styles.centerPlayBtn}
                  onPress={handlePlayPause}
                  hitSlop={16}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={44}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>

              {/* OSD Footer */}
              <View style={[styles.osdFooter, { paddingBottom: Math.max(16, insets.bottom) }]}>
                {/* Progress bar track */}
                <View style={styles.timelineWrapper}>
                  <View style={styles.timelineTrack}>
                    <View
                      style={[
                        styles.timelineBar,
                        {
                          width: `${
                            duration > 0
                              ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Time & Action Controls */}
                <View style={styles.footerControls}>
                  <Text style={styles.timeText}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>

                  <View style={styles.footerRight}>
                    <Pressable
                      style={styles.speedBtn}
                      onPress={() => setIsServerSheetVisible(true)}
                      hitSlop={8}
                    >
                      <Text style={styles.speedBtnText}>{playbackSpeed}x</Text>
                    </Pressable>

                    <Pressable
                      style={styles.fullscreenBtn}
                      onPress={() => {
                        videoViewRef.current?.enterFullscreen();
                      }}
                      hitSlop={8}
                      accessibilityLabel="Schermo intero"
                    >
                      <Ionicons name="expand-outline" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Server & Speed Sheet */}
      <ServerBottomSheet
        isVisible={isServerSheetVisible}
        onClose={() => setIsServerSheetVisible(false)}
        servers={[
          { id: '9', name: 'AnimeWorld Server (Default)' },
          { id: '4', name: 'Streamtape' },
          { id: '8', name: 'Doodstream' },
        ]}
        currentServerId={serverId}
        onSelectServer={(sId) => setServerId(sId)}
        currentSpeed={playbackSpeed}
        onSelectSpeed={handleSpeedChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
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
    fontSize: 14,
  },
  errorText: {
    color: oledTheme.colors.error,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
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
    fontSize: 13,
  },
  seekFeedbackBox: {
    position: 'absolute',
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: oledTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  seekLeft: {
    left: 48,
  },
  seekRight: {
    right: 48,
  },
  seekFeedbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  hudBox: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: oledTheme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  osdOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
  },
  osdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  osdBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  osdTitleWrapper: {
    flex: 1,
  },
  osdTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  osdSubtitle: {
    color: '#A3A3A3',
    fontSize: 12,
    marginTop: 2,
  },
  osdHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  osdIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  osdCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229, 9, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  osdFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  timelineWrapper: {
    paddingVertical: 8,
  },
  timelineTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timelineBar: {
    height: '100%',
    backgroundColor: oledTheme.colors.primary,
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#262626',
    minHeight: 32,
    justifyContent: 'center',
  },
  speedBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fullscreenBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
