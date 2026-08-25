import path from 'path';
import { Router } from 'express';
import { databasePath } from '../../ormconfig';
import { createDatabaseBackup, pruneDatabaseBackups } from '../database/bootstrap';

export function createDataSafetyRoutes(): Router {
  const router = Router();
  router.post('/recovery-point', async (req, res, next) => {
    try {
      const directory = process.env.MAKTAB_RECOVERY_DIRECTORY || path.join(path.dirname(databasePath), 'recovery');
      const backupPath = await createDatabaseBackup(databasePath, 'recovery', directory);
      if (!backupPath) throw new Error('The active database is not available for backup');
      pruneDatabaseBackups(directory, path.basename(databasePath));
      res.status(201).json({ id: path.basename(backupPath) });
    } catch (error) { next(error); }
  });
  return router;
}
