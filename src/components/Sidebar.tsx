import React, { useEffect, useState } from 'react';
import {
  LayoutGrid,
  Users,
  Calendar,
  BookOpen,
  DollarSign,
  Wallet,
  BarChart3,
  CheckSquare,
  Bell,
  Settings,
  X,
  ShieldCheck,
} from 'lucide-react';
import { TeacherProfile } from '../types';
import { ThemeSidebarToggle } from './ThemeToggle';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem: string;
  onSelect: (itemId: string) => void;
  profile: TeacherProfile | null;
}

export function Sidebar({ isOpen, onClose, activeItem, onSelect, profile }: SidebarProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShowDrawer(true));
    } else {
      setShowDrawer(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: LayoutGrid },
    { id: 'students', label: 'الطلاب', icon: Users },
    { id: 'appointments', label: 'المواعيد', icon: Calendar },
    { id: 'classes', label: 'الحصص', icon: BookOpen },
    { id: 'profits', label: 'الأرباح', icon: DollarSign },
    { id: 'expenses', label: 'المصروفات', icon: Wallet },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
    { id: 'reminders', label: 'التذكيرات', icon: CheckSquare, defaultActive: true },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  const handleClose = () => {
    setShowDrawer(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir="rtl">
      {/* Backdrop with professional glass-morphism aesthetic matching design tokens */}
      <div
        className={`absolute inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-md transition-all duration-300 ease-in-out ${
          showDrawer ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Navigation Drawer (slides smoothly from right with CSS transition properties) */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div
          style={{ transitionProperty: 'transform, opacity' }}
          className={`w-80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200 dark:border-purple-900/40 shadow-2xl flex flex-col text-slate-800 dark:text-slate-100 transform transition-all duration-300 ease-in-out ${
            showDrawer ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-purple-900/30 flex items-center justify-between bg-slate-50/90 dark:bg-slate-950/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shadow-lg text-amber-300 font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-wide">سند المعلم</h2>
                <p className="text-xs text-purple-600 dark:text-purple-300/80 font-medium">منصة المعلم</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Teacher Profile Info summary */}
          {profile && (
            <div className="px-4 py-3 bg-purple-50 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/20 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-200 dark:bg-purple-900/50 border border-purple-400/40 dark:border-purple-500/30 flex items-center justify-center text-purple-800 dark:text-purple-200 font-bold text-sm">
                {profile.name ? profile.name.charAt(0) : 'م'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{profile.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{profile.subject || 'معلم عام'}</p>
              </div>
            </div>
          )}

          {/* Prominent Theme Toggle in Sidebar */}
          <div className="px-3 pt-3">
            <ThemeSidebarToggle />
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5" id="sidebar-nav-menu">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id || (!activeItem && item.defaultActive);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    handleClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-purple-600/15 dark:bg-purple-600/25 text-purple-900 dark:text-amber-300 border border-purple-400/50 dark:border-purple-500/40 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white border border-transparent'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl transition ${
                      isActive
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 group-hover:bg-purple-50 dark:group-hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-right">{item.label}</span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-amber-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer info */}
          <div className="p-3 border-t border-slate-200 dark:border-purple-900/30 text-center bg-slate-50/90 dark:bg-slate-950/60">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>سند المعلم الذكي • إصدار آمن</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
