export type SchoolProfileLanguage = 'fa' | 'en';

export interface SchoolProfileDto {
  id: number;
  revision: number;
  officialName: string;
  shortName: string | null;
  nameFa: string | null;
  namePs: string | null;
  nameEn: string | null;
  schoolCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultLanguage: SchoolProfileLanguage;
  logoUrl: string | null;
  logoVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolProfileStatusDto {
  configured: boolean;
  profile: SchoolProfileDto | null;
}

export interface SchoolProfileInput {
  officialName: string;
  shortName?: string | null;
  nameFa?: string | null;
  namePs?: string | null;
  nameEn?: string | null;
  schoolCode?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  defaultLanguage: SchoolProfileLanguage;
}

export interface SchoolProfileUpdateInput extends SchoolProfileInput {
  revision: number;
}
