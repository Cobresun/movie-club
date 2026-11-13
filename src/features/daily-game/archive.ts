import { type DailyGameConfig } from "@/common/clubType";

export const archivePath = (game: DailyGameConfig) => `${game.path}/archive`;

export const puzzlePath = (game: DailyGameConfig, date: string) => `${game.path}/${date}`;

export interface CalendarDay<T> {
  date: string;
  day: number;
  entry: T | undefined;
}

export interface CalendarMonth<T> {
  key: string;
  label: string;
  /** Blank cells before the 1st, so it lands under its weekday (Sunday first). */
  leadingBlanks: number;
  days: CalendarDay<T>[];
}

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Lays `YYYY-MM-DD` entries out as calendar months, newest month first. */
export function calendarMonths<T extends { date: string }>(
  entries: readonly T[],
): CalendarMonth<T>[] {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const monthKeys = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].toSorted((a, b) =>
    b.localeCompare(a),
  );

  return monthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = Array.from({ length }, (_, index) => {
      const date = `${key}-${String(index + 1).padStart(2, "0")}`;
      return { date, day: index + 1, entry: byDate.get(date) };
    });
    return { key, label: monthFormat.format(first), leadingBlanks: first.getUTCDay(), days };
  });
}
