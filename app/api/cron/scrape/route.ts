import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  extractEventDate,
  firstMeaningfulLine,
  isLikelyEventPost,
  normalizeText,
  toChileDateString,
} from '../../../../lib/event-extraction';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR || 'apify~instagram-scraper';
const APIFY_RESULTS_LIMIT = Math.max(1, Math.min(12, Number(process.env.APIFY_RESULTS_LIMIT || 5)));
const APIFY_NEWER_THAN = process.env.APIFY_NEWER_THAN || '3 days';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// MVP scope: nightlife / music / parties only. Keep the source boundary explicit.
const VENUE_INFO: Record<string, { name: string; location: string; tier: string }> = {
  'el.huevo': { name: 'El Huevo Valparaíso', location: 'Valparaíso (Blanco 1386)', tier: 'mainstream' },
  'barelhuevo': { name: 'El Huevo Bar', location: 'Valparaíso (Blanco 1386)', tier: 'mainstream' },
  'trotamundosvalpo': { name: 'Trotamundos Terraza', location: 'Valparaíso', tier: 'mainstream' },
  'clubtrotaquilpue': { name: 'Trotamundos Quilpué', location: 'Quilpué', tier: 'mainstream' },
  'terraza_bellavista_valpo': { name: 'Terraza Bellavista', location: 'Valparaíso (Blanco 1285)', tier: 'mainstream' },
  'club_segundo_piso': { name: 'Club Segundo Piso', location: 'Valparaíso (Av. Brasil 1395)', tier: 'under' },
  'mascara_valparaiso': { name: 'Máscara Valparaíso', location: 'Valparaíso (Plaza Aníbal Pinto)', tier: 'under' },
  'paganocl': { name: 'Pagano Club Lounge', location: 'Valparaíso (Errázuriz 396)', tier: 'under' },
  'espaciowarhola': { name: 'Espacio Warhola', location: 'Valparaíso (Esmeralda)', tier: 'under' },
  'sala_rivoli': { name: 'Sala Rívoli', location: 'Valparaíso (Condell)', tier: 'under' },
  'canchavalpo': { name: 'Cancha Valparaíso', location: 'Valparaíso', tier: 'under' },
  'barcivico': { name: 'Bar Cívico', location: 'Valparaíso (Blanco)', tier: 'under' },
  'barlaplaya': { name: 'Bar La Playa', location: 'Valparaíso (Serrano)', tier: 'under' },
  'valparaiso_techno': { name: 'Valparaíso Techno', location: 'Valparaíso', tier: 'joyita' },
  'baptism_producciones': { name: 'Baptism Producciones', location: 'Valparaíso', tier: 'joyita' },
  'distorsionsonora': { name: 'Distorsión Sonora', location: 'Valparaíso', tier: 'joyita' },
  'ritoquefm': { name: 'Ritoque FM', location: 'Valparaíso', tier: 'mainstream' },
};

type JsonRecord = Record<string, unknown>;

interface ApifyRun {
  id: string;
  defaultDatasetId: string;
}

interface EventRow {
  instagram_id: string;
  title: string;
  description: string;
  date_text: string;
  location: string;
  image_url: string | null;
  instagram_url: string;
  username: string;
  likes: number;
  scraped_at: string;
  source: string;
  is_active: boolean;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function field(record: JsonRecord | null, key: string): unknown {
  return record?.[key];
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

async function apifyRequest(path: string, init?: RequestInit): Promise<unknown> {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN no configurado');

  const response = await fetch(`https://api.apify.com/v2/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${APIFY_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Apify ${response.status}: ${detail || response.statusText}`);
  }

  return response.json();
}

async function runApify(urls: string[]): Promise<JsonRecord[]> {
  const started = asRecord(await apifyRequest(`acts/${APIFY_ACTOR}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit: APIFY_RESULTS_LIMIT,
      onlyPostsNewerThan: APIFY_NEWER_THAN,
      addParentData: true,
    }),
  }));

  const runData = asRecord(field(started, 'data'));
  const run: ApifyRun | null =
    typeof runData?.id === 'string' && typeof runData?.defaultDatasetId === 'string'
      ? { id: runData.id, defaultDatasetId: runData.defaultDatasetId }
      : null;

  if (!run) throw new Error('Apify no devolvió run/dataset válidos');

  let completed = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const statusPayload = asRecord(await apifyRequest(`actor-runs/${run.id}`));
    const statusData = asRecord(field(statusPayload, 'data'));
    const statusValue = field(statusData, 'status');
    const status = typeof statusValue === 'string' ? statusValue : undefined;

    if (status === 'SUCCEEDED') {
      completed = true;
      break;
    }
    if (status && ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify terminó con estado ${status}`);
    }
  }

  if (!completed) throw new Error('Apify excedió el tiempo de espera del cron');

  const items = await apifyRequest(`datasets/${run.defaultDatasetId}/items?format=json&clean=true`);
  if (!Array.isArray(items)) return [];
  return items.map(asRecord).filter((item): item is JsonRecord => item !== null);
}

function getUsername(item: JsonRecord): string {
  const owner = asRecord(item.owner);
  const parentData = asRecord(item.parentData);
  const value =
    firstValue(item, ['ownerUsername', 'username']) ||
    field(owner, 'username') ||
    field(parentData, 'username') ||
    '';

  return String(value).toLowerCase().replace(/^@/, '');
}

function getPublishedAt(item: JsonRecord): string | number | null {
  const value = firstValue(item, ['timestamp', 'takenAt', 'takenAtIso', 'publishedAt']);
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isNightlifeFocused(caption: string): boolean {
  const text = normalizeText(caption);
  const signals = [
    'fiesta', 'carrete', 'rave', 'tocata', 'concierto', 'festival', 'fonda',
    'techno', 'cumbia', 'reggaeton', 'perreo', 'party', 'after', 'b2b', 'dj ',
    ' dj', 'lineup', 'preventa', 'preventas', 'entrada', 'tickets', 'ticket',
    'puertas', 'tributo', 'en vivo', 'club ', 'discoteca', 'pista',
  ];
  return signals.some((signal) => text.includes(signal));
}

function isGenericPromoTitle(title: string): boolean {
  const text = normalizeText(title).replace(/\s+/g, ' ').trim();
  return /\b(artista confirmado|artista confirmada|lineup confirmado|line up confirmado|invitado confirmado|invitada confirmada)\b/.test(text);
}

function normalizedTitle(title: string): string {
  return normalizeText(title)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateEventRows(rows: EventRow[]): EventRow[] {
  const byInstagramId = Array.from(new Map(rows.map((row) => [row.instagram_id, row])).values());
  const groups = new Map<string, EventRow[]>();

  for (const row of byInstagramId) {
    const key = `${row.username}|${row.date_text}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  const output: EventRow[] = [];
  for (const group of groups.values()) {
    const hasCanonicalPost = group.some((row) => !isGenericPromoTitle(row.title));
    const seenTitles = new Set<string>();

    const ordered = [...group].sort((a, b) => b.description.length - a.description.length);
    for (const row of ordered) {
      if (hasCanonicalPost && isGenericPromoTitle(row.title)) continue;
      const titleKey = normalizedTitle(row.title);
      if (titleKey && seenTitles.has(titleKey)) continue;
      if (titleKey) seenTitles.add(titleKey);
      output.push(row);
    }
  }

  return output;
}

function postToRow(item: JsonRecord): EventRow | null {
  const username = getUsername(item);
  const meta = VENUE_INFO[username];
  // Apify can surface collaborators/related owners. Never admit accounts outside the explicit source list.
  if (!meta) return null;

  const caption = String(firstValue(item, ['caption', 'alt']) || '').trim();
  const shortcode = String(firstValue(item, ['shortCode', 'id']) || '').trim();
  if (!shortcode || !caption) return null;

  const eventDate = extractEventDate(caption, getPublishedAt(item));
  if (!eventDate || !isLikelyEventPost(caption, eventDate) || !isNightlifeFocused(caption)) return null;

  // The public product is a current/future event guide. Past dates stay out even if Apify returns old posts.
  const today = toChileDateString(new Date());
  if (eventDate < today) return null;

  const isJoyita =
    meta.tier === 'joyita' ||
    /spot secreto|ubicaci[oó]n por dm|por interno|aporte voluntario|al sobre|galp[oó]n|casona|clandestin/i.test(caption);

  let title = firstMeaningfulLine(caption, `Evento en ${meta.name}`);
  if (isJoyita && !/^[💎🔥🔊]/.test(title)) title = `💎 ${title}`;

  const likesRaw = firstValue(item, ['likesCount', 'likes']);
  const likes = Number(likesRaw || 0);

  return {
    instagram_id: shortcode,
    title,
    description: caption.slice(0, 4000),
    date_text: eventDate,
    location: meta.location,
    image_url:
      optionalString(firstValue(item, ['displayUrl', 'thumbnailUrl', 'imageUrl'])) || null,
    instagram_url: `https://www.instagram.com/p/${shortcode}/`,
    username,
    likes: Number.isFinite(likes) ? likes : 0,
    scraped_at: new Date().toISOString(),
    source: isJoyita ? 'joyita_under' : meta.tier === 'mainstream' ? 'apify_instagram' : 'rave_techno',
    is_active: true,
  };
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!APIFY_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Faltan APIFY_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const accounts = Object.keys(VENUE_INFO);
    const urls = accounts.map((username) => `https://www.instagram.com/${username}/`);
    const items = await runApify(urls);

    const rows = items.map(postToRow).filter((row): row is EventRow => row !== null);
    const unique = deduplicateEventRows(rows);

    if (unique.length > 0) {
      const { error } = await supabase.from('events').upsert(unique, { onConflict: 'instagram_id' });
      if (error) throw new Error(`Supabase upsert: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      accounts_scanned: accounts.length,
      posts_found: items.length,
      event_candidates: rows.length,
      events_saved: unique.length,
      deduped_or_suppressed: rows.length - unique.length,
      skipped_non_events: items.length - rows.length,
      apify_results_limit_per_account: APIFY_RESULTS_LIMIT,
      apify_newer_than: APIFY_NEWER_THAN,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/scrape]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido en scraping' },
      { status: 502 },
    );
  }
}
