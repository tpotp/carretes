import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EventoFormData } from '../../../lib/types';
import { toChileDateString } from '../../../lib/event-extraction';

const ALLOWED_CATEGORIES = new Set([
  'universitario',
  'under',
  'electronica',
  'cumbia',
  'reggaeton',
  'rock',
  'otro',
]);

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
}

function safeUrl(value: unknown): string | null {
  const text = cleanText(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeOrganizer(value: unknown): string {
  const organizer = cleanText(value, 100).replace(/\s+/g, '');
  if (!organizer) return '@comunidad';
  return organizer.startsWith('@') ? organizer : `@${organizer}`;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serverKey) {
    return NextResponse.json(
      { success: false, error: 'Publicación temporalmente no disponible' },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as EventoFormData & { client_id?: string };

    const nombre = cleanText(body.nombre, 160);
    const lugar = cleanText(body.lugar, 240);
    const ciudad = cleanText(body.ciudad || 'Valparaíso', 80);
    const sector = cleanText(body.sector, 120);
    const fecha = cleanText(body.fecha, 10);
    const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.hora || '')) ? String(body.hora) : '';
    const categoria = ALLOWED_CATEGORIES.has(String(body.categoria)) ? String(body.categoria) : 'otro';
    const organizer = normalizeOrganizer(body.organizador);

    if (!nombre || !lugar || !/^20\d{2}-[01]\d-[0-3]\d$/.test(fecha)) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios válidos (nombre, lugar, fecha)' },
        { status: 400 },
      );
    }

    if (fecha < toChileDateString(new Date())) {
      return NextResponse.json(
        { success: false, error: 'La fecha del evento no puede estar en el pasado' },
        { status: 400 },
      );
    }

    const priceNumber = typeof body.precio === 'number' && Number.isFinite(body.precio) && body.precio >= 0
      ? Math.round(body.precio)
      : null;
    const priceDetail = cleanText(body.precio_texto, 240);
    const description = cleanText(body.descripcion, 3500);

    const structuredLines = [
      hora ? `Hora: ${hora}` : '',
      priceNumber !== null ? `Entrada: $${priceNumber.toLocaleString('es-CL')}` : '',
      priceDetail ? `Detalle entrada: ${priceDetail}` : '',
      `Categoría: ${categoria}`,
      sector ? `Sector: ${sector}` : '',
    ].filter(Boolean);

    const storedDescription = [...structuredLines, description ? `\n${description}` : '']
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000);

    const rawClientId = cleanText(body.client_id, 120);
    const instagramId = /^evt-user-[a-zA-Z0-9-]+$/.test(rawClientId)
      ? rawClientId
      : `evt-user-${randomUUID()}`;

    const row = {
      instagram_id: instagramId,
      title: nombre,
      description: storedDescription,
      date_text: fecha,
      location: `${lugar} · ${ciudad}${sector ? ` · ${sector}` : ''}`.slice(0, 300),
      image_url: safeUrl(body.imagen_url),
      instagram_url: safeUrl(body.fuente_url),
      username: organizer.replace(/^@/, ''),
      likes: 0,
      scraped_at: new Date().toISOString(),
      source: 'manual_pending',
      is_active: false,
    };

    const supabase = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('events')
      .upsert(row, { onConflict: 'instagram_id' })
      .select('*')
      .single();

    if (error) {
      console.error('[api/publicar] Supabase:', error);
      return NextResponse.json(
        { success: false, error: 'No se pudo guardar el evento' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, pending_review: true, evento: data },
      { status: 201 },
    );
  } catch (error) {
    console.error('[api/publicar]', error);
    return NextResponse.json(
      { success: false, error: 'Solicitud inválida' },
      { status: 400 },
    );
  }
}
