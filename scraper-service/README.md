# scraper-service (legacy utilities)

La ingestión de producción del MVP vive en `app/api/cron/scrape/route.ts` y se ejecuta desde Vercel.

Este directorio conserva únicamente utilidades exploratorias. **No debe contener credenciales, cookies, tokens ni un segundo worker de producción.**

Si en el futuro se decide volver a un worker persistente (Railway u otro proveedor), debe diseñarse como un pipeline único y reemplazar explícitamente al cron de Vercel para evitar doble scraping, doble costo y parsers divergentes.
