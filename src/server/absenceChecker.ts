import { getFirestore } from 'firebase-admin/firestore';
import { sendWhatsAppReminderTemplate } from './remindersCron.js';
import { TeacherProfile } from '../types.js';

export async function checkAbsenceThreshold(
  teacherId: string,
  studentId: string,
  db: FirebaseFirestore.Firestore
) {
  const teacherSnap = await db.collection('teachers').doc(teacherId).get();
  const teacher = teacherSnap.data() as TeacherProfile;
  const policy = teacher?.absencePolicy;

  if (!policy || !policy.absenceThreshold || policy.absenceThreshold <= 0) return;

  const logsSnap = await db
    .collection('teachers')
    .doc(teacherId)
    .collection('students')
    .doc(studentId)
    .collection('lessons')
    .where('attendance', '==', 'absent')
    .get();

  const absenceCount = logsSnap.size;

  if (absenceCount >= policy.absenceThreshold) {
    // 1. Notify Teacher (Log to Firestore for Dashboard)
    await db.collection('teachers').doc(teacherId).collection('notifications').add({
      type: 'absence_alert',
      studentId,
      absenceCount,
      createdAt: new Date().toISOString()
    });

    // 2. Optional: Auto WhatsApp Warning
    if (policy.autoWarningEnabled) {
      const studentSnap = await db.collection('teachers').doc(teacherId).collection('students').doc(studentId).get();
      const student = studentSnap.data();
      
      if (student && student.whatsapp) {
        await sendWhatsAppReminderTemplate({
          to: student.whatsapp,
          studentName: student.name,
          subject: teacher.subject,
          classTime: '---', // Or fetch last class time
        });
      }
    }
  }
}
