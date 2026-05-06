import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search, Filter, ArrowRight, Printer, CheckCircle2, Clock, Eye, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';
import { useInventory } from '../../inventory/state/InventoryContext';
import { Modal } from '../../../shared/components/ui/Modal';
import { Order } from '../../../shared/types/domain';

const statusColors: any = {
  'In Production': 'text-slate-800 bg-zinc-100 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700',
  'Pending': 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40',
  'Ready for Pickup': 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40',
  'Designing': 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/40',
  'Completed': 'text-zinc-700 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  'Shipped': 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-900/40',
};

export default function Orders() {
  const { orders, designs, updateOrder } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState(0);

  const filteredOrders = orders.filter(order => 
    order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDesign = (id?: string) => designs.find(d => d.id === id);
  const getOrderLineItems = (order: Order) => {
    if (order.lineItems && order.lineItems.length > 0) return order.lineItems;
    return order.item
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
      .map(name => ({
        name,
        quantity: order.quantity,
        designId: order.designId
      }));
  };

  const selectedOrderLineItems = useMemo(() => {
    if (!selectedOrder) return [];
    return getOrderLineItems(selectedOrder);
  }, [selectedOrder]);

  const activeLineItem = selectedOrderLineItems[selectedLineItemIndex];
  const activeLineItemDesign = getDesign(activeLineItem?.designId || selectedOrder?.designId);

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedLineItemIndex(0);
      return;
    }
    setSelectedLineItemIndex(0);
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedLineItemIndex < selectedOrderLineItems.length) return;
    setSelectedLineItemIndex(0);
  }, [selectedLineItemIndex, selectedOrderLineItems.length]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:gap-4">
         {[
           { label: 'Designing', icon: Eye, count: orders.filter(o => o.status === 'Designing').length, color: 'text-purple-500' },
           { label: 'In Production', icon: Printer, count: orders.filter(o => o.status === 'In Production').length, color: 'text-slate-700' },
           { label: 'Ready', icon: CheckCircle2, count: orders.filter(o => o.status === 'Ready for Pickup').length, color: 'text-green-500' },
           { label: 'Total Active', icon: ClipboardList, count: orders.filter(o => o.status !== 'Completed').length, color: 'text-amber-500' },
         ].map((card) => (
           <div key={card.label} className="bg-white p-3 md:p-4 border border-gray-200 rounded shadow-sm flex items-center justify-between group hover:border-slate-700 transition-all cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-500">
              <div className="flex items-center gap-3">
                 <div className={`p-1.5 md:p-2 bg-gray-50 rounded group-hover:bg-zinc-100 transition-colors dark:bg-zinc-800 dark:group-hover:bg-zinc-800/50 ${card.color}`}>
                    <card.icon className="w-4 h-4 md:w-5 md:h-5" />
                 </div>
                 <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-tight text-gray-600 dark:text-zinc-500">{card.label}</span>
              </div>
              <span className="text-lg md:text-xl font-mono font-bold italic text-gray-900 dark:text-zinc-100">{card.count}</span>
           </div>
         ))}
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
         <div className="p-3 md:p-4 border-b border-gray-100 flex gap-3 bg-gray-50/50 items-center dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
               <input 
                  type="text" 
                  placeholder="Filter active orders / client data..." 
                  className="w-full pl-9 pr-4 py-1.5 md:py-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-slate-700 shadow-inner dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 lg:text-[13px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <TableActions />
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left text-xs xl:text-sm">
              <thead>
                 <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                    <th className="py-2.5 px-5 md:px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Order ID</th>
                    <th className="py-2.5 px-6 md:px-8 font-bold uppercase text-[9px] tracking-[0.2em]">Project / Client</th>
                    <th className="py-2.5 px-6 md:px-8 font-bold uppercase text-[9px] tracking-[0.2em]">Work Phase</th>
                    <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[9px] tracking-[0.2em] text-right">Value</th>
                    <th className="py-2.5 px-6"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                 {filteredOrders.map((order) => (
                   <tr key={order.id} className="hover:bg-zinc-100/20 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <td className="py-2.5 px-5 md:px-6 font-mono text-slate-900 dark:text-zinc-200">#{order.id.length > 10 ? order.id.replace('ORD-', 'PS-').slice(-8) : order.id}</td>
                      <td className="py-2.5 px-5 md:px-6">
                         <div className="flex items-center gap-3">
                            {order.designId && (
                               <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700">
                                  <img src={getDesign(order.designId)?.imageUrl} alt="" className="w-full h-full object-cover" />
                               </div>
                            )}
                            <div>
                               <h3 className="font-bold text-gray-800 dark:text-zinc-200 md:text-sm">{order.customer}</h3>
                               <p className="text-[10px] md:text-[11px] text-gray-400 mt-0.5 dark:text-zinc-500">{order.item} × {order.quantity} units</p>
                            </div>
                         </div>
                      </td>
                      <td className="py-2.5 px-5 md:px-6">
                         <span className={`px-2 py-0.5 border text-[9px] md:text-[10px] font-bold uppercase rounded-full ${statusColors[order.status]}`}>
                            {order.status}
                         </span>
                      </td>
                      <td className="py-2.5 px-4 md:px-6 font-mono font-bold text-right text-gray-900 dark:text-zinc-100 leading-none md:text-sm">
                         ₱{order.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-5 md:px-6 text-right">
                         <button className="p-1.5 md:p-2 bg-gray-50 hover:bg-slate-900 hover:text-white transition-all rounded dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-slate-900 dark:hover:text-white">
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                         </button>
                      </td>
                   </tr>
                 ))}
                 {filteredOrders.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-12 text-center text-gray-400 italic">No matching orders found.</td>
                   </tr>
                 )}
              </tbody>
            </table>
         </div>
         
         <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex justify-center text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:bg-zinc-900/50 dark:border-zinc-800">
            End of Active Dispatch Queue
         </div>
      </div>

      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Production Detail"
        maxWidth="max-w-5xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-zinc-800 pb-4">
              <div>
                <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded-full ${statusColors[selectedOrder.status]} mb-2 inline-block`}>
                  {selectedOrder.status}
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{selectedOrder.customer}</h3>
                <p className="text-xs text-gray-500 font-mono">#{selectedOrder.id}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Date</p>
                <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedOrder.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ClipboardList className="w-3 h-3" /> Job Specifications
                  </h4>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded border border-gray-100 dark:border-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                    <div className="py-2 flex justify-between items-start gap-4 text-xs">
                      <span className="text-gray-500 pt-1">Item</span>
                      <div className="font-bold text-right space-y-1">
                        {selectedOrderLineItems.map((lineItem, index) => (
                          <button
                            key={`${lineItem.name}-${index}`}
                            type="button"
                            onClick={() => setSelectedLineItemIndex(index)}
                            className={`block text-right w-full underline-offset-2 hover:underline transition-colors ${
                              selectedLineItemIndex === index
                                ? 'text-slate-900 dark:text-zinc-200'
                                : 'text-gray-900 dark:text-zinc-200'
                            }`}
                          >
                            {lineItem.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="py-2 flex justify-between text-xs">
                      <span className="text-gray-500">Quantity</span>
                      <span className="font-bold">{selectedOrder.quantity} Units</span>
                    </div>
                    <div className="py-2 flex justify-between text-xs">
                      <span className="text-gray-500">Unit Price</span>
                      <span className="font-bold">₱{(selectedOrder.amount / selectedOrder.quantity).toFixed(2)}</span>
                    </div>
                    <div className="py-2 flex justify-between text-xs pt-2">
                      <span className="text-gray-500 font-bold uppercase">Total Value</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-200">₱{selectedOrder.amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> Production Notes
                    </h4>
                    <div className="bg-zinc-100 dark:bg-zinc-800/30 p-3 rounded border border-zinc-200 dark:border-zinc-700 text-xs text-slate-800 dark:text-zinc-300 italic">
                      "{selectedOrder.notes}"
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> Visual Assets
                  </h4>
                  {activeLineItemDesign ? (
                    <div className="relative aspect-square bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
                      <img 
                        src={activeLineItemDesign?.imageUrl} 
                        alt="Custom Design" 
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-bold text-white uppercase tracking-widest">
                        Ref: {activeLineItem?.designId || selectedOrder.designId}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <ImageIcon className="w-8 h-8 opacity-20" />
                      <p className="text-[10px] uppercase font-bold tracking-widest">No design attached</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Update Work Phase</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.keys(statusColors).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      updateOrder(selectedOrder.id, { status: status as any });
                      setSelectedOrder({ ...selectedOrder, status: status as any });
                    }}
                    className={`px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${
                      selectedOrder.status === status
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 flex gap-3">
              <button className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 transition-all flex items-center justify-center gap-2">
                <Printer className="w-3.5 h-3.5" /> Print Job Ticket
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-2.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-black transition-all dark:bg-white dark:text-black"
              >
                Close View
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

