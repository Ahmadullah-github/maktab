import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { getRoomTypeIcon } from '@/constants/roomTypes';
import {
  useArchivedRoomTypes,
  useCreateRoomType,
  useDeleteRoomType,
  useRestoreRoomType,
  useRoomTypesWithIcons,
} from '@/features/settings';
import { ArchiveRestore, Building2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const ICONS = ['Building', 'Beaker', 'Library', 'Dumbbell'] as const;

export function RoomTypeSettingsCard() {
  const { t, i18n } = useTranslation();
  const { data: activeTypes } = useRoomTypesWithIcons();
  const { data: archivedTypes = [] } = useArchivedRoomTypes();
  const createMutation = useCreateRoomType();
  const deleteMutation = useDeleteRoomType();
  const restoreMutation = useRestoreRoomType();
  const [value, setValue] = useState('');
  const [labelFa, setLabelFa] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [icon, setIcon] = useState<(typeof ICONS)[number]>('Building');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const submit = async () => {
    try {
      await createMutation.mutateAsync({ value, labelFa, labelEn, icon });
      setValue('');
      setLabelFa('');
      setLabelEn('');
      setIcon('Building');
      toast.success(t('schoolSettings.roomTypes.created'));
    } catch (error) {
      toast.error(t('schoolSettings.roomTypes.createFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const remove = async () => {
    if (deleteId === null) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success(t('schoolSettings.roomTypes.archivedSuccess'));
      setDeleteId(null);
    } catch (error) {
      toast.error(t('schoolSettings.roomTypes.archiveFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const restore = async (id: number) => {
    try {
      await restoreMutation.mutateAsync(id);
      toast.success(t('schoolSettings.roomTypes.restoredSuccess'));
    } catch (error) {
      toast.error(t('schoolSettings.roomTypes.restoreFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <>
      <SectionCard
        icon={Building2}
        iconColor="bg-linear-to-br from-teal-500 to-cyan-600"
        title={t('schoolSettings.roomTypes.title')}
        description={t('schoolSettings.roomTypes.description')}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="room-type-value">{t('schoolSettings.roomTypes.value')}</Label>
              <Input
                id="room-type-value"
                value={value}
                onChange={(event) => setValue(event.target.value.toLowerCase())}
                placeholder="science_lab"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('schoolSettings.roomTypes.icon')}</Label>
              <Select value={icon} onValueChange={(next) => setIcon(next as typeof icon)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICONS.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-type-label-fa">{t('schoolSettings.roomTypes.labelFa')}</Label>
              <Input id="room-type-label-fa" value={labelFa} onChange={(event) => setLabelFa(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-type-label-en">{t('schoolSettings.roomTypes.labelEn')}</Label>
              <Input id="room-type-label-en" value={labelEn} onChange={(event) => setLabelEn(event.target.value)} />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={
              !value.trim() || !labelFa.trim() || !labelEn.trim() || createMutation.isPending
            }
            className="gap-2"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('schoolSettings.roomTypes.add')}
          </Button>

          <div className="grid gap-2 md:grid-cols-2">
            {activeTypes.map((roomType) => {
              const Icon = roomType.IconComponent;
              return (
                <div key={roomType.value} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{roomType.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{roomType.value}</p>
                  </div>
                  {roomType.isSystem ? <Badge variant="secondary">{t('schoolSettings.roomTypes.system')}</Badge> : null}
                  {roomType.id ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteId(roomType.id!)} aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {archivedTypes.length > 0 ? (
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-semibold">{t('schoolSettings.roomTypes.archived')}</h4>
              {archivedTypes.map((roomType) => {
                const Icon = getRoomTypeIcon(roomType.icon);
                const label = i18n.language.startsWith('fa') ? roomType.labelFa : roomType.labelEn;
                return (
                  <div key={roomType.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-sm">{label}</span>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void restore(roomType.id!)} disabled={restoreMutation.isPending}>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      {t('schoolSettings.roomTypes.restore')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('schoolSettings.roomTypes.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('schoolSettings.roomTypes.archiveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void remove(); }}>
              {t('schoolSettings.roomTypes.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
