import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as moderationController from '../controllers/moderationController';

const router = Router();

router.post('/report', authenticate, moderationController.reportContent);
router.post('/block', authenticate, moderationController.blockUser);
router.delete('/block/:userId', authenticate, moderationController.unblockUser);
router.get('/blocked', authenticate, moderationController.getBlockedUsers);
router.get('/reports', authenticate, moderationController.getReports);
router.put('/reports/:reportId', authenticate, moderationController.resolveReport);
router.get('/moderation-logs', authenticate, moderationController.getModerationLogs);

export default router;
