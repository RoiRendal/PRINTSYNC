import React from 'react';
import { ClipboardList, Search, Filter, ArrowRight, Printer, CheckCircle2, Clock } from 'lucide-react';
import { MOCK_ORDERS } from '../constants';
import { TableActions } from '../components/common/TableActions';

const statusColors: any = {
  'In Production': 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/40',
  'Pending': 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40',
  'Ready for Pickup': 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40',
  'Designing': 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/40',
};

export default function Orders() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 xl:gap-6">
         {[
           { label: 'Stage: Prep', icon: ClipboardList, count: 5, color: 'text-purple-500' },
           { label: 'Stage: Print', icon: Printer, count: 12, color: 'text-blue-500' },
           { label: 'Stage: QC', icon: CheckCircle2, count: 4, color: 'text-green-500' },
           { label: 'Stage: Ship', icon: Clock, count: 3, color: 'text-amber-500' },
         ].map((card) => (
           <div key={card.label} className="bg-white p-3 md:p-4 border border-gray-200 rounded shadow-sm flex items-center justify-between group hover:border-blue-500 transition-all cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-700">
              <div className="flex items-center gap-3">
                 <div className={`p-1.5 md:p-2 bg-gray-50 rounded group-hover:bg-blue-50 transition-colors dark:bg-zinc-800 dark:group-hover:bg-blue-900/30 ${card.color}`}>
                    <card.icon className="w-4 h-4 md:w-5 md:h-5" />
                 </div>
                 <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-tight text-gray-600 dark:text-zinc-500">{card.label}</span>
              </div>
              <span className="text-lg md:text-xl font-mono font-bold italic text-gray-900 dark:text-zinc-100">{card.count}</span>
           </div>
         ))}
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
         <div className="p-3 md:p-4 lg:p-5 xl:p-6 border-b border-gray-100 flex gap-4 bg-gray-50/50 items-center dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
               <input 
                  type="text" 
                  placeholder="Filter dispatch queue..." 
                  className="w-full pl-9 pr-4 py-1.5 md:py-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500 shadow-inner dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 lg:text-[13px]"
               />
            </div>
            <TableActions />
            <button className="px-4 py-1.5 md:py-2 bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">
               Search
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left text-xs xl:text-sm">
              <thead>
                 <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                    <th className="py-2.5 px-6 md:px-8 font-bold uppercase text-[9px] tracking-[0.2em]">Ref ID</th>
                    <th className="py-2.5 px-6 md:px-8 font-bold uppercase text-[9px] tracking-[0.2em]">Project / Client</th>
                    <th className="py-2.5 px-6 md:px-8 font-bold uppercase text-[9px] tracking-[0.2em]">Work Phase</th>
                    <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[9px] tracking-[0.2em] text-right">Value</th>
                    <th className="py-2.5 px-6"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                 {MOCK_ORDERS.map((order) => (
                   <tr key={order.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                      <td className="py-3 px-6 md:px-8 font-mono text-blue-600 dark:text-blue-400">#{order.id.replace('ORD-', 'PS-')}</td>
                      <td className="py-3 px-6 md:px-8">
                         <h3 className="font-bold text-gray-800 dark:text-zinc-200 md:text-sm">{order.customer}</h3>
                         <p className="text-[10px] md:text-[11px] text-gray-400 mt-0.5 dark:text-zinc-500">{order.item} × {order.quantity} units</p>
                      </td>
                      <td className="py-3 px-6 md:px-8">
                         <span className={`px-2 py-0.5 border text-[9px] md:text-[10px] font-bold uppercase rounded-full ${statusColors[order.status]}`}>
                            {order.status}
                         </span>
                      </td>
                      <td className="py-3 px-4 md:px-6 font-mono font-bold text-right text-gray-900 dark:text-zinc-100 leading-none md:text-sm">
                         ₱{order.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-6 md:px-8 text-right">
                         <button className="p-1.5 md:p-2 bg-gray-50 hover:bg-blue-600 hover:text-white transition-all rounded dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-blue-600 dark:hover:text-white">
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                         </button>
                      </td>
                   </tr>
                 ))}
              </tbody>
            </table>
         </div>
         
         <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex justify-center text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:bg-zinc-900/50 dark:border-zinc-800">
            End of Active Dispatch Queue
         </div>
      </div>
    </div>
  );
}
