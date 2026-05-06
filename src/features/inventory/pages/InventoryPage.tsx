import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit2, AlertTriangle, Package, Check, X, Box, Image as ImageIcon } from 'lucide-react';
import { TableActions } from '../../../shared/components/table/TableActions';
import { InventoryItem } from '../../../shared/types/domain';
import { Modal } from '../../../shared/components/ui/Modal';
import { Tooltip } from '../../../shared/components/ui/Tooltip';
import { useInventory } from '../../inventory/state/InventoryContext';
import { DesignRepository } from '../../designs/components/DesignRepository';

export default function Inventory() {
  const { items, addItem, updateItem, deleteItem } = useInventory();
  const [viewMode, setViewMode] = useState<'inventory' | 'designs'>('inventory');
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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 uppercase tracking-wider font-medium">
            {viewMode === 'inventory' ? 'Manage your raw materials and stock levels' : 'Digital asset library for custom apparel designs'}
          </p>
        </div>

        <div className="inline-flex p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg self-start">
          <button
            onClick={() => setViewMode('inventory')}
            className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
              viewMode === 'inventory' 
              ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-200' 
              : 'text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'
            }`}
          >
            <Box className="w-3.5 h-3.5" /> Stock List
          </button>
          <button
            onClick={() => setViewMode('designs')}
            className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
              viewMode === 'designs' 
              ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-200' 
              : 'text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Design Repo
          </button>
        </div>
      </div>

      <div className="view-container">
        {viewMode === 'inventory' ? (
          <div key="inventory-view" className="space-y-4">
            <div className="flex gap-3 items-center bg-white p-3 md:p-4 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search SKU, material or category..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 bg-gray-50 text-xs focus:outline-none focus:border-slate-700 rounded transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 lg:text-[13px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                <TableActions />
                <button 
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider rounded hover:bg-black shadow-sm ml-0 md:ml-2"
                  id="add-stock-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Stock
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs xl:text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[10px] tracking-wider">SKU</th>
                <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[10px] tracking-wider">Material Description</th>
                <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[10px] tracking-wider text-center">Category</th>
                <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[10px] tracking-wider text-right">Stock</th>
                <th className="py-2.5 px-4 md:px-6 font-bold uppercase text-[10px] tracking-wider text-right">Price</th>
                <th className="py-2.5 px-4 md:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {filteredItems.map((item) => {
                  const isLowStock = item.stock <= item.reorderLevel;
                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-zinc-100/20 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="py-2.5 px-4 md:px-6 font-mono text-gray-400 dark:text-zinc-500">#{item.id.replace('INV-', '')}</td>
                      <td className="py-2.5 px-4 md:px-6 font-semibold text-gray-800 dark:text-zinc-200">{item.name}</td>
                      <td className="py-2.5 px-4 md:px-6 text-gray-500 dark:text-zinc-400 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 md:px-6 font-mono font-medium dark:text-zinc-300 text-right">
                        <span className={isLowStock ? 'text-red-500' : ''}>
                          {item.stock}
                        </span>
                        <span className="text-[9px] text-gray-400 ml-1">PCS</span>
                      </td>
                      <td className="py-2.5 px-4 md:px-6 font-mono dark:text-zinc-300 text-right">₱{item.price.toFixed(2)}</td>
                      <td className="py-2.5 px-4 md:px-6 text-right">
                        <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100">
                          <Tooltip content="Edit Item">
                            <button 
                              onClick={() => handleOpenModal(item)}
                              className="p-1 px-2 hover:bg-zinc-100 text-slate-900 hover:text-slate-800 rounded dark:hover:bg-zinc-800/40"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete Item">
                            <button 
                              onClick={() => handleDeleteInitiate(item)}
                              className="p-1 px-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {filteredItems.length === 0 && (
                <tr>
                   <td colSpan={6} className="py-20 text-center">
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
    </div>
  ) : (
    <div key="designs-view">
      <DesignRepository />
    </div>
  )}
</div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        title={editingItem ? 'Edit Stock Item' : 'Add New Stock'}
        disableAnimation
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Material Name
            </label>
            <input
              required
              type="text"
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-slate-700 transition-colors dark:text-zinc-200"
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
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-slate-700 transition-colors dark:text-zinc-200"
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
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-slate-700 transition-colors dark:text-zinc-200"
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
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-slate-700 transition-colors dark:text-zinc-200"
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
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-slate-700 transition-colors dark:text-zinc-200"
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
              className="flex-1 px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-black shadow-sm transition-colors"
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
        disableAnimation
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

