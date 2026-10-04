# سند المعلم (Sanad Al-Moallem) 📚✨

منصة متكاملة ومتقدمة لإدارة شؤون المعلمين والدروس والطلاب والتقارير المالية والتربوية، مصممة بأعلى معايير الأمان وتجربة مستخدم PWA عربية سلسة.

---

## 🚀 التشغيل المحلي (Local Development)

### 1. تثبيت الحزم (Dependencies):
```bash
npm install
```

### 2. ضبط المتغيرات البيئية:
انسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```
وقم بتعبئة المتغيرات المطلوبة:
- `GEMINI_API_KEY`: مفتاح Gemini AI.
- `FIREBASE_SERVICE_ACCOUNT`: مفتاح حساب الخدمة (Service Account) للـ Backend.
- إعدادات Firebase للعميل (`VITE_FIREBASE_*`).

### 3. بدء التشغيل المحلي:
يمكنك الاختيار بين طريقتين:

#### الطريقة أ: باستخدام Express المحلي (الافتراضية المدمجة)
```bash
npm run dev
```
سيفتح التطبيق على الرابط: `http://localhost:3000`

#### الطريقة ب: باستخدام محاكي Vercel المحلي (Serverless Emulation)
```bash
# تثبيت Vercel CLI إن لم يكن مثبتاً
npm i -g vercel

# تشغيل بيئة Vercel المحلية
vercel dev
```

---

## 📦 النشر على Vercel (Production Deployment)

التطبيق مهيأ بالكامل للنشر السلس على منصة Vercel عبر خوادم دوال Serverless:

1. اربط مستودع المشروع بحسابك على [Vercel](https://vercel.com).
2. في لوحة تحكم Vercel (Project Settings > Environment Variables)، أضف المتغيرات الموجودة في `.env.example`:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (اختياري: الافتراضي `gemini-3.8-flash`)
   - `CRON_SECRET` (رمز سري لتأمين مسار التذكيرات التلقائية `/api/reminders/cron`)
   - `FIREBASE_SERVICE_ACCOUNT` (أو `FIREBASE_PROJECT_ID` و `FIREBASE_CLIENT_EMAIL` و `FIREBASE_PRIVATE_KEY`)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY` (مفتاح VAPID المولد من Firebase Console -> Project settings -> Cloud Messaging)
   - `VITE_FIREBASE_DATABASE_ID` (اتركه فارغاً لإعدادات AI Studio، أو ضع `(default)` إذا كنت تستخدم قاعدة بيانات Firestore الافتراضية)

---

## 🔔 إعداد تذكيرات الحصص المباشرة أثناء إغلاق التطبيق (Web Push & Cron Job):

### 1. توليد مفتاح VAPID من Firebase Console:
1. افتح [Firebase Console](https://console.firebase.google.com).
2. اختر مشروعك ثم اذهب إلى **Project settings ⚙️** -> **Cloud Messaging**.
3. انزل إلى قسم **Web configuration** -> **Web Push certificates**.
4. اضغط على **Generate key pair**.
5. انسخ المفتاح الناتج وضعه في المتغير البيئي `VITE_FIREBASE_VAPID_KEY` في Vercel ومحلياً.

### 2. ضبط خدمة Cron المجانية (cron-job.org):
1. أنشئ حساباً مجانياً على موقع [cron-job.org](https://cron-job.org).
2. أنشئ Cron Job جديد بالبيانات التالية:
   - **URL**: `https://your-app.vercel.app/api/reminders/cron` (استبدل باسم رابط تطبيقك على Vercel).
   - **Schedule**: كل دقيقة (`Every minute`).
   - **Request Headers**: أضف ترويسة جديدة:
     - **Header**: `Authorization`
     - **Value**: `Bearer YOUR_CRON_SECRET` (ضع نفس القيمة التي حددتها في `CRON_SECRET`).
3. احفظ الـ Job وسيقوم الخادم بفحص الحصص القادمة تلقائياً وإرسال إشعارات Web Push للهواتف والأجهزة حتى عند إغلاق التطبيق!

3. في Firebase Console > Authentication > Settings > Authorized domains، أضف نطاق Vercel الخاص بمشروعك (مثل `your-app.vercel.app`).
4. سيتولى Vercel بناء الموقع تلقائياً وتشغيل مسارات الـ API كـ Serverless Functions عبر `api/index.ts`.

---

## 🛠️ أوامر الصيانة والفحص:
```bash
# التحقق من خلو الكود من أي أخطاء برمجية
npm run lint

# بناء ملفات الإنتاج المجمعة
npm run build
```
