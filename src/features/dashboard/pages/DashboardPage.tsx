import React, { useMemo } from 'react';
import {TrendingUp, Package, Users, DollarSign, Clock, CheckCircle2, ShoppingBag, AlertTriangle} from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';
import { useInventory } from '../../inventory/state/InventoryContext';
import { useFinance } from '../../finance/state/FinanceContext';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, trend, colorClass = "text-gray-400" }: any) => (
  <div className="bg-white p-4 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
    <div className="flex justify-between items-start">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter dark:text-zinc-400">{title}</p>
      <div className="p-1.5 bg-gray-50 rounded dark:bg-zinc-800 transition-colors">
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
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
  const { orders, items: inventory } = useInventory();
  const { records } = useFinance();

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = records
      .filter(r => r.date === today && r.type === 'Income')
      .reduce((acc, r) => acc + r.amount, 0);

    const pendingJobs = orders.filter(o => o.status !== 'Completed' && o.status !== 'Shipped').length;
    const inventoryAlerts = inventory.filter(item => item.stock <= item.reorderLevel).length;
    const completedToday = orders.filter(o => o.status === 'Completed' && o.date === today).length;

    return {
      todayRevenue,
      pendingJobs,
      inventoryAlerts,
      completedToday
    };
  }, [orders, records, inventory]);

  const productionQueue = orders.filter(o => o.status !== 'Completed' && o.status !== 'Shipped').slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
        <StatCard title="Today's Revenue" value={`₱${stats.todayRevenue.toLocaleString()}`} icon={DollarSign} colorClass="text-green-500" />
        <StatCard title="Active Jobs" value={stats.pendingJobs} icon={ShoppingBag} colorClass="text-zinc-700" />
        <StatCard title="Inventory Alerts" value={stats.inventoryAlerts} icon={AlertTriangle} colorClass={stats.inventoryAlerts > 0 ? "text-red-500" : "text-gray-400"} />
        <StatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle2} colorClass="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-5">
        {/* Table Area */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 bg-white border border-gray-200 rounded shadow-sm flex flex-col dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
          <div className="p-3 md:p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 dark:border-zinc-800">
            <h3 className="text-sm font-bold uppercase tracking-wide dark:text-zinc-200">Production Pipeline</h3>
            <div className="flex flex-wrap items-center gap-2">
              <TableActions />
              <Link to="/orders" className="text-[10px] whitespace-nowrap shrink-0 bg-gray-100 px-3 py-1.5 rounded border border-gray-300 font-bold uppercase hover:bg-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">View All Pipeline</Link>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Ref ID</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Client</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium uppercase text-[10px] tracking-wider">Work Phase</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium text-center uppercase text-[10px] tracking-wider">Qty</th>
                  <th className="py-2.5 px-4 md:px-6 font-medium text-right uppercase text-[10px] tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {productionQueue.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-100/20 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-4 md:px-6 font-mono text-zinc-900 font-medium dark:text-zinc-200">#{order.id.slice(-6)}</td>
                    <td className="py-2.5 px-4 md:px-6 font-semibold text-gray-800 dark:text-zinc-200">{order.customer}</td>
                    <td className="py-2.5 px-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        order.status === 'In Production' ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300' :
                        order.status === 'Designing' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 md:px-6 text-center font-mono dark:text-zinc-300">{order.quantity}</td>
                    <td className="py-2.5 px-4 md:px-6 text-right font-mono font-bold dark:text-zinc-100">₱{order.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {productionQueue.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400 italic">No active production jobs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Snapshot */}
        <div className="md:col-span-2 lg:col-span-1 bg-white border border-gray-200 rounded shadow-sm flex flex-col p-4 xl:p-5 dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-3 mb-4 dark:border-zinc-800">
            <h3 className="text-sm font-bold uppercase tracking-wide whitespace-nowrap text-gray-900 dark:text-zinc-200">Stock Vitality</h3>
            <TableActions />
          </div>
          
          <div className="space-y-5 flex-1">
            {inventory.slice(0, 6).map(item => (
              <div key={item.id}>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono uppercase">
                  <span className="text-gray-500 dark:text-zinc-500 truncate max-w-[150px]">{item.name}</span>
                  <span className={`${item.stock <= item.reorderLevel ? 'text-red-500 font-bold' : 'text-zinc-900 dark:text-zinc-200'}`}>{item.stock}</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden dark:bg-zinc-800">
                  <div
                    style={{ width: `${Math.min(100, (item.stock / 200) * 100)}%` }}
                    className={`h-full ${item.stock <= item.reorderLevel ? 'bg-red-500' : 'bg-zinc-900 dark:bg-zinc-300'}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-100 dark:bg-zinc-800/50 dark:border-zinc-800 transition-colors duration-300">
             <p className="text-[10px] text-gray-500 font-medium mb-3 uppercase tracking-widest dark:text-zinc-400">Inventory Management</p>
             <div className="flex flex-wrap gap-2">
                <Link to="/inventory" className="flex-1 min-w-[100px] text-center whitespace-nowrap py-2 px-3 bg-zinc-900 hover:bg-zinc-800 rounded text-[10px] font-bold uppercase tracking-wider transition-colors text-white">
                  Restock Now
                </Link>
                <Link to="/analytics" className="flex-1 min-w-[100px] text-center whitespace-nowrap py-2 px-3 bg-gray-200 hover:bg-gray-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors text-gray-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300">
                  Insights
                </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

