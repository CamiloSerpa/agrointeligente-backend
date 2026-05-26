require('dotenv').config();
const { pool, query } = require('../db/pool');
const climaService = require('../services/clima.service');

const INTERVAL_MS = parseInt(process.env.ALERTAS_INTERVAL_MS || '1800000', 10); // 30 min

const reglas = [
  (clima) => {
    const maxLluvia = Math.max(
      ...clima.pronostico.slice(0, 12).map((p) => p.probabilidad_lluvia || 0)
    );
    if (maxLluvia >= 80) {
      return {
        titulo: '⚠️ Riesgo alto de lluvia en las próximas horas',
        descripcion: `Probabilidad máxima de ${maxLluvia}%. Considere posponer fumigaciones y cosechas.`,
        tipo: 'lluvia',
        prioridad: maxLluvia >= 90 ? 'alta' : 'media',
      };
    }
    return null;
  },

  (clima) => {
    const maxTemp = Math.max(
      ...clima.pronostico.slice(0, 24).map((p) => p.temperatura || 0)
    );
    if (maxTemp >= 35) {
      return {
        titulo: '🌡️ Temperatura extrema esperada',
        descripcion: `Máxima de ${maxTemp.toFixed(1)}°C. Riegue temprano y proteja plántulas jóvenes.`,
        tipo: 'temperatura',
        prioridad: maxTemp >= 38 ? 'alta' : 'media',
      };
    }
    return null;
  },

  (clima) => {
    if (clima.actual.viento_kmh >= 25) {
      return {
        titulo: '💨 Viento fuerte detectado',
        descripcion: `${clima.actual.viento_kmh} km/h actuales. Evite fumigaciones aéreas.`,
        tipo: 'viento',
        prioridad: 'baja',
      };
    }
    return null;
  },
];

async function analizarUsuario(usuario) {
  try {
    const clima = await climaService.obtenerClima(
      parseFloat(usuario.ubicacion_lat),
      parseFloat(usuario.ubicacion_lng)
    );

    for (const regla of reglas) {
      const alerta = regla(clima);
      if (!alerta) continue;

      const existe = await query(
        `SELECT id FROM alertas
          WHERE usuario_id = $1 AND tipo = $2
            AND creado_en > NOW() - INTERVAL '6 hours'`,
        [usuario.id, alerta.tipo]
      );
      if (existe.rowCount > 0) continue;

      await query(
        `INSERT INTO alertas (usuario_id, titulo, descripcion, tipo, prioridad)
         VALUES ($1, $2, $3, $4, $5)`,
        [usuario.id, alerta.titulo, alerta.descripcion, alerta.tipo, alerta.prioridad]
      );
      console.log(`  ✓ Alerta creada para ${usuario.email}: ${alerta.tipo}`);
    }
  } catch (err) {
    console.error(`  ❌ Error analizando ${usuario.email}:`, err.message);
  }
}

async function ciclo() {
  console.log(`\n🔔 [${new Date().toISOString()}] Iniciando ciclo de análisis…`);
  try {
    const result = await query(
      `SELECT id, email, ubicacion_lat, ubicacion_lng
         FROM usuarios
        WHERE ubicacion_lat IS NOT NULL
          AND ubicacion_lng IS NOT NULL`
    );
    console.log(`  Analizando ${result.rowCount} usuarios…`);
    for (const u of result.rows) {
      await analizarUsuario(u);
    }
    console.log('✅ Ciclo completado.');
  } catch (err) {
    console.error('❌ Error en ciclo de alertas:', err);
  }
}

console.log('🌱 Gestor de Alertas iniciado.');
console.log(`   Intervalo: cada ${(INTERVAL_MS / 60000).toFixed(1)} min`);

setTimeout(() => {
  ciclo();
  setInterval(ciclo, INTERVAL_MS);
}, 30000);

process.on('SIGTERM', async () => {
  console.log('\n👋 Gestor de Alertas cerrando…');
  await pool.end();
  process.exit(0);
});
