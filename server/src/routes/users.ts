import { Router } from 'express';
import { body } from 'express-validator';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, userController.getCurrentUser);
router.put('/me', authenticate, userController.updateProfile);
router.post(
  '/me/password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  userController.changePassword
);
router.post('/me/delete', authenticate, userController.deleteAccount);
router.get('/search', authenticate, userController.searchUsers);
router.get('/me/friends', authenticate, userController.getFriends);
router.get('/me/friends/activity', authenticate, userController.getFriendActivity);
router.post('/me/push-token', authenticate, userController.updatePushToken);
router.delete('/me/push-token', authenticate, userController.removePushToken);
router.get('/:id', authenticate, userController.getUserById);
router.get('/:id/profile', authenticate, userController.getUserProfile);
router.get('/:id/visit-history', authenticate, userController.getVisitHistory);

export default router;
