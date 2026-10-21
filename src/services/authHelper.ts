import { auth } from '../firebase';

/**
 * دالة موحدة لجلب توكن هوية صالح مع منطق إعادة محاولة (retry) 
 * وتأخير زمني (exponential backoff) عند فشل الاتصال، مع حماية ضد انقطاع الإنترنت.
 */
export async function getValidIdToken(retries = 3): Promise<string | null> {
  if (!auth.currentUser) return null;
  
  // فحص حالة الإنترنت أولاً لمنع الطلبات الفاشلة
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      // جلب توكن جديد بقوة (forceRefresh = true)
      return await auth.currentUser.getIdToken(true);
    } catch (err: any) {
      const msg = err?.message || '';
      
      // إذا كان الخطأ متعلقاً بانقطاع الشبكة أو DNS، نتوقف فورا عن إعادة المحاولة لمنع اللوب اللانهائي
      if (
        msg.includes('ERR_NAME_NOT_RESOLVED') ||
        msg.includes('Failed to fetch') ||
        msg.includes('network') ||
        msg.includes('offline')
      ) {
        break;
      }

      console.warn(`محاولة ${i + 1} فشلت في تحديث التوكن، جاري إعادة المحاولة...`);
      
      if (i < retries - 1) {
        // تأخير زمني: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }
  
  return null;
}

/**
 * دالة مساعدة لجلب الترويسات المطلوبة للطلب (Headers)
 */
export async function getAuthenticatedHeaders(): Promise<HeadersInit> {
  const token = await getValidIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}
