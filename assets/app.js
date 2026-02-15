/* ===========================================================
   Beta ERP Académico (demo offline)
   - Sin servidor, datos en LocalStorage
   - Importación/Exportación CSV/JSON
   - Reporte mensual instructor (print -> PDF)
   =========================================================== */

const STORAGE_KEY = "emtel_erp_demo_v1";

const $ = (sel) => document.querySelector(sel);

function uuid() {
  // UUID simple (suficiente para demo)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fmtDate(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function isoDate(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${yy}-${mm}-${dd}`;
}

function money(n){
  return `S/.${Number(n||0).toFixed(2)}`;
}

function timeDiffHours(h1, h2){
  // expects "HH:MM"
  const [aH,aM] = h1.split(":").map(Number);
  const [bH,bM] = h2.split(":").map(Number);
  const mins = (bH*60+bM) - (aH*60+aM);
  return Math.round((mins/60)*100)/100;
}

// ---------------- CSV helpers ----------------
function parseCSV(text){
  // CSV parser simple con soporte básico de comillas
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const next = text[i+1];

    if(ch === '"' ){
      if(inQuotes && next === '"'){ // escape ""
        cur += '"';
        i++;
      }else{
        inQuotes = !inQuotes;
      }
      continue;
    }

    if(!inQuotes && (ch === ",")){
      row.push(cur.trim());
      cur = "";
      continue;
    }
    if(!inQuotes && (ch === "\n" || ch === "\r")){
      if(ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if(row.some(c=>c.length>0)) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  row.push(cur.trim());
  if(row.some(c=>c.length>0)) rows.push(row);

  if(rows.length === 0) return {headers:[], data:[]};
  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(r=>{
    const obj = {};
    headers.forEach((h, idx)=> obj[h] = (r[idx] ?? "").trim());
    return obj;
  });
  return {headers, data};
}

function toCSV(headers, rows){
  const esc = (v) => {
    const s = String(v ?? "");
    if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const lines = [];
  lines.push(headers.map(esc).join(","));
  rows.forEach(r=>{
    lines.push(headers.map(h=> esc(r[h])).join(","));
  });
  return lines.join("\n");
}

function downloadFile(filename, content, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- DB ----------------
function sampleDB(){
  // Basado en el informe mensual (enero 2026): estructura de 3 tablas + remuneración
  // El objetivo es DEMOSTRAR el flujo: grupos -> turnos -> sesiones -> parte_horas -> reporte.
  const now = new Date();
  const db = {
    meta: { version:"demo-0.2", createdAt: now.toISOString(), updatedAt: now.toISOString() },
    users: [],
    ugels: [
      {id:"UG1", nombre:"UGEL Cusco"},
      {id:"UG2", nombre:"UGEL Lima Metropolitana"},
      {id:"UG3", nombre:"UGEL Chumbivilcas"}
    ],
    programs: [],
    programVersions: [],
    sessionTemplates: [],
    groups: [],
    turnos: [],
    assignments: [],
    instructors: [],
    participants: [],
    enrollments: [],
    sessions: [],
    attendance: [],
    payments: [],
    lmsAccounts: [],
  };

  // Users (simulación)
  db.users = [
    {id:"u_admin", role:"ADMIN", name:"Administrador del Sistema"},
    {id:"u_coord", role:"COORD", name:"Coordinación Académica"},
    {id:"u_reg", role:"REGISTRO", name:"Registro / Pagos"},
    {id:"u_inst1", role:"INSTRUCTOR", name:"Prof. Gabriel Araujo Arzubialde", instructorId:"inst1"},
  ];

  // Instructor
  db.instructors.push({
    id:"inst1",
    dni:"70000001",
    nombres:"Gabriel",
    apellidos:"Araujo Arzubialde",
    email:"gabriel.demo@emtel.pe",
    telefono:"+51 900 000 001",
    tarifaHora: 25,
    cuentas: [
      {banco:"Interbank", moneda:"PEN", tipo:"CTA", numero:"898 3190273778", titular:"Gabriel Araujo Arzubialde"},
      {banco:"Interbank", moneda:"PEN", tipo:"CCI", numero:"00389801319027377845", titular:"Gabriel Araujo Arzubialde"},
      {banco:"BCP", moneda:"PEN", tipo:"CTA", numero:"28536256210000", titular:"Gabriel Araujo Arzubialde"},
      {banco:"BCP", moneda:"PEN", tipo:"CCI", numero:"00228513625621000051", titular:"Gabriel Araujo Arzubialde"},
    ]
  });

  // Programas y versiones
  const p1 = {id:"p1", tipo:"DIPLOMADO", nombre:"DIPLOMADO DE INTELIGENCIA ARTIFICIAL APLICADO A LA EDUCACIÓN", activo:true};
  const p2 = {id:"p2", tipo:"DIPLOMADO", nombre:"DIPLOMADO EN INTELIGENCIA ARTIFICIAL APLICADO A LA INVESTIGACIÓN", activo:true};
  const p3 = {id:"p3", tipo:"CURSO_EXTENSIVO", nombre:"Inteligencia Artificial Aplicado a la Pedagogía - CHUMBIVILCAS", activo:true};
  const p4 = {id:"p4", tipo:"OTRO", nombre:"Notas", activo:true};
  db.programs.push(p1,p2,p3,p4);

  const v1 = {id:"v1", programId:"p1", codigo:"2026.01", plataforma:"MOODLE", precioTotal: 0, mensualidadRef: 0, certificadoIncluido:true, costoCertificado:0, activo:true, sesionesSugeridas:32};
  const v2 = {id:"v2", programId:"p2", codigo:"2026.01", plataforma:"MOODLE", precioTotal: 0, mensualidadRef: 0, certificadoIncluido:true, costoCertificado:0, activo:true, sesionesSugeridas:24};
  const v3 = {id:"v3", programId:"p3", codigo:"2026.01", plataforma:"CLASSROOM", precioTotal: 0, mensualidadRef: 0, certificadoIncluido:false, costoCertificado: 30, activo:true, sesionesSugeridas:12};
  const v4 = {id:"v4", programId:"p4", codigo:"2026.01", plataforma:"OTRO", precioTotal: 0, mensualidadRef: 0, certificadoIncluido:false, costoCertificado:0, activo:true, sesionesSugeridas:0};
  db.programVersions.push(v1,v2,v3,v4);

  // Session templates (código soporta I1)
  function addTemplate(programVersionId, codigo){
    const st = {id: uuid(), programVersionId, codigo, titulo:`Sesión ${codigo}`, tipo:"SINCRONICA", duracionMin:120};
    db.sessionTemplates.push(st);
    return st.id;
  }
  const st_g11 = {};
  ["9","10","11","12","13","14","15","16","17"].forEach(c=> st_g11[c]=addTemplate("v1", c));
  const st_g1 = {};
  ["I1","1","2","3","4"].forEach(c=> st_g1[c]=addTemplate("v2", c));
  const st_ch = {};
  ["14","15"].forEach(c=> st_ch[c]=addTemplate("v3", c));
  const st_n = {"N/A": addTemplate("v4","N/A")};

  // Groups
  const g11 = {id:"g11", programVersionId:"v1", codigoGrupo:"G11", fechaInicio:"2026-01-03", modalidad:"VIRTUAL", estado:"EN_CURSO"};
  const g1 =  {id:"g1",  programVersionId:"v2", codigoGrupo:"G1",  fechaInicio:"2026-01-13", modalidad:"VIRTUAL", estado:"EN_CURSO"};
  const gch = {id:"gch", programVersionId:"v3", codigoGrupo:"CHUMBIVILCAS", fechaInicio:"2026-01-02", modalidad:"VIRTUAL", estado:"EN_CURSO"};
  const g9 =  {id:"g9",  programVersionId:"v4", codigoGrupo:"G9",  fechaInicio:"2026-01-19", modalidad:"VIRTUAL", estado:"CERRADO"};
  db.groups.push(g11,g1,gch,g9);

  // Turnos
  function addTurno(groupId, nombre, hi, hf){
    const t = {id: uuid(), groupId, nombre, horaInicio:hi, horaFin:hf, activo:true};
    db.turnos.push(t);
    return t.id;
  }
  const g11_t1 = addTurno("g11","6:00 p.m. - 8:00 p.m.","18:00","20:00");
  const g11_t2 = addTurno("g11","8:00 p.m. - 10:00 p.m.","20:00","22:00");
  const g1_t1  = addTurno("g1","6:00 p.m. - 8:00 p.m.","18:00","20:00");
  const g1_t2  = addTurno("g1","8:00 p.m. - 10:00 p.m.","20:00","22:00");
  const ch_t1  = addTurno("gch","6:00 p.m. - 8:00 p.m.","18:00","20:00");
  const g9_t1  = addTurno("g9","6:00 p.m. - 8:00 p.m.","18:00","20:00");

  // Assign instructor to turnos (demo)
  function assign(turnoId){
    db.assignments.push({id: uuid(), turnoId, instructorId:"inst1", desde:"2026-01-01", hasta:null, tarifaOverride:null});
  }
  [g11_t1,g11_t2,g1_t1,g1_t2,ch_t1,g9_t1].forEach(assign);

  // Participants + enrollments (generados)
  function genParticipants(n, groupId, turnoId, ugelId){
    for(let i=1;i<=n;i++){
      const pid = uuid();
      const dni = String(70010000 + db.participants.length + 1);
      db.participants.push({
        id: pid,
        dni,
        nombres: `Participante ${db.participants.length+1}`,
        apellidos: `Demo`,
        email: `p${dni}@demo.pe`,
        telefono: `+51 9${String(10000000 + db.participants.length).slice(-8)}`,
        ugelId
      });
      db.enrollments.push({
        id: uuid(),
        participantId: pid,
        groupId,
        turnoId,
        estado:"ACTIVO",
        fechaMatricula:"2026-01-01"
      });
    }
  }
  genParticipants(36, "g11", g11_t1, "UG1");
  genParticipants(12, "g1", g1_t1, "UG2");
  genParticipants(4,  "gch", ch_t1, "UG3");
  genParticipants(2,  "g9",  g9_t1, "UG2");

  // Sessions (según el informe)
  function addSession(turnoId, templateId, fecha, hi, hf){
    db.sessions.push({
      id: uuid(),
      turnoId,
      sessionTemplateId: templateId,
      fecha,
      horaInicio: hi,
      horaFin: hf,
      zoomUrl: "https://zoom.us/j/xxxx-demo",
      grabacionUrl: "",
      formUrl: "",
      estado:"DICTADA"
    });
  }

  // CHUMBIVILCAS: 2/01 (14), 5/01 (15)
  addSession(ch_t1, st_ch["14"], "2026-01-02", "18:00","20:00");
  addSession(ch_t1, st_ch["15"], "2026-01-05", "18:00","20:00");

  // G11: sesiones 9..17 con duplicación por turno
  const g11_map = [
    ["9","2026-01-03"],
    ["10","2026-01-04"],
    ["11","2026-01-10"],
    ["12","2026-01-11"],
    ["13","2026-01-17"],
    ["14","2026-01-18"],
    ["15","2026-01-24"],
    ["16","2026-01-25"],
    ["17","2026-01-31"],
  ];
  g11_map.forEach(([code, date])=>{
    addSession(g11_t1, st_g11[code], date, "18:00","20:00");
    addSession(g11_t2, st_g11[code], date, "20:00","22:00");
  });

  // G1: I1 duplicado, y luego 1..4 solo en un turno (para que total DIPLOMADO = 48h)
  addSession(g1_t1, st_g1["I1"], "2026-01-13", "18:00","20:00");
  addSession(g1_t2, st_g1["I1"], "2026-01-13", "20:00","22:00");
  addSession(g1_t1, st_g1["1"], "2026-01-20", "18:00","20:00");
  addSession(g1_t1, st_g1["2"], "2026-01-22", "18:00","20:00");
  addSession(g1_t1, st_g1["3"], "2026-01-27", "18:00","20:00");
  addSession(g1_t1, st_g1["4"], "2026-01-29", "18:00","20:00");

  // Notas - G9: 19/01
  addSession(g9_t1, st_n["N/A"], "2026-01-19", "18:00","20:00");

  // Attendance demo (random simple)
  db.sessions.forEach(s=>{
    const turno = db.turnos.find(t=>t.id===s.turnoId);
    const enrolls = db.enrollments.filter(e=> e.turnoId===turno.id);
    enrolls.slice(0, Math.min(10, enrolls.length)).forEach(e=>{
      db.attendance.push({
        id: uuid(),
        sessionId: s.id,
        enrollmentId: e.id,
        presente: (Math.random() > 0.2),
        fuente: "MANUAL",
        registradoEn: new Date(s.fecha+"T23:00:00").toISOString()
      });
    });
  });

  // Payments demo (algunos pagos)
  const firstEnroll = db.enrollments[0];
  db.payments.push({
    id: uuid(),
    enrollmentId: firstEnroll.id,
    fechaPago: "2026-01-05T10:30:00",
    monto: 50,
    metodo:"YAPE",
    referencia:"YAPE-0001"
  });

  return db;
}

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return sampleDB();
    return JSON.parse(raw);
  }catch(e){
    console.warn("No se pudo cargar DB, usando demo.", e);
    return sampleDB();
  }
}

function saveDB(){
  db.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ---------------- App State ----------------
let db = loadDB();
let state = {
  role: "ADMIN",
  userId: db.users.find(u=>u.role==="ADMIN")?.id || db.users[0]?.id
};

// ---------------- Helpers (lookup) ----------------
function getUser(){
  return db.users.find(u=>u.id===state.userId);
}
function getInstructorFromUser(){
  const u = getUser();
  if(!u || u.role!=="INSTRUCTOR") return null;
  return db.instructors.find(i=>i.id===u.instructorId);
}
function getProgramVersion(id){ return db.programVersions.find(v=>v.id===id); }
function getProgram(id){ return db.programs.find(p=>p.id===id); }
function groupLabel(g){
  const v = getProgramVersion(g.programVersionId);
  const p = getProgram(v.programId);
  return `${p.nombre} - ${g.codigoGrupo}`;
}
function programTypeFromGroup(g){
  const v = getProgramVersion(g.programVersionId);
  const p = getProgram(v.programId);
  return p.tipo;
}
function getTurnosByGroup(groupId){ return db.turnos.filter(t=>t.groupId===groupId); }
function getTemplate(id){ return db.sessionTemplates.find(s=>s.id===id); }
function getGroupById(id){ return db.groups.find(g=>g.id===id); }
function getEnrollment(id){ return db.enrollments.find(e=>e.id===id); }
function getParticipant(id){ return db.participants.find(p=>p.id===id); }
function getUGELName(id){ return db.ugels.find(u=>u.id===id)?.nombre || ""; }
function getInstructor(id){ return db.instructors.find(i=>i.id===id); }
function getAssignmentsByInstructor(instructorId){
  return db.assignments.filter(a=>a.instructorId===instructorId);
}

// ---------------- Navigation ----------------
const NAV = [
  {hash:"#dashboard", label:"📊 Dashboard", roles:["ADMIN","COORD","REGISTRO","INSTRUCTOR"]},
  {hash:"#programas", label:"📚 Programas (cursos/diplomados)", roles:["ADMIN"]},
  {hash:"#grupos", label:"👥 Grupos y horarios", roles:["ADMIN","COORD"]},
  {hash:"#calendario", label:"🗓️ Calendario", roles:["ADMIN","COORD","INSTRUCTOR"]},
  {hash:"#participantes", label:"🧾 Participantes (import/export)", roles:["ADMIN","COORD","REGISTRO"]},
  {hash:"#asistencia", label:"✅ Asistencia", roles:["ADMIN","COORD","INSTRUCTOR"]},
  {hash:"#pagos", label:"💳 Pagos participantes", roles:["ADMIN","COORD","REGISTRO"]},
  {hash:"#lms", label:"🔐 Credenciales Moodle/Classroom", roles:["ADMIN","COORD","REGISTRO"]},
  {hash:"#reportes", label:"🧾 Informe docente (PDF/Print)", roles:["ADMIN","COORD","INSTRUCTOR"]},
  {hash:"#ayuda", label:"❓ Cómo usar esta demo", roles:["ADMIN","COORD","REGISTRO","INSTRUCTOR"]},
];

function renderNav(){
  const nav = $("#nav");
  nav.innerHTML = "";

  const raw = location.hash || "#dashboard";
  const curPath = raw.split("?")[0];
  const curBase = curPath.startsWith("#grupo=") ? "#grupos" : curPath;

  NAV.filter(n=>n.roles.includes(state.role)).forEach(n=>{
    const a = document.createElement("a");
    a.href = n.hash;
    a.textContent = n.label;
    if(curBase === n.hash || (!location.hash && n.hash==="#dashboard")) a.classList.add("active");
    nav.appendChild(a);
  });
}

// ---------------- Top controls ----------------
function renderUserSelect(){
  const sel = $("#userSelect");
  const users = db.users.filter(u=>u.role===state.role);
  sel.innerHTML = "";
  users.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    sel.appendChild(opt);
  });
  if(!users.some(u=>u.id===state.userId)){
    state.userId = users[0]?.id || db.users[0]?.id;
  }
  sel.value = state.userId;
}

function bindTopbar(){
  $("#roleSelect").value = state.role;
  renderUserSelect();

  $("#roleSelect").addEventListener("change", (e)=>{
    state.role = e.target.value;
    renderUserSelect();
    renderNav();
    renderRoute();
  });

  $("#userSelect").addEventListener("change", (e)=>{
    state.userId = e.target.value;
    renderRoute();
  });

  $("#btnExportDB").addEventListener("click", ()=>{
    downloadFile(`emtel_erp_demo_export_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(db,null,2), "application/json");
  });

  $("#fileImportDB").addEventListener("change", async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const txt = await f.text();
    try{
      const imported = JSON.parse(txt);
      db = imported;
      saveDB();
      renderUserSelect();
      renderNav();
      renderRoute();
      alert("Datos importados. (Demo)");
    }catch(err){
      alert("No se pudo importar JSON.");
    }finally{
      e.target.value = "";
    }
  });

  $("#btnReset").addEventListener("click", ()=>{
    if(!confirm("Esto reinicia la demo y borra los datos locales. ¿Continuar?")) return;
    localStorage.removeItem(STORAGE_KEY);
    db = loadDB();
    state.role = "ADMIN";
    state.userId = db.users.find(u=>u.role==="ADMIN")?.id || db.users[0]?.id;
    $("#roleSelect").value = state.role;
    renderUserSelect();
    renderNav();
    location.hash = "#dashboard";
    renderRoute();
  });
}

// ---------------- Views ----------------
function setView(title, hint, html){
  $("#view").innerHTML = `
    <section class="panel">
      <div class="panelHead">
        <div>
          <h2>${title}</h2>
          <div class="hint">${hint || ""}</div>
        </div>
      </div>
      <div class="panelBody">${html}</div>
    </section>
  `;
}

function renderDashboard(params){
  const role = state.role;
  const u = getUser();
  let html = "";

  params = params || new URLSearchParams();

  let programFilter = params.get("program") || "";
  let groupFilter = params.get("grupo") || "";

  // Si hay grupo pero no programa, inferimos el programa desde el grupo
  if(groupFilter && !programFilter){
    const gg = getGroupById(groupFilter);
    if(gg){
      const vv = getProgramVersion(gg.programVersionId);
      programFilter = vv ? vv.programId : "";
    }
  }

  const programsAll = db.programs.slice().sort((a,b)=> (a.nombre||"").localeCompare(b.nombre||""));
  const groupsAll = db.groups.slice();

  const groupsByProgram = programFilter
    ? groupsAll.filter(g=>{
        const v = getProgramVersion(g.programVersionId);
        return v && v.programId === programFilter;
      })
    : groupsAll;

  const groupObj = groupFilter ? getGroupById(groupFilter) : null;
  if(groupFilter && !groupObj) groupFilter = "";

  const enrollsFiltered = groupFilter
    ? db.enrollments.filter(e=>e.groupId===groupFilter)
    : (programFilter
        ? db.enrollments.filter(e=> groupsByProgram.some(g=>g.id===e.groupId))
        : db.enrollments);

  const sessionsFiltered = groupFilter
    ? db.sessions.filter(s=>{
        const t = db.turnos.find(t=>t.id===s.turnoId);
        return t && t.groupId===groupFilter;
      })
    : (programFilter
        ? db.sessions.filter(s=>{
            const t = db.turnos.find(t=>t.id===s.turnoId);
            if(!t) return false;
            const g = getGroupById(t.groupId);
            if(!g) return false;
            const v = getProgramVersion(g.programVersionId);
            return v && v.programId===programFilter;
          })
        : db.sessions);

  const uniqParticipants = (enrolls)=> new Set(enrolls.map(e=>e.participantId)).size;

  const counts = {
    programas: programsAll.length,
    grupos: groupsAll.length,
    participantes: db.participants.length,
    matriculas: db.enrollments.length,
    sesiones: db.sessions.length,

    // Filtrado actual
    f_programaId: programFilter,
    f_grupoId: groupFilter,
    f_grupos: groupsByProgram.length,
    f_participantes: uniqParticipants(enrollsFiltered),
    f_matriculas: enrollsFiltered.length,
    f_sesiones: sessionsFiltered.length
  };

  const isFiltered = Boolean(counts.f_programaId || counts.f_grupoId);
  const programOptions = programsAll.map(p=>`<option value="${p.id}" ${p.id===counts.f_programaId ? "selected":""}>${p.nombre} (${p.tipo})</option>`).join("");
  const groupOptions = groupsByProgram.map(g=>`<option value="${g.id}" ${g.id===counts.f_grupoId ? "selected":""}>${groupLabel(g)}</option>`).join("");

  html += `
    <div class="kpi">
      <div class="box"><b>${counts.programas}</b><span>Programas (cursos/diplomados)</span></div>
      <div class="box"><b>${isFiltered ? (counts.f_grupoId ? 1 : counts.f_grupos) : counts.grupos}</b><span>Grupos${isFiltered ? " (filtrado)" : ""}</span></div>
      <div class="box"><b>${isFiltered ? counts.f_participantes : counts.participantes}</b><span>Participantes${isFiltered ? " (filtrado)" : ""}</span></div>
      <div class="box"><b>${isFiltered ? counts.f_matriculas : counts.matriculas}</b><span>Matrículas${isFiltered ? " (filtrado)" : ""}</span></div>
      <div class="box"><b>${isFiltered ? counts.f_sesiones : counts.sesiones}</b><span>Sesiones${isFiltered ? " (filtrado)" : ""}</span></div>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Filtrar por programa</label>
        <select class="select" id="dashProgram">
          <option value="">— Todos —</option>
          ${programOptions}
        </select>
      </div>
      <div class="col">
        <label>Filtrar por grupo</label>
        <select class="select" id="dashGroup">
          <option value="">— Todos —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>&nbsp;</label>
        <button class="btn" id="dashClear">Limpiar filtro</button>
      </div>
    </div>

    ${counts.f_grupoId ? `
    <div class="note" style="margin-top:10px">
      <b>Grupo seleccionado:</b> ${groupLabel(getGroupById(counts.f_grupoId))}<br/>
      Accesos rápidos: gestionar grupo, ver matrículas, calendario y asistencia.
    </div>
    <div class="row" style="margin-top:10px">
      <div class="col">
        <button class="btn" id="dashGoGroup">Abrir gestión de grupo</button>
      </div>
      <div class="col">
        <button class="btn" id="dashGoParticipants">Ver matrículas</button>
      </div>
      <div class="col">
        <button class="btn" id="dashGoCalendar">Ver calendario</button>
      </div>
      <div class="col">
        <button class="btn" id="dashGoAttendance">Ver asistencia</button>
      </div>
    </div>
    ` : ``}

    <hr class="sep"/>
  `;

  if(role === "INSTRUCTOR"){
    const inst = getInstructorFromUser();
    const assigns = getAssignmentsByInstructor(inst.id);
    const turnos = assigns.map(a=> db.turnos.find(t=>t.id===a.turnoId)).filter(Boolean);

    // upcoming sessions = next future, but in demo all are past; show last 5
    const ses = db.sessions
      .filter(s => turnos.some(t=>t.id===s.turnoId))
      .sort((a,b)=> (a.fecha+b.horaInicio).localeCompare(b.fecha+b.horaInicio))
      .slice(0, 6);

    html += `
      <div class="note">
        <b>Usuario:</b> ${u.name}<br/>
        Aquí se verían tus grupos, tu siguiente sesión y el enlace de Zoom.
      </div>
      <div class="gridCards" style="margin-top:12px">
        ${turnos.map(t=>{
          const g = getGroupById(t.groupId);
          return `
            <div class="card">
              <h3>${groupLabel(g)}</h3>
              <div class="muted">Turno: ${t.nombre}</div>
              <div class="muted">Modalidad: ${g.modalidad}</div>
            </div>
          `;
        }).join("")}
      </div>
      <hr class="sep"/>
      <h3 style="margin:0 0 10px 0; font-size:13px;">Sesiones recientes (demo)</h3>
      <table class="table">
        <thead><tr><th>Fecha</th><th>Grupo</th><th>Turno</th><th>Sesión</th><th>Zoom</th></tr></thead>
        <tbody>
          ${ses.map(s=>{
            const t = db.turnos.find(x=>x.id===s.turnoId);
            const g = getGroupById(t.groupId);
            const st = getTemplate(s.sessionTemplateId);
            return `
              <tr>
                <td>${fmtDate(s.fecha)}</td>
                <td>${groupLabel(g)}</td>
                <td>${t.nombre}</td>
                <td>${st.codigo}</td>
                <td><a href="${s.zoomUrl}" target="_blank">Abrir</a></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }else{
    html += `
      <div class="gridCards">
        <div class="card">
          <h3>🎯 Flujo MVP</h3>
          <div class="muted">
            1) Importas participantes (CSV desde Excel)<br/>
            2) Los inscribes en un grupo/turno<br/>
            3) Asignas instructor<br/>
            4) Programas sesiones (Zoom + links)<br/>
            5) Marcas/importas asistencia<br/>
            6) Registras pagos<br/>
            7) Generas informe mensual del instructor (print → PDF)
          </div>
        </div>
        <div class="card">
          <h3>📌 Datos demo</h3>
          <div class="muted">
            La demo viene precargada con un caso similar al “Informe mensual docente - Enero 2026”.<br/>
            Puedes resetear y volver a probar cuantas veces quieras.
          </div>
        </div>
      </div>
    `;
  }

  setView("Dashboard", "Vista rápida según el rol (simulación).", html);

  // Filtros (programa/grupo) en el dashboard
  const dp = document.getElementById("dashProgram");
  const dg = document.getElementById("dashGroup");
  const dc = document.getElementById("dashClear");

  if(dp && dg && dc){
    dp.value = counts.f_programaId || "";
    dg.value = counts.f_grupoId || "";

    dp.addEventListener("change", ()=>{
      const pid = dp.value;
      // al cambiar programa, limpiamos grupo (evita inconsistencias)
      location.hash = pid ? ("#dashboard?program=" + encodeURIComponent(pid)) : "#dashboard";
    });

    dg.addEventListener("change", ()=>{
      const pid = dp.value;
      const gid = dg.value;
      const qs = [];
      if(pid) qs.push("program="+encodeURIComponent(pid));
      if(gid) qs.push("grupo="+encodeURIComponent(gid));
      location.hash = "#dashboard" + (qs.length ? ("?"+qs.join("&")) : "");
    });

    dc.addEventListener("click", ()=> location.hash = "#dashboard");
  }

  // Accesos rápidos si hay grupo seleccionado
  const gid = counts.f_grupoId;
  const btnG = document.getElementById("dashGoGroup");
  const btnP = document.getElementById("dashGoParticipants");
  const btnCal = document.getElementById("dashGoCalendar");
  const btnA = document.getElementById("dashGoAttendance");

  if(gid && btnG) btnG.addEventListener("click", ()=> location.hash = "#grupo="+gid);
  if(gid && btnP) btnP.addEventListener("click", ()=> location.hash = "#participantes?grupo="+gid);
  if(gid && btnCal) btnCal.addEventListener("click", ()=> location.hash = "#calendario?grupo="+gid);
  if(gid && btnA) btnA.addEventListener("click", ()=> location.hash = "#asistencia?grupo="+gid);
}

function renderGrupos(){
  // Admin/Coord only
  const groups = db.groups.slice().sort((a,b)=> groupLabel(a).localeCompare(groupLabel(b)));

  const optionsPV = db.programVersions.map(v=>{
    const p = getProgram(v.programId);
    return `<option value="${v.id}">${p.nombre} — v${v.codigo} (${v.plataforma})</option>`;
  }).join("");

  let html = `
    <div class="row">
      <div class="col">
        <label>Crear grupo (MVP)</label>
        <div class="small">Crea un grupo tipo “G1 / G11” asociado a una versión del programa.</div>
      </div>
    </div>
    <div class="row">
      <div class="col">
        <label>Programa (versión)</label>
        <select class="select" id="new_group_pv">${optionsPV}</select>
      </div>
      <div class="col">
        <label>Código grupo</label>
        <input class="input" id="new_group_code" placeholder="Ej: G1" />
      </div>
      <div class="col">
        <label>Fecha inicio</label>
        <input class="input" id="new_group_start" type="date" value="${isoDate(new Date())}"/>
      </div>
      <div class="col">
        <label>Modalidad</label>
        <select class="select" id="new_group_mod">
          <option>VIRTUAL</option>
          <option>PRESENCIAL</option>
          <option>MIXTO</option>
        </select>
      </div>
      <div class="col">
        <label>Estado</label>
        <select class="select" id="new_group_estado">
          <option value="PLANIFICADO">PLANIFICADO</option>
          <option value="EN_CURSO">EN_CURSO</option>
          <option value="CERRADO">CERRADO</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
      </div>
      <div class="col">
        <button class="btn primary" id="btnCreateGroup">Crear</button>
      </div>
    </div>

    <hr class="sep"/>

    <div class="row">
      <div class="col">
        <label>Grupos</label>
        <table class="table">
          <thead><tr><th>Grupo</th><th>Modalidad</th><th>Inicio</th><th>Turnos</th><th></th></tr></thead>
          <tbody>
            ${groups.map(g=>{
              const turnos = getTurnosByGroup(g.id).length;
              return `
                <tr>
                  <td><b>${groupLabel(g)}</b> <span class="badge">${g.estado}</span></td>
                  <td>${g.modalidad}</td>
                  <td>${fmtDate(g.fechaInicio)}</td>
                  <td>${turnos}</td>
                  <td><button class="btn" data-open-group="${g.id}">Abrir</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setView("Grupos y horarios", "Crea grupos, define turnos y asigna instructores.", html);

  $("#btnCreateGroup").addEventListener("click", ()=>{
    const pv = $("#new_group_pv").value;
    const code = $("#new_group_code").value.trim();
    if(!code){ alert("Ingresa código de grupo."); return; }
    const g = {
      id: uuid(),
      programVersionId: pv,
      codigoGrupo: code,
      fechaInicio: $("#new_group_start").value,
      modalidad: $("#new_group_mod").value,
      estado: $("#new_group_estado").value
    };
    db.groups.push(g);
    saveDB();
    location.hash = "#grupo="+g.id;
  });

  document.querySelectorAll("[data-open-group]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      location.hash = "#grupo="+btn.getAttribute("data-open-group");
    });
  });
}

function renderGrupoDetalle(groupId){
  const g = getGroupById(groupId);
  if(!g){ setView("Grupo", "No encontrado", `<div class="note">El grupo no existe.</div>`); return; }
  const v = getProgramVersion(g.programVersionId);
  const p = getProgram(v.programId);
  const turnos = getTurnosByGroup(g.id);
  const templates = db.sessionTemplates.filter(s=>s.programVersionId===v.id && s.tipo==="SINCRONICA");

  const instructorOptions = db.instructors.map(i=> `<option value="${i.id}">${i.nombres} ${i.apellidos}</option>`).join("");

  const turnoRows = turnos.map(t=>{
    const asg = db.assignments.find(a=>a.turnoId===t.id);
    const inst = asg ? getInstructor(asg.instructorId) : null;
    return `
      <tr>
        <td><b>${t.nombre}</b><div class="small">${t.horaInicio}–${t.horaFin}</div></td>
        <td>${inst ? `${inst.nombres} ${inst.apellidos}` : `<span class="badge warn">Sin asignar</span>`}</td>
        <td>
          <select class="select" data-turno-instructor="${t.id}">
            <option value="">—</option>
            ${db.instructors.map(i=> `<option value="${i.id}" ${asg && asg.instructorId===i.id ? "selected":""}>${i.nombres} ${i.apellidos}</option>`).join("")}
          </select>
        </td>
        <td><button class="btn" data-del-turno="${t.id}">Eliminar</button></td>
      </tr>
    `;
  }).join("");

  const sessions = db.sessions
    .filter(s => turnos.some(t=>t.id===s.turnoId))
    .sort((a,b)=> (a.fecha+a.horaInicio).localeCompare(b.fecha+b.horaInicio));

  const sessionRows = sessions.map(s=>{
    const t = db.turnos.find(x=>x.id===s.turnoId);
    const st = getTemplate(s.sessionTemplateId);
    return `
      <tr>
        <td>${fmtDate(s.fecha)}</td>
        <td>${t.nombre}</td>
        <td><b>${st.codigo}</b></td>
        <td>${s.horaInicio}–${s.horaFin}</td>
        <td><a href="${s.zoomUrl}" target="_blank">Zoom</a></td>
        <td><button class="btn" data-del-session="${s.id}">Eliminar</button></td>
      </tr>
    `;
  }).join("");

  const html = `
    <div class="note">
      <b>${p.nombre}</b><br/>
      Versión: <b>${v.codigo}</b> · Plataforma: <b>${v.plataforma}</b><br/>
      Grupo: <b>${g.codigoGrupo}</b> · Modalidad: <b>${g.modalidad}</b> · Estado: <b>${g.estado}</b>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Editar estado</label>
        <select class="select" id="edit_group_estado">
          ${["PLANIFICADO","EN_CURSO","CERRADO","CANCELADO"].map(s=>`<option value="${s}" ${g.estado===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="col">
        <label>Fecha inicio</label>
        <input class="input" id="edit_group_inicio" type="date" value="${g.fechaInicio}"/>
      </div>
      <div class="col">
        <label>Modalidad</label>
        <select class="select" id="edit_group_modalidad">
          ${["VIRTUAL","PRESENCIAL","MIXTO"].map(m=>`<option value="${m}" ${g.modalidad===m?"selected":""}>${m}</option>`).join("")}
        </select>
      </div>
      <div class="col">
        <label>Código grupo</label>
        <input class="input" id="edit_group_code" value="${g.codigoGrupo}"/>
      </div>
      <div class="col">
        <button class="btn primary" id="btnSaveGroup">Guardar</button>
      </div>
    </div>

    <hr class="sep"/>

    <div class="row">
      <div class="col">
        <label>Turnos del grupo</label>
        <table class="table">
          <thead><tr><th>Turno</th><th>Instructor actual</th><th>Asignar instructor</th><th></th></tr></thead>
          <tbody>${turnoRows || `<tr><td colspan="4" class="small">No hay turnos aún.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Nuevo turno</label>
        <input class="input" id="new_turno_name" placeholder="Ej: 6:00 p.m. - 8:00 p.m."/>
      </div>
      <div class="col">
        <label>Hora inicio</label>
        <input class="input" id="new_turno_hi" type="time" value="18:00"/>
      </div>
      <div class="col">
        <label>Hora fin</label>
        <input class="input" id="new_turno_hf" type="time" value="20:00"/>
      </div>
      <div class="col">
        <button class="btn primary" id="btnAddTurno">Agregar turno</button>
      </div>
    </div>

    <hr class="sep"/>

    <div class="row">
      <div class="col">
        <label>Sesiones del grupo</label>
        <div class="small">En un sistema real, se podrían generar por calendario. Aquí las agregas manualmente (MVP).</div>
        <table class="table" style="margin-top:10px">
          <thead><tr><th>Fecha</th><th>Turno</th><th>Sesión</th><th>Hora</th><th>Link</th><th></th></tr></thead>
          <tbody>${sessionRows || `<tr><td colspan="6" class="small">No hay sesiones.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Turno</label>
        <select class="select" id="new_session_turno">
          ${turnos.map(t=> `<option value="${t.id}">${t.nombre}</option>`).join("")}
        </select>
      </div>
      <div class="col">
        <label>Sesión (plantilla)</label>
        <select class="select" id="new_session_tpl">
          ${templates.map(s=> `<option value="${s.id}">${s.codigo} — ${s.titulo}</option>`).join("")}
        </select>
      </div>
      <div class="col">
        <label>Fecha</label>
        <input class="input" id="new_session_date" type="date" value="${isoDate(new Date())}"/>
      </div>
      <div class="col">
        <label>Zoom URL</label>
        <input class="input" id="new_session_zoom" placeholder="https://zoom.us/j/..." />
      </div>
      <div class="col">
        <button class="btn primary" id="btnAddSession">Agregar sesión</button>
      </div>
    </div>

    <hr class="sep"/>
    <div class="row">
      <div class="col">
        <button class="btn" id="btnGoParticipants">Ver participantes del grupo</button>
        <button class="btn" id="btnGoAttendance">Ir a asistencia</button>
      </div>
    </div>
  `;

  setView("Detalle de grupo", "Gestiona turnos, asignación de instructor y sesiones.", html);

  $("#btnSaveGroup").addEventListener("click", ()=>{
    const code = $("#edit_group_code").value.trim();
    if(code) g.codigoGrupo = code;
    g.estado = $("#edit_group_estado").value;
    g.fechaInicio = $("#edit_group_inicio").value;
    g.modalidad = $("#edit_group_modalidad").value;
    saveDB();
    renderRoute();
  });

  $("#btnAddTurno").addEventListener("click", ()=>{
    const name = $("#new_turno_name").value.trim();
    if(!name){ alert("Nombre del turno requerido."); return; }
    const t = {id: uuid(), groupId:g.id, nombre:name, horaInicio: $("#new_turno_hi").value, horaFin: $("#new_turno_hf").value, activo:true};
    db.turnos.push(t);
    saveDB();
    renderRoute();
  });

  document.querySelectorAll("[data-del-turno]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del-turno");
      if(!confirm("¿Eliminar turno? (demo)")) return;
      db.turnos = db.turnos.filter(t=>t.id!==id);
      db.assignments = db.assignments.filter(a=>a.turnoId!==id);
      db.sessions = db.sessions.filter(s=>s.turnoId!==id);
      saveDB();
      renderRoute();
    });
  });

  document.querySelectorAll("[data-turno-instructor]").forEach(sel=>{
    sel.addEventListener("change", ()=>{
      const turnoId = sel.getAttribute("data-turno-instructor");
      const instId = sel.value || null;
      db.assignments = db.assignments.filter(a=>a.turnoId!==turnoId);
      if(instId){
        db.assignments.push({id: uuid(), turnoId, instructorId: instId, desde: isoDate(new Date()), hasta:null, tarifaOverride:null});
      }
      saveDB();
    });
  });

  $("#btnAddSession").addEventListener("click", ()=>{
    const turnoId = $("#new_session_turno").value;
    const tplId = $("#new_session_tpl").value;
    const date = $("#new_session_date").value;
    if(!turnoId || !tplId || !date){ alert("Completa turno, sesión y fecha."); return; }
    const turno = db.turnos.find(t=>t.id===turnoId);
    const s = {
      id: uuid(),
      turnoId,
      sessionTemplateId: tplId,
      fecha: date,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      zoomUrl: $("#new_session_zoom").value.trim() || "",
      grabacionUrl: "",
      formUrl: "",
      estado:"PROGRAMADA"
    };
    db.sessions.push(s);
    saveDB();
    renderRoute();
  });

  document.querySelectorAll("[data-del-session]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del-session");
      if(!confirm("¿Eliminar sesión?")) return;
      db.sessions = db.sessions.filter(s=>s.id!==id);
      db.attendance = db.attendance.filter(a=>a.sessionId!==id);
      saveDB();
      renderRoute();
    });
  });

  $("#btnGoParticipants").addEventListener("click", ()=> location.hash = "#participantes?grupo="+g.id);
  $("#btnGoAttendance").addEventListener("click", ()=> location.hash = "#asistencia?grupo="+g.id);
}

function renderParticipantes(params){
  const groupId = params.get("grupo");
  const group = groupId ? getGroupById(groupId) : null;

  const groupOptions = db.groups.map(g=> `<option value="${g.id}" ${groupId===g.id?"selected":""}>${groupLabel(g)}</option>`).join("");
  const turnoOptions = group ? getTurnosByGroup(group.id).map(t=> `<option value="${t.id}">${t.nombre}</option>`).join("") : "";

  const participants = db.participants
    .slice()
    .sort((a,b)=> (a.apellidos+a.nombres).localeCompare(b.apellidos+b.nombres));

  const enrollsByGroup = group ? db.enrollments.filter(e=>e.groupId===group.id) : [];

  let html = `
    <div class="note">
      <b>Importación rápida (MVP):</b> exporta tu Excel como <code>CSV</code> y súbelo aquí.<br/>
      Columnas recomendadas: <code>dni,nombres,apellidos,email,telefono,ugel,grupo,turno</code>.
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Importar CSV de participantes</label>
        <input class="input" id="fileCSV" type="file" accept=".csv,text/csv"/>
        <div class="small" style="margin-top:6px">
          Consejo: En Excel → “Guardar como” → CSV (delimitado por comas).
        </div>
      </div>
      <div class="col">
        <label>Plantillas</label>
        <div class="row" style="margin:0; gap:8px; align-items:center">
          <button class="btn" id="btnTemplate">Generar CSV (rápido)</button>
          <a class="btn" href="plantillas/plantilla_participantes.csv" download>CSV (archivo)</a>
          <a class="btn" href="plantillas/plantilla_participantes.xlsx" download>Excel</a>
        </div>
        <div class="small" style="margin-top:6px">
          Nota: el importador de esta demo lee <b>CSV</b>. El Excel es solo para rellenar y luego “Guardar como CSV”.
        </div>
      </div>
    </div>

    <hr class="sep"/>

    <div class="row">
      <div class="col">
        <label>Filtrar por grupo</label>
        <select class="select" id="filterGroup">
          <option value="">— Todos —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>Exportar lista</label>
        <button class="btn" id="btnExportParticipants">Exportar CSV</button>
      </div>
    </div>
  `;

  if(group){
    html += `
      <div class="row">
        <div class="col">
          <label>Inscribir participante a ${groupLabel(group)}</label>
          <select class="select" id="enrollParticipant">
            ${participants.map(p=> `<option value="${p.id}">${p.apellidos}, ${p.nombres} — DNI ${p.dni}</option>`).join("")}
          </select>
        </div>
        <div class="col">
          <label>Turno</label>
          <select class="select" id="enrollTurno">${turnoOptions}</select>
        </div>
        <div class="col">
          <button class="btn primary" id="btnEnroll">Inscribir</button>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <label>Matrículas en el grupo</label>
          <table class="table">
            <thead><tr><th>Participante</th><th>DNI</th><th>UGEL</th><th>Turno</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${enrollsByGroup.map(e=>{
                const p = getParticipant(e.participantId);
                const t = db.turnos.find(t=>t.id===e.turnoId);
                return `
                  <tr>
                    <td>${p.apellidos}, ${p.nombres}</td>
                    <td>${p.dni}</td>
                    <td>${getUGELName(p.ugelId)}</td>
                    <td>${t ? t.nombre : ""}</td>
                    <td><span class="badge">${e.estado}</span></td>
                    <td><button class="btn" data-del-enroll="${e.id}">Quitar</button></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="6" class="small">No hay matrículas todavía.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }else{
    html += `
      <div class="note">
        Tip: selecciona un grupo arriba (filtro) para ver/gestionar matrículas del grupo.
      </div>
    `;
  }

  setView("Participantes", "Importar desde Excel (CSV), inscribir y exportar.", html);

  $("#btnTemplate").addEventListener("click", ()=>{
    const headers = ["dni","nombres","apellidos","email","telefono","ugel","grupo","turno"];
    const rows = [
      {dni:"12345678", nombres:"Juan", apellidos:"Pérez", email:"juan@ejemplo.pe", telefono:"+51 999 999 999", ugel:"UGEL Cusco", grupo:"G11", turno:"6:00 p.m. - 8:00 p.m."}
    ];
    downloadFile("plantilla_participantes.csv", toCSV(headers, rows), "text/csv");
  });

  $("#filterGroup").addEventListener("change", ()=>{
    const gid = $("#filterGroup").value;
    if(!gid) location.hash = "#participantes";
    else location.hash = "#participantes?grupo="+gid;
  });

  $("#btnExportParticipants").addEventListener("click", ()=>{
    const gid = $("#filterGroup").value;
    let rows = [];
    if(gid){
      const enrolls = db.enrollments.filter(e=>e.groupId===gid);
      rows = enrolls.map(e=>{
        const p = getParticipant(e.participantId);
        const t = db.turnos.find(t=>t.id===e.turnoId);
        const g = getGroupById(e.groupId);
        return {
          dni:p.dni, nombres:p.nombres, apellidos:p.apellidos, email:p.email, telefono:p.telefono,
          ugel:getUGELName(p.ugelId),
          grupo:g.codigoGrupo,
          turno: t ? t.nombre : ""
        };
      });
    }else{
      rows = db.participants.map(p=>({
        dni:p.dni, nombres:p.nombres, apellidos:p.apellidos, email:p.email, telefono:p.telefono, ugel:getUGELName(p.ugelId), grupo:"", turno:""
      }));
    }
    const headers = ["dni","nombres","apellidos","email","telefono","ugel","grupo","turno"];
    downloadFile("participantes_export.csv", toCSV(headers, rows), "text/csv");
  });

  $("#fileCSV").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const txt = await file.text();
    const parsed = parseCSV(txt);
    if(parsed.data.length === 0){
      alert("CSV vacío o inválido.");
      return;
    }

    // map UGEL name -> id (create if not exists)
    const ugelIdByName = (name)=>{
      if(!name) return null;
      let u = db.ugels.find(x=>x.nombre.toLowerCase()===name.toLowerCase());
      if(!u){
        u = {id: "UG"+(db.ugels.length+1), nombre:name};
        db.ugels.push(u);
      }
      return u.id;
    };

    let createdP = 0;
    let createdE = 0;
    parsed.data.forEach(r=>{
      const dni = (r.dni || "").trim();
      if(!dni) return;
      let p = db.participants.find(x=>x.dni===dni);
      if(!p){
        p = {
          id: uuid(),
          dni,
          nombres: r.nombres || "",
          apellidos: r.apellidos || "",
          email: r.email || "",
          telefono: r.telefono || "",
          ugelId: ugelIdByName(r.ugel || "")
        };
        db.participants.push(p);
        createdP++;
      }
      const grupoCode = (r.grupo || "").trim();
      if(grupoCode){
        const g = db.groups.find(g=>g.codigoGrupo===grupoCode) || null;
        if(g){
          const turnoName = (r.turno || "").trim();
          const turnos = getTurnosByGroup(g.id);
          const t = turnos.find(t=> t.nombre.toLowerCase()===turnoName.toLowerCase()) || turnos[0];
          const already = db.enrollments.some(e=> e.participantId===p.id && e.groupId===g.id);
          if(!already){
            db.enrollments.push({
              id: uuid(),
              participantId: p.id,
              groupId: g.id,
              turnoId: t ? t.id : null,
              estado:"INSCRITO",
              fechaMatricula: isoDate(new Date())
            });
            createdE++;
          }
        }
      }
    });

    saveDB();
    alert(`Importación lista: ${createdP} participantes nuevos, ${createdE} matrículas nuevas.`);
    renderRoute();
    e.target.value = "";
  });

  if(group){
    $("#btnEnroll").addEventListener("click", ()=>{
      const pid = $("#enrollParticipant").value;
      const tid = $("#enrollTurno").value;
      if(db.enrollments.some(e=>e.participantId===pid && e.groupId===group.id)){
        alert("Ya está inscrito en este grupo.");
        return;
      }
      db.enrollments.push({
        id: uuid(),
        participantId: pid,
        groupId: group.id,
        turnoId: tid || null,
        estado:"INSCRITO",
        fechaMatricula: isoDate(new Date())
      });
      saveDB();
      renderRoute();
    });

    document.querySelectorAll("[data-del-enroll]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-del-enroll");
        if(!confirm("¿Quitar matrícula?")) return;
        db.enrollments = db.enrollments.filter(e=>e.id!==id);
        // limpiar pagos/asistencia asociada
        db.payments = db.payments.filter(p=>p.enrollmentId!==id);
        db.attendance = db.attendance.filter(a=>a.enrollmentId!==id);
        saveDB();
        renderRoute();
      });
    });
  }
}

function renderAsistencia(params){
  const groupId = params.get("grupo") || "";
  const groupOptions = db.groups.map(g=> `<option value="${g.id}" ${g.id===groupId?"selected":""}>${groupLabel(g)}</option>`).join("");
  const group = groupId ? getGroupById(groupId) : null;

  let sessionOptions = "";
  let sessions = [];
  if(group){
    const turnos = getTurnosByGroup(group.id);
    sessions = db.sessions.filter(s=> turnos.some(t=>t.id===s.turnoId)).sort((a,b)=> (a.fecha+a.horaInicio).localeCompare(b.fecha+b.horaInicio));
    sessionOptions = sessions.map(s=>{
      const t = db.turnos.find(x=>x.id===s.turnoId);
      const st = getTemplate(s.sessionTemplateId);
      return `<option value="${s.id}">${fmtDate(s.fecha)} · ${t.nombre} · ${st.codigo}</option>`;
    }).join("");
  }

  const selectedSessionId = params.get("sesion") || (sessions[0]?.id ?? "");
  const ses = selectedSessionId ? db.sessions.find(s=>s.id===selectedSessionId) : null;

  let html = `
    <div class="row">
      <div class="col">
        <label>Grupo</label>
        <select class="select" id="selGroup">
          <option value="">— Selecciona —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>Sesión</label>
        <select class="select" id="selSession" ${group? "": "disabled"}>
          ${sessionOptions}
        </select>
      </div>
      <div class="col">
        <label>Exportar</label>
        <button class="btn" id="btnExportAttendance" ${ses? "":"disabled"}>Exportar CSV</button>
      </div>
      <div class="col">
        <label>Importar (CSV)</label>
        <input class="input" id="fileImportAttendance" type="file" accept=".csv,text/csv" ${ses? "":"disabled"}/>
      </div>
    </div>
  `;

  if(!ses){
    html += `<div class="note">Selecciona un grupo y una sesión para ver la lista de asistencia.</div>`;
    setView("Asistencia", "Marca asistencia por sesión (o importa CSV).", html);

    $("#selGroup").addEventListener("change", ()=> {
      const gid = $("#selGroup").value;
      location.hash = gid ? "#asistencia?grupo="+gid : "#asistencia";
    });
    return;
  }

  const turno = db.turnos.find(t=>t.id===ses.turnoId);
  const enrolls = db.enrollments.filter(e=> e.turnoId===turno.id);
  const st = getTemplate(ses.sessionTemplateId);

  const rows = enrolls.map(e=>{
    const p = getParticipant(e.participantId);
    const a = db.attendance.find(x=> x.sessionId===ses.id && x.enrollmentId===e.id);
    const checked = a ? a.presente : false;
    return `
      <tr>
        <td>${p.apellidos}, ${p.nombres}</td>
        <td>${p.dni}</td>
        <td>${getUGELName(p.ugelId)}</td>
        <td><input type="checkbox" data-att="${e.id}" ${checked?"checked":""}></td>
      </tr>
    `;
  }).join("");

  html += `
    <hr class="sep"/>
    <div class="note">
      <b>${groupLabel(getGroupById(turno.groupId))}</b><br/>
      Sesión: <b>${st.codigo}</b> · Fecha: <b>${fmtDate(ses.fecha)}</b> · Turno: <b>${turno.nombre}</b><br/>
      Zoom: <a href="${ses.zoomUrl}" target="_blank">${ses.zoomUrl}</a>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <button class="btn primary" id="btnSaveAttendance">Guardar asistencia</button>
      </div>
    </div>

    <table class="table" style="margin-top:10px">
      <thead><tr><th>Participante</th><th>DNI</th><th>UGEL</th><th>Presente</th></tr></thead>
      <tbody>
        ${rows || `<tr><td colspan="4" class="small">No hay matrículas en este turno.</td></tr>`}
      </tbody>
    </table>
  `;

  setView("Asistencia", "Marca asistencia por sesión (o importa CSV).", html);

  $("#selGroup").addEventListener("change", ()=> {
    const gid = $("#selGroup").value;
    location.hash = gid ? "#asistencia?grupo="+gid : "#asistencia";
  });
  $("#selSession").value = selectedSessionId;
  $("#selSession").addEventListener("change", ()=>{
    const sid = $("#selSession").value;
    location.hash = `#asistencia?grupo=${group.id}&sesion=${sid}`;
  });

  $("#btnSaveAttendance").addEventListener("click", ()=>{
    document.querySelectorAll("[data-att]").forEach(chk=>{
      const enrollmentId = chk.getAttribute("data-att");
      const presente = chk.checked;
      let a = db.attendance.find(x=> x.sessionId===ses.id && x.enrollmentId===enrollmentId);
      if(!a){
        a = {id: uuid(), sessionId: ses.id, enrollmentId, presente, fuente:"MANUAL", registradoEn: new Date().toISOString()};
        db.attendance.push(a);
      }else{
        a.presente = presente;
        a.fuente = a.fuente || "MANUAL";
        a.registradoEn = new Date().toISOString();
      }
    });
    saveDB();
    alert("Asistencia guardada (demo).");
  });

  $("#btnExportAttendance").addEventListener("click", ()=>{
    const headers = ["dni","apellidos","nombres","ugel","presente","fecha","sesion","turno","grupo"];
    const g = getGroupById(turno.groupId);
    const rows = enrolls.map(e=>{
      const p = getParticipant(e.participantId);
      const a = db.attendance.find(x=> x.sessionId===ses.id && x.enrollmentId===e.id);
      return {
        dni:p.dni,
        apellidos:p.apellidos,
        nombres:p.nombres,
        ugel:getUGELName(p.ugelId),
        presente: a ? (a.presente ? "1":"0") : "0",
        fecha: ses.fecha,
        sesion: st.codigo,
        turno: turno.nombre,
        grupo: g.codigoGrupo
      };
    });
    downloadFile(`asistencia_${g.codigoGrupo}_${st.codigo}_${ses.fecha}.csv`, toCSV(headers, rows), "text/csv");
  });

  $("#fileImportAttendance").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const txt = await file.text();
    const parsed = parseCSV(txt);
    // expecting dni + presente
    let updated = 0;
    parsed.data.forEach(r=>{
      const dni = (r.dni || "").trim();
      if(!dni) return;
      const p = db.participants.find(x=>x.dni===dni);
      if(!p) return;
      const enr = db.enrollments.find(en=>en.participantId===p.id && en.turnoId===turno.id);
      if(!enr) return;
      const presente = String(r.presente || r.Presente || r.presente_bool || "").trim();
      const val = (presente==="1" || presente.toLowerCase()==="true" || presente.toLowerCase()==="si");
      let a = db.attendance.find(x=> x.sessionId===ses.id && x.enrollmentId===enr.id);
      if(!a){
        db.attendance.push({id: uuid(), sessionId: ses.id, enrollmentId: enr.id, presente: val, fuente:"CSV", registradoEn: new Date().toISOString()});
      }else{
        a.presente = val;
        a.fuente = "CSV";
        a.registradoEn = new Date().toISOString();
      }
      updated++;
    });
    saveDB();
    alert(`Importación asistencia OK: ${updated} filas procesadas.`);
    renderRoute();
    e.target.value = "";
  });
}

function renderPagos(params){
  const groupId = params.get("grupo") || "";
  const groupOptions = db.groups.map(g=> `<option value="${g.id}" ${g.id===groupId?"selected":""}>${groupLabel(g)}</option>`).join("");
  const group = groupId ? getGroupById(groupId) : null;
  const enrolls = group ? db.enrollments.filter(e=> e.groupId===group.id) : [];
  const enrollOptions = enrolls.map(e=>{
    const p = getParticipant(e.participantId);
    return `<option value="${e.id}">${p.apellidos}, ${p.nombres} — DNI ${p.dni}</option>`;
  }).join("");

  let html = `
    <div class="row">
      <div class="col">
        <label>Grupo</label>
        <select class="select" id="selGroup">
          <option value="">— Selecciona —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>Registrar pago (matrícula)</label>
        <select class="select" id="selEnroll" ${group? "":"disabled"}>
          ${enrollOptions}
        </select>
      </div>
      <div class="col">
        <label>Monto</label>
        <input class="input" id="payAmount" type="number" step="0.01" placeholder="Ej: 50.00" ${group? "":"disabled"} />
      </div>
      <div class="col">
        <label>Método</label>
        <select class="select" id="payMethod" ${group? "":"disabled"}>
          <option>TRANSFERENCIA</option>
          <option>YAPE</option>
          <option>EFECTIVO</option>
          <option>OTRO</option>
        </select>
      </div>
      <div class="col">
        <label>Referencia</label>
        <input class="input" id="payRef" placeholder="Operación / yape / etc." ${group? "":"disabled"} />
      </div>
      <div class="col">
        <button class="btn primary" id="btnAddPay" ${group? "":"disabled"}>Registrar</button>
      </div>
    </div>
  `;

  if(!group){
    html += `<div class="note">Selecciona un grupo para ver y registrar pagos.</div>`;
    setView("Pagos de participantes", "Registro simple de pagos (Yape/transferencia).", html);
    $("#selGroup").addEventListener("change", ()=> {
      const gid = $("#selGroup").value;
      location.hash = gid ? "#pagos?grupo="+gid : "#pagos";
    });
    return;
  }

  // Table of payments by enrollment
  const v = getProgramVersion(group.programVersionId);
  const expected = Number(v.precioTotal || 0);

  const rows = enrolls.map(e=>{
    const p = getParticipant(e.participantId);
    const pays = db.payments.filter(x=>x.enrollmentId===e.id);
    const totalPaid = pays.reduce((s,x)=> s+Number(x.monto||0), 0);
    const status = (expected===0) ? "OK" : (totalPaid >= expected ? "OK" : (totalPaid>0 ? "PARCIAL":"PENDIENTE"));
    const badge = status==="OK" ? "ok" : (status==="PARCIAL" ? "warn":"bad");
    return `
      <tr>
        <td>${p.apellidos}, ${p.nombres}</td>
        <td>${p.dni}</td>
        <td>${money(totalPaid)}</td>
        <td>${expected ? money(expected) : "<span class='small'>—</span>"}</td>
        <td><span class="badge ${badge}">${status}</span></td>
        <td><button class="btn" data-open-pay="${e.id}">Ver pagos</button></td>
      </tr>
    `;
  }).join("");

  html += `
    <hr class="sep"/>
    <div class="note">
      <b>${groupLabel(group)}</b><br/>
      En demo, el “monto esperado” se toma de <code>programaVersion.precioTotal</code>. En el sistema real se usará plan/cuotas.
    </div>
    <table class="table" style="margin-top:10px">
      <thead><tr><th>Participante</th><th>DNI</th><th>Pagado</th><th>Esperado</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="small">No hay matrículas.</td></tr>`}</tbody>
    </table>

    <div id="payDetail" style="margin-top:12px"></div>
  `;

  setView("Pagos de participantes", "Registro simple de pagos (Yape/transferencia).", html);

  $("#selGroup").addEventListener("change", ()=> {
    const gid = $("#selGroup").value;
    location.hash = gid ? "#pagos?grupo="+gid : "#pagos";
  });

  $("#btnAddPay").addEventListener("click", ()=>{
    const enrId = $("#selEnroll").value;
    const amount = Number($("#payAmount").value);
    if(!enrId){ alert("Selecciona matrícula"); return; }
    if(!(amount>0)){ alert("Monto inválido"); return; }
    db.payments.push({
      id: uuid(),
      enrollmentId: enrId,
      fechaPago: new Date().toISOString(),
      monto: amount,
      metodo: $("#payMethod").value,
      referencia: $("#payRef").value.trim()
    });
    saveDB();
    $("#payAmount").value = "";
    $("#payRef").value = "";
    renderRoute();
  });

  document.querySelectorAll("[data-open-pay]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const enrId = btn.getAttribute("data-open-pay");
      const e = getEnrollment(enrId);
      const p = getParticipant(e.participantId);
      const pays = db.payments.filter(x=>x.enrollmentId===enrId).sort((a,b)=> (a.fechaPago).localeCompare(b.fechaPago));
      const rows = pays.map(x=>`
        <tr>
          <td>${fmtDate(x.fechaPago)}</td>
          <td>${money(x.monto)}</td>
          <td>${x.metodo}</td>
          <td>${x.referencia||""}</td>
          <td><button class="btn" data-del-pay="${x.id}">Eliminar</button></td>
        </tr>
      `).join("");
      $("#payDetail").innerHTML = `
        <div class="panel" style="margin-top:12px">
          <div class="panelHead">
            <div>
              <h2>Pagos — ${p.apellidos}, ${p.nombres} (DNI ${p.dni})</h2>
              <div class="hint">Registro de pagos para esta matrícula (demo).</div>
            </div>
          </div>
          <div class="panelBody">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="5" class="small">Sin pagos.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      `;
      document.querySelectorAll("[data-del-pay]").forEach(b=>{
        b.addEventListener("click", ()=>{
          const pid = b.getAttribute("data-del-pay");
          if(!confirm("¿Eliminar pago?")) return;
          db.payments = db.payments.filter(x=>x.id!==pid);
          saveDB();
          renderRoute();
        });
      });
    });
  });
}

function renderLMS(params){
  const groupId = params.get("grupo") || "";
  const groupOptions = db.groups.map(g=> `<option value="${g.id}" ${g.id===groupId?"selected":""}>${groupLabel(g)}</option>`).join("");
  const group = groupId ? getGroupById(groupId) : null;

  let html = `
    <div class="row">
      <div class="col">
        <label>Grupo</label>
        <select class="select" id="selGroup">
          <option value="">— Selecciona —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>Exportar credenciales</label>
        <button class="btn" id="btnExportCred" ${group? "":"disabled"}>Exportar CSV</button>
      </div>
    </div>
  `;

  if(!group){
    html += `<div class="note">Selecciona un grupo para generar credenciales.</div>`;
    setView("Credenciales Moodle/Classroom", "Generación interna de usuario/clave (demo).", html);
    $("#selGroup").addEventListener("change", ()=> {
      const gid = $("#selGroup").value;
      location.hash = gid ? "#lms?grupo="+gid : "#lms";
    });
    return;
  }

  const v = getProgramVersion(group.programVersionId);
  const platform = v.plataforma;
  const enrolls = db.enrollments.filter(e=>e.groupId===group.id);
  const existing = new Map(db.lmsAccounts.map(a=> [a.participantId, a]));

  const rows = enrolls.map(e=>{
    const p = getParticipant(e.participantId);
    const acc = existing.get(p.id);
    return `
      <tr>
        <td>${p.apellidos}, ${p.nombres}</td>
        <td>${p.dni}</td>
        <td>${acc ? `<code>${acc.usuario}</code>` : `<span class="badge warn">Pendiente</span>`}</td>
        <td>${acc ? `<code>${acc.passwordTemp||""}</code>` : ""}</td>
        <td><button class="btn" data-gen="${p.id}">Generar</button></td>
      </tr>
    `;
  }).join("");

  html += `
    <hr class="sep"/>
    <div class="note">
      <b>${groupLabel(group)}</b><br/>
      Plataforma de la versión: <b>${platform}</b>.<br/>
      En el sistema real, esto puede integrarse con Moodle vía API (tokens) o por import/export.
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <button class="btn primary" id="btnGenAll">Generar para todos</button>
      </div>
    </div>

    <table class="table" style="margin-top:10px">
      <thead><tr><th>Participante</th><th>DNI</th><th>Usuario</th><th>Password (temp)</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="small">No hay matrículas.</td></tr>`}</tbody>
    </table>
  `;

  setView("Credenciales Moodle/Classroom", "Generación interna de usuario/clave (demo).", html);

  $("#selGroup").addEventListener("change", ()=> {
    const gid = $("#selGroup").value;
    location.hash = gid ? "#lms?grupo="+gid : "#lms";
  });

  function genUsername(p){
    const base = (p.nombres||"x").split(" ")[0].slice(0,1).toLowerCase() + (p.apellidos||"").split(" ")[0].toLowerCase();
    const suf = p.dni ? p.dni.slice(-3) : String(Math.floor(Math.random()*900+100));
    let u = (base + suf).replace(/[^a-z0-9]/g,"");
    // uniqueness
    let k = 1;
    while(db.lmsAccounts.some(a=>a.usuario===u)){
      u = `${u}${k++}`;
    }
    return u;
  }
  function genPass(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    for(let i=0;i<8;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }
  function ensureAccount(pid){
    const p = getParticipant(pid);
    if(db.lmsAccounts.some(a=>a.participantId===pid)) return;
    db.lmsAccounts.push({
      id: uuid(),
      participantId: pid,
      tipo: platform,
      usuario: genUsername(p),
      passwordTemp: genPass(),
      creadoEn: new Date().toISOString()
    });
  }

  $("#btnGenAll").addEventListener("click", ()=>{
    enrolls.forEach(e=> ensureAccount(e.participantId));
    saveDB();
    renderRoute();
  });

  document.querySelectorAll("[data-gen]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const pid = btn.getAttribute("data-gen");
      ensureAccount(pid);
      saveDB();
      renderRoute();
    });
  });

  $("#btnExportCred").addEventListener("click", ()=>{
    const headers = ["dni","apellidos","nombres","ugel","usuario","password_temp","plataforma","grupo"];
    const rows = enrolls.map(e=>{
      const p = getParticipant(e.participantId);
      const acc = db.lmsAccounts.find(a=>a.participantId===p.id) || {};
      return {
        dni:p.dni,
        apellidos:p.apellidos,
        nombres:p.nombres,
        ugel:getUGELName(p.ugelId),
        usuario: acc.usuario || "",
        password_temp: acc.passwordTemp || "",
        plataforma: platform,
        grupo: group.codigoGrupo
      };
    });
    downloadFile(`credenciales_${group.codigoGrupo}.csv`, toCSV(headers, rows), "text/csv");
  });
}

function renderReportes(){
  const role = state.role;
  const user = getUser();
  let instructorId = "";
  if(role==="INSTRUCTOR"){
    instructorId = user.instructorId;
  }
  const instructorOptions = db.instructors.map(i=> `<option value="${i.id}" ${i.id===instructorId?"selected":""}>${i.nombres} ${i.apellidos}</option>`).join("");

  const now = new Date();
  const defaultYear = 2026;
  const defaultMonth = 1;

  const html = `
    <div class="note">
      Este reporte se genera a partir de sesiones dictadas (por turno) y replica el formato de tu “Informe mensual docente”.
      Para obtener <b>PDF</b>: se abre una vista imprimible y usas “Guardar como PDF”.
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Instructor</label>
        <select class="select" id="repInstructor">${instructorOptions}</select>
      </div>
      <div class="col">
        <label>Año</label>
        <input class="input" id="repYear" type="number" value="${defaultYear}"/>
      </div>
      <div class="col">
        <label>Mes</label>
        <input class="input" id="repMonth" type="number" min="1" max="12" value="${defaultMonth}"/>
      </div>
      <div class="col">
        <button class="btn primary" id="btnGenRep">Generar reporte</button>
      </div>
    </div>

    <hr class="sep"/>

    <div class="small">
      <b>Tip:</b> si estás en rol INSTRUCTOR, ya aparece seleccionado tu nombre.
    </div>
  `;

  setView("Informe docente (mensual)", "Genera reporte y “print → PDF”.", html);

  $("#btnGenRep").addEventListener("click", ()=>{
    const instId = $("#repInstructor").value;
    const year = Number($("#repYear").value);
    const month = Number($("#repMonth").value);
    openReportWindow(instId, year, month);
  });
}

function openReportWindow(instructorId, year, month){
  const inst = getInstructor(instructorId);
  if(!inst){ alert("Instructor no encontrado"); return; }

  // sesiones del mes
  const assigns = getAssignmentsByInstructor(inst.id);
  const turnoIds = assigns.map(a=>a.turnoId);

  const ses = db.sessions
    .filter(s=> turnoIds.includes(s.turnoId))
    .filter(s=>{
      const d = new Date(s.fecha+"T00:00:00");
      return d.getFullYear()===year && (d.getMonth()+1)===month;
    })
    .sort((a,b)=> (a.fecha+a.horaInicio).localeCompare(b.fecha+b.horaInicio));

  // detalles (como tu tabla DETALLES)
  const detailRows = ses.map(s=>{
    const t = db.turnos.find(x=>x.id===s.turnoId);
    const g = getGroupById(t.groupId);
    const st = getTemplate(s.sessionTemplateId);
    const hours = timeDiffHours(s.horaInicio, s.horaFin);
    const tarifa = inst.tarifaHora;
    const subtotal = hours * tarifa;
    return {
      course: groupLabel(g),
      sessionLabel: (st.codigo.match(/^\d+$/) ? `Sesión N°${st.codigo}` : st.codigo),
      fecha: fmtDate(s.fecha),
      horas: hours,
      subtotal
    };
  });

  // resumen cursos dictados (tabla 1)
  const byCourse = new Map();
  detailRows.forEach(r=>{
    const key = r.course;
    if(!byCourse.has(key)) byCourse.set(key, {course:key, horas:0, sesiones:0});
    const obj = byCourse.get(key);
    obj.horas += r.horas;
    obj.sesiones += 1;
  });

  const coursesSummary = Array.from(byCourse.values()).map(x=>{
    // estudiantes: cuenta matrículas del grupo (no del turno)
    const gcode = x.course.split(" - ").slice(-1)[0].trim();
    const grp = db.groups.find(g=> g.codigoGrupo===gcode) || null;
    const estudiantes = grp ? db.enrollments.filter(e=>e.groupId===grp.id).length : "";
    return {
      course:x.course,
      estudiantes,
      horas:x.horas,
      sesiones:x.sesiones
    };
  });

  // tabla 2: horarios (módulos) -> en realidad: grupo x turno
  const scheduleRows = [];
  // unique groups in report
  const groupIds = new Set(ses.map(s=> db.turnos.find(t=>t.id===s.turnoId)?.groupId).filter(Boolean));
  Array.from(groupIds).forEach(gid=>{
    const g = getGroupById(gid);
    getTurnosByGroup(gid).forEach(t=>{
      scheduleRows.push({
        asignatura: groupLabel(g),
        modalidad: g.modalidad,
        inicio: t.nombre.split("-")[0].trim(),
        fin: t.nombre.split("-")[1]?.trim() || ""
      });
    });
  });

  // remuneración final por tipo
  const remByType = new Map();
  detailRows.forEach(r=>{
    const gcode = r.course.split(" - ").slice(-1)[0].trim();
    const grp = db.groups.find(g=> g.codigoGrupo===gcode) || null;
    const tipo = grp ? programTypeFromGroup(grp) : "OTRO";
    if(!remByType.has(tipo)) remByType.set(tipo, {tipo, horas:0, total:0});
    const o = remByType.get(tipo);
    o.horas += r.horas;
    o.total += r.subtotal;
  });
  const remRows = Array.from(remByType.values());

  const totalRem = remRows.reduce((s,x)=>s+x.total,0);

  const cuentasHtml = inst.cuentas.map(c=> `
    <div>${c.banco} ${c.moneda} (${c.tipo}): <b>${c.numero}</b> · Titular: ${c.titular}</div>
  `).join("");

  const monthName = ["","ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SETIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"][month] || `MES ${month}`;
  const fechaInforme = `31/${String(month).padStart(2,"0")}/${year}`;

  const html = `
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Informe mensual - ${inst.nombres} ${inst.apellidos}</title>
    <style>
      body{font-family: Arial, sans-serif; color:#0f172a; margin:28px;}
      .hdr{display:flex; justify-content:space-between; align-items:flex-start; gap:14px;}
      .hdr h1{font-size:16px; margin:0;}
      .box{border:1px solid #cbd5e1; padding:10px 12px; border-radius:10px; margin-top:12px;}
      .k{width:90px; display:inline-block; font-weight:700;}
      table{border-collapse: collapse; width:100%; font-size:12px; margin-top:8px;}
      th,td{border:1px solid #cbd5e1; padding:8px 7px; text-align:left;}
      th{background:#e2e8f0;}
      .tcenter{text-align:center;}
      .tright{text-align:right;}
      .muted{color:#475569;}
      .btn{position:fixed; top:18px; right:18px; padding:10px 12px; border:1px solid #0ea5e9; background:#0ea5e9; color:white; border-radius:10px; cursor:pointer;}
      @media print{ .btn{display:none;} body{margin:0;} }
    </style>
  </head>
  <body>
    <button class="btn" onclick="window.print()">Guardar / Imprimir (PDF)</button>

    <div class="hdr">
      <div>
        <h1>INFORME FINAL MENSUAL</h1>
        <div class="muted">Mes: <b>${monthName}</b> · Año: <b>${year}</b></div>
      </div>
      <div class="muted">Fecha: <b>${fechaInforme}</b></div>
    </div>

    <div class="box">
      <div><span class="k">A:</span> Mag. Marco Antonio Chambilla Bailón — <span class="muted">Gerente General Grupo Educativo EMTEL</span></div>
      <div><span class="k">De:</span> Prof. ${inst.nombres} ${inst.apellidos} — <span class="muted">Instructor</span></div>
      <div><span class="k">Asunto:</span> Informe de actividades por áreas</div>
    </div>

    <div class="box">
      Previo un cordial saludo, y en cumplimiento de la labor docente asignada, se informa sobre las actividades académicas desarrolladas durante el mes de <b>${monthName}</b> de <b>${year}</b>, incluyendo asistencia y demás acciones pertinentes.
    </div>

    <div class="box">
      <b>1. CURSOS DICTADOS</b>
      <table>
        <thead>
          <tr><th>Curso</th><th class="tcenter">N° Estudiantes</th><th class="tcenter">Horas</th><th class="tcenter">Sesiones</th></tr>
        </thead>
        <tbody>
          ${coursesSummary.map(r=>`
            <tr>
              <td>${r.course}</td>
              <td class="tcenter">${r.estudiantes ?? ""}</td>
              <td class="tcenter">${r.horas}</td>
              <td class="tcenter">${r.sesiones}</td>
            </tr>
          `).join("")}
          <tr>
            <td><b>Suma total</b></td>
            <td class="tcenter"><b>${coursesSummary.reduce((s,x)=>s+(Number(x.estudiantes)||0),0)}</b></td>
            <td class="tcenter"><b>${coursesSummary.reduce((s,x)=>s+x.horas,0)}</b></td>
            <td class="tcenter"><b>${coursesSummary.reduce((s,x)=>s+x.sesiones,0)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="box">
      <b>2. MÓDULOS / HORARIOS (TURNOS)</b>
      <table>
        <thead><tr><th>Asignatura</th><th class="tcenter">Modalidad</th><th class="tcenter">Hora inicio</th><th class="tcenter">Hora final</th></tr></thead>
        <tbody>
          ${scheduleRows.map(r=>`
            <tr>
              <td>${r.asignatura}</td>
              <td class="tcenter">${r.modalidad}</td>
              <td class="tcenter">${r.inicio}</td>
              <td class="tcenter">${r.fin}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="box">
      <b>3. DETALLES</b>
      <table>
        <thead><tr><th>Curso</th><th class="tcenter">Sesión</th><th class="tcenter">Fecha</th><th class="tcenter">Horas</th><th class="tcenter">Subtotal</th></tr></thead>
        <tbody>
          ${detailRows.map(r=>`
            <tr>
              <td>${r.course}</td>
              <td class="tcenter">${r.sessionLabel}</td>
              <td class="tcenter">${r.fecha}</td>
              <td class="tcenter">${r.horas}</td>
              <td class="tcenter">${money(r.subtotal)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="box">
      <b>3. REMUNERACIÓN FINAL</b>
      <table>
        <thead><tr><th>Tipo</th><th class="tcenter">N° horas</th><th class="tcenter">Remuneración</th></tr></thead>
        <tbody>
          ${remRows.map(r=>`
            <tr>
              <td>${r.tipo}</td>
              <td class="tcenter">${r.horas}</td>
              <td class="tcenter">${money(r.total)}</td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="2"><b>REMUNERACIÓN FINAL</b></td>
            <td class="tcenter"><b>${money(totalRem)}</b></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:10px" class="muted">
        ${cuentasHtml}
      </div>
    </div>

    <div class="box">
      <b>4. DIFICULTADES</b> — Ninguna
      <br/><b>5. RECOMENDACIONES</b> — Ninguna
      <div style="margin-top:16px">Es cuanto informo a su despacho para los fines consiguientes.</div>
      <div style="margin-top:18px"><b>Atentamente;</b></div>
      <div style="margin-top:42px; border-top:1px solid #cbd5e1; width:260px; padding-top:8px">
        ${inst.nombres} ${inst.apellidos}<br/>INSTRUCTOR
      </div>
    </div>
  </body>
  </html>
  `;

  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function renderAyuda(){
  const html = `
    <div class="note">
      <b>¿Qué es esto?</b><br/>
      Un prototipo para visualizar cómo se sentiría un ERP académico mínimo.
      No usa servidor ni base de datos: todo se guarda en <code>LocalStorage</code> del navegador.
    </div>

    <div class="gridCards" style="margin-top:12px">
      <div class="card">
        <h3>1) Importar desde Excel</h3>
        <div class="muted">
          En Excel: “Guardar como” → <b>CSV</b>.
          Luego importa en <b>Participantes</b>.
        </div>
      </div>
      <div class="card">
        <h3>2) Grupos y horarios</h3>
        <div class="muted">
          Crea grupos, turnos (6–8, 8–10), asigna instructores y registra sesiones.
        </div>
      </div>
      <div class="card">
        <h3>3) Asistencia</h3>
        <div class="muted">
          Marca por sesión o importa un CSV (formato: dni,presente).
        </div>
      </div>
      <div class="card">
        <h3>4) Pagos</h3>
        <div class="muted">
          Registro simple de pagos (Yape/transferencia).
        </div>
      </div>
      <div class="card">
        <h3>5) Informe mensual (PDF)</h3>
        <div class="muted">
          Genera informe y usa “Guardar como PDF” desde el navegador.
        </div>
      </div>
    </div>

    <hr class="sep"/>

    <div class="note">
      <b>Limitaciones de la demo:</b>
      <ul>
        <li>No hay multiusuario real ni permisos reales.</li>
        <li>No hay base de datos real (solo navegador).</li>
        <li>Importa CSV (no XLSX). En el sistema real se soporta XLSX con backend.</li>
      </ul>
    </div>
  `;
  setView("Cómo usar esta demo", "Guía rápida y limitaciones.", html);
}


function renderProgramas(params){
  if(state.role !== "ADMIN"){
    setView("Programas", "Solo ADMIN puede crear/editar programas en esta demo.", `<div class="note">Acceso restringido para tu rol actual.</div>`);
    return;
  }

  const programId = params.get("program") || (db.programs[0]?.id || "");
  const program = programId ? db.programs.find(p=>p.id===programId) : null;
  const versions = program ? db.programVersions.filter(v=>v.programId===program.id) : [];
  const versionId = params.get("version") || (versions[0]?.id || "");
  const version = versionId ? db.programVersions.find(v=>v.id===versionId) : null;

  const programOptions = db.programs
    .slice()
    .sort((a,b)=> (a.nombre||"").localeCompare(b.nombre||""))
    .map(p=> `<option value="${p.id}" ${p.id===programId?"selected":""}>${p.nombre} (${p.tipo})</option>`)
    .join("");

  const versionOptions = versions
    .slice()
    .sort((a,b)=> (a.codigo||"").localeCompare(b.codigo||""))
    .map(v=> `<option value="${v.id}" ${v.id===versionId?"selected":""}>v${v.codigo} — ${v.plataforma}${v.activo===false?" (inactiva)":""}</option>`)
    .join("");

  const tpl = version ? db.sessionTemplates.filter(t=>t.programVersionId===version.id) : [];
  const tplRows = tpl
    .slice()
    .sort((a,b)=> String(a.codigo||"").localeCompare(String(b.codigo||"")))
    .map(t=> `
      <tr>
        <td><b>${t.codigo}</b></td>
        <td>${t.titulo || ""}</td>
        <td><span class="badge">${t.tipo}</span></td>
        <td>${t.duracionMin || 120} min</td>
        <td><button class="btn" data-del-tpl="${t.id}">Eliminar</button></td>
      </tr>
    `).join("");

  const html = `
    <div class="note">
      Aquí (solo <b>ADMIN</b>) creas <b>cursos/diplomados</b> y sus <b>versiones</b>.<br/>
      Luego, en “Grupos y horarios” creas <b>G1, G2, G3...</b> y lo asocias a una versión.
    </div>

    <hr class="sep"/>

    <h3 style="margin:0 0 8px 0; font-size:13px;">1) Crear programa</h3>
    <div class="row">
      <div class="col">
        <label>Tipo</label>
        <select class="select" id="newProgTipo">
          <option value="DIPLOMADO">DIPLOMADO</option>
          <option value="CURSO">CURSO</option>
          <option value="CURSO_EXTENSIVO">CURSO_EXTENSIVO</option>
          <option value="OTRO">OTRO</option>
        </select>
      </div>
      <div class="col" style="flex:2; min-width:260px">
        <label>Nombre</label>
        <input class="input" id="newProgNombre" placeholder="Ej: IA aplicada a la pedagogía"/>
      </div>
      <div class="col">
        <label>Activo</label>
        <select class="select" id="newProgActivo">
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </div>
      <div class="col">
        <button class="btn primary" id="btnCreateProgram">Crear</button>
      </div>
    </div>

    <hr class="sep"/>

    <h3 style="margin:0 0 8px 0; font-size:13px;">2) Seleccionar programa</h3>
    <div class="row">
      <div class="col" style="flex:2; min-width:260px">
        <label>Programa</label>
        <select class="select" id="selProgram">
          <option value="">— Selecciona —</option>
          ${programOptions}
        </select>
      </div>
      <div class="col">
        <label>Estado</label>
        ${program ? `<span class="badge ${program.activo===false?"warn":"ok"}">${program.activo===false?"INACTIVO":"ACTIVO"}</span>` : `<span class="badge">—</span>`}
      </div>
      <div class="col">
        <label>&nbsp;</label>
        <button class="btn danger" id="btnDeleteProgram" ${program?"":"disabled"}>Eliminar programa</button>
      </div>
    </div>

    <hr class="sep"/>

    <h3 style="margin:0 0 8px 0; font-size:13px;">3) Versiones del programa</h3>
    ${program ? `
      <div class="row">
        <div class="col" style="flex:2; min-width:260px">
          <label>Versión</label>
          <select class="select" id="selVersion">
            <option value="">— Selecciona —</option>
            ${versionOptions}
          </select>
        </div>
        <div class="col">
          <label>&nbsp;</label>
          <button class="btn danger" id="btnDeleteVersion" ${version?"":"disabled"}>Eliminar versión</button>
        </div>
      </div>

      <div class="row">
        <div class="col">
          <label>Nuevo código versión</label>
          <input class="input" id="newVerCodigo" placeholder="Ej: 2026.02"/>
        </div>
        <div class="col">
          <label>Plataforma</label>
          <select class="select" id="newVerPlat">
            <option value="MOODLE">MOODLE</option>
            <option value="CLASSROOM">CLASSROOM</option>
            <option value="OTRO">OTRO</option>
          </select>
        </div>
        <div class="col">
          <label>Sesiones sugeridas</label>
          <input class="input" id="newVerSes" type="number" min="0" value="8"/>
        </div>
        <div class="col">
          <label>Certificado incluido</label>
          <select class="select" id="newVerCert">
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
        <div class="col">
          <label>Costo certificado (si aplica)</label>
          <input class="input" id="newVerCostoCert" type="number" min="0" value="0"/>
        </div>
        <div class="col">
          <label>&nbsp;</label>
          <button class="btn primary" id="btnCreateVersion">Crear versión</button>
        </div>
      </div>

      <div class="note" style="margin-top:10px">
        Tip: luego de crear una versión, puedes <b>generar plantillas de sesión</b> (1..N) o añadir códigos manuales (ej: I1).
      </div>

      <hr class="sep"/>

      <h3 style="margin:0 0 8px 0; font-size:13px;">4) Plantillas de sesión (por versión)</h3>
      ${version ? `
        <div class="row">
          <div class="col">
            <label>Generar 1..N (sincrónicas)</label>
            <input class="input" id="genTplN" type="number" min="1" value="${version.sesionesSugeridas || 8}"/>
          </div>
          <div class="col">
            <label>Duración (min)</label>
            <input class="input" id="genTplDur" type="number" min="30" value="120"/>
          </div>
          <div class="col">
            <label>&nbsp;</label>
            <button class="btn primary" id="btnGenTemplates">Generar</button>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Código</label>
            <input class="input" id="newTplCodigo" placeholder="Ej: 1 o I1"/>
          </div>
          <div class="col" style="flex:2; min-width:260px">
            <label>Título</label>
            <input class="input" id="newTplTitulo" placeholder="Ej: Introducción a IA"/>
          </div>
          <div class="col">
            <label>Tipo</label>
            <select class="select" id="newTplTipo">
              <option value="SINCRONICA">SINCRONICA</option>
              <option value="ASINCRONICA">ASINCRONICA</option>
            </select>
          </div>
          <div class="col">
            <label>Duración (min)</label>
            <input class="input" id="newTplDur" type="number" min="30" value="120"/>
          </div>
          <div class="col">
            <label>&nbsp;</label>
            <button class="btn primary" id="btnAddTemplate">Agregar</button>
          </div>
        </div>

        <table class="table" style="margin-top:10px">
          <thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Duración</th><th></th></tr></thead>
          <tbody>
            ${tplRows || `<tr><td colspan="5" class="small">No hay plantillas aún.</td></tr>`}
          </tbody>
        </table>
      ` : `<div class="note">Selecciona una versión para gestionar plantillas.</div>`}
    ` : `<div class="note">Crea o selecciona un programa para continuar.</div>`}
  `;

  setView("Programas (Admin)", "Crear programas, versiones y plantillas de sesión.", html);

  // Handlers
  const selProgram = document.getElementById("selProgram");
  if(selProgram){
    selProgram.addEventListener("change", ()=>{
      const pid = selProgram.value;
      location.hash = pid ? ("#programas?program="+encodeURIComponent(pid)) : "#programas";
    });
  }
  const selVersion = document.getElementById("selVersion");
  if(selVersion){
    selVersion.addEventListener("change", ()=>{
      const pid = document.getElementById("selProgram").value;
      const vid = selVersion.value;
      const qs = [];
      if(pid) qs.push("program="+encodeURIComponent(pid));
      if(vid) qs.push("version="+encodeURIComponent(vid));
      location.hash = "#programas" + (qs.length?("?"+qs.join("&")):"");
    });
  }

  const btnCreateProgram = document.getElementById("btnCreateProgram");
  if(btnCreateProgram){
    btnCreateProgram.addEventListener("click", ()=>{
      const tipo = document.getElementById("newProgTipo").value;
      const nombre = document.getElementById("newProgNombre").value.trim();
      const activo = document.getElementById("newProgActivo").value === "true";
      if(!nombre){ alert("Nombre requerido."); return; }
      const p = {id: uuid(), tipo, nombre, activo};
      db.programs.push(p);
      saveDB();
      location.hash = "#programas?program="+encodeURIComponent(p.id);
    });
  }

  const btnDeleteProgram = document.getElementById("btnDeleteProgram");
  if(btnDeleteProgram){
    btnDeleteProgram.addEventListener("click", ()=>{
      if(!program) return;
      const hasGroups = db.groups.some(g=>{
        const v = getProgramVersion(g.programVersionId);
        return v && v.programId===program.id;
      });
      if(hasGroups){
        alert("No se puede eliminar: hay grupos creados para este programa.");
        return;
      }
      if(!confirm("¿Eliminar programa?")) return;
      db.programs = db.programs.filter(p=>p.id!==program.id);
      db.programVersions = db.programVersions.filter(v=>v.programId!==program.id);
      db.sessionTemplates = db.sessionTemplates.filter(t=>{
        const v = getProgramVersion(t.programVersionId);
        return v && v.programId!==program.id;
      });
      saveDB();
      location.hash = "#programas";
    });
  }

  const btnCreateVersion = document.getElementById("btnCreateVersion");
  if(btnCreateVersion){
    btnCreateVersion.addEventListener("click", ()=>{
      if(!program) return;
      const codigo = document.getElementById("newVerCodigo").value.trim();
      const plataforma = document.getElementById("newVerPlat").value;
      const sesiones = Number(document.getElementById("newVerSes").value || 0);
      const certIncl = document.getElementById("newVerCert").value === "true";
      const costoCert = Number(document.getElementById("newVerCostoCert").value || 0);
      if(!codigo){ alert("Código de versión requerido."); return; }
      const v = {
        id: uuid(),
        programId: program.id,
        codigo,
        plataforma,
        precioTotal: 0,
        mensualidadRef: 0,
        certificadoIncluido: certIncl,
        costoCertificado: costoCert,
        activo: true,
        sesionesSugeridas: sesiones
      };
      db.programVersions.push(v);

      // opcional: crear plantillas 1..N automáticamente si sesiones > 0
      if(sesiones > 0){
        for(let i=1;i<=sesiones;i++){
          db.sessionTemplates.push({
            id: uuid(),
            programVersionId: v.id,
            codigo: String(i),
            titulo: `Sesión ${i}`,
            tipo: "SINCRONICA",
            duracionMin: 120
          });
        }
      }

      saveDB();
      location.hash = "#programas?program="+encodeURIComponent(program.id)+"&version="+encodeURIComponent(v.id);
    });
  }

  const btnDeleteVersion = document.getElementById("btnDeleteVersion");
  if(btnDeleteVersion){
    btnDeleteVersion.addEventListener("click", ()=>{
      if(!version) return;
      const hasGroup = db.groups.some(g=> g.programVersionId===version.id);
      if(hasGroup){
        alert("No se puede eliminar: hay grupos creados con esta versión.");
        return;
      }
      if(!confirm("¿Eliminar versión?")) return;
      db.programVersions = db.programVersions.filter(v=>v.id!==version.id);
      db.sessionTemplates = db.sessionTemplates.filter(t=>t.programVersionId!==version.id);
      saveDB();
      location.hash = "#programas?program="+encodeURIComponent(program.id);
    });
  }

  const btnGenTemplates = document.getElementById("btnGenTemplates");
  if(btnGenTemplates){
    btnGenTemplates.addEventListener("click", ()=>{
      if(!version) return;
      const n = Number(document.getElementById("genTplN").value || 0);
      const dur = Number(document.getElementById("genTplDur").value || 120);
      if(n<=0){ alert("N debe ser mayor a 0."); return; }
      const existingCodes = new Set(db.sessionTemplates.filter(t=>t.programVersionId===version.id).map(t=>String(t.codigo)));
      let created = 0;
      for(let i=1;i<=n;i++){
        const code = String(i);
        if(existingCodes.has(code)) continue;
        db.sessionTemplates.push({
          id: uuid(),
          programVersionId: version.id,
          codigo: code,
          titulo: `Sesión ${code}`,
          tipo: "SINCRONICA",
          duracionMin: dur
        });
        created++;
      }
      saveDB();
      alert(`Plantillas creadas: ${created}.`);
      renderRoute();
    });
  }

  const btnAddTemplate = document.getElementById("btnAddTemplate");
  if(btnAddTemplate){
    btnAddTemplate.addEventListener("click", ()=>{
      if(!version) return;
      const codigo = document.getElementById("newTplCodigo").value.trim();
      const titulo = document.getElementById("newTplTitulo").value.trim();
      const tipo = document.getElementById("newTplTipo").value;
      const dur = Number(document.getElementById("newTplDur").value || 120);
      if(!codigo){ alert("Código requerido."); return; }
      const exists = db.sessionTemplates.some(t=>t.programVersionId===version.id && String(t.codigo)===String(codigo));
      if(exists){ alert("Ya existe una plantilla con ese código."); return; }
      db.sessionTemplates.push({
        id: uuid(),
        programVersionId: version.id,
        codigo,
        titulo: titulo || `Sesión ${codigo}`,
        tipo,
        duracionMin: dur
      });
      saveDB();
      renderRoute();
    });
  }

  document.querySelectorAll("[data-del-tpl]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del-tpl");
      if(!confirm("¿Eliminar plantilla?")) return;
      db.sessionTemplates = db.sessionTemplates.filter(t=>t.id!==id);
      saveDB();
      renderRoute();
    });
  });
}

function renderCalendario(params){
  const role = state.role;
  const user = getUser();

  // Determinar mes por defecto (último mes que aparece en sesiones, o el mes actual)
  let defaultMonth = (()=>{
    if(db.sessions.length===0) return new Date().toISOString().slice(0,7);
    const max = db.sessions
      .map(s=>s.fecha)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    return (max || new Date().toISOString().slice(0,7)).slice(0,7);
  })();

  const month = params.get("mes") || defaultMonth; // YYYY-MM
  let programFilter = params.get("program") || "";
  let groupFilter = params.get("grupo") || "";

  // Restricción por instructor: solo ve sus turnos
  let allowedTurnoIds = null;
  if(role==="INSTRUCTOR"){
    const inst = getInstructorFromUser();
    const assigns = getAssignmentsByInstructor(inst.id);
    allowedTurnoIds = new Set(assigns.map(a=>a.turnoId));
  }

  // Programas visibles (si instructor: solo los suyos)
  const visibleGroups = db.groups.filter(g=>{
    if(!allowedTurnoIds) return true;
    const turnos = getTurnosByGroup(g.id);
    return turnos.some(t=> allowedTurnoIds.has(t.id));
  });

  const visiblePrograms = db.programs.filter(p=>{
    if(!allowedTurnoIds) return true;
    // al menos un grupo visible con ese programa
    return visibleGroups.some(g=>{
      const v = getProgramVersion(g.programVersionId);
      return v && v.programId===p.id;
    });
  });

  // Si hay grupo pero no programa, inferimos
  if(groupFilter && !programFilter){
    const gg = getGroupById(groupFilter);
    if(gg){
      const vv = getProgramVersion(gg.programVersionId);
      programFilter = vv ? vv.programId : "";
    }
  }

  const programOptions = visiblePrograms
    .slice()
    .sort((a,b)=> (a.nombre||"").localeCompare(b.nombre||""))
    .map(p=> `<option value="${p.id}" ${p.id===programFilter?"selected":""}>${p.nombre} (${p.tipo})</option>`)
    .join("");

  const groupsByProgram = programFilter
    ? visibleGroups.filter(g=>{
        const v = getProgramVersion(g.programVersionId);
        return v && v.programId===programFilter;
      })
    : visibleGroups;

  const groupOptions = groupsByProgram
    .slice()
    .sort((a,b)=> groupLabel(a).localeCompare(groupLabel(b)))
    .map(g=> `<option value="${g.id}" ${g.id===groupFilter?"selected":""}>${groupLabel(g)}</option>`)
    .join("");

  // Filtrar sesiones del mes
  const monthSessions = db.sessions
    .filter(s=> (s.fecha||"").slice(0,7)===month)
    .filter(s=>{
      if(!allowedTurnoIds) return true;
      return allowedTurnoIds.has(s.turnoId);
    })
    .filter(s=>{
      if(!programFilter && !groupFilter) return true;
      const t = db.turnos.find(t=>t.id===s.turnoId);
      if(!t) return false;
      const g = getGroupById(t.groupId);
      if(!g) return false;

      if(groupFilter) return g.id===groupFilter;

      const v = getProgramVersion(g.programVersionId);
      return v && v.programId===programFilter;
    })
    .sort((a,b)=> (a.fecha+a.horaInicio).localeCompare(b.fecha+b.horaInicio));

  // Agrupar por fecha
  const byDate = {};
  monthSessions.forEach(s=>{
    byDate[s.fecha] = byDate[s.fecha] || [];
    byDate[s.fecha].push(s);
  });
  const dates = Object.keys(byDate).sort();

  const html = `
    <div class="note">
      Calendario (vista lista) de sesiones del mes. Útil para ADMIN/COORD (planificación) y para INSTRUCTOR (qué toca hoy + link).
    </div>

    <div class="row" style="margin-top:10px">
      <div class="col">
        <label>Mes</label>
        <input class="input" id="calMonth" type="month" value="${month}"/>
      </div>
      <div class="col" style="flex:2; min-width:260px">
        <label>Filtrar por programa</label>
        <select class="select" id="calProgram">
          <option value="">— Todos —</option>
          ${programOptions}
        </select>
      </div>
      <div class="col" style="flex:2; min-width:260px">
        <label>Filtrar por grupo</label>
        <select class="select" id="calGroup">
          <option value="">— Todos —</option>
          ${groupOptions}
        </select>
      </div>
      <div class="col">
        <label>&nbsp;</label>
        <button class="btn" id="calClear">Limpiar</button>
      </div>
    </div>

    <hr class="sep"/>

    <div class="kpi">
      <div class="box"><b>${monthSessions.length}</b><span>Sesiones en ${month}</span></div>
      <div class="box"><b>${dates.length}</b><span>Días con sesiones</span></div>
    </div>

    <hr class="sep"/>

    ${dates.length===0 ? `<div class="note">No hay sesiones para este mes/filtro.</div>` : dates.map(d=>{
      const rows = byDate[d].map(s=>{
        const t = db.turnos.find(x=>x.id===s.turnoId);
        const g = t ? getGroupById(t.groupId) : null;
        const st = getTemplate(s.sessionTemplateId);
        return `
          <tr>
            <td>${s.horaInicio}–${s.horaFin}</td>
            <td>${g ? groupLabel(g) : ""}</td>
            <td>${t ? t.nombre : ""}</td>
            <td><b>${st ? st.codigo : ""}</b></td>
            <td>${s.zoomUrl ? `<a href="${s.zoomUrl}" target="_blank">Abrir</a>` : `<span class="badge warn">Sin link</span>`}</td>
            <td><span class="badge">${s.estado}</span></td>
            <td>${g ? `<button class="btn" data-open-group="${g.id}">Ir a grupo</button>` : ""}</td>
          </tr>
        `;
      }).join("");

      return `
        <div class="card" style="margin-bottom:12px">
          <h3 style="margin:0 0 8px 0;">${fmtDate(d)}</h3>
          <table class="table">
            <thead><tr><th>Hora</th><th>Grupo</th><th>Turno</th><th>Sesión</th><th>Zoom</th><th>Estado</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join("")}
  `;

  setView("Calendario", "Sesiones del mes con filtros.", html);

  // Handlers filtros
  document.getElementById("calMonth").addEventListener("change", ()=>{
    const mes = document.getElementById("calMonth").value;
    const pid = document.getElementById("calProgram").value;
    const gid = document.getElementById("calGroup").value;
    const qs = [];
    if(mes) qs.push("mes="+encodeURIComponent(mes));
    if(pid) qs.push("program="+encodeURIComponent(pid));
    if(gid) qs.push("grupo="+encodeURIComponent(gid));
    location.hash = "#calendario" + (qs.length?("?"+qs.join("&")):"");
  });

  document.getElementById("calProgram").addEventListener("change", ()=>{
    const mes = document.getElementById("calMonth").value;
    const pid = document.getElementById("calProgram").value;
    // al cambiar programa, limpiar grupo
    const qs = [];
    if(mes) qs.push("mes="+encodeURIComponent(mes));
    if(pid) qs.push("program="+encodeURIComponent(pid));
    location.hash = "#calendario" + (qs.length?("?"+qs.join("&")):"");
  });

  document.getElementById("calGroup").addEventListener("change", ()=>{
    const mes = document.getElementById("calMonth").value;
    const pid = document.getElementById("calProgram").value;
    const gid = document.getElementById("calGroup").value;
    const qs = [];
    if(mes) qs.push("mes="+encodeURIComponent(mes));
    if(pid) qs.push("program="+encodeURIComponent(pid));
    if(gid) qs.push("grupo="+encodeURIComponent(gid));
    location.hash = "#calendario" + (qs.length?("?"+qs.join("&")):"");
  });

  document.getElementById("calClear").addEventListener("click", ()=>{
    const mes = document.getElementById("calMonth").value;
    location.hash = "#calendario?mes="+encodeURIComponent(mes);
  });

  document.querySelectorAll("[data-open-group]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const gid = btn.getAttribute("data-open-group");
      location.hash = "#grupo="+gid;
    });
  });
}


// ---------------- Router ----------------
function parseParams(){
  const hash = location.hash || "#dashboard";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  return {path, params};
}

function renderRoute(){
  renderNav();

  const {path, params} = parseParams();

  // rutas especiales
  if(path.startsWith("#grupo=")){
    const gid = path.split("=")[1];
    renderGrupoDetalle(gid);
    return;
  }

  switch(path){
    case "#dashboard":
    case "":
    case "#":
      renderDashboard(params); break;
    case "#programas":
      renderProgramas(params); break;
    case "#grupos":
      renderGrupos(); break;
    case "#calendario":
      renderCalendario(params); break;
    case "#participantes":
      renderParticipantes(params); break;
    case "#asistencia":
      renderAsistencia(params); break;
    case "#pagos":
      renderPagos(params); break;
    case "#lms":
      renderLMS(params); break;
    case "#reportes":
      renderReportes(); break;
    case "#ayuda":
      renderAyuda(); break;
    default:
      renderDashboard(params);
  }
}

// ---------------- Init ----------------
function init(){
  bindTopbar();
  renderNav();
  if(!location.hash) location.hash = "#dashboard";
  renderRoute();
  window.addEventListener("hashchange", renderRoute);
}

init();