package com.sanad.almoallem

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object NotificationHelper {
    // IMPORTANT: Android never changes a channel's importance after creation. Bump the suffix if you ever change it.
    const val CHANNEL_ID = "sanad_heads_up_v1"

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.channel_name),
            NotificationManager.IMPORTANCE_HIGH // heads-up banner over other apps
        ).apply {
            description = context.getString(R.string.channel_desc)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun show(context: Context, tag: String, title: String, message: String) {
        if (!hasPermission(context)) return
        createChannel(context)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val id = tag.hashCode()
        val pending = PendingIntent.getActivity(
            context, id, tapIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setLargeIcon(circleIcon(context))                 // app icon as a circle
            .setContentTitle(title)                            // bold title
            .setContentText(message)                           // one line, ellipsized with "..." in the banner
            .setStyle(NotificationCompat.BigTextStyle().bigText(message)) // full text when pulled down
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setColor(Color.parseColor("#6D28D9"))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        NotificationManagerCompat.from(context).notify(tag, id, notification)
    }

    private fun circleIcon(context: Context): Bitmap {
        val size = 192
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#6D28D9") }
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        ContextCompat.getDrawable(context, R.drawable.ic_sanad_glyph)?.let {
            it.setBounds(0, 0, size, size)
            it.draw(canvas)
        }
        return bmp
    }
}
