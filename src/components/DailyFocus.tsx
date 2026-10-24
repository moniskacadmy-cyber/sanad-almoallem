import React, { useState } from 'react';
import { TeacherProfile, DailyGoal } from '../types';
import { updateTeacherProfile } from '../firebase';
import { Check, Trash2, Plus, Target, RefreshCw } from 'lucide-react';

interface DailyFocusProps {
  profile: TeacherProfile;
}

export const DailyFocus: React.FC<DailyFocusProps> = ({ profile }) => {
  const [goals, setGoals] = useState<DailyGoal[]>(profile.dailyGoals || []);
  const [newGoalText, setNewGoalText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveGoals = async (updatedGoals: DailyGoal[]) => {
    setIsSaving(true);
    try {
      await updateTeacherProfile(profile.id, { dailyGoals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) {
      console.error('Failed to save daily goals:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addGoal = async () => {
    if (!newGoalText.trim() || goals.length >= 3) return;
    const newGoal: DailyGoal = {
      id: Date.now().toString(),
      text: newGoalText.trim(),
      completed: false,
    };
    const updatedGoals = [...goals, newGoal];
    setNewGoalText('');
    await saveGoals(updatedGoals);
  };

  const toggleGoal = async (id: string) => {
    const updatedGoals = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    await saveGoals(updatedGoals);
  };

  const removeGoal = async (id: string) => {
    const updatedGoals = goals.filter(g => g.id !== id);
    await saveGoals(updatedGoals);
  };

  return (
    <div className="p-4 rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-xl space-y-4">
      <div className="flex items-center gap-2.5 border-b border-purple-900/40 pb-3">
        <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
          <Target className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>تركيز اليوم</span>
            {isSaving && <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" />}
          </h4>
          <p className="text-[10px] text-slate-400">حدد أهم 3 أهداف لإنجازها اليوم</p>
        </div>
      </div>
      
      {goals.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>نسبة الإنجاز</span>
            <span>{Math.round((goals.filter(g => g.completed).length / goals.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300" 
              style={{ width: `${(goals.filter(g => g.completed).length / goals.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {goals.map(goal => (
          <div key={goal.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 flex-1">
              <button onClick={() => toggleGoal(goal.id)} className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${goal.completed ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                {goal.completed && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
              <span className={`text-xs ${goal.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{goal.text}</span>
            </div>
            <button onClick={() => removeGoal(goal.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {goals.length < 3 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            placeholder="هدف جديد..."
            className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
          />
          <button onClick={addGoal} className="p-2 bg-purple-600 rounded-xl text-white cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
