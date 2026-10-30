import React from 'react';
import { ProjectPlanBoqItem } from '../../types';
import { MakeVsBuyFullView } from './MakeVsBuyFullView';

interface MakeVsBuyAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currency?: string;
  initialBoqItem?: ProjectPlanBoqItem | null;
  boqItems?: ProjectPlanBoqItem[];
  onSuccess: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const MakeVsBuyAnalysisModal: React.FC<MakeVsBuyAnalysisModalProps> = ({
  isOpen,
  onClose,
  planId,
  currency = 'LKR',
  initialBoqItem,
  boqItems = [],
  onSuccess,
  showToast
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl max-h-[96vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800">
        <MakeVsBuyFullView
          plans={[{ id: planId, name: 'Current Plan', boqItems }]}
          activePlanId={planId}
          currency={currency}
          onPlanUpdated={onSuccess}
          showToast={showToast}
          onClose={onClose}
          isModal={true}
        />
      </div>
    </div>
  );
};
