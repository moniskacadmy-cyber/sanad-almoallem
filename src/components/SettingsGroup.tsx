import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Collapsible settings section so the screen stays short and organised. */
export const SettingsGroup: React.FC<{
  icon: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, hint, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl border border-purple-500/25 bg-slate-900/60 overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-right cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white">{title}</h3>
            {hint && <p className="text-[11px] text-slate-400 truncate">{hint}</p>}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-4 space-y-4">{children}</div>}
    </section>
  );
};
