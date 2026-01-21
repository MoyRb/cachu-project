# Supabase (Postgres)

Pasos rápidos para vincular y aplicar migraciones:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

> Las migraciones Postgres viven en `supabase/migrations/`.
> El seed opcional está en `supabase/seed.sql`.
