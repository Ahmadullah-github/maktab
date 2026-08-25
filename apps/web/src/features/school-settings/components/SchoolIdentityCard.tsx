/**
 * SchoolIdentityCard Component
 *
 * School name input with visual feedback
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Building2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SchoolIdentityCardProps {
  schoolName: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

export function SchoolIdentityCard({ schoolName, onChange, disabled }: SchoolIdentityCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-4 bg-linear-to-r from-slate-50 to-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-slate-600 to-gray-700 flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-gray-800">
              {t('schoolSettings.schoolIdentity.title')}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              {t('schoolSettings.schoolIdentity.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-6">
        <div className="space-y-3">
          <Label
            htmlFor="school-name"
            className="text-sm font-medium text-gray-700 flex items-center gap-2"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
            {t('schoolSettings.schoolIdentity.nameLabel')}
          </Label>
          <div className="relative">
            <Input
              id="school-name"
              type="text"
              value={schoolName}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              placeholder={t('schoolSettings.schoolIdentity.namePlaceholder')}
              className={cn(
                'h-12 text-base pe-10 transition-all',
                'border-2 border-gray-200 focus:border-slate-400',
                'placeholder:text-gray-400',
                schoolName && 'border-slate-300 bg-slate-50/50'
              )}
            />
            {schoolName && (
              <div className="absolute end-3 top-1/2 -translate-y-1/2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">{t('schoolSettings.schoolIdentity.helperText')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
