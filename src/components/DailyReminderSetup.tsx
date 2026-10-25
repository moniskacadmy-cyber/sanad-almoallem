import React from 'react';
import { Clock } from 'lucide-react';
import { TeacherProfile } from '../types';
import { updateTeacherProfile } from '../firebase';

interface DailyReminderSetupProps {
  profile: TeacherProfile;
  onUpdate: (profile: TeacherProfile) => void;
}

export const DailyReminderSetup: React.FC<DailyReminderSetupProps> = ({ profile, onUpdate }) => {
  const prefs = profile.notificationPreferences;
  
  const handleUpdate = async (updates: any) => {
    const updatedProfile = {
      ...profile,
      notificationPreferences: { ...prefs, ...updates }
    };
    await updateTeacherProfile(profile.id, updatedProfile);
    onUpdate(updatedProfile);
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30 space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Clock className="w-4 h-4 text-purple-400" />
        تذكير جدول الحصص اليومي
      </h3>
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={prefs?.dailyDigestEnabled ?? true}
            onChange={(e) => handleUpdate({ dailyDigestEnabled: e.target.checked })}
            className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500"
          />
          تفعيل إشعار الجدول اليومي
        </label>
        <input
          type="time"
          value={prefs?.dailyDigestTime ?? '08:00'}
          onChange={(e) => handleUpdate({ dailyDigestTime: e.target.value })}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
        />
      </div>
    </div>
  );
};
