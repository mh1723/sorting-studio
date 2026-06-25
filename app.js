/* ============================================================================
   app.js — UI, transport, and synced rendering for Sorting Studio
   ============================================================================ */
(function () {
  'use strict';

  const { ALGOS, CODE, generateArray } = window.Sorting;
  const byId = (id) => document.getElementById(id);

  /* ------------------------------- state --------------------------------- */
  const state = {
    length: 9,
    preset: 'random',
    base: [],                       // current unsorted array
    maxVal: 1,
    selected: new Set(ALGOS.map(a => a.id)),   // all four on by default
    traces: {},                     // id -> [frames]
    panels: {},                     // id -> { refs }
    lang: {},                       // id -> 'pseudo' | 'python' | 'java'
    step: 0,
    maxSteps: 0,
    playing: false,
    speed: 1,
    timer: null,
    layout: 'grid'                  // 'grid' (2×2) | 'row' (side by side)
  };
  ALGOS.forEach(a => { state.lang[a.id] = 'pseudo'; });

  const ALGO_BY_ID = {};
  ALGOS.forEach(a => { ALGO_BY_ID[a.id] = a; });

  const TAGS = {
    start: 'Setup', outer: 'Pick',
    inner_compare: 'Compare', find_min_compare: 'Compare', merge_compare: 'Compare', partition_compare: 'Compare',
    set_min: 'Update',
    shift: 'Move', merge_left: 'Move', merge_right: 'Move', merge_copy: 'Move',
    insert: 'Insert', swap: 'Swap', partition_swap: 'Swap',
    pivot_select: 'Pivot', place_pivot: 'Place', pivot_placed: 'Locked',
    placed: 'Fixed', split: 'Divide', merged: 'Merged', recurse: 'Recurse', base: 'Base', done: 'Done'
  };

  /* ---------------------------- DOM references --------------------------- */
  const el = {
    panels: byId('panels'),
    lenSlider: byId('lenSlider'), lenValue: byId('lenValue'),
    preset: byId('presetSelect'), regen: byId('regenBtn'),
    chips: byId('algoChips'),
    layoutToggle: byId('layoutToggle'),
    reset: byId('resetBtn'), back: byId('backBtn'), play: byId('playBtn'), fwd: byId('fwdBtn'),
    speed: byId('speedSlider'), speedValue: byId('speedValue'),
    scrubber: byId('scrubber'), stepValue: byId('stepValue'), stepMax: byId('stepMax'),
    srStatus: byId('srStatus')
  };

  /* ----------------------------- chips setup ----------------------------- */
  function buildChips() {
    ALGOS.forEach(a => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.algo = a.id;
      b.textContent = a.name.replace(' Sort', '');
      b.setAttribute('aria-pressed', state.selected.has(a.id) ? 'true' : 'false');
      b.addEventListener('click', () => toggleAlgo(a.id, b));
      el.chips.appendChild(b);
    });
  }

  function toggleAlgo(id, btn) {
    if (state.selected.has(id)) {
      if (state.selected.size === 1) return;     // keep at least one selected
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    btn.setAttribute('aria-pressed', state.selected.has(id) ? 'true' : 'false');
    structuralRefresh();
  }

  /* --------------------------- array generation -------------------------- */
  function regenerate(resetStep) {
    state.base = generateArray(state.length, state.preset);
    state.maxVal = Math.max.apply(null, state.base);
    if (resetStep) state.step = 0;
    structuralRefresh();
  }

  /* --------- recompute traces, rebuild panels, then render a frame -------- */
  function structuralRefresh() {
    // traces (only for selected algorithms)
    state.traces = {};
    let max = 0;
    selectedAlgos().forEach(a => {
      const fr = a.trace(state.base);
      state.traces[a.id] = fr;
      if (fr.length > max) max = fr.length;
    });
    state.maxSteps = max;
    if (state.step > max - 1) state.step = Math.max(0, max - 1);

    buildPanels();
    syncTransport();
    renderFrame();
  }

  function selectedAlgos() {
    return ALGOS.filter(a => state.selected.has(a.id));
  }

  // choose the grid shape: a single panel always centers; otherwise honour the
  // 'grid' (2×2) vs 'row' (side by side) choice.
  function applyLayout() {
    const single = selectedAlgos().length === 1;
    el.panels.classList.toggle('cols-1', single);
    el.panels.classList.toggle('layout-row', !single && state.layout === 'row');
    el.panels.classList.toggle('layout-grid', !single && state.layout === 'grid');
  }

  function setLayout(layout) {
    if (state.layout === layout) return;
    state.layout = layout;
    el.layoutToggle.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.layout === layout));
    applyLayout();
  }

  /* ------------------------------ panels --------------------------------- */
  function buildPanels() {
    el.panels.innerHTML = '';
    state.panels = {};

    const algos = selectedAlgos();
    applyLayout();

    if (algos.length === 0) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'Pick at least one method above to begin.';
      el.panels.appendChild(note);
      return;
    }

    algos.forEach(a => el.panels.appendChild(buildPanel(a)));
  }

  function buildPanel(algo) {
    const lang = state.lang[algo.id];

    const panel = document.createElement('article');
    panel.className = 'panel';
    panel.dataset.algo = algo.id;

    // head
    const head = document.createElement('div');
    head.className = 'panel-head';

    const title = document.createElement('div');
    title.className = 'p-title';
    title.innerHTML =
      `<span class="accent"></span><h2>${algo.name}</h2>` +
      `<span class="complexity">${algo.complexity}</span>`;

    const toggle = document.createElement('div');
    toggle.className = 'lang-toggle';
    [['pseudo', 'Pseudocode'], ['python', 'Python'], ['java', 'Java']].forEach(([key, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.lang = key;
      if (key === lang) b.classList.add('active');
      b.addEventListener('click', () => setLang(algo.id, key));
      toggle.appendChild(b);
    });

    head.appendChild(title);
    head.appendChild(toggle);

    // code pane
    const codePane = document.createElement('div');
    codePane.className = 'code-pane';
    const code = buildCode(algo.id, lang);
    codePane.appendChild(code);

    // description
    const desc = document.createElement('div');
    desc.className = 'desc-bar';
    desc.innerHTML = `<span class="tag">Setup</span><span class="desc-text"></span>`;

    // viz
    const viz = document.createElement('div');
    viz.className = 'viz';
    const bars = document.createElement('div');
    bars.className = 'bars';
    const cellRefs = buildCells(bars, state.base.length);
    viz.appendChild(bars);

    // foot
    const foot = document.createElement('div');
    foot.className = 'panel-foot';
    foot.innerHTML =
      `<span class="step-readout"></span>` +
      `<span class="done-pill">✓ sorted</span>`;

    panel.appendChild(head);
    panel.appendChild(codePane);
    panel.appendChild(desc);
    panel.appendChild(viz);
    panel.appendChild(foot);

    state.panels[algo.id] = {
      panel, codePane,
      codeLines: Array.from(code.children),
      tag: desc.querySelector('.tag'),
      descText: desc.querySelector('.desc-text'),
      descBar: desc,
      cells: cellRefs,
      stepReadout: foot.querySelector('.step-readout')
    };
    return panel;
  }

  function buildCode(algoId, lang) {
    const code = document.createElement('div');
    code.className = 'code';
    const lines = CODE[algoId][lang];
    lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'code-line';
      if (line.l) row.dataset.label = line.l;
      const isBlank = line.t === '';
      row.innerHTML =
        `<span class="ln">${isBlank ? '' : (i + 1)}</span>` +
        `<span class="src">${escapeHtml(isBlank ? ' ' : line.t)}</span>`;
      code.appendChild(row);
    });
    return code;
  }

  function buildCells(bars, n) {
    const refs = [];
    for (let i = 0; i < n; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.innerHTML = `<span class="val"></span>`;
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = i;
      cell.appendChild(bar);
      cell.appendChild(idx);
      bars.appendChild(cell);
      refs.push({ cell, bar, val: bar.querySelector('.val') });
    }
    return refs;
  }

  function setLang(algoId, lang) {
    if (state.lang[algoId] === lang) return;
    state.lang[algoId] = lang;
    const p = state.panels[algoId];
    if (!p) return;
    // rebuild just this panel's code listing
    const fresh = buildCode(algoId, lang);
    p.codePane.innerHTML = '';
    p.codePane.appendChild(fresh);
    p.codeLines = Array.from(fresh.children);
    // update toggle buttons
    p.panel.querySelectorAll('.lang-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    renderPanel(algoId);
  }

  /* ------------------------------ rendering ------------------------------ */
  function renderFrame() {
    // global transport readouts
    el.stepValue.textContent = state.maxSteps ? (state.step + 1) : 0;
    el.stepMax.textContent = state.maxSteps;
    el.scrubber.value = state.step;
    selectedAlgos().forEach(a => renderPanel(a.id));
    // announce only on manual navigation, not on every autoplay tick (avoids flooding screen readers)
    if (el.srStatus && !state.playing) {
      el.srStatus.textContent = state.maxSteps ? `Step ${state.step + 1} of ${state.maxSteps}` : 'No method selected';
    }
  }

  function renderPanel(algoId) {
    const p = state.panels[algoId];
    const frames = state.traces[algoId];
    if (!p || !frames) return;

    const eff = Math.min(state.step, frames.length - 1);
    const frame = frames[eff];
    const isDone = eff >= frames.length - 1;

    // code highlight
    let firstHl = null;
    for (const row of p.codeLines) {
      const on = !!frame.label && row.dataset.label === frame.label;
      row.classList.toggle('hl', on);
      if (on && !firstHl) firstHl = row;
    }
    if (firstHl) scrollLineIntoView(p.codePane, firstHl);

    // description
    p.tag.textContent = TAGS[frame.label] || 'Step';
    p.descText.textContent = frame.desc;
    p.descBar.classList.toggle('is-done', frame.label === 'done');

    // bars
    const sorted = new Set(frame.sorted);
    const range = frame.range;
    const cells = p.cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const value = frame.array[i];
      const h = 14 + (value / state.maxVal) * 78;       // 14%..92%
      c.bar.style.height = h + '%';
      c.val.textContent = value;

      let role = frame.roles[i] || (sorted.has(i) ? 'sorted' : '');
      c.bar.className = 'bar' + (role ? ' r-' + role : '');
      c.cell.classList.toggle('in-range', !!range && i >= range[0] && i <= range[1]);
    }

    // footer
    p.stepReadout.textContent = `Step ${eff + 1} / ${frames.length}`;
    p.panel.classList.toggle('is-done', isDone);
  }

  /* ------------------------------ transport ------------------------------ */
  function syncTransport() {
    const has = state.maxSteps > 0;
    el.scrubber.max = Math.max(0, state.maxSteps - 1);
    el.scrubber.disabled = !has;
    [el.reset, el.back, el.play, el.fwd].forEach(b => { b.disabled = !has; });
    if (!has && state.playing) pause();
  }

  function gotoStep(s) {
    state.step = Math.max(0, Math.min(s, Math.max(0, state.maxSteps - 1)));
    renderFrame();
  }

  function stepForward() {
    if (state.step >= state.maxSteps - 1) { pause(); return false; }
    state.step++;
    renderFrame();
    return true;
  }

  function stepBack() { gotoStep(state.step - 1); }

  function play() {
    if (state.maxSteps === 0) return;
    if (state.step >= state.maxSteps - 1) state.step = 0;   // replay from start
    state.playing = true;
    el.play.textContent = '⏸';
    el.play.setAttribute('aria-label', 'Pause');
    startTimer();
  }

  function pause() {
    state.playing = false;
    el.play.textContent = '▶';
    el.play.setAttribute('aria-label', 'Play');
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function togglePlay() { state.playing ? pause() : play(); }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!stepForward()) pause();
    }, 1000 / state.speed);
  }

  /* ------------------------------- events -------------------------------- */
  function wireEvents() {
    el.lenSlider.addEventListener('input', () => {
      state.length = parseInt(el.lenSlider.value, 10);
      el.lenValue.textContent = state.length;
      regenerate(true);
    });

    el.preset.addEventListener('change', () => {
      state.preset = el.preset.value;
      regenerate(true);
    });

    el.regen.addEventListener('click', () => regenerate(true));

    el.layoutToggle.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => setLayout(b.dataset.layout)));

    el.speed.addEventListener('input', () => {
      state.speed = parseInt(el.speed.value, 10);
      el.speedValue.textContent = state.speed;
      if (state.playing) startTimer();
    });

    el.scrubber.addEventListener('input', () => {
      if (state.playing) pause();
      gotoStep(parseInt(el.scrubber.value, 10));
    });

    el.reset.addEventListener('click', () => { pause(); gotoStep(0); });
    el.back.addEventListener('click', () => { pause(); stepBack(); });
    el.fwd.addEventListener('click', () => { pause(); stepForward(); });
    el.play.addEventListener('click', togglePlay);

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (typing) return;   // let sliders / selects use Space and arrows natively
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); pause(); stepForward(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); pause(); stepBack(); }
    });
  }

  // keep the highlighted code line visible inside its (possibly scrolling) pane,
  // adjusting only the pane's own scroll — never the page.
  function scrollLineIntoView(pane, line) {
    const lr = line.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    const top = lr.top - pr.top + pane.scrollTop;
    const bottom = top + lr.height;
    if (top < pane.scrollTop) pane.scrollTop = Math.max(0, top - 10);
    else if (bottom > pane.scrollTop + pane.clientHeight) pane.scrollTop = bottom - pane.clientHeight + 10;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* -------------------------------- init --------------------------------- */
  function init() {
    buildChips();
    wireEvents();
    el.lenSlider.value = state.length;
    el.lenValue.textContent = state.length;
    el.speed.value = state.speed;
    el.speedValue.textContent = state.speed;
    regenerate(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
