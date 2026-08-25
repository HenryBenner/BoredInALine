import { Router } from 'express';
import { body } from 'express-validator';
import * as chatController from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:barId/messages', authenticate, chatController.getMessages);
router.post(
  '/:barId/messages',
  authenticate,
  chatController.sendMessage
);
router.post('/:barId/messages/:messageId/reactions', authenticate, chatController.addMessageReaction);
router.delete('/:barId/messages/:messageId/reactions', authenticate, chatController.removeMessageReaction);

export default router;
