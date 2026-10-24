import React, { useState, useEffect, useMemo } from 'react';
import { X, Wrench, Check } from 'lucide-react';
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
  const isEditing = Boolean(initialData?.id);

  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string>(initialData?.resourceId || '');
  const [name, setName] = useState(initialData?.name || '');
  const [resourceType, setResourceType] = useState<EnterpriseResourceType | string>(
    initialData?.resourceType || 'labour'
  );
  const [roleOrTrade, setRoleOrTrade] = useState(initialData?.roleOrTrade || '');
  const [allocatedHours, setAllocatedHours] = useState<number>(initialData?.allocatedHours ?? 40);
  const [hourlyRate, setHourlyRate] = useState<number>(initialData?.hourlyRate ?? 2500);
  const [unit, setUnit] = useState<string>(initialData?.unit || 'hr');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialData changes when opened
  useEffect(() => {
    if (initialData) {
      setSelectedEnterpriseId(initialData.resourceId || '');
      setName(initialData.name || '');
      setResourceType(initialData.resourceType || 'labour');
      setRoleOrTrade(initialData.roleOrTrade || '');
      setAllocatedHours(initialData.allocatedHours ?? 40);
      setHourlyRate(initialData.hourlyRate ?? 2500);
      setUnit(initialData.unit || 'hr');
      setStartDate(initialData.startDate || '');
      setEndDate(initialData.endDate || '');
      setNotes(initialData.notes || '');
    } else {
      setSelectedEnterpriseId('');
      setName('');
      setResourceType('labour');
      setRoleOrTrade('');
      setAllocatedHours(40);
      setHourlyRate(2500);
      setUnit('hr');
      setStartDate('');
      setEndDate('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  // Selected catalogue item
  const selectedResource = useMemo(() => {
    return enterpriseResources.find((r) => r.id === selectedEnterpriseId);
  }, [selectedEnterpriseId, enterpriseResources]);

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
      if (res.unit) setUnit(res.unit);
    }
  };

  const totalCost = useMemo(() => {
    return round2(Number(allocatedHours || 0) * Number(hourlyRate || 0));
  }, [allocatedHours, hourlyRate]);

  if (!isOpen) return null;

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
        unit: unit.trim() || 'hr',
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
              {isEditing ? 'Edit Resource' : 'Add Resource'}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
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
                <option value="">Custom Entry</option>
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
                placeholder="Resource name"
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
                <option value="outsourced">Outsourced</option>
              </select>
            </div>
          </div>

          {/* Role / Trade & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Role
              </label>
              <input
                type="text"
                value={roleOrTrade}
                onChange={(e) => setRoleOrTrade(e.target.value)}
                placeholder="Trade / Role"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="hr, day, shift"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
              />
            </div>
          </div>

          {/* Rate Options & Range Selector */}
          {selectedResource && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                Rate Ranges
              </span>
              <div className="flex flex-wrap gap-1.5">
                {/* Base Rate */}
                <button
                  type="button"
                  onClick={() => setHourlyRate(Number(selectedResource.baseRate || 0))}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all ${
                    Number(hourlyRate) === Number(selectedResource.baseRate)
                      ? 'bg-[#0078d4] text-white border-[#0078d4]'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0078d4]'
                  }`}
                >
                  Base: {formatCurrency(selectedResource.baseRate, currency)}
                </button>

                {/* Benchmark Rate */}
                {selectedResource.industryBenchmarkRate ? (
                  <button
                    type="button"
                    onClick={() => setHourlyRate(Number(selectedResource.industryBenchmarkRate || 0))}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all ${
                      Number(hourlyRate) === Number(selectedResource.industryBenchmarkRate)
                        ? 'bg-[#0078d4] text-white border-[#0078d4]'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0078d4]'
                    }`}
                  >
                    Benchmark: {formatCurrency(selectedResource.industryBenchmarkRate, currency)}
                  </button>
                ) : null}

                {/* Competitor Rate */}
                {selectedResource.competitorRate ? (
                  <button
                    type="button"
                    onClick={() => setHourlyRate(Number(selectedResource.competitorRate || 0))}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all ${
                      Number(hourlyRate) === Number(selectedResource.competitorRate)
                        ? 'bg-[#0078d4] text-white border-[#0078d4]'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0078d4]'
                    }`}
                  >
                    Competitor: {formatCurrency(selectedResource.competitorRate, currency)}
                  </button>
                ) : null}

                {/* Price Ranges / Volume Tiers */}
                {Array.isArray(selectedResource.priceRanges) &&
                  selectedResource.priceRanges.map((tier, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHourlyRate(Number(tier.unitRate || 0))}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all ${
                        Number(hourlyRate) === Number(tier.unitRate)
                          ? 'bg-[#0078d4] text-white border-[#0078d4]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0078d4]'
                      }`}
                    >
                      {tier.label || `${tier.minQty}+`}: {formatCurrency(tier.unitRate, currency)}
                    </button>
                  ))}

                {/* Alternatives */}
                {Array.isArray(selectedResource.alternatives) &&
                  selectedResource.alternatives.map((alt, idx) => (
                    <button
                      key={`alt-${idx}`}
                      type="button"
                      onClick={() => setHourlyRate(Number(alt.rate || 0))}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all ${
                        Number(hourlyRate) === Number(alt.rate)
                          ? 'bg-[#0078d4] text-white border-[#0078d4]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0078d4]'
                      }`}
                    >
                      {alt.providerOrCompetitor || alt.name}: {formatCurrency(alt.rate, currency)}
                    </button>
                  ))}
              </div>
            </div>
          )}

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
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4] font-mono font-bold"
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
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4] font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Cost
              </label>
              <div className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-[#0078d4] dark:text-sky-400 truncate flex items-center h-[34px]">
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
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
