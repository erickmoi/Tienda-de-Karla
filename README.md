# Tienda de Karla

App web para registrar lo que se toma de la tiendita de snacks y llevar las cuentas.
Hecha por Starfield Studio con React + Vite + Tailwind y Supabase.

## Correr en tu compu

```bash
cp .env.example .env
npm install
npm run dev
```

## Publicación

Netlify está conectado a este repo: cada `push` a `main` compila y publica la app.
La configuración de compilación y las variables públicas están en `netlify.toml`.

## Ramas

- `desarrollo`: aquí se trabaja. Netlify no la publica, así que no gasta créditos.
- `main`: lo que está en línea. Se actualiza una vez por paquete de cambios.

## Funciones del servidor (Supabase Edge Functions)

Código en `supabase/functions/`:

- `admin-usuarios`: crear cuentas y restablecer PIN (usa la llave secreta, nunca el navegador).
- `notificar`: notificaciones push (stock bajo, recordatorio semanal, recordar cobro, prueba).

Las llaves VAPID y el token compartido viven en Supabase Vault. La pública también está en `netlify.toml`.

## Mantener Supabase activo

`.github/workflows/mantener-activo.yml` hace una consulta liviana cada 3 días para que el
plan gratis no pause el proyecto.

## Base de datos

El esquema, las reglas de seguridad (RLS) y las funciones viven en Supabase
(migraciones `fase1_*` a `fase6_promos_horario_limites_caja`).
La llave secreta de Supabase nunca va en este repo.
