const webpush = require('web-push');
const { getSubscriptions, deleteSubscription } = require('../lib/store');

/**
 * POST /api/send
 * Envia una notificacion Push real a las suscripciones registradas.
 * Funciona con la PWA cerrada: el push service entrega al Service Worker.
 *
 * body opcional: { title, body, url, endpoint }
 * Si ADMIN_TOKEN esta definido, exige cabecera x-admin-token.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && req.headers['x-admin-token'] !== adminToken) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: 'Claves VAPID no configuradas' });
    return;
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};

    const payload = JSON.stringify({
      title: body.title || 'NO TE DUERMAS',
      body: body.body || 'Notificacion de prueba enviada desde el servidor.',
      url: body.url || '/',
    });

    let subs = await getSubscriptions();
    if (body.endpoint) subs = subs.filter((s) => s.endpoint === body.endpoint);

    if (subs.length === 0) {
      res.status(404).json({ error: 'No hay suscripciones registradas' });
      return;
    }

    let sent = 0;
    let removed = 0;
    const errors = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload, { TTL: 60 });
          sent += 1;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await deleteSubscription(sub.endpoint);
            removed += 1;
          } else {
            errors.push(err.statusCode ? `${err.statusCode}: ${err.body}` : String(err));
          }
        }
      })
    );

    res.status(200).json({ ok: true, sent, removed, errors });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
