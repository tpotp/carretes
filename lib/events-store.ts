import { Evento, EventoFormData, FiltrosEvento, Categoria } from './types';
import { supabase } from './supabase';
import {
  extractEventTime,
  extractPriceInfo,
  inferCity,
  normalizeText,
  toChileDateString,
} from './event-extraction';

const RSVPS_KEY = 'carretes_valpo_rsvps_v1';
const STORAGE_KEY = 'carretes_valpo_eventos_v3';
let memoryEvents: Evento[] = [];

function detectCategoryAndJoyita(title: string, desc: string, username: string, source: string) {
  const text = normalizeText(`${title} ${desc} ${username} ${source}`);

  const isJoyita =
    source === 'joyita_under' ||
    text.includes('spot secreto') ||
    text.includes('ubicacion por dm') ||
    text.includes('por interno') ||
    text.includes('aporte voluntario') ||
    text.includes('al sobre') ||
    text.includes('galpon') ||
    text.includes('casona') ||
    text.includes('post punk') ||
    text.includes('darkwave') ||
    text.includes('ebm') ||
    text.includes('industrial') ||
    text.includes('hard techno') ||
    text.includes('clandestin') ||
    text.includes('warhola') ||
    text.includes('autogest');

  let categoria: Categoria = 'under';
  if (
    text.includes('categoria: electronica') ||
    text.includes('techno') ||
    text.includes('rave') ||
    text.includes('house') ||
    text.includes('electronic') ||
    text.includes('djs') ||
    text.includes('live set') ||
    text.includes('acid')
  ) {
    categoria = 'electronica';
  } else if (
    text.includes('categoria: rock') ||
    text.includes('rock') ||
    text.includes('punk') ||
    text.includes('post-punk') ||
    text.includes('post punk') ||
    text.includes('metal') ||
    text.includes('tocata') ||
    text.includes('tributo') ||
    text.includes('banda') ||
    text.includes('en vivo')
  ) {
    categoria = 'rock';
  } else if (
    text.includes('categoria: cumbia') ||
    text.includes('cumbia') ||
    text.includes('salsa') ||
    text.includes('cueca') ||
    text.includes('pachanga')
  ) {
    categoria = 'cumbia';
  } else if (
    text.includes('categoria: reggaeton') ||
    text.includes('reggaeton') ||
    text.includes('perreo') ||
    text.includes('bellakeo') ||
    text.includes('urbano')
  ) {
    categoria = 'reggaeton';
  } else if (
    text.includes('categoria: universitario') ||
    text.includes('universitari') ||
    text.includes('mechoneo') ||
    text.includes('pucv') ||
    text.includes('uv ') ||
    text.includes('usm') ||
    text.includes('upla')
  ) {
    categoria = 'universitario';
  } else if (text.includes('categoria: otro')) {
    categoria = 'otro';
  } else if (isJoyita || text.includes('under') || text.includes('queer') || text.includes('drag')) {
    categoria = 'under';
  }

  const tags: string[] = [];
  if (source !== 'manual') tags.push('instagram');
  if (isJoyita) tags.push('💎 joyita oculta');
  if (categoria === 'electronica') tags.push('techno / rave');
  if (categoria === 'rock') tags.push('tocata');
  if (text.includes('aporte voluntario')) tags.push('aporte voluntario');

  return { categoria, isJoyita, tags };
}

function parseLocation(rawLocation: string) {
  const raw = rawLocation || 'Valparaíso';
  const parts = raw.split('·').map((part) => part.trim()).filter(Boolean);
  const city = inferCity(raw);
  return {
    lugar: parts[0] || raw,
    ciudad: city,
    sector: parts.length >= 3 ? parts[2] : null,
  };
}

export function dbRowToEvento(row: any): Evento {
  const description = String(row.description || '');
  const title = String(row.title || 'Evento sin nombre');
  const source = String(row.source || '');
  const username = String(row.username || '');
  const { categoria, isJoyita, tags } = detectCategoryAndJoyita(title, description, username, source);
  const priceInfo = extractPriceInfo(description);
  const location = parseLocation(String(row.location || 'Valparaíso'));
  const eventTime = extractEventTime(description);
  const isManual = source === 'manual';

  return {
    id: String(row.instagram_id || row.id),
    nombre: title,
    descripcion: description,
    fecha: String(row.date_text || toChileDateString(row.scraped_at || new Date())),
    hora: eventTime,
    lugar: location.lugar,
    ciudad: location.ciudad,
    sector: location.sector,
    precio: priceInfo.price,
    precio_conocido: priceInfo.known,
    precio_texto: priceInfo.text,
    categoria,
    imagen_url: row.image_url || null,
    fuente: isManual ? 'manual' : 'instagram',
    fuente_url: row.instagram_url || null,
    organizador: username ? (username.startsWith('@') ? username : `@${username}`) : null,
    organizador_url: !isManual && username
      ? `https://www.instagram.com/${username.replace('@', '')}/`
      : null,
    verificado: false,
    destacado: isJoyita,
    activo: row.is_active !== false,
    asistentes_interesados: 0,
    tags,
    created_at: row.scraped_at || new Date().toISOString(),
  };
}

export function getChileTodayStr(): string {
  return toChileDateString(new Date());
}

export function getStoredEvents(): Evento[] {
  if (typeof window === 'undefined') return memoryEvents;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (event) => event && /^20\d{2}-[01]\d-[0-3]\d$/.test(String(event.fecha || '')),
        );
        memoryEvents = clean;
        return clean;
      }
    }
  } catch {
    // Un localStorage corrupto no debe romper la cartelera.
  }
  return memoryEvents;
}

export function getEventById(id: string): Evento | undefined {
  return getStoredEvents().find((event) => event.id === id || event.fuente_url?.includes(id));
}

export async function fetchEventsFromSupabase(): Promise<Evento[]> {
  if (!supabase) return getStoredEvents();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('date_text', { ascending: true })
      .order('scraped_at', { ascending: false });

    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      return getStoredEvents();
    }

    if (!data || data.length === 0) return getStoredEvents();

    const mapped = data.map(dbRowToEvento);
    memoryEvents = mapped;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        window.dispatchEvent(new Event('carretes_storage_updated'));
      } catch {
        // La app sigue funcionando aunque el navegador bloquee almacenamiento.
      }
    }

    return mapped;
  } catch (error) {
    console.error('Error fetching events from Supabase:', error);
    return getStoredEvents();
  }
}

export function saveEvent(formData: EventoFormData): Evento {
  const id = `evt-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const numericPrice = typeof formData.precio === 'number' ? formData.precio : 0;

  const newEvent: Evento = {
    id,
    nombre: formData.nombre.trim(),
    descripcion: formData.descripcion.trim(),
    fecha: formData.fecha,
    hora: formData.hora || null,
    lugar: formData.lugar.trim(),
    ciudad: formData.ciudad || 'Valparaíso',
    sector: formData.sector?.trim() || null,
    precio: numericPrice,
    precio_conocido: true,
    precio_texto:
      formData.precio_texto?.trim() ||
      (numericPrice === 0 ? 'Entrada liberada' : `$${numericPrice.toLocaleString('es-CL')}`),
    categoria: formData.categoria,
    imagen_url: formData.imagen_url?.trim() || null,
    fuente: 'manual',
    fuente_url: formData.fuente_url?.trim() || null,
    organizador: formData.organizador.trim().startsWith('@')
      ? formData.organizador.trim()
      : `@${formData.organizador.trim()}`,
    organizador_url: formData.organizador_url || null,
    verificado: false,
    destacado: false,
    activo: true,
    asistentes_interesados: 0,
    tags: formData.tags
      ? formData.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)
      : ['carrete', formData.categoria],
    created_at: new Date().toISOString(),
  };

  memoryEvents.unshift(newEvent);

  if (typeof window !== 'undefined') {
    try {
      const current = getStoredEvents().filter((event) => event.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newEvent, ...current]));
      window.dispatchEvent(new Event('carretes_storage_updated'));
    } catch {
      // La publicación server-side se intenta igualmente.
    }

    void fetch('/api/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, client_id: id }),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.error('Error publishing event:', payload?.error || response.statusText);
      }
    }).catch((error) => console.error('Error publishing event:', error));
  }

  return newEvent;
}

export function toggleRsvp(eventId: string): { interested: boolean; count: number } {
  if (typeof window === 'undefined') return { interested: false, count: 0 };

  try {
    const rawRsvps = localStorage.getItem(RSVPS_KEY);
    const rsvps: string[] = rawRsvps ? JSON.parse(rawRsvps) : [];
    const isAlready = rsvps.includes(eventId);
    const next = isAlready ? rsvps.filter((id) => id !== eventId) : [...rsvps, eventId];
    localStorage.setItem(RSVPS_KEY, JSON.stringify(next));
    return { interested: !isAlready, count: isAlready ? 0 : 1 };
  } catch {
    return { interested: false, count: 0 };
  }
}

export function getUserRsvps(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RSVPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function filterEvents(events: Evento[], filters: FiltrosEvento): Evento[] {
  const todayStr = getChileTodayStr();

  const filtered = events.filter((event) => {
    if (!event.activo || !/^20\d{2}-[01]\d-[0-3]\d$/.test(event.fecha || '')) return false;

    if (filters.busqueda?.trim()) {
      const query = normalizeText(filters.busqueda.trim());
      const searchable = normalizeText(
        `${event.nombre} ${event.descripcion || ''} ${event.lugar || ''} ${event.organizador || ''} ${event.ciudad} ${(event.tags || []).join(' ')}`,
      );
      if (!searchable.includes(query)) return false;
    }

    if (filters.categoria && filters.categoria !== 'todos' && event.categoria !== filters.categoria) {
      return false;
    }

    if (
      filters.ciudad &&
      filters.ciudad !== 'todos' &&
      normalizeText(event.ciudad) !== normalizeText(filters.ciudad)
    ) {
      return false;
    }

    if (filters.precio && filters.precio !== 'todos') {
      if (event.precio_conocido === false) return false;
      if (filters.precio === 'gratis' && event.precio !== 0) return false;
      if (filters.precio === 'pago' && event.precio <= 0) return false;
    }

    if (filters.fecha && filters.fecha !== 'todos') {
      if (filters.fecha === 'hoy' && event.fecha !== todayStr) return false;
      if (filters.fecha === 'futuro' && event.fecha < todayStr) return false;

      if (filters.fecha === 'semana') {
        const [year, month, day] = todayStr.split('-').map(Number);
        const end = new Date(Date.UTC(year, month - 1, day + 7, 12)).toISOString().slice(0, 10);
        if (event.fecha < todayStr || event.fecha > end) return false;
      }

      if (filters.fecha === 'finde') {
        const [year, month, day] = todayStr.split('-').map(Number);
        const current = new Date(Date.UTC(year, month - 1, day, 12));
        const dow = current.getUTCDay();
        const daysUntilFriday = dow <= 5 ? 5 - dow : dow === 6 ? -1 : -2;
        const friday = new Date(current);
        friday.setUTCDate(current.getUTCDate() + daysUntilFriday);
        const sunday = new Date(friday);
        sunday.setUTCDate(friday.getUTCDate() + 2);
        const fridayStr = friday.toISOString().slice(0, 10);
        const sundayStr = sunday.toISOString().slice(0, 10);
        if (event.fecha < fridayStr || event.fecha > sundayStr) return false;
      }
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const aFuture = a.fecha >= todayStr;
    const bFuture = b.fecha >= todayStr;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return aFuture ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha);
  });
}
