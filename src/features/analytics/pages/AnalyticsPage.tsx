import React from 'react';
import { BarChart3, TrendingUp, PieChart, Target, Zap } from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';

export default function Analytics() {
  return (
    <div className="space-y-4 text-slate-900 dark:text-zinc-100">
      <div className="flex justify-between items-center bg-white p-3 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
        <div className="flex flex-col">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500">Business Intelligence Hub</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">Data synthesized from last 30 operational days</span>
        </div>
        <TableActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-5">
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 bg-white border border-gray-200 rounded p-4 xl:p-5 shadow-sm flex flex-col dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
           <div className="flex justify-between items-start mb-6">
              <div>
                 <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-gray-800 dark:text-zinc-200">Production Output Intensity</h2>
                 <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-wider dark:text-zinc-500">Historical print volume per station</p>
              </div>
              <div className="flex bg-gray-50 border border-gray-200 p-1 rounded dark:bg-zinc-800 dark:border-zinc-700">
                 {['7D', '30D', '1Y'].map(time => (
                   <button key={time} className={`px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded ${time === '30D' ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors dark:text-zinc-400'}`}>{time}</button>
                 ))}
              </div>
           </div>
           
           <div className="flex-1 flex items-end gap-1.5 md:gap-2 lg:gap-2.5 xl:gap-3 min-h-[180px] xl:min-h-[240px] border-b border-gray-100 pb-2 dark:border-zinc-800">
              {[40, 65, 30, 85, 45, 90, 70, 55, 75, 40, 60, 50, 65, 80, 45].map((val, i) => (
                <div key={i} className="flex-1 group relative">
                   <div
                      style={{ height: `${val}%` }}
                      className="bg-gray-200 group-hover:bg-slate-900 transition-colors w-full rounded-t-sm dark:bg-zinc-800 dark:group-hover:bg-slate-800"
                   />
                </div>
              ))}
           </div>
           <div className="flex justify-between text-[9px] text-gray-400 font-mono uppercase tracking-widest mt-2 px-1">
              <span>Oct 01</span>
              <span>Oct 15</span>
              <span>Oct 30</span>
           </div>
        </div>

        <div className="md:col-span-2 lg:col-span-1 space-y-4">
           <div className="bg-white border border-gray-200 p-4 xl:p-5 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                 <Zap className="w-4 h-4 text-slate-900 dark:text-zinc-200" />
                 <h2 className="text-[10px] uppercase font-bold tracking-[0.3em] text-gray-800 dark:text-zinc-200">Operational Efficiency</h2>
              </div>
              <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tighter italic text-gray-900 dark:text-zinc-100">94.2<span className="text-slate-900 dark:text-zinc-200 text-xl">%</span></span>
              </div>
              <div className="mt-4 space-y-3">
                 {[
                   { label: 'Uptime', val: 98 },
                   { label: 'Yield', val: 91 },
                 ].map(m => (
                   <div key={m.label} className="space-y-1">
                      <div className="flex justify-between text-[9px] uppercase font-mono text-gray-500 dark:text-zinc-600">
                        <span>{m.label}</span>
                        <span className="text-gray-900 dark:text-zinc-100">{m.val}%</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden dark:bg-zinc-800">
                        <div className="h-full bg-slate-900 dark:bg-slate-800" style={{ width: `${m.val}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white border border-gray-200 p-4 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
              <h2 className="text-[10px] uppercase font-bold tracking-[0.3em] flex items-center gap-2 mb-6 dark:text-zinc-400">
                 <PieChart className="w-3.5 h-3.5 text-slate-700" /> Segment Density
              </h2>
              <div className="space-y-4">
                 {[
                   { label: 'B2B Wholesale', val: 78 },
                   { label: 'Retail Direct', val: 42 },
                   { label: 'Education', val: 56 },
                 ].map(item => (
                   <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold font-mono">
                         <span className="text-gray-500 dark:text-zinc-500">{item.label}</span>
                         <span className="text-gray-900 dark:text-zinc-100">{item.val}%</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden dark:bg-zinc-800">
                         <div className="h-full bg-slate-900 dark:bg-slate-900" style={{ width: `${item.val}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
         <div className="bg-white border border-gray-200 p-4 xl:p-5 rounded shadow-sm flex flex-col items-center justify-center min-h-[130px] dark:bg-zinc-900 dark:border-zinc-800">
            <div className="bg-gray-50 p-3 rounded-full mb-3 dark:bg-zinc-800">
               <Target className="w-5 h-5 text-slate-900 dark:text-zinc-200" />
            </div>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500 dark:text-zinc-500">Goal Achievement</p>
            <p className="text-2xl font-mono font-bold tracking-tight mt-1 text-gray-900 dark:text-zinc-100">82<span className="text-gray-400 dark:text-zinc-600">%</span></p>
         </div>

         <div className="md:col-span-2 xl:col-span-3 bg-white border border-gray-200 p-4 xl:p-5 rounded shadow-sm relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] mb-4 text-gray-800 border-b border-gray-50 pb-3 dark:text-zinc-200 dark:border-zinc-800">Best Performing Skus</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-4">
               {[
                 { label: 'Premium Tee', sold: '1.2k', up: true },
                 { label: 'Sport Jersey', sold: '840', up: true },
                 { label: 'Worker Polo', sold: '650', up: false },
                 { label: 'Soft Hoodie', sold: '420', up: true },
                 { label: 'Canvas Bag', sold: '310', up: true },
                 { label: 'Flex Cap', sold: '280', up: false },
               ].map(stat => (
                 <div key={stat.label} className="space-y-1">
                    <p className="text-[9px] font-bold uppercase text-gray-400 truncate dark:text-zinc-500">{stat.label}</p>
                    <div className="flex items-center gap-2">
                       <p className="text-lg font-mono font-bold text-gray-900 dark:text-zinc-100">{stat.sold}</p>
                       <span className={`text-[8px] font-bold ${stat.up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{stat.up ? '▲' : '▼'}</span>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

