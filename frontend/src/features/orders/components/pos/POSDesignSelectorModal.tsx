import { motion } from 'motion/react';
import type { Design } from '../../../designs/types';
import { Modal } from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';

interface POSDesignSelectorModalProps {
  isOpen: boolean;
  designs: Design[];
  onSelect: (designId: string) => void;
  onClose: () => void;
}

export function POSDesignSelectorModal({ isOpen, designs, onSelect, onClose }: POSDesignSelectorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Design Template" maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-hide md:grid-cols-4 lg:grid-cols-5">
          {designs.map(design => (
            <motion.button
              key={design.id}
              type="button"
              onClick={() => onSelect(design.id)}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="group overflow-hidden rounded-[var(--radius-card)] border border-white/50 bg-white/72 text-left shadow-[var(--shadow-card)] backdrop-blur-xl transition-all hover:border-macos-purple/45 dark:border-white/10 dark:bg-white/8"
            >
              <div className="aspect-square border-b border-black/5 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
                <img src={design.imageUrl} alt={design.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="p-2">
                <p className="truncate text-[10px] font-bold uppercase text-macos-text dark:text-zinc-100">{design.name}</p>
                <p className="text-[8px] uppercase tracking-widest text-macos-text-muted dark:text-zinc-500">{design.category}</p>
              </div>
            </motion.button>
          ))}
        </div>
        {designs.length === 0 && <EmptyState title="No designs found in repository" message="Upload reusable artwork before assigning a custom design." className="py-16" />}
      </div>
    </Modal>
  );
}
