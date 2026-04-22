// ── Constants ──────────────────────────────────────────────────────────────

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber'];

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
  calories: '#4f46e5',
  protein:  '#0891b2',
  carbs:    '#d97706',
  fat:      '#7c3aed',
  sugar:    '#e11d48',
  fiber:    '#16a34a',
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

  if (name === 'log')      renderLogForm();
  if (name === 'progress') renderProgress();
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

// ── Today's Progress ───────────────────────────────────────────────────────

function renderProgress() {
  const today = todayStr();
  document.getElementById('progress-date-label').textContent = formatDate(today);

  const log = getLog(today);
  const goals = getGoals() || DEFAULT_GOALS;
  const container = document.getElementById('progress-bars');
  const noData = document.getElementById('no-progress');

  if (!log) {
    container.innerHTML = '';
    noData.style.display = 'block';
    return;
  }

  noData.style.display = 'none';
  container.innerHTML = NUTRIENTS.map(n => {
    const val = log[n] || 0;
    const goal = goals[n] || 1;
    const pct = Math.round((val / goal) * 100);
    const fillPct = Math.min(pct, 100);
    const cls = colorClass(val, goal);
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span class="progress-name">${LABELS[n]}</span>
          <span class="progress-values">
            ${val} / ${goal} ${UNITS[n]}
            <span class="progress-pct ${cls}">${pct}%</span>
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${cls}" style="width:${fillPct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ── History ────────────────────────────────────────────────────────────────

function renderHistory() {
  const logs = getLogs().slice().sort((a, b) => b.date.localeCompare(a.date));
  const noHistory = document.getElementById('no-history');
  const tableWrap = document.getElementById('history-table-wrap');
  const body = document.getElementById('history-body');
  const goals = getGoals() || DEFAULT_GOALS;

  if (logs.length === 0) {
    noHistory.style.display = 'block';
    tableWrap.style.display = 'none';
    return;
  }

  noHistory.style.display = 'none';
  tableWrap.style.display = 'block';

  body.innerHTML = logs.map(log => `
    <tr>
      <td class="date-col">${formatDate(log.date)}</td>
      ${NUTRIENTS.map(n => {
        const val = log[n] ?? 0;
        const cls = colorClass(val, goals[n]);
        return `<td class="${cls}">${val}</td>`;
      }).join('')}
      <td>
        <button class="btn-delete" data-date="${log.date}">Delete</button>
      </td>
    </tr>`
  ).join('');

  body.querySelectorAll('.btn-delete').forEach(btn => {
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

function goalLineDataset(days, goal) {
  return {
    type: 'line',
    label: 'Goal',
    data: days.map(() => goal),
    borderColor: '#94a3b8',
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
          callbacks: {
            label: ctx => ctx.dataset.label === 'Goal'
              ? `Goal: ${ctx.raw} ${UNITS[n]}`
              : `${ctx.raw ?? 'No data'} ${UNITS[n]}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 35 },
        },
      },
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
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          title: { display: true, text: 'Day of month', color: '#94a3b8', font: { size: 11 } },
        },
      },
    },
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

showView('log');
