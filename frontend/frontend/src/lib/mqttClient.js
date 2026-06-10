'use client';
import mqtt from 'mqtt';

// Cliente MQTT singleton para el navegador (vía WebSockets).
// Se conecta perezosamente la primera vez que alguien se suscribe a eventos.

const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL || 'ws://localhost:9001';

let client = null;
const listeners = new Set();
const statusListeners = new Set();
const espListeners = new Set();

function notifyStatus(online) {
  statusListeners.forEach((cb) => { try { cb(online); } catch {} });
}

function ensureClient() {
  if (typeof window === 'undefined') return null; // protección SSR
  if (client) return client;

  client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clientId: `tfg-web-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on('connect', () => {
    console.log('[MQTT-WS] Conectado a', MQTT_URL);
    client.subscribe('obras/+/vendido', (err) => {
      if (err) console.error('[MQTT-WS] Error al suscribir obras:', err);
    });
    client.subscribe('dispositivos/+/status', (err) => {
      if (err) console.error('[MQTT-WS] Error al suscribir dispositivos:', err);
    });
    notifyStatus(true);
  });

  client.on('message', (topic, payload) => {
    // Ventas en vivo
    const saleMatch = topic.match(/^obras\/(\d+)\/vendido$/);
    if (saleMatch) {
      const obraId = parseInt(saleMatch[1], 10);
      let data = {};
      try { data = JSON.parse(payload.toString()); } catch {}
      const event = { type: 'sale', obraId, ...data };
      listeners.forEach((cb) => { try { cb(event); } catch (e) { console.error('[MQTT-WS] Error en listener:', e); } });
      return;
    }

    // Presencia del microcontrolador
    const espMatch = topic.match(/^dispositivos\/(.+)\/status$/);
    if (espMatch) {
      let data = {};
      try { data = JSON.parse(payload.toString()); } catch {}
      const online = data.online ?? false;
      espListeners.forEach((cb) => { try { cb(online); } catch {} });
    }
  });

  client.on('error', (err) => console.error('[MQTT-WS] Error:', err.message));
  client.on('reconnect', () => console.log('[MQTT-WS] Reconectando…'));
  client.on('offline', () => {
    console.warn('[MQTT-WS] Offline');
    notifyStatus(false);
  });

  return client;
}

export function subscribeMqttEvents(callback) {
  if (typeof window === 'undefined') return () => {};
  listeners.add(callback);
  ensureClient();
  return () => listeners.delete(callback);
}

export function onMqttStatus(callback) {
  if (typeof window === 'undefined') return () => {};
  statusListeners.add(callback);
  const c = ensureClient();
  if (c) callback(c.connected); // notificar estado actual al suscribirse
  return () => statusListeners.delete(callback);
}

export function onEspStatus(callback) {
  if (typeof window === 'undefined') return () => {};
  espListeners.add(callback);
  ensureClient();
  return () => espListeners.delete(callback);
}
