import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.JWT_SECRET = 'unit-test-secret-that-is-not-used-for-signing';
process.env.FRONTEND_URL = 'http://localhost:5173';
const { verifyOrigin } = await import('./verifyOrigin.js');

function run(method, origin) {
  let error;
  let passed = false;
  verifyOrigin({ method, get: () => origin }, null, (cause) => {
    error = cause;
    passed = !cause;
  });
  return { error, passed };
}

test('allows safe methods without an Origin header', () => {
  assert.deepEqual(run('GET'), { error: undefined, passed: true });
});

test('requires an exact trusted Origin for state-changing methods', () => {
  assert.deepEqual(run('POST', 'http://localhost:5173'), { error: undefined, passed: true });
  assert.equal(run('PATCH').error.status, 403);
  assert.equal(run('DELETE', 'https://untrusted.example').error.status, 403);
  assert.equal(run('POST', 'http://localhost:5173/path').error.status, 403);
});
