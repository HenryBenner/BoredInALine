import { Router } from 'express';
import * as superAdminController from '../controllers/superAdminController';
import { authenticateSuperAdmin } from '../middleware/auth';

const router = Router();

router.post('/send-notification', authenticateSuperAdmin, superAdminController.sendBroadcastNotification);
router.get('/notifications', authenticateSuperAdmin, superAdminController.getBroadcastHistory);

export default router;
