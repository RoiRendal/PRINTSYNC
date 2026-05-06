import React from 'react';
import { Users, UserPlus, Settings, Shield, Mail, Key, Search } from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';

const users = [
  { id: 1, name: 'Marco Rossi', role: 'System Admin', status: 'Active', email: 'marco@printsync.com', lastActive: '2h ago' },
  { id: 2, name: 'Elena Chen', role: 'Production Lead', status: 'Active', email: 'elena@printsync.com', lastActive: '15m ago' },
  { id: 3, name: 'David Smith', role: 'Print Technician', status: 'On Break', email: 'david@printsync.com', lastActive: '1h ago' },
  { id: 4, name: 'Sofia Garcia', role: 'Sales Executive', status: 'Active', email: 'sofia@printsync.com', lastActive: '5m ago' },
  { id: 5, name: 'Thomas Mueller', role: 'Inventory Manager', status: 'Inactive', email: 'thomas@printsync.com', lastActive: '2 days ago' },
];

export default function UserManagement() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-3 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search staff members..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-100 bg-gray-50 text-xs focus:outline-none focus:border-blue-500 rounded transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          />
        </div>
        <TableActions />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 xl:gap-8">
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1 space-y-5">
           <div className="bg-white border border-gray-200 p-5 rounded shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <h2 className="text-[10px] uppercase font-bold tracking-[0.3em] mb-4 text-gray-800 dark:text-zinc-400">Station Overview</h2>
              {[
                { role: 'Administrators', count: 2, icon: Shield },
                { role: 'Production Techs', count: 8, icon: Settings },
                { role: 'Sales Personnel', count: 6, icon: Mail },
              ].map(role => (
                <div key={role.role} className="flex justify-between items-center p-2.5 bg-gray-50 border border-gray-100 rounded dark:bg-zinc-800 dark:border-zinc-700">
                   <div className="flex items-center gap-2.5">
                      <role.icon className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider dark:text-zinc-300">{role.role}</span>
                   </div>
                   <span className="text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400">{role.count}</span>
                </div>
              ))}
           </div>
                      <div className="bg-white border border-gray-200 p-5 rounded shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <h2 className="text-[10px] uppercase font-bold tracking-[0.3em] mb-4 text-gray-800 dark:text-zinc-400">System Logs</h2>
              <div className="space-y-3">
                 <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-gray-500 uppercase dark:text-zinc-500">Active Sessions</span>
                    <span className="text-blue-600 dark:text-blue-400">14</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-gray-500 uppercase dark:text-zinc-500">Auth Failures</span>
                    <span className="text-red-500 dark:text-red-400">0</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-gray-500 uppercase dark:text-zinc-500">Audit Records</span>
                    <span className="text-gray-700 dark:text-zinc-300">1,248</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
           <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                 <thead>
                    <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                       <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Staff Identity</th>
                       <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">RBAC Role</th>
                       <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Status</th>
                       <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Last Hit</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                         <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                               <div className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center text-[9px] font-bold text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors dark:bg-zinc-800 dark:text-zinc-600 dark:group-hover:bg-blue-900/30">
                                  {user.name.split(' ').map(n => n[0]).join('')}
                               </div>
                               <div>
                                  <p className="text-[11px] font-bold text-gray-800 uppercase leading-none dark:text-zinc-200">{user.name}</p>
                                  <p className="text-[9px] text-gray-400 font-mono mt-1 dark:text-zinc-500">{user.email}</p>
                               </div>
                            </div>
                         </td>
                         <td className="py-3 px-6">
                            <span className="text-[9px] px-2 py-0.5 border border-gray-100 text-gray-500 font-bold uppercase tracking-tighter bg-gray-50 rounded dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                              {user.role}
                            </span>
                         </td>
                         <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                               <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-500' : user.status === 'On Break' ? 'bg-amber-500' : 'bg-gray-300 dark:bg-zinc-700'}`} />
                               <span className="text-[10px] uppercase font-bold text-gray-600 dark:text-zinc-400">{user.status}</span>
                            </div>
                         </td>
                         <td className="py-3 px-6">
                            <span className="text-[10px] font-mono text-gray-400 uppercase dark:text-zinc-500">{user.lastActive}</span>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}

