import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { authenticate, authenticateOptional } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(controller.login));
authRouter.post('/logout', authenticateOptional, asyncHandler(controller.logout));
authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post('/change-password', authenticate, asyncHandler(controller.changePassword));
authRouter.post('/password-reset/request', asyncHandler(controller.requestPasswordReset));
authRouter.post('/password-reset/complete', asyncHandler(controller.completePasswordReset));
