package expo.modules.video.utils

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession

internal fun createPlayerLaunchPendingIntent(
  context: Context,
  fallbackActivityClass: Class<*>? = null
): PendingIntent? {
  val packageName = context.packageName ?: return null
  val baseIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    ?: fallbackActivityClass?.let { Intent(context, it) }
    ?: return null

  val launchIntent = Intent(baseIntent).apply {
    action = Intent.ACTION_MAIN
    addCategory(Intent.CATEGORY_LAUNCHER)
    // Keep existing singleTask MainActivity intact on the active player route
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    data = null
  }

  val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  } else {
    PendingIntent.FLAG_UPDATE_CURRENT
  }
  return PendingIntent.getActivity(context, 0, launchIntent, pendingFlags)
}

/**
 * Creates a basic foreground media session, for receiving commands like play/pause from bluetooth devices.
 */
internal fun buildBasicMediaSession(context: Context, player: ExoPlayer): MediaSession {
  val builder = MediaSession.Builder(context, player)
    .setId("ExpoVideoBasicMediaSession_${player.hashCode()}")
  createPlayerLaunchPendingIntent(context)?.let { pendingIntent ->
    builder.setSessionActivity(pendingIntent)
  }
  return builder.build()
}
