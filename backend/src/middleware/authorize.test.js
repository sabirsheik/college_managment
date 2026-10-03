import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission, requireResourcePermission } from './authorize.js';

function invoke(middleware, user, resource = 'students') {
  let error;
  middleware({ user, params: { resource } }, {}, (nextError) => { error = nextError; });
  return error;
}

test('enforces database-derived permissions while allowing super administrators', () => {
  assert.equal(invoke(requirePermission('students.read'), {
    id: 1, role: 'FACULTY', permissions: ['students.read']
  }), undefined);
  assert.equal(invoke(requirePermission('students.delete'), {
    id: 1, role: 'SUPER_ADMIN', permissions: []
  }), undefined);
  assert.equal(invoke(requirePermission('students.delete'), {
    id: 1, role: 'FACULTY', permissions: ['students.read']
  }).status, 403);
});

test('maps resource actions to permission names and rejects unknown resources', () => {
  assert.equal(invoke(requireResourcePermission('create'), {
    id: 1, role: 'ADMIN', permissions: ['students.create']
  }), undefined);
  assert.equal(invoke(requireResourcePermission('delete'), {
    id: 1, role: 'STUDENT', permissions: []
  }).status, 403);
  assert.equal(invoke(requireResourcePermission('read'), {
    id: 1, role: 'SUPER_ADMIN', permissions: []
  }, 'not-a-resource').status, 404);
});
