import { DataSource, EntityManager } from 'typeorm';
import { SchoolProfile } from '../entity/SchoolProfile';
import type {
  SchoolProfileDto,
  SchoolProfileInput,
  SchoolProfileStatusDto,
  SchoolProfileUpdateInput,
} from '../types/schoolProfile.types';
import { runCommittedTransaction } from '../database/transaction';
import { CacheManager } from '../database/cache/cacheManager';

export class SchoolProfileAlreadyConfiguredError extends Error {
  readonly code = 'SCHOOL_PROFILE_ALREADY_CONFIGURED';
}

export class SchoolProfileNotConfiguredError extends Error {
  readonly code = 'SCHOOL_PROFILE_NOT_CONFIGURED';
}

export class SchoolProfileRevisionConflictError extends Error {
  readonly code = 'PROFILE_REVISION_CONFLICT';

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(`School profile revision conflict: expected ${expectedRevision}, actual ${actualRevision}`);
  }
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export class SchoolProfileService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheManager: CacheManager = CacheManager.getInstance()
  ) {}

  async getStatus(): Promise<SchoolProfileStatusDto> {
    const profile = await this.dataSource.getRepository(SchoolProfile).findOne({ where: { id: 1 } });
    return { configured: profile !== null, profile: profile ? this.toDto(profile) : null };
  }

  async getRequired(manager?: EntityManager): Promise<SchoolProfile> {
    const repository = (manager ?? this.dataSource.manager).getRepository(SchoolProfile);
    const profile = await repository.findOne({ where: { id: 1 } });
    if (!profile) throw new SchoolProfileNotConfiguredError('School profile is not configured');
    return profile;
  }

  async create(input: SchoolProfileInput): Promise<SchoolProfileDto> {
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const repository = manager.getRepository(SchoolProfile);
      if (await repository.exist({ where: { id: 1 } })) {
        throw new SchoolProfileAlreadyConfiguredError('School profile is already configured');
      }
      const profile = repository.create({ id: 1, revision: 1, ...this.normalize(input) });
      return this.toDto(await repository.save(profile));
    });
  }

  async update(input: SchoolProfileUpdateInput): Promise<SchoolProfileDto> {
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const profile = await this.getRequired(manager);
      this.assertRevision(profile, input.revision);
      Object.assign(profile, this.normalize(input), {
        revision: profile.revision + 1,
        updatedAt: new Date(),
      });
      return this.toDto(await manager.getRepository(SchoolProfile).save(profile));
    });
  }

  async setLogo(
    expectedRevision: number,
    fileName: string,
    mimeType: string
  ): Promise<{ profile: SchoolProfileDto; previousFileName: string | null }> {
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const profile = await this.getRequired(manager);
      this.assertRevision(profile, expectedRevision);
      const previousFileName = profile.logoFileName;
      profile.logoFileName = fileName;
      profile.logoMimeType = mimeType;
      profile.logoVersion += 1;
      profile.revision += 1;
      profile.updatedAt = new Date();
      const saved = await manager.getRepository(SchoolProfile).save(profile);
      return { profile: this.toDto(saved), previousFileName };
    });
  }

  async clearLogo(
    expectedRevision: number
  ): Promise<{ profile: SchoolProfileDto; previousFileName: string | null }> {
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const profile = await this.getRequired(manager);
      this.assertRevision(profile, expectedRevision);
      const previousFileName = profile.logoFileName;
      profile.logoFileName = null;
      profile.logoMimeType = null;
      profile.logoVersion += 1;
      profile.revision += 1;
      profile.updatedAt = new Date();
      const saved = await manager.getRepository(SchoolProfile).save(profile);
      return { profile: this.toDto(saved), previousFileName };
    });
  }

  toDto(profile: SchoolProfile): SchoolProfileDto {
    return {
      id: profile.id,
      revision: profile.revision,
      officialName: profile.officialName,
      shortName: profile.shortName,
      nameFa: profile.nameFa,
      namePs: profile.namePs,
      nameEn: profile.nameEn,
      schoolCode: profile.schoolCode,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      defaultLanguage: profile.defaultLanguage,
      logoUrl: profile.logoFileName
        ? `/api/config/school-profile/logo?v=${profile.logoVersion}`
        : null,
      logoVersion: profile.logoVersion,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private normalize(input: SchoolProfileInput) {
    return {
      officialName: input.officialName.trim(),
      shortName: nullableText(input.shortName),
      nameFa: nullableText(input.nameFa),
      namePs: nullableText(input.namePs),
      nameEn: nullableText(input.nameEn),
      schoolCode: nullableText(input.schoolCode),
      address: nullableText(input.address),
      phone: nullableText(input.phone),
      email: nullableText(input.email),
      website: nullableText(input.website),
      defaultLanguage: input.defaultLanguage,
    };
  }

  private assertRevision(profile: SchoolProfile, expectedRevision: number): void {
    if (profile.revision !== expectedRevision) {
      throw new SchoolProfileRevisionConflictError(expectedRevision, profile.revision);
    }
  }
}
