import type { ChatMessage, Cycle, KeyResult, WeekEntry } from '../types';
import { getDatabase } from './client';

function nowIso(): string {
  return new Date().toISOString();
}

export async function getLatestCycle(): Promise<Cycle | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    objective_title: string;
    start_date: string;
    week_count: number;
    review_weekday: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, objective_title, start_date, week_count, review_weekday, created_at, updated_at
     FROM cycle ORDER BY created_at DESC LIMIT 1`
  );
  if (!row) return null;
  return {
    id: row.id,
    objectiveTitle: row.objective_title,
    startDate: row.start_date,
    weekCount: row.week_count,
    reviewWeekday: row.review_weekday,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getKeyResults(cycleId: string): Promise<KeyResult[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    cycle_id: string;
    sort_order: number;
    label: string;
    initial_value: number;
    target_value: number;
    current_value: number;
  }>(
    `SELECT id, cycle_id, sort_order, label, initial_value, target_value, current_value
     FROM key_result WHERE cycle_id = ? ORDER BY sort_order ASC`,
    [cycleId]
  );
  return rows.map((row) => ({
    id: row.id,
    cycleId: row.cycle_id,
    sortOrder: row.sort_order,
    label: row.label,
    initialValue: row.initial_value,
    targetValue: row.target_value,
    currentValue: row.current_value,
  }));
}

export async function createCycleWithKeyResults(
  cycle: Omit<Cycle, 'createdAt' | 'updatedAt'>,
  keyResults: Omit<KeyResult, 'id' | 'cycleId'>[]
): Promise<void> {
  const db = await getDatabase();
  const ts = nowIso();
  await db.runAsync('DELETE FROM cycle');
  await db.runAsync(
    `INSERT INTO cycle (id, objective_title, start_date, week_count, review_weekday, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      cycle.id,
      cycle.objectiveTitle,
      cycle.startDate,
      cycle.weekCount,
      cycle.reviewWeekday,
      ts,
      ts,
    ]
  );
  for (const kr of keyResults) {
    const krId = `${cycle.id}-kr${kr.sortOrder}`;
    await db.runAsync(
      `INSERT INTO key_result (id, cycle_id, sort_order, label, initial_value, target_value, current_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        krId,
        cycle.id,
        kr.sortOrder,
        kr.label,
        kr.initialValue,
        kr.targetValue,
        kr.currentValue,
      ]
    );
  }
}

export async function updateKeyResultCurrentValues(
  cycleId: string,
  values: [number, number, number]
): Promise<void> {
  const db = await getDatabase();
  const krs = await getKeyResults(cycleId);
  const sorted = [...krs].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < sorted.length; i++) {
    await db.runAsync(`UPDATE key_result SET current_value = ? WHERE id = ?`, [
      values[i] ?? sorted[i].currentValue,
      sorted[i].id,
    ]);
  }
  await db.runAsync(`UPDATE cycle SET updated_at = ? WHERE id = ?`, [nowIso(), cycleId]);
}

export async function getWeekEntry(
  cycleId: string,
  weekNumber: number
): Promise<WeekEntry | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    cycle_id: string;
    week_number: number;
    kr1_value: number | null;
    kr2_value: number | null;
    kr3_value: number | null;
    notes: string | null;
    completed: number;
  }>(
    `SELECT id, cycle_id, week_number, kr1_value, kr2_value, kr3_value, notes, completed
     FROM week_entry WHERE cycle_id = ? AND week_number = ?`,
    [cycleId, weekNumber]
  );
  if (!row) return null;
  return {
    id: row.id,
    cycleId: row.cycle_id,
    weekNumber: row.week_number,
    kr1Value: row.kr1_value,
    kr2Value: row.kr2_value,
    kr3Value: row.kr3_value,
    notes: row.notes,
    completed: row.completed === 1,
  };
}

export async function upsertWeekEntry(entry: {
  id: string;
  cycleId: string;
  weekNumber: number;
  kr1Value: number | null;
  kr2Value: number | null;
  kr3Value: number | null;
  notes: string | null;
  completed: boolean;
}): Promise<void> {
  const db = await getDatabase();
  const existing = await getWeekEntry(entry.cycleId, entry.weekNumber);
  if (existing) {
    await db.runAsync(
      `UPDATE week_entry SET kr1_value = ?, kr2_value = ?, kr3_value = ?, notes = ?, completed = ? WHERE id = ?`,
      [
        entry.kr1Value,
        entry.kr2Value,
        entry.kr3Value,
        entry.notes,
        entry.completed ? 1 : 0,
        existing.id,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO week_entry (id, cycle_id, week_number, kr1_value, kr2_value, kr3_value, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.cycleId,
        entry.weekNumber,
        entry.kr1Value,
        entry.kr2Value,
        entry.kr3Value,
        entry.notes,
        entry.completed ? 1 : 0,
      ]
    );
  }
  const krs = await getKeyResults(entry.cycleId);
  const sorted = [...krs].sort((a, b) => a.sortOrder - b.sortOrder);
  const v1 = entry.kr1Value ?? sorted[0]?.currentValue ?? 0;
  const v2 = entry.kr2Value ?? sorted[1]?.currentValue ?? 0;
  const v3 = entry.kr3Value ?? sorted[2]?.currentValue ?? 0;
  await updateKeyResultCurrentValues(entry.cycleId, [v1, v2, v3]);
}

export async function getChatMessages(cycleId: string): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    cycle_id: string;
    role: string;
    content: string;
    created_at: string;
  }>(
    `SELECT id, cycle_id, role, content, created_at FROM chat_message WHERE cycle_id = ? ORDER BY created_at ASC`,
    [cycleId]
  );
  return rows.map((row) => ({
    id: row.id,
    cycleId: row.cycle_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function insertChatMessage(msg: Omit<ChatMessage, 'createdAt'> & { createdAt?: string }): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO chat_message (id, cycle_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    [msg.id, msg.cycleId, msg.role, msg.content, msg.createdAt ?? nowIso()]
  );
}

export async function clearChatMessages(cycleId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM chat_message WHERE cycle_id = ?`, [cycleId]);
}
