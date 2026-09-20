const webpush = require('web-push');
const { getSubscriptions, deleteSubscription } = require('../lib/store');
const schedule = require('../data/schedule');

module.exports = async function handler(req, res) {
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
const requestedTime = req.query && req.query.test;

const targetTime = requestedTime || time;

const messages = schedule[targetTime];

    if (!messages || messages.length === 0) {
      res.status(200).json({
        ok: true,
        sent: 0,
        time,
        message: 'No hay notificación programada para esta hora.',
      });
      return;
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