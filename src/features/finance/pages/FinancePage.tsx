import React, { useState } from 'react';
import { 
  Printer, 
  Trash2,
  Edit2,
  Plus,
  Search,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Modal } from '../../../shared/components/ui/Modal';
import { Tooltip as MyTooltip } from '../../../shared/components/ui/Tooltip';
import { FinancialReport } from '../components/FinancialReport';
import { FinancialRecord } from '../../../shared/types/domain';
import { useFinance } from '../../finance/state/FinanceContext';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';

export default function Finance() {
  const { businessDisplayName } = useBusinessBranding();
  const { records, stats, addRecord, updateRecord, deleteRecord } = useFinance();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Income' as 'Income' | 'Expense',
    category: '',
    description: '',
    amount: ''
  });

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.amount || !formData.description) return;

    addRecord({
      date: formData.date,
      type: formData.type,
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount)
    });

    setIsAddOpen(false);
    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: '',
      description: '',
      amount: ''
    });
  };

  const handleEditInitiate = (record: FinancialRecord) => {
    setEditingId(record.id);
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      description: record.description,
      amount: record.amount.toString()
    });
    setIsEditOpen(true);
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.category || !formData.amount || !formData.description) return;

    updateRecord(editingId, {
      date: formData.date,
      type: formData.type,
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount)
    });

    setIsEditOpen(false);
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: '',
      description: '',
      amount: ''
    });
  };

  const handleDeleteInitiate = (record: FinancialRecord) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      deleteRecord(recordToDelete.id);
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
    }
  };

  const filteredRecords = records.filter(r => 
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-400">Financial Terminal</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold italic serif tracking-tight text-gray-900 dark:text-zinc-100">Fiscal Records</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsAddOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white dark:text-zinc-950 text-white text-[10px] uppercase font-bold tracking-widest rounded transition-all hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </button>
          <button 
            onClick={() => setIsReportOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-black dark:border-zinc-700 text-black dark:text-zinc-300 text-[10px] uppercase font-bold tracking-widest rounded transition-all hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            <Printer className="w-3.5 h-3.5" />
            Generate Statement
          </button>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-gray-800 flex items-center gap-2 dark:text-zinc-200">
            <Receipt className="w-4 h-4 text-zinc-900" />
            Transaction Ledger
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search Ledger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded text-xs focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800 uppercase text-[10px] font-bold tracking-wider text-gray-400">
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[10px] text-gray-500">{record.id}</td>
                  <td className="px-6 py-4 text-xs font-medium dark:text-zinc-300">{record.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-[9px] font-bold uppercase text-gray-600 dark:text-zinc-400">
                      {record.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 dark:text-zinc-400">{record.description}</td>
                  <td className={`px-6 py-4 text-right font-mono font-bold text-xs ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {record.type === 'Income' ? '+' : '-'}₱{record.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <MyTooltip content="Modify Record">
                        <button 
                          onClick={() => handleEditInitiate(record)}
                          className="p-1.5 text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </MyTooltip>
                      <MyTooltip content="Delete Record">
                        <button 
                          onClick={() => handleDeleteInitiate(record)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </MyTooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Modal */}
      <Modal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        title="Professional Fiscal Report"
        maxWidth="max-w-6xl"
      >
        <div className="max-h-[80vh] overflow-y-auto">
          <FinancialReport 
            records={records} 
            stats={stats} 
            businessName={businessDisplayName} 
          />
        </div>
      </Modal>

      {/* Add Record Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register New Transaction"
        maxWidth="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleAddRecord}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Date</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Type</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Income' | 'Expense' })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs uppercase font-bold"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Category</label>
              <input 
                type="text" 
                placeholder="Material, Rent..." 
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Amount (PHP)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs font-mono font-bold" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Description</label>
            <textarea 
              placeholder="Transaction details..." 
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs h-16 resize-none" 
            />
          </div>
          
          <button 
            type="submit"
            className="w-full py-3 mt-2 bg-zinc-900 dark:bg-white dark:text-zinc-950 text-white text-[10px] uppercase font-bold tracking-widest rounded transition-all hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98]"
          >
            Authorize Entry
          </button>
        </form>
      </Modal>

      {/* Edit Record Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingId(null);
        }}
        title="Edit Transaction Entry"
        maxWidth="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleUpdateRecord}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Date</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Type</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Income' | 'Expense' })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs uppercase font-bold"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Category</label>
              <input 
                type="text" 
                placeholder="Material, Rent..." 
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Amount (PHP)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs font-mono font-bold" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Description</label>
            <textarea 
              placeholder="Transaction details..." 
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-xs h-16 resize-none" 
            />
          </div>
          
          <button 
            type="submit"
            className="w-full py-3 mt-2 bg-zinc-900 dark:bg-white dark:text-zinc-950 text-white text-[10px] uppercase font-bold tracking-widest rounded transition-all hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98]"
          >
            Confirm Changes
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Remove Transaction"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg">
            <TrendingUp className="w-6 h-6 flex-shrink-0 rotate-180" />
            <p className="text-xs font-medium">
              Are you sure you want to remove this <span className="font-bold underline">{recordToDelete?.category}</span> entry for <span className="font-bold">₱{recordToDelete?.amount.toLocaleString()}</span>? This will affect your balance.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 rounded shadow-sm transition-colors"
            >
              Confirm Removal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


