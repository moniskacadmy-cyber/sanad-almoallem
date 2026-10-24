import React, { useState, useEffect } from 'react';
import { Target, X, Check } from 'lucide-react';
import { Student, ScheduleSlot } from '../types';

interface NewWeeklySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  existingSchedules: ScheduleSlot[];
  onSave: (session: Omit<ScheduleSlot, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export const NewWeeklySessionModal: React.FC<NewWeeklySessionModalProps> = ({ 
  isOpen, onClose, students, existingSchedules, onSave 
}) => {
  const [studentId, setStudentId] = useState('');
  const [sessionType, setSessionType] = useState<'online' | 'center' | 'home' | 'private'>('private');
  const [dayOfWeek, setDayOfWeek] = useState(0); // 0: Sunday
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState(60);
  const [locationOrLink, setLocationOrLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateConflict = () => {
    const startMins = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMins = startMins + duration;

    const hasConflict = existingSchedules.some(s => {
      if (s.dayOfWeek !== dayOfWeek) return false;
      const sStartMins = parseInt(s.time.split(':')[0]) * 60 + parseInt(s.time.split(':')[1]);
      const sEndMins = sStartMins + s.duration;
      return (startMins < sEndMins && endMins > sStartMins);
    });

    setConflict(hasConflict ? 'هناك تعارض في المواعيد مع حصة أخرى في نفس اليوم!' : null);
  };

  useEffect(() => {
    validateConflict();
  }, [dayOfWeek, startTime, duration]);

  const handleSave = async () => {
    if (!studentId || conflict) return;
    setIsSaving(true);
    try {
      const student = students.find(s => s.id === studentId);
      await onSave({
        teacherId: student?.teacherId || '',
        studentId,
        studentName: student?.name || 'Unknown',
        dayOfWeek,
        time: startTime,
        duration,
        classType: sessionType as any,
        recurrence: 'weekly',
        locationOrLink
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#26163d] text-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-purple-800/40">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-purple-900/60 pb-4">
          <div>
            <h2 className="text-xl font-bold">حجز حصة أسبوعية جديدة</h2>
            <p className="text-xs text-purple-300 mt-1">تحديد وقت ومدة الحصة ونوع الحصة مع فحص فوري لتعارض المواعيد</p>
          </div>
          <button onClick={onClose} className="text-purple-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Conflict Alert */}
        {conflict && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs rounded-xl">
            {conflict}
          </div>
        )}

        {/* Student Selection */}
        <div className="mb-4">
          <label className="block text-sm mb-1 text-purple-200">الطالب *</label>
          <select 
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full bg-[#180b29] border border-purple-900 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">اختر طالباً...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.subject})</option>
            ))}
          </select>
        </div>

        {/* Session Type Options */}
        <div className="mb-4">
          <label className="block text-sm mb-2 text-purple-200">نوع الحصة</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'online', label: 'أونلاين', desc: 'عبر الإنترنت / Meet...' },
              { id: 'private', label: 'درس خاص', desc: 'فردي 1-1' },
              { id: 'center', label: 'سنتر', desc: 'قاعة السنتر' },
              { id: 'home', label: 'حضوري', desc: 'زيارة منزلية' },
            ].map(type => (
              <div 
                key={type.id}
                onClick={() => setSessionType(type.id as any)}
                className={`p-3 rounded-xl border cursor-pointer transition ${sessionType === type.id ? 'border-purple-400 bg-purple-950/50' : 'border-purple-900/60 bg-[#180b29]'}`}
              >
                <span className="font-semibold block text-sm">{type.label}</span>
                <span className="text-xs text-purple-400">{type.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Duration Options */}
        <div className="mb-6">
          <label className="block text-sm mb-2 text-purple-200">مدة الحصة: {duration} دقيقة</label>
          <div className="flex flex-wrap gap-2">
            {[30, 45, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDuration(mins)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${duration === mins ? 'bg-purple-600 border-purple-400 text-white' : 'bg-[#180b29] border-purple-900 text-purple-300'}`}
              >
                {mins} دقيقة
              </button>
            ))}
          </div>
        </div>

        {/* Location/Link */}
        <div className="mb-6">
          <label className="block text-sm mb-1 text-purple-200">مكان الحصة / الرابط</label>
          <input 
            type="text" 
            value={locationOrLink}
            onChange={(e) => setLocationOrLink(e.target.value)}
            className="w-full bg-[#180b29] border border-purple-900 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
            placeholder={sessionType === 'online' ? 'رابط Google Meet...' : 'عنوان المكان...'}
          />
        </div>

        {/* Submit Action */}
        <button 
          onClick={handleSave}
          disabled={isSaving || !!conflict || !studentId}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition shadow-lg"
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ وجدولة الحصة'}
        </button>

      </div>
    </div>
  );
};
