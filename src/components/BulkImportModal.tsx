import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  defaultSubject: string;
  onSuccess: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, teacherId, defaultSubject, onSuccess }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!inputText.trim()) return;
    setLoading(true);

    try {
      const lines = inputText.split('\n');
      const students = lines.filter(line => line.trim()).map(line => {
        const [name, whatsapp] = line.split(',').map(s => s.trim());
        return { name, whatsapp: whatsapp || '', subject: defaultSubject, classType: 'in_person', hourlyRate: 100 };
      });

      const batch = writeBatch(db);
      students.forEach(s => {
        const newDocRef = doc(collection(db, 'teachers', teacherId, 'students'));
        batch.set(newDocRef, {
          ...s,
          teacherId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Bulk import error:', error);
      alert('حدث خطأ أثناء إضافة الطلاب، يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">إضافة طلاب دفعة واحدة</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        
        <p className="text-xs text-slate-400 mb-4">
          أدخل بيانات الطلاب (الاسم، رقم الواتساب) كل طالب في سطر.<br/>
          مثال: <span className="font-mono text-purple-300">أحمد محمد, 01xxxxxxxxx</span>
        </p>

        <textarea 
          rows={8}
          className="w-full bg-slate-800 p-3 rounded-xl mb-4 text-white border border-slate-700" 
          placeholder="أحمد محمد, 01000000000&#10;سارة علي, 01111111111"
          onChange={(e) => setInputText(e.target.value)}
        />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold">إلغاء</button>
          <button 
            onClick={handleImport} 
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center gap-2"
          >
            {loading ? 'جاري الإضافة...' : <><Upload className="w-5 h-5"/> حفظ القائمة</>}
          </button>
        </div>
      </div>
    </div>
  );
};
