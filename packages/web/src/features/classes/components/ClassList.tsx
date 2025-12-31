import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid, Column } from '@/components/ui/data-grid/DataGrid';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Mock Data
const MOCK_CLASSES = [
  { id: '1', name: '7-A', grade: '7', room: '101', students: '32' },
  { id: '2', name: '7-B', grade: '7', room: '102', students: '30' },
  { id: '3', name: '8-A', grade: '8', room: '201', students: '35' },
];

export const ClassList = () => {
  const { t } = useTranslation();
  const [classes, setClasses] = useState(MOCK_CLASSES);

  const columns: Column[] = [
    { id: 'name', title: t('classes.className'), type: 'text' },
    { id: 'grade', title: t('classes.gradeLevel'), type: 'select', options: ['7', '8', '9', '10', '11', '12'] },
    { id: 'room', title: t('classes.homeRoom'), type: 'text' },
    { id: 'students', title: t('classes.students'), type: 'text' },
  ];

  return (
    <div className="h-full p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('classes.title')}</h2>
          <p className="text-muted-foreground">{t('classes.description')}</p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all shadow-md hover:shadow-lg">
          <Plus className="mr-2 h-4 w-4" />
          {t('classes.add', 'Add Class')}
        </Button>
      </div>
      <div className="h-[calc(100%-80px)]">
        <DataGrid columns={columns} data={classes} onDataChange={setClasses} />
      </div>
    </div>
  );
};
