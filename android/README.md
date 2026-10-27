# تطبيق أندرويد — سند المعلم

غلاف (WebView) بيفتح https://sanad-almoallem-three.vercel.app ويستقبل الإشعارات بقناة `IMPORTANCE_HIGH`
علشان تظهر كبانر فوق أي تطبيق شغال. مجاني بالكامل (البناء على GitHub Actions).

## الخطوات (مرة واحدة)
1. Firebase Console ← مشروع `sanadak-3cc89` ← ⚙️ Project settings ← Add app ← Android.
2. Package name: `com.sanad.almoallem` ← Register app ← حمّلي `google-services.json`.
3. ارفعيه في GitHub على المسار `android/app/google-services.json` (Add file ← Upload files).
4. GitHub ← Actions ← "Build Android APK" ← Run workflow (أو بيشتغل تلقائي بعد الرفع).
5. بعد ما ينجح، افتحي الـ run ← Artifacts ← `sanad-almoallem-apk` ← نزّليه وفكّي الضغط ← ثبّتي `app-debug.apk`.
6. افتحي التطبيق، سجلي دخول بالإيميل وكلمة السر، واسمحي بالإشعارات.

## ملاحظات
- تسجيل الدخول بجوجل بيتم رفضه داخل WebView (سياسة جوجل)، استخدمي الإيميل وكلمة السر.
- لو التطبيق مثبّت، السيرفر بيوقف إشعارات متصفح/PWA الأندرويد تلقائيًا علشان ما يوصلش إشعاران.
- سامسونج: إعدادات ← التطبيقات ← سند المعلم ← البطارية ← "غير مقيّد".
