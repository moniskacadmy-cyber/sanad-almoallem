import React, { useState } from 'react';
import { Mic, Plus, Trash2, Clock, User, Calendar, AlertCircle } from 'lucide-react';

export interface StudentItem {
  id: number | string;
  name: string;
  time: string;
}

interface StudentManagerProps {
  onStudentAdd?: (student: StudentItem) => void;
  initialStudents?: StudentItem[];
}

export default function StudentManager({ onStudentAdd, initialStudents = [] }: StudentManagerProps) {
  const [students, setStudents] = useState<StudentItem[]>(initialStudents);
  const [studentName, setStudentName] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. حل مشكلة إضافة الطالب والمواعيد
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();

    // التأكد من إدخال الاسم والموعد
    if (!studentName.trim() || !selectedTime) {
      alert('الرجاء إدخال اسم الطالب واختيار الموعد بشكل صحيح');
      return;
    }

    const newStudent: StudentItem = {
      id: Date.now(),
      name: studentName.trim(),
      time: selectedTime,
    };

    // تحديث القائمة بشكل صحيح (Immutable State Update باِستخدام prev)
    setStudents((prev) => [...prev, newStudent]);

    if (onStudentAdd) {
      onStudentAdd(newStudent);
    }

    // إعادة تعيين الحقول بعد الإضافة
    setStudentName('');
    setSelectedTime('');
  };

  // 2. ميزة إضافة الطالب عن طريق الصوت (Web Speech API)
  const startSpeechRecognition = () => {
    setErrorMessage(null);
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    };

    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      const msg = 'متصفحك لا يدعم التعرف على الصوت. يُرجى استخدام متصفح Chrome أو Edge.';
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ar-SA';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('النص المسموع:', transcript);

        // تنقية النص لاستخراج الاسم
        let cleanName = transcript
          .replace(/الطالب|طالب|إضافة|اضف|اضافة/g, '')
          .trim();

        if (cleanName) {
          setStudentName(cleanName);
        } else {
          setStudentName(transcript.trim());
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleDeleteStudent = (id: number | string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-right dir-rtl shadow-xl font-sans my-4">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            إدارة الطلاب والمواعيد
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إضافة وإدارة مواعيد حصص الطلاب يدويًا أو عبر الإدخال الصوتي الذكي
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* نموذج الإضافة يدويًا أو بالصوت */}
      <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="اسم الطالب (مثال: أحمد محمد)"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none transition placeholder-slate-500"
          />
        </div>

        {/* زر التسجيل الصوتي */}
        <button
          type="button"
          onClick={startSpeechRecognition}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer border ${
            isListening
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Mic className={`w-4 h-4 ${isListening ? 'text-rose-400' : 'text-emerald-400'}`} />
          <span>{isListening ? 'جاري الاستماع...' : '🎤 إدخال الاسم بالصوت'}</span>
        </button>

        <select
          value={selectedTime}
          onChange={(e) => setSelectedTime(e.target.value)}
          className="bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none transition"
        >
          <option value="">اختر الموعد</option>
          <option value="الأحد 10:00 صباحاً">الأحد 10:00 صباحاً</option>
          <option value="الأحد 04:00 مساءً">الأحد 04:00 مساءً</option>
          <option value="الاثنين 11:00 صباحاً">الاثنين 11:00 صباحاً</option>
          <option value="الثلاثاء 02:00 ظهراً">الثلاثاء 02:00 ظهراً</option>
          <option value="الأربعاء 03:00 مساءً">الأربعاء 03:00 مساءً</option>
          <option value="الخميس 05:00 مساءً">الخميس 05:00 مساءً</option>
          <option value="السبت 01:00 ظهراً">السبت 01:00 ظهراً</option>
        </select>

        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة طالب</span>
        </button>
      </form>

      {/* عرض قائمة الطلاب */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          قائمة الطلاب المضافين ({students.length}):
        </h3>

        {students.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
            لا يوجد طلاب مضافون حتى الآن. قم بتعبئة بيانات الطالب واختيار الموعد أعلاه.
          </div>
        ) : (
          <ul className="space-y-2">
            {students.map((student) => (
              <li
                key={student.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-slate-100 font-medium text-sm">{student.name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>الموعد: {student.time}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteStudent(student.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="حذف الطالب"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
