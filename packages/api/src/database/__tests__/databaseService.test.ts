// backend/src/database/__tests__/databaseService.test.ts
import { DatabaseService } from '../databaseService';
import { Timetable } from '../../entity/Timetable';
import { Configuration } from '../../entity/Configuration';
import { AppDataSource } from '../../../ormconfig';

// Mock data for testing
const mockTimetableData = {
  config: {
    daysOfWeek: ["Monday", "Tuesday", "Wednesday"],
    periodsPerDay: 8
  },
  rooms: [{ id: "1", name: "Room 101", capacity: 30, type: "classroom" }],
  subjects: [{ id: "1", name: "Mathematics" }],
  teachers: [{ id: "1", fullName: "John Doe", primarySubjectIds: ["1"] }],
  classes: [{ id: "1", name: "Grade 10", studentCount: 25, subjectRequirements: { "1": { periodsPerWeek: 4 } } }]
};

const mockConfigData = {
  key: "test_config",
  value: "test_value"
};

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeAll(async () => {
    // Initialize the database
    dbService = DatabaseService.getInstance();
    await dbService.initialize();
  });

  afterAll(async () => {
    // Clean up test data
    await AppDataSource.getRepository(Timetable).clear();
    await AppDataSource.getRepository(Configuration).clear();
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    // Clear caches before each test
    dbService.clearAllCaches();
  });

  describe('Timetable operations', () => {
    it('should save a timetable', async () => {
      const timetable = await dbService.saveTimetable(
        "Test Timetable",
        "A test timetable for validation",
        mockTimetableData
      );

      expect(timetable).toBeDefined();
      expect(timetable.name).toBe("Test Timetable");
      expect(timetable.description).toBe("A test timetable for validation");
      expect(timetable.data).toBe(JSON.stringify(mockTimetableData));
    });

    it('should retrieve a timetable by ID', async () => {
      // First save a timetable
      const savedTimetable = await dbService.saveTimetable(
        "Test Timetable 2",
        "Another test timetable",
        mockTimetableData
      );

      // Then retrieve it
      const retrievedTimetable = await dbService.getTimetable(savedTimetable.id);

      expect(retrievedTimetable).toBeDefined();
      expect(retrievedTimetable?.id).toBe(savedTimetable.id);
      expect(retrievedTimetable?.name).toBe("Test Timetable 2");
    });

    it('should retrieve all timetables', async () => {
      // Save multiple timetables
      await dbService.saveTimetable("Timetable 1", "First test", mockTimetableData);
      await dbService.saveTimetable("Timetable 2", "Second test", mockTimetableData);

      const timetables = await dbService.getAllTimetables();

      expect(timetables.length).toBeGreaterThanOrEqual(2);
      expect(timetables.some(t => t.name === "Timetable 1")).toBeTruthy();
      expect(timetables.some(t => t.name === "Timetable 2")).toBeTruthy();
    });

    it('should update a timetable', async () => {
      // Save a timetable first
      const savedTimetable = await dbService.saveTimetable(
        "Original Name",
        "Original description",
        mockTimetableData
      );

      // Update it
      const updatedData = {
        ...mockTimetableData,
        rooms: [...mockTimetableData.rooms, { id: "2", name: "Room 102", capacity: 25, type: "lab" }]
      };

      const updatedTimetable = await dbService.updateTimetable(savedTimetable.id, updatedData);

      expect(updatedTimetable).toBeDefined();
      expect(updatedTimetable?.id).toBe(savedTimetable.id);
      expect(JSON.parse(updatedTimetable?.data || '{}').rooms.length).toBe(2);
    });

    it('should delete a timetable', async () => {
      // Save a timetable first
      const savedTimetable = await dbService.saveTimetable(
        "To be deleted",
        "This will be deleted",
        mockTimetableData
      );

      // Delete it
      const success = await dbService.deleteTimetable(savedTimetable.id);

      expect(success).toBeTruthy();

      // Verify it's deleted
      const retrievedTimetable = await dbService.getTimetable(savedTimetable.id);
      expect(retrievedTimetable).toBeNull();
    });
  });

  describe('Configuration operations', () => {
    it('should save a configuration', async () => {
      const config = await dbService.saveConfiguration(
        mockConfigData.key,
        mockConfigData.value
      );

      expect(config).toBeDefined();
      expect(config.key).toBe(mockConfigData.key);
      expect(config.value).toBe(mockConfigData.value);
    });

    it('should retrieve a configuration by key', async () => {
      // Save a configuration first
      await dbService.saveConfiguration(mockConfigData.key, mockConfigData.value);

      // Retrieve it
      const retrievedValue = await dbService.getConfiguration(mockConfigData.key);

      expect(retrievedValue).toBe(mockConfigData.value);
    });
  });

  describe('Caching', () => {
    it('should cache timetable retrieval', async () => {
      // Save a timetable
      const savedTimetable = await dbService.saveTimetable(
        "Cached Timetable",
        "This should be cached",
        mockTimetableData
      );

      // Retrieve it twice - second should come from cache
      const firstRetrieval = await dbService.getTimetable(savedTimetable.id);
      const secondRetrieval = await dbService.getTimetable(savedTimetable.id);

      expect(firstRetrieval).toBeDefined();
      expect(secondRetrieval).toBeDefined();
      expect(firstRetrieval?.id).toBe(secondRetrieval?.id);
    });

    it('should invalidate cache when updating timetable', async () => {
      // Save a timetable
      const savedTimetable = await dbService.saveTimetable(
        "Cache Test",
        "Original data",
        mockTimetableData
      );

      // Retrieve it to populate cache
      await dbService.getTimetable(savedTimetable.id);

      // Update it - this should invalidate the cache
      const updatedData = {
        ...mockTimetableData,
        subjects: [...mockTimetableData.subjects, { id: "2", name: "Physics" }]
      };

      await dbService.updateTimetable(savedTimetable.id, updatedData);

      // Retrieve again - should get updated data
      const retrievedTimetable = await dbService.getTimetable(savedTimetable.id);
      expect(JSON.parse(retrievedTimetable?.data || '{}').subjects.length).toBe(2);
    });
  });
});