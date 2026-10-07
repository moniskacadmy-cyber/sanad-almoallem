# دليل النسخ الاحتياطي واسترجاع البيانات (Firestore PITR & Scheduled Backups)

يقدم هذا المستند الدليل التشغيلي الكامل لتفعيل الحماية المستمرة للبيانات بنظام **Point-in-Time Recovery (PITR)** وجدولة النسخ الاحتياطي اليومي الآلي لقاعدة بيانات **سند المعلم**، مع توثيق خطوات الاسترجاع الدقيقة في حالات الطوارئ.

---

## 1. ما هو Firestore PITR؟
* **Point-in-Time Recovery (PITR)** يمنح المنصة القدرة على استرجاع قاعدة البيانات بدقة الدقيقة والثانية إلى أي نقطة زمنية خلال **آخر 7 أيام**.
* يحمي النظام ضد:
  - أخطاء الحذف العرضي أو الكتابة غير المقصودة على بيانات الطلاب والحصص.
  - تعطل العمليات أو هجمات الاختراق.
* لا يؤثر تفعيل PITR إطلاقاً على أداء القراءة والكتابة النشطة لقاعدة البيانات.

---

## 2. تفعيل PITR عبر Google Cloud CLI (gcloud)

### الخطوة 1: تفعيل PITR لقاعدة البيانات الافتراضية
```bash
# تفعيل PITR على قاعدة البيانات الافتراضية
gcloud firestore databases update \
  --database='(default)' \
  --point-in-time-recovery-enable
```

*(إذا كنت تستخدم databaseId مخصص، استبدل `(default)` باسم الـ Database المعرف في المتغيرات).*

### الخطوة 2: التحقق من تفعيل PITR
```bash
gcloud firestore databases describe \
  --database='(default)' \
  --format="value(pointInTimeRecoveryEnablement)"
```
**النتيجة المتوقعة:** `POINT_IN_TIME_RECOVERY_ENABLED`

---

## 3. جدولة النسخ الاحتياطي اليومي (Daily Backup Schedule)

يوفر جدول النسخ الاحتياطي اليومي طبقة أمان إضافية لحفظ نسخ مجمعة طويلة الأمد (حتى 14 أسبوعاً أو شهراً):

### الخطوة 1: إنشاء جدول النسخ اليومي
```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=14d
```

### الخطوة 2: استعراض الجداول المجدولة النشطة
```bash
gcloud firestore backups schedules list \
  --database='(default)'
```

---

## 4. خطوات استرجاع البيانات (Disaster Recovery & Restore Procedures)

### أسلوب 1: الاسترجاع اللحظي عبر PITR (إلى دقيقة محددة)
في حال حدوث خطأ أو حذف في توقيت معين (مثلاً: `2026-10-07T05:30:00Z`):
```bash
# يتم الاسترجاع إلى قاعدة بيانات جديدة لحماية البيانات الحالية ومنع تضارب الكتابة
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='sanad-restored-20261007' \
  --recovery-time='2026-10-07T05:30:00Z'
```

### أسلوب 2: الاسترجاع من النسخ الاحتياطية المجدولة
1. استعراض النسخ المتوفرة:
```bash
gcloud firestore backups list \
  --database='(default)' \
  --format="table(name, createTime, database)"
```

2. استرجاع نسخة محددة:
```bash
gcloud firestore databases restore \
  --source-backup='projects/PROJECT_ID/locations/LOCATION/backups/BACKUP_ID' \
  --destination-database='sanad-restored-from-backup'
```

---

## 5. تبديل التطبيق للعمل مع قاعدة البيانات المسترجعة

1. **التحقق من سلامة البيانات في القاعدة المسترجعة**:
   - الدخول إلى Firebase Console واختيار الـ Database الجديدة `sanad-restored-20261007`.
   - فحص سجلات `teachers`, `students`, `schedules`, `reminderQueue`.

2. **توجيه السيرفر للقاعدة المسترجعة**:
   - في إعدادات البيئة السحابية (Vercel / Cloud Run / .env):
   ```env
   FIREBASE_DATABASE_ID=sanad-restored-20261007
   VITE_FIREBASE_DATABASE_ID=sanad-restored-20261007
   ```
   - إعادة تشغيل السيرفر أو النشر؛ سيقوم `resolveDatabaseId()` في `server.ts` بالاتصال مباشرة بالقاعدة المسترجعة.
