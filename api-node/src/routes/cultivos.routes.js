const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const router = express.Router();
router.use(authMiddleware);

const ESTADOS = ['siembra', 'germinacion', 'crecimiento', 'floracion', 'cosecha'];

const cultivoSchema = z.object({
  tipo: z.string().min(2),
  nombre_lote: z.string().min(1),
  fecha_siembra: z.string(),               // ISO date
  estado: z.enum(ESTADOS).default('siembra'),
  area_hectareas: z.number().nonnegative().default(0),
  notas: z.string().optional(),
  cliente_uuid: z.string().uuid().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM cultivos
        WHERE usuario_id = $1
        ORDER BY creado_en DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = cultivoSchema.parse(req.body);
    const result = await query(
      `INSERT INTO cultivos (usuario_id, tipo, nombre_lote, fecha_siembra,
                             estado, area_hectareas, notas, cliente_uuid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (cliente_uuid) DO UPDATE
         SET tipo = EXCLUDED.tipo,
             nombre_lote = EXCLUDED.nombre_lote,
             estado = EXCLUDED.estado,
             area_hectareas = EXCLUDED.area_hectareas,
             notas = EXCLUDED.notas,
             actualizado_en = NOW()
       RETURNING *`,
      [
        req.user.id, data.tipo, data.nombre_lote, data.fecha_siembra,
        data.estado, data.area_hectareas, data.notas || null,
        data.cliente_uuid || null,
      ]
    );

    await query(
      `INSERT INTO historial (usuario_id, tipo, titulo, descripcion)
       VALUES ($1, 'cultivo', $2, $3)`,
      [
        req.user.id,
        `🌱 Cultivo registrado: ${data.nombre_lote}`,
        `${data.tipo} · ${data.area_hectareas} ha · Estado: ${data.estado}`,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM cultivos WHERE id = $1 AND usuario_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Cultivo no encontrado');
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = cultivoSchema.partial().parse(req.body);
    const campos = Object.keys(data);
    if (campos.length === 0) throw httpError(400, 'No hay campos para actualizar');

    const set = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const valores = campos.map((c) => data[c]);

    const result = await query(
      `UPDATE cultivos
          SET ${set}, actualizado_en = NOW()
        WHERE id = $${campos.length + 1}
          AND usuario_id = $${campos.length + 2}
        RETURNING *`,
      [...valores, req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Cultivo no encontrado');
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM cultivos WHERE id = $1 AND usuario_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Cultivo no encontrado');
    res.status(204).send();
  } catch (e) { next(e); }
});

router.post('/sync', async (req, res, next) => {
  try {
    const lote = z.array(cultivoSchema).parse(req.body);
    const resultados = [];
    for (const c of lote) {
      const existente = await query(
        `SELECT id FROM cultivos WHERE cliente_uuid = $1`,
        [c.cliente_uuid || null]
      );
      const esNuevo = existente.rowCount === 0;

      const r = await query(
        `INSERT INTO cultivos (usuario_id, tipo, nombre_lote, fecha_siembra,
                               estado, area_hectareas, notas, cliente_uuid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (cliente_uuid) DO UPDATE
           SET tipo = EXCLUDED.tipo,
               nombre_lote = EXCLUDED.nombre_lote,
               estado = EXCLUDED.estado,
               area_hectareas = EXCLUDED.area_hectareas,
               notas = EXCLUDED.notas,
               actualizado_en = NOW()
         RETURNING *`,
        [
          req.user.id, c.tipo, c.nombre_lote, c.fecha_siembra,
          c.estado, c.area_hectareas, c.notas || null,
          c.cliente_uuid || null,
        ]
      );
      resultados.push(r.rows[0]);

      if (esNuevo) {
        await query(
          `INSERT INTO historial (usuario_id, tipo, titulo, descripcion)
           VALUES ($1, 'cultivo', $2, $3)`,
          [
            req.user.id,
            `🌱 Cultivo registrado: ${c.nombre_lote}`,
            `${c.tipo} · ${c.area_hectareas} ha · Estado: ${c.estado}`,
          ]
        );
      }
    }
    res.json({ sincronizados: resultados.length, items: resultados });
  } catch (e) { next(e); }
});

module.exports = router;
