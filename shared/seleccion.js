// Selección de acordes para borrar varios a la vez (SPEC §7.2, modo selección).
// Trabaja con posiciones «ei,li,wi» en el orden en que aparecen en la canción.

// Posiciones entre `desde` y `hasta` (ambas incluidas), en el orden de `posiciones`.
// Si alguna no está en la lista, solo se devuelve `hasta`.
export function rangoEntre(posiciones, desde, hasta) {
  const a = posiciones.indexOf(desde);
  const b = posiciones.indexOf(hasta);
  if (a < 0 || b < 0) return [hasta];
  return posiciones.slice(Math.min(a, b), Math.max(a, b) + 1);
}
