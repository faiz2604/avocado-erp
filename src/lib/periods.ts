import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subMonths
} from "date-fns";

export type PeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "ytd"
  | "custom";

export function resolvePeriod(key: PeriodKey, custom?: { from: string; to: string }) {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": {
      const lw = subDays(now, 7);
      return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "this_quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "this_year":
    case "ytd":
      return { from: startOfYear(now), to: key === "ytd" ? endOfDay(now) : endOfYear(now) };
    case "custom":
      if (!custom) throw new Error("custom period requires from/to");
      return { from: startOfDay(new Date(custom.from)), to: endOfDay(new Date(custom.to)) };
  }
}

export function isoRange(key: PeriodKey, custom?: { from: string; to: string }) {
  const { from, to } = resolvePeriod(key, custom);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}
