const express = require('express');
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { httpError } = require('../middleware/error');
const climaService = require('../services/clima.service');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const u = await query(
      `SELECT ubicacion_lat, ubicacion_lng, ubicacion_texto
         FROM usuarios WHERE id = $1`,
      [req.user.id]
    );
    if (u.rowCount === 0) throw httpError(404, 'Usuario no encontrado');
    const { ubicacion_lat, ubicacion_lng, ubicacion_texto } = u.rows[0];
    if (!ubicacion_lat || !ubicacion_lng) {
      throw httpError(400, 'El usuario no tiene ubicación configurada');
    }

    const { actual, pronostico } = await climaService.obtenerClima(
      parseFloat(ubicacion_lat),
      parseFloat(ubicacion_lng)
    );

    await query(
      `INSERT INTO clima_registros (usuario_id, fecha, temperatura, humedad,
                                     prob_lluvia, precipitacion_mm, viento_kmh,
                                     descripcion)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
      [
        req.user.id,
        actual.temperatura, actual.humedad, actual.probabilidad_lluvia,
        actual.precipitacion_mm, actual.viento_kmh, actual.descripcion,
      ]
    );

    res.json({
      ubicacion: ubicacion_texto,
      actual,
      pronostico,
    });
  } catch (e) { next(e); }
});

router.get('/historial', async (req, res, next) => {
  try {
    const dias = Math.min(parseInt(req.query.dias || '7', 10), 30);
    const result = await query(
      `SELECT fecha, temperatura, humedad, prob_lluvia,
              precipitacion_mm, viento_kmh, descripcion
         FROM clima_registros
        WHERE usuario_id = $1
          AND fecha > NOW() - ($2::int * INTERVAL '1 day')
        ORDER BY fecha DESC`,
      [req.user.id, dias]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

module.exports = router;
