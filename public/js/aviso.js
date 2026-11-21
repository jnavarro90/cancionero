// Avisos en píldora (SPEC §7.8). Nunca alert, confirm ni prompt.
// Lo usan biblioteca.js y editor.js.
let temporizador = null;

export function aviso(texto, ms = 1800) {
  let el = document.getElementById('aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso';
    el.className = 'aviso-pildora';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.hidden = true; }, ms);
}

// «editada hace 5 min», en español.
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
export function hace(isoFecha) {
  const seg = (Date.parse(isoFecha) - Date.now()) / 1000;
  const abs = Math.abs(seg);
  if (abs < 45) return 'hace un momento';
  const [unidad, div] = abs < 3600 ? ['minute', 60]
    : abs < 86400 ? ['hour', 3600]
      : abs < 2592000 ? ['day', 86400]
        : ['month', 2592000];
  return rtf.format(Math.round(seg / div), unidad);
}
