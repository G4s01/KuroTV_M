package com.kurotv.mobile
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import androidx.activity.OnBackPressedCallback

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private var lastBackPressTime: Long = 0L

  private val backCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      val now = System.currentTimeMillis()
      if (now - lastBackPressTime < 300L) {
        return
      }
      lastBackPressTime = now
      isEnabled = false
      onBackPressed()
      isEnabled = true
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // Bridge AndroidX OnBackPressedDispatcher to React Native's onBackPressed handler
    // on all Android versions (mitigating the React Native 0.88 isAtLeastTargetSdk36 limitation
    // and ensuring full-screen system back gestures on tablets like Xiaomi Pad 6 reach JS).
    onBackPressedDispatcher.addCallback(this, backCallback)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which enables the New Architecture automatically.
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
    // Disable the bridge callback while calling super/moveTaskToBack,
    // so that onBackPressedDispatcher doesn't re-intercept the default back action
    // and cause an infinite loop of spurious hardwareBackPress events to JS.
    backCallback.isEnabled = false
    try {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
        if (!moveTaskToBack(false)) {
          // For non-root activities, use the default implementation to finish them.
          super.invokeDefaultOnBackPressed()
        }
        return
      }

      // If root activity on Android S+, cleanly move task to background
      if (isTaskRoot && moveTaskToBack(false)) {
        return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
    } finally {
      backCallback.isEnabled = true
    }
  }
}
