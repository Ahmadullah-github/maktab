/**
 * WarningBanner Component
 * Collapsible banner for displaying solver warnings
 *
 * Features:
 * - Collapsible banner showing warning count
 * - Expand to show full warning list
 * - Display message_farsi and affected entities for each warning
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import type { AffectedEntity, SolverErrorDetail } from '@/types/solver';

/**
 * Props for WarningBanner component
 */
export interface WarningBannerProps {
  /** Warnings from solver */
  warnings: SolverErrorDetail[];
  /** Callback when an entity link is clicked */
  onEntityClick?: (entity: AffectedEntity) => void;
  /** Callback when "View Details" is clicked */
  onViewDetails?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Entity type labels in Persian
 */
const ENTITY_TYPE_LABELS: Record<AffectedEntity['entity_type'], string> = {
  teacher: 'استاد',
  class: 'صنف',
  room: 'اتاق',
  subject: 'مضمون',
};

/**
 * Format context data for specific warning types
 */
function formatWarningContext(warning: SolverErrorDetail): string | null {
  const context = warning.context;

  // Room capacity warning (Requirement: 12.4)
  if (
    warning.error_code === 'ROOM_CAPACITY_WARNING' &&
    context.required_capacity !== undefined &&
    context.available_capacity !== undefined
  ) {
    return `ظرفیت مورد نیاز: ${context.required_capacity}، ظرفیت موجود: ${context.available_capacity}`;
  }

  // Subject distribution warning (Requirement: 12.5)
  if (
    warning.error_code === 'SUBJECT_DISTRIBUTION_WARNING' &&
    context.subject_name &&
    context.class_name
  ) {
    return `مضمون: ${context.subject_name}، صنف: ${context.class_name}`;
  }

  // Ministry subject hours warning (Requirement: 12.6)
  if (
    warning.error_code === 'MINISTRY_SUBJECT_HOURS' &&
    context.required_periods !== undefined &&
    context.configured_periods !== undefined
  ) {
    return `ساعات مورد نیاز: ${context.required_periods}، ساعات تنظیم شده: ${context.configured_periods}`;
  }

  return null;
}

/**
 * WarningBanner component for displaying solver warnings
 *
 * Shows a collapsible banner with warning count that expands
 * to show the full list of warnings with their details.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */
export function WarningBanner({
  warnings,
  onEntityClick,
  onViewDetails,
  className,
}: WarningBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('w-full', className)}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Collapsed header (Requirement: 12.2) */}
        <div
          className={cn(
            'rounded-lg border',
            'bg-amber-50 border-amber-200',
            isOpen && 'rounded-b-none'
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center justify-between p-4',
                'hover:bg-amber-100/50 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-inset'
              )}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">{warnings.length} هشدار</span>
              </div>
              <div className="flex items-center gap-2">
                {onViewDetails && !isOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails();
                    }}
                    className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                  >
                    مشاهده جزئیات
                  </Button>
                )}
                <ChevronDown
                  className={cn(
                    'w-5 h-5 text-amber-600 transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                />
              </div>
            </button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('border border-t-0 rounded-b-lg', 'bg-amber-50/50 border-amber-200')}
              >
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                  {warnings.map((warning, index) => (
                    <WarningItem
                      key={`${warning.error_code}-${index}`}
                      warning={warning}
                      onEntityClick={onEntityClick}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

/**
 * WarningItem component for displaying a single warning
 */
interface WarningItemProps {
  warning: SolverErrorDetail;
  onEntityClick?: (entity: AffectedEntity) => void;
}

function WarningItem({ warning, onEntityClick }: WarningItemProps) {
  const contextInfo = formatWarningContext(warning);

  return (
    <div className="p-3 rounded-lg bg-white/60 border border-amber-100">
      {/* Warning message (Requirement: 12.3) */}
      <p className="text-sm text-amber-900 mb-2">{warning.message_farsi}</p>

      {/* Context info */}
      {contextInfo && (
        <p className="text-xs text-amber-700 mb-2 bg-amber-100/50 px-2 py-1 rounded">
          {contextInfo}
        </p>
      )}

      {/* Affected entities (Requirement: 12.3) */}
      {warning.affected_entities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {warning.affected_entities.map((entity, index) => (
            <button
              key={`${entity.entity_type}-${entity.entity_id}-${index}`}
              onClick={() => onEntityClick?.(entity)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded',
                'text-xs font-medium',
                'bg-amber-100 text-amber-800 hover:bg-amber-200',
                'transition-colors cursor-pointer'
              )}
            >
              <span className="text-amber-600">{ENTITY_TYPE_LABELS[entity.entity_type]}:</span>
              <span>{entity.entity_name}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
