// Llamadas al servidor local. Ver SPEC.md §6.

async function pedir(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(datos.error ?? `Error ${res.status}`);
    err.status = res.status;
    err.datos = datos;
    throw err;
  }
  return datos;
}

const ruta = (slug, accion = '') => `/api/canciones/${encodeURIComponent(slug)}${accion}`;

export const api = {
  info: () => pedir('/api/info'),
  listar: () => pedir('/api/canciones'),
  leer: (slug) => pedir(ruta(slug)),
  crear: (title) => pedir('/api/canciones', { method: 'POST', body: JSON.stringify({ title }) }),
  guardar: (slug, chordpro, updatedAt) => pedir(ruta(slug), {
    method: 'PUT',
    headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : {},
    body: JSON.stringify({ chordpro }),
  }),
  duplicar: (slug, title) => pedir(ruta(slug, '/duplicar'), {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),
  borrar: (slug) => pedir(ruta(slug), { method: 'DELETE' }),
};
