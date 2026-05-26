require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
 
const authRoutes = require('./routes/auth.routes.js');
const cultivosRoutes = require('./routes/cultivos.routes.js');
const climaRoutes = require('./routes/clima.routes.js');
const alertasRoutes = require('./routes/alertas.routes.js');
const recomendacionesRoutes = require('./routes/recomendaciones.routes.js');
const historialRoutes = require('./routes/historial.routes.js');
const { errorHandler } = require('./middleware/error.js');

 
const app = express();
const PORT = process.env.PORT || 3000;
 
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
 
app.options('*', cors());
 
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
 
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'api-node',
    timestamp: new Date().toISOString(),
  });
});
 
app.use('/api/auth', authRoutes);
app.use('/api/cultivos', cultivosRoutes);
app.use('/api/clima', climaRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/recomendaciones', recomendacionesRoutes);
app.use('/api/historial', historialRoutes);
 
app.use(errorHandler);
 
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌱 API AgroInteligente corriendo en http://0.0.0.0:${PORT}`);

  if (process.env.RUN_WORKER === 'true') {
    const { fork } = require('node:child_process');
    const path = require('node:path');
    const worker = fork(path.join(__dirname, 'workers/alertas-worker.js'));
    console.log(`   Worker de alertas iniciado (PID ${worker.pid})`);
    process.on('SIGTERM', () => {
      worker.kill('SIGTERM');
      process.exit(0);
    });
  }
});