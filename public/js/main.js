// ============================================
// MAIN — Bootstrap & Game Loop
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('sim-canvas');
  canvas.width = 900;
  canvas.height = 650;

  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1) {
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.width *= dpr;
    canvas.height *= dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  const sim = new Simulation();
  sim.canvasWidth = 900;
  sim.canvasHeight = 650;
  sim.reset();

  const renderer = new Renderer(canvas);
  const ui = new UI(sim);

  const statusEl = document.getElementById('sim-status');

  function updateStatus() {
    if (sim.running) {
      statusEl.textContent = 'ACTIVE';
      statusEl.classList.add('active');
    } else if (sim.wave > 0) {
      statusEl.textContent = 'PAUSED';
      statusEl.classList.remove('active');
    } else {
      statusEl.textContent = 'STANDBY';
      statusEl.classList.remove('active');
    }
  }

  // ── Game Loop ────────────────────────────

  let lastTime = 0;
  let frameCount = 0;

  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    sim.update(dt);
    renderer.render(sim);

    frameCount++;
    if (frameCount % 30 === 0) updateStatus();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame((timestamp) => {
    lastTime = timestamp;
    gameLoop(timestamp);
  });

  // ── Keyboard Shortcuts ───────────────────

  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        sim.toggle();
        ui.updateControlStates();
        updateStatus();
        break;
      case 'r':
        sim.reset();
        ui.clearLog();
        ui.updateControlStates();
        ui.updateStats(sim.stats);
        updateStatus();
        break;
      case 'w':
        if (sim.running) sim.launchWave();
        break;
      case '1': sim.speedMultiplier = 1; break;
      case '2': sim.speedMultiplier = 2; break;
      case '3': sim.speedMultiplier = 4; break;
    }
    document.getElementById('speed-slider').value = sim.speedMultiplier;
    document.getElementById('speed-value').textContent = sim.speedMultiplier + '×';
  });
});
