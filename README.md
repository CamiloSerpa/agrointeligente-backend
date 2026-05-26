# 🌱 AgroInteligente — Backend

Backend completo del sistema AgroInteligente:
**API REST (Node.js/Express)** + **Motor de Análisis IA (Python/FastAPI)** + **Worker de Alertas (Node.js)** + **PostgreSQL**.

Todos los servicios se orquestan con un solo comando usando Docker Compose.

---

## 📋 Requisitos

- **Docker Desktop** 4.x o superior (con Docker Compose v2)
- 4 GB de RAM disponibles
- Puertos libres: `3000` (API), `8000` (motor Python), `5432` (PostgreSQL)

---

## 🚀 Puesta en marcha

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar todos los servicios (primera vez: 2-3 minutos)
docker compose up -d --build

# 3. Verificar que todo está corriendo
docker compose ps
```

### Verificar el estado de los servicios

```bash
# Health de la API Node.js
curl http://localhost:3000/health

# Health del motor Python
curl http://localhost:8000/health
```

---

## 📡 Endpoints de la API

Base URL: `http://localhost:3000/api`

Todas las rutas excepto `/auth/register`, `/auth/login` y `/health` requieren:
```
Authorization: Bearer <token_jwt>
```

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` | Crear cuenta (nombre, email, password, ubicacion_lat, ubicacion_lng) |
| POST | `/auth/login` | Iniciar sesión → devuelve JWT |
| GET | `/auth/me` | Perfil del usuario autenticado |
| PATCH | `/auth/me` | Actualizar perfil (nombre, teléfono, ubicación + coordenadas) |

### Cultivos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cultivos` | Listar cultivos del usuario |
| POST | `/cultivos` | Crear cultivo |
| GET | `/cultivos/:id` | Ver un cultivo |
| PATCH | `/cultivos/:id` | Actualizar cultivo |
| DELETE | `/cultivos/:id` | Eliminar cultivo |
| POST | `/cultivos/sync` | Sincronización masiva offline-first (batch UPSERT) |

### Clima
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/clima` | Clima actual + pronóstico 24h (usa lat/lng del usuario) |
| GET | `/clima/historial` | Histórico de registros climáticos |

### Alertas y Recomendaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/alertas` | Listar alertas del usuario |
| PATCH | `/alertas/:id/leida` | Marcar alerta como leída |
| GET | `/recomendaciones` | Listar recomendaciones |
| POST | `/recomendaciones/analizar/:cultivoId` | Solicitar análisis IA al motor Python |

### Historial
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/historial?dias=30&tipo=cultivo` | Timeline de actividad del usuario |

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────┐
│          App Flutter (cliente móvil)         │
└──────────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌──────────────────────────────────────────────┐
│       API REST — Node.js + Express (:3000)   │
│  Auth JWT · Cultivos · Clima · Sync · etc.   │
└────────────────────┬─────────────────────────┘
                     │ HTTP interno (red Docker)
                     ▼
┌──────────────────────────────────────────────┐
│    Motor de Análisis IA — Python (:8000)     │
│  Lee cultivo + clima reciente → reglas IA    │
│  → INSERT recomendaciones en PostgreSQL      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│    Worker de Alertas — Node.js (background)  │
│  Cada 30 min → clima por usuario → reglas    │
│  → INSERT alertas si se cumplen condiciones  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│           PostgreSQL (:5432)                 │
│  usuarios, cultivos, alertas,                │
│  recomendaciones, historial, clima_registros │
└──────────────────────────────────────────────┘

APIs externas (gratuitas, sin API key):
  · Open-Meteo Forecast   → clima actual y pronóstico
  · Open-Meteo Geocoding  → búsqueda de ciudades por nombre
```

---

## 📁 Estructura

```
agrointeligente-backend/
├── docker-compose.yml              # Orquestación de 4 servicios
├── .env.example                    # Variables de entorno de ejemplo
├── db/
│   └── migrations/
│       └── 01_init.sql             # Schema completo (se ejecuta automáticamente)
├── api-node/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js               # Express + rutas
│       ├── db/
│       │   └── pool.js             # Pool de conexiones PostgreSQL
│       ├── middleware/
│       │   ├── auth.js             # Verificación JWT
│       │   └── error.js            # Manejo centralizado de errores
│       ├── routes/
│       │   ├── auth.routes.js      # Registro, login, perfil
│       │   ├── cultivos.routes.js  # CRUD + sync batch
│       │   ├── clima.routes.js     # Clima via Open-Meteo
│       │   ├── alertas.routes.js
│       │   ├── recomendaciones.routes.js
│       │   └── historial.routes.js
│       ├── services/
│       │   ├── clima.service.js    # Integración Open-Meteo Forecast
│       │   └── motor.service.js    # HTTP interno → Motor Python
│       └── workers/
│           └── alertas-worker.js  # Worker automático de alertas (30 min)
└── motor-python/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py                 # FastAPI + endpoint POST /analizar
        ├── db.py                   # Conexión PostgreSQL desde Python
        └── analisis.py             # Reglas de negocio agrícolas por cultivo
```

---

## 🔧 Comandos útiles

```bash
# Ver logs en tiempo real de un servicio
docker compose logs -f api
docker compose logs -f motor
docker compose logs -f alertas

# Reiniciar un servicio sin perder datos
docker compose restart api

# Entrar a PostgreSQL directamente
docker compose exec postgres psql -U agro -d agrointeligente

# Consultar usuarios registrados
docker compose exec postgres psql -U agro -d agrointeligente -c "SELECT id, email, nombre, ubicacion_texto FROM usuarios;"

# Borrar TODOS los datos (usuarios, cultivos, etc.)
docker compose exec postgres psql -U agro -d agrointeligente -c "TRUNCATE TABLE usuarios CASCADE;"

# Detener todos los servicios sin borrar datos
docker compose down

# Detener Y borrar la base de datos (reinicio completo)
docker compose down -v
```

---

## 🔗 Conectar la app Flutter

En `lib/services/api_client.dart`:

```dart
// Emulador Android:
baseUrl: 'http://10.0.2.2:3000/api'

// Dispositivo físico (misma red WiFi):
baseUrl: 'http://<TU-IP-LOCAL>:3000/api'

// iOS Simulator:
baseUrl: 'http://localhost:3000/api'
```

---

## 🚧 Próximos pasos

- [ ] HTTPS con certificado SSL (para producción)
- [ ] Refresh tokens
- [ ] Notificaciones push (Firebase Cloud Messaging)
- [ ] Modelo de ML real en el motor Python (scikit-learn)
- [ ] Rate limiting
- [ ] Tests automatizados (Jest, pytest)
- [ ] CI/CD con GitHub Actions

---

Hecho con 💚 para los agricultores rurales de Colombia.
