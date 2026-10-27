package com.sanad.almoallem

import android.content.Context

object TokenStore {
    private const val PREFS = "sanad_prefs"
    private const val KEY = "fcm_token"

    fun save(context: Context, token: String) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, token).apply()

    fun get(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "") ?: ""
}
