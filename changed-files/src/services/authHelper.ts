import { auth } from '../firebase';

/**
 * دالة موحدة لجلب توكن هوية صالح مع منطق إعادة محاولة (retry) 
 * وتأخير زمني (exponential backoff) عند فشل الاتصال.
 */
export async function getValidIdToken(retries = 3, forceRefresh = true): Promise<string | null> {
  if (!auth.currentUser) return null;
  
  for (let i = 0; i < retries; i++) {
    try {
      // forceRefresh = true (الافتراضي) يجلب توكن جديد من الشبكة. عند false يُستخدم التوكن المخزّن
      // (ويقوم Firebase بتجديده تلقائياً قبل انتهاء صلاحيته بخمس دقائق). المحاولات اللاحقة تُجدَّد دائماً.
      return await auth.currentUser.getIdToken(forceRefresh || i > 0);
    } catch (err) {
      console.warn(`محاولة ${i + 1} فشلت في تحديث التوكن، جاري إعادة المحاولة...`);
      
      if (i < retries - 1) {
        // تأخير زمني: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }
  
  console.error('فشلت جميع محاولات تحديث التوكن');
  // إطلاق حدث اختياري لإعادة التوثيق غير المحظور
  window.dispatchEvent(new CustomEvent('auth:token-expired'));
  return null;
}

/**
 * دالة مساعدة لجلب الترويسات المطلوبة للطلب (Headers)
 */
export async function getAuthenticatedHeaders(forceRefresh = true): Promise<HeadersInit | null> {
  const token = await getValidIdToken(3, forceRefresh);
  if (!token) return null;
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
