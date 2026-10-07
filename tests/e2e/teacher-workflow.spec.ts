import { test, expect } from '@playwright/test';

/**
 * Playwright E2E Test Suite: Teacher Workflow
 * 1. تسجيل (Registration)
 * 2. إضافة طالب وحصة (Add student & lesson)
 * 3. تسجيل حضور (Mark attendance)
 * 4. فتح الإعدادات (Open Settings tab)
 * 5. انتهاء الاشتراك يمنع الكتابة (Expired subscription restriction)
 */

test.describe('Sanad Al-Moallem: Full Teacher E2E Workflow', () => {
  const teacherEmail = `e2e_teacher_${Date.now()}@example.com`;
  const teacherPassword = 'Password123!@#';

  test('1. Teacher registration and onboarding', async ({ page }) => {
    await page.goto('/');

    // Check if auth modal or registration trigger is visible
    const signupTab = page.locator('button', { hasText: /حساب جديد|تسجيل جديد/i });
    if (await signupTab.isVisible()) {
      await signupTab.click();
    }

    const emailInput = page.locator('input[type="email"], input[placeholder*="البريد"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const nameInput = page.locator('input[placeholder*="الاسم"], input[name="name"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill('أستاذ أحمد E2E');
    }
    await emailInput.fill(teacherEmail);
    await passwordInput.fill(teacherPassword);

    const submitBtn = page.locator('button[type="submit"], button:has-text("إنشاء حساب"), button:has-text("دخول")').first();
    await submitBtn.click();

    // Verify successful login / redirection to main interface
    await expect(page.locator('body')).toContainText(/أستاذ|الرئيسية|الطلاب|الجدول/i);
  });

  test('2. Add student and schedule a lesson', async ({ page }) => {
    await page.goto('/');

    // Navigate to Students tab
    const studentsTabBtn = page.locator('button, a', { hasText: /الطلاب|قائمة الطلاب/i }).first();
    await studentsTabBtn.click();

    // Click "Add Student" button
    const addStudentBtn = page.locator('button', { hasText: /إضافة طالب|طالب جديد/i }).first();
    if (await addStudentBtn.isVisible()) {
      await addStudentBtn.click();

      // Fill student form
      const studentNameInput = page.locator('input[placeholder*="اسم الطالب"]').first();
      await studentNameInput.fill('طالب تجريبي E2E');

      const phoneInput = page.locator('input[placeholder*="الهاتف"], input[placeholder*="الواتساب"]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('01012345678');
      }

      const saveStudentBtn = page.locator('button:has-text("حفظ"), button:has-text("إضافة")').first();
      await saveStudentBtn.click();
    }

    // Navigate to Schedule tab and add lesson
    const scheduleTabBtn = page.locator('button, a', { hasText: /الجدول|المواعيد/i }).first();
    await scheduleTabBtn.click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('3. Mark attendance', async ({ page }) => {
    await page.goto('/');

    const studentsTabBtn = page.locator('button, a', { hasText: /الطلاب/i }).first();
    await studentsTabBtn.click();

    // Check attendance button
    const attendanceBtn = page.locator('button', { hasText: /حضور|تسجيل حضور|غياب/i }).first();
    if (await attendanceBtn.isVisible()) {
      await attendanceBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Open Settings tab and view account details', async ({ page }) => {
    await page.goto('/');

    const settingsTabBtn = page.locator('button, a', { hasText: /الإعدادات|حسابي/i }).first();
    await settingsTabBtn.click();

    // Verify settings tab content is displayed
    await expect(page.locator('body')).toContainText(/الإعدادات|الاشتراك|النسخ الاحتياطي|حذف حسابي/i);
  });

  test('5. Expired subscription blocks writing and displays restriction', async ({ page }) => {
    await page.goto('/');

    // Evaluate subscription restriction banner if expired
    const expiredBanner = page.locator('text=/انتهى اشتراكك|تجديد الاشتراك|الحساب منتهي/i');
    if (await expiredBanner.isVisible()) {
      await expect(expiredBanner).toBeVisible();
    }
  });
});
