import { Router } from 'express';
import * as controller from '../controllers/phaseThreeController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePermission } from '../middleware/authorize.js';

export const phaseThreeRouter = Router();

// Permissions required: announcements.create, announcements.publish,
// announcements.read, announcements.manage, search.read, activity.read,
// and books.read for book search/activity results.
phaseThreeRouter.post(
  '/announcements',
  requirePermission('announcements.create'),
  asyncHandler(controller.createAnnouncement)
);
phaseThreeRouter.post(
  '/announcements/:id/publish',
  requirePermission('announcements.publish'),
  asyncHandler(controller.publishAnnouncement)
);
phaseThreeRouter.get(
  '/announcements',
  requirePermission('announcements.read'),
  asyncHandler(controller.listAnnouncements)
);
phaseThreeRouter.get(
  '/announcements/:id',
  requirePermission('announcements.read'),
  asyncHandler(controller.getAnnouncement)
);
phaseThreeRouter.get(
  '/search',
  requirePermission('search.read'),
  asyncHandler(controller.globalSearch)
);
phaseThreeRouter.get(
  '/activity/:entityType/:entityId',
  requirePermission('activity.read'),
  asyncHandler(controller.entityActivity)
);
