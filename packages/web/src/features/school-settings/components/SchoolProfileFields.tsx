import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { SchoolProfileFormValues } from '../schemas/schoolProfile.schema';

interface SchoolProfileFieldsProps {
  form: UseFormReturn<SchoolProfileFormValues>;
  disabled?: boolean;
  compact?: boolean;
}

export function SchoolProfileFields({ form, disabled, compact }: SchoolProfileFieldsProps) {
  const { t } = useTranslation();
  const field = (
    name: keyof SchoolProfileFormValues,
    required = false,
    type: 'text' | 'email' | 'url' | 'tel' = 'text'
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`school-profile-${name}`}>
        {t(`schoolSettings.profile.fields.${name}`)}
        {required ? <span className="text-destructive ms-1">*</span> : null}
      </Label>
      <Input
        id={`school-profile-${name}`}
        type={type}
        disabled={disabled}
        aria-invalid={Boolean(form.formState.errors[name])}
        aria-describedby={form.formState.errors[name] ? `school-profile-${name}-error` : undefined}
        {...form.register(name)}
      />
      {form.formState.errors[name]?.message ? (
        <p id={`school-profile-${name}-error`} className="text-xs text-destructive" role="alert">
          {t(String(form.formState.errors[name]?.message))}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {field('officialName', true)}
        {field('shortName')}
        {!compact && field('nameFa')}
        {!compact && field('namePs')}
        {!compact && field('nameEn')}
        {!compact && field('schoolCode')}
      </div>

      {!compact ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="school-profile-address">
              {t('schoolSettings.profile.fields.address')}
            </Label>
            <Textarea
              id="school-profile-address"
              disabled={disabled}
              rows={3}
              {...form.register('address')}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {field('phone', false, 'tel')}
            {field('email', false, 'email')}
            {field('website', false, 'url')}
          </div>
        </>
      ) : null}

      <div className="space-y-2 md:max-w-xs">
        <Label htmlFor="school-profile-default-language">
          {t('schoolSettings.profile.fields.defaultLanguage')}
        </Label>
        <Select
          value={form.watch('defaultLanguage')}
          onValueChange={(value: 'fa' | 'en') =>
            form.setValue('defaultLanguage', value, { shouldDirty: true })
          }
          disabled={disabled}
        >
          <SelectTrigger id="school-profile-default-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fa">دری</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
