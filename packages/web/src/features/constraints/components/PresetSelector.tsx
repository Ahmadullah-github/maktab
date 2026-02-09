/**
 * PresetSelector Component
 * Grid of 5 preset cards for quick optimization profile selection
 */

import { useTranslation } from 'react-i18next';
import type { PresetId } from '../types';
import { PresetCard } from './PresetCard';

const PRESET_ORDER: PresetId[] = ['teacher', 'class', 'balanced', 'fast', 'custom'];

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
        <h2 className="text-lg font-semibold">{t('constraints.presets.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('constraints.presets.subtitle')}</p>
      </div>

      {/* Preset cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
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
