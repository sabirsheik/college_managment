import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFeeBalance, calculateGrade, timeRangeOverlaps, validTimeRange, weightedGpa
} from './phaseTwoRules.js';

test('fee balance accounts for discounts, scholarship, late fees, and payments', () => {
  assert.deepEqual(
    calculateFeeBalance({ totalAmount: 1000, discount: 50, scholarship: 100, lateFee: 25, paidAmount: 300 }),
    { assessedAmount: 875, paidAmount: 300, remainingAmount: 575 }
  );
  assert.throws(
    () => calculateFeeBalance({ totalAmount: 100, discount: 60, scholarship: 50 }),
    { status: 400 }
  );
  assert.throws(
    () => calculateFeeBalance({ totalAmount: 100, paidAmount: 101 }),
    { status: 409 }
  );
  assert.throws(() => calculateFeeBalance({ totalAmount: 10.001 }), { status: 400 });
});

test('grades are calculated from exactly one active configurable percentage band', () => {
  const scale = [
    { letter_grade: 'A', minimum_percentage: 90, maximum_percentage: 100, grade_point: 4, is_active: true },
    { letter_grade: 'F', minimum_percentage: 0, maximum_percentage: 89.98, grade_point: 0, is_active: true }
  ];
  assert.deepEqual(calculateGrade(45, 50, scale), {
    percentage: 90, letterGrade: 'A', gradePoint: 4
  });
  assert.throws(() => calculateGrade(101, 100, scale), { status: 400 });
  assert.throws(() => calculateGrade(89.99, 100, scale), { status: 409 });
});

test('GPA is credit-hour weighted and empty academic results have no GPA', () => {
  assert.deepEqual(weightedGpa([
    { credit_hours: 3, grade_point: 4 },
    { credit_hours: 1, grade_point: 2 }
  ]), { gpa: 3.5, creditHours: 4, weightedPoints: 14 });
  assert.deepEqual(weightedGpa([]), { gpa: null, creditHours: 0, weightedPoints: 0 });
});

test('timetable uses strict valid times and half-open overlap boundaries', () => {
  assert.equal(validTimeRange('09:00', '10:00'), true);
  assert.equal(validTimeRange('09:00:30', '09:00'), false);
  assert.equal(validTimeRange('25:00', '26:00'), false);
  assert.equal(timeRangeOverlaps(
    { day_of_week: 1, start_time: '09:00', end_time: '10:00' },
    { day_of_week: 1, start_time: '09:30:00', end_time: '10:30:00' }
  ), true);
  assert.equal(timeRangeOverlaps(
    { day_of_week: 1, start_time: '09:00', end_time: '10:00' },
    { day_of_week: 1, start_time: '10:00:00', end_time: '11:00:00' }
  ), false);
});
