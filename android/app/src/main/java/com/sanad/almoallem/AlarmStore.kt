package com.sanad.almoallem

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** A weekly class alarm rule sent by the website. day: 0 = Sunday ... 6 = Saturday. */
data class AlarmRule(
    val id: String,
    val day: Int,
    val hour: Int,
    val minute: Int,
    val minutesBefore: Int,
    val title: String,
    val body: String,
)

object AlarmStore {
    private const val PREFS = "sanad_alarms"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_RULES = "rules"
    private const val KEY_SCHEDULED = "scheduled_codes"

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnabled(c: Context) = prefs(c).getBoolean(KEY_ENABLED, false)
    fun setEnabled(c: Context, v: Boolean) = prefs(c).edit().putBoolean(KEY_ENABLED, v).apply()

    fun saveRules(c: Context, json: String) = prefs(c).edit().putString(KEY_RULES, json).apply()

    fun rules(c: Context): List<AlarmRule> {
        val raw = prefs(c).getString(KEY_RULES, "[]") ?: "[]"
        val out = ArrayList<AlarmRule>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o: JSONObject = arr.getJSONObject(i)
                val time = o.optString("time", "")
                val parts = time.split(":")
                if (parts.size < 2) continue
                val h = parts[0].toIntOrNull() ?: continue
                val m = parts[1].take(2).toIntOrNull() ?: continue
                val day = o.optInt("day", -1)
                if (day !in 0..6 || h !in 0..23 || m !in 0..59) continue
                out.add(
                    AlarmRule(
                        id = o.optString("id", "r$i"),
                        day = day,
                        hour = h,
                        minute = m,
                        minutesBefore = o.optInt("minutesBefore", 15).coerceIn(0, 180),
                        title = o.optString("title", "حصة"),
                        body = o.optString("body", ""),
                    )
                )
            }
        } catch (_: Exception) {
        }
        return out
    }

    /** Request codes of the alarms we scheduled, so they can all be cancelled before rescheduling. */
    fun scheduledCodes(c: Context): Set<String> = prefs(c).getStringSet(KEY_SCHEDULED, emptySet()) ?: emptySet()
    fun saveScheduledCodes(c: Context, codes: Set<String>) = prefs(c).edit().putStringSet(KEY_SCHEDULED, codes).apply()
}
