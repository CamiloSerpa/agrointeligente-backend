-- ╔══════════════════════════════════════════════════════════════╗
-- ║          ESQUEMA AGROINTELIGENTE — BASE DE DATOS CENTRAL     ║
-- ╚══════════════════════════════════════════════════════════════╝
-- Se ejecuta automáticamente al levantar PostgreSQL la primera vez.

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ─── USUARIOS ────────────────────────────────────────────────
CREATE TABLE usuarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(180) UNIQUE NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    nombre           VARCHAR(120) NOT NULL,
    telefono         VARCHAR(30),
    ubicacion_lat    DECIMAL(9,6),     -- Para consultar clima por finca
    ubicacion_lng    DECIMAL(9,6),
    ubicacion_texto  VARCHAR(160),     -- Ej: "Santa Marta, Magdalena"
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ─── CULTIVOS ────────────────────────────────────────────────
CREATE TABLE cultivos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo             VARCHAR(60) NOT NULL,         -- maiz, cafe, platano, etc.
    nombre_lote      VARCHAR(120) NOT NULL,
    fecha_siembra    DATE NOT NULL,
    estado           VARCHAR(30) NOT NULL DEFAULT 'siembra',
                     -- valores: siembra, germinacion, crecimiento, floracion, cosecha
    area_hectareas   DECIMAL(8,2) NOT NULL DEFAULT 0,
    notas            TEXT,
    -- Para sincronización offline-first:
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ID local en el móvil para evitar duplicados al sincronizar:
    cliente_uuid     UUID UNIQUE
);

CREATE INDEX idx_cultivos_usuario ON cultivos(usuario_id);
CREATE INDEX idx_cultivos_estado  ON cultivos(estado);

-- ─── DATOS CLIMÁTICOS (histórico consultado de Open-Meteo) ───
CREATE TABLE clima_registros (
    id               BIGSERIAL PRIMARY KEY,
    usuario_id       UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha            TIMESTAMPTZ NOT NULL,
    temperatura      DECIMAL(5,2),                 -- °C
    humedad          INT,                          -- 0-100
    prob_lluvia      INT,                          -- 0-100
    precipitacion_mm DECIMAL(6,2),
    viento_kmh       DECIMAL(5,2),
    descripcion      VARCHAR(120),
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clima_usuario_fecha ON clima_registros(usuario_id, fecha DESC);

-- ─── ALERTAS ─────────────────────────────────────────────────
CREATE TABLE alertas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cultivo_id       UUID REFERENCES cultivos(id) ON DELETE CASCADE,
    titulo           VARCHAR(180) NOT NULL,
    descripcion      TEXT NOT NULL,
    tipo             VARCHAR(30) NOT NULL,
                     -- valores: lluvia, temperatura, plaga, viento, info
    prioridad        VARCHAR(10) NOT NULL DEFAULT 'media',
                     -- valores: alta, media, baja
    leida            BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alertas_usuario     ON alertas(usuario_id, creado_en DESC);
CREATE INDEX idx_alertas_no_leidas   ON alertas(usuario_id) WHERE leida = FALSE;

-- ─── RECOMENDACIONES (generadas por motor Python) ────────────
CREATE TABLE recomendaciones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cultivo_id        UUID REFERENCES cultivos(id) ON DELETE CASCADE,
    titulo            VARCHAR(180) NOT NULL,
    descripcion       TEXT NOT NULL,
    tag               VARCHAR(60) NOT NULL,        -- "Fertilización", "Riego", etc.
    generada_por_ia   BOOLEAN NOT NULL DEFAULT TRUE,
    aplicada          BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reco_usuario ON recomendaciones(usuario_id, creado_en DESC);

-- ─── HISTORIAL (timeline de actividad del agricultor) ────────
CREATE TABLE historial (
    id               BIGSERIAL PRIMARY KEY,
    usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo             VARCHAR(30) NOT NULL,
                     -- valores: cultivo, clima, alerta, accion
    titulo           VARCHAR(180) NOT NULL,
    descripcion      TEXT,
    fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_usuario_fecha ON historial(usuario_id, fecha DESC);

-- ─── DATOS DE PRUEBA (semilla) ───────────────────────────────
-- El usuario demo se crea desde el script de seed en Node.js
-- (api-node/src/db/seed.js) para que el hash bcrypt sea válido.
-- Ejecuta: docker compose exec api node src/db/seed.js
