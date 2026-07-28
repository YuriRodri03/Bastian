import React from 'react';
import { BarChart2 } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function FinanceChart({ data }) {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <BarChart2 size={16} className="text-emerald-400" /> Fluxo Financeiro (Receitas vs Despesas)
        </h2>
      </div>
      <div className="h-64 w-full">
        {(!data || data.length === 0) ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Sem dados financeiros pagos para o mês selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="receitas" stroke="#10b981" fillOpacity={1} fill="url(#colorReceita)" name="Receitas (R$)" />
              <Area type="monotone" dataKey="despesas" stroke="#f43f5e" fillOpacity={1} fill="url(#colorDespesa)" name="Despesas (R$)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}