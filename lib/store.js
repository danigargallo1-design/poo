/**
 * Almacenamiento persistente de suscripciones Push.
 *
 * Usa Upstash Redis via su API REST (solo fetch, sin dependencias).
 * Si no hay credenciales configuradas, cae a un almacen en memoria
 * (util solo en local; en serverless NO es persistente).
 */

const URL_BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'ntd:subscriptions';

const memory = new Map();

function hasRedis() {
  return Boolean(URL_BASE && TOKEN);
}

async function redis(command) {
  const res = await fetch(URL_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.result;
}

/** Guarda (o actualiza) una suscripcion usando su endpoint como id. */
async function saveSubscription(subscription) {
  const id = subscription.endpoint;
  const value = JSON.stringify(subscription);
  if (hasRedis()) {
    await redis(['HSET', KEY, id, value]);
  } else {
    memory.set(id, value);
  }
  return id;
}

/** Devuelve todas las suscripciones guardadas. */
async function getSubscriptions() {
  if (hasRedis()) {
    const flat = (await redis(['HGETALL', KEY])) || [];
    const out = [];
    for (let i = 1; i < flat.length; i += 2) out.push(JSON.parse(flat[i]));
    return out;
  }
  return [...memory.values()].map((v) => JSON.parse(v));
}

/** Elimina una suscripcion (p. ej. cuando el push service responde 404/410). */
async function deleteSubscription(endpoint) {
  if (hasRedis()) {
    await redis(['HDEL', KEY, endpoint]);
  } else {
    memory.delete(endpoint);
  }
}

module.exports = { saveSubscription, getSubscriptions, deleteSubscription, hasRedis };
