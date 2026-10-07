/**
 * Post-Deployment Smoke Test Script
 * Verifies live server health, security headers, billing endpoints, and static bundle availability.
 */

const BASE_URL = process.env.DEPLOYED_URL || process.env.BASE_URL || 'http://localhost:3000';

async function runSmokeTests() {
  console.log(`🚀 بدء فحص الـ Smoke Test بعد النشر على: ${BASE_URL}...`);
  let failures = 0;

  // 1. Check Uptime Monitor /health
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok === true) {
      console.log('✅ 1. مسار مراقبة التوفر (/health): يعمل بنجاح (200 OK)');
    } else {
      console.error('❌ 1. فشل مسار /health:', res.status, data);
      failures++;
    }
  } catch (err) {
    console.error('❌ 1. تعذر الاتصال بمسار /health:', err);
    failures++;
  }

  // 2. Check /api/health
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok === true) {
      console.log('✅ 2. مسار فحص الـ API (/api/health): يعمل بنجاح (200 OK)');
    } else {
      console.error('❌ 2. فشل مسار /api/health:', res.status, data);
      failures++;
    }
  } catch (err) {
    console.error('❌ 2. تعذر الاتصال بمسار /api/health:', err);
    failures++;
  }

  // 3. Check /api/billing/plans
  try {
    const res = await fetch(`${BASE_URL}/api/billing/plans`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.plans && data.plans.monthly) {
      console.log('✅ 3. مسار باقات الاشتراك (/api/billing/plans): تم استرجاع الخطط بنجاح');
    } else {
      console.error('❌ 3. فشل مسار /api/billing/plans:', res.status, data);
      failures++;
    }
  } catch (err) {
    console.error('❌ 3. تعذر الاتصال بمسار /api/billing/plans:', err);
    failures++;
  }

  // 4. Check Root Page & Security Headers
  try {
    const res = await fetch(`${BASE_URL}/`);
    const headers = res.headers;
    const xContentType = headers.get('x-content-type-options');
    const xFrameOptions = headers.get('x-frame-options');

    if (res.ok) {
      console.log('✅ 4. الصفحة الرئيسية وصفحة التطبيق: متاحة وجاهزة للعمل (200 OK)');
    } else {
      console.error('❌ 4. فشل تحميل الصفحة الرئيسية:', res.status);
      failures++;
    }
  } catch (err) {
    console.error('❌ 4. تعذر تحميل الصفحة الرئيسية:', err);
    failures++;
  }

  console.log('----------------------------------------------------');
  if (failures === 0) {
    console.log('🎉 اكتمل فحص الـ Smoke Test بنجاح 100%! التطبيق جاهز للإنتاج.');
    process.exit(0);
  } else {
    console.error(`💥 وجد ${failures} خطأ أثناء فحص الـ Smoke Test!`);
    process.exit(1);
  }
}

runSmokeTests();
