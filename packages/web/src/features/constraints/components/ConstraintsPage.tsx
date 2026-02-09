/**
 * ConstraintsPage Component (Refactored)
 *
 * Main page for configuring optimization preferences with:
 * - Preset selection (5 presets: teacher, class, balanced, fast, custom)
 * - Problem size warning banner
 * - Constraint summary (collapsible)
 * - Drag-to-rank for custom mode
 * - Consecutive periods toggle
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClasses } from '@/features/classes';
import { useSubjects } from '@/features/subjects';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, RotateCcw, Save, Settings2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences, useSavePreferences } from '../hooks/useConstraints';
import { usePresets } from '../hooks/usePresets';
import { rankingToPreferences } from '../utils/rankingToWeights';
import { ConstraintRanking } from './ConstraintRanking';
import { ConstraintSummary } from './ConstraintSummary';
import { PresetSelector } from './PresetSelector';
import { ProblemSizeWarning } from './ProblemSizeWarning';

export interface ConstraintsPageProps {
  className?: string;
}

export function ConstraintsPage(_props: ConstraintsPageProps) {
  const { t } = useTranslation();

  // Fetch saved preferences
  const { data: savedPreferences, isLoading, error } = usePreferences();
  const savePreferencesMutation = useSavePreferences();

  // Fetch classes and subjects for problem size estimation
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();

  // Preset and ranking state management
  const {
    selectedPreset,
    preferences,
    ranking,
    hasChanges,
    selectPreset,
    updateRanking,
    updateAllowConsecutive,
    reset,
    markSaved,
  } = usePresets({
    initialPreferences: savedPreferences,
  });

  // Class and subject counts for problem size warning
  const classCount = classes?.length ?? 0;
  const subjectCount = subjects?.length ?? 0;

  // Sync saved state after successful save
  useEffect(() => {
    if (savePreferencesMutation.isSuccess) {
      markSaved();
    }
  }, [savePreferencesMutation.isSuccess, markSaved]);

  // Handle save
  const handleSave = useCallback(() => {
    // Convert ranking to preferences if in custom mode
    const prefsToSave =
      selectedPreset === 'custom'
        ? rankingToPreferences(ranking, preferences.allowConsecutivePeriodsForSameSubject)
        : preferences;

    savePreferencesMutation.mutate(prefsToSave);
  }, [selectedPreset, ranking, preferences, savePreferencesMutation]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{t('constraints.errors.fetchFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        icon={Settings2}
        title={t('constraints.pageTitle')}
        subtitle={t('constraints.pageSubtitle')}
        actions={
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-amber-600">{t('constraints.unsavedChanges')}</span>
            )}
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={savePreferencesMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 me-2" />
              {t('constraints.resetDefaults')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || savePreferencesMutation.isPending}
            >
              <Save className="h-4 w-4 me-2" />
              {savePreferencesMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Problem Size Warning */}
        <AnimatePresence>
          {classCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ProblemSizeWarning
                classCount={classCount}
                subjectCount={subjectCount}
                selectedPreset={selectedPreset}
                onSelectRecommendedPreset={selectPreset}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preset Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <PresetSelector selectedPreset={selectedPreset} onSelectPreset={selectPreset} />
        </motion.div>

        {/* Constraint Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <ConstraintSummary preferences={preferences} />
        </motion.div>

        {/* Custom Mode: Drag-to-Rank */}
        <AnimatePresence mode="wait">
          {selectedPreset === 'custom' && (
            <ConstraintRanking ranking={ranking} onRankingChange={updateRanking} />
          )}
        </AnimatePresence>

        {/* Consecutive Periods Toggle (always visible) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="allowConsecutive" className="text-sm font-medium">
                    {t('constraints.constraints.allowConsecutivePeriods.label')}
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-sm">
                        <p>{t('constraints.constraints.allowConsecutivePeriods.tooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id="allowConsecutive"
                  checked={preferences.allowConsecutivePeriodsForSameSubject}
                  onCheckedChange={updateAllowConsecutive}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t('constraints.constraints.allowConsecutivePeriods.description')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default ConstraintsPage;
