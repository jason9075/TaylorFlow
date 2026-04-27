// ─── DOM ─────────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const funcSelect  = document.getElementById('func-select');
const formulaEl   = document.getElementById('formula-display');
const trueValEl   = document.getElementById('true-val');
const approxValEl = document.getElementById('approx-val');
const absErrEl    = document.getElementById('abs-err');
const relErrEl    = document.getElementById('rel-err');
const xEvalSlider = document.getElementById('x-eval');
const xEvalLabel  = document.getElementById('x-eval-label');
const openMathBtn = document.getElementById('open-math');
const closeMathBtn= document.getElementById('close-math');
const langToggle  = document.getElementById('lang-toggle');
const mathModal   = document.getElementById('math-modal');
const mathContent = document.getElementById('math-content');

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  funcKey: 'exp',
  order: 3,
  prevOrder: 0,
  a: 0,
  xEval: 1.5,
  view: { left: -7, right: 7, top: 4.5, bottom: -4.5 },
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

function buildFormulaLatex(funcKey, a, order) {
  const terms = [];
  for (let n = 0; n <= order; n++) {
    const t = termLatex(funcKey, a, n);
    if (t) terms.push({ ...t, n });
  }
  if (terms.length === 0) return `P_{${order}}(x) = 0`;

  const MAX = 5;
  const show = terms.length > MAX + 1
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

// ─── UI updates ───────────────────────────────────────────────────────────────
function updateOrderButtons() {
  document.querySelectorAll('.order-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.order) === state.order);
  });
}

function updateFormula() {
  const latex = buildFormulaLatex(state.funcKey, state.a, state.order);
  if (window.katex) {
    try {
      formulaEl.innerHTML = window.katex.renderToString(latex, {
        throwOnError: false, displayMode: true,
      });
    } catch { formulaEl.textContent = latex; }
  } else {
    formulaEl.textContent = latex;
  }
}

function updateStats() {
  const { funcKey, a, order, xEval } = state;
  const fn = FUNCS[funcKey];
  xEvalLabel.textContent = xEval.toFixed(2);

  if (!fn.domain(xEval)) {
    trueValEl.textContent = 'undefined';
    approxValEl.textContent = relErrEl.textContent = absErrEl.textContent = '—';
    return;
  }
  const trueVal   = fn.f(xEval);
  const approxVal = evalPoly(getCoeffs(funcKey, a, order), a, xEval);
  const absErr    = Math.abs(trueVal - approxVal);
  const relErr    = Math.abs(trueVal) > 1e-10 ? (absErr / Math.abs(trueVal)) * 100 : NaN;

  trueValEl.textContent   = isFinite(trueVal)   ? trueVal.toFixed(6)   : '±∞';
  approxValEl.textContent = isFinite(approxVal) ? approxVal.toFixed(6) : '±∞';
  absErrEl.textContent    = isFinite(absErr)     ? absErr.toExponential(3) : '—';
  relErrEl.textContent    = isFinite(relErr)     ? relErr.toFixed(3) + ' %' : '—';
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
  state.xEval = parseFloat(xEvalSlider.value);
  updateStats();
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
  const f = e.deltaY > 0 ? 1.12 : 0.88;
  const v = state.view;
  state.view = {
    left:   mx + (v.left   - mx) * f,
    right:  mx + (v.right  - mx) * f,
    top:    my + (v.top    - my) * f,
    bottom: my + (v.bottom - my) * f,
  };
}, { passive: false });

document.getElementById('zoom-origin').addEventListener('click', () => {
  const a = state.a;
  const r = 2;
  state.view = { left: a - r, right: a + r, top: r, bottom: -r };
});

document.getElementById('zoom-reset').addEventListener('click', () => {
  state.view = { left: -7, right: 7, top: 4.5, bottom: -4.5 };
});

// ─── Modal ────────────────────────────────────────────────────────────────────
const MODAL = {
  en: `
    <h3>Taylor Series</h3>
    <p>A Taylor series expands $f(x)$ around a center point $a$ as an infinite polynomial:</p>
    <p>$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
    <p>The <strong>N-th order polynomial</strong> truncates this sum and approximates $f$:</p>
    <p>$$P_N(x) = \\sum_{n=0}^{N} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
    <p>The <strong>Lagrange remainder</strong> bounds the error:</p>
    <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}, \\quad M_{N+1} = \\max_{\\xi}|f^{(N+1)}(\\xi)|$$</p>
    <p>Each new term adds a correction proportional to $(x-a)^n$, capturing finer curvature.
    As $N \\to \\infty$, the shaded error region shrinks to zero — for functions with infinite
    radius of convergence like $e^x$, everywhere simultaneously.</p>
    <pre><code class="language-js">// Core loop: evaluate P_N(x) via Horner's scheme
function evalPoly(coeffs, a, x) {
  let r = 0, xPow = 1;
  for (const c of coeffs) { r += c * xPow; xPow *= (x - a); }
  return r;
}</code></pre>
  `,
  zhTW: `
    <h3>泰勒級數</h3>
    <p>泰勒級數將 $f(x)$ 在中心點 $a$ 附近展開為無窮多項式之和：</p>
    <p>$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
    <p><strong>N 階泰勒多項式</strong>截取前 $N+1$ 項來近似 $f$：</p>
    <p>$$P_N(x) = \\sum_{n=0}^{N} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$</p>
    <p><strong>拉格朗日餘項</strong>給出誤差上界：</p>
    <p>$$|R_N(x)| \\leq \\frac{M_{N+1}}{(N+1)!}|x-a|^{N+1}, \\quad M_{N+1} = \\max_{\\xi}|f^{(N+1)}(\\xi)|$$</p>
    <p>每新增一項，就加入一個正比於 $(x-a)^n$ 的修正量，能捕捉更高頻的曲率細節。
    當 $N \\to \\infty$ 時，橘色陰影誤差帶收縮至零——對 $e^x$ 這類收斂半徑無窮的函數，
    整條實數軸上都成立。</p>
    <pre><code class="language-js">// 核心迴圈：用迭代方式求 P_N(x)
function evalPoly(coeffs, a, x) {
  let r = 0, xPow = 1;
  for (const c of coeffs) { r += c * xPow; xPow *= (x - a); }
  return r;
}</code></pre>
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

const waitKatex = () => {
  if (window.katex) { updateFormula(); updateStats(); }
  else setTimeout(waitKatex, 60);
};
waitKatex();

requestAnimationFrame(render);
