/** Zona horaria oficial de NutriData: Colombia (America/Bogota, UTC-5). */
export const COLOMBIA_TZ = "America/Bogota";
export const COLOMBIA_LOCALE = "es-CO";

/** Convierte un Date instantáneo a YYYY-MM-DD en zona Colombia. */
export function toColombiaDateISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** YYYY-MM-DD de "hoy" en Colombia (no depende del UTC del navegador). */
export function todayInColombiaISO(): string {
  return toColombiaDateISO(new Date());
}

/**
 * Suma días a una fecha calendario YYYY-MM-DD (o a hoy en Colombia).
 * Usa aritmética de calendario, sin desalinear por huso horario.
 */
export function addDaysColombiaISO(days: number, fromISO?: string): string {
  const iso = fromISO ?? todayInColombiaISO();
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Partes de fecha/hora actuales en Colombia. */
export function getColombiaParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
    weekday: get("weekday"),
  };
}

/** Date "local Colombia" construida a partir de partes (útil para getDay). */
export function nowInColombiaAsLocalDate(date: Date = new Date()): Date {
  const p = getColombiaParts(date);
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
}

/** Índice de día 0=domingo … 6=sábado según Colombia. */
export function getColombiaDayOfWeek(date: Date = new Date()): number {
  return nowInColombiaAsLocalDate(date).getDay();
}

/** Interpreta valores de fecha evitando el desfase de strings YYYY-MM-DD en UTC. */
function toDisplayDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // Fecha calendario pura → mediodía COT (17:00 UTC) para no cambiar de día
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  }

  // Fecha con espacio "YYYY-MM-DD HH:mm:ss" (timestamp local Colombia del backend)
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (m) {
    return new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}-05:00`);
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatInColombia(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  if (value == null || value === "") return "";
  const d = toDisplayDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString(COLOMBIA_LOCALE, {
    timeZone: COLOMBIA_TZ,
    ...options,
  });
}

export function formatDateTimeInColombia(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  if (value == null || value === "") return "";
  const d = toDisplayDate(value);
  if (!d) return String(value);
  return d.toLocaleString(COLOMBIA_LOCALE, {
    timeZone: COLOMBIA_TZ,
    ...options,
  });
}

/** Etiqueta larga de hoy en español (Colombia). */
export function todayLabelColombia(): string {
  return formatInColombia(new Date(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
