import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Loader2, School } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCreateSchoolProfile, useUploadSchoolLogo } from '../hooks/useSchoolProfile';
import {
  schoolProfileFormSchema,
  type SchoolProfileFormValues,
} from '../schemas/schoolProfile.schema';
import { SchoolProfileFields } from './SchoolProfileFields';

export function SchoolSetupPage() {
  const { t } = useTranslation();
  const createProfile = useCreateSchoolProfile();
  const uploadLogo = useUploadSchoolLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const form = useForm<SchoolProfileFormValues>({
    resolver: zodResolver(schoolProfileFormSchema),
    defaultValues: {
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
    },
  });
  const pending = createProfile.isPending || uploadLogo.isPending;

  const submit = async (values: SchoolProfileFormValues) => {
    const profile = await createProfile.mutateAsync(values);
    if (logo) await uploadLogo.mutateAsync({ file: logo, revision: profile.revision });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-2xl border-2 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <School className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">{t('schoolSettings.setup.title')}</CardTitle>
          <CardDescription>{t('schoolSettings.setup.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
            <SchoolProfileFields form={form} disabled={pending} compact />
            <div className="rounded-xl border border-dashed p-4">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={pending}>
                <ImagePlus className="me-2 h-4 w-4" />
                {logo?.name ?? t('schoolSettings.profile.chooseLogo')}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{t('schoolSettings.profile.logoHelp')}</p>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp"
                aria-label={t('schoolSettings.profile.chooseLogo')}
                onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={pending}>
              {pending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t('schoolSettings.setup.continue')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
