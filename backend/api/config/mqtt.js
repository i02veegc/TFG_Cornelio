const mqtt = require('mqtt');

const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
let client = null;

function init() {
  if (client) return client;

  client = mqtt.connect(url, {
    clientId: `tfg-backend-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Conectado a ${url}`);
  });
  client.on('reconnect', () => {
    console.log('[MQTT] Reconectando…');
  });
  client.on('offline', () => {
    console.warn('[MQTT] Cliente offline');
  });
  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  return client;
}

/**
 * Publica un mensaje. Si el cliente aún no está conectado, lo loguea
 * y lo descarta (no bloquea el flujo HTTP). El payload se serializa a
 * JSON si es objeto; las strings se publican tal cual.
 */
function publish(topic, payload, options = {}) {
  if (!client || !client.connected) {
    console.warn(`[MQTT] No conectado, descartando publish a ${topic}`);
    return;
  }

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const opts = { qos: 1, retain: false, ...options };

  client.publish(topic, body, opts, (err) => {
    if (err) {
      console.error(`[MQTT] Error publicando en ${topic}:`, err.message);
    }
  });
}

module.exports = { init, publish };
