import React from 'react';

export default function StatCard({ title, icon: Icon, colorClass, mainValue, subtext, footerContent }) {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={64} className={colorClass} />
      </div>
      <div>
        <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 ${colorClass}`}>
          <Icon size={16} /> {title}
        </div>
        <div className="text-2xl font-bold font-mono text-slate-100">
          {mainValue}
        </div>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
        {footerContent}
      </div>
    </div>
  );
}