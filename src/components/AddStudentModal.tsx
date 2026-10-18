import React, { useState } from 'react';
import { X, UserPlus, Sparkles } from 'lucide-react';
import { ClassType } from '../types';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  defaultSubject: string;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onSave, defaultSubject }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    subject: defaultSubject,
    grade: '',
    paymentType: 'hourly' as 'hourly' | 'monthly',
    rate: 0,
    sessionType: 'in_person' as ClassType,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">إضافة طالب جديد</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">الاسم بس يكفي — باقي البيانات تقدر تكملها بعدين</p>
        
        <input type="text" placeholder="اسم الطالب" className="w-full bg-slate-800 p-3 rounded-xl mb-3 text-white border border-slate-700" onChange={(e) => setFormData({...formData, name: e.target.value})} />
        <input type="text" placeholder="رقم واتساب (01xxxxxxxxx)" className="w-full bg-slate-800 p-3 rounded-xl mb-3 text-white border border-slate-700" onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} />
        <select className="w-full bg-slate-800 p-3 rounded-xl mb-3 text-white border border-slate-700" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})}>
          <option value={defaultSubject}>{defaultSubject}</option>
          {/* Add other subjects as needed */}
        </select>
        <input type="text" placeholder="الصف الدراسي" className="w-full bg-slate-800 p-3 rounded-xl mb-3 text-white border border-slate-700" onChange={(e) => setFormData({...formData, grade: e.target.value})} />

        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-purple-400 text-sm mb-4">+ بيانات إضافية (اختياري)</button>
        
        {showAdvanced && (
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl mb-4">
            <div className="flex gap-2">
              <button className={`flex-1 p-2 rounded-lg ${formData.paymentType === 'hourly' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={() => setFormData({...formData, paymentType: 'hourly'})}>بالساعة</button>
              <button className={`flex-1 p-2 rounded-lg ${formData.paymentType === 'monthly' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={() => setFormData({...formData, paymentType: 'monthly'})}>شهري</button>
            </div>
            <input type="number" placeholder={formData.paymentType === 'hourly' ? "سعر الساعة" : "الاشتراك الشهري"} className="w-full bg-slate-800 p-3 rounded-xl text-white border border-slate-700" onChange={(e) => setFormData({...formData, rate: Number(e.target.value)})} />
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold">إلغاء</button>
          <button onClick={() => onSave(formData)} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold">حفظ</button>
        </div>
        <p className="text-center text-xs text-purple-400 mt-4 cursor-pointer">عندك طلاب كتير؟ أضفهم كلهم مرة واحدة</p>
      </div>
    </div>
  );
};
