/* Frontend: registra el Service Worker, pide permiso y crea la Push Subscription. */

const enableBtn = document.getElementById('enable');
const testBtn = document.getElementById('test');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', Boolean(isError));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

async function getPublicKey() {
  const res = await fetch('/api/vapid-public-key');
  if (!res.ok) throw new Error('No se pudo obtener la clave publica VAPID');
  const { publicKey } = await res.json();
  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY no configurada en el servidor');
  return publicKey;
}

async function saveSubscription(subscription) {
  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al guardar');
  return res.json();
}

async function enableNotifications() {
  if (!supported()) {
    setStatus(
      'Este navegador no soporta Web Push. En iPhone: añade la app a la pantalla de inicio y ábrela desde ahí.',
      true
    );
    return;
  }

  enableBtn.disabled = true;
  setStatus('Registrando Service Worker…');

  try {
    const registration = await registerServiceWorker();

    setStatus('Pidiendo permiso de notificaciones…');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('Permiso denegado. Actívalo en los ajustes del navegador.', true);
      enableBtn.disabled = false;
      return;
    }

    setStatus('Creando suscripción push…');
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(await getPublicKey()),
      }));

    await saveSubscription(subscription.toJSON());

    testBtn.disabled = false;
    enableBtn.textContent = 'NOTIFICACIONES ACTIVADAS';
    setStatus('Dispositivo registrado. Ya puedes cerrar la app y recibir notificaciones.');
  } catch (err) {
    enableBtn.disabled = false;
    setStatus(`Error: ${err.message || err}`, true);
  }
}

async function sendTest() {
  testBtn.disabled = true;
  setStatus('Pidiendo al servidor que envíe la notificación…');
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription ? subscription.endpoint : undefined,
        title: 'NO TE DUERMAS',
        body: 'Push real enviado desde el servidor.',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al enviar');
    setStatus(`Enviada. Notificaciones entregadas: ${data.sent}.`);
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, true);
  } finally {
    testBtn.disabled = false;
  }
}

async function init() {
  if (!supported()) {
    setStatus('Este navegador no soporta Web Push.', true);
    enableBtn.disabled = true;
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (registration && Notification.permission === 'granted') {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      testBtn.disabled = false;
      enableBtn.textContent = 'NOTIFICACIONES ACTIVADAS';
      setStatus('Dispositivo ya registrado.');
    }
  }
}

enableBtn.addEventListener('click', enableNotifications);
testBtn.addEventListener('click', sendTest);
init();
