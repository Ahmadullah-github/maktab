import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

/** Singleton identity and contact profile for this school installation. */
@Entity('school_profile')
export class SchoolProfile extends BaseEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number = 1;

  @Column({ type: 'integer', default: 1 })
  revision: number = 1;

  @Column({ type: 'text' })
  officialName: string = '';

  @Column({ type: 'text', nullable: true })
  shortName: string | null = null;

  @Column({ type: 'text', nullable: true })
  nameFa: string | null = null;

  @Column({ type: 'text', nullable: true })
  namePs: string | null = null;

  @Column({ type: 'text', nullable: true })
  nameEn: string | null = null;

  @Column({ type: 'text', nullable: true })
  schoolCode: string | null = null;

  @Column({ type: 'text', nullable: true })
  address: string | null = null;

  @Column({ type: 'text', nullable: true })
  phone: string | null = null;

  @Column({ type: 'text', nullable: true })
  email: string | null = null;

  @Column({ type: 'text', nullable: true })
  website: string | null = null;

  @Column({ type: 'text', default: 'fa' })
  defaultLanguage: 'fa' | 'en' = 'fa';

  @Column({ type: 'text', nullable: true })
  logoFileName: string | null = null;

  @Column({ type: 'text', nullable: true })
  logoMimeType: string | null = null;

  @Column({ type: 'integer', default: 0 })
  logoVersion: number = 0;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
