const { saveSubscription, hasRedis } = require('../lib/store');

/** POST /api/subscribe  body: PushSubscription JSON */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body && body.subscription ? body.subscription : body;

    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      res.status(400).json({ error: 'Suscripcion invalida' });
      return;
    }

    await saveSubscription(sub);
    res.status(201).json({ ok: true, persistent: hasRedis() });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
