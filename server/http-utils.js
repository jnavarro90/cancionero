// Utilidades HTTP: JSON, errores en español, límite de tamaño y tipos MIME.

export class HttpError extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

export function sendJson(res, status, cuerpo) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  });
  res.end(texto);
}

export function sendError(res, status, mensaje, extra = {}) {
  sendJson(res, status, { error: mensaje, ...extra });
}

export function readBody(req, limite) {
  return new Promise((resolver, rechazar) => {
    const trozos = [];
    let total = 0;
    req.on('data', (t) => {
      total += t.length;
      if (total > limite) {
        rechazar(new HttpError(413, 'La canción es demasiado grande (máximo 200 KB).'));
        req.destroy();
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => resolver(Buffer.concat(trozos).toString('utf8')));
    req.on('error', rechazar);
  });
}

export async function readJson(req, limite = 300 * 1024) {
  const texto = await readBody(req, limite);
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición no es JSON válido.');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

export function tipoMime(ruta) {
  const i = ruta.lastIndexOf('.');
  return MIME[i >= 0 ? ruta.slice(i).toLowerCase() : ''] ?? 'application/octet-stream';
}
