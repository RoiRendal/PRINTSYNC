import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit2, AlertTriangle, Package, Check, X } from 'lucide-react';
import { TableActions } from '../components/common/TableActions';
import { InventoryItem } from '../types';
import { Modal } from '../components/common/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';

export default function Inventory() {
  const { items, addItem, updateItem, deleteItem } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    category: '',
    stock: 0,
    reorderLevel: 10,
    price: 0,
  });

  const filteredItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        stock: item.stock,
        reorderLevel: item.reorderLevel,
        price: item.price,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: '',
        stock: 0,
        reorderLevel: 10,
        price: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateItem(editingItem.id, formData);
    } else {
      addItem(formData);
    }
    handleCloseModal();
  };

  const handleDeleteInitiate = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete.id);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-4 items-center bg-white p-3 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search SKU, material or category..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-100 bg-gray-50 text-xs focus:outline-none focus:border-blue-500 rounded transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <TableActions exportLabel="Export Inventory" />
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider rounded hover:bg-blue-700 shadow-sm transition-all ml-2"
            id="add-stock-btn"
          >
            <Plus className="w-3.5 h-3.5" /> Add Stock
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider">SKU</th>
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider">Material Description</th>
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider">Category</th>
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider text-right">Stock</th>
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider text-right">Price</th>
                <th className="py-2.5 px-4 font-bold uppercase text-[10px] tracking-wider">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              <AnimatePresence initial={false}>
                {filteredItems.map((item) => {
                  const isLowStock = item.stock <= item.reorderLevel;
                  return (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono text-gray-400 dark:text-zinc-500">#{item.id.replace('INV-', '')}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800 dark:text-zinc-200">{item.name}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-zinc-400">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium dark:text-zinc-300 text-right">
                        <span className={isLowStock ? 'text-red-500' : ''}>
                          {item.stock}
                        </span>
                        <span className="text-[9px] text-gray-400 ml-1">PCS</span>
                      </td>
                      <td className="py-3 px-4 font-mono dark:text-zinc-300 text-right">₱{item.price.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        {isLowStock ? (
                          <span className="flex items-center w-fit gap-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                            <AlertTriangle className="w-2.5 h-2.5" /> Low Stock
                          </span>
                        ) : (
                          <span className="flex items-center w-fit gap-1 text-[9px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded uppercase dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
                            <Check className="w-2.5 h-2.5" /> Optimized
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(item)}
                            className="p-1 px-2 hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded dark:hover:bg-blue-900/20"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteInitiate(item)}
                            className="p-1 px-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Package className="w-8 h-8 opacity-20" />
                      <p className="text-[10px] uppercase tracking-widest font-bold">No stock items found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center p-3 text-[10px] text-gray-500 uppercase tracking-widest font-medium dark:text-zinc-500">
        <span>Displaying {filteredItems.length} of {items.length} items</span>
        <div className="flex gap-4">
           <span className="font-bold opacity-30 tracking-normal italic">PRINTSYNC CLOUD SECURE SYNCED</span>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        title={editingItem ? 'Edit Stock Item' : 'Add New Stock'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Material Name
            </label>
            <input
              required
              type="text"
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-blue-500 transition-colors dark:text-zinc-200"
              placeholder="e.g. Premium Cotton T-shirt (Black)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Category
            </label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-blue-500 transition-colors dark:text-zinc-200"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="">Select Category</option>
              <option value="Apparel">Apparel</option>
              <option value="Outerwear">Outerwear</option>
              <option value="Accessories">Accessories</option>
              <option value="Consumables">Consumables</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Current Stock
              </label>
              <input
                required
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-blue-500 transition-colors dark:text-zinc-200"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Reorder Level
              </label>
              <input
                required
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-blue-500 transition-colors dark:text-zinc-200"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Unit Price (₱)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-blue-500 transition-colors dark:text-zinc-200"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 shadow-sm transition-colors"
            >
              {editingItem ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <p className="text-xs font-medium">
              Are you sure you want to delete <span className="font-bold">{itemToDelete?.name}</span>? This action cannot be undone.
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
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
