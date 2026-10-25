import React, { useState, useEffect } from 'react';
import { Student, GroupMembership, StudentStatus, PauseType, ScheduleSlot } from '../types';
import { updateStudentStatus, updateGroupMembershipStatus } from '../firebase';
import { getTodayCairoDateStr, getDaysDiff } from '../services/studentStatus';
import { useBackHandler } from '../services/backHandler';
import {
  X,
  PauseCircle,
  PlayCircle,
  Archive,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Sparkles,
  RotateCcw,
  Info,
} from 'lucide-react';

export interface StudentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudent?: Student | null;
  targetMembership?: GroupMembership | null;
  targetGroupName?: string;
  teacherId: string;
  studentSchedules?: ScheduleSlot[];
  onStatusUpdated?: (newStatus: StudentStatus, pauseType?: PauseType) => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onRequestEditSchedule?: (student: Student) => void;
}

export const StudentStatusModal: React.FC<StudentStatusModalProps> = ({
  isOpen,
  onClose,
  targetStudent,
  targetMembership,
  targetGroupName,
  teacherId,
  studentSchedules = [],
  onStatusUpdated,
  onShowToast,
  onRequestEditSchedule,
}) => {
  useBackHandler(isOpen, onClose, 'student_status_modal');

  const todayStr = getTodayCairoDateStr();
  const isGroupTarget = !!targetMembership;
  const displayName = targetStudent?.name || targetMembership?.studentName || 'الطالب';

  // Current entity state
  const currentEntity = targetMembership || targetStudent;

  const [selectedStatus, setSelectedStatus] = useState<StudentStatus>('active');
  const [selectedPauseType, setSelectedPauseType] = useState<PauseType>('temporary');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>('');
  const [restoreSchedules, setRestoreSchedules] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen || !currentEntity) return;

    const initialStatus = currentEntity.status || (currentEntity.archived ? 'archived' : currentEntity.active === false ? 'paused' : 'active');
    setSelectedStatus(initialStatus);

    const initialPauseType = currentEntity.pauseType || 'temporary';
    setSelectedPauseType(initialPauseType);

    setStartDate(currentEntity.pauseStartDate || todayStr);

    if (currentEntity.pauseEndDate) {
      setEndDate(currentEntity.pauseEndDate);
    } else {
      // Default to 14 days from today
      const defaultEnd = new Date();
      defaultEnd.setDate(defaultEnd.getDate() + 14);
      setEndDate(defaultEnd.toISOString().split('T')[0]);
    }
  }, [isOpen, currentEntity, todayStr]);

  if (!isOpen || !currentEntity) return null;

  // Preset quick date buttons
  const applyPreset = (days: number) => {
    const start = new Date(startDate || todayStr);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const daysDifference = startDate && endDate ? getDaysDiff(startDate, endDate) : null;
  const hasSavedPreviousSchedules = (targetStudent?.previousScheduleSlots?.length || 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;

    if (selectedStatus === 'paused' && selectedPauseType === 'temporary') {
      if (!startDate) {
        onShowToast('يرجى تحديد تاريخ بدء فترة التوقف', true);
        return;
      }
      if (!endDate) {
        onShowToast('يرجى تحديد تاريخ انتهاء فترة التوقف', true);
        return;
      }
      if (endDate < startDate) {
        onShowToast('تاريخ انتهاء التوقف يجب أن يكون بعد أو نفس تاريخ البدء', true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isGroupTarget && targetMembership) {
        // Update Group Membership Status
        await updateGroupMembershipStatus(teacherId, targetMembership.studentId, targetMembership.groupId || '', {
          status: selectedStatus,
          pauseType: selectedStatus === 'paused' ? selectedPauseType : undefined,
          pauseStartDate: selectedStatus === 'paused' && selectedPauseType === 'temporary' ? startDate : null,
          pauseEndDate: selectedStatus === 'paused' && selectedPauseType === 'temporary' ? endDate : null,
        });

        const statusLabel =
          selectedStatus === 'active'
            ? 'تم تفعيل عضوية الطالب في المجموعة بنجاح! 🟢'
            : selectedStatus === 'paused'
            ? selectedPauseType === 'temporary'
              ? `تم إيقاف الطالب مؤقتاً في المجموعة حتى ${endDate} ⏸️`
              : 'تم إيقاف الطالب نهائياً في المجموعة 🛑'
            : 'تمت أرشفة عضوية الطالب في المجموعة 🗄️';

        onShowToast(statusLabel);
        if (onStatusUpdated) onStatusUpdated(selectedStatus, selectedPauseType);
        onClose();
      } else if (targetStudent) {
        // Individual Student Status
        // If pausing and student has active schedules, backup schedule slots for 1-click restore
        let backupSlots = targetStudent.previousScheduleSlots || [];
        if (selectedStatus === 'paused' && studentSchedules.length > 0) {
          backupSlots = studentSchedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            time: s.time,
            duration: s.duration,
            classType: s.classType,
            locationOrLink: s.locationOrLink || '',
            notes: s.notes || '',
          }));
        }

        await updateStudentStatus(teacherId, targetStudent.id, {
          status: selectedStatus,
          pauseType: selectedStatus === 'paused' ? selectedPauseType : undefined,
          pauseStartDate: selectedStatus === 'paused' && selectedPauseType === 'temporary' ? startDate : null,
          pauseEndDate: selectedStatus === 'paused' && selectedPauseType === 'temporary' ? endDate : null,
          previousScheduleSlots: backupSlots,
        });

        const statusLabel =
          selectedStatus === 'active'
            ? 'تم تفعيل حساب الطالب بنجاح! 🟢'
            : selectedStatus === 'paused'
            ? selectedPauseType === 'temporary'
              ? `تم إيقاف الطالب مؤقتاً حتى ${endDate} (الحصص مستبعدة من الجدول) ⏸️`
              : 'تم إيقاف الطالب نهائياً (الحصص مستبعدة من الجدول) 🛑'
            : 'تمت أرشفة حساب الطالب بنجاح 🗄️';

        onShowToast(statusLabel);
        if (onStatusUpdated) onStatusUpdated(selectedStatus, selectedPauseType);
        onClose();
      }
    } catch (err) {
      console.error('Failed to update student status:', err);
      onShowToast('حدث خطأ أثناء حفظ حالة الطالب، يرجى المحاولة لاحقاً', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[94vh] flex flex-col space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-black">
              <PauseCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>إدارة حالة الطالب:</span>
                <span className="text-purple-300">{displayName}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isGroupTarget ? `عضوية مجموعة: ${targetGroupName || 'المجموعة'}` : 'الحساب الفردي ومواعيد الحصص'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Guarantee Reassurance Banner */}
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200/90 leading-relaxed">
            <strong className="text-emerald-300 font-bold block mb-0.5">
              أمان الحساب المالي 100%:
            </strong>
            لا يتم حذف أو تعديل أي سجل مالي أو مدفوعات سابقة أو سجلات حصص مسجلة، وتظل كافة المستحقات محفوظة بدقة تامة.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {/* Status Options Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">اختر حالة الطالب:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option 1: Active */}
              <button
                type="button"
                onClick={() => setSelectedStatus('active')}
                className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                  selectedStatus === 'active'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-emerald-400" />
                    <span>نشط ومستمر</span>
                  </span>
                  {selectedStatus === 'active' && <span className="text-emerald-400 text-xs">✓</span>}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  الحصص تظهر في الجدول الأسبوعي والتذكيرات مفعلة
                </p>
              </button>

              {/* Option 2: Paused */}
              <button
                type="button"
                onClick={() => setSelectedStatus('paused')}
                className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                  selectedStatus === 'paused'
                    ? 'bg-amber-950/60 border-amber-500 text-white shadow-lg shadow-amber-950/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <PauseCircle className="w-4 h-4 text-amber-400" />
                    <span>إيقاف الطالب</span>
                  </span>
                  {selectedStatus === 'paused' && <span className="text-amber-400 text-xs">✓</span>}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  إيقاف مؤقت لفترة محددة أو نهائي واستبعاد الحصص
                </p>
              </button>

              {/* Option 3: Archived */}
              <button
                type="button"
                onClick={() => setSelectedStatus('archived')}
                className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                  selectedStatus === 'archived'
                    ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg shadow-purple-950/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-purple-400" />
                    <span>أرشفة آمنة</span>
                  </span>
                  {selectedStatus === 'archived' && <span className="text-purple-400 text-xs">✓</span>}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  حفظ الطالب بالأرشيف مع بقاء سجله كاملاً
                </p>
              </button>
            </div>
          </div>

          {/* PAUSED CONFIGURATION */}
          {selectedStatus === 'paused' && (
            <div className="rounded-2xl bg-slate-950/80 border border-amber-500/30 p-4 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>نوع الإيقاف:</span>
                </span>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedPauseType('temporary')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedPauseType === 'temporary'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    مؤقت لفترة محددة ⏳
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPauseType('permanent')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedPauseType === 'permanent'
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    إيقاف نهائي 🛑
                  </button>
                </div>
              </div>

              {selectedPauseType === 'temporary' ? (
                <div className="space-y-3 pt-1 border-t border-slate-800/80">
                  {/* Quick Preset Buttons */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1.5">فترات توقف سريعة:</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'أسبوع', days: 7 },
                        { label: 'أسبوعين', days: 14 },
                        { label: 'شهر', days: 30 },
                        { label: 'شهران', days: 60 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => applyPreset(preset.days)}
                          className="py-1 px-2 rounded-xl bg-slate-900 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/40 text-[11px] text-amber-300 font-bold transition cursor-pointer text-center"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dates Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        تاريخ بدء التوقف:
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        تاريخ انتهاء التوقف:
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || todayStr}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  {daysDifference !== null && daysDifference >= 0 && (
                    <div className="rounded-xl bg-amber-950/30 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-300/90 flex items-center justify-between">
                      <span>مدة التوقف المحددة:</span>
                      <strong className="font-bold">
                        {daysDifference === 0 ? 'يوم واحد (اليوم فقط)' : `${daysDifference} يوماً`}
                      </strong>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      سيصلك تنبيه ذكي قبل انتهاء هذه الفترة بيومين لتذكيرك باستئناف جدول الحصص أو اختيار مواعيد جديدة.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 bg-rose-950/20 border border-rose-500/30 p-3 rounded-xl space-y-1">
                  <p className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>إيقاف نهائي دون تاريخ عودة محدد</span>
                  </p>
                  <p>
                    سيتم استبعاد حصص الطالب من جدول الحصص اليومي والأسبوعي نهائياً حتى تقرر إعادة تفعيله يدوياً.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE REACTIVATION OPTIONS */}
          {selectedStatus === 'active' && currentEntity.status === 'paused' && (
            <div className="rounded-2xl bg-slate-950/80 border border-emerald-500/30 p-3.5 space-y-2.5 animate-fadeIn">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>خيارات إعادة التفعيل والجدول:</span>
              </span>

              {hasSavedPreviousSchedules ? (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={restoreSchedules}
                    onChange={(e) => setRestoreSchedules(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-800 border-slate-700 cursor-pointer"
                  />
                  <div className="text-xs text-slate-300">
                    <strong className="text-white block font-bold">
                      استعادة مواعيد الحصص القديمة تلقائياً
                    </strong>
                    <span className="text-[11px] text-slate-400">
                      يوجد ({targetStudent?.previousScheduleSlots?.length}) موعد حصص سابق مسجل للطالب
                    </span>
                  </div>
                </label>
              ) : null}

              {onRequestEditSchedule && targetStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestEditSchedule(targetStudent);
                  }}
                  className="w-full text-xs py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-300 font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>اختيار وضبط مواعيد حصص جديدة في الجدول</span>
                </button>
              )}
            </div>
          )}

          {/* ARCHIVED DETAILS */}
          {selectedStatus === 'archived' && (
            <div className="rounded-2xl bg-purple-950/20 border border-purple-500/30 p-3.5 text-xs text-purple-200/90 leading-relaxed space-y-1">
              <strong className="text-purple-300 font-bold block flex items-center gap-1.5">
                <Archive className="w-4 h-4" />
                <span>أرشفة الطالب في قائمة المؤرشفين</span>
              </strong>
              <p className="text-[11px] text-slate-300">
                يمكنك الوصول للطالب وسجلاته في أي وقت من خلال فلتر "مؤرشف" وإلغاء الأرشفة بنقرة واحدة.
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-950/50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>حفظ وتطبيق الحالة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
