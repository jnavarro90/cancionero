// Letra en texto plano <-> estrofas, y reasignación de acordes al editar.
// Ver SPEC.md §3.1 (editar la letra) y §7.6 (copiar acordes a todas las estrofas).

// Texto -> estrofas con palabras sin acorde. Líneas en blanco separan estrofas.
export function estrofasDesdeTexto(texto) {
  const estrofas = [];
  let lineas = [];
  for (const crudo of String(texto).replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.trim();
    if (!linea) {
      if (lineas.length) estrofas.push({ lines: lineas });
      lineas = [];
      continue;
    }
    lineas.push(linea.split(/\s+/).map((text) => ({ text, chord: null })));
  }
  if (lineas.length) estrofas.push({ lines: lineas });
  return estrofas;
}

// Estrofas -> texto plano (sin acordes).
export function textoDesdeEstrofas(estrofas) {
  return estrofas
    .map((e) => e.lines.map((l) => l.map((p) => p.text).join(' ')).join('\n'))
    .join('\n\n');
}

// Lista plana de palabras con su posición en la canción.
export function aplanar(estrofas) {
  const lista = [];
  estrofas.forEach((e, ei) => e.lines.forEach((l, li) => l.forEach((p, wi) => {
    lista.push({ ref: p, e: ei, l: li, w: wi });
  })));
  return lista;
}

// Reasigna acordes tras editar la letra, alineando palabras con LCS.
// Una palabra que se mantiene conserva su acorde; una nueva entra sin acorde.
// Devuelve { estrofas, quitados }: quitados = acordes cuyas palabras desaparecieron.
export function reasignar(estrofasViejas, textoNuevo) {
  const nuevas = estrofasDesdeTexto(textoNuevo);
  const viejas = aplanar(estrofasViejas).map((x) => x.ref);
  const nuevasPlanas = aplanar(nuevas).map((x) => x.ref);

  const pares = alineacion(viejas.map((p) => p.text), nuevasPlanas.map((p) => p.text));

  let quitados = viejas.filter((p) => p.chord).length;
  for (const [i, j] of pares) {
    nuevasPlanas[j].chord = viejas[i].chord;
    if (viejas[i].chord) quitados--;
  }
  return { estrofas: nuevas, quitados };
}

// Pares [i, j] de la subsecuencia común más larga de a y b.
function alineacion(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pares = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pares.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pares;
}

// Copia los acordes de la primera estrofa con acordes al resto (SPEC §7.6).
// Devuelve { copiados, motivo }: motivo es null, 'una-estrofa', 'sin-origen' o 'ya-tienen'.
// Modifica las estrofas en sitio.
export function copiarAcordesATodas(estrofas) {
  if (estrofas.length < 2) return { copiados: 0, motivo: 'una-estrofa' };
  const origenIdx = estrofas.findIndex((e) => e.lines.some((l) => l.some((p) => p.chord)));
  if (origenIdx < 0) return { copiados: 0, motivo: 'sin-origen' };

  const origen = estrofas[origenIdx];
  let copiados = 0;
  estrofas.forEach((destino, ei) => {
    if (ei === origenIdx) return;
    destino.lines.forEach((linea, li) => {
      const lineaOrigen = origen.lines[li];
      if (!lineaOrigen) return;
      lineaOrigen.forEach((p, wi) => {
        if (!p.chord) return;
        // Si la línea destino es más corta, el acorde va a su última palabra.
        const palabra = linea[Math.min(wi, linea.length - 1)];
        if (!palabra || palabra.chord) return; // no sobrescribir
        palabra.chord = p.chord;
        copiados++;
      });
    });
  });
  return { copiados, motivo: copiados ? null : 'ya-tienen' };
}
