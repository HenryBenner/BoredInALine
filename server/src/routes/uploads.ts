import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { authenticate, authenticateBarAdmin } from '../middleware/auth';
import * as uploadController from '../controllers/uploadController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

router.post('/upload', authenticate as RequestHandler, upload.single('file') as RequestHandler, uploadController.uploadMedia as RequestHandler);
router.post('/profile-image', authenticate as RequestHandler, upload.single('file') as RequestHandler, uploadController.uploadProfileImage as RequestHandler);
router.post('/bar-image', authenticateBarAdmin as RequestHandler, upload.single('file') as RequestHandler, uploadController.uploadBarImage as RequestHandler);

export default router;
