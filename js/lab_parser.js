/* js/lab_parser.js
   Longenix Health — Lab file parsing helpers
   Supports: CSV / TSV / TXT, XLSX/XLS (via SheetJS), and text-based PDFs (via pdf.js).
   Note: image/scanned PDFs cannot be parsed (no OCR).

   Exposes: LabParser.parseCSV(text), LabParser.parseXLSX(arrayBuffer), LabParser.parsePDFText(arrayBuffer)
*/
'use strict';

const LabParser = (() => {
  // --- Normalization helpers -------------------------------------------------
  const norm = (s) => (s||'').toString().trim().toLowerCase();
  const num  = (v) => {
    if (v==null) return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g,''));
    return isFinite(n) ? n : null;
  };

  // common aliases => canonical keys
  const KEYMAP = [
    [/^hba1c/,                      (v,u)=>(['hba1c_pct', num(v)])],
    [/^(fasting\s*)?glucose/,       (v,u)=>(['glucose', num(v),  u?.includes('mmol')?'mmol/L':'mg/dL'])],
    [/^(total\s+)?chol.*total|^cholesterol,\s*total/, (v,u)=>(['tc', num(v), u?.includes('mmol')?'mmol/L':'mg/dL'])],
    [/^hdl/,                        (v,u)=>(['hdl', num(v), u?.includes('mmol')?'mmol/L':'mg/dL'])],
    [/^ldl/,                        (v,u)=>(['ldl', num(v), u?.includes('mmol')?'mmol/L':'mg/dL'])],
    [/^trig|^tg\b|triglyceride/,    (v,u)=>(['triglycerides', num(v), u?.includes('mmol')?'mmol/L':'mg/dL'])],
    [/^creatinine/,                 (v,u)=>(['creatinine_umolL', detectCreatinine(v,u)])],
    [/^acr|albumin.?creatinine.*ratio/, (v,u)=>(['acr_mg_g', num(v)])],
    [/^albumin(?!.*creatinine)/,    (v,u)=>(['albumin_gL', num(v)])],
    [/^crp|c.?reactive.?protein/,   (v,u)=>(['crp_mgdl', num(v)])],
    [/^wbc|white.*cell/,            (v,u)=>(['wbc_10e3_uL', num(v)])],
    [/^rdw/,                        (v,u)=>(['rdw_pct', num(v)])],
    [/^mcv/,                        (v,u)=>(['mcv_fl', num(v)])],
    [/^lymph|lymphocyte/,           (v,u)=>(['lymph_pct', num(v)])],
    [/^alkaline.*phosph|^alp\b/,    (v,u)=>(['alp_uL', num(v)])],
    [/^sbp|systolic/,               (v,u)=>(['sbp', num(v)])],
    [/^dbp|diastolic/,              (v,u)=>(['dbp', num(v)])],
  ];

  function detectCreatinine(v, unitHint){
    // Prefer µmol/L when unit unclear (AU commonly uses µmol/L)
    const txt = norm(unitHint||'');
    if (txt.includes('µmol') || txt.includes('umol') || txt.includes('μmol') || txt.includes('micromol')) {
      return num(v); // already µmol/L
    }
    if (txt.includes('mg/dl')) {
      // convert to µmol/L
      const mgdl = num(v);
      return mgdl!=null ? mgdl*88.4 : null;
    }
    // Heuristic: values > 15 are almost certainly µmol/L
    const val = num(v);
    if (val==null) return null;
    return (val>15) ? val : (val*88.4); // treat small as mg/dL → convert
  }

  function setOut(out, key, value, unit){
    if (value==null) return;
    out[key] = value;
    // attach units for relevant analytes
    if (key === 'glucose')        out.glucose_unit        = unit || out.glucose_unit || guessUnitFromValue(value, 'glucose');
    if (key === 'triglycerides')  out.triglycerides_unit  = unit || out.triglycerides_unit || guessUnitFromValue(value, 'trig');
    if (key === 'hdl')            out.hdl_unit            = unit || out.hdl_unit || guessUnitFromValue(value, 'chol');
    if (key === 'tc')             out.tc_unit             = unit || out.tc_unit  || guessUnitFromValue(value, 'chol');
  }

  function guessUnitFromValue(v, kind){
    if (v==null) return undefined;
    // very rough: mmol/L values tend to be small integers (e.g., TG 1.7), mg/dL are larger (e.g., 150)
    if (kind==='glucose') return (v<=15) ? 'mmol/L' : 'mg/dL';
    if (kind==='trig'   ) return (v<=5)  ? 'mmol/L' : 'mg/dL';
    if (kind==='chol'   ) return (v<=10) ? 'mmol/L' : 'mg/dL';
    return undefined;
  }

  // --- CSV/TSV/TXT -----------------------------------------------------------
  async function parseCSV(text){
    // Split rows; handle comma/semicolon/tab separated
    const lines = text.split(/\r?\n/).filter(r => r.trim().length);
    const out = {};
    for (const raw of lines){
      // Try "key,value,unit" OR "key\tvalue\tunit"
      const cols = raw.split(/[,;\t]/).map(c=>c.trim()).filter(Boolean);
      if (!cols.length) continue;
      const k = norm(cols[0]);
      const v = cols[1] ?? '';
      const unitHint = (cols[2] || cols[0]); // units often embedded in header
      for (const [re, mapfn] of KEYMAP){
        if (re.test(k)){
          const mapped = mapfn(v, k + ' ' + (cols.slice(1).join(' ')||''));
          const key = mapped[0];
          const value = mapped[1];
          const unit  = mapped[2];
          setOut(out, key, value, unit);
          break;
        }
      }
    }
    return out;
  }

  // --- XLSX/XLS via SheetJS --------------------------------------------------
  async function parseXLSX(arrayBuffer){
    const wb = XLSX.read(arrayBuffer, {type:'array'});
    const out = {};
    for (const name of wb.SheetNames){
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:true});
      for (const row of rows){
        if (!row || !row.length) continue;
        const keyCell = norm(row[0]);
        const valCell = row[1];
        const unitCell = (row[2]||row[0]);
        for (const [re, mapfn] of KEYMAP){
          if (re.test(keyCell)){
            const mapped = mapfn(valCell, String(unitCell));
            const key = mapped[0];
            const value = mapped[1];
            const unit  = mapped[2];
            setOut(out, key, value, unit);
            break;
          }
        }
      }
    }
    return out;
  }

  // --- Text-based PDF via pdf.js --------------------------------------------
  async function parsePDFText(arrayBuffer){
    // Requires pdfjsLib (loaded in index.html via CDN)
    const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it=>it.str).join(' ') + '\n';
    }
    text = text.replace(/\s+/g,' ');

    const out = {};
    // helper: first capture group as float
    const find = (re) => {
      const m = re.exec(text);
      return m ? num(m[1]) : null;
    };

    // Glucose
    let v = find(/Glucose[^0-9]*([\d.]+)\s*mg\/dL/i);
    if (v!=null){ setOut(out,'glucose', v, 'mg/dL'); }
    v = v ?? find(/Glucose[^0-9]*([\d.]+)\s*mmol\/L/i);
    if (v!=null && !out.glucose){ setOut(out,'glucose', v, 'mmol/L'); }

    // HbA1c
    v = find(/HbA1c[^0-9]*([\d.]+)\s*%/i);
    if (v!=null) setOut(out,'hba1c_pct', v);

    // Lipids
    v = find(/(Total\s+Cholesterol|Cholesterol,\s*Total)[^0-9]*([\d.]+)\s*mg\/dL/i);
    if (v!=null) setOut(out,'tc', v, 'mg/dL');
    if (!out.tc){
      v = find(/(Total\s+Cholesterol|Cholesterol,\s*Total)[^0-9]*([\d.]+)\s*mmol\/L/i);
      if (v!=null) setOut(out,'tc', v, 'mmol/L');
    }
    v = find(/HDL[^0-9]*([\d.]+)\s*mg\/dL/i);
    if (v!=null) setOut(out,'hdl', v, 'mg/dL');
    if (!out.hdl){
      v = find(/HDL[^0-9]*([\d.]+)\s*mmol\/L/i);
      if (v!=null) setOut(out,'hdl', v, 'mmol/L');
    }
    v = find(/LDL[^0-9]*([\d.]+)\s*mg\/dL/i);
    if (v!=null) setOut(out,'ldl', v, 'mg/dL');
    if (!out.ldl){
      v = find(/LDL[^0-9]*([\d.]+)\s*mmol\/L/i);
      if (v!=null) setOut(out,'ldl', v, 'mmol/L');
    }
    v = find(/Triglycerides[^0-9]*([\d.]+)\s*mg\/dL/i);
    if (v!=null) setOut(out,'triglycerides', v, 'mg/dL');
    if (!out.triglycerides){
      v = find(/Triglycerides[^0-9]*([\d.]+)\s*mmol\/L/i);
      if (v!=null) setOut(out,'triglycerides', v, 'mmol/L');
    }

    // Kidney
    v = find(/Creatinine[^0-9]*([\d.]+)\s*(?:µ|u|μ)?mol\/L/i);
    if (v!=null) setOut(out,'creatinine_umolL', v);
    if (out.creatinine_umolL==null){
      v = find(/Creatinine[^0-9]*([\d.]+)\s*mg\/dL/i);
      if (v!=null) setOut(out,'creatinine_umolL', v*88.4);
    }
    v = find(/Albumin\/?Creatinine\s*Ratio[^0-9]*([\d.]+)\s*mg\/g/i);
    if (v!=null) setOut(out,'acr_mg_g', v);

    // Phenotypic Age inputs
    v = find(/Albumin[^0-9]*([\d.]+)\s*g\/L/i); if (v!=null) setOut(out,'albumin_gL', v);
    v = find(/C-?reactive\s*Protein[^0-9]*([\d.]+)\s*mg\/dL/i); if (v!=null) setOut(out,'crp_mgdl', v);
    v = find(/WBC[^0-9]*([\d.]+)\s*(?:x?10\^?3|10\^?3|10E3|10\*3)?\/?u?L/i); if (v!=null) setOut(out,'wbc_10e3_uL', v);
    v = find(/RDW[^0-9]*([\d.]+)\s*%/i); if (v!=null) setOut(out,'rdw_pct', v);
    v = find(/MCV[^0-9]*([\d.]+)\s*fL/i); if (v!=null) setOut(out,'mcv_fl', v);
    v = find(/Lymph(?:ocyte)?s?[^0-9]*([\d.]+)\s*%/i); if (v!=null) setOut(out,'lymph_pct', v);
    v = find(/Alkaline\s*Phosphatase[^0-9]*([\d.]+)\s*U\/L/i); if (v!=null) setOut(out,'alp_uL', v);

    // Blood pressure (if included in PDF)
    v = find(/Systolic[^0-9]*([\d.]+)\s*mmHg/i); if (v!=null) setOut(out,'sbp', v);
    v = find(/Diastolic[^0-9]*([\d.]+)\s*mmHg/i); if (v!=null) setOut(out,'dbp', v);

    return out;
  }

  return { parseCSV, parseXLSX, parsePDFText };
})();

// expose
Object.assign(window, { LabParser });
