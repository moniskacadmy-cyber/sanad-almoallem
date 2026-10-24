import { auth } from '../firebase';

/**
 * دالة موحدة لجلب توكن هوية صالح مع منطق إعادة محاولة (retry) 
 * وتأخير زمني (exponential backoff) عند فشل الاتصال، مع حماية ضد انقطاع الإنترنت.
 */
export async function getValidIdToken(retries = 2): Promise<string | null> {
  if (!auth.currentUser) return null;
  
  // فحص حالة الإنترنت أولاً لمنع الطلبات الفاشلة عند الأوفلاين
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      // استخدام التوكن المخزن محلياً أولاً (false) والتحديث التلقائي فقط عند انتهاء صلاحيته
      return await auth.currentUser.getIdToken(false);
    } catch (err: any) {
      const msg = err?.message || '';
      
      // إذا كان الخطأ متعلقاً بانقطاع الشبكة أو DNS، نتوقف فوراً عن إعادة المحاولة لمنع اللوب اللانهائي
      if (
        msg.includes('ERR_NAME_NOT_RESOLVED') ||
        msg.includes('Failed to fetch') ||
        msg.includes('network') ||
        msg.includes('offline') ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) {
        break;
      }

      if (i < retries - 1) {
        // تأخير زمني قصير قبل المحاولة التالية
        await new Promise(r => setTimeout(r, 600 * Math.pow(2, i)));
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
