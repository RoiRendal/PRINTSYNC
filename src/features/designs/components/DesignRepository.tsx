import React, { useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Tag, Calendar, Download, Eye, Edit } from 'lucide-react';
import { useInventory } from '../../inventory/state/InventoryContext';
import { DEFAULT_NEW_DESIGN_IMAGE_URL } from '../../../shared/constants/designImages';
import { Modal } from '../../../shared/components/ui/Modal';

export function DesignRepository() {
  const { designs, addDesign, deleteDesign, updateDesign } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [designToDelete, setDesignToDelete] = useState<Design | null>(null);
  
  const [newDesign, setNewDesign] = useState<Omit<Design, 'id' | 'createdAt'>>({
    name: '',
    category: '',
    imageUrl: '',
    tags: []
  });

  const [editDesignData, setEditDesignData] = useState<Design | null>(null);
  
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');

  const filteredDesigns = designs.filter(design => 
    design.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesign.imageUrl) {
      newDesign.imageUrl = DEFAULT_NEW_DESIGN_IMAGE_URL;
    }
    addDesign(newDesign);
    setNewDesign({ name: '', category: '', imageUrl: '', tags: [] });
    setIsAddModalOpen(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      setNewDesign(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewDesign(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const openViewModal = (design: Design) => {
    setSelectedDesign(design);
    setIsViewModalOpen(true);
  };

  const openEditModal = (design: Design) => {
    setEditDesignData({ ...design });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editDesignData) {
      updateDesign(editDesignData.id, {
        name: editDesignData.name,
        category: editDesignData.category,
        imageUrl: editDesignData.imageUrl,
        tags: editDesignData.tags
      });
      setIsEditModalOpen(false);
      setEditDesignData(null);
    }
  };

  const handleEditAddTag = () => {
    if (editTagInput.trim() && editDesignData) {
      setEditDesignData(prev => prev ? ({
        ...prev,
        tags: [...prev.tags, editTagInput.trim()]
      }) : null);
      setEditTagInput('');
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    if (editDesignData) {
      setEditDesignData(prev => prev ? ({
        ...prev,
        tags: prev.tags.filter(tag => tag !== tagToRemove)
      }) : null);
    }
  };

  const confirmDelete = (design: Design) => {
    setDesignToDelete(design);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (designToDelete) {
      deleteDesign(designToDelete.id);
      setIsDeleteConfirmOpen(false);
      setDesignToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="w-full md:max-w-md relative">
          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search designs by name, category or tag..."
            className="w-full pl-10 pr-4 py-2 border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-zinc-400 rounded transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider rounded hover:bg-zinc-800 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Upload Design
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredDesigns.map((design) => (
            <div
              key={design.id}
              className="group bg-white border border-gray-200 rounded overflow-hidden shadow-sm hover:shadow-md dark:bg-zinc-900 dark:border-zinc-800"
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <img 
                  src={design.imageUrl} 
                  alt={design.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => openViewModal(design)}
                    className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                    title="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button 
                    className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                    title="Download design"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest rounded">
                  {design.category}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200">{design.name}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-2.5 h-2.5" /> Added on {design.createdAt}
                    </p>
                  </div>
                  <div className="flex gap-1 items-start">
                    <button 
                      onClick={() => openEditModal(design)}
                      className="p-1.5 text-gray-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 rounded transition-colors"
                      title="Edit design"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => confirmDelete(design)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-colors"
                      title="Delete design"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {design.tags.map(tag => (
                    <span 
                      key={tag} 
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full dark:bg-zinc-800 dark:text-zinc-400 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>

      {filteredDesigns.length === 0 && (
        <div className="py-24 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <ImageIcon className="w-12 h-12 opacity-15" />
            <div className="space-y-1">
              <p className="text-sm font-bold uppercase tracking-widest">No designs found</p>
              <p className="text-xs">Try adjusting your search or upload a new design.</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Upload New Design"
        disableAnimation
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Design Name
            </label>
            <input
              required
              type="text"
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
              placeholder="e.g. Modern Minimalist Logo"
              value={newDesign.name}
              onChange={(e) => setNewDesign({ ...newDesign, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Category
            </label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
              value={newDesign.category}
              onChange={(e) => setNewDesign({ ...newDesign, category: e.target.value })}
            >
              <option value="">Select Category</option>
              <option value="Logo">Logo</option>
              <option value="Abstract">Abstract</option>
              <option value="Typography">Typography</option>
              <option value="Graphic">Graphic</option>
              <option value="Pattern">Pattern</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Image URL (Optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
              placeholder="https://images.unsplash.com/..."
              value={newDesign.imageUrl}
              onChange={(e) => setNewDesign({ ...newDesign, imageUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block">
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <button 
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-950 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {newDesign.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-zinc-100 text-zinc-900 text-[10px] font-medium rounded flex items-center gap-1 dark:bg-zinc-800/40 dark:text-zinc-200">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-zinc-800">
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 shadow-sm transition-colors"
            >
              Upload Design
            </button>
          </div>
        </form>
      </Modal>

      {/* View Detail Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedDesign?.name || 'Design View'}
        maxWidth="max-w-2xl"
        disableAnimation
      >
        {selectedDesign && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
              <img src={selectedDesign.imageUrl} alt={selectedDesign.name} className="w-full h-full object-contain" />
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Design Information</h4>
                <p className="text-xl font-bold text-gray-800 dark:text-zinc-100">{selectedDesign.name}</p>
                <div className="inline-block mt-2 px-2 py-1 bg-zinc-100 text-zinc-900 text-[10px] font-bold uppercase tracking-widest rounded dark:bg-zinc-800/40 dark:text-zinc-200">
                  {selectedDesign.category}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Metadata</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 italic">Reference ID</p>
                    <p className="text-sm font-mono text-gray-800 dark:text-zinc-300 font-bold">#{selectedDesign.id}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 italic">Created Date</p>
                    <p className="text-sm text-gray-800 dark:text-zinc-300 font-bold">{selectedDesign.createdAt}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tags</h4>
                <div className="flex flex-wrap gap-1">
                   {selectedDesign.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors rounded">
                  <Download className="w-4 h-4" /> Download Assets
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Edit Design"
        disableAnimation
      >
        {editDesignData && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Design Name
              </label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
                value={editDesignData.name}
                onChange={(e) => setEditDesignData({ ...editDesignData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Category
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
                value={editDesignData.category}
                onChange={(e) => setEditDesignData({ ...editDesignData, category: e.target.value })}
              >
                <option value="">Select Category</option>
                <option value="Logo">Logo</option>
                <option value="Abstract">Abstract</option>
                <option value="Typography">Typography</option>
                <option value="Graphic">Graphic</option>
                <option value="Pattern">Pattern</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Image URL
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
                value={editDesignData.imageUrl}
                onChange={(e) => setEditDesignData({ ...editDesignData, imageUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block">
                Tags
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-zinc-400 transition-colors dark:text-zinc-200"
                  placeholder="Add a tag..."
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEditAddTag())}
                />
                <button 
                  type="button"
                  onClick={handleEditAddTag}
                  className="px-4 py-2 bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-950 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {editDesignData.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-zinc-100 text-zinc-900 text-[10px] font-medium rounded flex items-center gap-1 dark:bg-zinc-800/40 dark:text-zinc-200">
                    {tag}
                    <button type="button" onClick={() => removeEditTag(tag)} className="hover:text-zinc-800">
                      <Plus className="w-3 h-3 rotate-45" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 shadow-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Confirm Deletion"
        disableAnimation
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-zinc-100 italic">Delete Design?</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Are you sure you want to delete <span className="font-bold text-gray-800 dark:text-zinc-200">"{designToDelete?.name}"</span>? 
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-2 bg-red-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-red-700 shadow-sm transition-colors"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

