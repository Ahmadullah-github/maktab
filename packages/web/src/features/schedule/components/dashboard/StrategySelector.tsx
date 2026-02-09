/**
 * StrategySelector Component
 * Horizontal row of StrategyCards for selecting solver strategy
 *
 * Features:
 * - Renders three StrategyCards in horizontal row
 * - Manages selected strategy state
 * - Defaults to 'balanced' on mount
 *
 * Requirements: 1.2, 1.3
 */

import type { SolverStrategy } from '@/features/schedule/types';
import { getAllStrategyConfigs } from '@/types/strategy';
import { StrategyCard } from './StrategyCard';

/**
 * Props for StrategySelector component
 */
export interface StrategySelectorProps {
  /** Currently selected strategy */
  selectedStrategy: SolverStrategy;
  /** Callback when strategy is selected */
  onStrategyChange: (strategy: SolverStrategy) => void;
  /** Whether selection is disabled (e.g., during generation) */
  disabled?: boolean;
}

/**
 * StrategySelector component for choosing solver strategy
 *
 * Displays three strategy cards (fast, balanced, thorough) in a horizontal row.
 * Only one strategy can be selected at a time.
 *
 * Requirements: 1.2, 1.3
 */
export function StrategySelector({
  selectedStrategy,
  onStrategyChange,
  disabled = false,
}: StrategySelectorProps) {
  const strategies = getAllStrategyConfigs();

  return (
    <div className="grid grid-cols-3 gap-4">
      {strategies.map((config) => (
        <StrategyCard
          key={config.key}
          strategy={config.key}
          isSelected={selectedStrategy === config.key}
          onSelect={() => onStrategyChange(config.key)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
