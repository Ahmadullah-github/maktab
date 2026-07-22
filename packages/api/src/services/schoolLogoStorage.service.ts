import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { DataSource } from 'typeorm';

export const MAX_SCHOOL_LOGO_BYTES = 2 * 1024 * 1024;
export const SCHOOL_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type SchoolLogoMimeType = (typeof SCHOOL_LOGO_MIME_TYPES)[number];

const MIME_EXTENSIONS: Record<SchoolLogoMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export class InvalidSchoolLogoError extends Error {
  readonly code = 'INVALID_SCHOOL_LOGO';
}

export function isSchoolLogoMimeType(value: string): value is SchoolLogoMimeType {
  return SCHOOL_LOGO_MIME_TYPES.includes(value as SchoolLogoMimeType);
}

export function validateSchoolLogoBytes(bytes: Buffer, mimeType: SchoolLogoMimeType): void {
  if (bytes.length === 0 || bytes.length > MAX_SCHOOL_LOGO_BYTES) {
    throw new InvalidSchoolLogoError('School logo must be between 1 byte and 2 MiB');
  }

  const valid =
    (mimeType === 'image/png' &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mimeType === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mimeType === 'image/webp' &&
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!valid) {
    throw new InvalidSchoolLogoError('School logo content does not match its declared image type');
  }
}

function resolveAssetDirectory(dataSource: DataSource): string {
  if (process.env.ASSET_STORAGE_PATH) return path.resolve(process.env.ASSET_STORAGE_PATH);
  const database = dataSource.options.type === 'better-sqlite3' ? dataSource.options.database : null;
  if (typeof database === 'string' && database !== ':memory:' && !database.startsWith('file::memory:')) {
    return path.join(path.dirname(path.resolve(database)), 'assets', 'school');
  }
  return path.join(os.tmpdir(), 'maktab-assets', String(process.pid), 'school');
}

export class SchoolLogoStorageService {
  readonly directory: string;

  constructor(dataSource: DataSource) {
    this.directory = resolveAssetDirectory(dataSource);
  }

  async write(bytes: Buffer, mimeType: SchoolLogoMimeType): Promise<string> {
    validateSchoolLogoBytes(bytes, mimeType);
    await fs.mkdir(this.directory, { recursive: true });
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const fileName = `school-logo-${digest}-${randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
    const temporaryPath = path.join(this.directory, `.${fileName}.tmp`);
    const finalPath = path.join(this.directory, fileName);
    await fs.writeFile(temporaryPath, bytes, { flag: 'wx' });
    await fs.rename(temporaryPath, finalPath);
    return fileName;
  }

  async read(fileName: string): Promise<Buffer> {
    return fs.readFile(this.resolveFile(fileName));
  }

  async remove(fileName: string | null): Promise<void> {
    if (!fileName) return;
    await fs.unlink(this.resolveFile(fileName)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private resolveFile(fileName: string): string {
    if (path.basename(fileName) !== fileName) {
      throw new InvalidSchoolLogoError('Invalid school logo path');
    }
    return path.join(this.directory, fileName);
  }
}
