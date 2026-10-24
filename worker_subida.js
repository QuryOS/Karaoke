/**
 * Intermediario de subida (Cloudflare Worker) — PLAN B si el navegador bloquea la subida directa (CORS)
 *
 * Qué hace: recibe el archivo desde tu juego y se lo reenvía a Litterbox, devolviendo el enlace con los
 * permisos que el navegador necesita. No guarda nada.
 *
 * Cómo usarlo:
 *   1. Crea una cuenta gratuita en Cloudflare → Workers & Pages → Create → Worker.
 *   2. Pega este archivo completo, cambia ORIGEN_PERMITIDO por la dirección de tu juego y pulsa Deploy.
 *   3. En index.html agrega:  createKaraokeUI({ ..., uploadUrl: 'https://TU-WORKER.TU-USUARIO.workers.dev' })
 *
 * Nota: no está probado contra el servicio real (no tuve acceso a internet al escribirlo).
 */
const DESTINO = 'https://litterbox.catbox.moe/resources/internals/api.php';
const ORIGEN_PERMITIDO = 'https://quryos.github.io';   // solo tu juego puede usar este intermediario
const MAX_BYTES = 100 * 1024 * 1024;                    // 100 MB

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGEN_PERMITIDO,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: cors });
    if (origin !== ORIGEN_PERMITIDO) return new Response('Origen no permitido', { status: 403, headers: cors });
    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (len > MAX_BYTES) return new Response('Archivo demasiado grande', { status: 413, headers: cors });
    try {
      const r = await fetch(DESTINO, {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('Content-Type') },
        body: request.body
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors) });
    } catch (e) {
      return new Response('No se pudo contactar al servicio de archivos', { status: 502, headers: cors });
    }
  }
};
