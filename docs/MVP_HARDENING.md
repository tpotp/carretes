# MVP hardening — 2026-09-12

## Decisiones canónicas

- **Pipeline único de producción:** Vercel Cron → Apify → Supabase → Next.js.
- El worker Python/Railway duplicado queda retirado para evitar doble scraping y lógica divergente.
- Los posts de Instagram **no** se convierten automáticamente en eventos: deben tener una fecha de evento extraíble y señales de evento.
- La fecha del post de Instagram no se usa como fecha del evento.
- Los likes de Instagram no se presentan como asistentes ni interesados.
- El precio y la hora se muestran como “por confirmar” cuando no hay evidencia explícita.
- Los formularios públicos escriben en Supabase únicamente a través de un endpoint server-side con `service_role`.

## Antes de fusionar/desplegar

- [ ] Rotar/revocar la antigua `SUPABASE_SERVICE_ROLE_KEY` que apareció en el historial Git público.
- [ ] Configurar en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_API_TOKEN`, `CRON_SECRET`.
- [ ] Ejecutar `supabase-schema.sql` en Supabase para retirar policies de escritura pública.
- [ ] Confirmar que Vercel usa plan Hobby o superior. El cron actual es una vez al día y es compatible con Hobby.
- [ ] Ejecutar manualmente `/api/cron/scrape` con `Authorization: Bearer <CRON_SECRET>` y revisar `posts_found`, `event_candidates`, `events_saved`.
- [ ] Verificar manualmente al menos 20 eventos consecutivos contra su post fuente antes de ampliar cuentas.
- [ ] Revisar el costo real de Apify por evento válido antes de aumentar frecuencia o `resultsLimit`.

## Variables opcionales para controlar costo

- `APIFY_RESULTS_LIMIT=5`
- `APIFY_NEWER_THAN=3 days`
- `APIFY_ACTOR=apify~instagram-scraper`

## Criterio de salida P0

1. CI verde (`lint`, `typecheck`, `build`).
2. Sin secretos activos en el HEAD del repositorio.
3. RLS aplicado en Supabase.
4. Pipeline real Apify → Supabase → UI validado end-to-end.
5. Fechas de eventos verificadas contra las fuentes; sin usar la fecha de publicación como sustituto.
