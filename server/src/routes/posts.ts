import { Router } from 'express';
import { body } from 'express-validator';
import * as postController from '../controllers/postController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, postController.getPosts);
router.get('/:id', optionalAuth, postController.getPostById);
router.post(
  '/',
  authenticate,
  [
    body('content').trim().notEmpty(),
  ],
  postController.createPost
);
router.post('/:id/like', authenticate, postController.likePost);
router.delete('/:id/like', authenticate, postController.unlikePost);
router.get('/:id/replies', optionalAuth, postController.getReplies);
router.post('/:id/reactions', authenticate, postController.addReaction);
router.delete('/:id/reactions', authenticate, postController.removeReaction);
router.delete('/:id', authenticate, postController.deletePost);

export default router;
