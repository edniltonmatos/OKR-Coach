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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Início da semana N e fim exclusivo (alinhado a getCurrentWeekNumber). */
export function getWeekBounds(
  cycle: Cycle,
  weekNumber: number
): { start: Date; endExclusive: Date } {
  const start = parseLocalDate(cycle.startDate);
  start.setHours(0, 0, 0, 0);
  const w = Math.min(Math.max(weekNumber, 1), cycle.weekCount);
  const ws = new Date(start.getTime() + (w - 1) * WEEK_MS);
  const we = new Date(start.getTime() + w * WEEK_MS);
  return { start: ws, endExclusive: we };
}

/** Índice da semana (1-based) para um instante ISO do ciclo. */
export function getWeekNumberForTimestamp(cycle: Cycle, isoCreatedAt: string): number {
  const t = new Date(isoCreatedAt);
  const start = parseLocalDate(cycle.startDate);
  start.setHours(0, 0, 0, 0);
  const t0 = new Date(t);
  t0.setHours(0, 0, 0, 0);
  const diffMs = t0.getTime() - start.getTime();
  const raw = Math.floor(diffMs / WEEK_MS) + 1;
  return Math.min(Math.max(raw, 1), cycle.weekCount);
}
