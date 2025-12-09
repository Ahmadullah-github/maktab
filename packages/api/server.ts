// backend/server.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {runPythonSolver} from './pyhonSolverNodeFunction';
import { parseSolverError } from './src/utils/errorParser';

// Import our database service
import { DatabaseService } from './src/database/databaseService';

// Import license service and middleware
import { LicenseService } from './src/services/licenseService';
import { licenseMiddleware } from './src/middleware/licenseMiddleware';

// Import TypeORM decorators
import "reflect-metadata";

const app: Express = express();
const port = 4000;

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ limit: '10mb' })); // To parse large JSON data packets

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Initialize Database ---
const databaseService = DatabaseService.getInstance();
const licenseService = LicenseService.getInstance();

databaseService.initialize().then(() => {
  console.log('Database initialized successfully');
}).catch((error) => {
  console.error('Failed to initialize database:', error);
});

// --- License Routes (MUST be before license middleware) ---

// Get license status
app.get('/api/license/status', async (req: Request, res: Response) => {
  try {
    const status = await licenseService.checkLicenseStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking license status:', error);
    res.status(500).json({ error: 'Failed to check license status' });
  }
});

// Get contact info
app.get('/api/license/contact-info', (req: Request, res: Response) => {
  res.json(LicenseService.CONTACT_INFO);
});

// Activate license
app.post('/api/license/activate', async (req: Request, res: Response) => {
  try {
    const { licenseKey, schoolName, contactName, contactPhone, licenseType } = req.body;
    
    if (!licenseKey || !schoolName || !contactName || !contactPhone || !licenseType) {
      return res.status(400).json({ 
        success: false, 
        message: 'تمام فیلدها الزامی هستند' 
      });
    }

    const result = await licenseService.activateLicense(
      licenseKey,
      schoolName,
      contactName,
      contactPhone,
      licenseType
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error activating license:', error);
    res.status(500).json({ success: false, message: 'خطا در فعال‌سازی لایسنس' });
  }
});

// Submit contact request for renewal/support
app.post('/api/license/contact', async (req: Request, res: Response) => {
  try {
    const { schoolName, contactName, contactPhone, preferredMethod, requestType, message } = req.body;
    
    if (!schoolName || !contactName || !contactPhone || !preferredMethod || !requestType) {
      return res.status(400).json({ 
        success: false, 
        message: 'تمام فیلدها الزامی هستند' 
      });
    }

    const result = await licenseService.submitContactRequest(
      schoolName,
      contactName,
      contactPhone,
      preferredMethod,
      requestType,
      message
    );

    res.json(result);
  } catch (error) {
    console.error('Error submitting contact request:', error);
    res.status(500).json({ success: false, message: 'خطا در ثبت درخواست' });
  }
});

// Get current license info
app.get('/api/license/current', async (req: Request, res: Response) => {
  try {
    const license = await licenseService.getCurrentLicense();
    if (license) {
      // Don't expose full license key
      const safeInfo = {
        id: license.id,
        licenseKeyPreview: license.licenseKey.substring(0, 9) + '****',
        schoolName: license.schoolName,
        contactName: license.contactName,
        licenseType: license.licenseType,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        gracePeriodDays: license.gracePeriodDays,
      };
      res.json(safeInfo);
    } else {
      res.status(404).json({ message: 'لایسنس فعالی یافت نشد' });
    }
  } catch (error) {
    console.error('Error getting current license:', error);
    res.status(500).json({ error: 'Failed to get license info' });
  }
});

// --- Apply License Middleware (blocks expired licenses) ---
app.use(licenseMiddleware);

// --- Health Check Route ---
app.get('/api/health', (req: Request, res: Response) => {
  console.log('Health check requested');
  res.json({ status: 'ok', message: 'Backend is running!' });
});

// --- School Config Routes ---
app.get('/api/config/school', async (req: Request, res: Response) => {
  try {
    const cfg = await databaseService.getSchoolConfig();
    res.json(cfg || {});
  } catch (error) {
    console.error('Error fetching school config:', error);
    res.status(500).json({ error: 'Failed to fetch school config' });
  }
});

app.put('/api/config/school', async (req: Request, res: Response) => {
  try {
    const saved = await databaseService.saveSchoolConfig(req.body || {});
    res.json(saved);
  } catch (error) {
    console.error('Error saving school config:', error);
    res.status(500).json({ error: 'Failed to save school config' });
  }
});

// --- Destructive Reset ---
app.post('/api/reset', async (req: Request, res: Response) => {
  try {
    const { confirm, wipeTeachers } = req.body || {};
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({ error: 'Confirmation token invalid' });
    }
    await databaseService.destructiveReset(!!wipeTeachers);
    res.json({ success: true });
  } catch (error) {
    console.error('Error during reset:', error);
    res.status(500).json({ error: 'Failed to reset' });
  }
});

// --- Database Routes ---
// Save timetable data
app.post('/api/timetables', async (req: Request, res: Response) => {
  try {
    const { name, description, data } = req.body;
    console.log(`Saving timetable: ${name}`);
    const timetable = await databaseService.saveTimetable(name, description, data);
    res.status(201).json(timetable);
  } catch (error) {
    console.error('Error saving timetable:', error);
    res.status(500).json({ error: 'Failed to save timetable' });
  }
});

// Get all timetables
app.get('/api/timetables', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all timetables');
    const timetables = await databaseService.getAllTimetables();
    res.json(timetables);
  } catch (error) {
    console.error('Error fetching timetables:', error);
    res.status(500).json({ error: 'Failed to fetch timetables' });
  }
});

// Get a specific timetable
app.get('/api/timetables/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Fetching timetable with ID: ${id}`);
    const timetable = await databaseService.getTimetable(id);
    if (timetable) {
      res.json(timetable);
    } else {
      res.status(404).json({ error: 'Timetable not found' });
    }
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// Update a timetable
app.put('/api/timetables/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { data } = req.body;
    console.log(`Updating timetable with ID: ${id}`);
    const timetable = await databaseService.updateTimetable(id, data);
    if (timetable) {
      res.json(timetable);
    } else {
      res.status(404).json({ error: 'Timetable not found' });
    }
  } catch (error) {
    console.error('Error updating timetable:', error);
    res.status(500).json({ error: 'Failed to update timetable' });
  }
});

// Delete a timetable
app.delete('/api/timetables/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Deleting timetable with ID: ${id}`);
    const success = await databaseService.deleteTimetable(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Timetable not found' });
    }
  } catch (error) {
    console.error('Error deleting timetable:', error);
    res.status(500).json({ error: 'Failed to delete timetable' });
  }
});

// --- Wizard Step Routes ---
// Save a wizard step
app.post('/api/wizard/:wizardId/steps/:stepKey', async (req: Request, res: Response) => {
  try {
    const wizardId = parseInt(req.params.wizardId);
    const stepKey = req.params.stepKey;
    const { data } = req.body;
    
    console.log(`Saving wizard step: ${stepKey} for wizard ${wizardId}`);
    const step = await databaseService.saveWizardStep(wizardId, stepKey, data);
    res.status(201).json(step);
  } catch (error) {
    console.error('Error saving wizard step:', error);
    res.status(500).json({ error: 'Failed to save wizard step' });
  }
});

// Get a specific wizard step
app.get('/api/wizard/:wizardId/steps/:stepKey', async (req: Request, res: Response) => {
  try {
    const wizardId = parseInt(req.params.wizardId);
    const stepKey = req.params.stepKey;
    
    console.log(`Fetching wizard step: ${stepKey} for wizard ${wizardId}`);
    const step = await databaseService.getWizardStep(wizardId, stepKey);
    if (step) {
      res.json(step);
    } else {
      res.status(404).json({ error: 'Wizard step not found' });
    }
  } catch (error) {
    console.error('Error fetching wizard step:', error);
    res.status(500).json({ error: 'Failed to fetch wizard step' });
  }
});

// Get all wizard steps for a wizard
app.get('/api/wizard/:wizardId/steps', async (req: Request, res: Response) => {
  try {
    const wizardId = parseInt(req.params.wizardId);
    
    console.log(`Fetching all wizard steps for wizard ${wizardId}`);
    const steps = await databaseService.getAllWizardSteps(wizardId);
    res.json(steps);
  } catch (error) {
    console.error('Error fetching wizard steps:', error);
    res.status(500).json({ error: 'Failed to fetch wizard steps' });
  }
});

// Delete all wizard steps for a wizard
app.delete('/api/wizard/:wizardId/steps', async (req: Request, res: Response) => {
  try {
    const wizardId = parseInt(req.params.wizardId);
    
    console.log(`Deleting all wizard steps for wizard ${wizardId}`);
    const success = await databaseService.deleteWizardSteps(wizardId);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Wizard steps not found' });
    }
  } catch (error) {
    console.error('Error deleting wizard steps:', error);
    res.status(500).json({ error: 'Failed to delete wizard steps' });
  }
});

// --- Configuration Routes ---
// Save configuration
app.post('/api/config/:key', async (req: Request, res: Response) => {
  try {
    console.log('[API ROUTE] POST /api/config/:key - START');
    console.log('[API ROUTE] Request params:', req.params);
    console.log('[API ROUTE] Request body:', req.body);
    console.log('[API ROUTE] Request body type:', typeof req.body);
    console.log('[API ROUTE] Request body keys:', Object.keys(req.body || {}));
    
    const key = req.params.key;
    const { value } = req.body;
    
    console.log('[API ROUTE] Extracted key:', key);
    console.log('[API ROUTE] Extracted value:', value);
    console.log('[API ROUTE] Value type:', typeof value);
    console.log('[API ROUTE] Value is object:', typeof value === 'object' && value !== null);
    console.log('[API ROUTE] Value is array:', Array.isArray(value));
    console.log('[API ROUTE] Value constructor:', value?.constructor?.name);
    
    // If value is an object, stringify it; otherwise use it as is (already a string)
    const stringValue = typeof value === 'object' && value !== null && !(value instanceof Date)
      ? JSON.stringify(value) 
      : String(value);
    
    console.log('[API ROUTE] After conversion - stringValue type:', typeof stringValue);
    console.log('[API ROUTE] After conversion - stringValue length:', stringValue?.length);
    console.log('[API ROUTE] After conversion - stringValue preview:', String(stringValue).substring(0, 150));
    
    console.log(`[API ROUTE] Calling databaseService.saveConfiguration with key: ${key}`);
    const config = await databaseService.saveConfiguration(key, stringValue);
    console.log('[API ROUTE] saveConfiguration returned successfully');
    console.log('[API ROUTE] Config saved:', JSON.stringify(config, null, 2));
    res.status(201).json(config);
  } catch (error) {
    console.error('[API ROUTE] Error saving configuration:', error);
    console.error('[API ROUTE] Error stack:', (error as Error).stack);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Get configuration
app.get('/api/config/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    console.log(`Fetching configuration: ${key}`);
    const value = await databaseService.getConfiguration(key);
    if (value !== null) {
      res.json({ key, value });
    } else {
      res.status(404).json({ error: 'Configuration not found' });
    }
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// --- Teacher Routes ---
// Get all teachers
app.get('/api/teachers', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all teachers');
    const teachers = await databaseService.getAllTeachers();
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Save a teacher
app.post('/api/teachers', async (req: Request, res: Response) => {
  try {
    const teacherData = req.body;
    console.log(`Saving teacher: ${teacherData.fullName}`);
    const teacher = await databaseService.saveTeacher(teacherData);
    res.status(201).json(teacher);
  } catch (error) {
    console.error('Error saving teacher:', error);
    res.status(500).json({ error: 'Failed to save teacher' });
  }
});

// Update a teacher
app.put('/api/teachers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const teacherData = req.body;
    console.log(`Updating teacher with ID: ${id}`);
    const teacher = await databaseService.updateTeacher(id, teacherData);
    if (teacher) {
      res.json(teacher);
    } else {
      res.status(404).json({ error: 'Teacher not found' });
    }
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// Delete a teacher
app.delete('/api/teachers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Deleting teacher with ID: ${id}`);
    const success = await databaseService.deleteTeacher(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Teacher not found' });
    }
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// Bulk import teachers
app.post('/api/teachers/bulk', async (req: Request, res: Response) => {
  try {
    const { teachers } = req.body;
    console.log(`Bulk importing ${teachers.length} teachers`);
    const savedTeachers = await databaseService.bulkImportTeachers(teachers);
    res.status(201).json(savedTeachers);
  } catch (error) {
    console.error('Error bulk importing teachers:', error);
    res.status(500).json({ error: 'Failed to bulk import teachers' });
  }
});

// --- Subject Routes ---
// Get all subjects
app.get('/api/subjects', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all subjects');
    const subjects = await databaseService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Save a subject
app.post('/api/subjects', async (req: Request, res: Response) => {
  try {
    const subjectData = req.body;
    console.log(`Saving subject: ${subjectData.name}`);
    const subject = await databaseService.saveSubject(subjectData);
    res.status(201).json(subject);
  } catch (error) {
    console.error('Error saving subject:', error);
    res.status(500).json({ error: 'Failed to save subject' });
  }
});

// Update a subject
app.put('/api/subjects/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const subjectData = req.body;
    console.log(`Updating subject with ID: ${id}`);
    const subject = await databaseService.updateSubject(id, subjectData);
    if (subject) {
      res.json(subject);
    } else {
      res.status(404).json({ error: 'Subject not found' });
    }
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete a subject
app.delete('/api/subjects/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Deleting subject with ID: ${id}`);
    const success = await databaseService.deleteSubject(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Subject not found' });
    }
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// Clear all subjects
app.delete('/api/subjects', async (req: Request, res: Response) => {
  try {
    console.log('Clearing all subjects');
    await databaseService.clearAllSubjects();
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing all subjects:', error);
    res.status(500).json({ error: 'Failed to clear all subjects' });
  }
});

// Clear subjects by grade
app.delete('/api/subjects/grade/:grade', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(req.params.grade);
    if (isNaN(grade)) return res.status(400).json({ error: 'Invalid grade' });
    console.log(`Clearing subjects for grade ${grade}`);
    await databaseService.clearSubjectsByGrade(grade);
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing grade subjects:', error);
    res.status(500).json({ error: 'Failed to clear grade subjects' });
  }
});

// Insert curriculum subjects for a grade (expects subjects in body)
app.post('/api/subjects/grade/:grade/insert-curriculum', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(req.params.grade);
    if (isNaN(grade)) return res.status(400).json({ error: 'Invalid grade' });
    const { subjects } = req.body || {};
    if (!Array.isArray(subjects)) return res.status(400).json({ error: 'subjects array required' });
    // Upsert provided subjects for the grade
    const normalized = subjects.map((s: any) => ({
      name: s.name,
      code: s.code || '',
      periodsPerWeek: s.periodsPerWeek || 0,
      requiredRoomType: s.requiredRoomType || '',
      isDifficult: !!s.isDifficult,
      grade,
      section: s.section || '',
    }));
    const saved = await databaseService.bulkUpsertSubjects(normalized);
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error inserting curriculum:', error);
    res.status(500).json({ error: 'Failed to insert curriculum for grade' });
  }
});

// --- Room Routes ---
// Get all rooms
app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all rooms');
    const rooms = await databaseService.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Save a room
app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const roomData = req.body;
    console.log(`Saving room: ${roomData.name}`);
    const room = await databaseService.saveRoom(roomData);
    res.status(201).json(room);
  } catch (error) {
    console.error('Error saving room:', error);
    res.status(500).json({ error: 'Failed to save room' });
  }
});

// Update a room
app.put('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const roomData = req.body;
    console.log(`Updating room with ID: ${id}`);
    const room = await databaseService.updateRoom(id, roomData);
    if (room) {
      res.json(room);
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete a room
app.delete('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Deleting room with ID: ${id}`);
    const success = await databaseService.deleteRoom(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// --- Class Routes ---
// Get all classes
app.get('/api/classes', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all classes');
    const classes = await databaseService.getAllClasses();
    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Save a class
app.post('/api/classes', async (req: Request, res: Response) => {
  try {
    const classData = req.body;
    console.log(`Saving class: ${classData.name}`);
    const classGroup = await databaseService.saveClass(classData);
    res.status(201).json(classGroup);
  } catch (error) {
    console.error('Error saving class:', error);
    res.status(500).json({ error: 'Failed to save class' });
  }
});

// Update a class
app.put('/api/classes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const classData = req.body;
    console.log(`Updating class with ID: ${id}`);
    const classGroup = await databaseService.updateClass(id, classData);
    if (classGroup) {
      res.json(classGroup);
    } else {
      res.status(404).json({ error: 'Class not found' });
    }
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete a class
app.delete('/api/classes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Deleting class with ID: ${id}`);
    const success = await databaseService.deleteClass(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Class not found' });
    }
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});


// --- Main Solver Route ---
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log('Received timetable generation request');
    
    // Validate that only enabled section subjects are included
    if (data.config && (data.config.sectionTimings || (data.config.enablePrimary !== undefined || data.config.enableMiddle !== undefined || data.config.enableHigh !== undefined))) {
      // Check if config has section information
      const hasSectionInfo = data.config.sectionTimings || 
        (data.config.enablePrimary !== undefined || data.config.enableMiddle !== undefined || data.config.enableHigh !== undefined);
      
      if (hasSectionInfo && data.subjects && Array.isArray(data.subjects)) {
        // Log subject count for debugging
        const subjectCount = data.subjects.length;
        console.log(`Generating timetable with ${subjectCount} subjects (filtered by enabled sections)`);
        
        // Optional: validate that subjects have grade information
        const subjectsWithoutGrade = data.subjects.filter((s: any) => !s.grade && !s.meta?.grade);
        if (subjectsWithoutGrade.length > 0) {
          console.warn(`Warning: ${subjectsWithoutGrade.length} subjects without grade information`);
        }
      }
    }
    
    // First, save the data to SQLite database
    const savedData = await saveTimetableData(data);
    
    // Then run Python solver
    const result = await runPythonSolver(savedData)
    
    res.json({
      success: true,
      data: result,
      message: 'Timetable generated successfully'
    });
  } catch (error: unknown) {
    console.error('Timetable generation failed:', error);
    
    const err = error as Error & { parsedError?: any; code?: string | number };
    
    // Try to extract structured error information
    let structuredError: any = null;
    if (err.parsedError) {
      structuredError = err.parsedError;
    } else {
      // Try to parse error from message if it contains stderr
      const message = err.message || '';
      if (message.includes('stderr:') || message.includes('validation error')) {
        const parsed = parseSolverError(message);
        if (parsed) {
          structuredError = parsed;
        }
      }
    }
    
    // Return structured error response if available
    if (structuredError) {
      res.status(500).json({
        success: false,
        error: {
          type: structuredError.errorType,
          entityType: structuredError.entityType,
          entityId: structuredError.entityId,
          field: structuredError.field,
          day: structuredError.day || null,
          expected: structuredError.expected || null,
          actual: structuredError.actual || null,
          details: structuredError.details,
          suggestedStep: structuredError.suggestedStep,
          message: structuredError.details
        },
        message: 'Failed to generate timetable'
      });
    } else {
      // Fallback to simple error response
      res.status(500).json({
        success: false,
        error: err.message,
        message: 'Failed to generate timetable'
      });
    }
  }
});



// Function to save data to SQLite
const saveTimetableData = async (data: any) => {
  try {
    // Your existing database saving logic here
    // This should use TypeORM to save to SQLite
    console.log('Saving data to SQLite database...');
    
    // Example structure - adapt to your actual entities
    const savedData = {
      id: Date.now().toString(),
      config: data.config,
      preferences: data.preferences,
      teachers: data.teachers,
      subjects: data.subjects,
      rooms: data.rooms,
      classes: data.classes,
      createdAt: new Date(),
      status: 'processing'
    };
    
    // Save to database (implement your TypeORM logic here)
    // await getRepository(TimetableData).save(savedData);
    
    console.log('Data saved to database successfully');
    return savedData;
  } catch (error: unknown) {
    console.error('Failed to save data to database:', error);
    throw new Error(`Database save failed: ${(error as Error).message}`);
  }
};

// --- Error handling middleware ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start the server ---
app.listen(port, '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://0.0.0.0:${port}`);
});
