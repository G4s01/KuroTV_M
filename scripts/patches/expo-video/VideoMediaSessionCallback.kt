package expo.modules.video.playbackService

import android.os.Bundle
import androidx.media3.common.Player
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.ListenableFuture
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi

@OptIn(UnstableApi::class)
class VideoMediaSessionCallback(
  private val playbackService: ExpoVideoPlaybackService
) : MediaSession.Callback {
  override fun onConnect(
    session: MediaSession,
    controller: MediaSession.ControllerInfo
  ): MediaSession.ConnectionResult {
    try {
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailablePlayerCommands(
          MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
            .add(Player.COMMAND_SEEK_FORWARD)
            .add(Player.COMMAND_SEEK_BACK)
            .add(Player.COMMAND_SEEK_TO_NEXT)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .build()
        )
        .setAvailableSessionCommands(
          MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
            .add(SessionCommand(ExpoVideoPlaybackService.SEEK_BACKWARD_COMMAND, Bundle.EMPTY))
            .add(SessionCommand(ExpoVideoPlaybackService.SEEK_FORWARD_COMMAND, Bundle.EMPTY))
            .add(SessionCommand(ExpoVideoPlaybackService.NEXT_EPISODE_COMMAND, Bundle.EMPTY))
            .add(SessionCommand(ExpoVideoPlaybackService.PREVIOUS_EPISODE_COMMAND, Bundle.EMPTY))
            .build()
        )
        .build()
    } catch (e: Exception) {
      return MediaSession.ConnectionResult.reject()
    }
  }

  override fun onPlayerCommandRequest(
    session: MediaSession,
    controller: MediaSession.ControllerInfo,
    playerCommand: Int
  ): Int {
    if (playerCommand == Player.COMMAND_SEEK_TO_NEXT) {
      playbackService.emitNextEpisode()
      return MediaSession.ConnectionResult.RESULT_SUCCESS
    } else if (playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS) {
      playbackService.emitPrevEpisode()
      return MediaSession.ConnectionResult.RESULT_SUCCESS
    }
    return super.onPlayerCommandRequest(session, controller, playerCommand)
  }

  override fun onCustomCommand(session: MediaSession, controller: MediaSession.ControllerInfo, customCommand: SessionCommand, args: Bundle): ListenableFuture<SessionResult> {
    when (customCommand.customAction) {
      ExpoVideoPlaybackService.SEEK_FORWARD_COMMAND -> session.player.seekTo(session.player.currentPosition + ExpoVideoPlaybackService.SEEK_INTERVAL_MS)
      ExpoVideoPlaybackService.SEEK_BACKWARD_COMMAND -> session.player.seekTo(session.player.currentPosition - ExpoVideoPlaybackService.SEEK_INTERVAL_MS)
      ExpoVideoPlaybackService.NEXT_EPISODE_COMMAND -> {
        playbackService.emitNextEpisode()
      }
      ExpoVideoPlaybackService.PREVIOUS_EPISODE_COMMAND -> {
        playbackService.emitPrevEpisode()
      }
    }
    return super.onCustomCommand(session, controller, customCommand, args)
  }
}
