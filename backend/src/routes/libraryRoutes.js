import { Router } from 'express';
import * as controller from '../controllers/libraryController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePermission } from '../middleware/authorize.js';

export const libraryRouter = Router();

const handlers = {
  categories: {
    list: controller.listEntity.bind(null, 'categories'),
    get: controller.getEntity.bind(null, 'categories'),
    create: controller.createEntity.bind(null, 'categories'),
    update: controller.updateEntity.bind(null, 'categories'),
    remove: controller.deleteEntity.bind(null, 'categories')
  },
  books: {
    list: controller.listEntity.bind(null, 'books'),
    get: controller.getEntity.bind(null, 'books'),
    create: controller.createEntity.bind(null, 'books'),
    update: controller.updateEntity.bind(null, 'books'),
    remove: controller.deleteEntity.bind(null, 'books')
  },
  copies: {
    list: controller.listEntity.bind(null, 'copies'),
    get: controller.getEntity.bind(null, 'copies'),
    create: controller.createEntity.bind(null, 'copies'),
    update: controller.updateEntity.bind(null, 'copies'),
    remove: controller.deleteEntity.bind(null, 'copies')
  },
  members: {
    list: controller.listEntity.bind(null, 'members'),
    get: controller.getEntity.bind(null, 'members'),
    create: controller.createEntity.bind(null, 'members'),
    update: controller.updateEntity.bind(null, 'members'),
    remove: controller.deleteEntity.bind(null, 'members')
  }
};

function registerCollection(path, permission, actions) {
  libraryRouter.get(path, requirePermission(`${permission}.read`), asyncHandler(actions.list));
  libraryRouter.post(path, requirePermission(`${permission}.create`), asyncHandler(actions.create));
  libraryRouter.get(`${path}/:id`, requirePermission(`${permission}.read`), asyncHandler(actions.get));
  libraryRouter.patch(`${path}/:id`, requirePermission(`${permission}.update`), asyncHandler(actions.update));
  libraryRouter.delete(`${path}/:id`, requirePermission(`${permission}.delete`), asyncHandler(actions.remove));
}

registerCollection('/categories', 'library.categories', handlers.categories);
registerCollection('/books', 'library.books', handlers.books);
registerCollection('/copies', 'library.copies', handlers.copies);
registerCollection('/members', 'library.members', handlers.members);

libraryRouter.get('/search', requirePermission('library.books.read'), asyncHandler(controller.searchLibrary));
libraryRouter.get('/availability', requirePermission('library.books.read'), asyncHandler(controller.getAvailability));
libraryRouter.get('/loans', requirePermission('library.loans.read'), asyncHandler(controller.listLoans));
libraryRouter.post('/loans', requirePermission('library.loans.create'), asyncHandler(controller.issueLoan));
libraryRouter.post('/loans/:id/return', requirePermission('library.loans.update'), asyncHandler(controller.returnLoan));
libraryRouter.post('/loans/:id/renew', requirePermission('library.loans.update'), asyncHandler(controller.renewLoan));
libraryRouter.get('/fines', requirePermission('library.fines.read'), asyncHandler(controller.listFines));
libraryRouter.get('/fines/overdue', requirePermission('library.fines.read'), asyncHandler(controller.listOverdueFines));
