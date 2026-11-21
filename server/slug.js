// Nombres de archivo seguros. Ver SPEC.md §5.1.

export const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Título -> slug: sin tildes, minúsculas, guiones. Máximo 60 caracteres.
export function slugificar(titulo) {
  const base = String(titulo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'cancion';
}

// Primer slug libre a partir de base: base, base-2, base-3…
export function slugLibre(base, existe) {
  let candidato = base;
  for (let n = 2; existe(candidato); n++) {
    candidato = `${base}-${n}`;
  }
  return candidato;
}
