# No te duermas — PWA con Web Push real

PWA mínima que registra el dispositivo con la Push API (VAPID) y recibe
notificaciones enviadas desde el servidor **con la app cerrada**.
Sin `setTimeout`, sin `setInterval`, sin depender de la pestaña abierta.

## Estructura

```
.
├── api/                      # Serverless Functions (Vercel, Node)
│   ├── vapid-public-key.js   # GET  -> devuelve la VAPID public key
│   ├── subscribe.js          # POST -> guarda la Push Subscription
│   └── send.js               # POST -> envía el push real (web-push + VAPID)
├── lib/
│   └── store.js              # Persistencia de suscripciones (Upstash Redis REST)
├── public/                   # Frontend estático
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js                 # Service Worker (push + notificationclick)
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── .env.example              # Variables de entorno (sin secretos)
├── .gitignore
├── package.json
└── vercel.json               # Cabeceras para /sw.js
```

## Variables de entorno

| Variable | Dónde | Secreta | Para qué |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | Vercel | No | Clave pública VAPID (se sirve al frontend) |
| `VAPID_PRIVATE_KEY` | Vercel | **Sí** | Firma los envíos push |
| `VAPID_SUBJECT` | Vercel | No | `mailto:tu@email.com` |
| `UPSTASH_REDIS_REST_URL` | Vercel | Sí | Almacén de suscripciones |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel | **Sí** | Token del almacén |
| `ADMIN_TOKEN` | Vercel | **Sí** | Opcional: protege `/api/send` (cabecera `x-admin-token`) |

Genera las claves VAPID:

```bash
npx web-push generate-vapid-keys
```

> Si defines `ADMIN_TOKEN`, el botón de prueba de la web dejará de funcionar
> (por diseño) y solo podrás enviar desde `curl` con la cabecera. Déjalo vacío
> mientras haces la demo.

## Desplegar en Vercel

1. Sube el proyecto a un repo de GitHub (el `.gitignore` ya excluye `.env`).
2. En Vercel: **Add New → Project → Import** el repo. Framework preset:
   **Other**. Sin build command; `public/` se sirve como estático y `api/`
   como funciones automáticamente.
3. Crea una base Redis: **Storage → Upstash for Redis** (las variables
   `UPSTASH_REDIS_REST_*` se añaden solas) o copia las de upstash.com.
4. **Settings → Environment Variables**: añade `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (Production + Preview).
5. **Deploy**. Vercel sirve por HTTPS, requisito para Web Push.

## Probar el push con la PWA cerrada

1. Abre la URL de Vercel en el móvil.
   - **iPhone (iOS 16.4+)**: Compartir → *Añadir a pantalla de inicio* y abre la
     app **desde el icono**. Safari no permite push fuera de la app instalada.
   - **Android/Chrome**: funciona en el navegador; instalarla es mejor.
2. Pulsa **ACTIVAR NOTIFICACIONES** y acepta el permiso.
3. **Cierra la PWA por completo** (ciérrala del multitarea).
4. Desde tu ordenador lanza el envío al servidor:

```bash
curl -X POST https://TU-PROYECTO.vercel.app/api/send \
  -H "Content-Type: application/json" \
  -d '{"title":"NO TE DUERMAS","body":"Funciona con la app cerrada"}'
# con ADMIN_TOKEN:  -H "x-admin-token: TU_TOKEN"
```

5. La notificación llega al móvil aunque la app esté cerrada. Al tocarla, el
   Service Worker abre o enfoca la PWA.

El botón **ENVIAR NOTIFICACIÓN DE PRUEBA** hace lo mismo pero con la app
abierta; sirve para comprobar el circuito rápido.

## Notas

- Si no configuras Upstash, las suscripciones se guardan en memoria y se
  pierden entre invocaciones: el `curl` posterior dirá que no hay suscripciones.
- El servidor borra automáticamente las suscripciones caducadas (404/410).
