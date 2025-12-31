import { useTranslation } from 'react-i18next';

export const DashboardView = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-card to-muted/40 p-6 rounded-xl border shadow-sm hover:shadow-md transition-all hover:scale-[1.01]">
        <h3 className="font-semibold mb-2 text-muted-foreground text-sm uppercase tracking-wider">
          {t('dashboard.totalTeachers')}
        </h3>
        <div className="text-4xl font-bold text-primary">42</div>
        <div className="text-xs mt-2 text-emerald-600 font-medium bg-emerald-100/50 dark:bg-emerald-900/20 px-2 py-1 rounded w-fit">
          {t('dashboard.teachersTrend')}
        </div>
      </div>
      <div className="bg-gradient-to-br from-card to-muted/40 p-6 rounded-xl border shadow-sm hover:shadow-md transition-all hover:scale-[1.01]">
        <h3 className="font-semibold mb-2 text-muted-foreground text-sm uppercase tracking-wider">
          {t('dashboard.activeClasses')}
        </h3>
        <div className="text-4xl font-bold text-primary">12</div>
        <div className="text-xs text-muted-foreground mt-2">{t('dashboard.classesRange')}</div>
      </div>
      <div className="bg-gradient-to-br from-card to-muted/40 p-6 rounded-xl border shadow-sm hover:shadow-md transition-all hover:scale-[1.01]">
        <h3 className="font-semibold mb-2 text-muted-foreground text-sm uppercase tracking-wider">
          {t('dashboard.constraints')}
        </h3>
        <div className="text-4xl font-bold text-primary">840</div>
        <div className="text-xs text-muted-foreground mt-2">{t('dashboard.constraintsType')}</div>
      </div>
    </div>
  );
};
