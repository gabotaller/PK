Beta ERP Académico (demo offline v0.2) — Grupo Intel / EMTEL
==========================================================

Esta es una maqueta funcional en HTML + CSS + JS (sin servidor).
Guarda la información en el navegador usando LocalStorage.

Cómo usar
1) Abre el archivo: index.html (doble click).
2) Cambia el "Rol" arriba a la derecha (simulación de permisos).
3) Los datos se guardan en el navegador.
   - Si recargas, se conserva.
   - Si haces "Reset demo", se reinicia.

Novedades v0.2 (según feedback)
- ADMIN: pantalla "Programas" para crear cursos/diplomados y versiones.
- Dashboard: contador de Programas y filtros por Programa/Grupo.
- Accesos rápidos desde Dashboard (cuando seleccionas un grupo).
- Calendario (lista por día) con filtros y vista útil para INSTRUCTOR.

Importar desde Excel
- La demo importa CSV (Excel abre y guarda CSV sin problema).
- Plantillas incluidas en la carpeta: /plantillas
  - plantilla_participantes.xlsx (para rellenar)
  - plantilla_participantes.csv (para importar)
- En la pantalla Participantes también puedes generar una plantilla rápida.

Exportar
- Participantes: exporta CSV (Excel lo abre).
- Credenciales (Moodle/Classroom): exporta CSV.
- Asistencia: exporta CSV por sesión.
- Informe mensual instructor: se abre una vista imprimible.
  Usa el botón "Guardar / Imprimir (PDF)" y elige "Guardar como PDF".

Limitaciones (intencionales)
- No hay servidor, no hay BD real, no hay multiusuario real.
- Es solo para visualizar el flujo y validar pantallas y tablas.
