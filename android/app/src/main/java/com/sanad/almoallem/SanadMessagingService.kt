package com.sanad.almoallem

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SanadMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        TokenStore.save(this, token)
    }

    // The server sends DATA-ONLY messages, so this runs even when the app is closed.
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: getString(R.string.app_name)
        val body = data["body"] ?: message.notification?.body ?: return
        val tag = data["tag"] ?: System.currentTimeMillis().toString()
        NotificationHelper.show(this, tag, title, body)
    }
}
