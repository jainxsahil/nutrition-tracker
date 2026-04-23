// ── Constants ──────────────────────────────────────────────────────────────

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber'];

// Threshold config — adjust these to change color-coding on the Dashboard
const THRESHOLDS = {
  maximize:   { low: 0.75, ok: 0.95 },
  minimize:   { warn: 0.90, over: 1.00 },
  goldilocks: { lowRed: 0.70, lowAmber: 0.85, highAmber: 1.15, highRed: 1.30 },
};

const NUTRIENT_TYPE = {
  calories: 'maximize',
  protein:  'maximize',
  carbs:    'maximize',
  fat:      'minimize',
  sugar:    'minimize',
  fiber:    'goldilocks',
};

const LABELS = {
  calories: 'Calories',
  protein:  'Protein',
  carbs:    'Carbs',
  fat:      'Fat',
  sugar:    'Added Sugar',
  fiber:    'Fiber',
};

const UNITS = {
  calories: 'kcal',
  protein:  'g',
  carbs:    'g',
  fat:      'g',
  sugar:    'g',
  fiber:    'g',
};

const COLORS = {
  calories: '#FF7A40',
  protein:  '#38BDF8',
  carbs:    '#FBBF24',
  fat:      '#A78BFA',
  sugar:    '#F87171',
  fiber:    '#4ADE80',
};

const DEFAULT_GOALS = {
  calories: 2000,
  protein:  150,
  carbs:    250,
  fat:      65,
  sugar:    36,
  fiber:    30,
};

// ── Storage ────────────────────────────────────────────────────────────────

function getGoals() {
  const raw = localStorage.getItem('nt_goals');
  return raw ? JSON.parse(raw) : null;
}

function saveGoals(goals) {
  localStorage.setItem('nt_goals', JSON.stringify(goals));
}

function getLogs() {
  const raw = localStorage.getItem('nt_logs');
  return raw ? JSON.parse(raw) : [];
}

function getLog(date) {
  return getLogs().find(l => l.date === date) || null;
}

function upsertLog(log) {
  const logs = getLogs();
  const idx = logs.findIndex(l => l.date === log.date);
  if (idx >= 0) logs[idx] = log;
  else logs.push(log);
  localStorage.setItem('nt_logs', JSON.stringify(logs));
}

function deleteLog(date) {
  const logs = getLogs().filter(l => l.date !== date);
  localStorage.setItem('nt_logs', JSON.stringify(logs));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function colorClass(value, goal) {
  if (!goal) return 'green';
  const pct = value / goal;
  if (pct <= 1.0) return 'green';
  if (pct <= 1.2) return 'amber';
  return 'red';
}

function thresholdClass(nutrient, pct) {
  const type = NUTRIENT_TYPE[nutrient];
  if (type === 'maximize') {
    if (pct >= THRESHOLDS.maximize.ok)  return 'green';
    if (pct >= THRESHOLDS.maximize.low) return 'amber';
    return 'red';
  }
  if (type === 'minimize') {
    if (pct <= THRESHOLDS.minimize.warn) return 'green';
    if (pct <= THRESHOLDS.minimize.over) return 'amber';
    return 'red';
  }
  // goldilocks (fiber)
  const t = THRESHOLDS.goldilocks;
  if (pct >= t.lowAmber && pct <= t.highAmber) return 'green';
  if (pct >= t.lowRed   && pct <= t.highRed)   return 'amber';
  return 'red';
}

function countUp(el, target, duration, decimals) {
  const start = performance.now();
  (function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = eased * target;
    el.textContent = decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  })(start);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Navigation ─────────────────────────────────────────────────────────────

let weeklyChartInst = null;
let monthlyChartInst = null;

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'log')      renderLogForm();
  if (name === 'weekly')   renderWeekly();
  if (name === 'monthly')  renderMonthly();
  if (name === 'history')  renderHistory();
  if (name === 'settings') renderGoalsForm();
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ── Goals form ─────────────────────────────────────────────────────────────

function renderGoalsForm() {
  const goals = getGoals() || DEFAULT_GOALS;
  NUTRIENTS.forEach(n => {
    document.getElementById('goal-' + n).value = goals[n] ?? '';
  });
}

document.getElementById('goals-form').addEventListener('submit', e => {
  e.preventDefault();
  const goals = {};
  NUTRIENTS.forEach(n => {
    goals[n] = parseFloat(document.getElementById('goal-' + n).value) || 0;
  });
  saveGoals(goals);
  showToast('Goals saved!');
});

// ── Log form ───────────────────────────────────────────────────────────────

function renderLogForm() {
  const today = todayStr();

  // Set up date picker: default to today, no future dates
  const datePicker = document.getElementById('log-date');
  if (!datePicker.value) datePicker.value = today;
  datePicker.max = today;

  updateLogFormForDate(datePicker.value);

  // Show welcome banner if no goals set yet
  const banner = document.getElementById('goals-banner');
  banner.style.display = getGoals() ? 'none' : 'block';
}

function updateLogFormForDate(date) {
  document.getElementById('log-date-label').textContent = formatDate(date);
  const existing = getLog(date);
  NUTRIENTS.forEach(n => {
    document.getElementById('log-' + n).value = existing ? (existing[n] ?? '') : '';
  });
}

document.getElementById('log-date').addEventListener('change', e => {
  updateLogFormForDate(e.target.value);
});

document.getElementById('log-form').addEventListener('submit', e => {
  e.preventDefault();
  const date = document.getElementById('log-date').value || todayStr();
  const log = { date };
  NUTRIENTS.forEach(n => {
    log[n] = parseFloat(document.getElementById('log-' + n).value) || 0;
  });
  upsertLog(log);
  showToast('Log saved!');
});

// ── Dashboard ──────────────────────────────────────────────────────────────

function computeStreaks(logs) {
  if (logs.length === 0) return { current: 0, longest: 0 };

  const dates = new Set(logs.map(l => l.date));

  function dateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Current streak — start from today; if today not logged, start from yesterday
  let cursor = new Date();
  if (!dates.has(dateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (dates.has(dateStr(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak — walk sorted dates counting consecutive days
  const sorted = [...dates].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [py, pm, pd] = sorted[i-1].split('-').map(Number);
    const [cy, cm, cd] = sorted[i].split('-').map(Number);
    const diff = Math.round((new Date(cy, cm-1, cd) - new Date(py, pm-1, pd)) / 86400000);
    if (diff === 1) { run++; if (run > longest) longest = run; }
    else run = 1;
  }

  return { current, longest };
}

function computeConsistency(logs, goals) {
  if (logs.length === 0) return 0;
  let greenCount = 0;
  logs.forEach(log => {
    NUTRIENTS.forEach(n => {
      const pct = (log[n] || 0) / (goals[n] || 1);
      if (thresholdClass(n, pct) === 'green') greenCount++;
    });
  });
  return Math.round((greenCount / (logs.length * NUTRIENTS.length)) * 100);
}

function renderDashboard() {
  const logs  = getLogs();
  const goals = getGoals() || DEFAULT_GOALS;

  document.getElementById('dash-date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const dashEmpty   = document.getElementById('dash-empty');
  const dashContent = document.getElementById('dash-content');

  if (logs.length === 0) {
    dashEmpty.style.display = 'block';
    dashContent.style.display = 'none';
    return;
  }

  dashEmpty.style.display = 'none';
  dashContent.style.display = 'block';

  const avgs = {};
  NUTRIENTS.forEach(n => {
    avgs[n] = logs.reduce((sum, l) => sum + (l[n] || 0), 0) / logs.length;
  });

  const grid = document.getElementById('dash-averages');
  grid.innerHTML = NUTRIENTS.map((n, i) => {
    const avg      = avgs[n];
    const goal     = goals[n] || 1;
    const pct      = avg / goal;
    const pctLabel = Math.round(pct * 100);
    const barWidth = Math.min(pct, 1) * 100;
    const cls      = thresholdClass(n, pct);
    const decimals = n === 'calories' ? 0 : 1;
    return `
      <div class="dash-card">
        <div class="dash-card-name">${LABELS[n]}</div>
        <div class="dash-avg-row">
          <span class="dash-avg" data-target="${avg}" data-decimals="${decimals}">0</span>
          <span class="dash-avg-unit">${UNITS[n]}</span>
        </div>
        <div class="dash-goal-text">goal: ${n === 'calories' ? goal.toLocaleString() : goal} ${UNITS[n]}</div>
        <div class="dash-track">
          <div class="dash-fill ${cls}" data-width="${barWidth.toFixed(2)}"></div>
        </div>
        <div class="dash-pct ${cls}">${pctLabel}% of goal</div>
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.dash-fill').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, i * 70);
    });
    grid.querySelectorAll('.dash-avg').forEach((el, i) => {
      setTimeout(() => {
        countUp(el, parseFloat(el.dataset.target), 600, parseInt(el.dataset.decimals));
      }, i * 70);
    });
  });

  // Summary stats
  const { current, longest } = computeStreaks(logs);
  const consistency = computeConsistency(logs, goals);

  const streakLabel = current === 1 ? 'day' : 'days';
  const longestLabel = longest === 1 ? 'day' : 'days';

  document.getElementById('dash-summary').innerHTML = `
    <div class="dash-stat-tile">
      <span class="dash-stat-value" data-target="${logs.length}" data-decimals="0">0</span>
      <span class="dash-stat-label">Days Logged</span>
    </div>
    <div class="dash-stat-tile">
      <span class="dash-stat-value" data-target="${current}" data-decimals="0">0</span>
      <span class="dash-stat-label">Current Streak</span>
      <span class="dash-stat-sub">${current > 0 ? streakLabel + ' in a row' : 'log today to start one'}</span>
    </div>
    <div class="dash-stat-tile">
      <span class="dash-stat-value" data-target="${longest}" data-decimals="0">0</span>
      <span class="dash-stat-label">Longest Streak</span>
      <span class="dash-stat-sub">${longest > 0 ? longestLabel : '—'}</span>
    </div>
    <div class="dash-stat-tile">
      <span class="dash-stat-value" data-target="${consistency}" data-decimals="0">0</span><span class="dash-stat-value-pct">%</span>
      <span class="dash-stat-label">Consistency</span>
      <span class="dash-stat-sub">avg macros in green zone</span>
    </div>`;

  requestAnimationFrame(() => {
    document.getElementById('dash-summary').querySelectorAll('.dash-stat-value').forEach(el => {
      if (el.dataset.target !== undefined) {
        countUp(el, parseFloat(el.dataset.target), 700, parseInt(el.dataset.decimals || 0));
      }
    });
  });
}

// ── History ────────────────────────────────────────────────────────────────

const SHORT_LABELS = {
  calories: 'Cal', protein: 'Protein', carbs: 'Carbs',
  fat: 'Fat', sugar: 'Sugar', fiber: 'Fiber',
};

function renderHistory() {
  const logs = getLogs().slice().sort((a, b) => b.date.localeCompare(a.date));
  const noHistory = document.getElementById('no-history');
  const listEl = document.getElementById('history-list');
  const goals = getGoals() || DEFAULT_GOALS;

  if (logs.length === 0) {
    noHistory.style.display = 'block';
    listEl.innerHTML = '';
    return;
  }

  noHistory.style.display = 'none';

  listEl.innerHTML = logs.map(log => `
    <div class="history-card">
      <div class="history-card-header">
        <span class="history-date">${formatDate(log.date)}</span>
        <button class="btn-delete" data-date="${log.date}" title="Delete">✕</button>
      </div>
      <div class="history-stats">
        ${NUTRIENTS.map(n => {
          const val = log[n] ?? 0;
          const cls = colorClass(val, goals[n]);
          return `
            <div class="history-stat">
              <span class="history-stat-label">${SHORT_LABELS[n]}</span>
              <span class="history-stat-value ${cls}">${val}${UNITS[n]}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`
  ).join('');

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Delete log for ${formatDate(btn.dataset.date)}?`)) {
        deleteLog(btn.dataset.date);
        renderHistory();
      }
    });
  });
}

// ── Charts ─────────────────────────────────────────────────────────────────

function buildToggles(containerId, activeNutrient, onSelect) {
  const container = document.getElementById(containerId);
  container.innerHTML = NUTRIENTS.map(n => `
    <button class="toggle-btn${n === activeNutrient ? ' active' : ''}" data-nutrient="${n}">
      ${LABELS[n]}
    </button>`
  ).join('');
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.nutrient);
    });
  });
}

const CHART_SCALES = {
  y: {
    beginAtZero: true,
    grid: { color: '#1A2236' },
    border: { display: false },
    ticks: { color: '#3D5278', font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } },
  },
  x: {
    grid: { display: false },
    border: { display: false },
    ticks: { color: '#3D5278', font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }, maxRotation: 35 },
  },
};

const CHART_TOOLTIP = {
  backgroundColor: '#1A2236',
  borderColor: '#1F2D45',
  borderWidth: 1,
  titleColor: '#F1F5F9',
  bodyColor: '#8BA0BE',
  padding: 10,
  cornerRadius: 8,
};

function goalLineDataset(days, goal) {
  return {
    type: 'line',
    label: 'Goal',
    data: days.map(() => goal),
    borderColor: '#3D5278',
    borderDash: [5, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
    tension: 0,
  };
}

let activeWeeklyNutrient = 'calories';

function renderWeekly(nutrient) {
  if (nutrient) activeWeeklyNutrient = nutrient;
  const n = activeWeeklyNutrient;
  const goals = getGoals() || DEFAULT_GOALS;
  const logs = getLogs();

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(str);
  }

  const labels = days.map(d => formatDate(d));
  const data = days.map(d => {
    const log = logs.find(l => l.date === d);
    return log ? (log[n] ?? null) : null;
  });

  buildToggles('weekly-toggles', n, renderWeekly);

  const ctx = document.getElementById('weekly-chart');
  if (weeklyChartInst) weeklyChartInst.destroy();

  weeklyChartInst = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: `${LABELS[n]} (${UNITS[n]})`,
          data,
          backgroundColor: COLORS[n] + 'bb',
          borderColor: COLORS[n],
          borderWidth: 1,
          borderRadius: 5,
        },
        goalLineDataset(days, goals[n]),
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_TOOLTIP,
          callbacks: {
            label: ctx => ctx.dataset.label === 'Goal'
              ? `Goal: ${ctx.raw} ${UNITS[n]}`
              : `${ctx.raw ?? 'No data'} ${UNITS[n]}`,
          },
        },
      },
      scales: CHART_SCALES,
    },
  });
}

let activeMonthlyNutrient = 'calories';

function renderMonthly(nutrient) {
  if (nutrient) activeMonthlyNutrient = nutrient;
  const n = activeMonthlyNutrient;
  const goals = getGoals() || DEFAULT_GOALS;
  const logs = getLogs();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();

  document.getElementById('monthly-label').textContent =
    now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  const labels = days.map((_, i) => String(i + 1));
  const data = days.map((dateStr, i) => {
    if (i + 1 > todayDate) return null;
    const log = logs.find(l => l.date === dateStr);
    return log ? (log[n] ?? null) : null;
  });

  buildToggles('monthly-toggles', n, renderMonthly);

  const ctx = document.getElementById('monthly-chart');
  if (monthlyChartInst) monthlyChartInst.destroy();

  monthlyChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${LABELS[n]} (${UNITS[n]})`,
          data,
          borderColor: COLORS[n],
          backgroundColor: COLORS[n] + '22',
          pointBackgroundColor: COLORS[n],
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          spanGaps: false,
        },
        goalLineDataset(days, goals[n]),
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_TOOLTIP,
          callbacks: {
            label: ctx => ctx.dataset.label === 'Goal'
              ? `Goal: ${ctx.raw} ${UNITS[n]}`
              : ctx.raw != null
                ? `${ctx.raw} ${UNITS[n]}`
                : 'No data',
          },
        },
      },
      scales: {
        ...CHART_SCALES,
        x: {
          ...CHART_SCALES.x,
          title: { display: true, text: 'Day of month', color: '#3D5278', font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } },
        },
      },
    },
  });
}

// ── Export ─────────────────────────────────────────────────────────────────

function exportToExcel() {
  const logs = getLogs().slice().sort((a, b) => a.date.localeCompare(b.date));
  const goals = getGoals() || DEFAULT_GOALS;

  if (logs.length === 0) {
    showToast('No logs to export.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Logs
  const logRows = [
    ['Date', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Added Sugar (g)', 'Fiber (g)'],
    ...logs.map(l => [l.date, l.calories, l.protein, l.carbs, l.fat, l.sugar, l.fiber]),
  ];
  const wsLogs = XLSX.utils.aoa_to_sheet(logRows);
  wsLogs['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Logs');

  // Sheet 2: Goals
  const goalRows = [
    ['Nutrient', 'Goal'],
    ['Calories', goals.calories],
    ['Protein (g)', goals.protein],
    ['Carbs (g)', goals.carbs],
    ['Fat (g)', goals.fat],
    ['Added Sugar (g)', goals.sugar],
    ['Fiber (g)', goals.fiber],
  ];
  const wsGoals = XLSX.utils.aoa_to_sheet(goalRows);
  wsGoals['!cols'] = [{ wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsGoals, 'Goals');

  const dateStr = todayStr();
  XLSX.writeFile(wb, `nutrition-log-${dateStr}.xlsx`);
  showToast('Exported!');
}

document.getElementById('btn-export').addEventListener('click', exportToExcel);

// ── Init ───────────────────────────────────────────────────────────────────

showView('dashboard');
