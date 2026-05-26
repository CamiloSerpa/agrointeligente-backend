const axios = require('axios');

const OPEN_METEO_URL =
  process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast';

function descripcionDeCodigo(code) {
  if ([0].includes(code)) return 'Despejado';
  if ([1, 2, 3].includes(code)) return 'Parcialmente nublado';
  if ([45, 48].includes(code)) return 'Niebla';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Llovizna';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Lluvia';
  if ([71, 73, 75, 77].includes(code)) return 'Nieve';
  if ([80, 81, 82].includes(code)) return 'Aguaceros';
  if ([95, 96, 99].includes(code)) return 'Tormenta';
  return 'Variable';
}

async function obtenerClima(lat, lng) {
  const { data } = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude: lat,
      longitude: lng,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      hourly: ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
      forecast_days: 2,
      timezone: 'auto',
    },
    timeout: 10000,
  });

  const c = data.current;
  const actual = {
    temperatura: c.temperature_2m,
    sensacion: c.apparent_temperature,
    humedad: c.relative_humidity_2m,
    probabilidad_lluvia: data.hourly?.precipitation_probability?.[0] ?? 0,
    precipitacion_mm: c.precipitation,
    viento_kmh: c.wind_speed_10m,
    descripcion: descripcionDeCodigo(c.weather_code),
    timestamp: c.time,
  };

  const pronostico = data.hourly.time.slice(0, 24).map((t, i) => ({
    hora: t,
    temperatura: data.hourly.temperature_2m[i],
    probabilidad_lluvia: data.hourly.precipitation_probability[i],
    descripcion: descripcionDeCodigo(data.hourly.weather_code[i]),
  }));

  return { actual, pronostico };
}

module.exports = { obtenerClima };
