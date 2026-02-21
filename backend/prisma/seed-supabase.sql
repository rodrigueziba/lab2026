-- =============================================================================
-- SEED PARA SUPABASE (alternativa a npm run seed)
--
-- Cómo usarlo:
-- 1. En Supabase: Dashboard → SQL Editor → New query
-- 2. Pegar todo este archivo y pulsar Run (o ejecutar por bloques).
-- 3. Los usuarios se crean/actualizan por email. Contraseña: password123
-- 4. Las locaciones solo deben ejecutarse si la tabla "Locacion" está vacía.
--
-- Requiere: tablas ya creadas (ej. npx prisma migrate deploy con DATABASE_URL de Supabase).
-- =============================================================================

-- 1. USUARIOS (upsert por email)
-- Contraseña para los 3: password123 (hash bcrypt)
INSERT INTO "User" (email, password, nombre, role, "createdAt")
VALUES
  ('admin@tdffilm.com', '$2b$10$Fdb0LwrKCkQHwkGfYzRcp.ks4Nf6jbQlatJ4hRusnMBxm.cS96iKm', 'Admin TDF', 'admin', NOW()),
  ('productor@tdffilm.com', '$2b$10$Fdb0LwrKCkQHwkGfYzRcp.ks4Nf6jbQlatJ4hRusnMBxm.cS96iKm', 'Juan Pérez', 'user', NOW()),
  ('maria@tdffilm.com', '$2b$10$Fdb0LwrKCkQHwkGfYzRcp.ks4Nf6jbQlatJ4hRusnMBxm.cS96iKm', 'María González', 'user', NOW())
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  nombre = EXCLUDED.nombre,
  role = EXCLUDED.role;

-- 2. LOCACIONES (ejecutar solo si la tabla "Locacion" está vacía)
INSERT INTO "Locacion" (nombre, ciudad, categoria, subcategoria, descripcion, direccion, accesibilidad, lat, lng, galeria, "createdAt")
VALUES
  ('Laguna Esmeralda', 'Ushuaia', 'Paisaje Natural', 'Lagos y lagunas', 'Laguna de altura con turberas, ideal para exteriores de naturaleza.', 'Ruta Provincial 3', 'Media (Caminata corta)', -54.75, -68.35, '{}', NOW()),
  ('Puerto de Ushuaia', 'Ushuaia', 'Urbano y Arquitectura', 'Puerto', 'Muelle y edificios portuarios con vista al Canal Beagle.', 'Maipú 465', 'Fácil (Vehículo)', -54.8019, -68.303, '{}', NOW()),
  ('Glaciar Martial', 'Ushuaia', 'Paisaje Natural', 'Glaciares', 'Vista panorámica de Ushuaia y cordillera. Centro de esquí.', 'Av. Luis F. Martial', 'Media (Caminata corta)', -54.78, -68.42, '{}', NOW()),
  ('Estancia Harberton', 'Ushuaia', 'Sitios Abandonados', 'Estancias', 'Primera estancia fueguina, museo y naturaleza.', 'Ruta 3 Km 85', 'Fácil (Vehículo)', -54.87, -67.08, '{}', NOW()),
  ('Costanera Río Grande', 'Río Grande', 'Urbano y Arquitectura', 'Calles céntricas', 'Paseo costero y edificios de la ciudad.', 'Costanera', 'Fácil (Vehículo)', -53.7763, -67.7164, '{}', NOW()),
  ('Lago Fagnano', 'Tolhuin', 'Paisaje Natural', 'Lagos y lagunas', 'Lago extenso con bosque y playas. Muy cinematográfico.', 'Ruta 3', 'Fácil (Vehículo)', -54.51, -67.19, '{}', NOW())
;

-- Ejecuta el bloque de locaciones solo si la tabla "Locacion" está vacía (si no, borra o comenta esas líneas).
-- Prestadores y proyectos: tras tener los usuarios creados, puedes correr "npm run seed" desde el backend
-- con DATABASE_URL de Supabase para que Prisma cree prestadores y proyectos, o añadirlos desde el panel.
