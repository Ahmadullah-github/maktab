export interface ExportBranding {
  schoolName: string;
  generatedAt: string;
  address?: string;
  website?: string;
  logoBase64?: string;
  logoMimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  ministryLogoBase64?: string;
  ministryLogoMimeType?: 'image/png';
}
