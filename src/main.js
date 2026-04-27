// ─── DOM ─────────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const funcSelect  = document.getElementById('func-select');
const copyFormulaBtn = document.getElementById('copy-formula');
const formulaEl   = document.getElementById('formula-display');
const formulaHoverEl = document.getElementById('formula-hover-content');
const trueValEl   = document.getElementById('true-val');
const approxValEl = document.getElementById('approx-val');
const absErrEl    = document.getElementById('abs-err');
const relErrEl    = document.getElementById('rel-err');
const lagrangeBoundEl = document.getElementById('lagrange-bound');
const lagrangeNoteEl = document.getElementById('lagrange-note');
const xEvalSlider = document.getElementById('x-eval');
const xEvalLabel  = document.getElementById('x-eval-label');
const snapXEvalBtn = document.getElementById('snap-xeval');
const zoomSlider  = document.getElementById('zoom-slider');
const zoomLabel   = document.getElementById('zoom-label');
const resetStateBtn = document.getElementById('reset-state');
const openMathBtn = document.getElementById('open-math');
const closeMathBtn= document.getElementById('close-math');
const langToggle  = document.getElementById('lang-toggle');
const mathModal   = document.getElementById('math-modal');
const mathContent = document.getElementById('math-content');

const DEFAULT_VIEW = { left: -7, right: 7, top: 4.5, bottom: -4.5 };
const ZOOM_RANGE = { min: 0.55, max: 2.4 };

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  funcKey: 'exp',
  order: 3,
  prevOrder: 0,
  a: 0,
  xEval: 1.5,
  zoom: 1,
  formulaLatex: '',
  view: { ...DEFAULT_VIEW },
  anim: { active: false, t: 1, startTime: 0, duration: 600 },
  drag: { active: false },
  modal: { lang: 'en' },
};

// ─── Math ────────────────────────────────────────────────────────────────────
function factorial(n) {
  if (n <= 0) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const FUNCS = {
  exp: {
    label: 'eˣ',
    latex: 'e^x',
    color: '#88C0D0',
    f: x => Math.exp(x),
    coeff: (a, n) => Math.exp(a) / factorial(n),
    domain: () => true,
  },
  cos: {
    label: 'cos x',
    latex: '\\cos x',
    color: '#A3BE8C',
    f: x => Math.cos(x),
    coeff: (a, n) => Math.cos(a + n * Math.PI / 2) / factorial(n),
    domain: () => true,
  },
  sin: {
    label: 'sin x',
    latex: '\\sin x',
    color: '#B48EAD',
    f: x => Math.sin(x),
    coeff: (a, n) => Math.sin(a + n * Math.PI / 2) / factorial(n),
    domain: () => true,
  },
  ln: {
    label: 'ln(1+x)',
    latex: '\\ln(1+x)',
    color: '#EBCB8B',
    f: x => Math.log(1 + x),
    coeff: (a, n) => {
      if (n === 0) return Math.log(1 + a);
      return Math.pow(-1, n - 1) / (n * Math.pow(1 + a, n));
    },
    domain: x => x > -1,
  },
};

function getCoeffs(funcKey, a, order) {
  return Array.from({ length: order + 1 }, (_, n) => FUNCS[funcKey].coeff(a, n));
}

function evalPoly(coeffs, a, x) {
  let result = 0;
  let xPow = 1;
  const dx = x - a;
  for (const c of coeffs) {
    result += c * xPow;
    xPow *= dx;
  }
  return result;
}

function getLagrangeBound(funcKey, a, order, x) {
  const dx = Math.abs(x - a);
  const nextOrder = order + 1;
  if (dx === 0) return 0;

  switch (funcKey) {
    case 'exp': {
      const maxExp = Math.exp(Math.max(a, x));
      return maxExp * Math.pow(dx, nextOrder) / factorial(nextOrder);
    }
    case 'cos':
    case 'sin':
      return Math.pow(dx, nextOrder) / factorial(nextOrder);
    case 'ln': {
      const minX = Math.min(a, x);
      if (minX <= -1) return NaN;
      return Math.pow(dx, nextOrder) / (nextOrder * Math.pow(1 + minX, nextOrder));
    }
    default:
      return NaN;
  }
}

function getLagrangeNote(funcKey) {
  switch (funcKey) {
    case 'exp':
      return 'M_{N+1} = e^{\\max(a, x)}';
    case 'cos':
    case 'sin':
      return 'M_{N+1} = 1';
    case 'ln':
      return 'M_{N+1} = \\dfrac{N!}{(1 + \\min(a, x))^{N+1}}';
    default:
      return 'M_{N+1}';
  }
}

// ─── Viewport ────────────────────────────────────────────────────────────────
const dpr = () => window.devicePixelRatio || 1;

function worldToCanvas(wx, wy) {
  const { left, right, top, bottom } = state.view;
  return [
    (wx - left) / (right - left) * canvas.width,
    (top - wy) / (top - bottom) * canvas.height,
  ];
}

function canvasToWorld(cx, cy) {
  const { left, right, top, bottom } = state.view;
  return [
    left + cx / canvas.width * (right - left),
    top  - cy / canvas.height * (top - bottom),
  ];
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width  * dpr();
  canvas.height = rect.height * dpr();
  canvas.style.width  = rect.width  + 'px';
  canvas.style.height = rect.height + 'px';
}

function clampZoom(zoom) {
  return Math.max(ZOOM_RANGE.min, Math.min(ZOOM_RANGE.max, zoom));
}

function setViewFromZoom(zoom, centerX = 0, centerY = 0) {
  const nextZoom = clampZoom(zoom);
  const halfWidth = (DEFAULT_VIEW.right - DEFAULT_VIEW.left) / (2 * nextZoom);
  const halfHeight = (DEFAULT_VIEW.top - DEFAULT_VIEW.bottom) / (2 * nextZoom);
  state.zoom = nextZoom;
  state.view = {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY + halfHeight,
    bottom: centerY - halfHeight,
  };
}

function syncZoomUI() {
  zoomSlider.value = state.zoom.toFixed(2);
  zoomLabel.textContent = `${state.zoom.toFixed(2)}×`;
}

function updateLagrangeNote() {
  const latex = getLagrangeNote(state.funcKey);
  if (window.katex) {
    try {
      lagrangeNoteEl.innerHTML = `<strong>Lagrange bound uses</strong><div>${window.katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      })}</div>`;
      return;
    } catch { /* fall through */ }
  }
  lagrangeNoteEl.innerHTML = `<strong>Lagrange bound uses</strong><div>${latex}</div>`;
}

function setXEval(x) {
  state.xEval = x;
  xEvalSlider.value = x.toFixed(2);
}

function resetInteractiveState() {
  state.a = 0;
  setXEval(state.a);
  state.anim.active = false;
  state.anim.t = 1;
  updateFormula();
  updateStats();
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
const N = {
  n0:'#2E3440', n1:'#3B4252', n2:'#434C5E', n3:'#4C566A',
  n4:'#D8DEE9', n5:'#E5E9F0', n6:'#ECEFF4',
  n7:'#8FBCBB', n8:'#88C0D0', n9:'#81A1C1', n10:'#5E81AC',
  n11:'#BF616A', n12:'#D08770', n13:'#EBCB8B', n14:'#A3BE8C', n15:'#B48EAD',
};

function niceStep(range) {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  if (n < 1.5) return mag;
  if (n < 3.5) return 2 * mag;
  if (n < 7.5) return 5 * mag;
  return 10 * mag;
}

function drawGrid() {
  const { left, right, top, bottom } = state.view;
  ctx.save();
  ctx.strokeStyle = N.n2;
  ctx.lineWidth = 0.5;
  const sx = niceStep(right - left);
  const sy = niceStep(top - bottom);
  const d = dpr();
  ctx.setLineDash([2 * d, 4 * d]);
  for (let x = Math.ceil(left / sx) * sx; x <= right + 1e-9; x += sx) {
    const [cx] = worldToCanvas(x, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  }
  for (let y = Math.ceil(bottom / sy) * sy; y <= top + 1e-9; y += sy) {
    const [, cy] = worldToCanvas(0, y);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAxes() {
  const { left, right, top, bottom } = state.view;
  const d = dpr();
  const [, y0] = worldToCanvas(0, 0);
  const [x0]   = worldToCanvas(0, 0);
  ctx.save();
  ctx.strokeStyle = N.n3;
  ctx.lineWidth = 1.5 * d;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(canvas.width, y0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, canvas.height); ctx.stroke();

  // Tick labels
  ctx.fillStyle = N.n4;
  ctx.font = `${11 * d}px monospace`;
  const sx = niceStep(right - left);
  const sy = niceStep(top - bottom);
  ctx.textAlign = 'center';
  for (let x = Math.ceil(left / sx) * sx; x <= right + 1e-9; x += sx) {
    if (Math.abs(x) < sx * 0.1) continue;
    const [cx] = worldToCanvas(x, 0);
    ctx.fillText(+x.toFixed(8) + '', cx, y0 + 14 * d);
  }
  ctx.textAlign = 'right';
  for (let y = Math.ceil(bottom / sy) * sy; y <= top + 1e-9; y += sy) {
    if (Math.abs(y) < sy * 0.1) continue;
    const [, cy] = worldToCanvas(0, y);
    ctx.fillText(+y.toFixed(8) + '', x0 - 6 * d, cy + 4 * d);
  }
  ctx.restore();
}

function drawCurve(fn, color, lineWidth, dashed) {
  const { left, right } = state.view;
  const steps = Math.min(1200, Math.floor(canvas.width / dpr()));
  const d = dpr();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * d;
  if (dashed) ctx.setLineDash([6 * d, 4 * d]);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const wx = left + (i / steps) * (right - left);
    try {
      const wy = fn(wx);
      if (!isFinite(wy) || Math.abs(wy) > 1e6) { started = false; continue; }
      const [cx, cy] = worldToCanvas(wx, wy);
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else ctx.lineTo(cx, cy);
    } catch { started = false; }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawErrorHeatmap(origFn, polyFn) {
  const { left, right } = state.view;
  const steps = Math.min(600, Math.floor(canvas.width / dpr() / 2));
  ctx.save();
  ctx.fillStyle = 'rgba(191,97,106,0.13)';
  for (let i = 0; i < steps; i++) {
    const wx1 = left + (i / steps) * (right - left);
    const wx2 = left + ((i + 1) / steps) * (right - left);
    try {
      const fy1 = origFn(wx1), fy2 = origFn(wx2);
      const py1 = polyFn(wx1), py2 = polyFn(wx2);
      if (!isFinite(fy1)||!isFinite(fy2)||!isFinite(py1)||!isFinite(py2)) continue;
      const [cx1, cfy1] = worldToCanvas(wx1, fy1);
      const [cx2, cfy2] = worldToCanvas(wx2, fy2);
      const [,    cpy1] = worldToCanvas(wx1, py1);
      const [,    cpy2] = worldToCanvas(wx2, py2);
      ctx.beginPath();
      ctx.moveTo(cx1, cfy1); ctx.lineTo(cx2, cfy2);
      ctx.lineTo(cx2, cpy2); ctx.lineTo(cx1, cpy1);
      ctx.closePath(); ctx.fill();
    } catch { /* skip */ }
  }
  ctx.restore();
}

function drawExpansionPoint() {
  const { funcKey, a } = state;
  const fn = FUNCS[funcKey];
  let ya;
  try { ya = fn.f(a); } catch { return; }
  if (!isFinite(ya)) return;

  const d = dpr();
  const [cx, cy] = worldToCanvas(a, ya);
  const [, axY]  = worldToCanvas(a, 0);
  const r = 7 * d;

  ctx.save();
  ctx.setLineDash([4 * d, 3 * d]);
  ctx.strokeStyle = N.n12;
  ctx.lineWidth = 1.5 * d;
  ctx.beginPath(); ctx.moveTo(cx, axY); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = N.n12;
  ctx.fill();
  ctx.strokeStyle = N.n0;
  ctx.lineWidth = 2 * d;
  ctx.stroke();

  ctx.fillStyle = N.n12;
  ctx.font = `${11 * d}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`a = ${a.toFixed(2)}`, cx, cy - 12 * d);
  ctx.restore();
}

function drawXEvalLine() {
  const d = dpr();
  const [cx] = worldToCanvas(state.xEval, 0);
  ctx.save();
  ctx.setLineDash([3 * d, 5 * d]);
  ctx.strokeStyle = N.n9;
  ctx.lineWidth = 1.2 * d;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  ctx.restore();
}

// ─── Formula LaTeX ────────────────────────────────────────────────────────────
function termLatex(funcKey, a, n) {
  const a0 = Math.abs(a) < 1e-9;
  if (a0) {
    switch (funcKey) {
      case 'exp':
        if (n === 0) return { s: 1, l: '1' };
        if (n === 1) return { s: 1, l: 'x' };
        return { s: 1, l: `\\dfrac{x^{${n}}}{${n}!}` };
      case 'cos': {
        if (n % 2 !== 0) return null;
        const sign = (n / 2) % 2 === 0 ? 1 : -1;
        if (n === 0) return { s: 1, l: '1' };
        return { s: sign, l: `\\dfrac{x^{${n}}}{${n}!}` };
      }
      case 'sin': {
        if (n % 2 !== 1) return null;
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        return { s: sign, l: n === 1 ? 'x' : `\\dfrac{x^{${n}}}{${n}!}` };
      }
      case 'ln': {
        if (n === 0) return null;
        const sign = n % 2 === 1 ? 1 : -1;
        return { s: sign, l: n === 1 ? 'x' : `\\dfrac{x^{${n}}}{${n}}` };
      }
    }
  }
  // Numeric fallback
  const c = FUNCS[funcKey].coeff(a, n);
  if (Math.abs(c) < 1e-14) return null;
  const sign = c >= 0 ? 1 : -1;
  const absC = Math.abs(c);
  const cStr = absC < 100 ? absC.toFixed(4) : absC.toExponential(2);
  if (n === 0) return { s: sign, l: cStr };
  const aAbs = Math.abs(a).toFixed(2);
  const aOp  = a >= 0 ? '-' : '+';
  const xPart = n === 1
    ? `(x\\,${aOp}\\,${aAbs})`
    : `(x\\,${aOp}\\,${aAbs})^{${n}}`;
  return { s: sign, l: `${cStr}\\,${xPart}` };
}

function buildFormulaLatex(funcKey, a, order, { compact = true } = {}) {
  const terms = [];
  for (let n = 0; n <= order; n++) {
    const t = termLatex(funcKey, a, n);
    if (t) terms.push({ ...t, n });
  }
  if (terms.length === 0) return `P_{${order}}(x) = 0`;

  const MAX = 5;
  const show = compact && terms.length > MAX + 1
    ? [...terms.slice(0, 3), null, terms[terms.length - 1]]
    : terms;

  let out = '';
  for (let i = 0; i < show.length; i++) {
    const term = show[i];
    if (term === null) { out += ' + \\cdots'; continue; }
    const { s, l, n } = term;
    const hi = n === order;
    const display = hi ? `{\\color{#D08770}{${l}}}` : l;
    if (i === 0) {
      out += s === -1 ? '-' + display : display;
    } else {
      out += s === -1 ? ' - ' + display : ' + ' + display;
    }
  }
  return `P_{${order}}(x) = ${out}`;
}

function buildFormulaBlockLatex(funcKey, a, order) {
  const terms = [];
  for (let n = 0; n <= order; n++) {
    const t = termLatex(funcKey, a, n);
    if (t) terms.push({ ...t, n });
  }
  if (terms.length === 0) return `P_{${order}}(x) = 0`;

  const lines = [];
  const chunkSize = 4;
  for (let i = 0; i < terms.length; i += chunkSize) {
    const chunk = terms.slice(i, i + chunkSize);
    let line = '';
    for (let j = 0; j < chunk.length; j++) {
      const { s, l, n } = chunk[j];
      const display = n === order ? `{\\color{#D08770}{${l}}}` : l;
      if (i === 0 && j === 0) {
        line += s === -1 ? `- ${display}` : display;
      } else {
        line += s === -1 ? ` - ${display}` : ` + ${display}`;
      }
    }
    lines.push(line);
  }

  return `\\begin{aligned}P_{${order}}(x) &= ${lines[0]}${lines.slice(1).map(line => `\\\\ &\\quad ${line}`).join('')}\\end{aligned}`;
}

// ─── UI updates ───────────────────────────────────────────────────────────────
function updateOrderButtons() {
  document.querySelectorAll('.order-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.order) === state.order);
  });
}

function updateFormula() {
  const compactLatex = buildFormulaLatex(state.funcKey, state.a, state.order, { compact: true });
  const fullLatex = buildFormulaBlockLatex(state.funcKey, state.a, state.order);
  state.formulaLatex = fullLatex;
  if (window.katex) {
    try {
      formulaEl.innerHTML = window.katex.renderToString(compactLatex, {
        throwOnError: false, displayMode: true,
      });
      formulaHoverEl.innerHTML = window.katex.renderToString(fullLatex, {
        throwOnError: false, displayMode: true,
      });
    } catch {
      formulaEl.textContent = compactLatex;
      formulaHoverEl.textContent = fullLatex;
    }
  } else {
    formulaEl.textContent = compactLatex;
    formulaHoverEl.textContent = fullLatex;
  }
  updateLagrangeNote();
}

async function copyFormulaToClipboard() {
  const originalTitle = copyFormulaBtn.title;
  const originalAria = copyFormulaBtn.getAttribute('aria-label');
  try {
    await navigator.clipboard.writeText(state.formulaLatex);
    copyFormulaBtn.title = 'Copied';
    copyFormulaBtn.setAttribute('aria-label', 'Copied');
  } catch {
    copyFormulaBtn.title = 'Copy failed';
    copyFormulaBtn.setAttribute('aria-label', 'Copy failed');
  }
  setTimeout(() => {
    copyFormulaBtn.title = originalTitle;
    copyFormulaBtn.setAttribute('aria-label', originalAria);
  }, 1200);
}

function updateStats() {
  const { funcKey, a, order, xEval } = state;
  const fn = FUNCS[funcKey];
  xEvalLabel.textContent = xEval.toFixed(2);

  if (!fn.domain(xEval)) {
    trueValEl.textContent = 'undefined';
    approxValEl.textContent = relErrEl.textContent = absErrEl.textContent = lagrangeBoundEl.textContent = '—';
    return;
  }
  const trueVal   = fn.f(xEval);
  const approxVal = evalPoly(getCoeffs(funcKey, a, order), a, xEval);
  const absErr    = Math.abs(trueVal - approxVal);
  const relErr    = Math.abs(trueVal) > 1e-10 ? (absErr / Math.abs(trueVal)) * 100 : NaN;
  const lagrangeBound = getLagrangeBound(funcKey, a, order, xEval);

  trueValEl.textContent   = isFinite(trueVal)   ? trueVal.toFixed(6)   : '±∞';
  approxValEl.textContent = isFinite(approxVal) ? approxVal.toFixed(6) : '±∞';
  absErrEl.textContent    = isFinite(absErr)     ? absErr.toExponential(3) : '—';
  relErrEl.textContent    = isFinite(relErr)     ? relErr.toFixed(3) + ' %' : '—';
  lagrangeBoundEl.textContent = isFinite(lagrangeBound) ? lagrangeBound.toExponential(3) : '—';
}

// ─── Render loop ──────────────────────────────────────────────────────────────
function render(timestamp = 0) {
  if (state.anim.active) {
    const elapsed = timestamp - state.anim.startTime;
    state.anim.t = Math.min(1, elapsed / state.anim.duration);
    if (state.anim.t >= 1) state.anim.active = false;
  }

  const { funcKey, a, order, prevOrder } = state;
  const fn = FUNCS[funcKey];
  const t  = easeInOut(state.anim.t);

  const coeffsNew  = getCoeffs(funcKey, a, order);
  const coeffsPrev = getCoeffs(funcKey, a, prevOrder);

  const polyFn = x => {
    const yN = evalPoly(coeffsNew, a, x);
    if (!state.anim.active) return yN;
    return evalPoly(coeffsPrev, a, x) * (1 - t) + yN * t;
  };

  const origFn = x => {
    if (!fn.domain(x)) throw new Error('domain');
    return fn.f(x);
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = N.n0;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawAxes();
  drawXEvalLine();
  drawErrorHeatmap(origFn, polyFn);

  // Original function — light dashed background layer
  drawCurve(origFn, N.n4, 1, true);

  // Taylor polynomial — bright foreground
  drawCurve(polyFn, fn.color, 2.5, false);

  drawExpansionPoint();
  requestAnimationFrame(render);
}

// ─── Events ───────────────────────────────────────────────────────────────────
function triggerAnim(prevOrder) {
  state.prevOrder = prevOrder;
  state.anim = { active: true, t: 0, startTime: performance.now(), duration: 600 };
}

funcSelect.addEventListener('change', () => {
  const prev = state.order;
  state.funcKey = funcSelect.value;
  if (state.funcKey === 'ln' && state.a <= -1) state.a = 0;
  triggerAnim(prev);
  updateFormula();
  updateStats();
});

document.querySelectorAll('.order-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const n = parseInt(btn.dataset.order);
    if (n === state.order) return;
    triggerAnim(state.order);
    state.order = n;
    updateOrderButtons();
    updateFormula();
    updateStats();
  });
});

xEvalSlider.addEventListener('input', () => {
  setXEval(parseFloat(xEvalSlider.value));
  updateStats();
});

snapXEvalBtn.addEventListener('click', () => {
  setXEval(state.a);
  updateStats();
});

copyFormulaBtn.addEventListener('click', () => {
  copyFormulaToClipboard();
});

zoomSlider.addEventListener('input', () => {
  const centerX = (state.view.left + state.view.right) / 2;
  const centerY = (state.view.top + state.view.bottom) / 2;
  setViewFromZoom(parseFloat(zoomSlider.value), centerX, centerY);
  syncZoomUI();
});

resetStateBtn.addEventListener('click', () => {
  resetInteractiveState();
});

// Drag expansion point
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const d = dpr();
  const cx = (e.clientX - rect.left) * d;
  const cy = (e.clientY - rect.top) * d;
  const [aCx, aCy] = worldToCanvas(state.a, FUNCS[state.funcKey].f(state.a));
  if (Math.hypot(cx - aCx, cy - aCy) < 15 * d) {
    state.drag.active = true;
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const d = dpr();
  const cx = (e.clientX - rect.left) * d;
  const cy = (e.clientY - rect.top) * d;

  if (state.drag.active) {
    const [wx] = canvasToWorld(cx, cy);
    let newA = Math.max(state.view.left + 0.5, Math.min(state.view.right - 0.5, wx));
    if (state.funcKey === 'ln') newA = Math.max(-0.95, newA);
    state.a = newA;
    state.anim.active = false;
    state.anim.t = 1;
    updateFormula();
    updateStats();
    return;
  }

  try {
    const [aCx, aCy] = worldToCanvas(state.a, FUNCS[state.funcKey].f(state.a));
    canvas.style.cursor = Math.hypot(cx - aCx, cy - aCy) < 15 * d ? 'grab' : 'crosshair';
  } catch { /* ignore */ }
});

canvas.addEventListener('mouseup',    () => { state.drag.active = false; canvas.style.cursor = 'crosshair'; });
canvas.addEventListener('mouseleave', () => { state.drag.active = false; });

// Scroll zoom — keep mouse world-position fixed
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const d = dpr();
  const [mx, my] = canvasToWorld((e.clientX - rect.left) * d, (e.clientY - rect.top) * d);
  const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
  const nextZoom = state.zoom * factor;
  setViewFromZoom(nextZoom, mx, my);
  syncZoomUI();
}, { passive: false });

// ─── Modal ────────────────────────────────────────────────────────────────────
const MODAL = {
  en: `
    <section>
      <h3>Core Idea</h3>
      <p>A Taylor series expands $f(x)$ around a center point $a$ as an infinite polynomial:</p>
      <p>$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
      <p>The orange point is the expansion center. Moving it changes the local approximation.</p>
    </section>
    <section>
      <h3>What the App Draws</h3>
      <p>The app shows the <strong>N-th order Taylor polynomial</strong>, which truncates the series after $N$:</p>
      <p>$$P_N(x) = \\sum_{n=0}^{N} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
      <ul>
        <li>The dashed curve is the original function $f(x)$.</li>
        <li>The bright curve is the approximation $P_N(x)$.</li>
        <li>The shaded region highlights the gap between them.</li>
      </ul>
    </section>
    <section>
      <h3>Error Metrics</h3>
      <p>The <strong>Lagrange remainder</strong> gives a standard upper bound on approximation error:</p>
      <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}, \\quad M_{N+1} = \\max_{\\xi}|f^{(N+1)}(\\xi)|$$</p>
      <p>Here, $R_N(x) = f(x) - P_N(x)$ is the part left over after truncating the Taylor series at order $N$.</p>
      <p>It is not the polynomial itself; it is the <strong>remaining error term</strong>. The formula above tells you how large that leftover can be, using a bound on the next derivative.</p>
      <p><strong>Reading the formula:</strong></p>
      <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}$$</p>
      <p>Three variables control the size of the error:</p>
      <ul>
        <li><strong>Distance</strong> $|x-a|$: the farther you move away from the expansion center $a$, the faster the error usually grows. This is why Taylor approximations are strongest near the center.</li>
        <li><strong>Order</strong> $(N+1)!$: factorial growth is very fast. Increasing the Taylor order makes the denominator much larger, which usually pushes the error bound down.</li>
        <li><strong>Oscillation</strong> $M_{N+1}$: this is the largest value of the $(N+1)$-th derivative on the interval. If the function bends or changes rapidly there, the error can be larger.</li>
      </ul>
      <p><strong>Intuition:</strong> you can think of $M_{N+1}$ as the function's "top speed" at the next derivative level. If $M_{N+1}$ is small, the function stays smooth and the Taylor polynomial predicts well. If $M_{N+1}$ is large, a sharp higher-order turn can make the approximation distort more easily.</p>
      <p>The panel also reports <strong>relative error</strong>:</p>
      <p>$$\\text{rel. error} = \\frac{|f(x)-P_N(x)|}{|f(x)|} \\times 100\\%$$</p>
      <p>It measures how large the approximation error is compared with the true value itself. If $f(x)$ is extremely close to $0$, the ratio becomes unstable, so the UI hides it.</p>
    </section>
    <section>
      <h3>How to Read the Result</h3>
      <p>Adding more terms usually improves the fit near $a$, because each new power of $(x-a)$ captures finer local curvature.</p>
      <p>For functions like $e^x$, the approximation converges broadly. For others, the quality depends more strongly on both the center $a$ and the evaluation point $x$.</p>
    </section>
    <section>
      <h3>Implementation Note</h3>
      <pre><code class="language-js">// Core loop: evaluate P_N(x) via Horner's scheme
function evalPoly(coeffs, a, x) {
  let r = 0, xPow = 1;
  for (const c of coeffs) { r += c * xPow; xPow *= (x - a); }
  return r;
}</code></pre>
    </section>
  `,
  zhTW: `
    <section>
      <h3>核心概念</h3>
      <p>泰勒級數將 $f(x)$ 在中心點 $a$ 附近展開成無窮多項式：</p>
      <p>$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
      <p>畫面上的橘點就是展開中心。你拖動它時，局部近似也會跟著改變。</p>
    </section>
    <section>
      <h3>這個 App 在畫什麼</h3>
      <p>畫面顯示的是 <strong>N 階泰勒多項式</strong>，也就是把級數截到第 $N$ 項：</p>
      <p>$$P_N(x) = \\sum_{n=0}^{N} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
      <ul>
        <li>虛線曲線是原始函數 $f(x)$。</li>
        <li>亮色曲線是近似多項式 $P_N(x)$。</li>
        <li>橘色陰影區域表示兩者之間的落差。</li>
      </ul>
    </section>
    <section>
      <h3>誤差怎麼看</h3>
      <p><strong>拉格朗日餘項</strong>提供了近似誤差的標準上界：</p>
      <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}, \\quad M_{N+1} = \\max_{\\xi}|f^{(N+1)}(\\xi)|$$</p>
      <p>其中 $R_N(x) = f(x) - P_N(x)$，表示把泰勒級數截到第 $N$ 階之後，還剩下多少沒有被多項式捕捉到。</p>
      <p>它不是泰勒多項式本身，而是<strong>剩餘的誤差項</strong>。上面的公式不是直接算出誤差，而是用下一階導數的大小去估計這個誤差最多有多大。</p>
      <p><strong>公式拆解：</strong></p>
      <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}$$</p>
      <p>這裡有三個決定誤差大小的關鍵變數：</p>
      <ul>
        <li><strong>距離</strong> $|x-a|$：你離展開點 $a$ 越遠，誤差通常就會很快放大。這也是為什麼泰勒展開在中心點附近最準。</li>
        <li><strong>階數</strong> $(N+1)!$：分母的階乘成長非常快。當你提高展開階數時，分母會迅速變大，通常會把誤差上界壓低。</li>
        <li><strong>震盪程度</strong> $M_{N+1}$：它是該區間上第 $(N+1)$ 階導函數的最大值。如果函數在那裡變化很劇烈，誤差就可能更大。</li>
      </ul>
      <p><strong>直觀理解：</strong>你可以把 $M_{N+1}$ 想成函數在「下一階的最高時速」。如果 $M_{N+1}$ 很小，代表函數走勢平穩，泰勒多項式會比較準；如果 $M_{N+1}$ 很大，代表高階變化突然變強，近似就更容易失真。</p>
      <p>右側面板還會顯示 <strong>相對誤差</strong>：</p>
      <p>$$\\text{rel. error} = \\frac{|f(x)-P_N(x)|}{|f(x)|} \\times 100\\%$$</p>
      <p>它表示誤差相對於真值本身有多大。當 $f(x)$ 非常接近 $0$ 時，比例會變得不穩定，所以介面會把它隱藏成不可用。</p>
    </section>
    <section>
      <h3>如何解讀結果</h3>
      <p>通常在 $a$ 附近，階數越高，近似會越好，因為每多一項就多捕捉一層局部曲率資訊。</p>
      <p>像 $e^x$ 這類函數，收斂範圍很廣；其他函數則會更依賴展開中心 $a$ 與評估點 $x$ 的位置。</p>
    </section>
    <section>
      <h3>程式實作</h3>
      <pre><code class="language-js">// 核心迴圈：用迭代方式求 P_N(x)
function evalPoly(coeffs, a, x) {
  let r = 0, xPow = 1;
  for (const c of coeffs) { r += c * xPow; xPow *= (x - a); }
  return r;
}</code></pre>
    </section>
  `,
};

function renderModal() {
  mathContent.innerHTML = MODAL[state.modal.lang];
  if (window.renderMathInElement) {
    window.renderMathInElement(mathContent, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
      ],
    });
  }
  if (window.Prism) window.Prism.highlightAllUnder(mathContent);
}

openMathBtn.addEventListener('click',  () => { renderModal(); mathModal.hidden = false; });
closeMathBtn.addEventListener('click', () => { mathModal.hidden = true; });
mathModal.addEventListener('click', e => { if (e.target === mathModal) mathModal.hidden = true; });
langToggle.addEventListener('click', () => {
  state.modal.lang = state.modal.lang === 'en' ? 'zhTW' : 'en';
  renderModal();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
updateOrderButtons();
syncZoomUI();

const waitKatex = () => {
  if (window.katex) { updateFormula(); updateStats(); }
  else setTimeout(waitKatex, 60);
};
waitKatex();

requestAnimationFrame(render);
