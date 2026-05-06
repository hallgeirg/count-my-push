import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function resolveTimeZone(tz: string | undefined): string {
  if (!tz || typeof tz !== "string") return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
    return tz;
  } catch {
    return "UTC";
  }
}

export type PeriodBounds = {
  dayStart: Date;
  dayEndExclusive: Date;
  weekStart: Date;
  weekEndExclusive: Date;
  monthStart: Date;
  monthEndExclusive: Date;
};

export function getPeriodBounds(
  timeZone: string,
  now = new Date(),
): PeriodBounds {
  const zoned = toZonedTime(now, timeZone);
  const dayStartZ = startOfDay(zoned);
  const dayStart = fromZonedTime(dayStartZ, timeZone);
  const dayEndExclusive = fromZonedTime(addDays(dayStartZ, 1), timeZone);

  const weekStartZ = startOfWeek(zoned, { weekStartsOn: 1 });
  const weekStart = fromZonedTime(weekStartZ, timeZone);
  const weekEndExclusive = fromZonedTime(addDays(weekStartZ, 7), timeZone);

  const monthStartZ = startOfMonth(zoned);
  const monthStart = fromZonedTime(monthStartZ, timeZone);
  const monthEndExclusive = fromZonedTime(addMonths(monthStartZ, 1), timeZone);

  return {
    dayStart,
    dayEndExclusive,
    weekStart,
    weekEndExclusive,
    monthStart,
    monthEndExclusive,
  };
}
