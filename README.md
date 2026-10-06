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

## ⚡ البنية المعمارية لنظام التذكيرات فائق القابلية للتوسع (Reminder Queue Architecture - 100k Scale)

تمت إعادة تصميم نظام التذكيرات بالكامل للانتقال من نموذج المسح الدوري المباشر (Full Periodic Scanning) إلى **طابور التذكيرات المادية الموزعة (Event-Driven Materialized Queue + Partitioned Sharding)** لدعم **100 ألف معلم مشترك** وتحمل ذروات تصل إلى **25,000 تذكير في الدقيقة الواحدة** بدون أي تأخير أو استهلاك غير مجدٍ للموارد.

### 🏗️ مكونات البنية:
1. **طابور التذكيرات المادية (`reminderQueue` Collection)**:
   - معرف المستند الحتمي: `{teacherId}_{scheduleId}_{yyyyMMddHHmm}`.
   - يتم احتساب وقت الإطلاق `fireAt` بناءً على موعد الحصة وتوقيت المعلم (IANA Timezone مع مراعاة كاملة للتوقيت الصيفي والشتوي DST).
   - يتضمن لقطة فورية لرموز الأجهزة `tokens` (بحد أقصى 5 أجهزة).
   - حقل `expireAt` مضبوط على `fireAt + 3 days` ليتم حذفه تلقائياً عبر سياسة Firestore TTL Policy بدون أي تكلفة أو عمليات قراءة إضافية.
   - أمان تام: المجموعة محمية في `firestore.rules` ويُمنع وصول العميل إليها نهائياً (`allow read, write: if false;`).

2. **مولد التذكيرات المادية (`materializeReminders`)**:
   - يولّد التذكيرات مسبقاً للـ 48 ساعة القادمة لجميع أنواع الجداول (`weekly`, `daily`, `monthly`, `once`).
   - يعمل بشكل Idempotent ولا يعيد كتابة التذكيرات المرسلة (`sent`) أو قيد المعالجة (`processing`).
   - ينظف التذكيرات المعلقة للجداول المحذوفة أو المعدلة تلقائياً.
   - يتخطى أو يلغي التذكيرات المعلقة إذا تم تعطيل الإشعارات أو انتهى اشتراك المعلم.

3. **المُرسل الموزع المجزأ (Partitioned Sharded Dispatcher)**:
   - يقسم المعلمين إلى $N=16$ تجزئة (Shards) متوازنة حتمياً عبر الدالة `computeShard(teacherId) % 16`.
   - يعمل كل دقيقة بالتوازي عبر جميع التجزئات (16 Shards in parallel).
   - استلام التذكير بحجز ذري عبر Firestore Transaction (`status: 'pending' -> 'processing'` مع مهلة حجز `leaseUntil = now + 60s`).
   - الإرسال عبر FCM Multicast مع ترويسات الاستيقاظ الفوري للأجهزة المحمولة:
     * `webpush.headers.Urgency = 'high'`
     * `webpush.headers.TTL = '600'`
   - تنظيف فوري لرموز الأجهزة غير المسجلة (`messaging/registration-token-not-registered` و `messaging/invalid-registration-token`).
   - استعادة تلقائية للحجوزات المعلقة (`stale leases`) وإعادة المحاولة حتى 3 مرات بتأخير تصاعدي (Exponential Backoff).
   - تسجيل إحصائيات الأداء والمراقبة في `ops/reminderStats/{yyyyMMddHHmm}` وسجلات JSON مهيكلة.

---

### 🧮 الحسبة والقدرة الاستيعابية (25,000 تذكير / دقيقة):
- **حجم الذروة المستهدفة**: 25,000 تذكير متزامن خلال دقيقة واحدة (مثلاً في تمام 17:45 لحصص تبدأ 18:00).
- **التوزيع المتوازي عبر التجزئات**:
  $$\text{Per-shard Load} = \frac{25,000 \text{ reminders}}{16 \text{ shards}} \approx 1,562.5 \text{ reminders / shard}$$
- **دفعات الإرسال (FCM Multicast Batches)**:
  * كل دالة `sendEachForMulticast` ترسل لـ 500 مستلم في استدعاء شبكي واحد يستغرق ~100-200ms.
  * كل تجزئة تحتاج فقط إلى 3 أو 4 استدعاءات متتالية:
    $$\text{Batches per shard} = \lceil \frac{1,562.5}{500} \rceil = 4 \text{ batches}$$
  * إجمالي الوقت المستغرق للمعالجة عبر الـ 16 تجزئة المتوازية:
    $$\text{Total Dispatch Time} = 4 \text{ rounds} \times 200\text{ms} \approx 0.8 - 2.5 \text{ seconds}$$
  * هذا يعني إتمام إرسال الـ 25 ألف تذكير في أقل من **5 ثوانٍ** من أصل الـ 60 ثانية المتاحة في الدقيقة!
- **توفير القراءات في Firestore**:
  * بدلاً من قراءة ملايين المستندات عبر `collectionGroup` وجميع جداول المعلمين في كل دقيقة، يتم فقط قراءة المستندات المستحقة في الدقيقة الحالية عبر الفهرس المركب `(shard, status, fireAt)` بدقة $O(\text{due reminders})$ بدون أي إهدار.

---

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
