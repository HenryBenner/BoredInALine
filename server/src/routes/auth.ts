import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
    body('school').optional().trim(),
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty(),
  ],
  authController.login
);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/google', authController.googleAuth);
router.post('/apple', authController.appleAuth);

export default router;
