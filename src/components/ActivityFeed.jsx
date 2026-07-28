import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

export default function ActivityFeed({ atividades }) {
  
  // Função auxiliar mantida dentro do componente
  const formatDateToBR = (dateString) => {
    if (!dateString) return '';
    if (dateString.includes('/')) return dateString;
    const cleanDateStr = String(dateString).substring(0, 10);
    const [y, m, d] = cleanDateStr.split('-');
    if (!y || !m || !d) return new Date(dateString).toLocaleDateString('pt-BR');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col flex-1">
      <h2 className="text-sm font-semibold text-slate-300 mb-4 pb-3 border-b border-white/10 flex items-center gap-2">
        <Clock size={16} className="text-cyan-400" /> Atividades Recentes
      </h2>

      <div className="space-y-3 flex-1 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
        {(!atividades || atividades.length === 0) ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Nenhuma atividade recente no mês.
          </div>
        ) : (
          atividades.map(log => (
            <div key={log.id} className="flex items-center justify-between p-3.5 bg-black/20 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-200 line-clamp-1">{log.title}</h4>
                  <span className="text-[10px] text-slate-500">{formatDateToBR(log.created_at || log.date)}</span>
                </div>
              </div>
              {log.value !== null && (
                <span className="text-xs font-mono font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 shrink-0 ml-2">
                  {log.value} {log.unit}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}