import test from 'node:test';
import assert from 'node:assert/strict';
import { resources } from '../constants/resources.js';
import { validateResourceBody } from '../validators/resourceValidators.js';

test('student input trims strings and converts validated integer fields', () => {
  assert.deepEqual(
    validateResourceBody(resources.students, {
      registration_number: ' REG-2 ',
      first_name: ' Kai ',
      last_name: 'Ng ',
      email: 'kai@example.edu',
      department_id: '3',
      status: 'ACTIVE'
    }),
    {
      registration_number: 'REG-2',
      first_name: 'Kai',
      last_name: 'Ng',
      email: 'kai@example.edu',
      department_id: 3,
      status: 'ACTIVE'
    }
  );
});

test('rejects unknown fields, invalid emails, and invalid IDs', () => {
  assert.throws(
    () => validateResourceBody(resources.departments, { name: 'Science', code: 'SCI', extra: 'x' }),
    { status: 400 }
  );
  assert.throws(
    () => validateResourceBody(resources.faculty, {
      first_name: 'A', last_name: 'B', email: 'not-an-email', department_id: 1, employment_status: 'ACTIVE'
    }),
    { status: 400 }
  );
  assert.throws(
    () => validateResourceBody(resources.programs, {
      department_id: '0', name: 'Computing', code: 'CS', degree_level: 'Bachelor',
      duration_years: '4', status: 'ACTIVE'
    }),
    { status: 400 }
  );
});

test('validates real calendar dates and academic session booleans', () => {
  assert.throws(
    () => validateResourceBody(resources['academic-sessions'], {
      name: '2026-2027', start_date: '2026-02-30', end_date: '2027-06-30',
      is_current: true, status: 'ACTIVE'
    }),
    { status: 400 }
  );
  assert.throws(
    () => validateResourceBody(resources['academic-sessions'], {
      name: '2026-2027', start_date: '2026-09-01', end_date: '2027-06-30',
      is_current: 'true', status: 'ACTIVE'
    }),
    { status: 400 }
  );
});
