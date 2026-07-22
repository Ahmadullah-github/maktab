import type { SchoolProfileDto } from '@/features/school-settings/schemas/schoolProfileDto.schema';
import { cn } from '@/lib/utils';
import { School } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SchoolBrandProps {
  profile: SchoolProfileDto;
  compact?: boolean;
  className?: string;
}

export function getSchoolDisplayName(profile: SchoolProfileDto, language: string): string {
  const localized = language.startsWith('fa')
    ? profile.nameFa
    : language.startsWith('ps')
      ? profile.namePs
      : language.startsWith('en')
        ? profile.nameEn
        : null;
  return localized?.trim() || profile.shortName?.trim() || profile.officialName;
}

export function SchoolBrand({ profile, compact, className }: SchoolBrandProps) {
  const { i18n } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const name = getSchoolDisplayName(profile, i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => setImageFailed(false), [profile.logoUrl]);

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
        {profile.logoUrl && !imageFailed ? (
          <img
            src={profile.logoUrl}
            alt={name}
            className="h-full w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <School className="h-5 w-5 text-primary" aria-hidden="true" />
        )}
      </div>
      {!compact ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight" title={name}>{name}</div>
          <div className="text-xs text-muted-foreground">Maktab</div>
        </div>
      ) : null}
    </div>
  );
}
