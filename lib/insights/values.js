// Parsing of individual CSV cells: counts and dates.

// Values that mean "no data". These stay empty; they are never turned into 0.
const MISSING = new Set(["", "-", "–", "—", "n/a", "na", "null", "none", "--", "unknown"]);

export const isMissingValue = (raw) => MISSING.has(String(raw ?? "").trim().toLowerCase());

// Whole, non-negative counts. Accepts thousands separators ("12,345",
// "12 345", "1.234.567"). Returns { value } or { error: true }.
export const parseCount = (raw) => {
  const text = String(raw ?? "").trim();
  if (MISSING.has(text.toLowerCase())) {
    return { value: null };
  }

  let cleaned = text.replace(/[\s  ']/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3}){2,}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }

  if (!/^\d+(\.0+)?$/.test(cleaned)) {
    return { error: true };
  }

  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) {
    return { error: true };
  }
  return { value };
};

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const monthFromName = (name) => MONTHS[name.slice(0, 3).toLowerCase()] ?? null;

const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

// Decide whether d/m/y-style dates in a column are day-first or month-first,
// using every value: a first number above 12 means day-first, and so on.
// Returns "iso" (no such dates), "dmy", "mdy", "ambiguous" or "mixed".
export const detectDateOrder = (values) => {
  let sawSlashDate = false;
  let dayFirst = false;
  let monthFirst = false;

  for (const raw of values) {
    const match = SLASH_DATE.exec(String(raw ?? "").trim());
    if (!match) {
      continue;
    }
    sawSlashDate = true;
    if (Number(match[1]) > 12) dayFirst = true;
    if (Number(match[2]) > 12) monthFirst = true;
  }

  if (!sawSlashDate) return "iso";
  if (dayFirst && monthFirst) return "mixed";
  if (dayFirst) return "dmy";
  if (monthFirst) return "mdy";
  return "ambiguous";
};

const pad = (number) => String(number).padStart(2, "0");

const validDate = (year, month, day) => {
  if (year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

// Returns { value: "YYYY-MM-DD" | null, hadTime, precision }. Supports ISO
// dates (with an optional time), d/m/y or m/d/y (given the column's order),
// "1 Oct 2026" and "Oct 1, 2026". With allowPartial, a year ("2023") or
// year-month ("2023-05") is accepted and stored as its first day, with
// precision "year" or "month" so it's never shown as an exact date.
export const parseDateValue = (raw, order = "iso", { allowPartial = false } = {}) => {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { value: null, hadTime: false };
  }

  if (allowPartial) {
    const yearOnly = /^(\d{4})$/.exec(text);
    if (yearOnly) {
      return { value: validDate(Number(yearOnly[1]), 1, 1), hadTime: false, precision: "year" };
    }
    const yearMonth = /^(\d{4})[-/.](\d{1,2})$/.exec(text);
    if (yearMonth && Number(yearMonth[2]) >= 1 && Number(yearMonth[2]) <= 12) {
      return { value: validDate(Number(yearMonth[1]), Number(yearMonth[2]), 1), hadTime: false, precision: "month" };
    }
  }

  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (match) {
    const hadTime = match[4] !== undefined && !(Number(match[4]) === 0 && Number(match[5]) === 0);
    return { value: validDate(Number(match[1]), Number(match[2]), Number(match[3])), hadTime, precision: "day" };
  }

  match = SLASH_DATE.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    if (order === "dmy") return { value: validDate(year, second, first), hadTime: false, precision: "day" };
    if (order === "mdy") return { value: validDate(year, first, second), hadTime: false, precision: "day" };
    return { value: null, hadTime: false };
  }

  match = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(\d{4})$/i.exec(text);
  if (match) {
    const month = monthFromName(match[2]);
    return { value: month ? validDate(Number(match[3]), month, Number(match[1])) : null, hadTime: false, precision: "day" };
  }

  match = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(text);
  if (match) {
    const month = monthFromName(match[1]);
    return { value: month ? validDate(Number(match[3]), month, Number(match[2])) : null, hadTime: false, precision: "day" };
  }

  return { value: null, hadTime: false };
};
