import { Router } from 'express';
import express from 'express';
import { exportCsv, importCsv } from '../controllers/dataExchangeController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePermission } from '../middleware/authorize.js';

export const dataExchangeRouter = Router();

dataExchangeRouter.post(
  '/imports/:entity',
  requirePermission('imports.run'),
  express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }),
  asyncHandler(importCsv)
);
dataExchangeRouter.get(
  '/exports/:report',
  requirePermission('exports.run'),
  asyncHandler(exportCsv)
);
