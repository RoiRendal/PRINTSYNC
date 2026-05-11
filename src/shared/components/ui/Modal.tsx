import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  disableAnimation?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-md"
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} max-h-[90vh] my-4 md:my-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded shadow-xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-zinc-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
            id="close-modal-btn"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

