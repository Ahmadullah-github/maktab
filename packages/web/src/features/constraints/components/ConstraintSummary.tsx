/**
 * ConstraintSummary Component
 * Shows active constraints count with expandable details
 * Groups constraints by category with visual indicators
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronDown, DoorOpen, GraduationCap, Settings2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConstraintCategory, ConstraintWeightKey, OptimizationPreferences } from '../types';
import { CONSTRAINT_DEFINITIONS } from '../types';

const CATEGORY_ICONS: Record<ConstraintCategory, React.ComponentType<{ className?: string }>> = {
  teacher: Users,
  class: GraduationCap,
  subject: BookOpen,
  room: DoorOpen,
  general: Settings2,
};

const CATEGORY_COLORS: Record<ConstraintCategory, string> = {
  teacher: 'text-blue-600 bg-blue-50',
  class: 'text-green-600 bg-green-50',
  subject: 'text-purple-600 bg-purple-50',
  room: 'text-orange-600 bg-orange-50',
  general: 'text-gray-600 bg-gray-50',
};

interface ConstraintSummaryItem {
  key: ConstraintWeightKey;
  category: ConstraintCategory;
  weight: number;
  enabled: boolean;
}

export interface ConstraintSummaryProps {
  preferences: OptimizationPreferences;
  className?: string;
}

export function ConstraintSummary({ preferences, className }: ConstraintSummaryProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Build summary data
  const { activeCount, totalCount, byCategory } = useMemo(() => {
    const items: ConstraintSummaryItem[] = [];
    const categoryMap: Record<ConstraintCategory, ConstraintSummaryItem[]> = {
      teacher: [],
      class: [],
      subject: [],
      room: [],
      general: [],
    };

    for (const def of CONSTRAINT_DEFINITIONS) {
      if (def.type !== 'weight') continue;

      const key = def.key as ConstraintWeightKey;
      const weight = preferences[key] as number;
      const item: ConstraintSummaryItem = {
        key,
        category: def.category,
        weight,
        enabled: weight > 0,
      };

      items.push(item);
      categoryMap[def.category].push(item);
    }

    const active = items.filter((i) => i.enabled).length;

    return {
      activeCount: active,
      totalCount: items.length,
      byCategory: categoryMap,
    };
  }, [preferences]);

  // Get weight label
  const getWeightLabel = (weight: number): string => {
    if (weight === 0) return t('constraints.summary.weightDisabled');
    if (weight < 0.5) return t('constraints.summary.weightLow');
    if (weight < 1.0) return t('constraints.summary.weightMedium');
    if (weight < 1.5) return t('constraints.summary.weightHigh');
    return t('constraints.summary.weightVeryHigh');
  };

  // Get weight badge variant
  const getWeightVariant = (weight: number): 'secondary' | 'outline' | 'default' => {
    if (weight === 0) return 'outline';
    if (weight < 1.0) return 'secondary';
    return 'default';
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('constraints.summary.title')}</span>
                <Badge variant="secondary" className="font-mono">
                  {activeCount}/{totalCount}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {t('constraints.summary.activeConstraints', { count: activeCount })}
              </span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-4">
              {(Object.entries(byCategory) as [ConstraintCategory, ConstraintSummaryItem[]][]).map(
                ([category, items]) => {
                  if (items.length === 0) return null;

                  const Icon = CATEGORY_ICONS[category];
                  const colorClass = CATEGORY_COLORS[category];
                  const activeInCategory = items.filter((i) => i.enabled).length;

                  return (
                    <div key={category} className="space-y-2">
                      {/* Category header */}
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1 rounded', colorClass)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">
                          {t(`constraints.categories.${category}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({activeInCategory}/{items.length})
                        </span>
                      </div>

                      {/* Constraints list */}
                      <div className="ms-6 space-y-1.5">
                        {items.map((item) => (
                          <div
                            key={item.key}
                            className={cn(
                              'flex items-center justify-between text-sm py-1 px-2 rounded',
                              item.enabled ? 'bg-muted/30' : 'opacity-50'
                            )}
                          >
                            <span className={cn(!item.enabled && 'line-through')}>
                              {t(
                                `constraints.constraints.${getConstraintTranslationKey(item.key)}.label`
                              )}
                            </span>
                            <Badge
                              variant={getWeightVariant(item.weight)}
                              className="text-xs font-normal"
                            >
                              {getWeightLabel(item.weight)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}

              {/* Toggle status */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm py-1 px-2">
                  <span>{t('constraints.constraints.allowConsecutivePeriods.label')}</span>
                  <Badge
                    variant={
                      preferences.allowConsecutivePeriodsForSameSubject ? 'default' : 'outline'
                    }
                  >
                    {preferences.allowConsecutivePeriodsForSameSubject
                      ? t('constraints.summary.enabled')
                      : t('constraints.summary.disabled')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Map constraint key to translation key
 */
function getConstraintTranslationKey(key: ConstraintWeightKey): string {
  const mapping: Record<ConstraintWeightKey, string> = {
    avoidTeacherGapsWeight: 'avoidTeacherGaps',
    balanceTeacherLoadWeight: 'balanceTeacherLoad',
    respectTeacherTimePreferenceWeight: 'respectTeacherTimePreference',
    respectTeacherRoomPreferenceWeight: 'respectTeacherRoomPreference',
    preferClassHomeRoomWeight: 'preferClassHomeRoom',
    respectSubjectDesiredFeaturesWeight: 'respectSubjectDesiredFeatures',
    avoidClassGapsWeight: 'avoidClassGaps',
    distributeDifficultSubjectsWeight: 'distributeDifficultSubjects',
    preferMorningForDifficultWeight: 'preferMorningForDifficult',
    subjectSpreadWeight: 'subjectSpread',
    minimizeRoomChangesWeight: 'minimizeRoomChanges',
    avoidFirstLastPeriodWeight: 'avoidFirstLastPeriod',
  };
  return mapping[key];
}
