/**
 * PresetCard Component
 * Individual preset selection card with icon, title, description
 * Visual highlight when selected, recommended badge for balanced preset
 * Animated with Framer Motion
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, GraduationCap, Scale, SlidersHorizontal, Users, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PresetId } from '../types';

const PRESET_ICONS: Record<PresetId, React.ComponentType<{ className?: string }>> = {
  teacher: Users,
  class: GraduationCap,
  balanced: Scale,
  fast: Zap,
  custom: SlidersHorizontal,
};

const PRESET_COLORS: Record<PresetId, { bg: string; icon: string; border: string }> = {
  teacher: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-500',
  },
  class: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-green-500',
  },
  balanced: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-500',
  },
  fast: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    border: 'border-amber-500',
  },
  custom: {
    bg: 'bg-gray-50',
    icon: 'text-gray-600',
    border: 'border-gray-500',
  },
};

export interface PresetCardProps {
  presetId: PresetId;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: (presetId: PresetId) => void;
}

export function PresetCard({ presetId, isSelected, isRecommended, onSelect }: PresetCardProps) {
  const { t } = useTranslation();
  const Icon = PRESET_ICONS[presetId];
  const colors = PRESET_COLORS[presetId];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => onSelect(presetId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(presetId);
          }
        }}
        className={cn(
          'relative cursor-pointer transition-shadow duration-200 h-full',
          'hover:shadow-md',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isSelected && ['ring-2', colors.border, 'shadow-md']
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

        {/* Recommended badge */}
        {isRecommended && (
          <div className="absolute top-2 start-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {t('constraints.presets.balanced.recommended')}
            </span>
          </div>
        )}

        <div className="p-4 pt-8 flex flex-col h-full">
          {/* Icon */}
          <div
            className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-3', colors.bg)}
          >
            <Icon className={cn('w-6 h-6', colors.icon)} />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base mb-1">
            {t(`constraints.presets.${presetId}.title`)}
          </h3>

          {/* Short description */}
          <p className="text-sm text-muted-foreground mb-2">
            {t(`constraints.presets.${presetId}.description`)}
          </p>

          {/* Detailed description - animated, pushed to bottom */}
          <motion.p
            initial={false}
            animate={{
              opacity: isSelected ? 1 : 0.5,
            }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground/80 mt-auto"
          >
            {t(`constraints.presets.${presetId}.details`)}
          </motion.p>
        </div>
      </Card>
    </motion.div>
  );
}
