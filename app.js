const ERP_CONFIG = {
  roles: {
    admin: { label: "Administrador", canEdit: true },
    docente: { label: "Docente", canEdit: false },
    alumno: { label: "Alumno", canEdit: false },
    asesor: { label: "Asesor", canEdit: true },
  },
  modules: [
    {
      key: "usuarios",
      title: "Usuarios",
      description: "Usuarios base del sistema (admin, docente, alumno, asesor).",
      softDeleteField: "estado",
      softDeleteValue: "Inactivo",
      columns: [
        { field: "correo", label: "Correo", type: "email", required: true },
        { field: "password", label: "Contraseña", type: "text", required: true },
        {
          field: "rol",
          label: "Rol",
          type: "select",
          required: true,
          options: ["Administrador", "Docente", "Alumno", "Asesor"],
        },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Inactivo"],
        },
      ],
      seedData: [
        {
          id: "USR-1",
          correo: "admin@pk.com",
          password: "admin123",
          rol: "Administrador",
          estado: "Activo",
        },
        {
          id: "USR-2",
          correo: "docente@pk.com",
          password: "doc123",
          rol: "Docente",
          estado: "Activo",
        },
      ],
    },
    {
      key: "programas",
      title: "Programas",
      description: "Catálogo principal: diplomados, cursos, extensivos u otros.",
      softDeleteField: "estado",
      softDeleteValue: "Inactivo",
      columns: [
        {
          field: "tipo",
          label: "Tipo",
          type: "select",
          required: true,
          options: ["Diplomado", "Curso", "Curso extensivo", "Otro"],
        },
        { field: "nombre", label: "Nombre", type: "text", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Inactivo"],
        },
      ],
      seedData: [
        {
          id: "PRG-1",
          tipo: "Diplomado",
          nombre: "Diplomado en Gestión Educativa",
          estado: "Activo",
        },
        { id: "PRG-2", tipo: "Curso", nombre: "Curso de Excel", estado: "Activo" },
      ],
    },
    {
      key: "ediciones",
      title: "Ediciones de programa",
      description:
        "Reemplaza el concepto ambiguo de variante: cada edición depende de un programa y tiene sufijo como G1/G2.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "programaId",
          label: "Programa",
          type: "relation",
          required: true,
          relation: { moduleKey: "programas", valueField: "id", labelField: "nombre" },
        },
        { field: "sufijo", label: "Sufijo", type: "text", required: true },
        {
          field: "modalidad",
          label: "Modalidad",
          type: "select",
          required: true,
          options: ["Virtual", "Presencial"],
        },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Oculto"],
        },
      ],
      seedData: [
        {
          id: "EDI-1",
          programaId: "PRG-1",
          sufijo: "G1",
          modalidad: "Virtual",
          estado: "Activo",
        },
      ],
    },
    {
      key: "horarios",
      title: "Horarios",
      description: "Múltiples horarios por edición (inicio/fin), normalmente bloques de 2 horas.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "edicionId",
          label: "Edición",
          type: "relation",
          required: true,
          relation: { moduleKey: "ediciones", valueField: "id", labelField: "sufijo" },
        },
        { field: "horaInicio", label: "Hora inicio", type: "time", required: true },
        { field: "horaFin", label: "Hora fin", type: "time", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Oculto"],
        },
      ],
      seedData: [
        { id: "HOR-1", edicionId: "EDI-1", horaInicio: "18:00", horaFin: "20:00", estado: "Activo" },
      ],
    },
    {
      key: "modulos",
      title: "Módulos",
      description: "Módulos por edición; cada módulo puede tener varias sesiones y actividades evaluables.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "edicionId",
          label: "Edición",
          type: "relation",
          required: true,
          relation: { moduleKey: "ediciones", valueField: "id", labelField: "sufijo" },
        },
        { field: "nombre", label: "Nombre módulo", type: "text", required: true },
        { field: "numeroSesiones", label: "N° sesiones", type: "number", required: true },
        { field: "numeroActividades", label: "N° actividades", type: "number", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Oculto"],
        },
      ],
      seedData: [
        {
          id: "MOD-1",
          edicionId: "EDI-1",
          nombre: "Planificación Académica",
          numeroSesiones: 4,
          numeroActividades: 2,
          estado: "Activo",
        },
      ],
    },
    {
      key: "sesiones",
      title: "Sesiones",
      description:
        "Cada módulo contiene sesiones programadas con fecha y soporte virtual (URL) o presencial (ubicación).",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "moduloId",
          label: "Módulo",
          type: "relation",
          required: true,
          relation: { moduleKey: "modulos", valueField: "id", labelField: "nombre" },
        },
        { field: "nombre", label: "Nombre sesión", type: "text", required: true },
        { field: "fecha", label: "Fecha", type: "date", required: true },
        { field: "urlZoom", label: "URL Zoom", type: "text", required: false },
        { field: "ubicacion", label: "Ubicación", type: "text", required: false },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Programada", "Ejecutada", "Oculto"],
        },
      ],
      seedData: [
        {
          id: "SES-1",
          moduloId: "MOD-1",
          nombre: "Sesión 1",
          fecha: "2026-03-10",
          urlZoom: "https://zoom.us/j/123",
          ubicacion: "",
          estado: "Programada",
        },
      ],
    },
    {
      key: "alumnos",
      title: "Participantes / Alumnos",
      description: "Ficha del alumno y credenciales opcionales para diplomados.",
      softDeleteField: "estado",
      softDeleteValue: "Inactivo",
      columns: [
        { field: "dni", label: "DNI", type: "text", required: true },
        { field: "nombres", label: "Nombres", type: "text", required: true },
        { field: "apellidos", label: "Apellidos", type: "text", required: true },
        { field: "correo", label: "Correo", type: "email", required: true },
        { field: "usuario", label: "Usuario plataforma", type: "text", required: false },
        { field: "password", label: "Contraseña", type: "text", required: false },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Inactivo"],
        },
      ],
      seedData: [
        {
          id: "ALU-1",
          dni: "74321987",
          nombres: "Carla",
          apellidos: "Ríos",
          correo: "carla@correo.com",
          usuario: "carla.rios",
          password: "temp123",
          estado: "Activo",
        },
      ],
    },
    {
      key: "matriculas",
      title: "Matrículas",
      description: "Vínculo alumno-edición para controlar asistencia, notas y pagos.",
      softDeleteField: "estado",
      softDeleteValue: "Retirado",
      columns: [
        {
          field: "alumnoId",
          label: "Alumno",
          type: "relation",
          required: true,
          relation: { moduleKey: "alumnos", valueField: "id", labelField: "apellidos" },
        },
        {
          field: "edicionId",
          label: "Edición",
          type: "relation",
          required: true,
          relation: { moduleKey: "ediciones", valueField: "id", labelField: "sufijo" },
        },
        { field: "fechaMatricula", label: "Fecha", type: "date", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Matriculado", "Retirado"],
        },
      ],
      seedData: [
        {
          id: "MAT-1",
          alumnoId: "ALU-1",
          edicionId: "EDI-1",
          fechaMatricula: "2026-03-02",
          estado: "Matriculado",
        },
      ],
    },
    {
      key: "asistencias",
      title: "Asistencia por sesión",
      description: "Control de asistencia por sesión para cada alumno matriculado.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "sesionId",
          label: "Sesión",
          type: "relation",
          required: true,
          relation: { moduleKey: "sesiones", valueField: "id", labelField: "nombre" },
        },
        {
          field: "alumnoId",
          label: "Alumno",
          type: "relation",
          required: true,
          relation: { moduleKey: "alumnos", valueField: "id", labelField: "apellidos" },
        },
        {
          field: "asistencia",
          label: "Asistencia",
          type: "select",
          required: true,
          options: ["Asistió", "Falta", "Tardanza"],
        },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Oculto"],
        },
      ],
      seedData: [
        { id: "ASI-1", sesionId: "SES-1", alumnoId: "ALU-1", asistencia: "Asistió", estado: "Activo" },
      ],
    },
    {
      key: "notas",
      title: "Notas",
      description: "Notas por alumno: examen final + actividades por módulo + promedio.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "alumnoId",
          label: "Alumno",
          type: "relation",
          required: true,
          relation: { moduleKey: "alumnos", valueField: "id", labelField: "apellidos" },
        },
        {
          field: "moduloId",
          label: "Módulo",
          type: "relation",
          required: true,
          relation: { moduleKey: "modulos", valueField: "id", labelField: "nombre" },
        },
        { field: "actividad1", label: "Actividad 1", type: "number", required: true },
        { field: "actividad2", label: "Actividad 2", type: "number", required: false },
        { field: "examenFinal", label: "Examen final", type: "number", required: true },
        { field: "promedio", label: "Promedio", type: "number", required: false, readonly: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Activo", "Oculto"],
        },
      ],
      seedData: [
        {
          id: "NOT-1",
          alumnoId: "ALU-1",
          moduloId: "MOD-1",
          actividad1: 16,
          actividad2: 17,
          examenFinal: 15,
          promedio: 16,
          estado: "Activo",
        },
      ],
    },
    {
      key: "pagos",
      title: "Pagos",
      description: "Control de mensualidades, pagos adelantados y descuentos.",
      softDeleteField: "estado",
      softDeleteValue: "Anulado",
      columns: [
        {
          field: "matriculaId",
          label: "Matrícula",
          type: "relation",
          required: true,
          relation: { moduleKey: "matriculas", valueField: "id", labelField: "id" },
        },
        {
          field: "tipoPago",
          label: "Tipo de pago",
          type: "select",
          required: true,
          options: ["Mensualidad", "Adelantado"],
        },
        { field: "monto", label: "Monto", type: "number", required: true },
        { field: "descuento", label: "Descuento", type: "number", required: false },
        { field: "fechaPago", label: "Fecha pago", type: "date", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Pagado", "Pendiente", "Anulado"],
        },
      ],
      seedData: [
        {
          id: "PAG-1",
          matriculaId: "MAT-1",
          tipoPago: "Mensualidad",
          monto: 450,
          descuento: 0,
          fechaPago: "2026-03-03",
          estado: "Pagado",
        },
      ],
    },
    {
      key: "informesDocentes",
      title: "Informes docentes",
      description: "Un informe por docente y edición dictada.",
      softDeleteField: "estado",
      softDeleteValue: "Oculto",
      columns: [
        {
          field: "docenteId",
          label: "Docente",
          type: "relation",
          required: true,
          relation: { moduleKey: "usuarios", valueField: "id", labelField: "correo" },
        },
        {
          field: "edicionId",
          label: "Edición",
          type: "relation",
          required: true,
          relation: { moduleKey: "ediciones", valueField: "id", labelField: "sufijo" },
        },
        { field: "resumen", label: "Resumen", type: "text", required: true },
        {
          field: "estado",
          label: "Estado",
          type: "select",
          required: true,
          options: ["Borrador", "Enviado", "Oculto"],
        },
      ],
      seedData: [
        {
          id: "INF-1",
          docenteId: "USR-2",
          edicionId: "EDI-1",
          resumen: "Cobertura completa del módulo 1.",
          estado: "Borrador",
        },
      ],
    },
    {
      key: "bitacora",
      title: "Bitácora de cambios",
      description: "Registro de cambios (crear/ocultar) para auditoría de usuarios.",
      readOnly: true,
      columns: [
        { field: "fecha", label: "Fecha", type: "text" },
        { field: "usuario", label: "Usuario", type: "text" },
        { field: "accion", label: "Acción", type: "text" },
        { field: "modulo", label: "Módulo", type: "text" },
        { field: "registroId", label: "Registro", type: "text" },
      ],
      seedData: [],
    },
  ],
};

const state = {
  activeModuleKey: ERP_CONFIG.modules[0].key,
  activeUserId: "USR-1",
  data: Object.fromEntries(ERP_CONFIG.modules.map((m) => [m.key, structuredClone(m.seedData)])),
};

const moduleNav = document.getElementById("moduleNav");
const moduleTitle = document.getElementById("moduleTitle");
const moduleDescription = document.getElementById("moduleDescription");
const recordForm = document.getElementById("recordForm");
const tableContainer = document.getElementById("tableContainer");
const activeUserSelect = document.getElementById("activeUser");
const permissionTag = document.getElementById("permissionTag");

function getModuleByKey(key) {
  return ERP_CONFIG.modules.find((m) => m.key === key);
}

function getActiveModule() {
  return getModuleByKey(state.activeModuleKey);
}

function getActiveUser() {
  return state.data.usuarios.find((u) => u.id === state.activeUserId) || state.data.usuarios[0];
}

function roleCanEdit() {
  const user = getActiveUser();
  const map = {
    Administrador: "admin",
    Docente: "docente",
    Alumno: "alumno",
    Asesor: "asesor",
  };
  const role = ERP_CONFIG.roles[map[user.rol]];
  return role?.canEdit ?? false;
}

function addLog(accion, modulo, registroId) {
  state.data.bitacora.unshift({
    id: `LOG-${crypto.randomUUID()}`,
    fecha: new Date().toLocaleString("es-PE"),
    usuario: getActiveUser().correo,
    accion,
    modulo,
    registroId,
  });
}

function renderActiveUserSelect() {
  activeUserSelect.innerHTML = "";
  state.data.usuarios
    .filter((user) => user.estado === "Activo")
    .forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = `${user.rol} - ${user.correo}`;
      if (user.id === state.activeUserId) option.selected = true;
      activeUserSelect.appendChild(option);
    });

  activeUserSelect.onchange = () => {
    state.activeUserId = activeUserSelect.value;
    render();
  };
}

function renderModuleNav() {
  moduleNav.innerHTML = "";
  ERP_CONFIG.modules.forEach((module) => {
    const button = document.createElement("button");
    button.textContent = module.title;
    button.className = module.key === state.activeModuleKey ? "active" : "";
    button.addEventListener("click", () => {
      state.activeModuleKey = module.key;
      render();
    });
    moduleNav.appendChild(button);
  });
}

function buildRelationOptions(col) {
  const target = getModuleByKey(col.relation.moduleKey);
  const rows = state.data[target.key] || [];
  return rows
    .filter((row) => row.estado !== "Inactivo" && row.estado !== "Oculto")
    .map((row) => ({ value: row[col.relation.valueField], label: row[col.relation.labelField] }));
}

function makeInput(col) {
  if (col.type === "select" || col.type === "relation") {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleccione...";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    const options = col.type === "relation" ? buildRelationOptions(col) : (col.options || []).map((o) => ({ value: o, label: o }));

    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    if (col.required) select.required = true;
    select.name = col.field;
    if (col.readonly) select.disabled = true;
    return select;
  }

  const input = document.createElement("input");
  input.type = col.type || "text";
  input.name = col.field;
  if (col.required) input.required = true;
  if (col.readonly) {
    input.readOnly = true;
    input.value = "Auto";
  }
  return input;
}

function renderForm(module) {
  const editable = roleCanEdit() && !module.readOnly;
  permissionTag.textContent = editable
    ? `Permisos: ${getActiveUser().rol} puede crear/ocultar`
    : `Permisos: ${getActiveUser().rol} solo lectura`;

  recordForm.innerHTML = "";

  if (!editable) {
    recordForm.innerHTML = '<p class="muted">Este usuario no tiene permisos para crear registros en este módulo.</p>';
    return;
  }

  module.columns.forEach((col) => {
    const fieldWrap = document.createElement("div");
    fieldWrap.className = "field";
    const label = document.createElement("label");
    label.textContent = col.label;
    const input = makeInput(col);
    fieldWrap.appendChild(label);
    fieldWrap.appendChild(input);
    recordForm.appendChild(fieldWrap);
  });

  const actions = document.createElement("div");
  actions.className = "actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Guardar";
  actions.appendChild(submit);
  recordForm.appendChild(actions);

  recordForm.onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(recordForm);
    const newRecord = Object.fromEntries(formData.entries());

    module.columns.forEach((col) => {
      if (col.type === "number" && newRecord[col.field] !== "") {
        newRecord[col.field] = Number(newRecord[col.field]);
      }
    });

    if (module.key === "notas") {
      const values = [newRecord.actividad1, newRecord.actividad2, newRecord.examenFinal]
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v) && v > 0);
      newRecord.promedio = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;
    }

    newRecord.id = `${module.key.slice(0, 3).toUpperCase()}-${Date.now()}`;
    state.data[module.key].push(newRecord);
    addLog("CREAR", module.title, newRecord.id);
    renderTable(module);
    if (module.key === "usuarios") {
      renderActiveUserSelect();
    }
    recordForm.reset();
  };
}

function getValueForDisplay(module, col, rawValue) {
  if (col.type !== "relation") return rawValue ?? "";
  const target = getModuleByKey(col.relation.moduleKey);
  const row = state.data[target.key].find((item) => item[col.relation.valueField] === rawValue);
  return row ? row[col.relation.labelField] : rawValue;
}

function hideRecord(module, recordId) {
  const target = state.data[module.key].find((row) => row.id === recordId);
  if (!target || !module.softDeleteField) return;
  target[module.softDeleteField] = module.softDeleteValue;
  addLog("OCULTAR", module.title, recordId);
  render();
}

function renderTable(module) {
  const rows = state.data[module.key];
  const editable = roleCanEdit() && !module.readOnly;

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  module.columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    headRow.appendChild(th);
  });

  if (module.softDeleteField) {
    const actionHeader = document.createElement("th");
    actionHeader.textContent = "Acciones";
    headRow.appendChild(actionHeader);
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    module.columns.forEach((col) => {
      const td = document.createElement("td");
      td.textContent = getValueForDisplay(module, col, row[col.field]);
      tr.appendChild(td);
    });

    if (module.softDeleteField) {
      const actions = document.createElement("td");
      actions.className = "row-actions";
      if (editable && row[module.softDeleteField] !== module.softDeleteValue) {
        const hideButton = document.createElement("button");
        hideButton.type = "button";
        hideButton.textContent = "Ocultar";
        hideButton.onclick = () => hideRecord(module, row.id);
        actions.appendChild(hideButton);
      } else {
        actions.textContent = "-";
      }
      tr.appendChild(actions);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);
}

function render() {
  const module = getActiveModule();
  moduleTitle.textContent = module.title;
  moduleDescription.textContent = module.description || "";
  renderActiveUserSelect();
  renderModuleNav();
  renderForm(module);
  renderTable(module);
}

render();
