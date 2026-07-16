import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings2, RotateCcw, Save, Undo2 } from 'lucide-react';
import { useBlocker } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences, useSavePreferences } from '../hooks/useConstraints';
import { usePresets } from '../hooks/usePresets';
import { CONSTRAINT_DEFINITIONS } from '../types';
import { ConstraintSummary } from './ConstraintSummary';
import { PresetSelector } from './PresetSelector';
import { StrengthControl } from './StrengthControl';

export interface ConstraintsPageProps {
  className?: string;
}

export function ConstraintsPage(_props: ConstraintsPageProps) {
  const { t } = useTranslation();
  const { data: profile, isLoading, error, refetch } = usePreferences(null);
  const saveMutation = useSavePreferences();
  const {
    selectedPreset,
    preferences,
    hasChanges,
    selectPreset,
    updateStrength,
    updateAllowConsecutive,
    discardChanges,
    restoreDefaults,
    markSaved,
  } = usePresets({ initialPreferences: profile?.preferences });

  useBlocker({
    shouldBlockFn: () =>
      hasChanges && !window.confirm(t('constraints.unsavedChangesConfirm')),
    enableBeforeUnload: hasChanges,
  });

  const handleSave = useCallback(() => {
    if (!profile) return;
    saveMutation.mutate(
      { ...profile, preferences },
      { onSuccess: (saved) => markSaved(saved.preferences) }
    );
  }, [markSaved, preferences, profile, saveMutation]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  }

  if (error || !profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-destructive">{t('constraints.errors.fetchFailed')}</p>
        <Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Settings2}
        title={t('constraints.pageTitle')}
        subtitle={t('constraints.pageSubtitle')}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasChanges && <span className="text-sm text-amber-600">{t('constraints.unsavedChanges')}</span>}
            <Button variant="outline" onClick={restoreDefaults} disabled={saveMutation.isPending}>
              <RotateCcw className="me-2 h-4 w-4" />{t('constraints.restoreDefaults')}
            </Button>
            <Button variant="outline" onClick={discardChanges} disabled={!hasChanges || saveMutation.isPending}>
              <Undo2 className="me-2 h-4 w-4" />{t('constraints.discardChanges')}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
              <Save className="me-2 h-4 w-4" />
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 space-y-6 overflow-auto p-4 sm:p-6">
        <PresetSelector selectedPreset={selectedPreset} onSelectPreset={selectPreset} />
        <ConstraintSummary preferences={preferences} />

        {(['teacher', 'class', 'subject', 'room'] as const).map((category) => (
          <section key={category} className="space-y-3" aria-labelledby={`category-${category}`}>
            <div>
              <h2 id={`category-${category}`} className="text-lg font-semibold">
                {t(`constraints.categories.${category}`)}
              </h2>
              <p className="text-sm text-muted-foreground">{t(`constraints.categories.${category}Desc`)}</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {CONSTRAINT_DEFINITIONS.filter((item) => item.category === category).map((item) => (
                <StrengthControl
                  key={item.key}
                  constraint={item}
                  value={preferences[item.key]}
                  onChange={(value) => updateStrength(item.key, value)}
                />
              ))}
            </div>
          </section>
        ))}

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="space-y-1">
              <Label htmlFor="allowConsecutive">{t('constraints.constraints.allowConsecutivePeriods.label')}</Label>
              <p className="text-xs text-muted-foreground">{t('constraints.constraints.allowConsecutivePeriods.description')}</p>
              <p className="text-xs text-muted-foreground">{t('constraints.constraints.allowConsecutivePeriods.tooltip')}</p>
            </div>
            <Switch
              id="allowConsecutive"
              checked={preferences.allowConsecutivePeriodsForSameSubject}
              onCheckedChange={updateAllowConsecutive}
            />
          </CardContent>
        </Card>

        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          {t('constraints.allObjectivesHonored')}
        </p>
      </main>
    </div>
  );
}

export default ConstraintsPage;
