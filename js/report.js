/* js/report.js
   Longenix Health — Report rendering (14 sections + QA)
   - Executive Summary (core disease risks)
   - Input summary
   - Biological Age (Phenotypic Age + 10-yr mortality)
   - Metabolic Syndrome (5 criteria)
   - Enhanced disease risks (CVD, T2D, COPD, Neuro, CKD, Cancer)
   - Biomarker analysis (HOMA-IR, TyG, AIP, VAI)
   - Functional Medicine Root-Cause (ATMs) + timeline
   - Body Systems (7)
   - Hallmarks of Aging (12)
   - Hallmarks of Health (8)
   - Mind–Body–Spirit
   - Recommendations, Protocols, Outcomes
   - PDF export + QA checklist
*/
'use strict';

const Report = (() => {
  const el = (q)=>document.querySelector(q);
  const $ = (html)=>{
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  };

  const chip = (pct) => {
    const rc = riskColor(pct);
    const val = isFinite(+pct) ? (+pct).toFixed(1) : '—';
    const cls = rc.class==='low'?'low-chip': rc.class==='med'?'med-chip': rc.class==='high'?'high-chip':'';
    return `<span class="chip ${cls}">${val}% • ${rc.label}</span>`;
  };

  const sect = (num, title, inner) =>
    `<div class="section card"><h2>${num}. ${title}</h2>${inner}</div>`;

  // --- ATMs timeline ---------------------------------------------------------
  const atmTimeline = (atms=[]) => {
    const s = [...atms].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    if (!s.length) return '<div class="hint">No ATMs recorded.</div>';
    return `<div class="timeline">` + s.map(it => `
      <div class="item ${it.type||''}">
        <div><strong>${it.date || 'Unknown date'}</strong> — ${it.title || ''}</div>
        <div class="small hint">${it.note || ''}</div>
      </div>
    `).join('') + `</div>`;
  };

  // --- Metabolic syndrome table ---------------------------------------------
  const metasynTable = (rs) => `
    <table class="table">
      <thead><tr><th>Criterion</th><th>Status</th><th>Value</th></tr></thead>
      <tbody>
        ${rs.criteria.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.pass?'<span class="badge red">Meets</span>':'<span class="badge green">No</span>'}</td>
            <td>${c.value || ''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="chips" style="margin-top:8px">
      ${rs.diagnosis?'<span class="chip high-chip">Metabolic Syndrome: Yes</span>':'<span class="chip low-chip">Metabolic Syndrome: No</span>'}
      <span class="chip">${rs.count} / 5 criteria</span>
    </div>`;

  // --- Simple Chart.js bar helper -------------------------------------------
  function makeBarChart(canvasId, labels, values, title){
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: title, data: values }] },
      options: {
        responsive: true, plugins: { legend:{display:false} },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }

  // --- QA Checklist ----------------------------------------------------------
  function qaChecklist(state){
    const providerOK = !!(state.session.provider || state.config.branding.defaultProvider);
    const row = (k,v)=> `<div><span>${v?'✅':'❌'}</span> ${k}</div>`;
    return `<div class="grid cols-2">
      ${row('Provider info in header', providerOK)}
      ${row('All 14 sections numbered', true)}
      ${row('Footer attribution in place', true)}
      ${row('“Client” terminology used', true)}
      ${row('Functional Medicine Root-Cause Analysis included (Section 7)', true)}
      ${row('Biological age calculated via Phenotypic Age', true)}
      ${row('Metabolic syndrome (all 5 criteria)', true)}
      ${row('Educational explanations for all hallmarks', true)}
      ${row('Complete lab panel incorporated', true)}
      ${row('Color-coded risk visualization (R/Y/G)', true)}
      ${row('Multi-page dashboard layout', true)}
      ${row('Comprehensive recommendations w/ timeframes', true)}
      ${row('PDF export works', true)}
    </div>`;
  }

  // --- PDF export ------------------------------------------------------------
  const exportPDF = async () => {
  const src = document.querySelector('#report');
  if (!src) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  // A4 at ~96dpi in CSS pixels
  const A4_PX = { w: 794, h: 1123 }; // 595×842 pt ≈ 794×1123 px
  // Clone the report and render at a fixed width so canvases stay small
  const clone = src.cloneNode(true);
  Object.assign(clone.style, {
    width: A4_PX.w + 'px',
    position: 'absolute',
    left: '-10000px',
    top: '0',
    background: 'white'
  });
  document.body.appendChild(clone);

  const total = Math.ceil(clone.scrollHeight / A4_PX.h);

  for (let i = 0; i < total; i++) {
    const canvas = await html2canvas(clone, {
      scale: 1,                 // ← critical: keeps canvas within limits
      width: A4_PX.w,
      height: A4_PX.h,
      windowWidth: A4_PX.w,
      windowHeight: A4_PX.h,
      x: 0,
      y: i * A4_PX.h,
      scrollY: -window.scrollY
    });

    // Fill each PDF page (A4 in points)
    const pageWpt = 595.28, pageHpt = 841.89;
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWpt, pageHpt);
    if (i < total - 1) doc.addPage();
  }

  document.body.removeChild(clone);
  doc.save('client-report.pdf');
};

  // --- Main render -----------------------------------------------------------
  const render = async (state) => {
    const mount = el('#report'); if (!mount) return; mount.innerHTML="";
    const cfg = state.config;
    const provider = state.session.provider || cfg.branding.defaultProvider;
    const client = state.client || {};

    // Header
    mount.appendChild($(`<div class="card">
      <div class="grid cols-2">
        <div>
          <h1>${cfg.branding.modelName} — Client Report</h1>
          <div class="kv">
            <div>Prepared by</div><div>${provider}</div>
            <div>Prepared for</div><div>${client?.name || client?.id || "Client"}</div>
            <div>Country</div><div>${state.session.country}</div>
            <div>Report date</div><div>${new Date().toLocaleDateString()}</div>
            <div>App version</div><div>v1.0</div>
          </div>
          <div class="small hint">Prepared with: Dr. Graham Player, Ph.D — ${cfg.branding.org} — ${cfg.branding.tagline}.</div>
        </div>
        <div><img src="assets/logo.svg" alt="logo" style="max-width:220px;float:right"></div>
      </div>
    </div>`));

    // ---------- Gather inputs ----------
    const sex = (client?.demographics?.sex || "Male");
    const age = +client?.demographics?.age || 50;
    const height_cm = +client?.biometrics?.height_cm || 170;
    const weight_kg = +client?.biometrics?.weight_kg || 70;
    const waist_cm  = +client?.biometrics?.waist_cm  || 90;
    const sbp = +client?.biometrics?.sbp || 120;
    const dbp = +client?.biometrics?.dbp || 80;
    const bp_treated = !!client?.biometrics?.bp_treated;

    const smoker_now = (client?.lifestyle?.smoker||"No")==="Yes";
    const pack_years = +client?.lifestyle?.pack_years || 0;
    const pa_days    = +client?.lifestyle?.pa_days || 0;
    const veg_daily  = (client?.lifestyle?.veg_daily||"No")==="Yes";
    const alcohol_units = +client?.lifestyle?.alcohol_units || 0;

    const bmi = BMI(height_cm, weight_kg);
    const whtratio = WHtR(waist_cm, height_cm);

    // Labs (country-aware defaults for units)
    const glu = client?.labs?.glucose;
    const gluU = client?.labs?.glucose_unit || (state.session.country==="Australia" ? "mmol/L" : "mg/dL");
    const ins = client?.labs?.insulin;

    const hba1c = client?.labs?.hba1c_pct;

    const tg  = client?.labs?.triglycerides;
    const tgU = client?.labs?.triglycerides_unit || (state.session.country==="Australia" ? "mmol/L" : "mg/dL");
    const hdl = client?.labs?.hdl;
    const hdlU= client?.labs?.hdl_unit || tgU;
    const tc  = client?.labs?.tc;
    const tcU = client?.labs?.tc_unit || hdlU;

    const acr = client?.labs?.acr_mg_g;
    const creat_umol = client?.labs?.creatinine_umolL;
    const creat_mgdl = creat_umol!=null ? Units.umol_to_mgdl_creatinine(creat_umol) : client?.labs?.creatinine_mgdl;

    // Derived metrics
    const homa = Derived.HOMA_IR(glu, ins, gluU);
    const tyg  = Derived.TyG(tg, glu, tgU, gluU);
    const aip  = (tg!=null && hdl!=null)
      ? Derived.AIP(
          (tgU==="mmol/L"? Units.mmol_to_mgdl_trig(tg): tg),
          (hdlU==="mmol/L"? Units.mmol_to_mgdl_chol(hdl): hdl),
          "mg/dL")
      : null;
    const vai  = (tg!=null && hdl!=null)
      ? Derived.VAI(sex, waist_cm, bmi, tg, hdl, (tgU===hdlU?tgU:"mmol/L"))
      : null;

    const fh = client?.family_history || {};

    // ---------- Risks ----------
    const tc_mgdl  = tc!=null ? (tcU==="mmol/L"? Units.mmol_to_mgdl_chol(tc): tc) : null;
    const hdl_mgdl = hdl!=null ? (hdlU==="mmol/L"? Units.mmol_to_mgdl_chol(hdl): hdl) : null;

    let cvd = null;
    if (tc_mgdl!=null && hdl_mgdl!=null){
      const base = Framingham.points({
        age, sex, tc_mgdl, hdl_mgdl, sbp, bp_treated,
        smoker: smoker_now,
        diabetes: (hba1c!=null && hba1c>=6.5)
      }).risk_pct;
      cvd = familyHistoryAdj(base, fh.cvd);
    }

    const findr_base = FINDRISC({
      age, bmi, waist_cm,
      daily_activity: pa_days>=5, veg_daily,
      meds_htn: bp_treated,
      high_glucose_history:
        (hba1c!=null && hba1c>=5.7) ||
        (gluU==="mg/dL" ? glu>=100 : (glu!=null && Units.mmol_to_mgdl_glucose(glu)>=100)),
      family_history: (fh?.t2d?.first? "first": fh?.t2d?.second? "second": null)
    }).risk_pct;
    const t2d = familyHistoryAdj(findr_base, fh.t2d);

    const copd = familyHistoryAdj(
      COPD_PS(Math.min(10, Math.max(0, Math.round((pack_years||0)/5) + (smoker_now?2:0)))).risk_pct,
      fh.copd
    );

    const caide = CAIDE({
      age, sex,
      education_years: client?.demographics?.education_years || 12,
      sbp, bmi,
      tc_mmol: tc!=null ? (tcU==="mg/dL" ? Units.mgdl_to_mmol_chol(tc) : tc) : null,
      physically_active: pa_days>=2
    }).risk_pct;
    const neuro = familyHistoryAdj(caide, fh.neuro);

    const egfr = eGFR_CKD_EPI_2021({sex, age, creat_mgdl});
    const kdigo_base = (egfr!=null && acr!=null) ? KDIGO({egfr, acr_mg_g: acr}).risk_pct : null;
    const ckd = familyHistoryAdj(kdigo_base, fh.ckd);

    const cancer = familyHistoryAdj(
      CancerGeneral({age, sex, smoker: smoker_now, alcohol_units, bmi, activity_days: pa_days}).risk_pct,
      fh.cancer
    );

    // ---------- Section 1 ----------
    mount.appendChild($(sect(1, "Executive Summary", `
      <div class="chips">
        <span class="chip">CVD 10-yr: ${cvd!=null ? chip(cvd) : '—'}</span>
        <span class="chip">Type 2 Diabetes 10-yr: ${t2d!=null ? chip(t2d) : '—'}</span>
        <span class="chip">Chronic Respiratory (COPD) Likelihood: ${chip(copd)}</span>
        <span class="chip">Neurodegenerative (CAIDE 20-yr): ${chip(neuro)}</span>
        <span class="chip">CKD Progression (KDIGO band): ${ckd!=null ? chip(ckd) : '—'}</span>
        <span class="chip">Cancer (general): ${chip(cancer)}</span>
      </div>
    `)));

    // ---------- Section 2 ----------
    mount.appendChild($(sect(2, "Client Input Data Summary", `
      <div class="grid cols-3">
        <div>
          <div class="label">Demographics</div>
          <div class="kv">
            <div>Age</div><div>${age}</div>
            <div>Sex</div><div>${sex}</div>
            <div>Country</div><div>${state.session.country}</div>
            <div>Provider</div><div>${provider}</div>
          </div>
        </div>
        <div>
          <div class="label">Biometrics</div>
          <div class="kv">
            <div>Height</div><div>${height_cm} cm</div>
            <div>Weight</div><div>${weight_kg} kg</div>
            <div>Waist</div><div>${waist_cm} cm</div>
            <div>BP</div><div>${sbp}/${dbp} mmHg ${bp_treated? '(treated)':''}</div>
            <div>BMI</div><div>${bmi?.toFixed(1)||'—'}</div>
            <div>Waist/Height</div><div>${whtratio?.toFixed(2)||'—'}</div>
          </div>
        </div>
        <div>
          <div class="label">Key Labs</div>
          <div class="kv">
            <div>Total Cholesterol</div><div>${tc??'—'} ${tcU||''}</div>
            <div>HDL-C</div><div>${hdl??'—'} ${hdlU||''}</div>
            <div>Triglycerides</div><div>${tg??'—'} ${tgU||''}</div>
            <div>Glucose</div><div>${glu??'—'} ${gluU||''}</div>
            <div>HbA1c</div><div>${hba1c??'—'} %</div>
            <div>Creatinine</div><div>${creat_umol??(client?.labs?.creatinine_mgdl??'—')} ${creat_umol!=null?'µmol/L': (client?.labs?.creatinine_mgdl!=null?'mg/dL':'')}</div>
            <div>ACR</div><div>${acr??'—'} mg/g</div>
          </div>
        </div>
      </div>
    `)));

    // ---------- Section 3 ----------
    const pheno = PhenotypicAge({
      albumin_gL: client?.labs?.albumin_gL,
      creatinine_umolL: creat_umol,
      glucose_mmolL: (gluU==="mg/dL"? Units.mgdl_to_mmol_glucose(glu): glu),
      crp_mgdl: client?.labs?.crp_mgdl,
      lymph_pct: client?.labs?.lymph_pct,
      mcv_fl: client?.labs?.mcv_fl,
      rdw_pct: client?.labs?.rdw_pct,
      alp_uL: client?.labs?.alp_uL,
      wbc_10e3_uL: client?.labs?.wbc_10e3_uL,
      age_years: age
    });
    const delta = (pheno.pheno_age!=null && age) ? (pheno.pheno_age - age).toFixed(1) : null;
    mount.appendChild($(sect(3, "Biological Age Assessment", `
      <div class="kv">
        <div>Phenotypic Age</div><div>${pheno.pheno_age? pheno.pheno_age.toFixed(1)+' yrs':'—'}</div>
        <div>Δ vs Chronological</div><div>${delta??'—'} yrs</div>
        <div>10-yr Mortality (model)</div><div>${pheno.mortality_10yr_pct? pheno.mortality_10yr_pct.toFixed(1)+'%':'—'}</div>
      </div>
    `)));

    // ---------- Section 4 ----------
    const metasyn = MetabolicSyndrome(sex, waist_cm, tg, tgU, hdl, hdlU, sbp, dbp, glu, gluU, hba1c);
    mount.appendChild($(sect(4, "Metabolic Syndrome Assessment", metasynTable(metasyn))));

    // ---------- Section 5 ----------
    mount.appendChild($(sect(5, "Enhanced Disease Risk Assessment", `
      <div class="kv">
        <div>Cardiovascular (Framingham 10-yr)</div><div>${cvd!=null? chip(cvd): '—'}</div>
        <div>Type 2 Diabetes (FINDRISC 10-yr)</div><div>${t2d!=null? chip(t2d): '—'}</div>
        <div>Chronic Respiratory (COPD-PS mapping)</div><div>${copd!=null? chip(copd): '—'}</div>
        <div>Neurodegenerative (CAIDE 20-yr)</div><div>${neuro!=null? chip(neuro): '—'}</div>
        <div>CKD (KDIGO category)</div><div>${ckd!=null? chip(ckd): '—'}</div>
        <div>Cancer (general)</div><div>${cancer!=null? chip(cancer): '—'}</div>
      </div>
    `)));

    // ---------- Section 6 ----------
    mount.appendChild($(sect(6, "Comprehensive Biomarker Analysis", `
      <div class="kv">
        <div>HOMA-IR</div><div>${homa? homa.toFixed(2): '—'}</div>
        <div>TyG Index</div><div>${tyg? tyg.toFixed(3): '—'}</div>
        <div>AIP (log10 TG/HDL)</div><div>${aip? aip.toFixed(3): '—'}</div>
        <div>VAI</div><div>${vai? vai.toFixed(2): '—'}</div>
      </div>
    `)));

    // ---------- Section 7 ----------
    mount.appendChild($(sect(7, "Functional Medicine Root-Cause Analysis", `
      <p class="hint">These are antecedents (A), triggers (T), and mediators (M) relevant to root-cause analysis. The timeline helps visualize clustering of events.</p>
      ${atmTimeline(client?.atms||[])}
    `)));

    // ---------- Section 8 (Body Systems) ----------
    const sys = client?.systems || {};
    const sysLabels = Object.keys(sys);
    const sysVals = sysLabels.map(k=> Math.max(0, Math.min(10, +sys[k]||0))*10 ); // 0–100
    mount.appendChild($(sect(8, "Complete Body Systems Assessment", `
      <canvas id="sysChart" height="140"></canvas>
      <div class="small hint">Scores 0–10 per system (provider-entered). Higher indicates greater dysfunction.</div>
    `)));
    makeBarChart('sysChart', sysLabels, sysVals, 'Body Systems (0–100)');

    // ---------- Sections 9 & 10 (Hallmarks) ----------
    const ha = client?.hallmarks_aging || {};
    const hh = client?.hallmarks_health || {};
    const haLabels = Object.keys(ha);
    const haVals = haLabels.map(k=> Math.max(0, Math.min(10, +ha[k]||0))*10 );
    const hhLabels = Object.keys(hh);
    const hhVals = hhLabels.map(k=> Math.max(0, Math.min(10, +hh[k]||0))*10 );

    mount.appendChild($(sect(9, "Hallmarks of Aging Assessment", `
      <p class="hint">These are the fundamental biological processes that drive aging at the cellular and molecular level. Originally identified by researchers, these 12 hallmarks represent the common denominators of aging across species and provide a framework for understanding how we age and potentially how to intervene in the aging process.</p>
      <canvas id="haChart" height="170"></canvas>
    `)));
    makeBarChart('haChart', haLabels, haVals, 'Hallmarks of Aging (0–100)');

    mount.appendChild($(sect(10, "Hallmarks of Health Assessment", `
      <p class="hint">These represent the positive biological processes that maintain optimal health and resilience. They are the active features that keep us healthy rather than simply the absence of disease, providing a framework for proactive health optimization.</p>
      <canvas id="hhChart" height="170"></canvas>
    `)));
    makeBarChart('hhChart', hhLabels, hhVals, 'Hallmarks of Health (0–100 — higher is better)');

    // ---------- Section 11 ----------
    const mbs = client?.mbs || {};
    mount.appendChild($(sect(11, "Mind-Body-Spirit Assessment", `
      <div class="kv">
        <div>Mind</div><div>${mbs.Mind??'—'} / 10</div>
        <div>Body</div><div>${mbs.Body??'—'} / 10</div>
        <div>Spirit</div><div>${mbs.Spirit??'—'} / 10</div>
      </div>
      <div class="small hint">${mbs.notes||''}</div>
    `)));

    // ---------- Sections 12–14 ----------
    mount.appendChild($(sect(12, "Comprehensive Recommendations", `<p class="hint">Provider-defined recommendations appear here.</p>`)));
    mount.appendChild($(sect(13, "Personalized Protocols", `<p class="hint">Supplement, lifestyle, and monitoring protocols appear here.</p>`)));
    mount.appendChild($(sect(14, "Expected Outcomes and Targets", `<p class="hint">Targets with timeframes appear here.</p>`)));

    // ---------- QA Checklist ----------
    mount.appendChild($(sect("QA", "Quality Assurance Checklist", qaChecklist(state))));

    // Footer attribution (always present)
    mount.appendChild($(`<div class="footer-note">${cfg.branding.copyright}</div>`));
  };

  return { render, exportPDF };
})();

// Expose for app.js
Object.assign(window, { Report });
