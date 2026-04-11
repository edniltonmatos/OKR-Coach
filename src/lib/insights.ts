import type { KeyResult } from '../types';

/** Local heuristic when IA is unavailable */
export function buildLocalStatusInsight(krs: KeyResult[], weekNumber: number, weekCount: number): string {
  if (krs.length === 0) return 'Defina um ciclo e KRs para ver o status.';
  const progressThrough = weekCount > 0 ? weekNumber / weekCount : 0;
  const lines: string[] = [];
  for (const kr of krs) {
    const span = kr.targetValue - kr.initialValue;
    if (span === 0) continue;
    const expected = kr.initialValue + span * progressThrough;
    const actual = kr.currentValue;
    const ratio = (actual - kr.initialValue) / span;
    const expectedRatio = progressThrough;
    if (ratio + 0.08 < expectedRatio) {
      lines.push(`${kr.label}: abaixo da linha esperada para a semana.`);
    } else if (ratio > expectedRatio + 0.08) {
      lines.push(`${kr.label}: acima da projeção linear.`);
    }
  }
  if (lines.length === 0) {
    return 'Progresso alinhado à projeção linear do ciclo. Continue o ritmo nas próximas semanas.';
  }
  return lines.join(' ');
}
