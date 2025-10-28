// backend/server.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {runPythonSolver} from './pyhonSolverNodeFunction';

// Import our database service
import { DatabaseService } from './src/database/databaseService';

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
databaseService.initialize().then(() => {
  console.log('Database initialized successfully');
}).catch((error) => {
  console.error('Failed to initialize database:', error);
});

// --- Health Check Route ---
app.get('/api/health', (req: Request, res: Response) => {
  console.log('Health check requested');
  res.json({ status: 'ok', message: 'Backend is running!' });
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
    const key = req.params.key;
    const { value } = req.body;
    
    console.log(`Saving configuration: ${key}`);
    const config = await databaseService.saveConfiguration(key, value);
    res.status(201).json(config);
  } catch (error) {
    console.error('Error saving configuration:', error);
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
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to generate timetable'
    });
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
