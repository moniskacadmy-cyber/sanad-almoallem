package com.sanad.almoallem

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { notifyPage() }

    /** Exposed to the website as window.SanadAndroid */
    inner class Bridge {
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun getFcmToken(): String = TokenStore.get(this@MainActivity)

        @JavascriptInterface
        fun hasNotificationPermission(): Boolean = NotificationHelper.hasPermission(this@MainActivity)

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
                    !NotificationHelper.hasPermission(this@MainActivity)
                ) {
                    permissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationHelper.createChannel(this)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
        }
        webView.addJavascriptInterface(Bridge(), "SanadAndroid")
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                // Keep the app's own pages and Firebase auth inside; open everything else (WhatsApp, tel:, ...) outside.
                val internal = host == APP_HOST || host.endsWith("firebaseapp.com") || host.endsWith("googleapis.com")
                if (internal) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    true
                } catch (e: Exception) {
                    false
                }
            }
            override fun onPageFinished(view: WebView, url: String) = notifyPage()
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
            !NotificationHelper.hasPermission(this)
        ) {
            permissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            TokenStore.save(this, token)
            notifyPage()
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState) else webView.loadUrl(APP_URL)
    }

    /** Tells the website that the token / permission changed so it can (re)register the device. */
    private fun notifyPage() {
        if (::webView.isInitialized) {
            webView.post { webView.evaluateJavascript("window.dispatchEvent(new Event('sanad-native-ready'))", null) }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    companion object {
        const val APP_HOST = "sanad-almoallem-three.vercel.app"
        const val APP_URL = "https://$APP_HOST/"
    }
}
