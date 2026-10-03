import { Router } from 'express';
import * as controller from '../controllers/resourceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireResourcePermission } from '../middleware/authorize.js';

export const resourceRouter = Router();

resourceRouter.get('/:resource', requireResourcePermission('read'), asyncHandler(controller.list));
resourceRouter.post('/:resource', requireResourcePermission('create'), asyncHandler(controller.create));
resourceRouter.get('/:resource/:id', requireResourcePermission('read'), asyncHandler(controller.get));
resourceRouter.patch('/:resource/:id', requireResourcePermission('update'), asyncHandler(controller.update));
resourceRouter.delete('/:resource/:id', requireResourcePermission('delete'), asyncHandler(controller.remove));
