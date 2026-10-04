import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, serializeCsv } from './csv.js';

test('parses quoted commas, escaped quotes, newlines, CRLF, and BOM headers', () => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\n"Lee, Jordan","said ""hello"""\r\n"Alex","first line\nsecond line"'), [
    { rowNumber: 2, values: { name: 'Lee, Jordan', note: 'said "hello"' } },
    { rowNumber: 3, values: { name: 'Alex', note: 'first line\nsecond line' } }
  ]);
});

test('rejects malformed rows, duplicated headers, open quotes, and row limits', () => {
  assert.throws(() => parseCsv('name,email\nAlex'), { status: 400 });
  assert.throws(() => parseCsv('name,name\nAlex,Lee'), { status: 400 });
  assert.throws(() => parseCsv('name\n"Alex'), { status: 400 });
  assert.throws(() => parseCsv('name\nA\nB', { maximumRows: 1 }), { status: 413 });
});

test('CSV export escapes cells and neutralizes spreadsheet formulas', () => {
  assert.equal(
    serializeCsv(['name', 'formula'], [{ name: 'Alex, Lee', formula: '=cmd()' }]),
    'name,formula\r\n"Alex, Lee",\'=cmd()'
  );
});
