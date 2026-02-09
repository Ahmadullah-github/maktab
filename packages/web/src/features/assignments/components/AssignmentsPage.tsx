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
import { useCallback, useEffect, useState } from 'react';
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

  // Expanded grade groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<AssignmentGradeCategory>>(
    new Set(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High'])
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
    setExpandedGroups(new Set(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const handleCellClick = useCallback(
    (classId: number, subjectId: number) => {
      const classData = getClassById(classId);
      const subjectData = getSubjectById(subjectId);

      setSelectedClassId(classId);
      setSelectedSubjectId(subjectId);
      setSelectedCells([
        {
          classId,
          subjectId,
          className: classData?.displayName || classData?.name,
          subjectName: subjectData?.name,
        },
      ]);
      setDrawerMode('assign');
    },
    [getClassById, getSubjectById]
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
        // Only if not in an input field
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }

        e.preventDefault();

        // Collect all unassigned cells from visible grade groups
        const unassignedCells: AssignmentCellSelection[] = [];

        gradeGroups.forEach((group) => {
          if (!expandedGroups.has(group.category)) return;

          group.classes.forEach((classItem) => {
            classItem.requirements?.forEach((req) => {
              if (!req.teacherId) {
                const subjectData = getSubjectById(req.subjectId);
                unassignedCells.push({
                  classId: classItem.classId,
                  subjectId: req.subjectId,
                  className: classItem.displayName || classItem.className,
                  subjectName: subjectData?.name,
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
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center animate-pulse">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
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
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto">
              <ClipboardList className="w-8 h-8 text-purple-600" />
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
      <div className="flex-1 overflow-hidden flex">
        {/* Grade Groups List */}
        <div
          className={`transition-all duration-300 ease-in-out h-full overflow-auto ${
            isDrawerOpen ? 'flex-1 min-w-0' : 'flex-1'
          }`}
        >
          <div className="p-4 space-y-4">
            {gradeGroups.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <p className="text-slate-500">
                    {t('assignments.noResults', 'هیچ صنفی با این فیلترها یافت نشد')}
                  </p>
                  <Button variant="link" onClick={resetFilters}>
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
          className={`transition-all duration-300 ease-in-out h-full border-s border-gray-200 bg-gray-50 shrink-0 overflow-auto ${
            isDrawerOpen ? 'w-[480px]' : 'w-[300px]'
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
