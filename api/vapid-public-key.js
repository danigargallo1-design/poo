/** GET /api/vapid-public-key -> { publicKey } (la clave publica NO es secreta). */
module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    res.status(500).json({ error: 'VAPID_PUBLIC_KEY no configurada' });
    return;
  }
  res.status(200).json({ publicKey });
};
