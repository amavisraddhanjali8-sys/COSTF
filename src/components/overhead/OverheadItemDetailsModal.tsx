import React from 'react';
import { X } from 'lucide-react';
import { OverheadItem } from '../../types';

interface OverheadItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  overheadItem?: OverheadItem | null;
}

export const OverheadItemDetailsModal: React.FC<OverheadItemDetailsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold">Overhead Item Details</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500">Overhead details view.</p>
      </div>
    </div>
  );
};
