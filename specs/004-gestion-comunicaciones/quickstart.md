# Quickstart: Gestión de Comunicaciones

1. `npm run db:migrate` (aplica 0010 y 0011). Mailpit opcional: `docker compose up -d mailpit` (UI en :8025).
2. `npm run dev`. Como Secretario/a: `/convocatorias` → «Emitir convocatoria» con aviso por correo; `/documentos` → archivar un acta y publicarla; `/comunicaciones` → registrar un oficio.
3. Como Socio: `/convocatorias`, `/documentos`, `/comunicaciones` (comunicados) y `/mensajes` → escribir al Administrador.
4. Como Administrador de la Junta: `/mensajes` → responder.
5. Pruebas: `npx vitest run` y `node scripts/e2e.mjs`.
