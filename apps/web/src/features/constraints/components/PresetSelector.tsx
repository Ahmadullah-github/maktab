/**
 * PresetSelector Component
 * Grid of selectable preset cards for quick optimization profile selection.
 * "Custom" is a derived state after editing and is not a no-op selectable card.
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { PresetId } from '../types';
import { PresetCard } from './PresetCard';

const PRESET_ORDER: PresetId[] = ['teacher', 'class', 'balanced'];

export interface PresetSelectorProps {
  selectedPreset: PresetId;
  onSelectPreset: (presetId: PresetId) => void;
}

export function PresetSelector({ selectedPreset, onSelectPreset }: PresetSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{t('constraints.presets.title')}</h2>
          {selectedPreset === 'custom' && (
            <Badge variant="secondary">{t('constraints.presets.custom.title')}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('constraints.presets.subtitle')}</p>
      </div>

      {/* Preset cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
        {PRESET_ORDER.map((presetId) => (
          <PresetCard
            key={presetId}
            presetId={presetId}
            isSelected={selectedPreset === presetId}
            isRecommended={presetId === 'balanced'}
            onSelect={onSelectPreset}
          />
        ))}
      </div>
    </div>
  );
}
