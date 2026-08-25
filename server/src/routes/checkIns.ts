import { Router } from 'express';
import { body } from 'express-validator';
import * as checkInController from '../controllers/checkInController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post(
  '/',
  authenticate,
  [
    body('barId').notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ],
  checkInController.checkIn
);
router.get('/current', authenticate, checkInController.getCurrentCheckIn);
router.delete('/current', authenticate, checkInController.checkOut);
router.get('/:barId/users', authenticate, checkInController.getCheckedInUsers);

export default router;
