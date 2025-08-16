import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate,
  toISODate,
  addDays,
  daysUntil,
} from './date.js';

test('parseDate handles YYYY-MM-DD strings in local time', () => {
  const d = parseDate('2024-02-03');
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 1); // Months are zero-indexed
  assert.equal(d.getDate(), 3);
});

test('addDays shifts the date correctly', () => {
  const d = addDays('2024-02-03', 2);
  assert.equal(toISODate(d), '2024-02-05');
});

test('daysUntil returns 0 when dates match', () => {
  const ref = parseDate('2024-02-03');
  assert.equal(daysUntil('2024-02-03', ref), 0);
});
