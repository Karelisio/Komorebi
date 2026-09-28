/** Clé de jour locale (AAAA-MM-JJ). */
export function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);
}

export interface DailyGift {
  day: string;
  streak: number;
  petals: number;
}

/** Cadeau de retour quotidien : des pétales, un peu plus chaque jour de suite ; jamais de pénalité. */
export function dailyGift(
  last: { lastDay: string; streak: number },
  now: number,
): DailyGift | null {
  const today = dayKey(now);
  if (last.lastDay === today) return null;
  const gap = last.lastDay ? daysBetween(last.lastDay, today) : 1;
  const streak = gap === 1 ? last.streak + 1 : 1;
  return { day: today, streak, petals: 15 + 5 * Math.min(streak - 1, 6) };
}
