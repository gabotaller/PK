# PK - ERP académico (demo HTML/CSS/JS)

Este repositorio ahora modela un **ERP académico** orientado a programas, ediciones, sesiones, alumnos, notas, pagos e informes docentes.

## Qué incluye este demo

- Frontend estático sin backend (`index.html`, `styles.css`, `app.js`).
- Módulos de ejemplo que reflejan tu flujo real.
- Configuración en un solo archivo (`ERP_CONFIG` en `app.js`) para cambiar estructura de tablas rápidamente.
- Bitácora de cambios (crear/ocultar) y borrado lógico (no elimina registros).

## Roles de usuario considerados

- Administrador
- Docente
- Alumno
- Asesor

En la cabecera puedes cambiar el usuario activo para simular permisos (por ahora Admin y Asesor editan; Docente/Alumno solo lectura).

## Módulos modelados

1. **Usuarios**
2. **Programas** (tipo: diplomado/curso/curso extensivo/otro)
3. **Ediciones de programa** (nombre elegido para evitar confusión con “variante”)
4. **Horarios** (varios horarios por edición)
5. **Módulos**
6. **Sesiones** (fecha + URL Zoom o ubicación)
7. **Alumnos**
8. **Matrículas**
9. **Asistencias por sesión**
10. **Notas** (actividades + examen + promedio)
11. **Pagos** (mensualidad/adelantado + descuento)
12. **Informes docentes**
13. **Bitácora de cambios**

## Cómo cambiar la estructura de tablas

Toda la estructura vive en `ERP_CONFIG.modules`.

Cada módulo define:

- `key`, `title`, `description`
- `columns`: campos (text, number, date, time, select, relation)
- `seedData`: datos iniciales
- `softDeleteField` + `softDeleteValue` para ocultar en lugar de eliminar

### Campos relacionales

Usa `type: "relation"` cuando un módulo dependa de otro:

```js
{
  field: "programaId",
  label: "Programa",
  type: "relation",
  relation: { moduleKey: "programas", valueField: "id", labelField: "nombre" }
}
```

## Ejecutar localmente

```bash
python3 -m http.server 8080
```

Abrir: `http://localhost:8080`

## Publicar para previsualizar (GitHub Pages)

1. Sube el proyecto a GitHub.
2. En tu repo: **Settings → Pages**.
3. En **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` (o la principal), carpeta `/ (root)`
4. Guarda y espera 1-2 minutos.
5. URL final: `https://TU-USUARIO.github.io/NOMBRE-REPO/`

## Siguiente paso recomendado

Cuando me compartas el formato exacto del **informe docente**, lo convertimos en una vista/generador automático dentro del módulo `informesDocentes`.
