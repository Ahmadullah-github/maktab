/**
 * Dashboard component exports
 * Phase 3: Dashboard & Schedule Management
 * Phase 4: Schedule Dashboard Redesign
 */

// Phase 3 components
export {
  DeleteConfirmationDialog,
  type DeleteConfirmationDialogProps,
} from './DeleteConfirmationDialog';
export { ScheduleDashboard } from './ScheduleDashboard';
export { ScheduleList, type ScheduleListProps } from './ScheduleList';
export { ScheduleListItem, type ScheduleListItemProps } from './ScheduleListItem';
export { StatsCards, type StatsCardsProps } from './StatsCards';

// Phase 4: Schedule Dashboard Redesign components
export { DataCompletionProgress, type DataCompletionProgressProps } from './DataCompletionProgress';
export { EmptyHistoryState, type EmptyHistoryStateProps } from './EmptyHistoryState';
export {
  EncouragementEmptyState,
  type EncouragementEmptyStateProps,
} from './EncouragementEmptyState';
export { ErrorDisplay, type ErrorDisplayProps } from './ErrorDisplay';
export { ErrorGroup, type ErrorGroupProps } from './ErrorGroup';
export { ErrorItem, type ErrorItemProps } from './ErrorItem';
export { GenerationHub, type GenerationHubProps } from './GenerationHub';
export {
  CandidateComparisonCard,
  type CandidateComparisonCardProps,
} from './CandidateComparisonCard';
export { HistorySection, type HistorySectionProps } from './HistorySection';
export { OnboardingEmptyState, type OnboardingEmptyStateProps } from './OnboardingEmptyState';
export { ProgressView, type ProgressViewProps } from './ProgressView';
export { QualityScoreDisplay, type QualityScoreDisplayProps } from './QualityScoreDisplay';
export { ReadinessChecklist, type ReadinessChecklistProps } from './ReadinessChecklist';
export { ReadinessItem, type ReadinessItemProps } from './ReadinessItem';
export { ScheduleCard, type ScheduleCardProps } from './ScheduleCard';
export { ScheduleCardList, type ScheduleCardListProps } from './ScheduleCardList';
export { StrategyCard, type StrategyCardProps } from './StrategyCard';
export { StrategySelector, type StrategySelectorProps } from './StrategySelector';
export { SuccessState, type SuccessStateProps } from './SuccessState';
export { WarningBanner, type WarningBannerProps } from './WarningBanner';

// Loading and Error States (Task 9)
export { DashboardErrorState, type DashboardErrorStateProps } from './DashboardErrorState';
export {
  DashboardSkeleton,
  GenerationHubSkeleton,
  HistorySectionSkeleton,
  ReadinessChecklistSkeleton,
  ScheduleCardSkeleton,
  StrategyCardSkeleton,
  StrategySelectorSkeleton,
  type DashboardSkeletonProps,
} from './DashboardSkeleton';
