(() => {
  "use strict";

  const STORAGE_KEY = "iron_nest_tiros";
  const THEME_STORAGE_KEY = "iron_nest_theme";
  const THEME_DEFAULT = "fdc";

  const CARGAS_MIN = 1;
  const CARGAS_MAX = 6;
  const KM_POR_CARGA = 5;

  // Fixed-point keypad entry: digits fill in left to right. The decimal
  // point can be typed explicitly (e.g. direction "7" "." "5" -> "7.5"),
  // or — if the integer part reaches INTEGER_DIGITS[field] digits before
  // "." is pressed — it's inserted automatically (distance "1234" -> "12.34").
  // At most DECIMAL_DIGITS[field] digits are accepted after the point.
  const INTEGER_DIGITS = { distancia: 2, direcao: 3 };
  const DECIMAL_DIGITS = { distancia: 2, direcao: 1 };

  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */
  const state = {
    activeField: "distancia", // "distancia" | "direcao"
    raw: { distancia: "", direcao: "" }, // digits only, as typed
    carga: null, // 1..6, persists across calculations
    tiros: [], // {id, elevacao, cargas, direcao, disparado} — chronological, oldest first
  };

  /* ------------------------------------------------------------------
   * DOM refs
   * ------------------------------------------------------------------ */
  const el = {
    distanciaInput: document.getElementById("distancia"),
    direcaoInput: document.getElementById("direcao"),
    wrapDistancia: document.getElementById("wrap-distancia"),
    wrapDirecao: document.getElementById("wrap-direcao"),
    chargeSelector: document.getElementById("charge-selector"),
    keypad: document.getElementById("keypad"),
    btnLimpar: document.getElementById("btn-limpar"),
    btnCalcular: document.getElementById("btn-calcular"),
    formError: document.getElementById("form-error"),
    formErrorText: document.getElementById("form-error-text"),
    tiroListActive: document.getElementById("tiro-list-active"),
    tiroListEmpty: document.getElementById("tiro-list-empty"),
    firedSection: document.getElementById("fired-section"),
    tiroListFired: document.getElementById("tiro-list-fired"),
    heroElevacao: document.getElementById("hero-elevacao"),
    heroDirecao: document.getElementById("hero-direcao"),
    helpBtn: document.getElementById("help-btn"),
    helpModal: document.getElementById("help-modal"),
    helpModalClose: document.getElementById("help-modal-close"),
    helpModalBackdrop: document.getElementById("help-modal-backdrop"),
    heroReadout: document.querySelector(".hero-readout"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  const FIELD_WRAPS = {
    distancia: el.wrapDistancia,
    direcao: el.wrapDirecao,
  };
  const FIELD_INPUTS = {
    distancia: el.distanciaInput,
    direcao: el.direcaoInput,
  };

  /* ------------------------------------------------------------------
   * Visual theme (FDC / Ironclad) — swaps a single data-theme attribute
   * on <html>; every visual difference lives in CSS scoped under that
   * attribute. Stored under its own localStorage key, kept separate from
   * STORAGE_KEY so switching themes never touches shot data. A blocking
   * inline script in index.html already applies the saved theme before
   * first paint (to avoid a flash); this just wires up the toggle and
   * keeps its pressed state in sync from here on.
   * ------------------------------------------------------------------ */
  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === "ironclad" ? "ironclad" : THEME_DEFAULT;
    } catch (err) {
      return THEME_DEFAULT;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      /* localStorage unavailable — theme choice just won't persist */
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeToggle.querySelectorAll(".theme-btn").forEach((btn) => {
      const isActive = btn.dataset.themeValue === theme;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function initTheme() {
    applyTheme(loadTheme());
    el.themeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".theme-btn");
      if (!btn) return;
      const theme = btn.dataset.themeValue === "ironclad" ? "ironclad" : "fdc";
      applyTheme(theme);
      saveTheme(theme);
    });
  }

  /* ------------------------------------------------------------------
   * Help / tutorial modal
   * ------------------------------------------------------------------ */
  function openHelpModal() {
    el.helpModal.hidden = false;
    el.helpModalClose.focus();
  }

  function closeHelpModal() {
    el.helpModal.hidden = true;
    el.helpBtn.focus();
  }

  function initHelpModal() {
    el.helpBtn.addEventListener("click", openHelpModal);
    el.helpModalClose.addEventListener("click", closeHelpModal);
    el.helpModalBackdrop.addEventListener("click", closeHelpModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.helpModal.hidden) closeHelpModal();
    });
  }

  /* ------------------------------------------------------------------
   * Decorative analog dial ticks
   * ------------------------------------------------------------------ */
  function buildDialTicks() {
    document.querySelectorAll(".dial-ticks").forEach((group) => {
      const cx = 50, cy = 50, rOuter = 46, rInner = 40;
      const count = 12;
      let markup = "";
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + rInner * Math.cos(angle);
        const y1 = cy + rInner * Math.sin(angle);
        const x2 = cx + rOuter * Math.cos(angle);
        const y2 = cy + rOuter * Math.sin(angle);
        markup += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"></line>`;
      }
      group.innerHTML = markup;
    });
  }

  /* ------------------------------------------------------------------
   * Field activation (which field the on-screen keypad writes to)
   * ------------------------------------------------------------------ */
  function setActiveField(name) {
    state.activeField = name;
    Object.entries(FIELD_WRAPS).forEach(([key, wrap]) => {
      wrap.classList.toggle("is-active", key === name);
    });
  }

  function renderFieldValue(name) {
    const input = FIELD_INPUTS[name];
    input.value = state.raw[name];
  }

  function clearFieldInvalid(name) {
    FIELD_WRAPS[name].classList.remove("is-invalid");
  }

  /* ------------------------------------------------------------------
   * On-screen keypad input handling
   * ------------------------------------------------------------------ */
  function appendDigit(digit) {
    const name = state.activeField;
    const raw = state.raw[name];
    const dotIndex = raw.indexOf(".");

    if (dotIndex === -1) {
      if (raw.length < INTEGER_DIGITS[name]) {
        state.raw[name] = raw + digit;
      } else {
        // Integer part is full and "." hasn't been pressed — insert it now.
        state.raw[name] = raw + "." + digit;
      }
    } else {
      const decimalLength = raw.length - dotIndex - 1;
      if (decimalLength >= DECIMAL_DIGITS[name]) return; // already at max precision
      state.raw[name] = raw + digit;
    }

    renderFieldValue(name);
    clearFieldInvalid(name);
    hideFormError();
  }

  function appendDecimalPoint() {
    const name = state.activeField;
    const raw = state.raw[name];
    if (raw.includes(".")) return; // only one decimal point allowed
    state.raw[name] = raw === "" ? "0." : raw + ".";
    renderFieldValue(name);
    clearFieldInvalid(name);
    hideFormError();
  }

  function backspace() {
    const name = state.activeField;
    state.raw[name] = state.raw[name].slice(0, -1);
    renderFieldValue(name);
    clearFieldInvalid(name);
    hideFormError();
  }

  function handleKeyPress(key) {
    if (key === "back") {
      backspace();
    } else if (key === ".") {
      appendDecimalPoint();
    } else {
      appendDigit(key);
    }
  }

  /* ------------------------------------------------------------------
   * Charge (carga) selector — persists across calculations. Tapping the
   * already-selected charge deselects it, returning to "auto" mode where
   * calcularTiro() picks the minimum charge needed for the distance.
   * ------------------------------------------------------------------ */
  function selectCarga(value) {
    const next = state.carga === value ? null : value;
    state.carga = next;
    el.chargeSelector.querySelectorAll(".charge-btn").forEach((btn) => {
      const isSelected = Number(btn.dataset.carga) === next;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    hideFormError();
  }

  /* ------------------------------------------------------------------
   * Form error banner (inline — never alert())
   * ------------------------------------------------------------------ */
  function showFormError(message) {
    el.formErrorText.textContent = message;
    el.formError.hidden = false;
  }

  function hideFormError() {
    el.formError.hidden = true;
    el.formErrorText.textContent = "";
  }

  /* ------------------------------------------------------------------
   * CLEAR — resets distance and direction, keeps the results log AND
   * the selected charge (charge persists across calculations by design).
   * ------------------------------------------------------------------ */
  function limparCampos() {
    state.raw.distancia = "";
    state.raw.direcao = "";
    renderFieldValue("distancia");
    renderFieldValue("direcao");
    clearFieldInvalid("distancia");
    clearFieldInvalid("direcao");
    hideFormError();
    setActiveField("distancia");
  }

  /* ------------------------------------------------------------------
   * CALCULATE — client-side presence check, then POST /api/calcular.
   * Direction is optional. If no charge is selected, the minimum charge
   * that reaches the entered distance is picked automatically and stays
   * selected for the next calculation.
   * ------------------------------------------------------------------ */
  async function calcularTiro() {
    hideFormError();
    clearFieldInvalid("distancia");
    clearFieldInvalid("direcao");

    const distanciaRaw = state.raw.distancia;
    const direcaoRaw = state.raw.direcao;

    if (distanciaRaw === "") {
      el.wrapDistancia.classList.add("is-invalid");
      showFormError("enter the distance before calculating");
      return;
    }

    const distancia = Number(distanciaRaw);
    const direcao = direcaoRaw === "" ? null : Number(direcaoRaw);

    if (state.carga === null) {
      const cargaMinima = Math.min(
        CARGAS_MAX,
        Math.max(CARGAS_MIN, Math.ceil(distancia / KM_POR_CARGA))
      );
      selectCarga(cargaMinima);
    }
    const cargas = state.carga;

    el.btnCalcular.disabled = true;
    el.btnCalcular.classList.add("is-pressed");

    try {
      const response = await fetch("/api/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distancia: distancia,
          cargas: cargas,
          direcao: direcao,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = data && data.erro ? data.erro : "failed to calculate the shot";
        el.wrapDistancia.classList.add("is-invalid");
        showFormError(msg);
        return;
      }

      registrarTiro({
        elevacao: data.elevacao,
        cargas: cargas,
        direcao: direcao,
        distancia: distancia,
      });
      limparCampos(); // ready for the next shot — charge selection still persists
    } catch (err) {
      showFormError("could not reach the calculation server");
    } finally {
      el.btnCalcular.disabled = false;
      el.btnCalcular.classList.remove("is-pressed");
    }
  }

  /* ------------------------------------------------------------------
   * Results log (right panel) + localStorage persistence
   * ------------------------------------------------------------------ */
  function loadTiros() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      state.tiros = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      state.tiros = [];
    }
  }

  function saveTiros() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tiros));
    } catch (err) {
      /* localStorage unavailable — continue in memory only */
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `tiro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function registrarTiro({ elevacao, cargas, direcao, distancia }) {
    const tiro = { id: makeId(), elevacao, cargas, direcao, distancia, disparado: false };
    state.tiros.push(tiro); // chronological — newest at the end
    saveTiros();
    renderTiroList(); // also updates the highlighted elevation readout
    // Reveals the newly added row — scrollIntoView walks up whichever
    // ancestor actually scrolls (the active list box, or the page itself
    // in portrait), so it works in both layouts without extra branching.
    const lastRow = el.tiroListActive.lastElementChild;
    if (lastRow) lastRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flashHeroConfirmacao();
  }

  // Brief visual confirmation (green glow) when a shot is registered successfully.
  // Uses a fixed timer (instead of "animationend") so the class is always
  // removed, even when prefers-reduced-motion disables the animation.
  let heroConfirmTimer = null;
  function flashHeroConfirmacao() {
    if (heroConfirmTimer) clearTimeout(heroConfirmTimer);
    el.heroReadout.classList.remove("is-confirmed");
    // Force reflow to allow the animation to restart on consecutive registrations.
    void el.heroReadout.offsetWidth;
    el.heroReadout.classList.add("is-confirmed");
    heroConfirmTimer = setTimeout(() => {
      el.heroReadout.classList.remove("is-confirmed");
      heroConfirmTimer = null;
    }, 700);
  }

  function removerTiro(id) {
    state.tiros = state.tiros.filter((t) => t.id !== id);
    saveTiros();
    renderTiroList();
  }

  // Toggles a shot between "active" and "fired". The confirm button stays
  // visible in both states so a fired shot can be un-marked.
  function toggleDisparado(id) {
    const tiro = state.tiros.find((t) => t.id === id);
    if (!tiro) return;
    tiro.disparado = !tiro.disparado;
    saveTiros();
    renderTiroList();
  }

  function updateHeroElevacao(elevacao) {
    el.heroElevacao.innerHTML = `${Number(elevacao).toFixed(2)}<span class="unit">&deg;</span>`;
    el.heroReadout.classList.add("has-value");
  }

  function updateHeroDirecao(direcao) {
    const display =
      direcao === null || direcao === undefined ? "--" : `${Number(direcao)}`;
    el.heroDirecao.innerHTML = `${display}<span class="unit">&deg;</span>`;
  }

  function renderTiroRow(tiro) {
    const li = document.createElement("li");
    li.className = tiro.disparado ? "tiro-row is-fired" : "tiro-row";
    li.dataset.id = tiro.id;

    const direcaoDisplay =
      tiro.direcao === null || tiro.direcao === undefined
        ? "--"
        : `${Number(tiro.direcao)}&deg;`;
    const distanciaDisplay =
      tiro.distancia === null || tiro.distancia === undefined
        ? "--"
        : `${Number(tiro.distancia)}km`;

    const data = document.createElement("div");
    data.className = "tiro-data";
    data.innerHTML = `
      <span class="tiro-distancia"><span class="tiro-field-label">DIST</span><strong>${distanciaDisplay}</strong></span>
      <span class="tiro-elevacao"><span class="tiro-field-label">ELEV</span><strong>${Number(tiro.elevacao).toFixed(2)}&deg;</strong></span>
      <span class="tiro-carga"><span class="tiro-field-label">CHG</span><strong>${tiro.cargas}</strong></span>
      <span class="tiro-direcao"><span class="tiro-field-label">DIR</span><strong>${direcaoDisplay}</strong></span>
    `;

    const btnConfirm = document.createElement("button");
    btnConfirm.type = "button";
    btnConfirm.className = tiro.disparado ? "btn-confirm is-fired" : "btn-confirm";
    btnConfirm.setAttribute("aria-pressed", tiro.disparado ? "true" : "false");
    btnConfirm.setAttribute(
      "aria-label",
      tiro.disparado ? "Unmark this shot as fired" : "Mark this shot as fired"
    );
    btnConfirm.textContent = "✓";
    btnConfirm.addEventListener("click", () => toggleDisparado(tiro.id));

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn-remove";
    btnRemove.setAttribute("aria-label", "Remove this shot from the log");
    btnRemove.textContent = "✕";
    btnRemove.addEventListener("click", () => removerTiro(tiro.id));

    const actions = document.createElement("div");
    actions.className = "tiro-row-actions";
    actions.appendChild(btnConfirm);
    actions.appendChild(btnRemove);

    li.appendChild(data);
    li.appendChild(actions);
    return li;
  }

  function updateHeroFromState(ativos) {
    if (ativos.length === 0) {
      el.heroElevacao.innerHTML = `--.-<span class="unit">&deg;</span>`;
      el.heroDirecao.innerHTML = `--<span class="unit">&deg;</span>`;
      el.heroReadout.classList.remove("has-value");
      return;
    }
    // Reflects the topmost card in the active list — the next shot in the
    // queue — not necessarily the most recently calculated one.
    const proximo = ativos[0];
    updateHeroElevacao(proximo.elevacao);
    updateHeroDirecao(proximo.direcao);
  }

  function renderTiroList() {
    const ativos = state.tiros.filter((t) => !t.disparado);
    const disparados = state.tiros.filter((t) => t.disparado);

    el.tiroListActive.innerHTML = "";
    const activeFragment = document.createDocumentFragment();
    ativos.forEach((tiro) => activeFragment.appendChild(renderTiroRow(tiro)));
    el.tiroListActive.appendChild(activeFragment);
    el.tiroListEmpty.hidden = ativos.length !== 0;

    el.tiroListFired.innerHTML = "";
    const firedFragment = document.createDocumentFragment();
    disparados.forEach((tiro) => firedFragment.appendChild(renderTiroRow(tiro)));
    el.tiroListFired.appendChild(firedFragment);
    el.firedSection.hidden = disparados.length === 0;

    updateHeroFromState(ativos);
  }

  /* ------------------------------------------------------------------
   * Event wiring
   * ------------------------------------------------------------------ */
  function initFieldActivation() {
    el.wrapDistancia.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setActiveField("distancia");
    });
    el.wrapDirecao.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setActiveField("direcao");
    });
  }

  function initKeypad() {
    el.keypad.addEventListener("click", (e) => {
      const btn = e.target.closest(".key-btn");
      if (!btn) return;
      handleKeyPress(btn.dataset.key);
    });
  }

  function initChargeSelector() {
    el.chargeSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".charge-btn");
      if (!btn) return;
      selectCarga(Number(btn.dataset.carga));
    });
  }

  function initActions() {
    el.btnLimpar.addEventListener("click", limparCampos);
    el.btnCalcular.addEventListener("click", calcularTiro);
  }

  function preventGestureZoom() {
    // Extra guard against pinch/double-tap zoom on top of the viewport meta tag.
    document.addEventListener(
      "gesturestart",
      (e) => e.preventDefault(),
      { passive: false }
    );
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  function init() {
    initTheme();
    initHelpModal();
    buildDialTicks();
    initFieldActivation();
    initKeypad();
    initChargeSelector();
    initActions();
    preventGestureZoom();

    loadTiros();
    renderTiroList();

    setActiveField("distancia");
    renderFieldValue("distancia");
    renderFieldValue("direcao");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
