package com.sanad.almoallem

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Schedules REAL alarms with AlarmManager.setAlarmClock(): shows the alarm icon, wakes the phone from Doze and
 * needs no special permission. Every rule fires weekly; after it fires the next week is scheduled again.
 */
object AlarmScheduler {
    const val ACTION_FIRE = "com.sanad.almoallem.ALARM_FIRE"
    const val EXTRA_RULE_ID = "rule_id"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    private fun codeFor(id: String) = id.hashCode() and 0x7fffffff

    private fun pendingFor(c: Context, code: Int, rule: AlarmRule?, title: String? = null, body: String? = null): PendingIntent {
        val i = Intent(c, AlarmReceiver::class.java).apply {
            action = ACTION_FIRE
            putExtra(EXTRA_RULE_ID, rule?.id ?: "")
            putExtra(EXTRA_TITLE, title ?: rule?.title ?: "حصة")
            putExtra(EXTRA_BODY, body ?: rule?.body ?: "")
        }
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** Next time (ms) strictly after [afterMs] when the rule's alarm should ring (class time - minutesBefore). */
    fun nextTrigger(rule: AlarmRule, afterMs: Long): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = afterMs
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.set(Calendar.HOUR_OF_DAY, rule.hour)
        cal.set(Calendar.MINUTE, rule.minute)
        cal.add(Calendar.MINUTE, -rule.minutesBefore)
        // Move to the rule's weekday (Calendar: SUNDAY = 1).
        val target = rule.day + 1
        while (cal.get(Calendar.DAY_OF_WEEK) != target || cal.timeInMillis <= afterMs) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun setClock(c: Context, atMs: Long, pi: PendingIntent) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val show = PendingIntent.getActivity(
            c, 0, Intent(c, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, show), pi)
    }

    fun cancelAll(c: Context) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (code in AlarmStore.scheduledCodes(c)) {
            val n = code.toIntOrNull() ?: continue
            am.cancel(pendingFor(c, n, null))
        }
        AlarmStore.saveScheduledCodes(c, emptySet())
    }

    /** Cancels everything we scheduled and schedules the next occurrence of every rule (if alarms are enabled). */
    fun rescheduleAll(c: Context) {
        cancelAll(c)
        if (!AlarmStore.isEnabled(c)) return
        val codes = HashSet<String>()
        val now = System.currentTimeMillis()
        for (rule in AlarmStore.rules(c)) {
            val code = codeFor(rule.id)
            setClock(c, nextTrigger(rule, now), pendingFor(c, code, rule))
            codes.add(code.toString())
        }
        AlarmStore.saveScheduledCodes(c, codes)
    }

    /** After a rule fired: schedule the same rule for next week. */
    fun scheduleNext(c: Context, ruleId: String) {
        if (!AlarmStore.isEnabled(c)) return
        val rule = AlarmStore.rules(c).firstOrNull { it.id == ruleId } ?: return
        // +2 minutes so the alarm that just fired is never picked again.
        setClock(c, nextTrigger(rule, System.currentTimeMillis() + 2 * 60_000L), pendingFor(c, codeFor(rule.id), rule))
    }

    /** One-off alarm (snooze / "test alarm"). */
    fun scheduleOnce(c: Context, inMs: Long, title: String, body: String) {
        val code = ("once" + (System.currentTimeMillis() % 100000)).hashCode() and 0x7fffffff
        setClock(c, System.currentTimeMillis() + inMs, pendingFor(c, code, null, title, body))
    }
}
