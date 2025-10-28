import { AppDataSource } from "../../ormconfig";
import { Timetable } from "../entity/Timetable";
import { Configuration } from "../entity/Configuration";
import { WizardStep } from "../entity/WizardStep";
import { Teacher } from "../entity/Teacher";
import { Subject } from "../entity/Subject";
import { Room } from "../entity/Room";
import { ClassGroup } from "../entity/ClassGroup";

export class DatabaseService {
  private static instance: DatabaseService;
  private initialized = false;
  private timetableCache: Map<number, Timetable> = new Map();
  private allTimetablesCache: Timetable[] | null = null;
  private configCache: Map<string, Configuration> = new Map();
  private wizardStepCache: Map<string, WizardStep> = new Map();
  private teacherCache: Map<number, Teacher> = new Map();
  private subjectCache: Map<number, Subject> = new Map();
  private roomCache: Map<number, Room> = new Map();
  private classCache: Map<number, ClassGroup> = new Map();
  private allTeachersCache: Teacher[] | null = null;
  private allSubjectsCache: Subject[] | null = null;
  private allRoomsCache: Room[] | null = null;
  private allClassesCache: ClassGroup[] | null = null;
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await AppDataSource.initialize();
      console.log("Database connection established");
      this.initialized = true;
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry) return false;
    return Date.now() < expiry;
  }

  private setCacheExpiry(key: string): void {
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCache(key: string): void {
    this.cacheExpiry.delete(key);
  }

  // Timetable methods
  async saveTimetable(
    name: string,
    description: string,
    data: any
  ): Promise<Timetable> {
    try {
      const timetable = new Timetable();
      timetable.name = name;
      timetable.description = description;
      timetable.data = JSON.stringify(data);
      timetable.createdAt = new Date();
      timetable.updatedAt = new Date();

      const savedTimetable = await AppDataSource.getRepository(Timetable).save(
        timetable
      );

      // Update cache
      this.timetableCache.set(savedTimetable.id, savedTimetable);
      this.setCacheExpiry(`timetable_${savedTimetable.id}`);
      this.allTimetablesCache = null; // Invalidate all timetables cache
      this.clearCache("all_timetables");

      console.log(`Saved timetable with ID: ${savedTimetable.id}`);
      return savedTimetable;
    } catch (error) {
      console.error("Error saving timetable:", error);
      throw error;
    }
  }

  async getTimetable(id: number): Promise<Timetable | null> {
    try {
      // Check cache first
      if (this.timetableCache.has(id) && this.isCacheValid(`timetable_${id}`)) {
        console.log(`Retrieved timetable ${id} from cache`);
        return this.timetableCache.get(id) || null;
      }

      const timetable = await AppDataSource.getRepository(Timetable).findOneBy({
        id,
      });

      // Update cache
      if (timetable) {
        this.timetableCache.set(id, timetable);
        this.setCacheExpiry(`timetable_${id}`);
        console.log(`Retrieved timetable ${id} from database and cached`);
      } else {
        console.log(`Timetable ${id} not found`);
      }

      return timetable;
    } catch (error) {
      console.error("Error fetching timetable:", error);
      throw error;
    }
  }

  async getAllTimetables(): Promise<Timetable[]> {
    try {
      // Check cache first
      if (this.allTimetablesCache && this.isCacheValid("all_timetables")) {
        console.log("Retrieved all timetables from cache");
        return this.allTimetablesCache;
      }

      const timetables = await AppDataSource.getRepository(Timetable).find();

      // Update cache
      this.allTimetablesCache = timetables;
      this.setCacheExpiry("all_timetables");

      console.log(
        `Retrieved ${timetables.length} timetables from database and cached`
      );
      return timetables;
    } catch (error) {
      console.error("Error fetching timetables:", error);
      throw error;
    }
  }

  async updateTimetable(id: number, data: any): Promise<Timetable | null> {
    try {
      const timetable = await AppDataSource.getRepository(Timetable).findOneBy({
        id,
      });
      if (timetable) {
        timetable.data = JSON.stringify(data);
        timetable.updatedAt = new Date();
        const updatedTimetable = await AppDataSource.getRepository(
          Timetable
        ).save(timetable);

        // Update cache
        this.timetableCache.set(id, updatedTimetable);
        this.setCacheExpiry(`timetable_${id}`);
        this.allTimetablesCache = null; // Invalidate all timetables cache
        this.clearCache("all_timetables");

        console.log(`Updated timetable with ID: ${id}`);
        return updatedTimetable;
      }
      console.log(`Timetable ${id} not found for update`);
      return null;
    } catch (error) {
      console.error("Error updating timetable:", error);
      throw error;
    }
  }

  async deleteTimetable(id: number): Promise<boolean> {
    try {
      const result = await AppDataSource.getRepository(Timetable).delete(id);

      // Update cache
      this.timetableCache.delete(id);
      this.allTimetablesCache = null; // Invalidate all timetables cache
      this.clearCache("all_timetables");

      const success = result.affected !== 0;
      if (success) {
        console.log(`Deleted timetable with ID: ${id}`);
      } else {
        console.log(`Timetable ${id} not found for deletion`);
      }
      return success;
    } catch (error) {
      console.error("Error deleting timetable:", error);
      throw error;
    }
  }

  // Configuration methods
  async saveConfiguration(key: string, value: string): Promise<Configuration> {
    try {
      const repo = AppDataSource.getRepository(Configuration);
      let config = await repo.findOneBy({ key });
      if (!config) {
        config = new Configuration();
        config.key = key;
      }
      config.value = value;
      config.updatedAt = new Date();

      const savedConfig = await repo.save(config);

      // Update cache
      this.configCache.set(key, savedConfig);
      this.setCacheExpiry(`config_${key}`);

      console.log(`Saved configuration with key: ${key}`);
      return savedConfig;
    } catch (error) {
      console.error("Error saving configuration:", error);
      throw error;
    }
  }

  async getConfiguration(key: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.configCache.has(key) && this.isCacheValid(`config_${key}`)) {
        console.log(`Retrieved configuration ${key} from cache`);
        return this.configCache.get(key)?.value || null;
      }

      const config = await AppDataSource.getRepository(Configuration).findOneBy(
        { key }
      );

      // Update cache
      if (config) {
        this.configCache.set(key, config);
        this.setCacheExpiry(`config_${key}`);
        console.log(`Retrieved configuration ${key} from database and cached`);
        return config.value;
      }

      console.log(`Configuration ${key} not found`);
      return null;
    } catch (error) {
      console.error("Error fetching configuration:", error);
      throw error;
    }
  }

  async getAllConfigurations(): Promise<Configuration[]> {
    try {
      const configs = await AppDataSource.getRepository(Configuration).find();
      console.log(`Retrieved ${configs.length} configurations from database`);
      return configs;
    } catch (error) {
      console.error("Error fetching configurations:", error);
      throw error;
    }
  }

  // Wizard Step methods
  async saveWizardStep(
    wizardId: number,
    stepKey: string,
    data: any
  ): Promise<WizardStep> {
    try {
      const repo = AppDataSource.getRepository(WizardStep);
      let step = await repo.findOneBy({ wizardId, stepKey });

      if (!step) {
        step = new WizardStep();
        step.wizardId = wizardId;
        step.stepKey = stepKey;
        console.log(
          `Creating new wizard step: ${stepKey} for wizard ${wizardId}`
        );
      } else {
        console.log(
          `Updating existing wizard step: ${stepKey} for wizard ${wizardId}`
        );
      }

      step.data = JSON.stringify(data);
      step.updatedAt = new Date();

      const savedStep = await repo.save(step);

      // Update cache
      const cacheKey = `wizard_${wizardId}_step_${stepKey}`;
      this.wizardStepCache.set(cacheKey, savedStep);
      this.setCacheExpiry(cacheKey);

      console.log(
        `Saved wizard step: ${stepKey} for wizard ${wizardId} with ID: ${savedStep.id}`
      );
      return savedStep;
    } catch (error) {
      console.error(
        `Error saving wizard step ${stepKey} for wizard ${wizardId}:`,
        error
      );
      throw error;
    }
  }

  async getWizardStep(
    wizardId: number,
    stepKey: string
  ): Promise<WizardStep | null> {
    try {
      // Check cache first
      const cacheKey = `wizard_${wizardId}_step_${stepKey}`;
      if (this.wizardStepCache.has(cacheKey) && this.isCacheValid(cacheKey)) {
        console.log(
          `Retrieved wizard step ${stepKey} for wizard ${wizardId} from cache`
        );
        return this.wizardStepCache.get(cacheKey) || null;
      }

      const step = await AppDataSource.getRepository(WizardStep).findOneBy({
        wizardId,
        stepKey,
      });

      // Update cache
      if (step) {
        this.wizardStepCache.set(cacheKey, step);
        this.setCacheExpiry(cacheKey);
        console.log(
          `Retrieved wizard step ${stepKey} for wizard ${wizardId} from database and cached`
        );
      } else {
        console.log(`Wizard step ${stepKey} for wizard ${wizardId} not found`);
      }

      return step;
    } catch (error) {
      console.error(
        `Error fetching wizard step ${stepKey} for wizard ${wizardId}:`,
        error
      );
      throw error;
    }
  }

  async getAllWizardSteps(wizardId: number): Promise<WizardStep[]> {
    try {
      const steps = await AppDataSource.getRepository(WizardStep).findBy({
        wizardId,
      });
      console.log(
        `Retrieved ${steps.length} wizard steps for wizard ${wizardId} from database`
      );
      return steps;
    } catch (error) {
      console.error(
        `Error fetching all wizard steps for wizard ${wizardId}:`,
        error
      );
      throw error;
    }
  }

  async deleteWizardSteps(wizardId: number): Promise<boolean> {
    try {
      const result = await AppDataSource.getRepository(WizardStep).delete({
        wizardId,
      });

      // Clear cache entries for this wizard
      for (const [key] of this.wizardStepCache) {
        if (key.startsWith(`wizard_${wizardId}_step_`)) {
          this.wizardStepCache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }

      const success = result.affected !== 0;
      if (success) {
        console.log(
          `Deleted ${result.affected} wizard steps for wizard ${wizardId}`
        );
      } else {
        console.log(`No wizard steps found for wizard ${wizardId} to delete`);
      }
      return success;
    } catch (error) {
      console.error(
        `Error deleting wizard steps for wizard ${wizardId}:`,
        error
      );
      throw error;
    }
  }

  // Teacher methods
  async saveTeacher(teacherData: any): Promise<Teacher> {
    try {
      const repo = AppDataSource.getRepository(Teacher);
      const teacher = new Teacher();
      teacher.fullName = teacherData.fullName;
      teacher.primarySubjectIds = JSON.stringify(
        teacherData.primarySubjectIds || []
      );
      teacher.allowedSubjectIds = JSON.stringify(
        teacherData.allowedSubjectIds || []
      );
      teacher.restrictToPrimarySubjects =
        teacherData.restrictToPrimarySubjects !== undefined
          ? teacherData.restrictToPrimarySubjects
          : true;
      teacher.availability = JSON.stringify(teacherData.availability || {});
      teacher.unavailable = JSON.stringify(teacherData.unavailable || []);
      teacher.maxPeriodsPerWeek = teacherData.maxPeriodsPerWeek || 0;
      teacher.maxPeriodsPerDay = teacherData.maxPeriodsPerDay || 0;
      teacher.maxConsecutivePeriods = teacherData.maxConsecutivePeriods || 0;
      teacher.timePreference = teacherData.timePreference || "";
      teacher.preferredRoomIds = JSON.stringify(
        teacherData.preferredRoomIds || []
      );
      teacher.preferredColleagues = JSON.stringify(
        teacherData.preferredColleagues || []
      );
      teacher.meta = JSON.stringify(teacherData.meta || {});
      teacher.createdAt = new Date();
      teacher.updatedAt = new Date();

      const savedTeacher = await repo.save(teacher);

      // Parse JSON fields for return value
      try {
        (savedTeacher as any).primarySubjectIds = JSON.parse(
          savedTeacher.primarySubjectIds || "[]"
        );
        (savedTeacher as any).allowedSubjectIds = JSON.parse(
          savedTeacher.allowedSubjectIds || "[]"
        );
        (savedTeacher as any).availability = JSON.parse(
          savedTeacher.availability || "{}"
        );
        (savedTeacher as any).unavailable = JSON.parse(
          savedTeacher.unavailable || "[]"
        );
        (savedTeacher as any).preferredRoomIds = JSON.parse(
          savedTeacher.preferredRoomIds || "[]"
        );
        (savedTeacher as any).preferredColleagues = JSON.parse(
          savedTeacher.preferredColleagues || "[]"
        );
        (savedTeacher as any).meta = JSON.parse(savedTeacher.meta || "{}");
      } catch (parseError) {
        console.error(
          `Error parsing JSON fields for saved teacher ${savedTeacher.id}:`,
          parseError
        );
        // Return raw string values if parsing fails
      }

      // Update cache
      this.teacherCache.set(savedTeacher.id, savedTeacher);
      this.setCacheExpiry(`teacher_${savedTeacher.id}`);
      this.allTeachersCache = null; // Invalidate all teachers cache
      this.clearCache("all_teachers");

      console.log(`Saved teacher with ID: ${savedTeacher.id}`);
      return savedTeacher;
    } catch (error) {
      console.error("Error saving teacher:", error);
      throw error;
    }
  }

  async getTeacher(id: number): Promise<Teacher | null> {
    try {
      // Check cache first
      if (this.teacherCache.has(id) && this.isCacheValid(`teacher_${id}`)) {
        console.log(`Retrieved teacher ${id} from cache`);
        const cachedTeacher = this.teacherCache.get(id);
        return cachedTeacher ? cachedTeacher : null;
      }

      const teacher = await AppDataSource.getRepository(Teacher).findOneBy({
        id,
      });

      // Parse JSON fields
      if (teacher) {
        try {
          const parsedTeacher: any = { ...teacher };
          parsedTeacher.primarySubjectIds = JSON.parse(
            teacher.primarySubjectIds || "[]"
          );
          parsedTeacher.allowedSubjectIds = JSON.parse(
            teacher.allowedSubjectIds || "[]"
          );
          parsedTeacher.availability = JSON.parse(teacher.availability || "{}");
          parsedTeacher.unavailable = JSON.parse(teacher.unavailable || "[]");
          parsedTeacher.preferredRoomIds = JSON.parse(
            teacher.preferredRoomIds || "[]"
          );
          parsedTeacher.preferredColleagues = JSON.parse(
            teacher.preferredColleagues || "[]"
          );
          parsedTeacher.meta = JSON.parse(teacher.meta || "{}");

          // Update cache
          this.teacherCache.set(id, parsedTeacher as Teacher);
          this.setCacheExpiry(`teacher_${id}`);
          console.log(`Retrieved teacher ${id} from database and cached`);
          return parsedTeacher as Teacher;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for teacher ${id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          // Update cache
          this.teacherCache.set(id, teacher);
          this.setCacheExpiry(`teacher_${id}`);
          console.log(`Retrieved teacher ${id} from database and cached`);
          return teacher;
        }
      } else {
        console.log(`Teacher ${id} not found`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching teacher:", error);
      throw error;
    }
  }

  async getAllTeachers(): Promise<Teacher[]> {
    try {
      // Check cache first
      if (this.allTeachersCache && this.isCacheValid("all_teachers")) {
        console.log("Retrieved all teachers from cache");
        return this.allTeachersCache;
      }

      const teachers = await AppDataSource.getRepository(Teacher).find();

      // Parse JSON fields for all teachers
      const parsedTeachers: Teacher[] = teachers.map((teacher) => {
        try {
          const parsedTeacher: any = { ...teacher };
          parsedTeacher.primarySubjectIds = JSON.parse(
            teacher.primarySubjectIds || "[]"
          );
          parsedTeacher.allowedSubjectIds = JSON.parse(
            teacher.allowedSubjectIds || "[]"
          );
          parsedTeacher.availability = JSON.parse(teacher.availability || "{}");
          parsedTeacher.unavailable = JSON.parse(teacher.unavailable || "[]");
          parsedTeacher.preferredRoomIds = JSON.parse(
            teacher.preferredRoomIds || "[]"
          );
          parsedTeacher.preferredColleagues = JSON.parse(
            teacher.preferredColleagues || "[]"
          );
          parsedTeacher.meta = JSON.parse(teacher.meta || "{}");
          return parsedTeacher as Teacher;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for teacher ${teacher.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          return teacher;
        }
      });

      // Update cache
      this.allTeachersCache = parsedTeachers;
      this.setCacheExpiry("all_teachers");

      console.log(
        `Retrieved ${parsedTeachers.length} teachers from database and cached`
      );
      return parsedTeachers;
    } catch (error) {
      console.error("Error fetching teachers:", error);
      throw error;
    }
  }

  async updateTeacher(id: number, teacherData: any): Promise<Teacher | null> {
    try {
      const repo = AppDataSource.getRepository(Teacher);
      const teacher = await repo.findOneBy({ id });
      if (teacher) {
        teacher.fullName = teacherData.fullName;
        teacher.primarySubjectIds = JSON.stringify(
          teacherData.primarySubjectIds || []
        );
        teacher.allowedSubjectIds = JSON.stringify(
          teacherData.allowedSubjectIds || []
        );
        teacher.restrictToPrimarySubjects =
          teacherData.restrictToPrimarySubjects !== undefined
            ? teacherData.restrictToPrimarySubjects
            : true;
        teacher.availability = JSON.stringify(teacherData.availability || {});
        teacher.unavailable = JSON.stringify(teacherData.unavailable || []);
        teacher.maxPeriodsPerWeek = teacherData.maxPeriodsPerWeek || 0;
        teacher.maxPeriodsPerDay = teacherData.maxPeriodsPerDay || 0;
        teacher.maxConsecutivePeriods = teacherData.maxConsecutivePeriods || 0;
        teacher.timePreference = teacherData.timePreference || "";
        teacher.preferredRoomIds = JSON.stringify(
          teacherData.preferredRoomIds || []
        );
        teacher.preferredColleagues = JSON.stringify(
          teacherData.preferredColleagues || []
        );
        teacher.meta = JSON.stringify(teacherData.meta || {});
        teacher.updatedAt = new Date();

        const updatedTeacher = await repo.save(teacher);

        // Parse JSON fields for return value
        try {
          (updatedTeacher as any).primarySubjectIds = JSON.parse(
            updatedTeacher.primarySubjectIds || "[]"
          );
          (updatedTeacher as any).allowedSubjectIds = JSON.parse(
            updatedTeacher.allowedSubjectIds || "[]"
          );
          (updatedTeacher as any).availability = JSON.parse(
            updatedTeacher.availability || "{}"
          );
          (updatedTeacher as any).unavailable = JSON.parse(
            updatedTeacher.unavailable || "[]"
          );
          (updatedTeacher as any).preferredRoomIds = JSON.parse(
            updatedTeacher.preferredRoomIds || "[]"
          );
          (updatedTeacher as any).preferredColleagues = JSON.parse(
            updatedTeacher.preferredColleagues || "[]"
          );
          (updatedTeacher as any).meta = JSON.parse(
            updatedTeacher.meta || "{}"
          );
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for updated teacher ${updatedTeacher.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
        }

        // Update cache
        this.teacherCache.set(id, updatedTeacher);
        this.setCacheExpiry(`teacher_${id}`);
        this.allTeachersCache = null; // Invalidate all teachers cache
        this.clearCache("all_teachers");

        console.log(`Updated teacher with ID: ${id}`);
        return updatedTeacher;
      }
      console.log(`Teacher ${id} not found for update`);
      return null;
    } catch (error) {
      console.error("Error updating teacher:", error);
      throw error;
    }
  }

  async deleteTeacher(id: number): Promise<boolean> {
    try {
      const result = await AppDataSource.getRepository(Teacher).delete(id);

      // Update cache
      this.teacherCache.delete(id);
      this.allTeachersCache = null; // Invalidate all teachers cache
      this.clearCache("all_teachers");

      const success = result.affected !== 0;
      if (success) {
        console.log(`Deleted teacher with ID: ${id}`);
      } else {
        console.log(`Teacher ${id} not found for deletion`);
      }
      return success;
    } catch (error) {
      console.error("Error deleting teacher:", error);
      throw error;
    }
  }

  async bulkImportTeachers(teachersData: any[]): Promise<Teacher[]> {
    try {
      const repo = AppDataSource.getRepository(Teacher);
      const savedTeachers: Teacher[] = [];

      for (const teacherData of teachersData) {
        const teacher = new Teacher();
        teacher.fullName = teacherData.fullName;
        teacher.primarySubjectIds = JSON.stringify(
          teacherData.primarySubjectIds || []
        );
        teacher.allowedSubjectIds = JSON.stringify(
          teacherData.allowedSubjectIds || []
        );
        teacher.restrictToPrimarySubjects =
          teacherData.restrictToPrimarySubjects !== undefined
            ? teacherData.restrictToPrimarySubjects
            : true;
        teacher.availability = JSON.stringify(teacherData.availability || {});
        teacher.unavailable = JSON.stringify(teacherData.unavailable || []);
        teacher.maxPeriodsPerWeek = teacherData.maxPeriodsPerWeek || 0;
        teacher.maxPeriodsPerDay = teacherData.maxPeriodsPerDay || 0;
        teacher.maxConsecutivePeriods = teacherData.maxConsecutivePeriods || 0;
        teacher.timePreference = teacherData.timePreference || "";
        teacher.preferredRoomIds = JSON.stringify(
          teacherData.preferredRoomIds || []
        );
        teacher.preferredColleagues = JSON.stringify(
          teacherData.preferredColleagues || []
        );
        teacher.meta = JSON.stringify(teacherData.meta || {});
        teacher.createdAt = new Date();
        teacher.updatedAt = new Date();

        const savedTeacher = await teacher.save();

        // Parse JSON fields for return value
        try {
          savedTeacher.primarySubjectIds = JSON.parse(
            savedTeacher.primarySubjectIds || "[]"
          );
          savedTeacher.allowedSubjectIds = JSON.parse(
            savedTeacher.allowedSubjectIds || "[]"
          );
          savedTeacher.availability = JSON.parse(
            savedTeacher.availability || "{}"
          );
          savedTeacher.unavailable = JSON.parse(
            savedTeacher.unavailable || "[]"
          );
          savedTeacher.preferredRoomIds = JSON.parse(
            savedTeacher.preferredRoomIds || "[]"
          );
          savedTeacher.preferredColleagues = JSON.parse(
            savedTeacher.preferredColleagues || "[]"
          );
          savedTeacher.meta = JSON.parse(savedTeacher.meta || "{}");
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for saved teacher ${savedTeacher.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
        }

        savedTeachers.push(savedTeacher);
      }

      // Invalidate cache
      this.allTeachersCache = null;
      this.clearCache("all_teachers");

      console.log(`Bulk imported ${savedTeachers.length} teachers`);
      return savedTeachers;
    } catch (error) {
      console.error("Error bulk importing teachers:", error);
      throw error;
    }
  }

  // Subject methods
  async saveSubject(subjectData: any): Promise<Subject> {
    try {
      const repo = AppDataSource.getRepository(Subject);
      const subject = new Subject();
      subject.name = subjectData.name;
      subject.code = subjectData.code || "";
      subject.requiredRoomType = subjectData.requiredRoomType || "";
      subject.requiredFeatures = JSON.stringify(
        subjectData.requiredFeatures || []
      );
      subject.desiredFeatures = JSON.stringify(
        subjectData.desiredFeatures || []
      );
      subject.isDifficult = subjectData.isDifficult || false;
      subject.minRoomCapacity = (typeof subjectData.minRoomCapacity === 'number' && !isNaN(subjectData.minRoomCapacity)) ? subjectData.minRoomCapacity : 0;
      subject.meta = JSON.stringify(subjectData.meta || {});
      subject.createdAt = new Date();
      subject.updatedAt = new Date();

      const savedSubject = await repo.save(subject);

      // Parse JSON fields for return value
      try {
        (savedSubject as any).requiredFeatures = JSON.parse(
          savedSubject.requiredFeatures || "[]"
        );
        (savedSubject as any).desiredFeatures = JSON.parse(
          savedSubject.desiredFeatures || "[]"
        );
        (savedSubject as any).meta = JSON.parse(savedSubject.meta || "{}");
      } catch (parseError) {
        console.error(
          `Error parsing JSON fields for saved subject ${savedSubject.id}:`,
          parseError
        );
        // Return raw string values if parsing fails
      }

      // Update cache
      this.subjectCache.set(savedSubject.id, savedSubject);
      this.setCacheExpiry(`subject_${savedSubject.id}`);
      this.allSubjectsCache = null; // Invalidate all subjects cache
      this.clearCache("all_subjects");

      console.log(`Saved subject with ID: ${savedSubject.id}`);
      return savedSubject;
    } catch (error) {
      console.error("Error saving subject:", error);
      throw error;
    }
  }

  async getSubject(id: number): Promise<Subject | null> {
    try {
      // Check cache first
      if (this.subjectCache.has(id) && this.isCacheValid(`subject_${id}`)) {
        console.log(`Retrieved subject ${id} from cache`);
        const cachedSubject = this.subjectCache.get(id);
        return cachedSubject ? cachedSubject : null;
      }
      const subject = await AppDataSource.getRepository(Subject).findOneBy({
        id,
      });

      // Parse JSON fields
      if (subject) {
        try {
          const parsedSubject: any = { ...subject };
          parsedSubject.requiredFeatures = JSON.parse(
            subject.requiredFeatures || "[]"
          );
          parsedSubject.desiredFeatures = JSON.parse(
            subject.desiredFeatures || "[]"
          );
          parsedSubject.meta = JSON.parse(subject.meta || "{}");

          // Update cache
          this.subjectCache.set(id, parsedSubject as Subject);
          this.setCacheExpiry(`subject_${id}`);
          console.log(`Retrieved subject ${id} from database and cached`);
          return parsedSubject as Subject;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for subject ${id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          // Update cache
          this.subjectCache.set(id, subject);
          this.setCacheExpiry(`subject_${id}`);
          console.log(`Retrieved subject ${id} from database and cached`);
          return subject;
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching subject:", error);
      throw error;
    }
  }

  async getAllSubjects(): Promise<Subject[]> {
    try {
      // Check cache first
      if (this.allSubjectsCache && this.isCacheValid("all_subjects")) {
        console.log("Retrieved all subjects from cache");
        return this.allSubjectsCache;
      }
      const subjects = await AppDataSource.getRepository(Subject).find();

      // Parse JSON fields for all subjects
      const parsedSubjects: Subject[] = subjects.map((subject) => {
        try {
          const parsedSubject: any = { ...subject };
          parsedSubject.requiredFeatures = JSON.parse(
            subject.requiredFeatures || "[]"
          );
          parsedSubject.desiredFeatures = JSON.parse(
            subject.desiredFeatures || "[]"
          );
          parsedSubject.meta = JSON.parse(subject.meta || "{}");
          return parsedSubject as Subject;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for subject ${subject.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          return subject;
        }
      });

      // Update cache
      this.allSubjectsCache = parsedSubjects;
      this.setCacheExpiry("all_subjects");

      console.log(
        `Retrieved ${parsedSubjects.length} subjects from database and cached`
      );
      return parsedSubjects;
    } catch (error) {
      console.error("Error fetching subjects:", error);
      throw error;
    }
  }

  async updateSubject(id: number, subjectData: any): Promise<Subject | null> {
    try {
      const subject = await Subject.findOneBy({ id });
      if (subject) {
        subject.name = subjectData.name;
        subject.code = subjectData.code || "";
        subject.requiredRoomType = subjectData.requiredRoomType || "";
        subject.requiredFeatures = JSON.stringify(
          subjectData.requiredFeatures || []
        );
        subject.desiredFeatures = JSON.stringify(
          subjectData.desiredFeatures || []
        );
        subject.isDifficult = subjectData.isDifficult || false;
        subject.minRoomCapacity = (typeof subjectData.minRoomCapacity === 'number' && !isNaN(subjectData.minRoomCapacity)) ? subjectData.minRoomCapacity : 0;
        subject.meta = JSON.stringify(subjectData.meta || {});
        subject.updatedAt = new Date();

        const updatedSubject = await subject.save();

        // Parse JSON fields for return value
        try {
          updatedSubject.requiredFeatures = JSON.parse(
            updatedSubject.requiredFeatures || "[]"
          );
          updatedSubject.desiredFeatures = JSON.parse(
            updatedSubject.desiredFeatures || "[]"
          );
          updatedSubject.meta = JSON.parse(updatedSubject.meta || "{}");
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for updated subject ${updatedSubject.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
        }

        // Update cache
        this.subjectCache.set(id, updatedSubject);
        this.setCacheExpiry(`subject_${id}`);
        this.allSubjectsCache = null; // Invalidate all subjects cache
        this.clearCache("all_subjects");

        console.log(`Updated subject with ID: ${id}`);
        return updatedSubject;
      }
      console.log(`Subject ${id} not found for update`);
      return null;
    } catch (error) {
      console.error("Error updating subject:", error);
      throw error;
    }
  }

  async deleteSubject(id: number): Promise<boolean> {
    try {
        const result = await AppDataSource.getRepository(Subject).delete(id);

      // Update cache
      this.subjectCache.delete(id);
      this.allSubjectsCache = null; // Invalidate all subjects cache
      this.clearCache("all_subjects");

      const success = result.affected !== 0;
      if (success) {
        console.log(`Deleted subject with ID: ${id}`);
      } else {
        console.log(`Subject ${id} not found for deletion`);
      }
      return success;
    } catch (error) {
      console.error("Error deleting subject:", error);
      throw error;
    }
  }

  // Room methods
  async saveRoom(roomData: any): Promise<Room> {
    try {
      const room = new Room();
      room.name = roomData.name;
      room.capacity = (typeof roomData.capacity === 'number' && !isNaN(roomData.capacity)) ? roomData.capacity : 0;
      room.type = roomData.type || "";
      room.features = JSON.stringify(roomData.features || []);
      room.unavailable = JSON.stringify(roomData.unavailable || []);
      room.meta = JSON.stringify(roomData.meta || {});
      room.createdAt = new Date();
      room.updatedAt = new Date();

      const savedRoom = await room.save();

      // Parse JSON fields for return value
      try {
        savedRoom.features = JSON.parse(savedRoom.features || "[]");
        savedRoom.unavailable = JSON.parse(savedRoom.unavailable || "[]");
        savedRoom.meta = JSON.parse(savedRoom.meta || "{}");
      } catch (parseError) {
        console.error(
          `Error parsing JSON fields for saved room ${savedRoom.id}:`,
          parseError
        );
        // Return raw string values if parsing fails
      }

      // Update cache
      this.roomCache.set(savedRoom.id, savedRoom);
      this.setCacheExpiry(`room_${savedRoom.id}`);
      this.allRoomsCache = null; // Invalidate all rooms cache
      this.clearCache("all_rooms");

      console.log(`Saved room with ID: ${savedRoom.id}`);
      return savedRoom;
    } catch (error) {
      console.error("Error saving room:", error);
      throw error;
    }
  }

  async getRoom(id: number): Promise<Room | null> {
    try {
      // Check cache first
      if (this.roomCache.has(id) && this.isCacheValid(`room_${id}`)) {
        console.log(`Retrieved room ${id} from cache`);
        const cachedRoom = this.roomCache.get(id);
        return cachedRoom ? cachedRoom : null;
      }

      const room = await AppDataSource.getRepository(Room).findOneBy({ id });

      // Parse JSON fields
      if (room) {
        try {
          const parsedRoom: Room = { ...room } as Room;
          parsedRoom.features = JSON.parse(room.features || "[]");
          parsedRoom.unavailable = JSON.parse(room.unavailable || "[]");
          parsedRoom.meta = JSON.parse(room.meta || "{}");

          // Update cache
          this.roomCache.set(id, parsedRoom);
          this.setCacheExpiry(`room_${id}`);
          console.log(`Retrieved room ${id} from database and cached`);
          return parsedRoom;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for room ${id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          // Update cache
          this.roomCache.set(id, room);
          this.setCacheExpiry(`room_${id}`);
          console.log(`Retrieved room ${id} from database and cached`);
          return room;
        }
      } else {
        console.log(`Room ${id} not found`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching room:", error);
      throw error;
    }
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      // Check cache first
      if (this.allRoomsCache && this.isCacheValid("all_rooms")) {
        console.log("Retrieved all rooms from cache");
        return this.allRoomsCache;
      }

      const rooms = await AppDataSource.getRepository(Room).find();

      // Parse JSON fields for all rooms
      const parsedRooms: Room[] = rooms.map((room) => {
        try {
          const parsedRoom: any = { ...room };
          parsedRoom.features = JSON.parse(room.features || "[]");
          parsedRoom.unavailable = JSON.parse(room.unavailable || "[]");
          parsedRoom.meta = JSON.parse(room.meta || "{}");
          return parsedRoom as Room;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for room ${room.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          return room;
        }
      });

      // Update cache
      this.allRoomsCache = parsedRooms;
      this.setCacheExpiry("all_rooms");

      console.log(
        `Retrieved ${parsedRooms.length} rooms from database and cached`
      );
      return parsedRooms;
    } catch (error) {
      console.error("Error fetching rooms:", error);
      throw error;
    }
  }

  async updateRoom(id: number, roomData: any): Promise<Room | null> {
    try {
      const room = await AppDataSource.getRepository(Room).findOneBy({ id });
      if (room) {
        room.name = roomData.name;
        room.capacity = (typeof roomData.capacity === 'number' && !isNaN(roomData.capacity)) ? roomData.capacity : 0;
        room.type = roomData.type || "";
        room.features = JSON.stringify(roomData.features || []);
        room.unavailable = JSON.stringify(roomData.unavailable || []);
        room.meta = JSON.stringify(roomData.meta || {});
        room.updatedAt = new Date();

        const updatedRoom = await room.save();

        // Parse JSON fields for return value
        try {
          updatedRoom.features = JSON.parse(updatedRoom.features || "[]");
          updatedRoom.unavailable = JSON.parse(updatedRoom.unavailable || "[]");
          updatedRoom.meta = JSON.parse(updatedRoom.meta || "{}");
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for updated room ${updatedRoom.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
        }

        // Update cache
        this.roomCache.set(id, updatedRoom);
        this.setCacheExpiry(`room_${id}`);
        this.allRoomsCache = null; // Invalidate all rooms cache
        this.clearCache("all_rooms");

        console.log(`Updated room with ID: ${id}`);
        return updatedRoom;
      }
      console.log(`Room ${id} not found for update`);
      return null;
    } catch (error) {
      console.error("Error updating room:", error);
      throw error;
    }
  }

  async deleteRoom(id: number): Promise<boolean> {
    try {
        const result = await AppDataSource.getRepository(Room).delete(id);

      // Update cache
      this.roomCache.delete(id);
      this.allRoomsCache = null; // Invalidate all rooms cache
      this.clearCache("all_rooms");

      const success = result.affected !== 0;
      if (success) {
        console.log(`Deleted room with ID: ${id}`);
      } else {
        console.log(`Room ${id} not found for deletion`);
      }
      return success;
    } catch (error) {
      console.error("Error deleting room:", error);
      throw error;
    }
  }

  // Class methods
  async saveClass(classData: any): Promise<ClassGroup> {
    try {
      const classGroup = new ClassGroup();
      classGroup.name = classData.name;
      classGroup.studentCount = (typeof classData.studentCount === 'number' && !isNaN(classData.studentCount)) ? classData.studentCount : 0;
      classGroup.subjectRequirements = JSON.stringify(
        classData.subjectRequirements || {}
      );
      classGroup.meta = JSON.stringify(classData.meta || {});
      classGroup.createdAt = new Date();
      classGroup.updatedAt = new Date();

      const savedClass = await classGroup.save();

      // Parse JSON fields for return value
      try {
        savedClass.subjectRequirements = JSON.parse(
          savedClass.subjectRequirements || "{}"
        );
        savedClass.meta = JSON.parse(savedClass.meta || "{}");
      } catch (parseError) {
        console.error(
          `Error parsing JSON fields for saved class ${savedClass.id}:`,
          parseError
        );
        // Return raw string values if parsing fails
      }

      // Update cache
      this.classCache.set(savedClass.id, savedClass);
      this.setCacheExpiry(`class_${savedClass.id}`);
      this.allClassesCache = null; // Invalidate all classes cache
      this.clearCache("all_classes");

      console.log(`Saved class with ID: ${savedClass.id}`);
      return savedClass;
    } catch (error) {
      console.error("Error saving class:", error);
      throw error;
    }
  }

  async getClass(id: number): Promise<ClassGroup | null> {
    try {
      // Check cache first
      if (this.classCache.has(id) && this.isCacheValid(`class_${id}`)) {
        console.log(`Retrieved class ${id} from cache`);
        const cachedClass = this.classCache.get(id);
        return cachedClass ? cachedClass : null;
      }

      const classGroup = await AppDataSource.getRepository(ClassGroup).findOneBy({ id });

      // Parse JSON fields
      if (classGroup) {
        try {
          const parsedClass: ClassGroup = { ...classGroup } as ClassGroup;
          parsedClass.subjectRequirements = JSON.parse(
            classGroup.subjectRequirements || "{}"
          );
          parsedClass.meta = JSON.parse(classGroup.meta || "{}");

          // Update cache
          this.classCache.set(id, parsedClass);
          this.setCacheExpiry(`class_${id}`);
          console.log(`Retrieved class ${id} from database and cached`);
          return parsedClass;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for class ${id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          // Update cache
          this.classCache.set(id, classGroup);
          this.setCacheExpiry(`class_${id}`);
          console.log(`Retrieved class ${id} from database and cached`);
          return classGroup;
        }
      } else {
        console.log(`Class ${id} not found`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching class:", error);
      throw error;
    }
  }

  async getAllClasses(): Promise<ClassGroup[]> {
    try {
      // Check cache first
      if (this.allClassesCache && this.isCacheValid("all_classes")) {
        console.log("Retrieved all classes from cache");
        return this.allClassesCache;
      }

      const classes = await AppDataSource.getRepository(ClassGroup).find();

      // Parse JSON fields for all classes
      const parsedClasses: ClassGroup[] = classes.map((classGroup) => {
        try {
          const parsedClass: any = { ...classGroup };
          parsedClass.subjectRequirements = JSON.parse(
            classGroup.subjectRequirements || "{}"
          );
          parsedClass.meta = JSON.parse(classGroup.meta || "{}");
          return parsedClass as ClassGroup;
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for class ${classGroup.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
          return classGroup;
        }
      });

      // Update cache
      this.allClassesCache = parsedClasses;
      this.setCacheExpiry("all_classes");

      console.log(
        `Retrieved ${parsedClasses.length} classes from database and cached`
      );
      return parsedClasses;
    } catch (error) {
      console.error("Error fetching classes:", error);
      throw error;
    }
  }

  async updateClass(id: number, classData: any): Promise<ClassGroup | null> {
    try {
      const classGroup = await AppDataSource.getRepository(ClassGroup).findOneBy({ id });
      if (classGroup) {
        classGroup.name = classData.name;
        classGroup.studentCount = (typeof classData.studentCount === 'number' && !isNaN(classData.studentCount)) ? classData.studentCount : 0;
        classGroup.subjectRequirements = JSON.stringify(
          classData.subjectRequirements || {}
        );
        classGroup.meta = JSON.stringify(classData.meta || {});
        classGroup.updatedAt = new Date();

        const updatedClass = await classGroup.save();

        // Parse JSON fields for return value
        try {
          updatedClass.subjectRequirements = JSON.parse(
            updatedClass.subjectRequirements || "{}"
          );
          updatedClass.meta = JSON.parse(updatedClass.meta || "{}");
        } catch (parseError) {
          console.error(
            `Error parsing JSON fields for updated class ${updatedClass.id}:`,
            parseError
          );
          // Return raw string values if parsing fails
        }

        // Update cache
        this.classCache.set(id, updatedClass);
        this.setCacheExpiry(`class_${id}`);
        this.allClassesCache = null; // Invalidate all classes cache
        this.clearCache("all_classes");

        console.log(`Updated class with ID: ${id}`);
        return updatedClass;
      }
      console.log(`Class ${id} not found for update`);
      return null;
    } catch (error) {
      console.error("Error updating class:", error);
      throw error;
    }
  }

  async deleteClass(id: number): Promise<boolean> {
    try {
        const result = await AppDataSource.getRepository(ClassGroup).delete(id);

      // Update cache
      this.classCache.delete(id);
      this.allClassesCache = null; // Invalidate all classes cache
      this.clearCache("all_classes");

      const success = result.affected !== 0;
      if (success) {
        console.log(`Deleted class with ID: ${id}`);
      } else {
        console.log(`Class ${id} not found for deletion`);
      }
      return success;
    } catch (error) {
      console.error("Error deleting class:", error);
      throw error;
    }
  }

  // Method to clear all caches (useful for testing or maintenance)
  clearAllCaches(): void {
    this.timetableCache.clear();
    this.configCache.clear();
    this.wizardStepCache.clear();
    this.teacherCache.clear();
    this.subjectCache.clear();
    this.roomCache.clear();
    this.classCache.clear();
    this.allTimetablesCache = null;
    this.allTeachersCache = null;
    this.allSubjectsCache = null;
    this.allRoomsCache = null;
    this.allClassesCache = null;
    this.cacheExpiry.clear();
    console.log("All caches cleared");
  }
}
