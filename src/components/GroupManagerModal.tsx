import React, { useState } from 'react';
import { X, Users, CheckSquare } from 'lucide-react';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGroup: (data: any) => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({ isOpen, onClose, onSaveGroup }) => {
  const [groupName, setGroupName] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">إدارة المجموعات</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        <input type="text" placeholder="اسم المجموعة" className="w-full bg-slate-800 p-3 rounded-xl mb-4 text-white border border-slate-700" onChange={(e) => setGroupName(e.target.value)} />
        
        <button className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold mb-4" onClick={() => onSaveGroup({name: groupName})}>إنشاء مجموعة</button>
        
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm text-slate-300 mb-2">إجراءات سريعة</h3>
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold">
            <CheckSquare className="w-5 h-5" /> تسجيل حضور المجموعة
          </button>
        </div>
      </div>
    </div>
  );
};
