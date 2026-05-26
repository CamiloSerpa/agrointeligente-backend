require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, query } = require('./pool');

async function seed() {
  console.log('🌱 Iniciando seed de datos demo…');

  const passwordHash = await bcrypt.hash('demo1234', 10);

  await query(
    `INSERT INTO usuarios (id, email, password_hash, nombre, telefono,
                          ubicacion_lat, ubicacion_lng, ubicacion_texto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash`,
    [
      '11111111-1111-1111-1111-111111111111',
      'demo@agro.co',
      passwordHash,
      'José Martínez',
      '+57 300 1234567',
      11.2408,
      -74.1990,
      'Santa Marta, Magdalena',
    ]
  );
  console.log('✓ Usuario demo creado (email: demo@agro.co, password: demo1234)');

  const cultivos = [
    {
      id: '22222222-2222-2222-2222-222222222222',
      tipo: 'maiz',
      nombre_lote: 'Lote 3 - Vega',
      dias_atras: 8,
      estado: 'germinacion',
      area: 1.0,
      notas: 'Suelo arcilloso, fertilización base aplicada',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      tipo: 'cafe',
      nombre_lote: 'Lote 1 - Ladera',
      dias_atras: 120,
      estado: 'floracion',
      area: 1.5,
      notas: 'Café variedad Castillo',
    },
  ];

  for (const c of cultivos) {
    await query(
      `INSERT INTO cultivos (id, usuario_id, tipo, nombre_lote, fecha_siembra,
                             estado, area_hectareas, notas)
       VALUES ($1, $2, $3, $4, CURRENT_DATE - ($5::int * INTERVAL '1 day'),
               $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        '11111111-1111-1111-1111-111111111111',
        c.tipo,
        c.nombre_lote,
        c.dias_atras,
        c.estado,
        c.area,
        c.notas,
      ]
    );
  }
  console.log(`✓ ${cultivos.length} cultivos de ejemplo creados`);

  await query(
    `INSERT INTO historial (usuario_id, tipo, titulo, descripcion, fecha)
     VALUES
       ($1, 'cultivo', '🌱 Siembra completada',
        'Lote 3 preparado · 2 días de trabajo', NOW() - INTERVAL '5 days'),
       ($1, 'clima', '☀️ Día soleado',
        'Máx 32° · Mín 22° · Sin precipitación', NOW() - INTERVAL '2 days')
     ON CONFLICT DO NOTHING`,
    ['11111111-1111-1111-1111-111111111111']
  );
  console.log('✓ Historial inicial creado');

  console.log('\n🎉 Seed completado. Puedes iniciar sesión con:');
  console.log('   Email:    demo@agro.co');
  console.log('   Password: demo1234\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
