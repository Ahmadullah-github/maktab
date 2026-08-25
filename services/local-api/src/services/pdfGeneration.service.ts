export interface DisplaySettings {
  showSubjectName: boolean;
  showTeacherName: boolean;
  showRoomName: boolean;
  cellSize: 'compact' | 'normal' | 'large';
  fontSize: 'sm' | 'md' | 'lg';
  colorBy: 'none' | 'subject' | 'teacher';
}

export interface ScheduleData { id: number; name: string; type: 'class' | 'teacher'; targetId: string; timetableData: unknown; }
export interface AnalysisSummary { totalClasses: number; totalTeachers: number; totalSubjects: number; totalRooms: number; utilizationRate: number; conflictCount: number; generatedAt: string; schoolName?: string; }
export interface PDFGenerationOptions { schedules: ScheduleData[]; language: 'fa' | 'en'; displaySettings: DisplaySettings; includeAnalysis: boolean; analysisSummary?: AnalysisSummary; }

/** PDF is a native desktop capability in v1, avoiding a second packaged browser runtime. */
export class PDFGenerationService {
  async generatePDF(_options: PDFGenerationOptions): Promise<Buffer> {
    throw new Error('PDF_NATIVE_DESKTOP_REQUIRED');
  }
  async close(): Promise<void> {}
}
