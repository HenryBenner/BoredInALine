import { Router } from 'express';
import { body } from 'express-validator';
import * as friendController from '../controllers/friendController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post(
  '/request',
  authenticate,
  [body('friendId').notEmpty()],
  friendController.sendFriendRequest
);
router.get('/requests', authenticate, friendController.getPendingRequests);
router.post('/accept/:id', authenticate, friendController.acceptFriendRequest);
router.delete('/decline/:id', authenticate, friendController.declineFriendRequest);
router.delete('/remove/:id', authenticate, friendController.removeFriend);

export default router;
