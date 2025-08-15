(function () {
  "use strict";
  const STORAGE_KEY = "cdra_intake_v1";
  const TOTAL_STEPS = 5; // Steps 1–5 now
  let state = loadState();
  let currentStep = parseInt(sessionStorage.getItem("cdra_step"), 10) || 1;

  const root = document.getElementById("step-root");
  const progressBar = document.getElementById("progress-bar");
  const msgBox = document.getElementById("form-messages");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSave = document.getElementById("btn-save");

  attachEvents();
  render();

  function attachEvents() {
    btnBack.addEventListener("click", () => { if (currentStep > 1) { currentStep--; persistStep(); render(); } });
    btnNext.addEventListener("click", () => { if (currentStep < TOTAL_STEPS) { currentStep++; persistStep(); render(); } });
    btnSave.addEventListener("click", () => { saveState(); announce("Progress saved.", "success"); });
  }

  function persistStep() { sessionStorage.setItem("cdra_step", String(currentStep)); }
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }

  function render() {
    updateProgress();
    root.innerHTML = "";
    if (currentStep === 4) renderStep4();
    else if (currentStep === 5) renderStep5();
    else root.textContent = `Step ${currentStep} content from previous modules`;
  }

  function updateProgress() {
    const pct = Math.round((currentStep - 1) / TOTAL_STEPS * 100);
    progressBar.style.width = pct + "%";
  }

  function renderStep4() {
    const tabs = document.createElement("div"); tabs.className = "tabs";
    const categories = ["Heart", "Metabolism", "Hormones", "Sleep", "Inflammation", "Cognition", "Fitness", "Recovery", "Additional"];
    let activeCat = categories[0];

    categories.forEach(cat => {
      const t = document.createElement("div"); t.className = "tab"; t.textContent = cat; if (cat === activeCat) t.classList.add("active");
      t.addEventListener("click", () => { activeCat = cat; renderFields(); });
      tabs.appendChild(t);
    });
    root.appendChild(tabs);

    const fieldContainer = document.createElement("div"); fieldContainer.className = "category-grid"; root.appendChild(fieldContainer);
    function renderFields() {
      fieldContainer.innerHTML = "";
      for (let i = 1; i <= 7; i++) {
        const wrap = document.createElement("div"); wrap.className = "lab-field";
        const lab = document.createElement("label"); lab.textContent = `${activeCat} Test ${i}`;
        const inp = document.createElement("input"); inp.type = "number";
        wrap.appendChild(lab); wrap.appendChild(inp);
        fieldContainer.appendChild(wrap);
      }
    }
    renderFields();
  }

  function renderStep5() {
    const group = document.createElement("fieldset");
    const lg = document.createElement("legend"); lg.textContent = "Step 5 – Family History"; group.appendChild(lg);
    ["Heart disease", "Diabetes", "Cancer", "Alzheimer's"].forEach(cond => {
      const wrap = document.createElement("div");
      const lab = document.createElement("label"); lab.textContent = cond;
      const chk = document.createElement("input"); chk.type = "checkbox";
      wrap.appendChild(chk); wrap.appendChild(lab);
      group.appendChild(wrap);
    });
    root.appendChild(group);
  }

  function announce(msg, level) {
    msgBox.textContent = msg;
  }
})();
