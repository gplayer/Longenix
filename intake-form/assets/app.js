(function () {
  "use strict";

  // === Config ===
  const STORAGE_KEY = "cdra_intake_v1"; // forward-compatible key
  const TOTAL_STEPS = 3; // 7A covers 1..3 only

  // Simple schema to ensure consistent keys for later modules
  const schema = {
    demographics: {
      age: null, // years
      gender: "",
      ethnicity: "",
    },
    lifestyle: {
      exercise_days_per_week: null,
      sleep_hours: null,
      stress_level: null, // 1-10
      diet_quality: null, // 1-10 subjective or MDS later
      smoking_status: "never", // never, former, current
      alcohol_intake: "none", // none, light, moderate, heavy
    },
    biometrics: {
      height_cm: null,
      weight_kg: null,
      waist_cm: null,
      bp_sys: null,
      bp_dia: null,
      resting_hr: null,
      bmi: null, // derived
      waist_height_ratio: null, // derived
    },
  };

  // === State ===
  let state = loadState();
  let currentStep = clamp(parseInt(sessionStorage.getItem("cdra_step"), 10) || 1, 1, TOTAL_STEPS);

  // DOM refs
  const root = document.getElementById("step-root");
  const progressBar = document.getElementById("progress-bar");
  const msgBox = document.getElementById("form-messages");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSave = document.getElementById("btn-save");

  // Init
  attachEvents();
  render();

  function attachEvents() {
    btnBack.addEventListener("click", () => {
      if (currentStep > 1) {
        currentStep--; persistStep(); render(); announce("Moved to previous step.");
      }
    });

    btnNext.addEventListener("click", () => {
      const ok = validateCurrentStep(true);
      if (!ok) return;
      if (currentStep < TOTAL_STEPS) {
        currentStep++; persistStep(); render(); announce("Moved to next step.");
      } else {
        announce("Steps 1–3 complete. Advanced sections will be added in Module 7B/7C.", "success");
      }
    });

    btnSave.addEventListener("click", () => {
      saveState();
      announce("Progress saved locally.", "success");
    });
  }

  function persistStep() { sessionStorage.setItem("cdra_step", String(currentStep)); }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(schema);
      const parsed = JSON.parse(raw);
      return mergeDeep(deepClone(schema), parsed); // ensure new keys exist
    } catch (e) {
      console.warn("State load error, using defaults", e);
      return deepClone(schema);
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function render() {
    updateProgress();
    updateStepLabels();

    root.innerHTML = "";
    let stepEl;
    switch (currentStep) {
      case 1: stepEl = renderStep1(); break;
      case 2: stepEl = renderStep2(); break;
      case 3: stepEl = renderStep3(); break;
      default: stepEl = document.createElement("div"); stepEl.textContent = "Unknown step";
    }
    root.appendChild(stepEl);

    btnBack.disabled = currentStep === 1;
    btnNext.textContent = currentStep < TOTAL_STEPS ? "Next" : "Finish";
  }

  function updateProgress() {
    const pct = Math.round((currentStep - 1) / TOTAL_STEPS * 100);
    progressBar.style.width = `${pct}%`;
  }

  function updateStepLabels() {
    const labels = document.querySelectorAll(".step-label");
    labels.forEach((el, idx) => el.classList.toggle("active", idx === currentStep - 1));
  }

  // === Step Renderers ===
  function renderField({ id, label, type = "text", value = "", placeholder = "", min, max, step, options, hint }) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("label");
    lab.className = "label"; lab.setAttribute("for", id); lab.textContent = label;

    const ctrl = document.createElement("div");
    ctrl.className = "control";

    let input;
    if (type === "select") {
      input = document.createElement("select");
      (options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value; o.textContent = opt.label; input.appendChild(o);
      });
      input.value = String(value ?? "");
    } else if (type === "textarea") {
      input = document.createElement("textarea");
      input.value = String(value ?? "");
      if (placeholder) input.placeholder = placeholder;
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = type; input.value = value ?? "";
      if (placeholder) input.placeholder = placeholder;
      if (min !== undefined) input.min = String(min);
      if (max !== undefined) input.max = String(max);
      if (step !== undefined) input.step = String(step);
      if (type === "number") input.inputMode = "decimal";
    }

    input.id = id;
    input.addEventListener("change", onChange);
    input.addEventListener("blur", onChange);

    ctrl.appendChild(input);
    if (hint) {
      const h = document.createElement("div"); h.className = "hint"; h.textContent = hint; ctrl.appendChild(h);
    }

    wrap.appendChild(lab); wrap.appendChild(ctrl);
    return wrap;
  }

  function renderStep1() {
    const s = state.demographics;
    const frag = document.createDocumentFragment();

    const group = document.createElement("fieldset");
    const lg = document.createElement("legend"); lg.textContent = "Step 1 – Demographics"; group.appendChild(lg);

    group.appendChild(renderField({ id: "age", label: "Age (years)", type: "number", value: s.age ?? "", min: 0, max: 120 }));

    group.appendChild(renderField({ id: "gender", label: "Gender", type: "select", value: s.gender ?? "", options: [
      { value: "", label: "Select" },
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "intersex", label: "Intersex" },
      { value: "nonbinary", label: "Non-binary" },
      { value: "prefer_not", label: "Prefer not to say" },
    ] }));

    group.appendChild(renderField({ id: "ethnicity", label: "Ethnicity (if relevant)", type: "text", value: s.ethnicity ?? "", placeholder: "e.g., Caucasian, East Asian" }));

    frag.appendChild(group);
    return fragmentWrap(frag);
  }

  function renderStep2() {
    const s = state.lifestyle;
    const frag = document.createDocumentFragment();
    const group = document.createElement("fieldset");
    const lg = document.createElement("legend"); lg.textContent = "Step 2 – Lifestyle Metrics"; group.appendChild(lg);

    group.appendChild(renderField({ id: "exercise_days_per_week", label: "Exercise Days / Week", type: "number", value: s.exercise_days_per_week ?? "", min: 0, max: 14, hint: "Structured sessions of ≥20 minutes." }));

    group.appendChild(renderField({ id: "sleep_hours", label: "Sleep Hours / Night", type: "number", value: s.sleep_hours ?? "", min: 0, max: 24, step: 0.1 }));

    group.appendChild(renderField({ id: "stress_level", label: "Stress Level (1–10)", type: "number", value: s.stress_level ?? "", min: 1, max: 10 }));

    group.appendChild(renderField({ id: "diet_quality", label: "Diet Quality (1–10)", type: "number", value: s.diet_quality ?? "", min: 1, max: 10, hint: "Subjective rating or proxy for Mediterranean adherence (we’ll refine later)." }));

    group.appendChild(renderField({ id: "smoking_status", label: "Smoking Status", type: "select", value: s.smoking_status ?? "never", options: [
      { value: "never", label: "Never" },
      { value: "former", label: "Former" },
      { value: "current", label: "Current" },
    ] }));

    group.appendChild(renderField({ id: "alcohol_intake", label: "Alcohol Intake", type: "select", value: s.alcohol_intake ?? "none", options: [
      { value: "none", label: "None" },
      { value: "light", label: "Light" },
      { value: "moderate", label: "Moderate" },
      { value: "heavy", label: "Heavy" },
    ], hint: "We’ll refine with standard drink units later." }));

    frag.appendChild(group);
    return fragmentWrap(frag);
  }

  function renderStep3() {
    const s = state.biometrics;
    const frag = document.createDocumentFragment();
    const group = document.createElement("fieldset");
    const lg = document.createElement("legend"); lg.textContent = "Step 3 – Biometrics"; group.appendChild(lg);

    group.appendChild(renderField({ id: "height_cm", label: "Height (cm)", type: "number", value: s.height_cm ?? "", min: 50, max: 250 }));
    group.appendChild(renderField({ id: "weight_kg", label: "Weight (kg)", type: "number", value: s.weight_kg ?? "", min: 20, max: 400, step: 0.1 }));
    group.appendChild(renderField({ id: "waist_cm", label: "Waist (cm)", type: "number", value: s.waist_cm ?? "", min: 30, max: 200 }));

    // BP grouped in a 2-col grid
    const bpWrap = document.createElement("div"); bpWrap.className = "field";
    const bpLab = document.createElement("label"); bpLab.className = "label"; bpLab.textContent = "Blood Pressure (mmHg)"; bpLab.setAttribute("for", "bp_sys");
    const bpCtrl = document.createElement("div"); bpCtrl.className = "control";
    const grid = document.createElement("div"); grid.className = "grid-2";
    grid.appendChild(makeInput("bp_sys", "Systolic", s.bp_sys, 60, 260));
    grid.appendChild(makeInput("bp_dia", "Diastolic", s.bp_dia, 30, 180));
    bpCtrl.appendChild(grid);
    const hint = document.createElement("div"); hint.className = "hint"; hint.textContent = "Seated, arm at heart level, average of ≥2 readings preferred.";
    bpCtrl.appendChild(hint);
    bpWrap.appendChild(bpLab); bpWrap.appendChild(bpCtrl);
    group.appendChild(bpWrap);

    group.appendChild(renderField({ id: "resting_hr", label: "Resting Heart Rate (bpm)", type: "number", value: s.resting_hr ?? "", min: 30, max: 220 }));

    // Derived metrics display (read only)
    const derived = document.createElement("fieldset");
    const dlg = document.createElement("legend"); dlg.textContent = "Derived Metrics"; derived.appendChild(dlg);

    const bmi = calcBMI(s.height_cm, s.weight_kg);
    const whr = calcWHR(s.waist_cm, s.height_cm);

    derived.appendChild(renderReadOnly("BMI", isFinite(bmi) ? bmi.toFixed(1) : "—", "kg/m²"));
    derived.appendChild(renderReadOnly("Waist‑to‑Height Ratio", isFinite(whr) ? whr.toFixed(2) : "—"));

    frag.appendChild(group);
    frag.appendChild(derived);
    return fragmentWrap(frag);

    function makeInput(id, placeholder, value, min, max) {
      const w = document.createElement("div");
      const i = document.createElement("input"); i.type = "number"; i.id = id; i.placeholder = placeholder; i.value = value ?? ""; i.min = String(min); i.max = String(max);
      i.addEventListener("change", onChange); i.addEventListener("blur", onChange);
      w.appendChild(i); return w;
    }
  }

  function renderReadOnly(label, value, unit) {
    const wrap = document.createElement("div"); wrap.className = "field";
    const lab = document.createElement("div"); lab.className = "label"; lab.textContent = label;
    const ctrl = document.createElement("div"); ctrl.className = "control"; ctrl.innerHTML = `<div class="small-text">${value}${unit ? ` ${unit}` : ""}</div>`;
    wrap.appendChild(lab); wrap.appendChild(ctrl); return wrap;
  }

  function fragmentWrap(frag) { const d = document.createElement("div"); d.appendChild(frag); return d; }

  // === Change & Validation ===
  function onChange(e) {
    const id = e.target.id;
    const val = coerce(e.target.value);
    assignById(id, val);
    // recompute derived when height/weight/waist change
    if (["height_cm", "weight_kg", "waist_cm"].includes(id)) recalcDerived();
    saveState();
  }

  function assignById(id, val) {
    if (!id) return;
    if (id in state.demographics) state.demographics[id] = val;
    else if (id in state.lifestyle) state.lifestyle[id] = val;
    else if (id in state.biometrics) state.biometrics[id] = val;
    else if (id === "bp_sys") state.biometrics.bp_sys = val;
    else if (id === "bp_dia") state.biometrics.bp_dia = val;
  }

  function validateCurrentStep(show) {
    const errors = [];
    if (currentStep === 1) {
      const { age, gender } = state.demographics;
      if (!isNumber(age) || age < 0 || age > 120) errors.push("Enter a valid age (0–120).");
      if (!gender) errors.push("Please select a gender option (you can choose ‘Prefer not to say’). ");
    }
    if (currentStep === 2) {
      const s = state.lifestyle;
      if (!isOptNum(s.exercise_days_per_week, 0, 14)) errors.push("Exercise days/week must be 0–14.");
      if (!isOptNum(s.sleep_hours, 0, 24)) errors.push("Sleep hours must be 0–24.");
      if (!isOptNum(s.stress_level, 1, 10)) errors.push("Stress level must be 1–10.");
      if (!isOptNum(s.diet_quality, 1, 10)) errors.push("Diet quality must be 1–10.");
    }
    if (currentStep === 3) {
      const b = state.biometrics;
      if (!isOptNum(b.height_cm, 50, 250)) errors.push("Height 50–250 cm.");
      if (!isOptNum(b.weight_kg, 20, 400)) errors.push("Weight 20–400 kg.");
      if (!isOptNum(b.waist_cm, 30, 200)) errors.push("Waist 30–200 cm.");
      if (!isOptNum(b.bp_sys, 60, 260)) errors.push("Systolic BP 60–260.");
      if (!isOptNum(b.bp_dia, 30, 180)) errors.push("Diastolic BP 30–180.");
      if (!isOptNum(b.resting_hr, 30, 220)) errors.push("Resting HR 30–220 bpm.");
    }

    if (errors.length && show) announce(errors.join(" "), "danger");
    if (!errors.length && show) announce("Looks good.", "success");
    return errors.length === 0;
  }

  function recalcDerived() {
    const b = state.biometrics;
    const bmi = calcBMI(b.height_cm, b.weight_kg);
    const whr = calcWHR(b.waist_cm, b.height_cm);
    b.bmi = isFinite(bmi) ? round1(bmi) : null;
    b.waist_height_ratio = isFinite(whr) ? round2(whr) : null;
    saveState();
    // re-render derived section when on step 3
    if (currentStep === 3) render();
  }

  // === Utils ===
  function announce(message, level = "warn") {
    msgBox.className = "";
    msgBox.textContent = "";
    if (!message) return;
    msgBox.classList.add("alert");
    if (level === "danger") msgBox.classList.add("alert-danger");
    else if (level === "success") msgBox.classList.add("alert-success");
    else msgBox.classList.add("alert-warn");
    msgBox.textContent = message;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, isFinite(n) ? n : lo)); }
  function isNumber(n) { return typeof n === "number" && isFinite(n); }
  function isOptNum(n, min, max) { return isNumber(n) && n >= min && n <= max; }
  function coerce(v) {
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    return isFinite(n) && v.trim() !== "" ? n : v;
  }
  function calcBMI(height_cm, weight_kg) {
    if (!isNumber(height_cm) || !isNumber(weight_kg)) return NaN;
    const m = height_cm / 100;
    if (m <= 0) return NaN;
    return weight_kg / (m * m);
  }
  function calcWHR(waist_cm, height_cm) {
    if (!isNumber(waist_cm) || !isNumber(height_cm) || height_cm <= 0) return NaN;
    return waist_cm / height_cm;
  }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function mergeDeep(base, extra) {
    // simple deep merge for plain objects
    Object.keys(extra || {}).forEach(k => {
      if (typeof extra[k] === "object" && extra[k] !== null && !Array.isArray(extra[k])) {
        base[k] = mergeDeep(base[k] || {}, extra[k]);
      } else {
        base[k] = extra[k];
      }
    });
    return base;
  }
})();
