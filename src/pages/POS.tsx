import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, Trash2, CreditCard, History, Package, X, CheckCircle2 } from 'lucide-react';
import { MOCK_INVENTORY } from '../constants';
import { TableActions } from '../components/common/TableActions';
import { InventoryItem, CartItem, Transaction } from '../types';
import { Modal } from '../components/common/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { useFinance } from '../context/FinanceContext';

export default function POS() {
  const { addRecord } = useFinance();
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const categories = ['All', ...new Set(inventory.map(item => item.category))];

  const filteredProducts = useMemo(() => {
    return inventory.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, activeCategory]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => 
      trx.id.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      trx.items.some(item => item.name.toLowerCase().includes(historySearchTerm.toLowerCase()))
    );
  }, [transactions, historySearchTerm]);

  const addToCart = (product: InventoryItem) => {
    if (product.stock <= 0) return;
    
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock) return;
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    if (item.qty === 1 && delta === -1) {
      removeFromCart(id);
      return;
    }

    setCart(cart.map(i => {
      if (i.id === id) {
        const product = inventory.find(inv => inv.id === id);
        if (!product) return i;
        
        const newQty = Math.max(1, Math.min(i.qty + delta, product.stock));
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.12;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutModalOpen(true);
  };

  const finalizeTransaction = () => {
    const newTransaction: Transaction = {
      id: `TRX-${Date.now()}`,
      date: new Date().toLocaleString(),
      items: [...cart],
      subtotal,
      tax,
      total,
      paymentMethod
    };

    // Reduce stock
    setInventory(prev => prev.map(item => {
      const cartItem = cart.find(c => c.id === item.id);
      if (cartItem) {
        return { ...item, stock: item.stock - cartItem.qty };
      }
      return item;
    }));

    setTransactions([newTransaction, ...transactions]);

    // Add to Financial Ledger
    addRecord({
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: 'POS Sale',
      description: `Sales from Transaction ${newTransaction.id} (${cart.length} items)`,
      amount: total
    });

    setCheckoutSuccess(true);
    setCart([]);
    
    setTimeout(() => {
      setIsCheckoutModalOpen(false);
      setCheckoutSuccess(false);
    }, 2000);
  };

  const voidTransaction = (id: string) => {
    if (window.confirm('Void this transaction? (Stock will not be automatically restored in this demo)')) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  return (
    <div className="h-full flex flex-col gap-5 overflow-hidden">
      {/* Header / Tabs */}
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 rounded border border-gray-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <button 
            onClick={() => setView('pos')}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'pos' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Point of Sale
          </button>
          <button 
            onClick={() => setView('history')}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <History className="w-3.5 h-3.5" /> Transaction History
          </button>
        </div>
        <div className="text-[9px] font-mono text-gray-400 uppercase tracking-widest px-4">
          Terminal ID: AIS-POS-01
        </div>
      </div>

      {view === 'pos' ? (
        <div className="flex-1 flex gap-5 overflow-hidden">
          {/* Product Selection */}
          <div className="flex-1 space-y-4 flex flex-col min-w-0">
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search blank apparel or materials..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500 shadow-sm transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 dark:focus:border-blue-700"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <TableActions exportLabel="Export CSV" />
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all ${
                      activeCategory === cat 
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' 
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <button 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={`bg-white border border-gray-200 rounded p-2 text-left hover:border-blue-500 transition-all group flex flex-col shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-700 ${product.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                  >
                    <div className="h-32 bg-gray-50 rounded-sm flex items-center justify-center border border-gray-100 relative overflow-hidden mb-2 dark:bg-zinc-800 dark:border-zinc-700">
                       <div className="flex flex-col items-center text-gray-300 group-hover:text-blue-500 transition-colors dark:text-zinc-700 dark:group-hover:text-blue-400">
                          <ShoppingBag className="w-8 h-8 stroke-1" />
                          <span className="text-[8px] mt-1 font-mono uppercase tracking-widest">IMG_PENDING</span>
                       </div>
                       <div className="absolute top-1 right-1">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-mono uppercase ${product.stock <= product.reorderLevel ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
                            {product.stock} IN STOCK
                          </span>
                       </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-[11px] uppercase tracking-tight line-clamp-2 text-gray-800 dark:text-zinc-100">{product.name}</h3>
                      <div className="flex justify-between items-center mt-2 group-hover:translate-x-0.5 transition-transform">
                        <p className="text-blue-600 font-mono text-[10px] font-bold dark:text-blue-400">₱{product.price.toFixed(2)}</p>
                        <Plus className="w-3 h-3 text-gray-300 group-hover:text-blue-500 dark:text-zinc-600 dark:group-hover:text-blue-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart / Checkout */}
          <div className="w-80 bg-slate-900 text-white rounded-lg shadow-xl flex flex-col h-full border border-slate-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                <ShoppingBag className="w-48 h-48" />
             </div>

             <div className="p-4 border-b border-slate-800 flex justify-between items-center z-10">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Transaction Cart</h2>
                <span className="text-[9px] font-mono bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded">{cart.length} ITEMS</span>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10 scrollbar-hide">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-3 p-10 text-center">
                     <ShoppingBag className="w-6 h-6 mx-auto" />
                     <p className="text-[9px] uppercase tracking-widest font-mono">Cart holds no items</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-3 bg-slate-800/40 p-2 rounded-sm border border-slate-800 group transition-all hover:bg-slate-800/60">
                       <div className="w-10 h-10 bg-slate-800 flex-shrink-0 rounded-sm" />
                       <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex justify-between items-start gap-2">
                             <span className="text-[10px] font-bold uppercase truncate leading-tight">{item.name}</span>
                             <button onClick={() => removeFromCart(item.id)} className="text-slate-600 hover:text-red-400">
                               <Trash2 className="w-3 h-3" />
                             </button>
                          </div>
                          <div className="flex justify-between items-end mt-2">
                             <div className="flex bg-slate-900 rounded overflow-hidden">
                                <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-700 hover:text-white transition-colors text-slate-500"><Minus className="w-2.5 h-2.5" /></button>
                                <span className="w-6 text-center text-[10px] font-mono py-1 select-none">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-700 hover:text-white transition-colors text-slate-500"><Plus className="w-2.5 h-2.5" /></button>
                             </div>
                             <span className="text-[10px] font-mono text-blue-400">₱{(item.price * item.qty).toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                  ))
                )}
             </div>

             <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 z-10 shrink-0">
                <div className="space-y-1.5">
                   <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span className="font-bold">SUBTOTAL</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span className="font-bold">VAT (12%)</span>
                      <span>₱{tax.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-xl font-bold tracking-tight text-white border-t border-slate-800 pt-2 mt-1">
                      <span>TOTAL</span>
                      <span className="font-mono text-blue-400">₱{total.toFixed(2)}</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                   <button onClick={() => setCart([])} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase tracking-widest rounded transition-all">
                      Empty
                   </button>
                   <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <CreditCard className="w-3 h-3" /> Pay Now
                   </button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">Transaction History</h2>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter by ID or item..."
                  className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded text-[10px] focus:outline-none focus:border-blue-500 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                />
              </div>
            </div>
            <TableActions exportLabel="Export History" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Ref ID</th>
                  <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Date</th>
                  <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Items</th>
                  <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em]">Method</th>
                  <th className="py-2.5 px-6 font-bold uppercase text-[9px] tracking-[0.2em] text-right">Total</th>
                  <th className="py-2.5 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                <AnimatePresence initial={false}>
                  {filteredTransactions.map((trx) => (
                    <motion.tr 
                      key={trx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTransaction(trx)}
                    >
                      <td className="py-3 px-6 font-mono text-gray-400 dark:text-zinc-500">#{trx.id.replace('TRX-', '').slice(-8)}</td>
                      <td className="py-3 px-6 font-mono text-gray-600 dark:text-zinc-400">{trx.date}</td>
                      <td className="py-3 px-6">
                        <span className="text-gray-800 dark:text-zinc-200">{trx.items.reduce((acc, curr) => acc + curr.qty, 0)} Units</span>
                        <div className="text-[9px] text-gray-400 dark:text-zinc-500 truncate max-w-[200px]">
                          {trx.items.map(i => i.name).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded font-bold text-[9px] uppercase tracking-wider">
                          {trx.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-mono font-bold text-right text-blue-600 dark:text-blue-400">
                        ₱{trx.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              voidTransaction(trx.id);
                            }}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            title="Void"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400 opacity-30">
                        <History className="w-8 h-8" />
                        <p className="text-[10px] uppercase tracking-widest font-bold">
                          {historySearchTerm ? 'No transactions match filters' : 'No history recorded'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal 
        isOpen={!!selectedTransaction} 
        onClose={() => setSelectedTransaction(null)} 
        title="Transaction Details"
      >
        {selectedTransaction && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Reference ID</p>
                <p className="text-xs font-mono font-bold">#{selectedTransaction.id}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Date & Time</p>
                <p className="text-[10px] font-medium">{selectedTransaction.date}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Items Purchased</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                {selectedTransaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] bg-gray-50 dark:bg-zinc-800/50 p-2 rounded">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-gray-800 dark:text-zinc-200 truncate">{item.name}</p>
                      <p className="text-[8px] text-gray-500">{item.qty} x ₱{item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-mono font-bold shrink-0">₱{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-1.5">
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Subtotal</span>
                <span className="font-mono">₱{selectedTransaction.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>VAT (12%)</span>
                <span className="font-mono">₱{selectedTransaction.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-50 dark:border-zinc-800 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest">Total Amount</span>
                <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">₱{selectedTransaction.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-2 rounded mt-2">
                <span className="text-[8px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">Payment</span>
                <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 bg-blue-600 text-white rounded">{selectedTransaction.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTransaction(null)}
              className="w-full py-2 bg-slate-900 dark:bg-white dark:text-black text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all hover:bg-slate-800 dark:hover:bg-gray-200 mt-2"
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* Checkout Modal */}
      <Modal isOpen={isCheckoutModalOpen} onClose={() => !checkoutSuccess && setIsCheckoutModalOpen(false)} title="Process Checkout">
        <div className="space-y-6">
          {checkoutSuccess ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Transaction Successful</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Inventory updated and record saved.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-gray-500 dark:text-zinc-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Amount to Pay</span>
                  <span className="text-xl font-bold font-mono text-gray-900 dark:text-zinc-100">₱{total.toFixed(2)}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('Cash')}
                      className={`py-3 rounded border font-bold text-xs uppercase tracking-widest transition-all ${paymentMethod === 'Cash' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-zinc-900' : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'}`}
                    >
                      Cash
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('Card')}
                      className={`py-3 rounded border font-bold text-xs uppercase tracking-widest transition-all ${paymentMethod === 'Card' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-zinc-900' : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'}`}
                    >
                      Card
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-[10px]">
                    <span className="text-gray-500 uppercase font-medium">{item.qty}x {item.name}</span>
                    <span className="font-mono text-gray-900 dark:text-zinc-300">₱{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={finalizeTransaction}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  Confirm & Pay
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
