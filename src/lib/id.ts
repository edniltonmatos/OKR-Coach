export function createId(prefix?: string): string {
  const base = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
  return prefix ? `${prefix}_${base}` : base;
}
