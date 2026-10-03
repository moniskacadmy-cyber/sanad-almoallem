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
   - `FIREBASE_SERVICE_ACCOUNT` (أو `FIREBASE_PROJECT_ID` و `FIREBASE_CLIENT_EMAIL` و `FIREBASE_PRIVATE_KEY`)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
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
