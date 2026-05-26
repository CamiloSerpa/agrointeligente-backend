const express = require('express');
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { httpError } = require('../middleware/error');
const motorService = require('../services/motor.service');

const router = express.Router();
router.use(authMiddleware);

function _diasDesideSiembra(fechaSiembra) {
  const hoy = new Date();
  const siembra = fechaSiembra instanceof Date ? fechaSiembra : new Date(fechaSiembra);
  return Math.floor((hoy - siembra) / (1000 * 60 * 60 * 24));
}

function analizarLocalmente(cultivo, climaReciente) {
  const recos = [];
  const tipo = cultivo.tipo.toLowerCase();
  const dias = _diasDesideSiembra(cultivo.fecha_siembra);
  const estado = cultivo.estado;

  const humedades = climaReciente.filter(r => r.humedad != null).map(r => r.humedad);
  const humedadPromedio = humedades.length > 0
    ? humedades.reduce((a, b) => a + b, 0) / humedades.length
    : null;

  if (tipo === 'maiz') {
    if (estado === 'germinacion' && dias >= 5 && dias <= 14) {
      if (humedadPromedio === null || humedadPromedio >= 50) {
        recos.push({
          titulo: 'Es momento ideal para abonar tu lote',
          descripcion: `El cultivo lleva ${dias} días de germinación con humedad adecuada. Aplique urea al voleo o NPK 15-15-15 según disponibilidad.`,
          tag: 'Fertilización',
          generada_por_ia: true,
        });
      }
    }
    if (estado === 'floracion' && dias > 80) {
      recos.push({
        titulo: 'Cosecha óptima en 12-15 días',
        descripcion: 'El cultivo está en floración avanzada. Prepare equipo y mano de obra para la próxima cosecha.',
        tag: 'Cosecha',
        generada_por_ia: true,
      });
    }
  }

  if (tipo === 'cafe' || tipo === 'café') {
    if (estado === 'floracion') {
      recos.push({
        titulo: 'Aplicar NPK 15-15-15 en floración',
        descripcion: 'Su café entra en floración. Dosis recomendada: 200g por planta a 30cm del tallo, en surco superficial.',
        tag: 'Fertilización',
        generada_por_ia: false,
      });
    }
  }

  if (tipo === 'tomate' || tipo === 'platano' || tipo === 'plátano') {
    if (estado === 'crecimiento') {
      recos.push({
        titulo: 'Revisión de tutores y soporte',
        descripcion: 'En etapa de crecimiento verifique que los tutores estén firmes y ajuste amarres si es necesario para evitar daños por viento.',
        tag: 'Manejo',
        generada_por_ia: true,
      });
    }
  }

  if (humedadPromedio !== null && humedadPromedio < 40) {
    recos.push({
      titulo: 'Aumente la frecuencia de riego',
      descripcion: 'La humedad ambiental ha estado baja (promedio < 40%). Considere riego adicional en horas tempranas.',
      tag: 'Riego',
      generada_por_ia: true,
    });
  }

  recos.push({
    titulo: 'Control preventivo de plagas',
    descripcion: 'Inspeccione el envés de las hojas esta semana. Período favorable para aparición de mosca blanca y ácaros.',
    tag: 'Prevención',
    generada_por_ia: true,
  });

  return recos;
}

async function guardarRecomendaciones(usuarioId, cultivoId, recos) {
  const existentesRes = await query(
    `SELECT titulo FROM recomendaciones WHERE usuario_id = $1 AND cultivo_id = $2`,
    [usuarioId, cultivoId]
  );
  const titulosExistentes = new Set(existentesRes.rows.map((r) => r.titulo));

  let nuevas = recos.filter((r) => !titulosExistentes.has(r.titulo));

  if (nuevas.length === 0) nuevas = recos;

  const elegida = nuevas[Math.floor(Math.random() * nuevas.length)];
  const ins = await query(
    `INSERT INTO recomendaciones (usuario_id, cultivo_id, titulo, descripcion, tag, generada_por_ia)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, titulo, descripcion, tag, generada_por_ia, creado_en`,
    [usuarioId, cultivoId, elegida.titulo, elegida.descripcion, elegida.tag, elegida.generada_por_ia]
  );
  return ins.rows[0] ? [ins.rows[0]] : [];
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM recomendaciones
        WHERE usuario_id = $1
        ORDER BY creado_en DESC
        LIMIT 30`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM recomendaciones
        WHERE id = $1 AND usuario_id = $2
        RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Recomendación no encontrada');
    res.json({ eliminada: req.params.id });
  } catch (e) { next(e); }
});

router.post('/analizar/:cultivoId', async (req, res, next) => {
  try {
    const c = await query(
      `SELECT * FROM cultivos WHERE id = $1 AND usuario_id = $2`,
      [req.params.cultivoId, req.user.id]
    );
    if (c.rowCount === 0) throw httpError(404, 'Cultivo no encontrado');

    let resultado;
    try {
      resultado = await motorService.solicitarAnalisis(req.user.id, req.params.cultivoId);
    } catch (_motorErr) {
      const climaRows = await query(
        `SELECT temperatura, humedad, prob_lluvia, precipitacion_mm, viento_kmh
           FROM clima_registros
          WHERE usuario_id = $1
            AND fecha > NOW() - INTERVAL '24 hours'
          ORDER BY fecha DESC
          LIMIT 24`,
        [req.user.id]
      );
      const recos = analizarLocalmente(c.rows[0], climaRows.rows);
      const insertadas = await guardarRecomendaciones(req.user.id, req.params.cultivoId, recos);
      resultado = { total_generadas: insertadas.length, recomendaciones: insertadas };
    }

    res.json(resultado);
  } catch (e) { next(e); }
});

module.exports = router;
