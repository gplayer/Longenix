/* js/calculators.js
   Longenix Health — Chronic Disease Risk Assessment System
   Models: Units, risk color, BMI/WHtR, Derived metrics (HOMA-IR, TyG, AIP, VAI),
           Metabolic Syndrome (ATP III), Framingham General CVD (10-yr),
           FINDRISC (T2D 10-yr), COPD-PS mapping, CAIDE (20-yr),
           eGFR CKD-EPI 2021 & KDIGO grid, Cancer (general) indicative,
           Phenotypic Age (Levine 2018) + 10-yr mortality.

   Educational decision-support only — not medical advice.
   © Graham Player Ph.D. — For qualified health practitioners only.
*/
'use strict';

/* ===== Units ===== */
const Units = {
  mgdl_to_mmol_glucose: (v)=> v/18.0,
  mmol_to_mgdl_glucose: (v)=> v*18.0,
  mgdl_to_mmol_trig:    (v)=> v/88.57,
  mmol_to_mgdl_trig:    (v)=> v*88.57,
  mgdl_to_mmol_chol:    (v)=> v/38.67,
  mmol_to_mgdl_chol:    (v)=> v*38.67,
  umol_to_mgdl_creatinine: (v)=> v/88.4,
  mgdl_to_umol_creatinine: (v)=> v*88.4
};

/* ===== Helpers ===== */
const riskColor = (pct) => {
  const p = +pct;
  if (!isFinite(p)) return {label:"N/A", class:"", color:"#9ca3af"};
  if (p < 10) return {label:"Low",    class:"low", color:"#00A651"};
  if (p < 20) return {label:"Medium", class:"med", color:"#F5C518"};
  return {label:"High",  class:"high", color:"#D72638"};
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x||0));
const BMI   = (h_cm, w_kg)      => (!h_cm||!w_kg)? null : (w_kg/Math.pow(h_cm/100,2));
const WHtR  = (waist_cm, h_cm)  => (!waist_cm||!h_cm)? null : (waist_cm/h_cm);

/* ===== Derived metrics ===== */
const Derived = {
  HOMA_IR: (glucose, insulin, unit="mg/dL") => {
    if (glucose==null || insulin==null) return null;
    let g = glucose;
    if (unit === "mmol/L") g = Units.mmol_to_mgdl_glucose(glucose);
    return (g * insulin) / 405.0;
  },
  TyG: (trig, glucose, trigUnit="mg/dL", gluUnit="mg/dL") => {
    if (trig==null || glucose==null) return null;
    let t = trig, g = glucose;
    if (trigUnit === "mmol/L") t = Units.mmol_to_mgdl_trig(trig);
    if (gluUnit  === "mmol/L") g = Units.mmol_to_mgdl_glucose(glucose);
    return Math.log((t * g) / 2.0);
  },
  AIP: (trig, hdl, unit="mg/dL") => {
    if (trig==null || hdl==null || hdl===0) return null;
    // If values are in mmol/L, convert to mg/dL first
    let T = trig, H = hdl;
    if (unit==="mmol/L"){ T = Units.mmol_to_mgdl_trig(trig); H = Units.mmol_to_mgdl_chol(hdl); }
    return Math.log10(T/H);
  },
  VAI: (sex, waist_cm, bmi, trig, hdl, unit="mmol/L") => {
    if (!waist_cm || !bmi || !trig || !hdl) return null;
    let TG = trig, HDL = hdl;
    if (unit === "mg/dL") { TG = Units.mgdl_to_mmol_trig(trig); HDL = Units.mgdl_to_mmol_chol(hdl); }
    const male = (sex||"").toLowerCase().startsWith("m");
    if (male) {
      return (waist_cm/(39.68 + (1.88 * bmi))) * (TG/1.03) * (1.31/HDL);
    } else {
      return (waist_cm/(36.58 + (1.89 * bmi))) * (TG/0.81) * (1.52/HDL);
    }
  }
};

/* ===== Family history adjustment (bounded) ===== */
function familyHistoryAdj(basePct, fh){
  if (basePct==null || !fh) return basePct;
  const w1 = 0.10, w2 = 0.05, w3 = 0.02; // relative bumps for 1st/2nd/3rd degree counts
  const rel = 1 + (fh.first||0)*w1 + (fh.second||0)*w2 + (fh.third||0)*w3;
  const out = basePct * rel;
  return Math.min(95, out);
}

/* ===== Metabolic Syndrome (ATP III) ===== */
const MetabolicSyndrome = (sex, waist_cm, triglycerides, trigUnit, hdl, hdlUnit, sbp, dbp, glucose, gluUnit, hba1c_pct) => {
  const criteria = [];

  // 1) Abdominal obesity
  const waistFlag = (sex?.toLowerCase().startsWith("m") ? (waist_cm>=102) : (waist_cm>=88));
  criteria.push({name:"Abdominal obesity (waist circumference)", pass:waistFlag, value:waist_cm?`${waist_cm} cm`:""});

  // 2) Triglycerides ≥150 mg/dL (1.7 mmol/L)
  let trig_mgdl = triglycerides;
  if (trigUnit==="mmol/L") trig_mgdl = Units.mmol_to_mgdl_trig(triglycerides);
  const trigFlag = trig_mgdl!=null && trig_mgdl>=150;
  criteria.push({name:"Triglycerides ≥150 mg/dL (1.7 mmol/L)", pass:trigFlag, value:triglycerides!=null?`${triglycerides} ${trigUnit}`:""});

  // 3) Low HDL
  let hdl_mgdl = hdl;
  if (hdlUnit==="mmol/L") hdl_mgdl = Units.mmol_to_mgdl_chol(hdl);
  const hdlFlag = (sex?.toLowerCase().startsWith("m") ? (hdl_mgdl<40) : (hdl_mgdl<50));
  criteria.push({name:"Low HDL (<40 mg/dL men, <50 mg/dL women)", pass:hdlFlag, value:hdl!=null?`${hdl} ${hdlUnit}`:""});

  // 4) BP ≥130/85
  const bpFlag = (sbp>=130 || dbp>=85);
  criteria.push({name:"BP ≥130/85 mmHg", pass:bpFlag, value:(sbp&&dbp)?`${sbp}/${dbp} mmHg`:""});

  // 5) Glucose ≥100 mg/dL or HbA1c ≥5.7%
  let glu_mgdl = glucose;
  if (gluUnit==="mmol/L") glu_mgdl = Units.mmol_to_mgdl_glucose(glucose);
  const glyFlag = (glu_mgdl!=null && glu_mgdl>=100) || (hba1c_pct!=null && hba1c_pct>=5.7);
  criteria.push({name:"Fasting glucose ≥100 mg/dL or HbA1c ≥5.7%", pass:glyFlag, value:`${glucose??""} ${gluUnit||""}${hba1c_pct!=null?`, HbA1c ${hba1c_pct}%`:""}`});

  const count = criteria.filter(c=>c.pass).length;
  return { count, criteria, diagnosis: count>=3 };
};

/* ===== Framingham General CVD (points -> 10-yr %) =====
   Approximate table-based implementation (D'Agostino 2008), sex-specific. */
const Framingham = {
  points: ({age, sex, tc_mgdl, hdl_mgdl, sbp, bp_treated, smoker, diabetes}) => {
    sex = (sex||"").toLowerCase();
    const male = sex.startsWith("m");
    let pts = 0;

    const ageBandsM = [[20,34,-9],[35,39,-4],[40,44,0],[45,49,3],[50,54,6],[55,59,8],[60,64,10],[65,69,11],[70,74,12],[75,79,13]];
    const ageBandsF = [[20,34,-7],[35,39,-3],[40,44,0],[45,49,3],[50,54,6],[55,59,8],[60,64,10],[65,69,12],[70,74,14],[75,79,16]];
    const ab = male? ageBandsM: ageBandsF;
    for (const [lo,hi,p] of ab){ if (age>=lo && age<=hi){ pts+=p; break; } }

    function tcTable(isMale){
      return isMale? {
        "20-39":[[160,199,4],[200,239,7],[240,279,9],[280,1000,11]],
        "40-49":[[160,199,3],[200,239,5],[240,279,6],[280,1000,8]],
        "50-59":[[160,199,2],[200,239,3],[240,279,4],[280,1000,5]],
        "60-69":[[160,199,1],[200,239,1],[240,279,2],[280,1000,3]],
        "70-79":[[160,199,0],[200,239,0],[240,279,1],[280,1000,1]],
      } : {
        "20-39":[[160,199,4],[200,239,8],[240,279,11],[280,1000,13]],
        "40-49":[[160,199,3],[200,239,6],[240,279,8],[280,1000,10]],
        "50-59":[[160,199,2],[200,239,4],[240,279,5],[280,1000,7]],
        "60-69":[[160,199,1],[200,239,2],[240,279,3],[280,1000,4]],
        "70-79":[[160,199,1],[200,239,1],[240,279,2],[280,1000,2]],
      };
    }
    const tct = tcTable(male);
    const key = age<=39? "20-39": age<=49? "40-49": age<=59? "50-59": age<=69? "60-69": "70-79";
    if (tc_mgdl>=160){
      for (const [lo,hi,p] of tct[key]){ if (tc_mgdl>=lo && tc_mgdl<=hi){ pts+=p; break; } }
    }

    if (hdl_mgdl!=null){
      if (hdl_mgdl>=60) pts-=1;
      else if (hdl_mgdl>=50) pts+=0;
      else if (hdl_mgdl>=40) pts+=1;
      else pts+=2;
    }

    function sbpPts(sbp, treated, male){
      if (male){
        if (treated){
          if (sbp<120) return 0; if (sbp<=129) return 1; if (sbp<=139) return 2; if (sbp<=159) return 2; return 3;
        } else {
          if (sbp<120) return 0; if (sbp<=129) return 0; if (sbp<=139) return 1; if (sbp<=159) return 1; return 2;
        }
      } else {
        if (treated){
          if (sbp<120) return 0; if (sbp<=129) return 3; if (sbp<=139) return 4; if (sbp<=159) return 5; return 6;
        } else {
          if (sbp<120) return 0; if (sbp<=129) return 1; if (sbp<=139) return 2; if (sbp<=159) return 3; return 4;
        }
      }
    }
    pts += sbpPts(sbp||0, !!bp_treated, male);

    if (smoker){
      if (male){
        if (age<=39) pts+=8; else if (age<=49) pts+=5; else if (age<=59) pts+=3; else if (age<=69) pts+=1; else pts+=1;
      } else {
        if (age<=39) pts+=9; else if (age<=49) pts+=7; else if (age<=59) pts+=4; else if (age<=69) pts+=2; else pts+=1;
      }
    }
    if (diabetes) pts += male? 2 : 4;

    const mapM = { "-100":1, "-1":1, "0":1, "1":1, "2":1, "3":1, "4":1, "5":2, "6":2, "7":3, "8":4, "9":5, "10":6, "11":8, "12":10, "13":12, "14":16, "15":20, "16":25, "17":31, "18":37, "19":45, "20":53, "21":63 };
    const mapF = { "-100":1, "-1":1, "0":1, "1":1, "2":1, "3":1, "4":1, "5":1, "6":1, "7":2, "8":2, "9":2, "10":3, "11":4, "12":5, "13":6, "14":8, "15":11, "16":14, "17":17, "18":22, "19":27, "20":33, "21":40 };
    const keys = (male? Object.keys(mapM):Object.keys(mapF)).map(k=>+k).sort((a,b)=>a-b);
    const table = male? mapM : mapF;
    let chosen = keys[0];
    for (const k of keys){ if (pts>=k) chosen = k; }
    const risk = table[chosen.toString()] || 1;
    return { points: pts, risk_pct: risk, band: riskColor(risk) };
  }
};

/* ===== FINDRISC (T2D 10-yr) ===== */
const FINDRISC = ({age, bmi, waist_cm, daily_activity, veg_daily, meds_htn, high_glucose_history, family_history}) => {
  let s = 0;
  if (age<45) s+=0; else if (age<=54) s+=2; else if (age<=64) s+=3; else s+=4;
  if (bmi<25) s+=0; else if (bmi<30) s+=1; else s+=3;
  if (waist_cm<94) s+=0; else if (waist_cm<102) s+=3; else s+=4;
  s += daily_activity? 0:2;
  s += veg_daily? 0:1;
  s += meds_htn? 2:0;
  s += high_glucose_history? 5:0;
  if (family_history==="first") s+=5;
  else if (family_history==="second") s+=3;

  let risk = 1;
  if (s<=11) risk=1; else if (s<=14) risk=4; else if (s<=20) risk=17; else risk=33;
  return {score:s, risk_pct:risk, band:riskColor(risk)};
};

/* ===== CAIDE (20-yr dementia risk bands) ===== */
const CAIDE = ({age, sex, education_years, sbp, bmi, tc_mmol, physically_active}) => {
  let s=0;
  if (age>=47 && age<=53) s+=3; else if (age>53) s+=4;
  if ((sex||"").toLowerCase().startsWith("m")) s+=1;
  if (education_years!=null && education_years<10) s+=2;
  if (sbp!=null && sbp>=140) s+=2;
  if (bmi!=null && bmi>=30) s+=2;
  if (tc_mmol!=null && tc_mmol>=6.5) s+=2;
  if (!physically_active) s+=1;

  let risk;
  if (s<=5) risk=1.0; else if (s<=6) risk=1.9; else if (s<=7) risk=4.2; else if (s<=8) risk=7.4;
  else if (s<=9) risk=14.0; else if (s<=10) risk=19.6; else if (s<=11) risk=31.7; else if (s<=12) risk=52.6; else risk=100.0;
  return {score:s, risk_pct:risk, band:riskColor(risk)};
};

/* ===== COPD-PS mapping (simple likelihood bands) ===== */
const COPD_PS = (score)=>{
  let risk = 5;
  if (score<=4) risk=5; else if (score<=6) risk=15; else if (score<=8) risk=25; else risk=35;
  return {score, risk_pct:risk, band:riskColor(risk)};
};

/* ===== eGFR CKD-EPI 2021 (no race) ===== */
const eGFR_CKD_EPI_2021 = ({sex, age, creat_mgdl}) => {
  if (creat_mgdl==null || !age || !sex) return null;
  const male = (sex||"").toLowerCase().startsWith("m");
  const k = male? 0.9 : 0.7;
  const a = male? -0.302 : -0.241;
  const alpha = creat_mgdl/k;
  const min = Math.min(alpha, 1.0);
  const max = Math.max(alpha, 1.0);
  let egfr = 142 * Math.pow(min, a) * Math.pow(max, -1.200) * Math.pow(0.9938, age);
  if (!male) egfr *= 1.012;
  return egfr;
};

/* ===== KDIGO grid (nominal % bands for visualization) ===== */
const KDIGO = ({egfr, acr_mg_g}) => {
  if (egfr==null || acr_mg_g==null) return {category:null, risk_pct:null, band:riskColor(NaN)};
  const a = acr_mg_g<30? "A1": acr_mg_g<300? "A2":"A3";
  let g;
  if (egfr>=90) g="G1"; else if (egfr>=60) g="G2"; else if (egfr>=45) g="G3a"; else if (egfr>=30) g="G3b"; else if (egfr>=15) g="G4"; else g="G5";
  const grid = {
    G1:{A1:5,A2:10,A3:20},
    G2:{A1:7,A2:15,A3:25},
    G3a:{A1:10,A2:20,A3:35},
    G3b:{A1:15,A2:30,A3:45},
    G4:{A1:25,A2:45,A3:60},
    G5:{A1:60,A2:75,A3:90}
  };
  const risk = grid[g][a];
  return {category:`${g}-${a}`, risk_pct:risk, band:riskColor(risk)};
};

/* ===== Cancer (general) — indicative risk only ===== */
const CancerGeneral = ({age, sex, smoker, alcohol_units, bmi, activity_days}) => {
  let base = 2.0;
  if (age>=50) base=6.0; if (age>=60) base=10.0; if (age>=70) base=15.0;
  if (smoker) base+=5.0;
  if (alcohol_units && alcohol_units>14) base+=2.0;
  if (bmi && bmi>=30) base+=2.0;
  if (activity_days && activity_days>=5) base-=1.0;
  base = Math.max(0.5, base);
  return {risk_pct: base, band: riskColor(base)};
};

/* ===== Phenotypic Age (Levine 2018) + 10-yr mortality =====
   Inputs: albumin_gL, creatinine_umolL, glucose_mmolL, crp_mgdl (log),
           lymph_pct, mcv_fl, rdw_pct, alp_uL, wbc_10e3_uL, age_years */
const PhenotypicAge = ({albumin_gL, creatinine_umolL, glucose_mmolL, crp_mgdl, lymph_pct, mcv_fl, rdw_pct, alp_uL, wbc_10e3_uL, age_years}) => {
  const vals = [albumin_gL, creatinine_umolL, glucose_mmolL, crp_mgdl, lymph_pct, mcv_fl, rdw_pct, alp_uL, wbc_10e3_uL, age_years];
  if (vals.some(v=>v==null || isNaN(v))) return {pheno_age:null, mortality_10yr_pct:null};
  const crp_log = Math.log(Math.max(crp_mgdl, 1e-9));
  const xb = (-0.0336*albumin_gL)
           + (0.0095*creatinine_umolL)
           + (0.1953*glucose_mmolL)
           + (0.0954*crp_log)
           - (0.0120*lymph_pct)
           + (0.0268*mcv_fl)
           + (0.3306*rdw_pct)
           + (0.0019*alp_uL)
           + (0.0554*wbc_10e3_uL)
           + (0.0804*age_years)
           - 19.9067;
  const gamma = 0.0077;
  const mort = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120*gamma)-1)/gamma);
  const pheno_age = 141.50225 + Math.log(-0.00553 * Math.log(1 - mort)) / 0.090165;
  return {pheno_age, mortality_10yr_pct: mort*100.0, band:riskColor(mort*100.0)};
};

/* ===== Expose to global (for other scripts) ===== */
Object.assign(window, {
  Units, riskColor, BMI, WHtR, Derived,
  familyHistoryAdj, MetabolicSyndrome, Framingham, FINDRISC,
  COPD_PS, CAIDE, eGFR_CKD_EPI_2021, KDIGO, CancerGeneral, PhenotypicAge
});
