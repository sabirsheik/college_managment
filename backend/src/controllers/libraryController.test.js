import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://library-tests:library-tests@127.0.0.1:5432/library_tests';
process.env.JWT_SECRET ||= 'unit-test-secret-that-is-long-enough-for-local-import';

const {
  assertLibraryCopyCanBeIssued, assertLibraryLoanCanRenew, assertLibraryMemberCanBorrow,
  calculateOverdueFine, parseLibraryId, parseLibraryPagination
} = await import('./libraryController.js');

test('library IDs and pagination reject unsafe values', () => {
  assert.equal(parseLibraryId('42', 'book_id'), 42);
  assert.throws(() => parseLibraryId('0'), { status: 400 });
  assert.throws(() => parseLibraryId('2x'), { status: 400 });
  assert.deepEqual(parseLibraryPagination({ page: '3', limit: '25' }), {
    page: 3, limit: 25, offset: 50
  });
  assert.throws(() => parseLibraryPagination({ page: '-1' }), { status: 400 });
  assert.throws(() => parseLibraryPagination({ limit: '101' }), { status: 400 });
});

test('overdue fines use calendar-day grace and cents precision', () => {
  assert.deepEqual(calculateOverdueFine('2026-10-01', '2026-10-04'), {
    overdueDays: 3, amount: 1.5
  });
  assert.deepEqual(calculateOverdueFine('2026-10-04', '2026-10-04'), {
    overdueDays: 0, amount: 0
  });
  assert.deepEqual(calculateOverdueFine('2026-10-01', '2026-10-04', 1.25), {
    overdueDays: 3, amount: 3.75
  });
  assert.throws(() => calculateOverdueFine('2026-02-30', '2026-03-01'), { status: 400 });
});

test('issue rules reject inactive, over-limit, unavailable, and already-loaned copies', () => {
  assert.doesNotThrow(() => assertLibraryMemberCanBorrow({
    isActive: true, activeLoanCount: 1, maxActiveLoans: 2
  }));
  assert.throws(() => assertLibraryMemberCanBorrow({
    isActive: false, activeLoanCount: 0, maxActiveLoans: 2
  }), { status: 409 });
  assert.throws(() => assertLibraryMemberCanBorrow({
    isActive: true, activeLoanCount: 2, maxActiveLoans: 2
  }), { status: 409 });
  assert.doesNotThrow(() => assertLibraryCopyCanBeIssued({
    status: 'AVAILABLE', bookIsActive: true, hasActiveLoan: false
  }));
  assert.throws(() => assertLibraryCopyCanBeIssued({
    status: 'MAINTENANCE', bookIsActive: true, hasActiveLoan: false
  }), { status: 409 });
  assert.throws(() => assertLibraryCopyCanBeIssued({
    status: 'AVAILABLE', bookIsActive: true, hasActiveLoan: true
  }), { status: 409 });
});

test('renewal rules reject returned, overdue, and maximum-renewal loans', () => {
  assert.doesNotThrow(() => assertLibraryLoanCanRenew({
    returnedAt: null, dueDate: '2026-10-04', renewalCount: 1, today: '2026-10-03'
  }));
  assert.throws(() => assertLibraryLoanCanRenew({
    returnedAt: '2026-10-03T10:00:00Z', dueDate: '2026-10-04', renewalCount: 0, today: '2026-10-03'
  }), { status: 409 });
  assert.throws(() => assertLibraryLoanCanRenew({
    returnedAt: null, dueDate: '2026-10-02', renewalCount: 0, today: '2026-10-03'
  }), { status: 409 });
  assert.throws(() => assertLibraryLoanCanRenew({
    returnedAt: null, dueDate: '2026-10-04', renewalCount: 2, today: '2026-10-03'
  }), { status: 409 });
});
