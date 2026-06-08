import { daysInMonth, addMonths } from '../src/utils/dateUtils';

test('daysInMonth works for Jan/Feb', () => {
  expect(daysInMonth(new Date('2025-01-10'))).toBe(31);
  expect(daysInMonth(new Date('2024-02-10'))).toBe(29); // leap year
});

test('addMonths adds months correctly', () => {
  const d = new Date('2025-01-31');
  const r = addMonths(d, 1);
  expect(r.getMonth()).toBe(1); // Feb
});


