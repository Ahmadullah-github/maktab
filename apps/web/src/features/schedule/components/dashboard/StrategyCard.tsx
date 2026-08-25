/**
 * StrategyCard Component
 * Visual card for solver strategy selection with animations
 *
 * Features:
 * - Display icon, Persian name, estimated time, description
 * - Selected/deselected states with border highlight
 * - Hover lift animation (scale: 1.02, shadow)
 * - Click animation (scale: 0.98 → 1)
 *
 * Requirements: 2.1, 2.5, 2.6, 2.7, 9.2
 */

import { Card } from '@/components/ui/card';
import type { SolverStrategy } from '@/features/schedule/types';
import { cn } from '@/lib/utils';
import { STRATEGY_CONFIG } from '@/types/strategy';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Props for StrategyCard component
 */
export interface StrategyCardProps {
  /** Strategy type to display */
  strategy: SolverStrategy;
  /** Whether this card is currently selected */
  isSelected: boolean;
  /** Callback when card is clicked */
  onSelect: () => void;
  /** Whether the card is disabled */
  disabled?: boolean;
}

/**
 * Color configuration for each strategy
 */
const STRATEGY_COLORS: Record<SolverStrategy, { bg: string; icon: string; border: string }> = {
  fast: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    border: 'border-amber-500',
  },
  balanced: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-500',
  },
  thorough: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    border: 'border-emerald-500',
  },
};

/**
 * StrategyCard component for visual strategy selection
 *
 * Displays strategy information with animated selection states.
 * Uses Framer Motion for hover and click animations.
 *
 * Requirements: 2.1, 2.5, 2.6, 2.7, 9.2
 */
export function StrategyCard({
  strategy,
  isSelected,
  onSelect,
  disabled = false,
}: StrategyCardProps) {
  const config = STRATEGY_CONFIG[strategy];
  const colors = STRATEGY_COLORS[strategy];
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={isSelected}
        aria-disabled={disabled}
        onClick={() => !disabled && onSelect()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'relative cursor-pointer transition-shadow duration-200 h-full min-w-[160px]',
          'hover:shadow-md',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isSelected && ['ring-2', colors.border, 'shadow-md'],
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Selected checkmark - animated */}
        <motion.div
          initial={false}
          animate={{
            scale: isSelected ? 1 : 0,
            opacity: isSelected ? 1 : 0,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center',
            colors.bg,
            colors.icon
          )}
        >
          <Check className="w-4 h-4" />
        </motion.div>

        <div className="p-4 pt-6 flex flex-col h-full">
          {/* Icon */}
          <div
            className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-3', colors.bg)}
          >
            <Icon className={cn('w-6 h-6', colors.icon)} />
          </div>

          {/* Persian name */}
          <h3 className="font-semibold text-base mb-1">{config.labelFa}</h3>

          {/* Estimated time */}
          <p className="text-sm text-muted-foreground mb-2">{config.estimatedTimeFa}</p>

          {/* Description - animated opacity based on selection */}
          <motion.p
            initial={false}
            animate={{
              opacity: isSelected ? 1 : 0.6,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="text-xs text-muted-foreground/80 mt-auto"
          >
            {config.descriptionFa}
          </motion.p>
        </div>
      </Card>
    </motion.div>
  );
}
