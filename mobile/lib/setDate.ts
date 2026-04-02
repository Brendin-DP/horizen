/** Stable “today” default for set log date (start of local calendar day → ISO). */
export function defaultSetLocalDateIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function localYmd(d: Date): { y: number; m: number; day: number } {
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
}

function compareLocalYmd(
  a: { y: number; m: number; day: number },
  b: { y: number; m: number; day: number }
): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.day - b.day;
}

/** Log date is a calendar day: allow “today” even when the stored instant is noon (before noon local). */
export function isValidPastOrPresentSetDate(iso: string): boolean {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  const now = new Date();
  return compareLocalYmd(localYmd(t), localYmd(now)) <= 0;
}
