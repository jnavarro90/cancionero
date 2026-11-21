# Cancionero

Web local para escribir letras, poner acordes encima de las palabras, guardar cada canción como un archivo `.chordpro` y exportarla a PDF. Sin base de datos y sin internet.

> **Estado:** solo especificación. Todavía no hay código.

## Qué hay en el repo

| Archivo | Qué es |
|---|---|
| [`SPEC.md`](SPEC.md) | Especificación completa de la versión 1: tecnología, formato de archivos, API local, interfaz, diseño, PDF, pruebas y criterios de aceptación |
| [`docs/prototipo.html`](docs/prototipo.html) | Prototipo funcional en un solo archivo. Ábrelo en el navegador para ver el comportamiento esperado (guarda en el navegador, no en archivos) |
| [`docs/pdf-ejemplo.png`](docs/pdf-ejemplo.png) | Cómo tiene que quedar el PDF |
| [`canciones/ejemplo-noche-de-paz.chordpro`](canciones/ejemplo-noche-de-paz.chordpro) | Canción de ejemplo en el formato de archivo definido (letra de dominio público) |

## Resumen

- **Servidor:** Node.js ≥ 20 sin dependencias, solo en `127.0.0.1`.
- **Frontend:** HTML, CSS y JavaScript sin framework ni compilación.
- **Datos:** un archivo ChordPro por canción en `./canciones` (configurable con `CANCIONES_DIR`).
- **PDF:** generado en el navegador con jsPDF incluido en el repo.

Cuando esté hecho:

```bash
npm start   # http://127.0.0.1:5173
npm test
```

## Letras

No subas letras con derechos de autor al repo. La carpeta `canciones/` está ignorada por git, salvo el ejemplo.
