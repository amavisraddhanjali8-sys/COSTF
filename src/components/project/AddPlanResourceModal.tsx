import React, { useState, useEffect, useMemo } from 'react';
import { X, Wrench, Calculator, Users, Cog, Cpu, Truck, HardHat } from 'lucide-react';
import { EnterpriseResource, EnterpriseResourceType } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { round2 } from '../../utils/decimalMath';

interface AddPlanResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (resourceData: any) => Promise<void>;
  initialData?: any | null;
  enterpriseResources: EnterpriseResource[];
  currency?: string;
}

export const AddPlanResourceModal: React.FC<AddPlanResourceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  enterpriseResources,
  currency = 'LKR'
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string>(initialData?.resourceId || '');
  const [name, setName] = useState(initialData?.name || '');
  const [resourceType, setResourceType] = useState<EnterpriseResourceType | string>(
    initialData?.resourceType || 'labour'
  );
  const [roleOrTrade, setRoleOrTrade] = useState(initialData?.roleOrTrade || '');
  const [allocatedHours, setAllocatedHours] = useState<number>(initialData?.allocatedHours ?? 40);
  const [hourlyRate, setHourlyRate] = useState<number>(initialData?.hourlyRate ?? 2500);
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill when choosing from enterprise resources
  const handleSelectEnterpriseResource = (resourceId: string) => {
    setSelectedEnterpriseId(resourceId);
    if (!resourceId) return;

    const res = enterpriseResources.find((r) => r.id === resourceId);
    if (res) {
      setName(res.name);
      setResourceType(res.type || 'labour');
      setRoleOrTrade(res.subCategory || res.category || res.skillOrSla || '');
      setHourlyRate(res.baseRate || 2500);
    }
  };

  const totalCost = useMemo(() => {
    return round2(Number(allocatedHours || 0) * Number(hourlyRate || 0));
  }, [allocatedHours, hourlyRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (allocatedHours < 0 || hourlyRate < 0) {
      setError('Hours and Rate must be non-negative');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        resourceId: selectedEnterpriseId || undefined,
        name: name.trim(),
        resourceType,
        roleOrTrade: roleOrTrade.trim(),
        allocatedHours: Number(allocatedHours || 0),
        hourlyRate: Number(hourlyRate || 0),
        totalCost,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-[#0078d4]/10 text-[#0078d4]">
              <Wrench className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isEditing ? 'Edit' : 'Add'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Quick Select from Enterprise Resources */}
          {enterpriseResources.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Catalogue
              </label>
              <select
                value={selectedEnterpriseId}
                onChange={(e) => handleSelectEnterpriseResource(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              >
                <option value="">Custom</option>
                {enterpriseResources.map((res) => (
                  <option key={res.id} value={res.id}>
                    [{res.type?.toUpperCase()}] {res.name} — {formatCurrency(res.baseRate, currency)}/{res.unit}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Resource"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Type
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              >
                <option value="labour">Labour</option>
                <option value="machinery">Machinery</option>
                <option value="equipment">Equipment</option>
                <option value="tool">Tools</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="material">Materials</option>
              </select>
            </div>
          </div>

          {/* Role / Trade */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Role
            </label>
            <input
              type="text"
              value={roleOrTrade}
              onChange={(e) => setRoleOrTrade(e.target.value)}
              placeholder="Trade"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
            />
          </div>

          {/* Hours, Rate, Cost */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Hours
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={allocatedHours}
                onChange={(e) => setAllocatedHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4] font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Rate ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4] font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Cost
              </label>
              <div className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-[#0078d4] dark:text-sky-400 truncate">
                {formatCurrency(totalCost, currency)}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
