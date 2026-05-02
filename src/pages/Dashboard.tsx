import React from 'react';
import { motion } from 'motion/react';
import {TrendingUp, Package, Users, DollarSign, Clock, CheckCircle2, ShoppingBag} from 'lucide-react';
import { MOCK_ORDERS } from '../constants';
import { TableActions } from '../components/common/TableActions';

const StatCard = ({ title, value, icon: Icon, trend }: any) => (
  <div className="bg-white p-4 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
    <div className="flex justify-between items-start">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter dark:text-zinc-400">{title}</p>
      <div className="p-1.5 bg-gray-50 rounded dark:bg-zinc-800 transition-colors">
        <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
      </div>
    </div>
    <p className="text-2xl font-mono font-bold mt-1 text-gray-900 dark:text-zinc-100">{value}</p>
    {trend !== undefined && (
      <p className={`text-[10px] font-semibold mt-1 ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% {trend >= 0 ? 'increase' : 'decrease'}
      </p>
    )}
  </div>
);

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
        <StatCard title="Daily Revenue" value="₱24,250.00" icon={DollarSign} trend={12.5} />
        <StatCard title="Pending Jobs" value="84" icon={ShoppingBag} trend={5.2} />
        <StatCard title="Inventory Alerts" value="12" icon={Package} trend={-10} />
        <StatCard title="Completed Today" value="156" icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-8">
        {/* Table Area */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 bg-white border border-gray-200 rounded shadow-sm flex flex-col dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
          <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:border-zinc-800">
            <h3 className="text-sm font-bold uppercase tracking-wide dark:text-zinc-200">Current Production Queue</h3>
            <div className="flex flex-wrap items-center gap-2">
              <TableActions exportLabel="Export Queue" />
              <button className="text-[10px] whitespace-nowrap shrink-0 bg-gray-100 px-3 py-1.5 rounded border border-gray-300 font-bold uppercase hover:bg-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">View All Jobs</button>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Order ID</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Client</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Item</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium text-center uppercase text-[10px] tracking-wider">Qty</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {MOCK_ORDERS.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="py-3 px-4 md:px-6 font-mono text-blue-600 font-medium dark:text-blue-400">#{order.id.replace('ORD-', 'PS-')}</td>
                    <td className="py-3 px-4 md:px-6 font-semibold text-gray-800 dark:text-zinc-200">{order.customer}</td>
                    <td className="py-3 px-4 md:px-6 text-gray-600 dark:text-zinc-400">{order.item}</td>
                    <td className="py-3 px-4 md:px-6 text-center font-mono dark:text-zinc-300">{order.quantity}</td>
                    <td className="py-3 px-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        order.status === 'In Production' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Snapshot */}
        <div className="md:col-span-2 lg:col-span-1 bg-slate-900 border border-slate-800 rounded shadow-lg flex flex-col p-5 xl:p-8 text-white">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-4 mb-5">
            <h3 className="text-sm font-bold uppercase tracking-wide whitespace-nowrap">Stock Levels</h3>
            <TableActions exportLabel="Export" />
          </div>
          
          <div className="space-y-5 flex-1">
            {[
              { label: 'Cotton T-Shirts', qty: '1,240 Units', val: 82, color: 'bg-blue-500' },
              { label: 'Polo Shirts', qty: '412 Units', val: 45, color: 'bg-blue-500' },
              { label: 'Jersey Fabric', qty: '85 Rolls', val: 68, color: 'bg-blue-500' },
              { label: 'Long Sleeves', qty: '12 Units', val: 4, color: 'bg-red-500' },
              { label: 'Hoodies', qty: '98 Units', val: 22, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono uppercase">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-blue-400 font-bold">{item.qty}</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.val}%` }}
                    className={`h-full ${item.color}`} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-slate-800/50 rounded border border-slate-800">
             <p className="text-[10px] text-slate-400 font-medium mb-3 uppercase tracking-widest">Command Center Actions</p>
             <div className="flex flex-wrap gap-2">
                <button className="flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">
                  Restock
                </button>
                <button className="flex-1 min-w-[100px] whitespace-nowrap py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">
                  Logistics
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
