import type { Cycle } from '../types';

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 1-based week index within the cycle, clamped to [1, weekCount] */
export function getCurrentWeekNumber(cycle: Cycle): number {
  const start = parseLocalDate(cycle.startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - start.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const raw = Math.floor(diffMs / weekMs) + 1;
  return Math.min(Math.max(raw, 1), cycle.weekCount);
}

export function isReviewDay(cycle: Cycle): boolean {
  const today = new Date().getDay();
  return today === cycle.reviewWeekday;
}
