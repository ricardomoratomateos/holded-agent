import { Check, X } from 'lucide-react';

interface ApprovalPanelProps {
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalPanel = ({ onApprove, onReject }: ApprovalPanelProps) => {
  return (
    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
      <p className="text-sm font-semibold text-amber-800 uppercase tracking-wide">
        Acción Requerida
      </p>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Check size={16} /> Confirmar
        </button>
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm"
        >
          <X size={16} /> Cancelar
        </button>
      </div>
    </div>
  );
};
