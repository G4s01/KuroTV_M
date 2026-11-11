package expo.modules.video.playbackService

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.annotation.MainThread
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.MediaStyleNotificationHelper
import androidx.media3.session.SessionCommand
import com.google.common.collect.ImmutableList
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.exception.Exceptions
import expo.modules.video.R
import expo.modules.video.getPlaybackServiceErrorMessage
import expo.modules.video.player.VideoPlayer
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference
import java.util.IdentityHashMap

class PlaybackServiceBinder(val service: ExpoVideoPlaybackService) : Binder()

@OptIn(UnstableApi::class)
class KuroForwardingPlayer(
  val underlyingPlayer: ExoPlayer,
  private val service: ExpoVideoPlaybackService
) : ForwardingPlayer(underlyingPlayer) {
  var customArtworkBytes: ByteArray? = null
  private val listenerWrappers = IdentityHashMap<Player.Listener, Player.Listener>()

  private fun withNavigationCommands(commands: Player.Commands): Player.Commands {
    return commands.buildUpon()
      .add(Player.COMMAND_SEEK_TO_NEXT)
      .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
      .add(Player.COMMAND_SEEK_TO_PREVIOUS)
      .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
      .build()
  }

  override fun isCommandAvailable(command: Int): Boolean {
    if (
      command == Player.COMMAND_SEEK_TO_NEXT ||
      command == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM ||
      command == Player.COMMAND_SEEK_TO_PREVIOUS ||
      command == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM
    ) {
      return true
    }
    return super.isCommandAvailable(command)
  }

  override fun getAvailableCommands(): Player.Commands {
    return withNavigationCommands(super.getAvailableCommands())
  }

  override fun addListener(listener: Player.Listener) {
    val existing = synchronized(listenerWrappers) { listenerWrappers[listener] }
    if (existing != null) {
      return
    }
    val wrapped = object : Player.Listener by listener {
      override fun onAvailableCommandsChanged(availableCommands: Player.Commands) {
        listener.onAvailableCommandsChanged(withNavigationCommands(availableCommands))
      }
    }
    synchronized(listenerWrappers) {
      listenerWrappers[listener] = wrapped
    }
    super.addListener(wrapped)
  }

  override fun removeListener(listener: Player.Listener) {
    val wrapped = synchronized(listenerWrappers) {
      listenerWrappers.remove(listener)
    }
    super.removeListener(wrapped ?: listener)
  }

  override fun seekToNext() {
    service.emitNextEpisode()
  }

  override fun seekToNextMediaItem() {
    service.emitNextEpisode()
  }

  override fun seekToPrevious() {
    service.emitPrevEpisode()
  }

  override fun seekToPreviousMediaItem() {
    service.emitPrevEpisode()
  }

  override fun getMediaMetadata(): MediaMetadata {
    val base = super.getMediaMetadata()
    val bytes = customArtworkBytes
    if (bytes != null) {
      return base.buildUpon()
        .setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
        .build()
    }
    return base
  }
}

@OptIn(UnstableApi::class)
class ExpoVideoPlaybackService : MediaSessionService() {
  private lateinit var weakContext: WeakReference<AppContext>
  var appContext: AppContext
    get() = weakContext.get() ?: throw Exceptions.AppContextLost()
    set(value) {
      weakContext = WeakReference(value)
    }
  private val mediaSessions = mutableMapOf<ExoPlayer, MediaSession>()
  private val forwardingPlayers = mutableMapOf<ExoPlayer, KuroForwardingPlayer>()
  private val playerListeners = mutableMapOf<ExoPlayer, Player.Listener>()
  private val binder = PlaybackServiceBinder(this)
  private var mostRecentInteractionSession: MediaSession? = null
  private var isForeground: Boolean = false

  private val commandSeekForward = SessionCommand(SEEK_FORWARD_COMMAND, Bundle.EMPTY)
  private val commandSeekBackward = SessionCommand(SEEK_BACKWARD_COMMAND, Bundle.EMPTY)
  private val commandNextEpisode = SessionCommand(NEXT_EPISODE_COMMAND, Bundle.EMPTY)
  private val commandPreviousEpisode = SessionCommand(PREVIOUS_EPISODE_COMMAND, Bundle.EMPTY)

  private val seekForwardButton = CommandButton.Builder()
    .setDisplayName("forward")
    .setSessionCommand(commandSeekForward)
    .setIconResId(R.drawable.seek_forwards_10s)
    .build()

  private val seekBackwardButton = CommandButton.Builder()
    .setDisplayName("rewind")
    .setSessionCommand(commandSeekBackward)
    .setIconResId(R.drawable.seek_backwards_10s)
    .build()

  private val nextEpisodeButton = CommandButton.Builder()
    .setDisplayName("next")
    .setSessionCommand(commandNextEpisode)
    .setIconResId(android.R.drawable.ic_media_next)
    .build()

  private val previousEpisodeButton = CommandButton.Builder()
    .setDisplayName("previous")
    .setSessionCommand(commandPreviousEpisode)
    .setIconResId(android.R.drawable.ic_media_previous)
    .build()

  fun emitNextEpisode() {
    appContext.mainQueue.launch {
      (appContext.reactContext as? com.facebook.react.bridge.ReactContext)
        ?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("KuroNotificationNextEpisode", null)
    }
  }

  fun emitPrevEpisode() {
    appContext.mainQueue.launch {
      (appContext.reactContext as? com.facebook.react.bridge.ReactContext)
        ?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("KuroNotificationPrevEpisode", null)
    }
  }

  fun setShowNotification(showNotification: Boolean, player: ExoPlayer) {
    appContext.mainQueue.launch {
      val sessionExtras = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        mediaSessions[player]?.sessionExtras?.deepCopy() ?: Bundle()
      } else {
        Bundle()
      }
      sessionExtras.putBoolean(SESSION_SHOW_NOTIFICATION, showNotification)
      mediaSessions[player]?.let {
        it.sessionExtras = sessionExtras
        onUpdateNotification(it, showNotification && player.playWhenReady)
      }
    }
  }

  fun registerPlayer(videoPlayer: VideoPlayer) {
    appContext.mainQueue.launch {
      val player = videoPlayer.player
      if (mediaSessions[player] != null) {
        return@launch
      }

      val forwardingPlayer = KuroForwardingPlayer(player, this@ExpoVideoPlaybackService)

      val mediaSession = MediaSession.Builder(this@ExpoVideoPlaybackService, forwardingPlayer)
        .setId("ExpoVideoPlaybackService_${player.hashCode()}")
        .setCallback(VideoMediaSessionCallback(this@ExpoVideoPlaybackService))
        .setCustomLayout(ImmutableList.of(seekBackwardButton, seekForwardButton))
        .build()

      // Replace the basic media session with a session connected to our playback service.
      videoPlayer.mediaSession.release()
      videoPlayer.mediaSession = mediaSession

      mediaSessions[player] = mediaSession
      forwardingPlayers[player] = forwardingPlayer
      addSession(mediaSession)

      // Listener to automatically refresh notification and metadata on item/playback changes
      val listener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
          appContext.mainQueue.launch {
            mediaSessions[player]?.let { session ->
              onUpdateNotification(session, videoPlayer.showNowPlayingNotification && player.playWhenReady)
            }
          }
        }

        override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
          appContext.mainQueue.launch {
            mediaSessions[player]?.let { session ->
              onUpdateNotification(session, videoPlayer.showNowPlayingNotification && player.playWhenReady)
            }
          }
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
          appContext.mainQueue.launch {
            mediaSessions[player]?.let { session ->
              onUpdateNotification(session, videoPlayer.showNowPlayingNotification && player.playWhenReady)
            }
          }
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
          appContext.mainQueue.launch {
            mediaSessions[player]?.let { session ->
              onUpdateNotification(session, videoPlayer.showNowPlayingNotification && playWhenReady)
            }
          }
        }
      }
      playerListeners[player] = listener
      player.addListener(listener)

      setShowNotification(videoPlayer.showNowPlayingNotification, player)
    }
  }

  fun unregisterPlayer(player: ExoPlayer) {
    appContext.mainQueue.launch {
      hidePlayerNotification(player)
      playerListeners.remove(player)?.let {
        player.removeListener(it)
      }
      forwardingPlayers.remove(player)
      val session = mediaSessions.remove(player)
      session?.release()
      if (mediaSessions.isEmpty()) {
        cleanup()
        stopSelf()
      } else {
        setMostRecentInteractionSession(findMostRecentInteractionSession())
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder {
    super.onBind(intent)
    return binder
  }

  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
    appContext.mainQueue.launch {
      if (startInForegroundRequired && session.wantsToShowNotification()) {
        setMostRecentInteractionSession(session)
      } else {
        setMostRecentInteractionSession(findMostRecentInteractionSession())
      }
    }
  }

  @MainThread
  private fun setMostRecentInteractionSession(session: MediaSession?) {
    if (session?.player?.playWhenReady == false) {
      stopForeground(STOP_FOREGROUND_DETACH)
      isForeground = false
    }

    if (mostRecentInteractionSession != session) {
      hideAllNotifications()
    }

    mostRecentInteractionSession = session
    session?.let {
      createNotification(it, it.player.playWhenReady)
    } ?: run {
      stopForeground(STOP_FOREGROUND_REMOVE)
      isForeground = false
    }
  }

  /**
   * Finds a session that is playing media. And wants to show a notification
   * If none exists, returns a session that wants to show a notification.
   * The current mostRecentInteractionSession always has priority to reduce the number of unnecessary notification changes.
   */
  @MainThread
  private fun findMostRecentInteractionSession(): MediaSession? {
    val prioritizedSessions = (listOfNotNull(mostRecentInteractionSession) + mediaSessions.values.toList()).distinct()

    return prioritizedSessions.firstOrNull { it.wantsToShowNotification() && it.player.playWhenReady }
      ?: prioritizedSessions.firstOrNull { it.wantsToShowNotification() }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    cleanup()
    stopSelf()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    return null
  }

  override fun onDestroy() {
    cleanup()
    super.onDestroy()
  }

  private fun loadArtworkBitmap(uri: Uri, callback: (Bitmap?) -> Unit) {
    appContext.backgroundCoroutineScope.launch {
      try {
        val bitmap = when (uri.scheme) {
          "http", "https" -> {
            val connection = java.net.URL(uri.toString()).openConnection() as java.net.HttpURLConnection
            connection.doInput = true
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36")
            connection.connectTimeout = 6000
            connection.readTimeout = 6000
            connection.connect()
            connection.inputStream.use { stream ->
              BitmapFactory.decodeStream(stream)
            }
          }
          "file", "content" -> {
            contentResolver.openInputStream(uri)?.use { stream ->
              BitmapFactory.decodeStream(stream)
            }
          }
          else -> null
        }
        appContext.mainQueue.launch {
          callback(bitmap)
        }
      } catch (e: Exception) {
        appContext.mainQueue.launch {
          callback(null)
        }
      }
    }
  }

  @MainThread
  private fun createNotification(session: MediaSession, startInForegroundRequired: Boolean = false) {
    val player = session.player
    val mediaItem = player.currentMediaItem
    if (mediaItem == null && player.mediaMetadata.title == null) {
      return
    }

    val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(NotificationChannel(CHANNEL_ID, CHANNEL_ID, NotificationManager.IMPORTANCE_LOW))
    }

    val titleCandidate = mediaItem?.mediaMetadata?.title?.toString()
      ?: player.mediaMetadata.title?.toString()
    val contentTitle = if (!titleCandidate.isNullOrBlank() && titleCandidate != "\u200E") {
      titleCandidate
    } else {
      "KURO MOBILE"
    }

    val artistCandidate = mediaItem?.mediaMetadata?.artist?.toString()
      ?: player.mediaMetadata.artist?.toString()
    val contentText = if (!artistCandidate.isNullOrBlank()) {
      artistCandidate
    } else {
      "KURO MOBILE"
    }

    val artworkUri = mediaItem?.mediaMetadata?.artworkUri ?: player.mediaMetadata.artworkUri
    val forwardingPlayer = if (player is KuroForwardingPlayer) player else null
    val notificationId = forwardingPlayer?.underlyingPlayer?.hashCode() ?: player.hashCode()

    val notificationCompat = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(androidx.media3.session.R.drawable.media3_icon_circular_play)
      .setContentTitle(contentTitle)
      .setContentText(contentText)
      .setStyle(MediaStyleNotificationHelper.MediaStyle(session))

    if (artworkUri != null) {
      loadArtworkBitmap(artworkUri) { bitmap ->
        if (bitmap != null && session == mostRecentInteractionSession) {
          try {
            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            val bytes = baos.toByteArray()
            forwardingPlayer?.customArtworkBytes = bytes

            val updatedMetadata = (session.player.mediaMetadata.buildUpon())
              .setTitle(contentTitle)
              .setArtist(contentText)
              .setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
              .build()
            forwardingPlayer?.underlyingPlayer?.playlistMetadata = updatedMetadata
          } catch (_: Exception) {}

          val updatedNotification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(androidx.media3.session.R.drawable.media3_icon_circular_play)
            .setContentTitle(contentTitle)
            .setContentText(contentText)
            .setLargeIcon(bitmap)
            .setStyle(MediaStyleNotificationHelper.MediaStyle(session))
            .build()
          notificationManager.notify(notificationId, updatedNotification)
        }
      }
    }

    val notification = notificationCompat.build()

    if (startInForegroundRequired) {
      try {
        startForeground(notificationId, notification)
        isForeground = true
      } catch (e: Exception) {
        appContext.jsLogger?.error(getPlaybackServiceErrorMessage("Failed to start the expo-video foreground service"), e)
      }
    } else {
      notificationManager.notify(notificationId, notification)
    }
  }

  private fun cleanup() {
    appContext.mainQueue.launch {
      stopForeground(Service.STOP_FOREGROUND_REMOVE)
      isForeground = false

      hideAllNotifications()

      val sessionsToRelease = mediaSessions.values.toList()
      mediaSessions.clear()
      for (session in sessionsToRelease) {
        session.release()
      }

      forwardingPlayers.clear()
      playerListeners.clear()

      val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        notificationManager.deleteNotificationChannel(CHANNEL_ID)
      }
    }
  }

  @MainThread
  private fun hidePlayerNotification(player: ExoPlayer) {
    val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.cancel(player.hashCode())
  }

  @MainThread
  private fun hideAllNotifications() {
    val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.cancelAll()
  }

  private fun MediaSession.wantsToShowNotification(): Boolean =
    this.sessionExtras.getBoolean(SESSION_SHOW_NOTIFICATION, false)

  companion object {
    const val SEEK_FORWARD_COMMAND = "SEEK_FORWARD"
    const val SEEK_BACKWARD_COMMAND = "SEEK_REWIND"
    const val NEXT_EPISODE_COMMAND = "NEXT_EPISODE"
    const val PREVIOUS_EPISODE_COMMAND = "PREVIOUS_EPISODE"
    const val CHANNEL_ID = "PlaybackService"
    const val SESSION_SHOW_NOTIFICATION = "showNotification"
    const val SEEK_INTERVAL_MS = 10000L

    fun startService(appContext: AppContext, context: Context, serviceConnection: PlaybackServiceConnection): Boolean {
      appContext.reactContext?.apply {
        val intent = Intent(context, ExpoVideoPlaybackService::class.java)
        intent.action = SERVICE_INTERFACE

        startService(intent)

        val flags = if (Build.VERSION.SDK_INT >= 29) {
          BIND_AUTO_CREATE or BIND_INCLUDE_CAPABILITIES
        } else {
          BIND_AUTO_CREATE
        }

        return bindService(intent, serviceConnection, flags)
      }
      return false
    }
  }
}
