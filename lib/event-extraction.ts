const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export interface PriceInfo {
  price: number;
  known: boolean;
  text: string | null;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseInputDate(value?: string | number | null): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (/^\d{10,13}$/.test(value.trim()) && Number.isFinite(numeric)) {
      return parseInputDate(numeric);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
}

export function toChileDateString(value?: string | number | Date | null): string {
  const date = value instanceof Date ? value : parseInputDate(value as string | number | null | undefined);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDaysToIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveYearlessDate(day: number, month: number, baseIso: string): string | null {
  const [baseYear] = baseIso.split('-').map(Number);
  let candidate = isoDate(baseYear, month, day);
  if (!candidate) return null;

  // Si la fecha ya pasó claramente respecto de la publicación, asumir el año siguiente.
  const staleCutoff = addDaysToIso(baseIso, -30);
  if (candidate < staleCutoff) {
    candidate = isoDate(baseYear + 1, month, day);
  }
  return candidate;
}

function resolveDayOnly(day: number, baseIso: string): string | null {
  const [year, month] = baseIso.split('-').map(Number);
  const sameMonth = isoDate(year, month, day);
  if (sameMonth && sameMonth >= addDaysToIso(baseIso, -2)) return sameMonth;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return isoDate(nextYear, nextMonth, day);
}

function nextWeekday(baseIso: string, targetWeekday: number): string {
  const [year, month, day] = baseIso.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12));
  const current = base.getUTCDay();
  let delta = (targetWeekday - current + 7) % 7;
  // "viernes" publicado un viernes normalmente significa hoy, no dentro de una semana.
  if (delta === 0) delta = 0;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

export function extractEventDate(caption: string, publishedAt?: string | number | null): string | null {
  const text = normalizeText(caption);
  const baseIso = toChileDateString(publishedAt);

  // 12/09, 12-09, 12.09 y año opcional.
  const numeric = text.match(/(?:^|\s)([0-3]?\d)[\/.\-]([01]?\d)(?:[\/.\-](20\d{2}|\d{2}))?(?=\s|$|[,;])/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : Number(baseIso.slice(0, 4));
    if (year < 100) year += 2000;
    const explicit = isoDate(year, month, day);
    if (explicit) return explicit;
  }

  const monthNames = Object.keys(MONTHS).join('|');
  const spanish = text.match(new RegExp(`(?:^|\\s)([0-3]?\\d)(?:\\s+de)?\\s+(${monthNames})(?:\\s+(?:de\\s+)?(20\\d{2}))?`, 'i'));
  if (spanish) {
    const day = Number(spanish[1]);
    const month = MONTHS[spanish[2]];
    const explicitYear = spanish[3] ? Number(spanish[3]) : null;
    return explicitYear ? isoDate(explicitYear, month, day) : resolveYearlessDate(day, month, baseIso);
  }

  if (/\bmanana\b/.test(text)) return addDaysToIso(baseIso, 1);
  if (/\b(hoy|esta noche)\b/.test(text)) return baseIso;

  const weekdayNames = Object.keys(WEEKDAYS).join('|');
  const weekdayWithDay = text.match(new RegExp(`\\b(${weekdayNames})\\s+([0-3]?\\d)(?:\\s+(?:de\\s+)?(${monthNames}))?`, 'i'));
  if (weekdayWithDay) {
    const day = Number(weekdayWithDay[2]);
    if (weekdayWithDay[3]) {
      return resolveYearlessDate(day, MONTHS[weekdayWithDay[3]], baseIso);
    }
    return resolveDayOnly(day, baseIso);
  }

  const weekdayOnly = text.match(new RegExp(`\\b(?:este\\s+)?(${weekdayNames})\\b`, 'i'));
  if (weekdayOnly) return nextWeekday(baseIso, WEEKDAYS[weekdayOnly[1]]);

  return null;
}

export function extractEventTime(textValue: string): string | null {
  const text = normalizeText(textValue);

  const colon = text.match(/\b(?:desde\s+|a\s+las\s+|inicio\s+|puertas\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:h|hrs?|horas)?\b/);
  if (colon) return `${String(Number(colon[1])).padStart(2, '0')}:${colon[2]}`;

  const hours = text.match(/\b(?:desde\s+|a\s+las\s+|inicio\s+|puertas\s+)([01]?\d|2[0-3])\s*(?:h|hrs?|horas)\b/);
  if (hours) return `${String(Number(hours[1])).padStart(2, '0')}:00`;

  return null;
}

export function extractPriceInfo(textValue: string): PriceInfo {
  const text = normalizeText(textValue);

  if (/\b(gratis|gratuito|entrada liberada|liberada hasta|free)\b/.test(text)) {
    return { price: 0, known: true, text: 'Entrada liberada / gratis' };
  }

  const candidates: number[] = [];
  const currencyRegex = /\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]{4,6})/g;
  let match: RegExpExecArray | null;
  while ((match = currencyRegex.exec(text)) !== null) {
    const amount = Number(match[1].replace(/[.\s]/g, ''));
    if (amount >= 500 && amount <= 500_000) candidates.push(amount);
  }

  if (candidates.length > 0) {
    const price = Math.min(...candidates);
    return {
      price,
      known: true,
      text: `Desde $${price.toLocaleString('es-CL')}`,
    };
  }

  if (/\b(aporte voluntario|al sobre)\b/.test(text)) {
    return { price: 0, known: false, text: 'Aporte voluntario' };
  }

  return { price: 0, known: false, text: 'Precio por confirmar' };
}

export function inferCity(locationValue: string): string {
  const text = normalizeText(locationValue || '');
  if (text.includes('vina del mar') || text.includes('vina')) return 'Viña del Mar';
  if (text.includes('renaca')) return 'Reñaca';
  if (text.includes('quilpue')) return 'Quilpué';
  if (text.includes('villa alemana')) return 'Villa Alemana';
  if (text.includes('concon')) return 'Concón';
  return 'Valparaíso';
}

export function isLikelyEventPost(caption: string, eventDate: string | null): boolean {
  if (!eventDate) return false;
  const text = normalizeText(caption);

  const positiveSignals = [
    'fiesta', 'carrete', 'evento', 'rave', 'tocata', 'show', 'en vivo', 'live', 'dj',
    'lineup', 'prevent', 'entrada', 'puertas', 'club', 'after', 'sesion', 'sesión',
    'fecha', 'viernes', 'sabado', 'domingo', 'hoy', 'manana', 'esta noche', 'tributo',
    'concierto', 'festival', 'party', 'b2b', 'techno', 'cumbia', 'reggaeton', 'perreo',
  ];

  return positiveSignals.some((signal) => text.includes(normalizeText(signal)));
}

export function firstMeaningfulLine(caption: string, fallback: string): string {
  const line = caption
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length >= 4 && !/^#/.test(part));
  return (line || fallback).replace(/\s+/g, ' ').slice(0, 130);
}
