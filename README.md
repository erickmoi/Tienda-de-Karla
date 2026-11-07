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

## Base de datos

El esquema, las reglas de seguridad (RLS) y las funciones viven en Supabase
(migraciones `fase1_tablas_base`, `fase1_rls_y_permisos`, `fase1_funciones_negocio`).
La llave secreta de Supabase nunca va en este repo.
