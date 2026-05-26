const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authMiddleware, signToken } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  nombre: z.string().min(2, 'Nombre demasiado corto'),
  telefono: z.string().optional(),
  ubicacion_lat: z.number().optional(),
  ubicacion_lng: z.number().optional(),
  ubicacion_texto: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 10);

    const existe = await query('SELECT id FROM usuarios WHERE email = $1', [data.email]);
    if (existe.rowCount > 0) {
      throw httpError(409, 'Ya existe una cuenta con ese correo');
    }

    const result = await query(
      `INSERT INTO usuarios (email, password_hash, nombre, telefono,
                             ubicacion_lat, ubicacion_lng, ubicacion_texto)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, nombre, telefono, ubicacion_lat, ubicacion_lng,
                 ubicacion_texto, creado_en`,
      [
        data.email,
        hash,
        data.nombre,
        data.telefono || null,
        data.ubicacion_lat || null,
        data.ubicacion_lng || null,
        data.ubicacion_texto || null,
      ]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await query(
      `SELECT id, email, password_hash, nombre, telefono,
              ubicacion_lat, ubicacion_lng, ubicacion_texto
         FROM usuarios WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) {
      throw httpError(401, 'Credenciales incorrectas');
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw httpError(401, 'Credenciales incorrectas');

    delete user.password_hash;
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const updateSchema = z.object({
      nombre: z.string().min(2).optional(),
      telefono: z.string().optional(),
      ubicacion_lat: z.number().optional(),
      ubicacion_lng: z.number().optional(),
      ubicacion_texto: z.string().optional(),
    });
    const data = updateSchema.parse(req.body);
    const campos = Object.keys(data);
    if (campos.length === 0) throw httpError(400, 'No hay campos para actualizar');

    const set = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const valores = campos.map((c) => data[c]);

    const result = await query(
      `UPDATE usuarios
          SET ${set}, actualizado_en = NOW()
        WHERE id = $${campos.length + 1}
        RETURNING id, email, nombre, telefono, ubicacion_lat, ubicacion_lng,
                  ubicacion_texto, creado_en`,
      [...valores, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Usuario no encontrado');
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, nombre, telefono, ubicacion_lat, ubicacion_lng,
              ubicacion_texto, creado_en
         FROM usuarios WHERE id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, 'Usuario no encontrado');
    res.json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
