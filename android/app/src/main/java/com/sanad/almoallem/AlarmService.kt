package com.sanad.almoallem

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

/** Rings like a real alarm (alarm volume, loops, vibrates) for up to one minute, with Stop / Snooze actions. */
class AlarmService : Service() {
    companion object {
        const val ACTION_START = "com.sanad.almoallem.ALARM_START"
        const val ACTION_STOP = "com.sanad.almoallem.ALARM_STOP"
        const val ACTION_SNOOZE = "com.sanad.almoallem.ALARM_SNOOZE"
        private const val CHANNEL = "sanad_alarm_v1"
        private const val NOTIF_ID = 7101
        private const val MAX_RING_MS = 60_000L
    }

    private var player: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var title = "حصة"
    private var body = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopRinging(); return START_NOT_STICKY }
            ACTION_SNOOZE -> {
                AlarmScheduler.scheduleOnce(this, 5 * 60_000L, title, body)
                stopRinging()
                return START_NOT_STICKY
            }
        }
        title = intent?.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: "حصة"
        body = intent?.getStringExtra(AlarmScheduler.EXTRA_BODY) ?: ""
        startForegroundCompat()
        startRinging()
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ stopRinging() }, MAX_RING_MS)
        return START_NOT_STICKY
    }

    private fun ensureChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            val ch = NotificationChannel(CHANNEL, "منبّه الحصص", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "منبّه يرنّ قبل الحصة"
                setSound(null, null) // the service plays the sound itself, at alarm volume
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            nm.createNotificationChannel(ch)
        }
    }

    private fun servicePi(code: Int, action: String): PendingIntent =
        PendingIntent.getService(
            this, code, Intent(this, AlarmService::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    private fun buildNotification(): Notification {
        ensureChannel()
        val full = PendingIntent.getActivity(
            this, 1,
            Intent(this, AlarmActivity::class.java).apply {
                putExtra(AlarmScheduler.EXTRA_TITLE, title)
                putExtra(AlarmScheduler.EXTRA_BODY, body)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setFullScreenIntent(full, true)
            .setContentIntent(full)
            .addAction(0, "غفوة 5 دقايق", servicePi(2, ACTION_SNOOZE))
            .addAction(0, "إيقاف", servicePi(3, ACTION_STOP))
            .build()
    }

    private fun startForegroundCompat() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    @Suppress("DEPRECATION")
    private fun startRinging() {
        try {
            player?.release()
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmService, uri)
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
        }
        try {
            val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = longArrayOf(0, 600, 400, 600, 400, 600, 1200)
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                v.vibrate(pattern, 0)
            }
        } catch (_: Exception) {
        }
    }

    private fun stopRinging() {
        handler.removeCallbacksAndMessages(null)
        try { player?.stop() } catch (_: Exception) {}
        player?.release()
        player = null
        try { (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).cancel() } catch (_: Exception) {}
        sendBroadcast(Intent(AlarmActivity.ACTION_CLOSE).setPackage(packageName))
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopRinging()
        super.onDestroy()
    }
}
