-- Carretes V Región — esquema MVP
-- Ejecutar este archivo/migración en Supabase antes de publicar el MVP.

CREATE TABLE IF NOT EXISTS public.events (
  id              BIGSERIAL PRIMARY KEY,
  instagram_id    TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  date_text       TEXT,
  location        TEXT DEFAULT 'V Region',
  image_url       TEXT,
  instagram_url   TEXT,
  username        TEXT,
  likes           INTEGER DEFAULT 0,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  source          TEXT DEFAULT 'instagram_hashtag',
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(location);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON public.events(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_likes ON public.events(likes DESC);
CREATE INDEX IF NOT EXISTS idx_events_date_text ON public.events(date_text);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Elimina políticas antiguas que permitían escrituras públicas.
DROP POLICY IF EXISTS "Public read" ON public.events;
DROP POLICY IF EXISTS "Service insert" ON public.events;
DROP POLICY IF EXISTS "Service upsert" ON public.events;

-- La aplicación pública sólo puede leer eventos activos.
CREATE POLICY "Public read" ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Defensa adicional: las escrituras públicas quedan revocadas.
-- Las credenciales server-side de Supabase bypassan RLS y se usan sólo en endpoints del servidor.
REVOKE ALL PRIVILEGES ON TABLE public.events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.events TO anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.events_id_seq FROM PUBLIC, anon, authenticated;

-- IMPORTANTE: security_invoker obliga a la vista a respetar RLS/permisos del caller.
CREATE OR REPLACE VIEW public.recent_events
WITH (security_invoker = true)
AS
  SELECT * FROM public.events
  WHERE is_active = TRUE
    AND scraped_at > NOW() - INTERVAL '14 days'
  ORDER BY date_text ASC NULLS LAST, scraped_at DESC;

GRANT SELECT ON TABLE public.recent_events TO anon, authenticated;
