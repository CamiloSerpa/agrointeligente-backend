const express = require('express');
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { tipo, prioridad, no_leidas } = req.query;
    const filtros = [`usuario_id = $1`];
    const params = [req.user.id];

    if (tipo) {
      params.push(tipo);
      filtros.push(`tipo = $${params.length}`);
    }
    if (prioridad) {
      params.push(prioridad);
      filtros.push(`prioridad = $${params.length}`);
    }
    if (no_leidas === 'true') {
      filtros.push(`leida = FALSE`);
    }

    const result = await query(
      `SELECT * FROM alertas
        WHERE ${filtros.join(' AND ')}
        ORDER BY creado_en DESC
        LIMIT 50`,
      params
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

router.patch('/:id/leida', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE alertas SET leida = TRUE
        WHERE id = $1 AND usuario_id = $2
        RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Alerta no encontrada');
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
