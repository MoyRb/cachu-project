# Supabase (Postgres)

Pasos rápidos para vincular y aplicar migraciones:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

> Las migraciones Postgres viven en `supabase/migrations/`.
> El seed opcional está en `supabase/seed.sql`.

## Realtime para cocina

Las pantallas de `/cocina/*` usan Supabase Realtime para refrescar pedidos al
escuchar cambios en `public.orders` y `public.order_items`. Asegúrate de tener
Realtime habilitado en el proyecto y con publicación activada para esas tablas
en **Database → Replication** (o configuración equivalente). El polling queda
como respaldo cada 60s si Realtime no conecta.
