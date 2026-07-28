import React from 'react';
import { Scale } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function WeightChart({ data }) {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Scale size={16} className="text-cyan-400" /> Evolução do Peso Corporal (kg)
        </h2>
      </div>
      <div className="h-52 w-full">
        {(!data || data.length === 0) ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Nenhum registro de peso encontrado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="peso" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorPeso)" name="Peso (kg)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}