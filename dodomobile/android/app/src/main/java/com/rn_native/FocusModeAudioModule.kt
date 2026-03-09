package com.rn_native

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FocusModeAudioModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private var previousInterruptionFilter: Int? = null
    private var previousRingerMode: Int? = null
  }

  override fun getName(): String = "FocusModeAudio"

  @ReactMethod
  fun enableFocusModeSilence(promise: Promise) {
    val audioManager =
      reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        ?: run {
          promise.reject("unavailable", "Audio manager unavailable.")
          return
        }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val notificationManager = reactApplicationContext
        .getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: run {
          promise.reject("unavailable", "Notification manager unavailable.")
          return
        }

      if (!notificationManager.isNotificationPolicyAccessGranted) {
        promise.reject(
          "permission_required",
          "Notification policy access is required to enable Do Not Disturb.",
        )
        return
      }

      if (previousInterruptionFilter == null) {
        previousInterruptionFilter = notificationManager.currentInterruptionFilter
      }

      notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
    }

    if (previousRingerMode == null) {
      previousRingerMode = audioManager.ringerMode
    }

    audioManager.ringerMode = AudioManager.RINGER_MODE_SILENT
    promise.resolve(true)
  }

  @ReactMethod
  fun disableFocusModeSilence(promise: Promise) {
    val audioManager =
      reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        ?: run {
          promise.reject("unavailable", "Audio manager unavailable.")
          return
        }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val notificationManager = reactApplicationContext
        .getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: run {
          promise.reject("unavailable", "Notification manager unavailable.")
          return
        }

      if (notificationManager.isNotificationPolicyAccessGranted) {
        notificationManager.setInterruptionFilter(
          previousInterruptionFilter ?: NotificationManager.INTERRUPTION_FILTER_ALL,
        )
      }
    }

    audioManager.ringerMode = previousRingerMode ?: AudioManager.RINGER_MODE_NORMAL
    previousInterruptionFilter = null
    previousRingerMode = null
    promise.resolve(true)
  }

  @ReactMethod
  fun openPolicyAccessSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve(false)
      return
    }

    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("open_failed", error)
    }
  }
}