const DEFAULT_TIMEZONE = "Europe/Amsterdam"

type UserRecord = Record<string, any> | null

const TIMEZONE_STORAGE_KEY = "user_timezone"

const TIMEZONE_SEARCH_PATHS = [
  ["timezone"],
  ["timeZone"],
  ["tz"],
  ["profile", "timezone"],
  ["profile", "timeZone"],
  ["profile", "tz"],
  ["settings", "timezone"],
  ["settings", "timeZone"],
  ["preferences", "timezone"],
  ["preferences", "timeZone"],
  ["company", "timezone"],
  ["company", "timeZone"],
  ["company", "tz"],
]

let cachedTimezone: string | null = null

function readStoredUser(): UserRecord {
  if (typeof window === "undefined") {
    return null
  }

  const raw = localStorage.getItem("user")
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeTimezone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readStoredTimezone(): string | null {
  if (typeof window === "undefined") {
    return null
  }
  const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
  return normalizeTimezone(stored)
}

function walkForTimezone(value: UserRecord): string | null {
  if (!value || typeof value !== "object") {
    return null
  }

  for (const parts of TIMEZONE_SEARCH_PATHS) {
    let current: any = value
    for (const key of parts) {
      current = current?.[key]
      if (current == null) break
    }
    const normalized = normalizeTimezone(current)
    if (normalized) {
      return normalized
    }
  }

  return null
}

export function resolveTimezoneFromRecord(record: UserRecord): string | null {
  return walkForTimezone(record)
}

export function setUserTimezone(timezone: string | null | undefined) {
  const normalized = normalizeTimezone(timezone)
  if (typeof window !== "undefined") {
    if (normalized) {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, normalized)
    } else {
      localStorage.removeItem(TIMEZONE_STORAGE_KEY)
    }
  }
  cachedTimezone = normalized
}

export function getUserTimezone(): string {
  if (cachedTimezone) {
    return cachedTimezone
  }

  let timezone = null

  if (typeof window !== "undefined") {
    timezone = readStoredTimezone()
  }

  if (!timezone && typeof window !== "undefined") {
    const storedUser = readStoredUser()
    timezone = walkForTimezone(storedUser)
  }

  if (!timezone) {
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      timezone = null
    }
  }

  cachedTimezone = timezone ?? DEFAULT_TIMEZONE
  return cachedTimezone
}

const ISO_WITHOUT_TZ =
  /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)?$/

function parseDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) {
    return null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  let normalized: string | number = value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (ISO_WITHOUT_TZ.test(trimmed) && !trimmed.endsWith("Z")) {
      const [datePart, timePart] = trimmed.split(/[ T]/)
      const normalizedTime = timePart ? timePart : "00:00:00"
      normalized = `${datePart}T${normalizedTime}`
    } else if (trimmed.includes(" ") && !trimmed.includes("T")) {
      normalized = trimmed.replace(" ", "T")
    } else {
      normalized = trimmed
    }
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatWithTimezone(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = "nl-NL",
): string {
  const date = parseDate(value)
  if (!date) {
    return ""
  }

  const timezone = getUserTimezone()
  const formatter = new Intl.DateTimeFormat(locale, {...options, timeZone: timezone})
  return formatter.format(date)
}

export function formatUserDate(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = "nl-NL",
) {
  return formatWithTimezone(value, options, locale)
}

export function formatUserTime(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = "nl-NL",
) {
  return formatWithTimezone(value, options, locale)
}

export function formatUserDateTime(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = "nl-NL",
) {
  return formatWithTimezone(value, options, locale)
}

type DatePart = "year" | "month" | "day" | "hour" | "minute" | "second"

function getDateParts(
  date: Date,
  timeZone: string,
  parts: DatePart[],
): Record<DatePart, number> | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const resolved: Record<string, number> = {}
  const formattedParts = formatter.formatToParts(date)
  for (const part of formattedParts) {
    if (parts.includes(part.type as DatePart)) {
      resolved[part.type] = Number(part.value)
    }
  }

  const result: Record<DatePart, number> = {} as Record<DatePart, number>
  for (const part of parts) {
    const value = resolved[part]
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null
    }
    result[part] = value
  }

  return result
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getDateParts(date, timeZone, ["year", "month", "day", "hour", "minute", "second"])
  if (!parts) {
    return 0
  }

  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - date.getTime()
}

export function getDateInTimezone(baseDate: Date, timeZone?: string): Date | null {
  const zone = timeZone ?? getUserTimezone()
  const parts = getDateParts(baseDate, zone, ["year", "month", "day", "hour", "minute", "second"])
  if (!parts) {
    return null
  }

  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  )
}

export function getStartOfDayInTimezone(baseDate = new Date(), timeZone?: string): Date {
  const zone = timeZone ?? getUserTimezone()
  const parts = getDateParts(baseDate, zone, ["year", "month", "day"])
  if (!parts) {
    return new Date(baseDate.getTime())
  }

  const utcMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const offsetMs = getTimezoneOffsetMs(utcMidnight, zone)
  return new Date(utcMidnight.getTime() - offsetMs)
}

export function getUserDateKey(
  value: Date | string | number | null | undefined,
  timeZone?: string,
): string | null {
  const date = parseDate(value)
  if (!date) {
    return null
  }

  const zone = timeZone ?? getUserTimezone()
  const parts = getDateParts(date, zone, ["year", "month", "day"])
  if (!parts) {
    return null
  }

  const month = String(parts.month).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  return `${parts.year}-${month}-${day}`
}

export function getUserTimeParts(
  value: Date | string | number | null | undefined,
  timeZone?: string,
): { hour: number; minute: number; second: number } | null {
  const date = parseDate(value)
  if (!date) {
    return null
  }
  const zone = timeZone ?? getUserTimezone()
  const parts = getDateParts(date, zone, ["hour", "minute", "second"])
  if (!parts) {
    return null
  }
  return {
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

export function toUtcISOString(
  date: string,
  time: string,
  timeZone?: string,
): string | null {
  const [year, month, day] = date.split("-").map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }

  const [hour, minute = 0, second = 0] = time.split(":").map((part) => Number(part))
  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) {
    return null
  }

  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const zone = timeZone ?? getUserTimezone()
  const offsetMs = getTimezoneOffsetMs(new Date(baseUtc), zone)
  const utcDate = new Date(baseUtc - offsetMs)
  return Number.isNaN(utcDate.getTime()) ? null : utcDate.toISOString()
}
