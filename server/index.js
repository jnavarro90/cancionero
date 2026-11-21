// Arranque, rutas de la API y archivos estáticos. Ver SPEC.md §2.1, §6.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, dirname, sep } from 'node:path';
import { HttpError, sendJson, sendError, readJson, tipoMime } from './http-utils.js';
import * as storage from './storage.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(RAIZ, 'public');
const SHARED = join(RAIZ, 'shared');

export function crearApp({ dir, puerto }) {
  const hostsPermitidos = new Set([`127.0.0.1:${puerto}`, `localhost:${puerto}`]);
  const origenesPermitidos = new Set([`http://127.0.0.1:${puerto}`, `http://localhost:${puerto}`]);

  async function api(req, res, url) {
    const [, recurso, slug, accion] = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && recurso === 'info' && !slug) {
      return sendJson(res, 200, { dir });
    }
    if (recurso !== 'canciones') throw new HttpError(404, 'Ruta no encontrada.');

    if (!slug) {
      if (req.method === 'GET') return sendJson(res, 200, await storage.listar(dir));
      if (req.method === 'POST') {
        const cuerpo = await readJson(req);
        return sendJson(res, 201, await storage.crear(dir, cuerpo.title, cuerpo.chordpro));
      }
    } else if (!accion) {
      if (req.method === 'GET') return sendJson(res, 200, await storage.leer(dir, slug));
      if (req.method === 'PUT') {
        const cuerpo = await readJson(req);
        const cabecera = req.headers['if-unmodified-since'];
        return sendJson(res, 200, await storage.guardar(dir, slug, cuerpo.chordpro, cabecera));
      }
      if (req.method === 'DELETE') {
        await storage.borrar(dir, slug);
        res.writeHead(204).end();
        return;
      }
    } else if (accion === 'duplicar' && req.method === 'POST') {
      const cuerpo = await readJson(req);
      return sendJson(res, 201, await storage.duplicar(dir, slug, cuerpo.title));
    }
    throw new HttpError(404, 'Ruta no encontrada.');
  }

  async function estatico(req, res, url) {
    const relativa = decodeURIComponent(url.pathname) === '/'
      ? '/index.html'
      : decodeURIComponent(url.pathname);
    const esShared = relativa.startsWith('/shared/');
    const raiz = esShared ? SHARED : PUBLIC;
    const sub = esShared ? relativa.slice('/shared'.length) : relativa;
    const ruta = resolve(raiz, '.' + sub);
    if (!ruta.startsWith(raiz + sep)) {
      return sendError(res, 403, 'Ruta no permitida.');
    }
    try {
      const info = await stat(ruta);
      if (!info.isFile()) throw new Error('no es archivo');
      const contenido = await readFile(ruta);
      res.writeHead(200, { 'Content-Type': tipoMime(ruta), 'Content-Length': contenido.length });
      res.end(req.method === 'HEAD' ? undefined : contenido);
    } catch {
      sendError(res, 404, 'No existe esa página.');
    }
  }

  return createServer(async (req, res) => {
    try {
      if (!hostsPermitidos.has(req.headers.host ?? '')) {
        return sendError(res, 403, 'Solo se acepta acceso desde 127.0.0.1 o localhost.');
      }
      const cambia = !['GET', 'HEAD'].includes(req.method);
      const origen = req.headers.origin;
      if (cambia && origen && !origenesPermitidos.has(origen)) {
        return sendError(res, 403, 'Origen no permitido.');
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return await estatico(req, res, url);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 409) return sendJson(res, 409, { error: err.message, ...err.extra });
        return sendError(res, err.status, err.message);
      }
      console.error(err);
      sendError(res, 500, 'Error interno del servidor.');
    }
  });
}

// Arranque directo: npm start
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 5173);
  const dir = resolve(process.env.CANCIONES_DIR ?? join(RAIZ, 'canciones'));
  await storage.asegurarDir(dir);
  const servidor = crearApp({ dir, puerto });
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${puerto} ya está ocupado. Usa otro con PORT=8080 npm start.`);
      process.exit(1);
    }
    throw err;
  });
  servidor.listen(puerto, '127.0.0.1', () => {
    console.log(`Cancionero en http://127.0.0.1:${puerto}`);
    console.log(`Carpeta de canciones: ${dir}`);
  });
}
