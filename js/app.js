/* js/app.js
   Longenix Health — App shell
   - Landing page (country, provider, manual intake, lab upload, scenarios, history)
   - Intake UI (demographics, biometrics, labs, lifestyle, family history, ATMs, systems, hallmarks, MBS)
   - Save/open previous clients, render report, PDF export
*/
'use strict';

let AppState = { config:null, session:{country:'Australia', provider:'', history:[]}, client:null };
const $ = (q)=>document.querySelector(q);

// ---- boot helpers -----------------------------------------------------------
async function loadConfig(){
  const r = await fetch('data/config.json');
  AppState.config = await r.json();
  await Storage.init(AppState.config);
}
async function loadFixtures(){
  try{
    const r = await fetch('fixtures/hypothetical_clients.json', {cache:'no-cache'});
    if (!r.ok) return [];
    return await r.json();
  }catch{ return []; }
}
function setCountry(c){ AppState.session.country=c; Storage.save('session', AppState.session); renderLanding(window.__fixtures||[]); }
function setProvider(p){ AppState.session.provider=p; Storage.save('session', AppState.session); }

// ---- landing ---------------------------------------------------------------
function renderLanding(fixtures){
  const mount = $('#app');
  mount.innerHTML = `
  <div class="container">
    <div class="card">
      <header class="top brand">
        <img src="assets/logo.svg" alt="logo"/>
        <div>
          <div class="title">${AppState.config.branding.org}</div>
          <div class="hint">${AppState.config.branding.tagline}</div>
        </div>
      </header>
      <h1>${AppState.config.branding.modelName}</h1>
      <p class="hint">All processing is local in your browser. No data leaves this device.</p>
      <div class="grid cols-3">
        <div>
          <div class="label">Country</div>
          <select id="countrySel" class="input">
            ${["USA","Australia","Philippines"].map(c=>`<option ${AppState.session.country===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="label">Provider/Clinic name</div>
          <input id="provider" class="input" placeholder="e.g., Dr. Graham Player" value="${AppState.session.provider||""}"/>
        </div>
        <div>
          <div class="label">Brand</div>
          <div>${AppState.config.branding.org} — ${AppState.config.branding.tagline}</div>
        </div>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="card">
        <h3>Enter data manually</h3>
        <p>Complete a guided intake.</p>
        <button class="primary" id="startManual">Start intake</button>
      </div>

      <div class="card">
        <h3>Upload lab results</h3>
        <p>CSV / XLSX / text-based PDF (no OCR).</p>
        <input type="file" id="labFile" accept=".csv,.xlsx,.xls,.pdf,.txt"/>
        <div class="btn-row" style="margin-top:8px">
          <button id="parseLab">Parse & continue</button>
        </div>
      </div>

      <div class="card">
        <h3>Use a hypothetical client</h3>
        <p>${fixtures.length? 'Load a scenario.' : '<span class="hint">No scenarios yet — will appear after Module 6.</span>'}</p>
        <select id="scenario" class="input">
          ${fixtures.map(f=>`<option value="${f.id}">${f.label}</option>`).join('')}
        </select>
        <div class="btn-row" style="margin-top:8px">
          <button id="loadScenario" ${fixtures.length? '' : 'disabled'}>Load</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Previous Clients</h3>
      <div id="history"></div>
    </div>

    <div class="footer-note">${AppState.config.branding.copyright}</div>
  </div>`;

  // events
  $('#countrySel').onchange = e => setCountry(e.target.value);
  $('#provider').oninput = e => setProvider(e.target.value);
  $('#startManual').onclick = () => startIntake({});
  $('#parseLab').onclick = handleLabUpload;
  const loadBtn = $('#loadScenario');
  if (loadBtn) loadBtn.onclick = () => {
    const id = $('#scenario').value;
    const fx = fixtures.find(f=>f.id===id);
    startIntake({prefill:fx});
  };

  renderHistory();
}

function renderHistory(){
  const list = Storage.load('clients', []);
  const mount = $('#history');
  if (!list.length){
    mount.innerHTML = '<div class="hint">No saved clients yet.</div>';
    return;
  }
  mount.innerHTML = `
    <table class="table">
      <thead><tr><th>ID</th><th>Label</th><th>Date</th><th></th></tr></thead>
      <tbody>
        ${list.map((c,i)=>`
          <tr>
            <td>${c.id||'-'}</td>
            <td>${c.label||c.name||'-'}</td>
            <td>${c.date||'-'}</td>
            <td>
              <button data-i="${i}" class="open">Open</button>
              <button data-i="${i}" class="dup">Duplicate</button>
              <button data-i="${i}" class="danger del">Delete</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  mount.querySelectorAll('button.open').forEach(b=> b.onclick = e => { const i=+e.target.dataset.i; openClient(list[i]); });
  mount.querySelectorAll('button.dup').forEach(b=> b.onclick = e => {
    const i=+e.target.dataset.i;
    const c=JSON.parse(JSON.stringify(list[i]));
    c.id = (c.id||'CL-') + '-COPY';
    c.date = new Date().toISOString().slice(0,10);
    list.push(c);
    Storage.save('clients', list);
    renderHistory();
  });
  mount.querySelectorAll('button.del').forEach(b=> b.onclick = e => {
    const i=+e.target.dataset.i; list.splice(i,1); Storage.save('clients', list); renderHistory();
  });
}

// ---- intake ---------------------------------------------------------------
function startIntake({prefill}){
  const c = prefill ? JSON.parse(JSON.stringify(prefill)) : {
    id: "CL-" + Math.random().toString(36).slice(2,8).toUpperCase(),
    label:"", country: AppState.session.country,
    provider: AppState.session.provider || AppState.config.branding.defaultProvider,
    demographics:{age:50, sex:"Male", education_years:12},
    biometrics:{height_cm:170, weight_kg:70, waist_cm:90, sbp:120, dbp:80, bp_treated:false},
    labs:{}, lifestyle:{smoker:"No", pack_years:0, pa_days:3, veg_daily:"Yes", alcohol_units:0},
    family_history:{ cvd:{first:0,second:0,third:0}, t2d:{first:0,second:0,third:0}, cancer:{first:0,second:0,third:0}, copd:{first:0,second:0,third:0}, neuro:{first:0,second:0,third:0}, ckd:{first:0,second:0,third:0} },
    atms:[], systems:{}, hallmarks_aging:{}, hallmarks_health:{}, mbs:{Mind:5,Body:5,Spirit:5,notes:""}
  };
  // ensure country/provider on prefill
  c.country = c.country || AppState.session.country;
  c.provider = c.provider || AppState.session.provider || AppState.config.branding.defaultProvider;
  AppState.client = c;
  renderIntake();
}

function openClient(c){
  AppState.client = c;
  AppState.session.country = c.country || AppState.session.country;
  renderReport();
}

function handleLabUpload(){
  const file = document.getElementById('labFile').files[0];
  if (!file){ alert('Choose a file'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      let parsed={};
      if (ext==='csv'||ext==='txt') parsed = await LabParser.parseCSV(e.target.result);
      else if (ext==='xlsx'||ext==='xls') parsed = await LabParser.parseXLSX(e.target.result);
      else if (ext==='pdf') parsed = await LabParser.parsePDFText(e.target.result);
      else { alert('Unsupported file'); return; }
      startIntake({prefill:{ labs:parsed, label:'Uploaded Labs', country:AppState.session.country,
        provider: AppState.session.provider || AppState.config.branding.defaultProvider }});
    }catch(err){
      console.error(err);
      alert('Could not parse file. Try CSV/XLSX or a text-based PDF.');
    }
  };
  if (ext==='xlsx'||ext==='xls'||ext==='pdf') reader.readAsArrayBuffer(file); else reader.readAsText(file);
}

// ---- intake form UI --------------------------------------------------------
function renderIntake(){
  const c = AppState.client;

  $('#app').innerHTML = `
  <div class="container">
    <div class="card">
      <h2>Client Intake</h2>
      <div class="grid cols-3">
        <div>
          <div class="label">Client ID / Label</div>
          <input id="cid" class="input" value="${c.id}"/>
          <input id="clabel" class="input" placeholder="(optional label)" value="${c.label||""}" style="margin-top:8px"/>
        </div>
        <div>
          <div class="label">Age</div>
          <input id="age" type="number" class="input" value="${c.demographics.age}"/>
          <div class="label" style="margin-top:8px">Sex</div>
          <select id="sex" class="input">
            <option ${c.demographics.sex==='Male'?'selected':''}>Male</option>
            <option ${c.demographics.sex==='Female'?'selected':''}>Female</option>
          </select>
        </div>
        <div>
          <div class="label">Provider</div>
          <input id="cprov" class="input" value="${c.provider||AppState.session.provider||AppState.config.branding.defaultProvider}"/>
          <div class="label" style="margin-top:8px">Country</div>
          <select id="ccountry" class="input">
            ${["USA","Australia","Philippines"].map(x=>`<option ${(c.country||AppState.session.country)===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </div>
      </div>

      <hr/><h3>Biometrics</h3>
      <div class="grid cols-3">
        <div><div class="label">Height (cm)</div><input id="height_cm" type="number" class="input" value="${c.biometrics.height_cm}"/></div>
        <div><div class="label">Weight (kg)</div><input id="weight_kg" type="number" class="input" value="${c.biometrics.weight_kg}"/></div>
        <div><div class="label">Waist (cm)</div><input id="waist_cm" type="number" class="input" value="${c.biometrics.waist_cm}"/></div>
        <div><div class="label">Systolic BP</div><input id="sbp" type="number" class="input" value="${c.biometrics.sbp}"/></div>
        <div><div class="label">Diastolic BP</div><input id="dbp" type="number" class="input" value="${c.biometrics.dbp}"/></div>
        <div><div class="label">On BP treatment?</div>
          <select id="bp_treated" class="input">
            <option ${c.biometrics.bp_treated?'':'selected'}>false</option>
            <option ${c.biometrics.bp_treated?'selected':''}>true</option>
          </select>
        </div>
      </div>

      <hr/><h3>Key Labs</h3>
      <div class="grid cols-3">
        <div><div class="label">Total Cholesterol</div><input id="tc" type="number" class="input" value="${c.labs.tc||''}"/><select id="tc_unit" class="input"><option ${c.labs.tc_unit==='mg/dL'?'selected':''}>mg/dL</option><option ${c.labs.tc_unit==='mmol/L'?'selected':''}>mmol/L</option></select></div>
        <div><div class="label">HDL</div><input id="hdl" type="number" class="input" value="${c.labs.hdl||''}"/><select id="hdl_unit" class="input"><option ${c.labs.hdl_unit==='mg/dL'?'selected':''}>mg/dL</option><option ${c.labs.hdl_unit==='mmol/L'?'selected':''}>mmol/L</option></select></div>
        <div><div class="label">Triglycerides</div><input id="triglycerides" type="number" class="input" value="${c.labs.triglycerides||''}"/><select id="triglycerides_unit" class="input"><option ${c.labs.triglycerides_unit==='mg/dL'?'selected':''}>mg/dL</option><option ${c.labs.triglycerides_unit==='mmol/L'?'selected':''}>mmol/L</option></select></div>
        <div><div class="label">Glucose</div><input id="glucose" type="number" class="input" value="${c.labs.glucose||''}"/><select id="glucose_unit" class="input"><option ${c.labs.glucose_unit==='mg/dL'?'selected':''}>mg/dL</option><option ${c.labs.glucose_unit==='mmol/L'?'selected':''}>mmol/L</option></select></div>
        <div><div class="label">HbA1c (%)</div><input id="hba1c_pct" type="number" class="input" step="0.1" value="${c.labs.hba1c_pct||''}"/></div>
        <div><div class="label">Creatinine</div><input id="creatinine_umolL" type="number" class="input" value="${c.labs.creatinine_umolL||''}" placeholder="µmol/L"/></div>
        <div><div class="label">ACR (mg/g)</div><input id="acr_mg_g" type="number" class="input" value="${c.labs.acr_mg_g||''}"/></div>
        <div><div class="label">Albumin (g/L)</div><input id="albumin_gL" type="number" class="input" value="${c.labs.albumin_gL||''}"/></div>
        <div><div class="label">CRP (mg/dL)</div><input id="crp_mgdl" type="number" class="input" value="${c.labs.crp_mgdl||''}"/></div>
        <div><div class="label">WBC (10^3/uL)</div><input id="wbc_10e3_uL" type="number" class="input" value="${c.labs.wbc_10e3_uL||''}"/></div>
        <div><div class="label">RDW (%)</div><input id="rdw_pct" type="number" class="input" value="${c.labs.rdw_pct||''}"/></div>
        <div><div class="label">MCV (fL)</div><input id="mcv_fl" type="number" class="input" value="${c.labs.mcv_fl||''}"/></div>
        <div><div class="label">Lymphocytes (%)</div><input id="lymph_pct" type="number" class="input" value="${c.labs.lymph_pct||''}"/></div>
        <div><div class="label">ALP (U/L)</div><input id="alp_uL" type="number" class="input" value="${c.labs.alp_uL||''}"/></div>
      </div>

      <hr/><h3>Lifestyle</h3>
      <div class="grid cols-3">
        <div><div class="label">Smoker?</div><select id="smoker" class="input"><option ${(c.lifestyle.smoker||'No')==='No'?'selected':''}>No</option><option ${(c.lifestyle.smoker||'No')==='Yes'?'selected':''}>Yes</option></select></div>
        <div><div class="label">Pack-years</div><input id="pack_years" type="number" class="input" value="${c.lifestyle.pack_years||0}"/></div>
        <div><div class="label">Physical activity days/week</div><input id="pa_days" type="number" class="input" value="${c.lifestyle.pa_days||0}"/></div>
        <div><div class="label">Vegetables/Fruit daily?</div><select id="veg_daily" class="input"><option ${(c.lifestyle.veg_daily||'Yes')==='Yes'?'selected':''}>Yes</option><option ${(c.lifestyle.veg_daily||'Yes')==='No'?'selected':''}>No</option></select></div>
        <div><div class="label">Alcohol units/week</div><input id="alcohol_units" type="number" class="input" value="${c.lifestyle.alcohol_units||0}"/></div>
      </div>

      <hr/><h3>Family History (counts by degree of relation)</h3>
      <div class="grid cols-3" id="fh"></div>

      <hr/><h3>ATMs — Antecedents, Triggers, Mediators</h3>
      <div id="atmList" class="section"></div>
      <div class="btn-row"><button id="addATM">Add ATM</button></div>

      <hr/><h3>Seven Body Systems (0–10)</h3>
      <div class="grid cols-3" id="sys"></div>

      <hr/><h3>Hallmarks of Aging (0–10)</h3>
      <div class="grid cols-3" id="ha"></div>
      <div class="small hint">These are the fundamental biological processes that drive aging at the cellular and molecular level...</div>

      <hr/><h3>Hallmarks of Health (0–10)</h3>
      <div class="grid cols-3" id="hh"></div>
      <div class="small hint">These represent the positive biological processes that maintain optimal health and resilience...</div>

      <hr/><h3>Mind–Body–Spirit (0–10) & Notes</h3>
      <div class="grid cols-3">
        <div><div class="label">Mind</div><input id="mind" type="number" class="input" value="${c.mbs.Mind||5}"/></div>
        <div><div class="label">Body</div><input id="body" type="number" class="input" value="${c.mbs.Body||5}"/></div>
        <div><div class="label">Spirit</div><input id="spirit" type="number" class="input" value="${c.mbs.Spirit||5}"/></div>
      </div>
      <div class="label" style="margin-top:8px">Notes</div><textarea id="mbs_notes" class="input">${c.mbs.notes||""}</textarea>

      <hr/>
      <div class="btn-row">
        <button class="warn" id="review">Review & Generate Report</button>
        <button id="cancel">Cancel</button>
      </div>
    </div>

    <div id="report" class="section"></div>
  </div>`;

  // Family history grid
  const fhMount = $('#fh');
  const diseases = ["cvd","t2d","cancer","copd","neuro","ckd"];
  fhMount.innerHTML = diseases.map(d=>`
    <div class="card">
      <div style="font-weight:700;text-transform:uppercase">${d}</div>
      <div class="label">1st-degree</div><input class="input fh" data-d="${d}" data-k="first" type="number" value="${(c.family_history[d]&&c.family_history[d].first)||0}"/>
      <div class="label">2nd-degree</div><input class="input fh" data-d="${d}" data-k="second" type="number" value="${(c.family_history[d]&&c.family_history[d].second)||0}"/>
      <div class="label">3rd-degree</div><input class="input fh" data-d="${d}" data-k="third" type="number" value="${(c.family_history[d]&&c.family_history[d].third)||0}"/>
    </div>`).join('');
  document.querySelectorAll('.fh').forEach(inp => inp.oninput = (e)=>{
    const d=e.target.dataset.d, k=e.target.dataset.k;
    c.family_history[d]=c.family_history[d]||{first:0,second:0,third:0};
    c.family_history[d][k]=+e.target.value||0;
  });

  // Systems
  const systemList = ["Inflammation","Detoxification","Energy/Mitochondria","Gastrointestinal","Cardiometabolic","Neuroendocrine","Immune"];
  const sysMount = $('#sys');
  sysMount.innerHTML = systemList.map(name=>`
    <div><div class="label">${name}</div>
      <input data-name="${name}" class="input sys" type="number" min="0" max="10" step="1" value="${c.systems[name]??5}"/>
    </div>`).join('');
  document.querySelectorAll('.sys').forEach(inp => inp.oninput = (e)=>{ c.systems[e.target.dataset.name]=+e.target.value; });

  // Hallmarks (aging)
  const haList = ["Genomic Instability","Telomere Attrition","Epigenetic Alterations","Loss of Proteostasis","Deregulated Nutrient-Sensing","Mitochondrial Dysfunction","Cellular Senescence","Stem Cell Exhaustion","Altered Intercellular Communication","Metabolic Dysfunction","Chronic Inflammation","Cellular Senescence Resistance"];
  const haMount = $('#ha');
  haMount.innerHTML = haList.map(name=>`
    <div><div class="label">${name}</div><input data-name="${name}" class="input ha" type="number" min="0" max="10" step="1" value="${c.hallmarks_aging[name]??5}"/></div>`).join('');
  document.querySelectorAll('.ha').forEach(inp => inp.oninput = (e)=>{ c.hallmarks_aging[e.target.dataset.name]=+e.target.value; });

  // Hallmarks (health)
  const hhList = ["Integrity of Barriers","Containment of Perturbations","Recycling and Turnover","Integration of Circuitries","Rhythmic Oscillations","Homeostatic Resilience","Hormetic Regulation","Repair and Regeneration"];
  const hhMount = $('#hh');
  hhMount.innerHTML = hhList.map(name=>`
    <div><div class="label">${name}</div><input data-name="${name}" class="input hh" type="number" min="0" max="10" step="1" value="${c.hallmarks_health[name]??5}"/></div>`).join('');
  document.querySelectorAll('.hh').forEach(inp => inp.oninput = (e)=>{ c.hallmarks_health[e.target.dataset.name]=+e.target.value; });

  // ATMs (timeline)
  function refreshATMs(){
    const m = $('#atmList');
    if(!c.atms || !c.atms.length){ m.innerHTML = '<div class="hint">No ATMs yet.</div>'; return; }
    m.innerHTML = c.atms.map((a,i)=>`
      <div class="card">
        <div class="grid cols-3">
          <div><div class="label">Type</div>
            <select data-i="${i}" class="atm type input"><option ${a.type==='A'?'selected':''}>A</option><option ${a.type==='T'?'selected':''}>T</option><option ${a.type==='M'?'selected':''}>M</option></select>
          </div>
          <div><div class="label">Date (YYYY-MM)</div><input data-i="${i}" class="atm date input" value="${a.date||''}" placeholder="e.g., 2019-06"/></div>
          <div><div class="label">Title</div><input data-i="${i}" class="atm title input" value="${a.title||''}"/></div>
        </div>
        <div class="label" style="margin-top:8px">Note</div><textarea data-i="${i}" class="atm note input">${a.note||''}</textarea>
        <div class="btn-row" style="margin-top:8px"><button class="danger delATM" data-i="${i}">Delete</button></div>
      </div>`).join('');
    document.querySelectorAll('.atm').forEach(el=>{
      el.oninput = (e)=>{
        const i=+e.target.dataset.i;
        const cls = Array.from(e.target.classList).find(x=>['type','date','title','note'].includes(x));
        c.atms[i][cls]=e.target.value;
      };
    });
    document.querySelectorAll('.delATM').forEach(b=> b.onclick = (e)=>{ const i=+e.target.dataset.i; c.atms.splice(i,1); refreshATMs(); });
  }
  refreshATMs();
  document.getElementById('addATM').onclick = ()=>{ c.atms.push({type:'A', date:'', title:'', note:''}); refreshATMs(); };

  // Buttons
  document.getElementById('cancel').onclick = ()=> renderLanding(window.__fixtures||[]);
  document.getElementById('review').onclick = ()=>{
    // collect
    c.id=$('#cid').value; c.label=$('#clabel').value; c.country=$('#ccountry').value; c.provider=$('#cprov').value;
    c.demographics.age=+$('#age').value; c.demographics.sex=$('#sex').value;
    c.biometrics.height_cm=+$('#height_cm').value; c.biometrics.weight_kg=+$('#weight_kg').value; c.biometrics.waist_cm=+$('#waist_cm').value;
    c.biometrics.sbp=+$('#sbp').value; c.biometrics.dbp=+$('#dbp').value; c.biometrics.bp_treated = ($('#bp_treated').value==='true');
    c.labs.tc=parseFloat($('#tc').value)||null; c.labs.tc_unit=$('#tc_unit').value;
    c.labs.hdl=parseFloat($('#hdl').value)||null; c.labs.hdl_unit=$('#hdl_unit').value;
    c.labs.triglycerides=parseFloat($('#triglycerides').value)||null; c.labs.triglycerides_unit=$('#triglycerides_unit').value;
    c.labs.glucose=parseFloat($('#glucose').value)||null; c.labs.glucose_unit=$('#glucose_unit').value;
    c.labs.hba1c_pct=parseFloat($('#hba1c_pct').value)||null;
    c.labs.creatinine_umolL=parseFloat($('#creatinine_umolL').value)||null;
    c.labs.acr_mg_g=parseFloat($('#acr_mg_g').value)||null;
    c.labs.albumin_gL=parseFloat($('#albumin_gL').value)||null;
    c.labs.crp_mgdl=parseFloat($('#crp_mgdl').value)||null;
    c.labs.wbc_10e3_uL=parseFloat($('#wbc_10e3_uL').value)||null;
    c.labs.rdw_pct=parseFloat($('#rdw_pct').value)||null;
    c.labs.mcv_fl=parseFloat($('#mcv_fl').value)||null;
    c.labs.lymph_pct=parseFloat($('#lymph_pct').value)||null;
    c.labs.alp_uL=parseFloat($('#alp_uL').value)||null;
    AppState.client=c;
    renderReport();
  };
}

// ---- report screen ---------------------------------------------------------
function renderReport(){
  $('#app').innerHTML = `
    <div class="container">
      <div id="report"></div>
      <div class="btn-row" style="margin-top:10px">
        <button id="back">Back</button>
        <button class="primary" id="save">Save</button>
        <button class="success" id="pdf">Download PDF</button>
      </div>
    </div>`;
  Report.render(AppState).then(()=>{
    $('#back').onclick = ()=> renderLanding(window.__fixtures||[]);
    $('#save').onclick = ()=>{
      const list = Storage.load('clients', []);
      const c = JSON.parse(JSON.stringify(AppState.client));
      c.date = new Date().toISOString().slice(0,10);
      const idx = list.findIndex(x=>x.id===c.id);
      if (idx>=0) list[idx]=c; else list.push(c);
      Storage.save('clients', list);
      alert('Saved to this browser');
    };
    $('#pdf').onclick = ()=> Report.exportPDF();
  });
}

// ---- main ------------------------------------------------------------------
async function main(){
  await loadConfig();
  const session = Storage.load('session', null);
  if (session) AppState.session = session;
  const fixtures = await loadFixtures();
  window.__fixtures = fixtures;
  renderLanding(fixtures);
}
main();
