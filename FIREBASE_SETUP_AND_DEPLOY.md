# دليل إعداد ونشر منصة "سند المعلم" على Vercel مع Firebase

تم إعداد المشروع ليعمل بأعلى كفاءة وأمان على منصة **Vercel** للاستضافة ودوال الـ Serverless، مع الاعتماد على **Firebase** لقواعد البيانات والمصادقة.

---

## 1. إعداد خدمات Firebase (Backend)

### أ. تفعيل المصادقة (Authentication)
1. ادخل إلى [Firebase Console](https://console.firebase.google.com).
2. افتح مشروعك ومن القائمة الجانبية اختر **Build** > **Authentication**.
3. في تبويب **Sign-in method**:
   - فعّل خيار **Email/Password**.
   - فعّل خيار **Google** مع بريد الدعم.

### ب. إعداد قواعد الأمان في Cloud Firestore
1. افتح **Firestore Database** في Firebase Console.
2. انشر ملف `firestore.rules` المرفق مع المشروع لحماية بيانات المعلمين:
   ```bash
   firebase deploy --only firestore:rules
   ```
   **قواعد الأمان المطبقة:**
   - عزل كامل لبيانات كل معلم على حدة.
   - التحقق من صلاحية المشرف بالاعتماد الحصري على مجموعة `admins`.
   - فحص سريان اشتراك المعلم (`subscriptionExpiresAt > request.time`) لعمليات الإنشاء والتعديل والحذف لكافة المجموعات (الطلاب، الحصص، الجداول، المكتبة، التذكيرات، المهام).
   - السماح بالقراءة وتصدير البيانات دائماً للمعلم حتى بعد انتهاء الاشتراك.

### ج. استخراج مفتاح خدمة Firebase Admin (Service Account)
1. في Firebase Console، اذهب إلى **Project Settings** (أيقونة الترس) > **Service Accounts**.
2. اضغط على **Generate new private key** وحمّل ملف الـ JSON.
3. انسخ محتوى الملف لاستخدامه في المتغير `FIREBASE_SERVICE_ACCOUNT` على Vercel.

---

## 2. كيفية تعيين حساب مشرف (Admin) 👑

للوصول إلى لوحة الإدارة (`/admin`):
1. افتح **Firestore Database** في Firebase Console.
2. أنشئ مجموعة جديدة باسم: `admins`.
3. في خانة **Document ID** اكتب الـ `UID` الخاص بحسابك من صفحة Authentication.
4. أضف الحقول:
   - `role`: string قيمته `admin`
   - `email`: string قيمته بريدك الإلكتروني
   - `createdAt`: serverTimestamp
5. بعد الحفظ، سجّل الدخول بحسابك في التطبيق وستفتح لك بوابة المشرف تلقائياً دون الحاجة لأي رمز PIN.

---

## 3. خطوات النشر على منصة Vercel (Production Deployment)

### الخطوة 1: رفع المشروع على GitHub / GitLab
ارفع الكود المحدث إلى مستودعك الخاص.

### الخطوة 2: استيراد المشروع في Vercel
1. ادخل إلى حسابك في [Vercel](https://vercel.com).
2. اضغط **Add New** > **Project** واختر المستودع.
3. سيتعرف Vercel تلقائياً على إعدادات `Vite`.

### الخطوة 3: إضافة المتغيرات البيئية (Environment Variables)
في إعدادات المشروع على Vercel، أضف المتغيرات التالية:
- `GEMINI_API_KEY`: مفتاح Google Gemini API.
- `FIREBASE_SERVICE_ACCOUNT`: محتوى ملف JSON لمفتاح الخدمة.
- `VITE_FIREBASE_API_KEY`: مفتاح Firebase للعميل.
- `VITE_FIREBASE_AUTH_DOMAIN`: نطاق المصادقة.
- `VITE_FIREBASE_PROJECT_ID`: معرف المشروع.
- `VITE_FIREBASE_STORAGE_BUCKET`: نطاق التخزين.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: معرف الإرسال.
- `VITE_FIREBASE_APP_ID`: معرف التطبيق.

### الخطوة 4: النشر
اضغط **Deploy**. سيقوم Vercel ببناء التطبيق ونشر:
- واجهة الويب التفاعلية (SPA) مع دعم PWA.
- دوال الـ Serverless داخل مجلد `/api` للذكاء الاصطناعي والتذكيرات.
- مجدول Vercel Cron التلقائي كل 15 دقيقة الموضح في `vercel.json`.

---

## 4. التشغيل المحلي (Local Running)
- `npm run dev`: لتشغيل التطبيق محلياً عبر خادم Express وVite على المنفذ 3000.
- أو `vercel dev`: لتشغيل دوال Serverless محلياً عبر محاكي Vercel.
