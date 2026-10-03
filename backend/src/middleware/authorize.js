import { HttpError } from '../utils/httpError.js';
import { resources } from '../constants/resources.js';

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (req.user.role === 'SUPER_ADMIN' || req.user.permissions.includes(permission)) return next();
    next(new HttpError(403, 'You do not have permission to perform this action.'));
  };
}

export function requireResourcePermission(action) {
  return (req, _res, next) => {
    const resource = Object.hasOwn(resources, req.params.resource)
      ? resources[req.params.resource]
      : undefined;
    if (!resource) return next(new HttpError(404, 'Unknown resource.'));
    return requirePermission(`${resource.permission}.${action}`)(req, _res, next);
  };
}
