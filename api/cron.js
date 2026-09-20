const webpush = require('web-push');
const { getSubscriptions, deleteSubscription, hasRedis } = require('../lib/store');
const schedule = require('../data/schedule');


module.exports = async function handler(req, res) {
      const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
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
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

 const time = formatter.format(now);

const messages = schedule[time];

    if (!messages || messages.length === 0) {
      res.status(200).json({
        ok: true,
        sent: 0,
        time,
        message: 'No hay notificación programada para esta hora.',
      });
      return;
    }

    const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
}).format(now);

const executionKey = `ntd:cron:${today}:${time}`;

if (hasRedis()) {
  const check = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      'SET',
      executionKey,
      '1',
      'NX',
      'EX',
      '120',
    ]),
  });

  const result = await check.json();

  if (result.result !== 'OK') {
    res.status(200).json({
      ok: true,
      sent: 0,
      time,
      message: 'Esta notificación ya fue procesada.',
    });
    return;
  }
}

    const message = messages[Math.floor(Math.random() * messages.length)];

    const payload = JSON.stringify({
      title: 'NO TE DUERMAS',
      body: message,
      url: '/',
    });

    const subscriptions = await getSubscriptions();

    if (subscriptions.length === 0) {
      res.status(200).json({
        ok: true,
        sent: 0,
        time,
        message: 'No hay dispositivos registrados.',
      });
      return;
    }

    let sent = 0;
    let removed = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 60,
          });

          sent += 1;
        } catch (err) {
          if (
            err.statusCode === 404 ||
            err.statusCode === 410 ||
            String(err.message || '').includes(
              'p256dh value should be 65 bytes long'
            )
          ) {
            await deleteSubscription(subscription.endpoint);
            removed += 1;
          }
        }
      })
    );

    res.status(200).json({
      ok: true,
      time,
      message,
      sent,
      removed,
    });
  } catch (err) {
    res.status(500).json({
      error: String(err.message || err),
    });
  }
};