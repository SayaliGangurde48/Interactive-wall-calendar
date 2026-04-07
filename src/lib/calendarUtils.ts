import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";

export { format, isSameDay, isToday, isSameMonth, addMonths, subMonths };

export function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function isInRange(
  date: Date,
  start: Date | null,
  end: Date | null
): boolean {
  if (!start || !end) return false;
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  return isWithinInterval(date, { start: s, end: e });
}

export function isRangeStart(
  date: Date,
  start: Date | null,
  end: Date | null
): boolean {
  if (!start) return false;
  if (!end || isSameDay(start, end)) return isSameDay(date, start);
  return isSameDay(date, start <= end ? start : end);
}

export function isRangeEnd(
  date: Date,
  start: Date | null,
  end: Date | null
): boolean {
  if (!start || !end || isSameDay(start, end)) return false;
  return isSameDay(date, start <= end ? end : start);
}

export function isRangeSingle(start: Date | null, end: Date | null): boolean {
  return !!start && !!end && isSameDay(start, end);
}

export const MONTH_IMAGES: Record<
  number,
  { url: string; alt: string; theme: string }
> = {
  0:  { url: "https://picsum.photos/seed/jan-winter/800/600",   alt: "January",   theme: "Winter Serenity"   },
  1:  { url: "https://picsum.photos/seed/feb-snow/800/600",     alt: "February",  theme: "Quiet February"    },
  2:  { url: "https://picsum.photos/seed/march-spring/800/600", alt: "March",     theme: "Spring Awakening"  },
  3:  { url: "https://picsum.photos/seed/april-bloom/800/600",  alt: "April",     theme: "April in Bloom"    },
  4:  { url: "https://picsum.photos/seed/may-green/800/600",    alt: "May",       theme: "May Days"          },
  5:  { url: "https://picsum.photos/seed/june-beach/800/600",   alt: "June",      theme: "June Horizon"      },
  6:  { url: "https://picsum.photos/seed/july-summer/800/600",  alt: "July",      theme: "Full Summer"       },
  7:  { url: "https://picsum.photos/seed/aug-forest/800/600",   alt: "August",    theme: "Late Summer"       },
  8:  { url: "https://picsum.photos/seed/sep-autumn/800/600",   alt: "September", theme: "Golden September"  },
  9:  { url: "https://picsum.photos/seed/oct-leaves/800/600",   alt: "October",   theme: "October Colors"    },
  10: { url: "https://picsum.photos/seed/nov-mist/800/600",     alt: "November",  theme: "November Mist"     },
  11: { url: "https://picsum.photos/seed/dec-snow/800/600",     alt: "December",  theme: "December Magic"    },
};

export const HOLIDAYS: Record<string, string> = {
  "01-01": "New Year's Day",
  "01-15": "MLK Jr. Day",
  "02-14": "Valentine's Day",
  "02-17": "Presidents' Day",
  "03-17": "St. Patrick's Day",
  "04-20": "Easter",
  "05-26": "Memorial Day",
  "06-19": "Juneteenth",
  "07-04": "Independence Day",
  "09-01": "Labor Day",
  "10-31": "Halloween",
  "11-11": "Veterans Day",
  "11-27": "Thanksgiving",
  "12-25": "Christmas",
  "12-31": "New Year's Eve",
};

export function getHoliday(date: Date): string | null {
  return HOLIDAYS[format(date, "MM-dd")] || null;
}
