import React, { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  FileDown,
  LayoutDashboard,
  SlidersHorizontal,
  FolderGit2,
  Calendar,
  Building2,
  CheckCircle2,
  Layers,
  Sparkles,
  TrendingUp,
  Flame,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Wrench,
  Bell,
  Sliders,
  X,
  ChevronRight,
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';
import {
  Project,
  MaterialItem,
  ProduceItem,
  Supplier,
  SubcontractorRateItem,
  OutsourcedService
} from '../types';
import { ProjectDashboardTab } from './project/ProjectDashboardTab';
import { ProjectCostControlsTab } from './project/ProjectCostControlsTab';
import { MarginalProfitAnalysisPortal } from './project/MarginalProfitAnalysisPortal';
import { VarianceHeatmap } from './project/VarianceHeatmap';
import { HistoricalMarginTrendChart } from './project/HistoricalMarginTrendChart';
import { analyzeProjectBudgetWarnings, PhaseWarningSummary } from '../utils/budgetWarningEngine';
import { PhaseBudgetAdjustmentModal } from './project/PhaseBudgetAdjustmentModal';
import { formatCurrency } from '../utils/currency';

interface CostAnalysisViewProps {
  project: Project | null;
  projects?: Project[];
  onSelectProject?: (project: Project) => void;
  onOpenProjectPicker?: () => void;
  materials?: MaterialItem[];
  produceItems?: ProduceItem[];
  suppliers?: Supplier[];
  subcontractors?: SubcontractorRateItem[];
  outsourcedServices?: OutsourcedService[];
  onUpdateProject?: (updatedProject: Project) => void;
  onAddProduceItem?: (item: ProduceItem) => void;
  onAddMaterial?: (mat: MaterialItem) => void;
  onRefreshAnalytics: () => void;
  onExportPDF: () => void;
  onNavigateToProjects: () => void;
  initialTab?: 'margins' | 'trend' | 'dashboard' | 'cost-controls' | 'variance-heatmap';
}

export const CostAnalysisView: React.FC<CostAnalysisViewProps> = ({
  project,
  projects = [],
  onSelectProject,
  onOpenProjectPicker,
  materials = [],
  produceItems = [],
  suppliers = [],
  subcontractors = [],
  outsourcedServices = [],
  onUpdateProject = () => {},
  onAddProduceItem,
  onAddMaterial,
  onRefreshAnalytics,
  onExportPDF,
  onNavigateToProjects,
  initialTab = 'margins'
}) => {
  // Five tabs:
  // Tab 1: 'margins' - Marginal Profit Analysis
  // Tab 2: 'trend' - Historical Margin Trend (Recharts Line Chart)
  // Tab 3: 'dashboard' - Project Dashboard
  // Tab 4: 'cost-controls' - Cost Controls & Budget Items
  // Tab 5: 'variance-heatmap' - Variance Heatmap
  const [activeTab, setActiveTab] = useState<'margins' | 'trend' | 'dashboard' | 'cost-controls' | 'variance-heatmap'>(initialTab);

  const effectiveProjects = projects.length > 0 ? projects : project ? [project] : [];
  const currentProject = project || effectiveProjects[0] || null;

  // Real-time calculation of phase budget overruns based on current consumption rates
  const warnings = useMemo(() => {
    if (!currentProject) return null;
    return analyzeProjectBudgetWarnings(currentProject, currentProject.selectedItems, currentProject.currency || 'USD');
  }, [currentProject]);

  // Proactive Project Adjustments Modal State
  const [selectedPhaseForAdjustment, setSelectedPhaseForAdjustment] = useState<PhaseWarningSummary | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [dismissedOverrunNoticeIds, setDismissedOverrunNoticeIds] = useState<Set<string>>(new Set());

  // Reset dismissed notices when project changes
  useEffect(() => {
    setDismissedOverrunNoticeIds(new Set());
  }, [currentProject?.id]);

  const handleOpenProactiveAdjustment = (phase: PhaseWarningSummary) => {
    setSelectedPhaseForAdjustment(phase);
    setIsAdjustmentModalOpen(true);
  };

  const handleDismissNotice = (phaseId: string) => {
    setDismissedOverrunNoticeIds((prev) => new Set([...prev, phaseId]));
  };

  const handleSelectProj = (proj: Project) => {
    if (onSelectProject) {
      onSelectProject(proj);
    }
  };

  const activePlanName = currentProject?.budgetaryPlans?.find(p => p.id === currentProject.activePlanId)?.name || 'Plan A (Baseline)';
  const currency = currentProject?.currency || 'USD';

  // Overrun phases that have not been dismissed
  const activeMaterialOverruns = useMemo(() => {
    if (!warnings) return [];
    return warnings.materialOverrunPhases.filter((p) => !dismissedOverrunNoticeIds.has(p.phaseId));
  }, [warnings, dismissedOverrunNoticeIds]);

  const activeLaborOverruns = useMemo(() => {
    if (!warnings) return [];
    return warnings.laborOverrunPhases.filter((p) => !dismissedOverrunNoticeIds.has(p.phaseId));
  }, [warnings, dismissedOverrunNoticeIds]);

  const totalOverrunCount = (warnings?.materialOverrunPhases.length || 0) + (warnings?.laborOverrunPhases.length || 0);

  return (
    <div className="space-y-4">
      {/* Top Project Breadcrumb & Quick Switcher Box */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {currentProject ? (
          <div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono text-[#0078d4] font-bold uppercase">{currentProject.code}</span>
              <span>•</span>
              <span>{currentProject.productCategory || currentProject.category || 'Engineering'}</span>
              <span>•</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentProject.clientName || currentProject.client || 'Client'}</span>
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center space-x-2">
              <span>{currentProject.name}</span>
              {currentProject.targetProduct && (
                <span className="text-xs text-slate-500 font-normal">({currentProject.targetProduct})</span>
              )}
            </h2>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Project Planning &amp; Margins</h2>
            <p className="text-xs text-slate-500">Select a project to connect all database cost items.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Simple Project Selector Box */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Project:</span>
            <select
              value={currentProject?.id || ''}
              onChange={(e) => {
                const found = effectiveProjects.find(p => p.id === e.target.value);
                if (found && onSelectProject) onSelectProject(found);
              }}
              className="bg-transparent text-xs font-bold text-[#003049] dark:text-sky-300 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              {effectiveProjects.map(p => (
                <option key={p.id} value={p.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            {onOpenProjectPicker && (
              <button
                type="button"
                onClick={onOpenProjectPicker}
                className="text-xs font-semibold text-[#0078d4] dark:text-sky-400 hover:underline ml-1 cursor-pointer"
              >
                Browse
              </button>
            )}
          </div>

          {/* Active Plan Pill */}
          {currentProject && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-blue-50 dark:bg-blue-950/60 text-[#0078d4] dark:text-sky-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>{activePlanName}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onRefreshAnalytics}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Recalculate analytics"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Recalculate</span>
          </button>

          <button
            type="button"
            onClick={onExportPDF}
            className="flex items-center space-x-1.5 px-3 py-1 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-white" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          REAL-TIME NOTIFICATION SYSTEM: MATERIAL & LABOR PHASE BUDGET OVERRUN ALERTS
         ========================================================================= */}
      {warnings && (activeMaterialOverruns.length > 0 || activeLaborOverruns.length > 0) && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Section Heading with Pulse indicator */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </div>
              <span className="text-xs font-bold text-red-900 dark:text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                <span>Real-Time Phase Budget Alerts ({activeMaterialOverruns.length + activeLaborOverruns.length})</span>
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="hidden sm:inline">Consumption Run-Rate Engine</span>
              {dismissedOverrunNoticeIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDismissedOverrunNoticeIds(new Set())}
                  className="text-xs text-[#0078d4] hover:underline cursor-pointer"
                >
                  Show all ({totalOverrunCount})
                </button>
              )}
            </div>
          </div>

          {/* Itemized Phase Overrun Notification Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Material Overrun Phase Alerts */}
            {activeMaterialOverruns.map((phase) => (
              <div
                key={`mat-alert-${phase.phaseId}`}
                className="bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-amber-600" />
                        <span>Material Budget Overrun</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        +{formatCurrency(phase.materialOverrunAmount, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDismissNotice(phase.phaseId)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Dismiss notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">
                    {phase.phaseName}
                  </h4>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Projected materials: <strong className="font-mono text-red-600 dark:text-red-400">{formatCurrency(phase.materialProjectedCost, currency)}</strong> exceeds budgeted material cap of <strong className="font-mono">{formatCurrency(phase.materialBudget, currency)}</strong>.
                    {phase.flaggedMaterialItems.length > 0 && (
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                        Primary driver: <em>{phase.flaggedMaterialItems[0].itemName}</em> ({phase.flaggedMaterialItems[0].consumptionRatePct}% pace).
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('variance-heatmap')}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    View Heatmap &rarr;
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenProactiveAdjustment(phase)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Proactive Project Adjustments</span>
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Labor / Subcontractor Overrun Phase Alerts */}
            {activeLaborOverruns.map((phase) => (
              <div
                key={`labor-alert-${phase.phaseId}`}
                className="bg-white dark:bg-slate-900 border-l-4 border-l-purple-500 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-purple-600" />
                        <span>Labor / Subcontractor Overrun</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        +{formatCurrency(phase.laborOverrunAmount, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDismissNotice(phase.phaseId)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Dismiss notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">
                    {phase.phaseName}
                  </h4>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Projected labor: <strong className="font-mono text-red-600 dark:text-red-400">{formatCurrency(phase.laborProjectedCost, currency)}</strong> exceeds budgeted labor cap of <strong className="font-mono">{formatCurrency(phase.laborBudget, currency)}</strong>.
                    {phase.flaggedLaborItems.length > 0 && (
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                        Primary driver: <em>{phase.flaggedLaborItems[0].itemName}</em> ({phase.flaggedLaborItems[0].consumptionRatePct}% pace).
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('variance-heatmap')}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    View Heatmap &rarr;
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenProactiveAdjustment(phase)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Proactive Project Adjustments</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tabs Navigation Bar - Simple Words like Home Tab */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 flex flex-wrap items-center justify-start gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('margins')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'margins'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Margins</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trend')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'trend'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span>Margin Trend</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cost-controls')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'cost-controls'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Cost Controls</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('variance-heatmap')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'variance-heatmap'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Flame className={`w-4 h-4 ${warnings?.hasOverruns ? 'text-red-500' : 'text-amber-500'}`} />
          <span>Variance</span>
          {warnings && warnings.criticalItemCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {warnings.criticalItemCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'margins' ? (
        <MarginalProfitAnalysisPortal
          projects={effectiveProjects}
          selectedProject={currentProject}
          onSelectProject={handleSelectProj}
          onUpdateProject={onUpdateProject}
          produceItems={produceItems}
          materials={materials}
          subcontractors={subcontractors}
          outsourcedServices={outsourcedServices}
          suppliers={suppliers}
        />
      ) : activeTab === 'trend' ? (
        currentProject ? (
          <HistoricalMarginTrendChart
            project={currentProject}
            currency={currentProject.currency}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
            <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-normal text-slate-800">No project selected</h3>
            <p className="text-slate-500 text-xs mt-1">Please select a project to view its historical margin trend.</p>
          </div>
        )
      ) : activeTab === 'dashboard' ? (
        currentProject ? (
          <ProjectDashboardTab
            project={currentProject}
            produceItems={produceItems}
            materials={materials}
            onUpdateProject={onUpdateProject}
            onAddProduceItem={onAddProduceItem}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
            <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-normal text-slate-800">No project selected</h3>
            <p className="text-slate-500 text-xs mt-1">Please select a project to view its dashboard.</p>
          </div>
        )
      ) : activeTab === 'cost-controls' ? (
        currentProject ? (
          <ProjectCostControlsTab
            project={currentProject}
            materials={materials}
            suppliers={suppliers}
            subcontractors={subcontractors}
            outsourcedServices={outsourcedServices}
            onUpdateProject={onUpdateProject}
            onAddMaterial={onAddMaterial}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
            <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-normal text-slate-800">No project selected</h3>
            <p className="text-slate-500 text-xs mt-1">Please select a project to configure cost controls.</p>
          </div>
        )
      ) : (
        currentProject ? (
          <VarianceHeatmap
            project={currentProject}
            onUpdateProject={onUpdateProject}
            activePlanId={currentProject.activePlanId}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
            <FolderGit2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-normal text-slate-800">No project selected</h3>
            <p className="text-slate-500 text-xs mt-1">Please select a project to view its variance heatmap.</p>
          </div>
        )
      )}

      {/* Proactive Project Adjustments Modal */}
      {currentProject && (
        <PhaseBudgetAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => setIsAdjustmentModalOpen(false)}
          project={currentProject}
          phaseSummary={selectedPhaseForAdjustment}
          onUpdateProject={onUpdateProject}
          materials={materials}
          subcontractors={subcontractors}
        />
      )}
    </div>
  );
};
