import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  maxWidth = "max-w-md",
  disableAnimation = false
}) => {
  const motionProps = disableAnimation 
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 }
      }
    : {
        initial: { opacity: 0, scale: 0.95, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 20 }
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            {...motionProps}
            className={`w-full ${maxWidth} bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded shadow-xl overflow-hidden`}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-zinc-100 italic serif">
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
            <div className="p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

