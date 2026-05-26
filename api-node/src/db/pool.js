const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'agro',
        password: process.env.DB_PASSWORD || 'agro_pass_dev',
        database: process.env.DB_NAME || 'agrointeligente',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('[pg] Error inesperado en pool:', err);
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const ms = Date.now() - start;
  if (!isProduction) {
    console.log(`[pg] ${ms}ms — ${text.split('\n')[0].slice(0, 60)}…`);
  }
  return result;
}

module.exports = { pool, query };
