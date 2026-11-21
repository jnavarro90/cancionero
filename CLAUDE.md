# Cancionero: instrucciones para Claude

Web local para escribir letras con acordes, guardar cada canción como `.chordpro` en disco y exportar a PDF.

## Estado

Solo hay especificación y prototipo. Todavía no hay `package.json` ni código de servidor o frontend. Antes de programar, lee [`SPEC.md`](SPEC.md) completo.

## Fuentes de verdad

- `SPEC.md` manda sobre todo lo demás. Si el prototipo (`docs/prototipo.html`) y la especificación no coinciden, sigue la especificación y avísame de la diferencia.
- `docs/pdf-ejemplo.png` es la referencia visual del PDF.
- El orden de trabajo está en `SPEC.md` §13. Sigue ese orden salvo que te pida otra cosa.

## Restricciones no negociables

- **Cero dependencias de producción.** El servidor usa solo `node:http`. Solo se permite `@playwright/test` como dependencia de desarrollo opcional. No añadir frameworks ni paso de compilación en el frontend.
- **Sin internet en tiempo de ejecución.** jsPDF, Kalam y Atkinson Hyperlegible se sirven desde el propio repo (`public/vendor/`, `public/fonts/`). Nada de CDN.
- **Servidor solo en `127.0.0.1`**, nunca en `0.0.0.0`. Validar `Host` y `Origin` en peticiones que cambian datos (`SPEC.md` §6).
- **Sin base de datos.** Las canciones son archivos `canciones/<slug>.chordpro`.
- **No servir nada fuera de `public/` y `shared/`.** Comprobar la ruta final con `path.resolve`.
- **Acordes siempre en notación inglesa dentro del archivo.** La notación ES/EN es solo de pantalla.
- **Escritura atómica** (`.tmp` + `rename`) y control de conflictos con `If-Unmodified-Since` (409).
- **Interfaz en español.** No usar `alert`, `confirm` ni `prompt`: los avisos van en la píldora de `SPEC.md` §7.10 y los diálogos son propios.
- **Letras con derechos de autor fuera del repo.** `canciones/` está en `.gitignore` salvo el ejemplo de dominio público.

## Convenciones

- Código que usan servidor y navegador va en `shared/` (ES modules). El servidor lo sirve en `/shared/`.
- Lógica pura (`chords`, `chordpro`, `stanzas`, `suggest`, `slug`, `storage`) con tests en `test/` usando `node:test` y `node:assert`.
- Cada módulo de `shared/` y `server/` tiene su test correspondiente. Nada de tests de UI obligatorios; Playwright es opcional.
- Los nombres de dominio (`chordpro`, `slug`, `stanza`) van en inglés, como en la especificación. El texto visible va en español.

## Comandos (cuando existan)

```bash
npm start      # http://127.0.0.1:5173
npm run dev    # igual, con node --watch
npm test       # tests unitarios (obligatorio en verde)
```

## Git

- Rama principal: `main`.
- No hacer commit ni push sin que yo lo pida.
- No tocar `canciones/` con letras reales: solo el ejemplo versionado.
