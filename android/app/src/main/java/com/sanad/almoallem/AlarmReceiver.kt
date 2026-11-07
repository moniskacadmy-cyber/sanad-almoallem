package com.sanad.almoallem

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            AlarmScheduler.ACTION_FIRE -> {
                val ruleId = intent.getStringExtra(AlarmScheduler.EXTRA_RULE_ID) ?: ""
                val svc = Intent(context, AlarmService::class.java).apply {
                    action = AlarmService.ACTION_START
                    putExtra(AlarmScheduler.EXTRA_TITLE, intent.getStringExtra(AlarmScheduler.EXTRA_TITLE))
                    putExtra(AlarmScheduler.EXTRA_BODY, intent.getStringExtra(AlarmScheduler.EXTRA_BODY))
                }
                ContextCompat.startForegroundService(context, svc)
                if (ruleId.isNotEmpty()) AlarmScheduler.scheduleNext(context, ruleId)
            }
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED -> AlarmScheduler.rescheduleAll(context)
        }
    }
}
