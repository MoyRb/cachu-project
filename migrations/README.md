# Migraciones (SQLite legacy)

Este directorio contiene **solo** migraciones para la base SQLite legacy utilizada en desarrollo local.
En producción, el esquema oficial vive en **Supabase (Postgres)** dentro de `supabase/migrations/`.

- `migrations/001_init.sql` se conserva únicamente para compatibilidad legacy.
- No se debe ejecutar en entornos Supabase/producción.
