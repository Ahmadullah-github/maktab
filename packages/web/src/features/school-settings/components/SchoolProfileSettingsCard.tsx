import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, ImagePlus, Loader2, Save, School, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  useDeleteSchoolLogo,
  useSchoolProfile,
  useUpdateSchoolProfile,
  useUploadSchoolLogo,
} from '../hooks/useSchoolProfile';
import {
  schoolProfileFormSchema,
  type SchoolProfileFormValues,
} from '../schemas/schoolProfile.schema';
import type { SchoolProfileDto } from '../schemas/schoolProfileDto.schema';
import { SchoolProfileFields } from './SchoolProfileFields';

const EMPTY_VALUES: SchoolProfileFormValues = {
  officialName: '',
  shortName: '',
  nameFa: '',
  namePs: '',
  nameEn: '',
  schoolCode: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  defaultLanguage: 'fa',
};

function valuesFromProfile(profile: SchoolProfileDto): SchoolProfileFormValues {
  return {
    officialName: profile.officialName,
    shortName: profile.shortName ?? '',
    nameFa: profile.nameFa ?? '',
    namePs: profile.namePs ?? '',
    nameEn: profile.nameEn ?? '',
    schoolCode: profile.schoolCode ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    website: profile.website ?? '',
    defaultLanguage: profile.defaultLanguage,
  };
}

export function SchoolProfileSettingsCard() {
  const { t } = useTranslation();
  const { data } = useSchoolProfile();
  const profile = data?.profile ?? null;
  const updateProfile = useUpdateSchoolProfile();
  const uploadLogo = useUploadSchoolLogo();
  const deleteLogo = useDeleteSchoolLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const form = useForm<SchoolProfileFormValues>({
    resolver: zodResolver(schoolProfileFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (profile) form.reset(valuesFromProfile(profile));
  }, [form, profile]);

  useEffect(() => setImageFailed(false), [profile?.logoUrl]);

  if (!profile) return null;
  const pending = updateProfile.isPending || uploadLogo.isPending || deleteLogo.isPending;

  const onLogoSelected = (file?: File) => {
    if (!file) return;
    uploadLogo.mutate({ file, revision: profile.revision });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="border-2 border-border/50 shadow-sm">
      <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{t('schoolSettings.profile.title')}</CardTitle>
            <CardDescription>{t('schoolSettings.profile.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 p-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-background">
            {profile.logoUrl && !imageFailed ? (
              <img
                src={profile.logoUrl}
                alt={profile.officialName}
                className="h-full w-full object-contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <School className="h-9 w-9 text-primary" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={pending}>
                <ImagePlus className="me-2 h-4 w-4" />
                {t('schoolSettings.profile.chooseLogo')}
              </Button>
              {profile.logoUrl ? (
                <Button type="button" variant="outline" onClick={() => deleteLogo.mutate(profile.revision)} disabled={pending}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('schoolSettings.profile.removeLogo')}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t('schoolSettings.profile.logoHelp')}</p>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t('schoolSettings.profile.chooseLogo')}
              onChange={(event) => onLogoSelected(event.target.files?.[0])}
            />
          </div>
        </div>

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((values) =>
            updateProfile.mutate({ values, revision: profile.revision })
          )}
        >
          <SchoolProfileFields form={form} disabled={pending} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !form.formState.isDirty}>
              {updateProfile.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="me-2 h-4 w-4" />
              )}
              {t('schoolSettings.profile.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
