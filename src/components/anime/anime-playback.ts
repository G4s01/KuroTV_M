import type { Episode, WatchProgressItem } from '@/types';

export interface EpisodeProgressSummary {
  episode: Episode;
  progress: number;
  currentTime: number;
  updatedAt: number;
  isCompleted: boolean;
}

export interface AnimePlayTarget {
  episode: Episode | undefined;
  resumePosition: number;
  hasStartedWatching: boolean;
}

/**
 * Resolves the target episode and timeline position for the primary Play button
 * on the Anime Detail screen, prioritizing the most recently watched episode
 * (at its saved timeline when in progress, or advancing to the next unwatched
 * episode when the last watched episode was completed).
 */
export function resolveAnimePlayTarget(
  episodes: Episode[],
  progressList: EpisodeProgressSummary[],
  latestProgress?: WatchProgressItem
): AnimePlayTarget {
  if (!episodes || episodes.length === 0) {
    return { episode: undefined, resumePosition: 0, hasStartedWatching: false };
  }

  const findEpisodeIndex = (
    prog: Pick<WatchProgressItem, 'episodeId' | 'episodeNumber'>
  ): number => {
    if (prog.episodeId) {
      const byId = episodes.findIndex((ep) => ep.id === prog.episodeId);
      if (byId !== -1) return byId;
    }
    return episodes.findIndex((ep) => ep.number === prog.episodeNumber);
  };

  let mostRecentEntry: EpisodeProgressSummary | undefined;
  let mostRecentIdx = -1;
  for (let i = 0; i < progressList.length; i++) {
    const item = progressList[i];
    const hasActivity =
      item.updatedAt > 0 || item.currentTime > 0 || item.progress > 0 || item.isCompleted;
    if (!hasActivity) continue;
    if (
      !mostRecentEntry ||
      item.updatedAt > mostRecentEntry.updatedAt ||
      (item.updatedAt === mostRecentEntry.updatedAt &&
        item.episode.number > mostRecentEntry.episode.number)
    ) {
      mostRecentEntry = item;
      mostRecentIdx = i;
    }
  }

  const resolveFromCompleted = (completedIdx: number): AnimePlayTarget => {
    const nextUnwatchedAfter = progressList
      .slice(completedIdx + 1)
      .find((p) => !p.isCompleted);
    if (nextUnwatchedAfter) {
      const resumePosition = nextUnwatchedAfter.currentTime > 0 ? nextUnwatchedAfter.currentTime : 0;
      return {
        episode: nextUnwatchedAfter.episode,
        resumePosition,
        hasStartedWatching: resumePosition > 0 || nextUnwatchedAfter.progress > 0,
      };
    }
    return {
      episode: episodes[completedIdx],
      resumePosition: 0,
      hasStartedWatching: false,
    };
  };

  if (
    latestProgress &&
    (!mostRecentEntry || (latestProgress.updatedAt || 0) >= mostRecentEntry.updatedAt)
  ) {
    const matchedIdx = findEpisodeIndex(latestProgress);
    if (matchedIdx !== -1) {
      const matchedSummary = progressList[matchedIdx];
      const isCompleted = Boolean(latestProgress.isCompleted || matchedSummary?.isCompleted);
      if (!isCompleted) {
        const resumePosition = Math.max(
          latestProgress.currentTime || 0,
          matchedSummary?.currentTime || 0
        );
        return {
          episode: episodes[matchedIdx],
          resumePosition,
          hasStartedWatching: resumePosition > 0 || (matchedSummary?.progress || 0) > 0,
        };
      }
      return resolveFromCompleted(matchedIdx);
    }
  }

  if (mostRecentEntry && mostRecentIdx !== -1) {
    if (!mostRecentEntry.isCompleted) {
      return {
        episode: mostRecentEntry.episode,
        resumePosition: mostRecentEntry.currentTime,
        hasStartedWatching: mostRecentEntry.currentTime > 0 || mostRecentEntry.progress > 0,
      };
    }
    return resolveFromCompleted(mostRecentIdx);
  }

  return {
    episode: episodes[0],
    resumePosition: 0,
    hasStartedWatching: false,
  };
}
