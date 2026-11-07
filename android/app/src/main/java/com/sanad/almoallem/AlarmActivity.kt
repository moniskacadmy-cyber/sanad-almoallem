package com.sanad.almoallem

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.app.Activity

/** Full-screen alarm shown over the lock screen: class name + Stop / Snooze. Built in code (no layout file). */
class AlarmActivity : Activity() {
    companion object {
        const val ACTION_CLOSE = "com.sanad.almoallem.ALARM_CLOSE"
    }

    private val closer = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = finish()
    }

    @Suppress("DEPRECATION", "UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: "حصة"
        val body = intent.getStringExtra(AlarmScheduler.EXTRA_BODY) ?: ""

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F172A"))
            setPadding(48, 48, 48, 48)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        root.addView(TextView(this).apply {
            text = "⏰"; textSize = 64f; gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = title; textSize = 28f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            setPadding(0, 24, 0, 8)
        })
        root.addView(TextView(this).apply {
            text = body; textSize = 18f; setTextColor(Color.parseColor("#CBD5E1")); gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        })
        root.addView(Button(this).apply {
            text = "إيقاف"; textSize = 20f
            setOnClickListener { send(AlarmService.ACTION_STOP) }
        })
        root.addView(Button(this).apply {
            text = "غفوة 5 دقايق"; textSize = 18f
            setOnClickListener { send(AlarmService.ACTION_SNOOZE) }
        })
        setContentView(root)

        val filter = IntentFilter(ACTION_CLOSE)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(closer, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(closer, filter)
        }
    }

    private fun send(action: String) {
        startService(Intent(this, AlarmService::class.java).setAction(action))
        finish()
    }

    override fun onDestroy() {
        try { unregisterReceiver(closer) } catch (_: Exception) {}
        super.onDestroy()
    }
}
