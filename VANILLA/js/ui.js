// ============================================
// UI — Controls, Weapons DB, Stats Dashboard
// ============================================

class UI {
  constructor(sim) {
    this.sim = sim;
    this.eventLog = document.getElementById('event-log');
    this.maxLogItems = 100;
    this.weaponsTabActive = 'offensive';

    this.setupControls();
    this.setupStats();
    this.setupEventHandlers();
    this.setupWeaponsPanel();
  }

  setupControls() {
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.btnWave = document.getElementById('btn-wave');
    this.speedSlider = document.getElementById('speed-slider');
    this.speedLabel = document.getElementById('speed-value');

    this.btnStart.addEventListener('click', () => {
      this.sim.start();
      this.updateControlStates();
    });

    this.btnPause.addEventListener('click', () => {
      this.sim.pause();
      this.updateControlStates();
    });

    this.btnReset.addEventListener('click', () => {
      this.sim.reset();
      this.clearLog();
      this.updateControlStates();
      this.updateStats(this.sim.stats);
    });

    this.btnWave.addEventListener('click', () => {
      if (this.sim.running) {
        this.sim.launchWave();
      }
    });

    this.speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.sim.speedMultiplier = val;
      this.speedLabel.textContent = val + '×';
    });
  }

  setupStats() {
    this.statElements = {
      totalLaunched: document.getElementById('stat-launched'),
      totalIntercepted: document.getElementById('stat-intercepted'),
      totalGotThrough: document.getElementById('stat-gotthrough'),
      successRate: document.getElementById('stat-successrate'),
      shotsFired: document.getElementById('stat-shots'),
      salvosFired: document.getElementById('stat-salvos'),
      ecmJams: document.getElementById('stat-ecm'),
      chaffDeployed: document.getElementById('stat-chaff'),
      waveNumber: document.getElementById('stat-wave'),
      activeDefenders: document.getElementById('stat-defenders'),
      sskp: document.getElementById('stat-sskp'),
      warhead: document.getElementById('stat-warhead')
    };
  }

  setupEventHandlers() {
    this.sim.onEvent = (event) => this.addLogEntry(event);
    this.sim.onStatsUpdate = (stats) => this.updateStats(stats);
  }

  // ── Weapons Database Panel ─────────────────

  setupWeaponsPanel() {
    const toggle = document.getElementById('weapons-toggle');
    const content = document.getElementById('weapons-content');
    if (toggle && content) {
      toggle.addEventListener('click', () => {
        content.classList.toggle('collapsed');
        const icon = toggle.querySelector('.panel-toggle-icon');
        if (icon) icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
      });
    }

    // Tab switching
    const tabs = document.querySelectorAll('.weapons-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.weaponsTabActive = tab.dataset.tab;
        this.renderWeaponsList();
      });
    });

    this.renderWeaponsList();
  }

  renderWeaponsList() {
    const list = document.getElementById('weapons-list');
    if (!list || !window.WeaponsDB) return;

    const db = window.WeaponsDB;
    const data = this.weaponsTabActive === 'offensive' ? db.offensive : db.defensive;

    let html = '';
    for (const key in data) {
      const system = data[key];
      const specs = WeaponsDB.formatSpec(system);
      html += `<div class="weapon-card">
        <div class="weapon-card-header">
          <span class="weapon-name">${system.name}</span>
          <span class="weapon-designation">${system.designation}</span>
        </div>
        <div class="weapon-specs">`;

      for (let i = 1; i < specs.length; i++) {
        const parts = specs[i].split(': ');
        if (parts.length === 2) {
          html += `<div class="weapon-spec-row">
            <span class="weapon-spec-label">${parts[0]}</span>
            <span class="weapon-spec-value">${parts[1]}</span>
          </div>`;
        } else {
          html += `<div class="weapon-spec-row"><span class="weapon-spec-value">${specs[i]}</span></div>`;
        }
      }

      html += `</div></div>`;
    }

    list.innerHTML = html;
  }

  // ── Control States ─────────────────────────

  updateControlStates() {
    const running = this.sim.running;
    this.btnStart.disabled = running;
    this.btnPause.disabled = !running;
    this.btnWave.disabled = !running;
    this.btnStart.classList.toggle('active', !running);
    this.btnPause.classList.toggle('active', running);
  }

  addLogEntry(event) {
    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + event.type;
    entry.innerHTML = `
      <span class="log-time">[T+${event.time}]</span>
      <span class="log-msg" style="color: ${event.color}">${event.message}</span>
    `;

    this.eventLog.insertBefore(entry, this.eventLog.firstChild);

    while (this.eventLog.children.length > this.maxLogItems) {
      this.eventLog.removeChild(this.eventLog.lastChild);
    }

    requestAnimationFrame(() => entry.classList.add('visible'));
  }

  clearLog() {
    this.eventLog.innerHTML = '';
  }

  updateStats(stats) {
    const el = this.statElements;
    if (!el.totalLaunched) return;

    el.totalLaunched.textContent = stats.totalLaunched;
    el.totalIntercepted.textContent = stats.totalIntercepted;
    el.totalGotThrough.textContent = stats.totalGotThrough;
    el.shotsFired.textContent = stats.defenseShotsFired;
    if (el.salvosFired) el.salvosFired.textContent = stats.salvosFired;
    el.ecmJams.textContent = stats.ecmJams;
    if (el.chaffDeployed) el.chaffDeployed.textContent = stats.chaffDeployed;
    el.waveNumber.textContent = stats.waveNumber;

    const rate = stats.totalLaunched > 0
      ? ((stats.totalIntercepted / stats.totalLaunched) * 100).toFixed(1)
      : '0.0';
    el.successRate.textContent = rate + '%';

    const rateNum = parseFloat(rate);
    if (rateNum >= 70) el.successRate.style.color = '#00ff66';
    else if (rateNum >= 40) el.successRate.style.color = '#ffa502';
    else el.successRate.style.color = '#ff4757';

    // SSKP average
    if (el.sskp) {
      el.sskp.textContent = stats.avgPk > 0 ? (stats.avgPk * 100).toFixed(1) + '%' : '—';
      if (stats.avgPk >= 0.6) el.sskp.style.color = '#00ff66';
      else if (stats.avgPk >= 0.3) el.sskp.style.color = '#ffa502';
      else if (stats.avgPk > 0) el.sskp.style.color = '#ff4757';
    }

    // Warhead tonnage
    if (el.warhead) {
      el.warhead.textContent = stats.totalWarheadKg >= 1000
        ? (stats.totalWarheadKg / 1000).toFixed(1) + ' t'
        : stats.totalWarheadKg + ' kg';
    }

    const activeDefenders = this.sim.defenders.filter(d => d.alive).length;
    el.activeDefenders.textContent = activeDefenders + '/' + this.sim.defenders.length;

    this.updateProgressBar('bar-intercepted', stats.totalIntercepted, stats.totalLaunched);
    this.updateProgressBar('bar-gotthrough', stats.totalGotThrough, stats.totalLaunched);
  }

  updateProgressBar(id, value, total) {
    const bar = document.getElementById(id);
    if (!bar) return;
    const pct = total > 0 ? (value / total) * 100 : 0;
    bar.style.width = pct + '%';
  }
}

if (typeof window !== 'undefined') {
  window.UI = UI;
}
