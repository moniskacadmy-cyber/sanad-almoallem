import React, { useState } from 'react';
import { ScheduleSlot, Student, Group } from '../types';
import { bulkShiftSchedules } from '../firebase';
import { shiftTime } from '../services/timeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  schedules: ScheduleSlot[];
  students: Student[];
  groups: Group[];
}

export const TimeShiftModal: React.FC<Props> = ({ isOpen, onClose, teacherId, schedules, students, groups }) => {
  const [direction, setDirection] = useState<1 | -1>(1);
  const [scope, setScope] = useState<'all' | 'day' | 'student' | 'group'>('all');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    let filteredSchedules = schedules;
    if (scope === 'day') filteredSchedules = schedules.filter(s => s.dayOfWeek === selectedDay);
    if (scope === 'student') filteredSchedules = schedules.filter(s => s.studentId === selectedStudentId);
    if (scope === 'group') {
        // Group logic needs to be handled carefully based on how groups are stored in ScheduleSlot
        // Assuming we have a way to match group schedules
        filteredSchedules = schedules.filter(s => (s as any).groupId === selectedGroupId);
    }

    const shifts = filteredSchedules.map(slot => ({
      slotId: slot.id,
      newTime: shiftTime(slot.time, direction)
    }));
    
    await bulkShiftSchedules(teacherId, shifts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold mb-4">تعديل التوقيت الجماعي</h2>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold mb-1">نوع التعديل</label>
                <div className="flex gap-2">
                    <button onClick={() => setDirection(1)} className={`flex-1 p-2 rounded-lg ${direction === 1 ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>تقديم (+1 ساعة)</button>
                    <button onClick={() => setDirection(-1)} className={`flex-1 p-2 rounded-lg ${direction === -1 ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>تأخير (-1 ساعة)</button>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold mb-1">نطاق التعديل</label>
                <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="w-full p-2 rounded-lg bg-slate-200 dark:bg-slate-800">
                    <option value="all">جميع المواعيد</option>
                    <option value="day">يوم معين</option>
                    <option value="student">طالب معين</option>
                    <option value="group">مجموعة معينة</option>
                </select>
                
                {scope === 'day' && (
                    <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="w-full p-2 mt-2 rounded-lg bg-slate-200 dark:bg-slate-800">
                        {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                )}
                
                {scope === 'student' && (
                    <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full p-2 mt-2 rounded-lg bg-slate-200 dark:bg-slate-800">
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}
            </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 p-2 rounded-xl bg-slate-200 dark:bg-slate-700">إلغاء</button>
          <button onClick={handleConfirm} className="flex-1 p-2 rounded-xl bg-purple-600 text-white font-bold">تأكيد التعديل</button>
        </div>
      </div>
    </div>
  );
};
