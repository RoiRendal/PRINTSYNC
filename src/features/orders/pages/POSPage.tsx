import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, Trash2, CreditCard, History, Package, X, CheckCircle2, Edit, FileText, Image as ImageIcon, User, AlertCircle } from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';
import { InventoryItem, CartItem, Transaction, Order } from '../../../shared/types/domain';
import { Modal } from '../../../shared/components/ui/Modal';
import { useFinance } from '../../finance/state/FinanceContext';
import { useInventory } from '../../inventory/state/InventoryContext';

export default function POS() {
  const { addRecord } = useFinance();
  const { items: inventory, updateItem, designs, addOrder } = useInventory();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [posMode, setPosMode] = useState<'retail' | 'custom'>('retail');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Custom Order State
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [currentItemToDesign, setCurrentItemToDesign] = useState<string | null>(null);
  
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
    
    const existing = cart.find(item => item.id === product.id && !item.isCustom);
    if (existing && posMode === 'retail') {
      if (existing.qty >= product.stock) return;
      setCart(cart.map(item => (item.id === product.id && !item.isCustom) ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, isCustom: posMode === 'custom' }]);
    }
  };

  const removeFromCart = (cartIndex: number) => {
    setCart(cart.filter((_, idx) => idx !== cartIndex));
  };

  const updateQty = (cartIndex: number, delta: number) => {
    const item = cart[cartIndex];
    if (!item) return;

    if (item.qty === 1 && delta === -1) {
      removeFromCart(cartIndex);
      return;
    }

    setCart(cart.map((i, idx) => {
      if (idx === cartIndex) {
        const product = inventory.find(inv => inv.id === i.id);
        if (!product) return i;
        
        const newQty = Math.max(1, Math.min(i.qty + delta, product.stock));
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const openDesignSelector = (cartIndex: number) => {
    setCurrentItemToDesign(cartIndex.toString());
    setIsDesignModalOpen(true);
  };

  const selectDesignForItem = (designId: string) => {
    if (currentItemToDesign !== null) {
      const idx = parseInt(currentItemToDesign);
      setCart(cart.map((item, i) => i === idx ? { ...item, designId } : item));
      setIsDesignModalOpen(false);
      setCurrentItemToDesign(null);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.12;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutModalOpen(true);
  };

  const finalizeTransaction = () => {
    if (cart.length === 0) return;
    if (posMode === 'custom' && !customerName) {
      alert('Please enter customer name for custom orders.');
      return;
    }

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const tax = subtotal * 0.12;
    const total = subtotal + tax;

    if (posMode === 'retail') {
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
      cart.forEach(cartItem => {
        const product = inventory.find(i => i.id === cartItem.id);
        if (product) {
          updateItem(product.id, { stock: product.stock - cartItem.qty });
        }
      });

      setTransactions([newTransaction, ...transactions]);

      // Add to Financial Ledger
      addRecord({
        date: new Date().toISOString().split('T')[0],
        type: 'Income',
        category: 'POS Retail',
        description: `Retail Sales: TRX ${newTransaction.id}`,
        amount: total
      });
    } else {
      // Create separate orders for each custom item or one grouped order?
      // Printing services usually track by "job". Let's create one order with multiple lines or multiple orders.
      // For simplicity in the current UI, we'll create one order record that summarizes the items.
      const newOrder: Omit<Order, 'id' | 'date'> = {
        customer: customerName,
        item: cart.map(i => i.name).join(', '),
        lineItems: cart.map(i => ({
          name: i.name,
          quantity: i.qty,
          designId: i.designId
        })),
        quantity: cart.reduce((acc, i) => acc + i.qty, 0),
        amount: total,
        status: 'Designing',
        isCustom: true,
        notes: orderNotes,
        designId: cart[0]?.designId // Taking the first one as primary for the list view
      };

      addOrder(newOrder);

      // Reduce stock of blanks
      cart.forEach(cartItem => {
        const product = inventory.find(i => i.id === cartItem.id);
        if (product) {
          updateItem(product.id, { stock: product.stock - cartItem.qty });
        }
      });

      addRecord({
        date: new Date().toISOString().split('T')[0],
        type: 'Income',
        category: 'Custom Order',
        description: `Downpayment / Order: ${customerName}`,
        amount: total
      });
    }

    setCheckoutSuccess(true);
    setCart([]);
    setCustomerName('');
    setOrderNotes('');
    
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
    <div className="flex flex-col gap-4">
      {/* Header / Tabs */}
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 rounded border border-gray-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <button 
            onClick={() => setView('pos')}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${view === 'pos' ? 'bg-zinc-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Terminal
          </button>
          <button 
            onClick={() => setView('history')}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${view === 'history' ? 'bg-zinc-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase text-gray-400 mr-2">Mode:</span>
            <button 
              onClick={() => {
                setPosMode('retail');
                setCart([]);
              }}
              className={`px-3 py-1 rounded-l border-y border-l transition-all text-[9px] font-bold uppercase tracking-widest ${posMode === 'retail' ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-white border-gray-200 text-gray-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
            >
              Retail
            </button>
            <button 
              onClick={() => {
                setPosMode('custom');
                setCart([]);
              }}
              className={`px-3 py-1 rounded-r border transition-all text-[9px] font-bold uppercase tracking-widest ${posMode === 'custom' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
            >
              Custom
            </button>
        </div>
        <div className="text-[9px] font-mono text-gray-400 uppercase tracking-widest px-4">
          Terminal ID: AIS-POS-01
        </div>
      </div>

      <div className="[&_*]:!transition-none">
      {view === 'pos' ? (
        <div className="flex gap-4">
          {/* Product Selection */}
          <div className="flex-1 space-y-3 flex flex-col min-w-0">
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search blank apparel or materials..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-zinc-400 shadow-sm transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 dark:focus:border-zinc-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all ${
                      activeCategory === cat 
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' 
                        : 'bg-white text-gray-500 border-gray-200 hover:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 xl:gap-3">
              {filteredProducts.map(product => (
                <button 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className={`bg-white border border-gray-200 rounded p-2 text-left hover:border-zinc-500 transition-all group flex flex-col shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-500 ${product.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  <div className="h-28 xl:h-32 bg-gray-50 rounded-sm flex items-center justify-center border border-gray-100 relative overflow-hidden mb-2 dark:bg-zinc-800 dark:border-zinc-700">
                     <div className="flex flex-col items-center text-gray-300 group-hover:text-zinc-600 transition-colors dark:text-zinc-700 dark:group-hover:text-zinc-200">
                        <ShoppingBag className="w-8 h-8 xl:w-10 xl:h-10 stroke-1" />
                        <span className="text-[8px] mt-1 font-mono uppercase tracking-widest">IMG_PENDING</span>
                     </div>
                     <div className="absolute top-1 right-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-mono uppercase ${product.stock <= product.reorderLevel ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'}`}>
                          {product.stock} IN STOCK
                        </span>
                     </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-[11px] xl:text-[12px] uppercase tracking-tight line-clamp-2 text-gray-800 dark:text-zinc-100">{product.name}</h3>
                    <div className="flex justify-between items-center mt-2 group-hover:translate-x-0.5 transition-transform">
                      <p className="text-zinc-900 font-mono text-[10px] xl:text-[11px] font-bold dark:text-zinc-200">₱{product.price.toFixed(2)}</p>
                      <Plus className="w-3 h-3 text-gray-300 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-200" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart / Checkout */}
          <div className="w-80 lg:w-[22rem] xl:w-[23rem] bg-white text-gray-900 rounded-lg shadow-sm flex flex-col border border-gray-200 relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 transition-colors duration-300 sticky top-4 self-start">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                <ShoppingBag className="w-48 h-48" />
             </div>

              <div className="p-4 border-b border-gray-100 flex justify-between items-center z-10 dark:border-zinc-800">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-800 dark:text-zinc-200">
                  {posMode === 'retail' ? 'Transaction Cart' : 'Custom Order Builder'}
                </h2>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${posMode === 'retail' ? 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-600/20 dark:text-indigo-400'}`}>
                  {cart.length} ITEMS
                </span>
             </div>

             <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2.5 z-10 scrollbar-hide">
                {posMode === 'custom' && (
                  <div className="space-y-3 mb-4 bg-indigo-50/50 p-3 rounded-md border border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-indigo-500">Client Name</label>
                        <div className="relative">
                           <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400" />
                           <input 
                              type="text" 
                              placeholder="Required for custom orders..."
                              className="w-full pl-7 pr-3 py-1.5 bg-white border border-indigo-200 rounded text-[10px] focus:outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:border-zinc-700"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                           />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-indigo-500">Production Notes</label>
                        <div className="relative">
                           <FileText className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400" />
                           <input 
                              type="text" 
                              placeholder="Sizing, placement, deadline..."
                              className="w-full pl-7 pr-3 py-1.5 bg-white border border-indigo-200 rounded text-[10px] focus:outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:border-zinc-700"
                              value={orderNotes}
                              onChange={(e) => setOrderNotes(e.target.value)}
                           />
                        </div>
                     </div>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-3 p-10 text-center">
                     <ShoppingBag className="w-6 h-6 mx-auto" />
                     <p className="text-[9px] uppercase tracking-widest font-mono italic">Build list to proceed</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className={`flex flex-col gap-2 p-2 rounded-sm border transition-all ${posMode === 'custom' ? 'bg-white border-indigo-100 hover:border-indigo-300 dark:bg-zinc-800/40 dark:border-indigo-900/30' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 dark:bg-zinc-800/40 dark:border-zinc-800'}`}>
                       <div className="flex gap-3">
                          <div className="w-10 h-10 bg-gray-200 flex-shrink-0 rounded-sm dark:bg-zinc-800 overflow-hidden">
                             {item.designId && <img src={designs.find(d => d.id === item.designId)?.imageUrl} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 flex flex-col min-w-0">
                             <div className="flex justify-between items-start gap-2">
                                <span className="text-[10px] font-bold uppercase truncate leading-tight text-gray-900 dark:text-zinc-100">{item.name}</span>
                                <button onClick={() => removeFromCart(idx)} className="text-gray-400 hover:text-red-500">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                             </div>
                             <div className="flex justify-between items-end mt-1">
                                <div className="flex bg-gray-200 rounded overflow-hidden dark:bg-zinc-900">
                                   <button onClick={() => updateQty(idx, -1)} className="p-1 hover:bg-gray-300 transition-colors dark:hover:bg-zinc-700"><Minus className="w-2.5 h-2.5" /></button>
                                   <span className="w-6 text-center text-[10px] font-mono py-1 select-none">{item.qty}</span>
                                   <button onClick={() => updateQty(idx, 1)} className="p-1 hover:bg-gray-300 transition-colors dark:hover:bg-zinc-700"><Plus className="w-2.5 h-2.5" /></button>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-900 dark:text-zinc-200">₱{(item.price * item.qty).toFixed(2)}</span>
                             </div>
                          </div>
                       </div>
                       {posMode === 'custom' && (
                         <div className="pt-2 mt-1 border-t border-indigo-50 dark:border-zinc-700 flex gap-2">
                            <button 
                              onClick={() => openDesignSelector(idx)}
                              className={`flex-1 py-1 px-2 rounded text-[8px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${item.designId ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'}`}
                            >
                               {item.designId ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Edit className="w-2.5 h-2.5" />}
                               {item.designId ? 'Change Design' : 'Select Design'}
                            </button>
                            {item.designId && (
                               <div className="px-2 py-1 bg-gray-100 dark:bg-zinc-900 rounded text-[7px] font-mono flex items-center max-w-[100px] truncate">
                                  {designs.find(d => d.id === item.designId)?.name}
                               </div>
                            )}
                         </div>
                       )}
                    </div>
                  ))
                )}
             </div>

             <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3 z-10 shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="space-y-1.5">
                   <div className="flex justify-between text-[10px] font-mono text-gray-500 dark:text-zinc-500">
                      <span className="font-bold">SUBTOTAL</span>
                      <span className="text-gray-900 dark:text-zinc-300">₱{subtotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-mono text-gray-500 dark:text-zinc-500">
                      <span className="font-bold">VAT (12%)</span>
                      <span className="text-gray-900 dark:text-zinc-300">₱{tax.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-xl font-bold tracking-tight text-gray-900 border-t border-gray-200 pt-2 mt-1 dark:border-zinc-800 dark:text-zinc-100">
                      <span>{posMode === 'retail' ? 'TOTAL' : 'ORDER VAL'}</span>
                      <span className={`font-mono ${posMode === 'retail' ? 'text-zinc-900 dark:text-zinc-200' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        ₱{total.toFixed(2)}
                      </span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                   <button onClick={() => setCart([])} className="py-2.5 bg-gray-200 hover:bg-gray-300 text-[10px] font-bold uppercase tracking-widest rounded transition-all text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300">
                      Reset
                   </button>
                   <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || (posMode === 'custom' && !customerName)}
                    className={`py-2.5 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${posMode === 'retail' ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20'}`}
                   >
                      <CreditCard className="w-3 h-3" /> {posMode === 'retail' ? 'Quick Pay' : 'Create Order'}
                   </button>
                </div>
                {posMode === 'custom' && !customerName && cart.length > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-500 text-[8px] font-bold uppercase justify-center italic">
                    <AlertCircle className="w-2.5 h-2.5" /> Client Name Required
                  </div>
                )}
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
                  className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded text-[10px] focus:outline-none focus:border-zinc-400 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                />
              </div>
            </div>
            <TableActions />
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
                {filteredTransactions.map((trx) => (
                    <tr
                      key={trx.id}
                      className="hover:bg-zinc-100/20 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
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
                      <td className="py-3 px-6 font-mono font-bold text-right text-zinc-900 dark:text-zinc-200">
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
                    </tr>
                  ))}
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
      </div>

      <Modal 
        isOpen={!!selectedTransaction} 
        onClose={() => setSelectedTransaction(null)} 
        title="Transaction Details"
        maxWidth="max-w-sm"
      >
        {selectedTransaction && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div className="space-y-0.5">
                <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Reference ID</p>
                <p className="text-[10px] font-mono font-bold">#{selectedTransaction.id}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Date & Time</p>
                <p className="text-[9px] font-medium">{selectedTransaction.date}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[7px] font-bold uppercase tracking-widest text-gray-500">Items Purchased</p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
                {selectedTransaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[9px] bg-gray-50 dark:bg-zinc-800/50 p-1.5 rounded">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-gray-800 dark:text-zinc-200 truncate">{item.name}</p>
                      <p className="text-[7px] text-gray-500">{item.qty} x ₱{item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-mono font-bold shrink-0">₱{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-1">
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>Subtotal</span>
                <span className="font-mono">₱{selectedTransaction.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>VAT (12%)</span>
                <span className="font-mono">₱{selectedTransaction.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-50 dark:border-zinc-800 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-widest">Total Amount</span>
                <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-200">₱{selectedTransaction.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800/30 p-1.5 rounded mt-1.5">
                <span className="text-[7px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Payment</span>
                <span className="text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-zinc-900 text-white rounded">{selectedTransaction.paymentMethod}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTransaction(null)}
              className="w-full py-1.5 bg-zinc-900 dark:bg-white dark:text-zinc-950 text-white text-[9px] font-bold uppercase tracking-widest rounded transition-all hover:bg-zinc-800 dark:hover:bg-gray-200 mt-1"
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* Design Selector Modal */}
      <Modal 
        isOpen={isDesignModalOpen} 
        onClose={() => setIsDesignModalOpen(false)} 
        title="Select Design Template"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
            {designs.map(design => (
              <button 
                key={design.id}
                onClick={() => selectDesignForItem(design.id)}
                className="group border border-gray-200 rounded overflow-hidden hover:border-indigo-500 transition-all text-left bg-white dark:bg-zinc-800 dark:border-zinc-700"
              >
                <div className="aspect-square bg-gray-100 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
                   <img src={design.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div className="p-2">
                   <p className="text-[10px] font-bold uppercase truncate dark:text-zinc-200">{design.name}</p>
                   <p className="text-[8px] text-gray-500 uppercase tracking-widest">{design.category}</p>
                </div>
              </button>
            ))}
          </div>
          {designs.length === 0 && (
            <div className="py-20 text-center text-gray-400">
               <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-10" />
               <p className="text-xs uppercase font-bold tracking-widest italic">No designs found in repository</p>
            </div>
          )}
        </div>
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
                      className={`py-3 rounded border font-bold text-xs uppercase tracking-widest transition-all ${paymentMethod === 'Cash' ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'}`}
                    >
                      Cash
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('Card')}
                      className={`py-3 rounded border font-bold text-xs uppercase tracking-widest transition-all ${paymentMethod === 'Card' ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'}`}
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
                  className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 shadow-sm transition-colors flex items-center justify-center gap-2"
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

