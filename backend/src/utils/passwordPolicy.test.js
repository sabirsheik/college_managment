import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStrongPassword } from './passwordPolicy.js';

test('accepts a long password with three character classes', () => {
  assert.doesNotThrow(() => assertStrongPassword('Secure campus 2026!'));
});

test('rejects short, simple, and bcrypt-truncated password values', () => {
  assert.throws(() => assertStrongPassword('Short!1'), { status: 400 });
  assert.throws(() => assertStrongPassword('lowercasepassword'), { status: 400 });
  assert.throws(() => assertStrongPassword(`Strong!A1${'é'.repeat(36)}`), { status: 400 });
});
