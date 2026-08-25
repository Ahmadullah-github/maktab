import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassGroup } from '../entity/ClassGroup';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { SchoolCurriculumItem } from '../entity/SchoolCurriculumItem';
import { SchoolCurriculumPlan } from '../entity/SchoolCurriculumPlan';
import { Room } from '../entity/Room';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { Timetable } from '../entity/Timetable';
import { WizardStep } from '../entity/WizardStep';

export interface DatabaseResetOptions {
  wipeTeachers: boolean;
}

export interface DatabaseResetResult {
  deleted: Record<string, number>;
  wipeTeachers: boolean;
}

async function countRows<T extends ObjectLiteral>(
  dataSource: DataSource,
  entity: EntityTarget<T>
): Promise<number> {
  return dataSource.getRepository(entity).count();
}

/** Destructive planning-data reset used only by the local CLI. */
export class DatabaseResetService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheManager: CacheManager
  ) {}

  async reset(options: DatabaseResetOptions): Promise<DatabaseResetResult> {
    const deleted: Record<string, number> = {
      teachingAssignments: await countRows(this.dataSource, TeachingAssignment),
      capabilities: await countRows(this.dataSource, TeacherSubjectCapability),
      requirements: await countRows(this.dataSource, ClassSubjectRequirement),
      wizardSteps: await countRows(this.dataSource, WizardStep),
      curriculumItems: await countRows(this.dataSource, SchoolCurriculumItem),
      curriculumPlans: await countRows(this.dataSource, SchoolCurriculumPlan),
      timetables: await countRows(this.dataSource, Timetable),
      classes: await countRows(this.dataSource, ClassGroup),
      rooms: await countRows(this.dataSource, Room),
      subjects: await countRows(this.dataSource, Subject),
      teachers: options.wipeTeachers ? await countRows(this.dataSource, Teacher) : 0,
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(TeachingAssignment).clear();
      await manager.getRepository(TeacherSubjectCapability).clear();
      await manager.getRepository(ClassSubjectRequirement).clear();
      await manager.getRepository(WizardStep).clear();
      await manager.getRepository(SchoolCurriculumItem).clear();
      await manager.getRepository(SchoolCurriculumPlan).clear();
      await manager.getRepository(Timetable).clear();
      await manager.getRepository(ClassGroup).clear();
      await manager.getRepository(Room).clear();
      await manager.getRepository(Subject).clear();

      if (options.wipeTeachers) {
        await manager.getRepository(Teacher).clear();
      } else {
        await manager
          .createQueryBuilder()
          .update(Teacher)
          .set({
            preferredRoomIds: '[]',
            updatedAt: new Date(),
          })
          .execute();
      }
    });

    this.cacheManager.clear();
    return { deleted, wipeTeachers: options.wipeTeachers };
  }
}
