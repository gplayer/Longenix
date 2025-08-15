/* Lightweight lab parsers for CSV/XLSX/PDF (text) */
const LabParser = {
  parseCSV: async (text)=>{
    const lines = text.split(/\r?\n/).filter(Boolean);
    const out = {};
    for (const line of lines){
      const [k, v] = line.split(/,|\t/);
      const key = (k||'').trim().toLowerCase();
      const val = parseFloat((v||'').trim());
      if (!isFinite(val)) continue;
      if (key.includes('hba1c')) out.hba1c_pct = val;
      if (key.includes('glucose') && key.includes('mmol')) { out.glucose = val; out.glucose_unit='mmol/L'; }
      else if (key.includes('glucose')) { out.glucose = val; out.glucose_unit='mg/dL'; }
      if (key.includes('total') && key.includes('chol')) { out.tc = val; out.tc_unit = key.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (key.startsWith('hdl')) { out.hdl = val; out.hdl_unit = key.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (key.startsWith('ldl')) { out.ldl = val; out.ldl_unit = key.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (key.includes('trig')) { out.triglycerides = val; out.triglycerides_unit = key.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (key.includes('creatinine') && key.includes('umol')) out.creatinine_umolL = val;
      if (key.includes('acr')) out.acr_mg_g = val;
      if (key.includes('albumin')) out.albumin_gL = val;
      if (key.includes('crp')) out.crp_mgdl = val;
      if (key.includes('wbc')) out.wbc_10e3_uL = val;
      if (key.includes('rdw')) out.rdw_pct = val;
      if (key.includes('mcv')) out.mcv_fl = val;
      if (key.includes('lymph')) out.lymph_pct = val;
      if (key.includes('alkaline') || key.includes('alp')) out.alp_uL = val;
      if (key.includes('sbp')) out.sbp = val;
      if (key.includes('dbp')) out.dbp = val;
    }
    return out;
  },
  parseXLSX: async (arrayBuffer)=>{
    const wb = XLSX.read(arrayBuffer, {type:'array'});
    const out = {};
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {header:1});
    for (const row of rows){
      const k = (row[0]||'').toString().toLowerCase(); const v = parseFloat(row[1]);
      if (!isFinite(v)) continue;
      if (k.includes('hba1c')) out.hba1c_pct = v;
      if (k.includes('glucose') && k.includes('mmol')) { out.glucose = v; out.glucose_unit='mmol/L'; }
      else if (k.includes('glucose')) { out.glucose = v; out.glucose_unit='mg/dL'; }
      if (k.includes('total') && k.includes('chol')) { out.tc = v; out.tc_unit = k.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (k.startsWith('hdl')) { out.hdl = v; out.hdl_unit = k.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (k.startsWith('ldl')) { out.ldl = v; out.ldl_unit = k.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (k.includes('trig')) { out.triglycerides = v; out.triglycerides_unit = k.includes('mmol')? 'mmol/L':'mg/dL'; }
      if (k.includes('creatinine') && k.includes('umol')) out.creatinine_umolL = v;
      if (k.includes('acr')) out.acr_mg_g = v;
      if (k.includes('albumin')) out.albumin_gL = v;
      if (k.includes('crp')) out.crp_mgdl = v;
      if (k.includes('wbc')) out.wbc_10e3_uL = v;
      if (k.includes('rdw')) out.rdw_pct = v;
      if (k.includes('mcv')) out.mcv_fl = v;
      if (k.includes('lymph')) out.lymph_pct = v;
      if (k.includes('alkaline') || k.includes('alp')) out.alp_uL = v;
      if (k.includes('sbp')) out.sbp = v;
      if (k.includes('dbp')) out.dbp = v;
    }
    return out;
  },
  parsePDFText: async (arrayBuffer)=>{
    const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it=>it.str).join(' ') + '\n';
    }
    text = text.replace(/\s+/g,' ');
    function find(re){ const m = re.exec(text); return m? parseFloat(m[1]): null; }
    const out = {};
    out.hba1c_pct = find(/HbA1c[^0-9]*(\d+\.?\d*)\s*%/i) ?? out.hba1c_pct;
    out.glucose = find(/(Fasting\s*)?Glucose[^0-9]*(\d+\.?\d*)\s*mg\/dL/i); if (out.glucose) out.glucose_unit='mg/dL';
    if (!out.glucose){ out.glucose = find(/(Fasting\s*)?Glucose[^0-9]*(\d+\.?\d*)\s*mmol\/L/i); if (out.glucose) out.glucose_unit='mmol/L'; }
    out.tc = find(/(Total\s+Cholesterol|Cholesterol,?\s*Total)[^0-9]*(\d+\.?\d*)\s*mg\/dL/i); if (out.tc) out.tc_unit='mg/dL';
    if (!out.tc){ out.tc = find(/(Total\s+Cholesterol|Cholesterol,?\s*Total)[^0-9]*(\d+\.?\d*)\s*mmol\/L/i); if (out.tc) out.tc_unit='mmol/L'; }
    out.hdl = find(/HDL[^0-9]*(\d+\.?\d*)\s*mg\/dL/i); if (out.hdl) out.hdl_unit='mg/dL';
    if (!out.hdl){ out.hdl = find(/HDL[^0-9]*(\d+\.?\d*)\s*mmol\/L/i); if (out.hdl) out.hdl_unit='mmol/L'; }
    out.ldl = find(/LDL[^0-9]*(\d+\.?\d*)\s*mg\/dL/i); if (out.ldl) out.ldl_unit='mg/dL';
    if (!out.ldl){ out.ldl = find(/LDL[^0-9]*(\d+\.?\d*)\s*mmol\/L/i); if (out.ldl) out.ldl_unit='mmol/L'; }
    out.triglycerides = find(/Triglycerides[^0-9]*(\d+\.?\d*)\s*mg\/dL/i); if (out.triglycerides) out.triglycerides_unit='mg/dL';
    if (!out.triglycerides){ out.triglycerides = find(/Triglycerides[^0-9]*(\d+\.?\d*)\s*mmol\/L/i); if (out.triglycerides) out.triglycerides_unit='mmol/L'; }
    out.creatinine_umolL = find(/Creatinine[^0-9]*(\d+\.?\d*)\s*(?:µ|u)?mol\/L/i) ?? out.creatinine_umolL;
    out.acr_mg_g = find(/Albumin\/?Creatinine\s*Ratio[^0-9]*(\d+\.?\d*)\s*mg\/g/i) ?? out.acr_mg_g;
    out.albumin_gL = find(/Albumin[^0-9]*(\d+\.?\d*)\s*g\/L/i) ?? out.albumin_gL;
    out.crp_mgdl = find(/C-?reactive\s*Protein[^0-9]*(\d+\.?\d*)\s*mg\/dL/i) ?? out.crp_mgdl;
    out.wbc_10e3_uL = find(/WBC[^0-9]*(\d+\.?\d*)\s*(?:x?10\^?3|10\^?3|10E3|10\*3)?\/?u?L/i) ?? out.wbc_10e3_uL;
    out.rdw_pct = find(/RDW[^0-9]*(\d+\.?\d*)\s*%/i) ?? out.rdw_pct;
    out.mcv_fl = find(/MCV[^0-9]*(\d+\.?\d*)\s*fL/i) ?? out.mcv_fl;
    out.lymph_pct = find(/Lymph(?:ocyte)?s?[^0-9]*(\d+\.?\d*)\s*%/i) ?? out.lymph_pct;
    out.alp_uL = find(/Alkaline\s*Phosphatase[^0-9]*(\d+\.?\d*)\s*U\/L/i) ?? out.alp_uL;
    out.sbp = find(/Systolic[^0-9]*(\d+)\s*mmHg/i) ?? out.sbp;
    out.dbp = find(/Diastolic[^0-9]*(\d+)\s*mmHg/i) ?? out.dbp;
    return out;
  }
};
