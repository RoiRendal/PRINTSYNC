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
            <button
              key={design.id}
              type="button"
              onClick={() => onSelect(design.id)}
              className="overflow-hidden rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] text-left transition-colors hover:border-[var(--app-border-control)] dark:bg-[#3d3d3f]"
            >
              <div className="aspect-square border-b bg-[#f7f7f7] dark:bg-[#373739]">
                <img src={design.imageUrl} alt={design.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-2">
                <p className="truncate text-[10px] font-bold uppercase text-macos-text dark:text-zinc-100">{design.name}</p>
                <p className="text-[8px] uppercase tracking-widest text-macos-text-muted dark:text-zinc-500">{design.category}</p>
              </div>
            </button>
          ))}
        </div>
        {designs.length === 0 && <EmptyState title="No designs found in repository" message="Upload reusable artwork before assigning a custom design." className="py-16" />}
      </div>
    </Modal>
  );
}
