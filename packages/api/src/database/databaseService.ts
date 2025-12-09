import { AppDataSource } from "../../ormconfig";
import { Timetable } from "../entity/Timetable";
import { Configuration } from "../entity/Configuration";
import { WizardStep } from "../entity/WizardStep";
import { Teacher } from "../entity/Teacher";
import { Subject } from "../entity/Subject";
import { Room } from "../entity/Room";
import { ClassGroup } from "../entity/ClassGroup";
import { SchoolConfig } from "../entity/SchoolConfig";

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
      console.log('[DB SERVICE] saveConfiguration called - START');
      console.log('[DB SERVICE] Received key:', key);
      console.log('[DB SERVICE] Received value:', value);
      console.log('[DB SERVICE] Received value type:', typeof value);
      console.log('[DB SERVICE] Received value is string:', typeof value === 'string');
      
      const repo = AppDataSource.getRepository(Configuration);
      console.log('[DB SERVICE] Repository obtained');
      
      let config = await repo.findOneBy({ key });
      console.log('[DB SERVICE] Found existing config:', config ? 'YES' : 'NO');
      
      if (!config) {
        console.log('[DB SERVICE] Creating new Configuration instance');
        config = new Configuration();
        config.key = key;
      }
      
      console.log('[DB SERVICE] Before setting value - config.value type:', typeof config.value);
      console.log('[DB SERVICE] Input value type check:', typeof value === 'string' ? 'string' : 'not string');
      
      // Ensure value is always a string
      config.value = typeof value === 'string' ? value : JSON.stringify(value);
      
      console.log('[DB SERVICE] After setting value - config.value type:', typeof config.value);
      console.log('[DB SERVICE] After setting value - config.value is string:', typeof config.value === 'string');
      console.log('[DB SERVICE] config.value preview:', String(config.value).substring(0, 150));
      console.log('[DB SERVICE] config.value length:', String(config.value).length);
      
      config.updatedAt = new Date();
      
      console.log('[DB SERVICE] About to call repo.save(config)');
      console.log('[DB SERVICE] Config object:', JSON.stringify({
        id: config.id,
        key: config.key,
        valueType: typeof config.value,
        valueLength: String(config.value).length,
        valuePreview: String(config.value).substring(0, 100)
      }, null, 2));
      
      const savedConfig = await repo.save(config);
      console.log('[DB SERVICE] repo.save completed successfully');
      console.log('[DB SERVICE] Saved config:', JSON.stringify({
        id: savedConfig.id,
        key: savedConfig.key,
        valueType: typeof savedConfig.value,
        valueLength: String(savedConfig.value).length
      }, null, 2));

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
      
      // Check for existing teacher by name (upsert logic)
      let teacher = await repo.findOne({ where: { fullName: teacherData.fullName } });
      if (!teacher) {
        teacher = new Teacher();
        teacher.createdAt = new Date();
        console.log(`Creating new teacher: ${teacherData.fullName}`);
      } else {
        console.log(`Updating existing teacher: ${teacherData.fullName}`);
      }
      
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
      teacher.classAssignments = JSON.stringify(
        teacherData.classAssignments || []
      );
      teacher.meta = JSON.stringify(teacherData.meta || {});
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
        (savedTeacher as any).classAssignments = JSON.parse(
          savedTeacher.classAssignments || "[]"
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
          parsedTeacher.classAssignments = JSON.parse(
            teacher.classAssignments || "[]"
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
          parsedTeacher.classAssignments = JSON.parse(
            teacher.classAssignments || "[]"
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
        teacher.classAssignments = JSON.stringify(
          teacherData.classAssignments || []
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
          (updatedTeacher as any).classAssignments = JSON.parse(
            updatedTeacher.classAssignments || "[]"
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
        teacher.classAssignments = JSON.stringify(
          teacherData.classAssignments || []
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
          savedTeacher.classAssignments = JSON.parse(
            savedTeacher.classAssignments || "[]"
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
      // De-dup guard: try to find existing by (grade,name) or (grade,code)
      const gradeVal = (typeof subjectData.grade === 'number' && !isNaN(subjectData.grade)) ? subjectData.grade : null;
      const codeVal = subjectData.code || "";
      let subject = await repo.findOne({ where: [
        { grade: gradeVal as any, name: subjectData.name },
        ...(codeVal ? [{ grade: gradeVal as any, code: codeVal }] : []),
      ] as any });
      if (!subject) {
        subject = new Subject();
        subject.createdAt = new Date();
        console.log(`Creating new subject: ${subjectData.name}`);
      } else {
        console.log(`Updating existing subject: ${subjectData.name} (duplicate prevented)`);
      }
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
      subject.grade = (typeof subjectData.grade === 'number' && !isNaN(subjectData.grade)) ? subjectData.grade : null;
      subject.periodsPerWeek = (typeof subjectData.periodsPerWeek === 'number' && !isNaN(subjectData.periodsPerWeek)) ? subjectData.periodsPerWeek : null;
      subject.section = subjectData.section || "";
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
        subject.grade = (typeof subjectData.grade === 'number' && !isNaN(subjectData.grade)) ? subjectData.grade : null;
        subject.periodsPerWeek = (typeof subjectData.periodsPerWeek === 'number' && !isNaN(subjectData.periodsPerWeek)) ? subjectData.periodsPerWeek : null;
        subject.section = subjectData.section || "";
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

  async clearAllSubjects(): Promise<void> {
    try {
      await AppDataSource.getRepository(Subject).clear();
      // Invalidate caches
      this.subjectCache.clear();
      this.allSubjectsCache = null;
      this.clearCache("all_subjects");
      console.log("All subjects cleared");
    } catch (error) {
      console.error("Error clearing all subjects:", error);
      throw error;
    }
  }

  async clearSubjectsByGrade(grade: number): Promise<void> {
    try {
      await AppDataSource.getRepository(Subject)
        .createQueryBuilder()
        .delete()
        .from(Subject)
        .where("grade = :grade", { grade })
        .execute();
      this.allSubjectsCache = null;
      this.clearCache("all_subjects");
      console.log(`Cleared subjects for grade ${grade}`);
    } catch (error) {
      console.error("Error clearing subjects by grade:", error);
      throw error;
    }
  }

  async bulkUpsertSubjects(subjectsData: any[]): Promise<Subject[]> {
    const results: Subject[] = [];
    for (const s of subjectsData) {
      try {
        const saved = await this.saveSubject(s);
        results.push(saved);
      } catch (e) {
        console.error("Bulk upsert subject failed:", e);
      }
    }
    this.allSubjectsCache = null;
    this.clearCache("all_subjects");
    return results;
  }

  // Room methods
  async saveRoom(roomData: any): Promise<Room> {
    try {
      const repo = AppDataSource.getRepository(Room);
      
      // Check for existing room by name (upsert logic)
      let room = await repo.findOne({ where: { name: roomData.name } });
      if (!room) {
        room = new Room();
        room.createdAt = new Date();
        console.log(`Creating new room: ${roomData.name}`);
      } else {
        console.log(`Updating existing room: ${roomData.name}`);
      }
      
      room.name = roomData.name;
      room.capacity = (typeof roomData.capacity === 'number' && !isNaN(roomData.capacity)) ? roomData.capacity : 0;
      room.type = roomData.type || "";
      room.features = JSON.stringify(roomData.features || []);
      room.unavailable = JSON.stringify(roomData.unavailable || []);
      room.meta = JSON.stringify(roomData.meta || {});
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
      // Check if any classes are locked to this room
      const classRepo = AppDataSource.getRepository(ClassGroup);
      const lockedClasses = await classRepo.find({ where: { fixedRoomId: id } as any });
      
      if (lockedClasses.length > 0) {
        const classNames = lockedClasses.map(c => c.name).join(", ");
        throw new Error(
          `Cannot delete room: ${lockedClasses.length} class(es) are locked to it (${classNames}). ` +
          `Please remove fixed room assignments first.`
        );
      }
      
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
      const repo = AppDataSource.getRepository(ClassGroup);
      
      // Validate fixedRoomId if provided
      if (classData.fixedRoomId != null && classData.fixedRoomId !== "") {
        const roomRepo = AppDataSource.getRepository(Room);
        const room = await roomRepo.findOneBy({ id: classData.fixedRoomId });
        if (!room) {
          throw new Error(`Invalid fixedRoomId: Room with ID ${classData.fixedRoomId} does not exist`);
        }
        // Capacity warning (not blocking)
        if (room.capacity < classData.studentCount) {
          console.warn(
            `[Fixed Room] Room "${room.name}" capacity (${room.capacity}) is less than class "${classData.name}" size (${classData.studentCount}). This may cause issues.`
          );
        }
        console.log(`[Fixed Room] Class "${classData.name}" locked to room "${room.name}" (ID: ${room.id})`);
      }
      
      // Check for existing class by name (upsert logic)
      let classGroup = await repo.findOne({ where: { name: classData.name } });
      if (!classGroup) {
        classGroup = new ClassGroup();
        classGroup.createdAt = new Date();
        console.log(`Creating new class: ${classData.name}`);
      } else {
        console.log(`Updating existing class: ${classData.name}`);
      }
      
      classGroup.name = classData.name;
      classGroup.displayName = classData.displayName || classData.name;
      classGroup.section = classData.section || "";
      classGroup.grade = (typeof classData.grade === 'number' && !isNaN(classData.grade)) ? classData.grade : null;
      classGroup.sectionIndex = classData.sectionIndex || "";
      classGroup.studentCount = (typeof classData.studentCount === 'number' && !isNaN(classData.studentCount)) ? classData.studentCount : 0;
      classGroup.fixedRoomId = (classData.fixedRoomId != null && classData.fixedRoomId !== "") ? classData.fixedRoomId : null;
      classGroup.subjectRequirements = JSON.stringify(
        classData.subjectRequirements || {}
      );
      classGroup.meta = JSON.stringify(classData.meta || {});
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
        // Validate fixedRoomId if provided
        if (classData.fixedRoomId != null && classData.fixedRoomId !== "") {
          const roomRepo = AppDataSource.getRepository(Room);
          const room = await roomRepo.findOneBy({ id: classData.fixedRoomId });
          if (!room) {
            throw new Error(`Invalid fixedRoomId: Room with ID ${classData.fixedRoomId} does not exist`);
          }
          // Capacity warning
          if (room.capacity < classData.studentCount) {
            console.warn(
              `[Fixed Room] Room "${room.name}" capacity (${room.capacity}) is less than class "${classData.name}" size (${classData.studentCount})`
            );
          }
        }
        
        classGroup.name = classData.name;
        classGroup.displayName = classData.displayName || classData.name;
        classGroup.section = classData.section || classGroup.section || "";
        classGroup.grade = (typeof classData.grade === 'number' && !isNaN(classData.grade)) ? classData.grade : classGroup.grade;
        classGroup.sectionIndex = classData.sectionIndex || classGroup.sectionIndex || "";
        classGroup.studentCount = (typeof classData.studentCount === 'number' && !isNaN(classData.studentCount)) ? classData.studentCount : 0;
        classGroup.fixedRoomId = (classData.fixedRoomId != null && classData.fixedRoomId !== "") ? classData.fixedRoomId : null;
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

  // Migration helper for backward compatibility
  private migrateBreakPeriodsFormat(breakPeriodsJson: string): string {
    try {
      const parsed = JSON.parse(breakPeriodsJson);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Old format 1: array of numbers [3, 5]
        if (typeof parsed[0] === 'number') {
          const migrated = parsed
            .filter((periodNum: number) => periodNum > 1) // Can't have break after period 0
            .map((periodNum: number) => ({
              afterPeriod: periodNum - 1,
              duration: 10 // Default duration
            }));
          console.log(`Migrated break periods from number array ${JSON.stringify(parsed)} to afterPeriod format ${JSON.stringify(migrated)}`);
          return JSON.stringify(migrated);
        }
        
        // Old format 2: [{periodNumber: 3, duration: 10}] (period 3 IS a break)
        if (typeof parsed[0] === 'object' && 'periodNumber' in parsed[0]) {
          const migrated = parsed
            .filter((b: any) => b.periodNumber > 1) // Can't have break after period 0
            .map((b: any) => ({
              afterPeriod: b.periodNumber - 1,
              duration: b.duration || 10
            }));
          console.log(`Migrated break periods from periodNumber format ${JSON.stringify(parsed)} to afterPeriod format ${JSON.stringify(migrated)}`);
          return JSON.stringify(migrated);
        }
      }
      
      // Already new format (afterPeriod) or empty
      return breakPeriodsJson;
    } catch {
      return "[]";
    }
  }

  // SchoolConfig methods
  async getSchoolConfig(): Promise<SchoolConfig | null> {
    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if entity is registered
      if (!AppDataSource.hasMetadata(SchoolConfig)) {
        console.warn("SchoolConfig entity is not registered in TypeORM");
        return null;
      }
      
      const configs = await AppDataSource.getRepository(SchoolConfig).find();
      const config = configs[0] || null;
      
      if (config && config.breakPeriods) {
        // Auto-migrate on read
        config.breakPeriods = this.migrateBreakPeriodsFormat(config.breakPeriods);
      }
      
      return config;
    } catch (error) {
      console.error("Error fetching school config:", error);
      throw error;
    }
  }

  async saveSchoolConfig(cfg: Partial<SchoolConfig>): Promise<SchoolConfig> {
    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if entity is registered
      if (!AppDataSource.hasMetadata(SchoolConfig)) {
        throw new Error("SchoolConfig entity is not registered in TypeORM");
      }
      
      const repo = AppDataSource.getRepository(SchoolConfig);
      let existing = (await repo.find())[0];
      if (!existing) {
        existing = new SchoolConfig();
      }
      existing.enablePrimary = cfg.enablePrimary ?? existing.enablePrimary;
      existing.enableMiddle = cfg.enableMiddle ?? existing.enableMiddle;
      existing.enableHigh = cfg.enableHigh ?? existing.enableHigh;
      if (cfg.schoolName !== undefined) existing.schoolName = cfg.schoolName as any;
      if (typeof cfg.daysPerWeek === 'number') existing.daysPerWeek = cfg.daysPerWeek;
      if (typeof cfg.periodsPerDay === 'number') existing.periodsPerDay = cfg.periodsPerDay;
      
      // Handle breakPeriods with migration
      if (cfg.breakPeriods !== undefined) {
        const breakPeriods = typeof cfg.breakPeriods === 'string' 
          ? cfg.breakPeriods 
          : JSON.stringify(cfg.breakPeriods);
        existing.breakPeriods = this.migrateBreakPeriodsFormat(breakPeriods);
      }
      
      existing.updatedAt = new Date();
      const saved = await repo.save(existing);
      return saved;
    } catch (error) {
      console.error("Error saving school config:", error);
      throw error;
    }
  }

  async destructiveReset(includeTeachers = false): Promise<void> {
    try {
      // Order: class-subject links (embedded in classes), classes, subjects, optionally teachers, rooms
      await AppDataSource.getRepository(ClassGroup).clear();
      await AppDataSource.getRepository(Subject).clear();
      if (includeTeachers) {
        await AppDataSource.getRepository(Teacher).clear();
      }
      // Not clearing rooms by default
      // Invalidate caches
      this.clearAllCaches();
      console.log("Destructive reset completed");
    } catch (error) {
      console.error("Error during destructive reset:", error);
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
