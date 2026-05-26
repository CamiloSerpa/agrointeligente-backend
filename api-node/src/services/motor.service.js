const axios = require('axios');

const MOTOR_URL = process.env.PYTHON_ENGINE_URL || 'http://motor:8000';

const cliente = axios.create({
  baseURL: MOTOR_URL,
  timeout: 15000,
});

async function solicitarAnalisis(usuarioId, cultivoId) {
  const { data } = await cliente.post('/analizar', {
    usuario_id: usuarioId,
    cultivo_id: cultivoId,
  });
  return data;
}

async function ping() {
  try {
    const { data } = await cliente.get('/health');
    return data;
  } catch {
    return null;
  }
}

module.exports = { solicitarAnalisis, ping };
