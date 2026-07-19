/**
 * AssignmentsPage Container Component
 *
 * Main page for managing teacher-class-subject assignments.
 * Provides a unified view of all assignments with:
 * - Class-first mental model (classes grouped by grade tier)
 * - Collapsible grade sections
 * - Side panel for assignment operations
 * - Bulk assignment support
 *
 * Requirements: Phase 3.1
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignmentsPage } from '../hooks/useAssignmentsPage';
import type {
  AssignmentCellSelection,
  AssignmentDrawerMode,
  AssignmentGradeCategory,
  AssignmentStatusFilter,
} from '../types';
import { AssignmentDrawerV2 as AssignmentDrawer } from './AssignmentDrawerV2';
import { AssignmentProgress } from './AssignmentProgress';
import { AssignmentsFilters } from './AssignmentsFilters';
import { AssignmentsStatsCard } from './AssignmentsStatsCard';
import { GradeGroupSection } from './GradeGroupSection';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentsPageProps {
  /** Initial grade category filter */
  initialGradeCategory?: AssignmentGradeCategory | null;
}

// function AssignmentsOverviewStrip({
//   completionPercentage,
//   totalClasses,
//   totalRequirements,
//   unassignedCount,
//   conflictCount,
//   visibleClassCount,
//   selectedCount,
//   activeFilterCount,
// }: AssignmentsOverviewStripProps) {
//   const { t } = useTranslation();

//   return (
//     <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
//       <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-[#003366] via-[#0c4063] to-slate-900 p-5 text-white shadow-lg shadow-slate-300/40">
//         <div className="absolute inset-y-0 end-0 w-40 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_70%)] blur-2xl" />
//         <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
//           <div className="space-y-2">
//             <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
//               <Sparkles className="h-3.5 w-3.5" />
//               {t('assignments.overview.title', 'مرور وضعیت تخصیص')}
//             </div>
//             <div>
//               <p className="text-3xl font-semibold tracking-tight">{completionPercentage}%</p>
//               <p className="mt-1 max-w-xl text-sm text-white/75">
//                 {t(
//                   'assignments.overview.description',
//                   'نمای کلی از مضامین پوشش‌داده‌شده، موارد باقیمانده و نیازهای قابل اقدام.'
//                 )}
//               </p>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
//             <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
//               <p className="text-[11px] text-white/65">
//                 {t('assignments.overview.visibleClasses', 'صنف‌های قابل مشاهده')}
//               </p>
//               <p className="mt-1 text-lg font-semibold">{visibleClassCount}</p>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
//               <p className="text-[11px] text-white/65">
//                 {t('assignments.overview.requirements', 'نیازمندی‌ها')}
//               </p>
//               <p className="mt-1 text-lg font-semibold">{totalRequirements}</p>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
//               <p className="text-[11px] text-white/65">
//                 {t('assignments.overview.unassigned', 'بدون تخصیص')}
//               </p>
//               <p className="mt-1 text-lg font-semibold text-amber-200">{unassignedCount}</p>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
//               <p className="text-[11px] text-white/65">
//                 {t('assignments.overview.conflicts', 'تعارض‌ها')}
//               </p>
//               <p className="mt-1 text-lg font-semibold text-rose-200">{conflictCount}</p>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
//         <div className="flex items-center gap-2 text-slate-500">
//           <Layers3 className="h-4 w-4" />
//           <span className="text-xs font-medium uppercase tracking-[0.2em]">
//             {t('assignments.overview.scope', 'دامنه')}
//           </span>
//         </div>
//         <p className="mt-3 text-2xl font-semibold text-slate-900">{totalClasses}</p>
//         <p className="mt-1 text-sm text-slate-500">
//           {t('assignments.overview.totalClasses', 'صنف در ماتریس تخصیص')}
//         </p>
//         <div className="mt-4 flex flex-wrap gap-2">
//           <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
//             {visibleClassCount} {t('assignments.overview.shown', 'نمایش داده شده')}
//           </Badge>
//           {activeFilterCount > 0 && (
//             <Badge
//               variant="secondary"
//               className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
//             >
//               {activeFilterCount} {t('assignments.overview.filters', 'فیلتر فعال')}
//             </Badge>
//           )}
//         </div>
//       </div>

//       <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
//         <div className="flex items-center gap-2 text-slate-500">
//           <CheckCircle2 className="h-4 w-4 text-emerald-600" />
//           <span className="text-xs font-medium uppercase tracking-[0.2em]">
//             {t('assignments.overview.ready', 'آماده برای اقدام')}
//           </span>
//         </div>
//         <p className="mt-3 text-2xl font-semibold text-slate-900">
//           {Math.max(0, totalRequirements - conflictCount)}
//         </p>
//         <p className="mt-1 text-sm text-slate-500">
//           {t('assignments.overview.actionableRequirements', 'نیازمندی‌های قابل رسیدگی')}
//         </p>
//         <p className="mt-4 text-xs text-slate-500">
//           {t(
//             'assignments.overview.actionableHint',
//             'مضامین بدون تعارض سریع‌ترین مسیر برای تکمیل تخصیص‌ها هستند.'
//           )}
//         </p>
//       </div>

//       <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
//         <div className="flex items-center gap-2 text-slate-500">
//           <Sparkles className="h-4 w-4 text-blue-600" />
//           <span className="text-xs font-medium uppercase tracking-[0.2em]">
//             {t('assignments.overview.selection', 'انتخاب')}
//           </span>
//         </div>
//         <p className="mt-3 text-2xl font-semibold text-slate-900">{selectedCount}</p>
//         <p className="mt-1 text-sm text-slate-500">
//           {t('assignments.overview.selectedRequirements', 'سلول برای تخصیص گروهی')}
//         </p>
//         <p className="mt-4 text-xs text-slate-500">
//           {selectedCount > 0
//             ? t(
//                 'assignments.overview.selectionHintActive',
//                 'انتخاب فعلی آماده بازشدن در پنل تخصیص گروهی است.'
//               )
//             : t(
//                 'assignments.overview.selectionHintIdle',
//                 'برای شروع، سلول‌های بدون تخصیص را انتخاب کنید یا از میانبر Ctrl/Cmd+A استفاده کنید.'
//               )}
//         </p>
//       </div>
//     </div>
//   );
// }

// ============================================================================
// Component
// ============================================================================

export function AssignmentsPage({ initialGradeCategory }: AssignmentsPageProps) {
  const { t } = useTranslation();

  // Page data and filters
  const {
    gradeGroups,
    stats,
    filters,
    setSearch,
    setGradeCategory,
    setStatusFilter,
    resetFilters,
    isLoading,
    error,
    rawData,
    getTeacherById,
    getSubjectById,
    getClassById,
  } = useAssignmentsPage({
    initialFilters: {
      gradeCategory: initialGradeCategory ?? null,
    },
  });

  // Drawer state
  const [drawerMode, setDrawerMode] = useState<AssignmentDrawerMode>('closed');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<AssignmentCellSelection[]>([]);
  const matrixRegionRef = useRef<HTMLDivElement>(null);

  // Expanded grade groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<AssignmentGradeCategory>>(
    new Set(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High', 'Ungraded'])
  );

  // Is drawer open?
  const isDrawerOpen = drawerMode !== 'closed';

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleToggleGroup = useCallback((category: AssignmentGradeCategory) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedGroups(new Set(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High', 'Ungraded']));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const handleCellClick = useCallback(
    (classId: number, subjectId: number) => {
      const classData = getClassById(classId);
      const subjectData = getSubjectById(subjectId);
      const requirement = gradeGroups
        .flatMap((group) => group.classes)
        .find((item) => item.classId === classId)
        ?.requirements.find((item) => item.subjectId === subjectId);

      setSelectedClassId(classId);
      setSelectedSubjectId(subjectId);
      setSelectedCells([
        {
          classId,
          subjectId,
          className: classData?.displayName || classData?.name,
          subjectName: subjectData?.name,
          periodsPerWeek: requirement?.periodsPerWeek ?? 0,
        },
      ]);
      setDrawerMode('assign');
    },
    [getClassById, getSubjectById, gradeGroups]
  );

  const handleBulkSelect = useCallback(
    (cells: AssignmentCellSelection[]) => {
      // Enrich cells with names
      const enrichedCells = cells.map((cell) => {
        const classData = getClassById(cell.classId);
        const subjectData = getSubjectById(cell.subjectId);
        return {
          ...cell,
          className: classData?.displayName || classData?.name,
          subjectName: subjectData?.name,
        };
      });

      setSelectedCells(enrichedCells);
      setSelectedClassId(null);
      setSelectedSubjectId(null);
      setDrawerMode('bulk-assign');
    },
    [getClassById, getSubjectById]
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerMode('closed');
    setSelectedClassId(null);
    setSelectedSubjectId(null);
    setSelectedCells([]);
  }, []);

  const handleGradeCategoryChange = useCallback(
    (category: AssignmentGradeCategory | null) => {
      setGradeCategory(category);
    },
    [setGradeCategory]
  );

  const handleStatusFilterChange = useCallback(
    (status: AssignmentStatusFilter) => {
      setStatusFilter(status);
    },
    [setStatusFilter]
  );

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - Close drawer / Clear selection
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          handleCloseDrawer();
        } else if (selectedCells.length > 0) {
          setSelectedCells([]);
        }
        return;
      }

      // Ctrl/Cmd+A - Select all visible unassigned cells
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const active = document.activeElement as HTMLElement | null;
        if (!active || !matrixRegionRef.current?.contains(active)) return;
        if (active.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;

        e.preventDefault();

        // Collect all unassigned cells from visible grade groups
        const unassignedCells: AssignmentCellSelection[] = [];

        gradeGroups.forEach((group) => {
          if (!expandedGroups.has(group.category)) return;

          group.classes.forEach((classItem) => {
            classItem.requirements?.forEach((req) => {
              if (req.assignmentStatus === 'unassigned' || req.assignmentStatus === 'partial') {
                const subjectData = getSubjectById(req.subjectId);
                unassignedCells.push({
                  classId: classItem.classId,
                  subjectId: req.subjectId,
                  className: classItem.displayName || classItem.className,
                  subjectName: subjectData?.name,
                  periodsPerWeek: req.periodsPerWeek,
                });
              }
            });
          });
        });

        if (unassignedCells.length > 0) {
          setSelectedCells(unassignedCells);
          setDrawerMode('bulk-assign');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDrawerOpen,
    selectedCells.length,
    gradeGroups,
    expandedGroups,
    getSubjectById,
    handleCloseDrawer,
  ]);

  // ============================================================================
  // Render States
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center animate-pulse">
            <Loader2 className="w-6 h-6 text-[#003366] animate-spin" />
          </div>
          <p className="text-muted-foreground">{t('common.loading', 'در حال بارگذاری...')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive">
            {t('assignments.errors.fetchFailed', 'خطا در بارگذاری اطلاعات')}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no classes)
  if (rawData.classes.length === 0) {
    return (
      <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <PageHeader
          icon={ClipboardList}
          title={t('assignments.pageTitle', 'تخصیص معلمین')}
          subtitle={t('assignments.pageSubtitle', 'مدیریت تخصیص معلمین به صنف‌ها و مضامین')}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
              <ClipboardList className="w-8 h-8 text-[#003366]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {t('assignments.emptyState.title', 'هنوز صنفی ایجاد نشده')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {t(
                  'assignments.emptyState.description',
                  'ابتدا صنف‌ها را از بخش صنف‌ها ایجاد کنید'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
      {/* Header */}
      <PageHeader
        icon={ClipboardList}
        title={t('assignments.pageTitle', 'تخصیص معلمین')}
        subtitle={t('assignments.pageSubtitle', 'مدیریت تخصیص معلمین به صنف‌ها و مضامین')}
        actions={
          <AssignmentProgress
            stats={stats}
            currentFilter={filters.statusFilter}
            onFilterChange={handleStatusFilterChange}
            compact
          />
        }
      />

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-white/80 backdrop-blur-sm">
        <AssignmentsFilters
          search={filters.search}
          onSearchChange={setSearch}
          gradeCategory={filters.gradeCategory}
          onGradeCategoryChange={handleGradeCategoryChange}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onResetFilters={resetFilters}
          totalClasses={stats.totalClasses}
          filteredClasses={gradeGroups.reduce((sum, g) => sum + g.classes.length, 0)}
          expandedCount={expandedGroups.size}
          totalGroups={gradeGroups.length}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          selectedCount={selectedCells.length}
          onClearSelection={handleCloseDrawer}
          onEnterBulkMode={() => setDrawerMode('bulk-assign')}
          isBulkMode={drawerMode === 'bulk-assign'}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Grade Groups List */}
        <div
          ref={matrixRegionRef}
          tabIndex={0}
          aria-label={t('assignments.matrixRegion', 'جدول تخصیص‌ها')}
          className={`transition-all duration-300 ease-in-out h-full overflow-auto ${
            isDrawerOpen ? 'flex-1 min-w-0' : 'flex-1'
          }`}
        >
          <div className="p-4 space-y-4">
            {gradeGroups.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/85 px-6 py-10 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {t('assignments.noResultsTitle', 'نمای قابل مشاهده‌ای یافت نشد')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {t('assignments.noResults', 'هیچ صنفی با این فیلترها یافت نشد')}
                  </p>
                  <Button variant="link" onClick={resetFilters} className="mt-2">
                    {t('assignments.clearFilters', 'پاک کردن فیلترها')}
                  </Button>
                </div>
              </div>
            ) : (
              gradeGroups.map((group) => (
                <GradeGroupSection
                  key={group.category}
                  group={group}
                  isExpanded={expandedGroups.has(group.category)}
                  onToggle={() => handleToggleGroup(group.category)}
                  onCellClick={handleCellClick}
                  onBulkSelect={handleBulkSelect}
                  subjects={rawData.subjects}
                  teachers={rawData.teachers}
                  getTeacherById={getTeacherById}
                  getSubjectById={getSubjectById}
                  compact={isDrawerOpen}
                />
              ))
            )}
          </div>
        </div>

        {/* Stats Card OR Assignment Drawer */}
        <div
          className={`h-[55vh] max-h-[55vh] w-full shrink-0 border-t border-slate-200 bg-slate-50 transition-all duration-300 ease-in-out lg:h-full lg:max-h-none lg:border-s lg:border-t-0 ${
            isDrawerOpen ? 'overflow-hidden lg:w-[500px]' : 'overflow-auto lg:w-[360px]'
          }`}
        >
          {isDrawerOpen ? (
            <AssignmentDrawer
              mode={drawerMode}
              classId={selectedClassId}
              subjectId={selectedSubjectId}
              selectedCells={selectedCells}
              onClose={handleCloseDrawer}
              teachers={rawData.teachers}
              subjects={rawData.subjects}
              classes={rawData.classes}
              getTeacherById={getTeacherById}
              getSubjectById={getSubjectById}
              getClassById={getClassById}
              className="h-full"
            />
          ) : (
            <AssignmentsStatsCard stats={stats} gradeGroups={gradeGroups} className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default AssignmentsPage;
