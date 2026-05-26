const express = require('express');
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const dias = Math.min(parseInt(req.query.dias || '30', 10), 365);
    const { tipo } = req.query;

    const filtros = [`usuario_id = $1`, `fecha > NOW() - ($2::int * INTERVAL '1 day')`];
    const params = [req.user.id, dias];

    if (tipo) {
      params.push(tipo);
      filtros.push(`tipo = $${params.length}`);
    }

    const result = await query(
      `SELECT * FROM historial
        WHERE ${filtros.join(' AND ')}
        ORDER BY fecha DESC
        LIMIT 100`,
      params
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

module.exports = router;
