import { Router } from 'express';
import { LicenseLeaseService } from '../services/licenseLease.service';

const router = Router();

router.get('/status', (_req, res) => {
  res.json(LicenseLeaseService.getInstance().getStatus());
});

export default router;
