import { HttpError } from './httpError.js';

function finiteAmount(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number >= 10000000000 || !hasTwoDecimalPlaces(number)) {
    throw new HttpError(400, `${field} must be a non-negative amount with at most two decimal places.`);
  }
  return number;
}

export function hasTwoDecimalPlaces(value) {
  return Math.abs(Math.round(Number(value) * 100) - Number(value) * 100) <= 1e-8;
}

export function calculateFeeBalance({ totalAmount, discount = 0, scholarship = 0, lateFee = 0, paidAmount = 0 }) {
  const total = finiteAmount(totalAmount, 'total_amount');
  const discountAmount = finiteAmount(discount, 'discount');
  const scholarshipAmount = finiteAmount(scholarship, 'scholarship');
  const lateFeeAmount = finiteAmount(lateFee, 'late_fee');
  const paid = finiteAmount(paidAmount, 'paid_amount');
  if (discountAmount + scholarshipAmount > total) {
    throw new HttpError(400, 'Discount and scholarship cannot exceed total_amount.');
  }
  const assessed = Number((total - discountAmount - scholarshipAmount + lateFeeAmount).toFixed(2));
  if (paid > assessed) throw new HttpError(409, 'Paid amount cannot exceed the assessed fee.');
  return {
    assessedAmount: assessed,
    paidAmount: Number(paid.toFixed(2)),
    remainingAmount: Number((assessed - paid).toFixed(2))
  };
}

export function calculateGrade(marks, maximum, scales) {
  const score = Number(marks);
  const max = Number(maximum);
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0 ||
      !hasTwoDecimalPlaces(score) || !hasTwoDecimalPlaces(max) || score < 0 || score > max) {
    throw new HttpError(400, 'marks_obtained must be between zero and maximum_marks.');
  }
  const percentage = Math.round((score / max) * 10000) / 100;
  const matching = scales.filter((scale) => scale.is_active &&
    percentage >= Number(scale.minimum_percentage) &&
    percentage <= Number(scale.maximum_percentage));
  if (matching.length !== 1) throw new HttpError(409, `Expected one active grade range for ${percentage}%; found ${matching.length}.`);
  return {
    percentage,
    letterGrade: matching[0].letter_grade,
    gradePoint: Number(matching[0].grade_point)
  };
}

export function weightedGpa(courses) {
  let weightedPoints = 0;
  let creditHours = 0;
  for (const course of courses) {
    const credit = Number(course.credit_hours);
    const point = Number(course.grade_point);
    if (!Number.isFinite(credit) || credit <= 0 || !Number.isFinite(point) || point < 0 || point > 4) {
      throw new HttpError(500, 'Cannot calculate GPA from invalid course credit or grade data.');
    }
    weightedPoints += credit * point;
    creditHours += credit;
  }
  return {
    gpa: creditHours ? Number((weightedPoints / creditHours).toFixed(2)) : null,
    creditHours,
    weightedPoints
  };
}

export function timeRangeOverlaps(first, second) {
  const startA = timeSeconds(first.start_time);
  const endA = timeSeconds(first.end_time);
  const startB = timeSeconds(second.start_time);
  const endB = timeSeconds(second.end_time);
  return first.day_of_week === second.day_of_week && startA < endB && endA > startB;
}

export function validTimeRange(start, end) {
  const valid = (value) => typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
  return valid(start) && valid(end) && timeSeconds(end) > timeSeconds(start);
}

function timeSeconds(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
    throw new Error('Invalid time.');
  }
  const [hours, minutes, seconds = '0'] = value.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
