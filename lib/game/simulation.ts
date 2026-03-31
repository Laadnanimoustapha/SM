// ============================================
// SIMULATION ENGINE — Kill Chain & Fire Control
// Advanced Physics: Coriolis, Wind, Thermal IR,
// Radar Horizon, Doppler, Blast Radius, EW
// ============================================

class Simulation {
  constructor() {
    this.threats = [];
    this.defenders = [];
    this.explosions = [];
    this.chaffClouds = [];
    this.events = [];
    this.running = false;
    this.speedMultiplier = 1;
    this.time = 0;
    this.wave = 0;
    this.waveTimer = 0;
    this.waveCooldown = 10;

    this.stats = {
      totalLaunched: 0,
      totalIntercepted: 0,
      totalGotThrough: 0,
      totalMissed: 0,
      defenseShotsFired: 0,
      defenseHits: 0,
      reconDetected: 0,
      ecmJams: 0,
      chaffDeployed: 0,
      salvosFired: 0,
      waveNumber: 0,
      totalWarheadKg: 0,
      avgPk: 0,
      pkHistory: [],
      engagementLog: [],
      ewJamCount: 0,
      thermalDetections: 0,
      coriolisShifts: 0,
      blastDamageTotal: 0
    };

    this.canvasWidth = 900;
    this.canvasHeight = 650;
    this.onEvent = null;
    this.onStatsUpdate = null;

    this.selectedThreat = null;
    this.selectedDefender = null;

    this.roe = 'weapons-free';

    // Wind state for HUD display
    this.currentWind = { wx: 0, wy: 0 };
  }

  // ── Setup ──────────────────────────────────

  initDefenders() {
    this.defenders = [];
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const baseY = h - 60;

    // ── Layer 1: THAAD (exo-atmospheric, far back) ──
    this.defenders.push(new Entities.THAADSystem(w * 0.5, baseY - 45));

    // ── Layer 2: Long range S-300 (back line) ──
    this.defenders.push(new Entities.LongRangeInterceptor(w * 0.25, baseY - 35));
    this.defenders.push(new Entities.LongRangeInterceptor(w * 0.75, baseY - 35));

    // ── Layer 3: Medium range Bavar-373 + Khordad-15 ──
    this.defenders.push(new Entities.MidRangeInterceptor(w * 0.18, baseY - 5));
    this.defenders.push(new Entities.MidRangeInterceptor(w * 0.82, baseY - 5));
    this.defenders.push(new Entities.KhordadSystem(w * 0.5, baseY - 10));

    // ── Layer 4: Iron Dome (C-RAM) ──
    this.defenders.push(new Entities.IronDomeSystem(w * 0.35, baseY + 5));
    this.defenders.push(new Entities.IronDomeSystem(w * 0.65, baseY + 5));

    // ── Layer 5: Short range Tor-M1 + Pantsir-S1 ──
    this.defenders.push(new Entities.ShortRangeInterceptor(w * 0.12, baseY + 12));
    this.defenders.push(new Entities.ShortRangeInterceptor(w * 0.88, baseY + 12));
    this.defenders.push(new Entities.PantsirSystem(w * 0.42, baseY + 14));
    this.defenders.push(new Entities.PantsirSystem(w * 0.58, baseY + 14));

    // ── Layer 6: CIWS — last resort ──
    this.defenders.push(new Entities.RapidDefenseSystem(w * 0.3, baseY + 20));
    this.defenders.push(new Entities.RapidDefenseSystem(w * 0.7, baseY + 20));

    // ── Layer 7: Fighters ──
    this.defenders.push(new Entities.FighterJetSquadron(w * 0.4, baseY - 18));
    this.defenders.push(new Entities.FighterJetSquadron(w * 0.6, baseY - 18));

    // ── EW Jammer Station (electronic warfare — non-kinetic) ──
    this.defenders.push(new Entities.EWJammerStation(w * 0.5, baseY + 8));
  }

  reset() {
    this.threats = [];
    this.explosions = [];
    this.chaffClouds = [];
    this.events = [];
    this.time = 0;
    this.wave = 0;
    this.waveTimer = 0;
    this.running = false;
    this.selectedThreat = null;
    this.selectedDefender = null;
    this.stats = {
      totalLaunched: 0, totalIntercepted: 0, totalGotThrough: 0,
      totalMissed: 0, defenseShotsFired: 0, defenseHits: 0,
      reconDetected: 0, ecmJams: 0, chaffDeployed: 0,
      salvosFired: 0, waveNumber: 0,
      totalWarheadKg: 0, avgPk: 0, pkHistory: [], engagementLog: [],
      ewJamCount: 0, thermalDetections: 0, coriolisShifts: 0, blastDamageTotal: 0
    };
    this.initDefenders();
    this.addEvent('system', 'SYSTEM RESET — All defense batteries online. ROE: WEAPONS FREE', '#8b949e');
  }

  // ── Event System ───────────────────────────

  addEvent(type, message, color) {
    const event = {
      time: this.time.toFixed(1),
      type, message,
      color: color || '#ccc',
      id: Date.now() + Math.random()
    };
    this.events.unshift(event);
    if (this.events.length > 120) this.events.pop();
    if (this.onEvent) this.onEvent(event);
  }

  // ── Wave Spawning ──────────────────────────

  launchWave() {
    this.wave++;
    this.stats.waveNumber = this.wave;
    this.addEvent('wave', `━━━ WAVE ${this.wave} — THREAT ADVISORY ━━━`, '#ffd32a');

    const w = this.canvasWidth;
    const intensity = Math.min(this.wave, 15);

    // Realistic attack composition — more variety with new weapons
    const ballisticCount = 1 + Math.floor(intensity * 0.5);
    const cruiseCount = Math.max(0, Math.floor((intensity - 1) * 0.3));
    const droneCount = Math.max(0, Math.floor((intensity - 2) * 0.35));
    const reconCount = this.wave % 2 === 0 ? 1 : 0;
    const alcmCount = Math.max(0, Math.floor((intensity - 3) * 0.2));
    const heavyDroneCount = Math.max(0, Math.floor((intensity - 3) * 0.25));
    const solidMRBMCount = this.wave >= 4 ? Math.floor((intensity - 3) * 0.15) : 0;
    const hypersonicCount = this.wave >= 6 ? Math.floor((intensity - 5) * 0.1) : 0;

    // ── Ballistic Missiles ──
    for (let i = 0; i < ballisticCount; i++) {
      const x = 80 + Math.random() * (w - 160);
      const targetX = 120 + Math.random() * (w - 240);
      const roll = Math.random();
      let tier = 'short';
      if (roll > 0.5) tier = 'precision';
      if (roll > 0.6) tier = 'medium';
      if (roll > 0.8) tier = 'long';
      if (roll > 0.93 && this.wave >= 3) tier = 'irbm';

      const missile = new Entities.BallisticMissile(
        x, -15 - Math.random() * 30 - i * 15,
        targetX, this.canvasHeight - 45, tier
      );
      this.threats.push(missile);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += missile.warheadKg;

      const bearing = Math.floor((x / w) * 360);
      const db = missile.weaponData;
      const rangeStr = db ? ` | Range: ${db.specs.rangeKm.toLocaleString()}km` : '';
      const machStr = db ? ` | Mach ${db.specs.speedMach}` : '';
      this.addEvent('launch',
        `🚀 ${missile.name} [${tier.toUpperCase()}] — brg ${bearing}°${machStr}${rangeStr} | W/H: ${missile.warheadKg}kg`,
        missile.color
      );
    }

    // ── Cruise Missiles (Soumar GLCM) ──
    for (let i = 0; i < cruiseCount; i++) {
      const x = 30 + Math.random() * (w - 60);
      const targetX = 100 + Math.random() * (w - 200);
      const missile = new Entities.CruiseMissile(x, -10 - i * 20, targetX, this.canvasHeight - 45);
      this.threats.push(missile);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += missile.warheadKg;
      this.addEvent('launch',
        `🚀 ${missile.name} [GLCM] — terrain-following | RCS: ${missile.rcs}m² | W/H: ${missile.warheadKg}kg`,
        missile.color
      );
    }

    // ── Paveh ALCM (Air-Launched) ──
    for (let i = 0; i < alcmCount; i++) {
      const x = 40 + Math.random() * (w - 80);
      const targetX = 100 + Math.random() * (w - 200);
      const missile = new Entities.AirLaunchedCruise(x, -8 - i * 18, targetX, this.canvasHeight - 45);
      this.threats.push(missile);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += missile.warheadKg;
      this.addEvent('launch',
        `🚀 ${missile.name} [ALCM] — sea-skimming | RCS: ${missile.rcs}m² | W/H: ${missile.warheadKg}kg`,
        missile.color
      );
    }

    // ── Kamikaze Drones (Shahed-136) ──
    for (let i = 0; i < droneCount; i++) {
      const x = 50 + Math.random() * (w - 100);
      const targetX = 100 + Math.random() * (w - 200);
      const drone = new Entities.KamikazeDrone(x, -8 - i * 10, targetX, this.canvasHeight - 45);
      this.threats.push(drone);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += drone.warheadKg;
      this.addEvent('launch',
        `🛩️ ${drone.name} [OWA] — loitering munition | RCS: ${drone.rcs}m²`,
        drone.color
      );
    }

    // ── Heavy Attack Drones (Arash-2) ──
    for (let i = 0; i < heavyDroneCount; i++) {
      const x = 60 + Math.random() * (w - 120);
      const targetX = 100 + Math.random() * (w - 200);
      const drone = new Entities.HeavyAttackDrone(x, -10 - i * 12, targetX, this.canvasHeight - 45);
      this.threats.push(drone);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += drone.warheadKg;
      this.addEvent('launch',
        `🛩️ ${drone.name} [H-OWA] — jet-powered attack | RCS: ${drone.rcs}m²`,
        drone.color
      );
    }

    // ── Sejjil-2 Solid MRBM ──
    for (let i = 0; i < solidMRBMCount; i++) {
      const x = 80 + Math.random() * (w - 160);
      const targetX = 120 + Math.random() * (w - 240);
      const missile = new Entities.SolidBallisticMissile(x, -20 - i * 20, targetX, this.canvasHeight - 45);
      this.threats.push(missile);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += missile.warheadKg;
      this.addEvent('launch',
        `🚀 ${missile.name} [SOLID-MRBM] — fast-burn solid | Mach ${missile.speedMach} | W/H: ${missile.warheadKg}kg`,
        missile.color
      );
    }

    // ── Fattah-1 Hypersonic Glide Vehicle ──
    for (let i = 0; i < hypersonicCount; i++) {
      const x = 100 + Math.random() * (w - 200);
      const targetX = 150 + Math.random() * (w - 300);
      const hgv = new Entities.HypersonicGlideVehicle(x, -25 - i * 25, targetX, this.canvasHeight - 45);
      this.threats.push(hgv);
      this.stats.totalLaunched++;
      this.stats.totalWarheadKg += hgv.warheadKg;
      this.addEvent('launch',
        `⚡ ${hgv.name} [HGV] — HYPERSONIC THREAT | Mach ${hgv.speedMach} | W/H: ${hgv.warheadKg}kg`,
        '#ff0044'
      );
    }

    // ── Recon drone ──
    if (reconCount > 0) {
      const x = 150 + Math.random() * (w - 300);
      const targetX = 200 + Math.random() * (w - 400);
      const drone = new Entities.ReconDrone(x, -12, targetX, this.canvasHeight - 120);
      this.threats.push(drone);
      this.stats.totalLaunched++;
      this.addEvent('launch',
        `📡 ${drone.name} [ISR] — establishing orbit | RCS: ${drone.rcs}m²`,
        drone.color
      );
    }

    this.updateStats();
  }

  // ── Simulation Phases ──────────────────────

  phaseDetection() {
    for (const threat of this.threats) {
      if (!threat.alive || threat.intercepted || threat.detected) continue;

      for (const defender of this.defenders) {
        if (!defender.alive || defender.isEW) continue;
        if (defender.canDetect(threat)) {
          // ── Radar horizon check (NEW) ──
          if (window.WeaponsDB) {
            const dx = defender.x - threat.x;
            const dy = defender.y - threat.y;
            const distKm = Math.sqrt(dx * dx + dy * dy) * 0.5; // approximate pixel-to-km
            const targetAltKm = threat.currentAltitudeKm || (threat.altitude || 0.5) * 30;
            if (!WeaponsDB.physics.isAboveRadarHorizon(15, targetAltKm, distKm)) {
              continue; // Below radar horizon — can't detect
            }
          }

          // ── Thermal / IR detection bonus for high-speed targets ──
          let thermalBonus = '';
          if (threat.thermalSig && threat.thermalSig > 0.3) {
            this.stats.thermalDetections++;
            thermalBonus = ` | IR-SIG: ${(threat.thermalSig * 100).toFixed(0)}%`;
          }

          threat.detected = true;
          const dist = Math.floor(Math.sqrt((threat.x - defender.x) ** 2 + (threat.y - defender.y) ** 2));
          const bearing = Math.floor(Math.atan2(threat.x - defender.x, defender.y - threat.y) * 180 / Math.PI + 360) % 360;

          let classification = threat.name;
          if (threat.rcs < 0.05) classification += ' [VERY LOW RCS]';
          else if (threat.rcs < 0.5) classification += ' [LOW RCS]';
          if (threat.isHypersonic) classification += ' ⚡HYPERSONIC';

          const machStr = threat.currentMach > 0.5 ? ` | M${threat.currentMach.toFixed(1)}` : '';

          this.addEvent('detect',
            `📡 ${defender.name} [${defender.systemDesignation}] — CONTACT: ${classification} | brg ${bearing}° rng ${dist}${machStr}${thermalBonus}`,
            '#00d2d3'
          );

          if (threat.type === 'recon_drone') this.stats.reconDetected++;
          break;
        }
      }
    }
  }

  phaseEW() {
    // EW Jammer stations passively degrade threats within range
    for (const defender of this.defenders) {
      if (!defender.alive || !defender.isEW) continue;
      defender.applyJamming(this.threats);
    }
  }

  phaseDecision() {
    // Layered defense doctrine (IFC — Integrated Fire Control)
    const defenseOrder = ['defense_thaad', 'defense_long', 'defense_fighter', 'defense_mid', 'defense_cram', 'defense_shorad', 'defense_short', 'defense_ciws'];

    for (const defType of defenseOrder) {
      for (const defender of this.defenders) {
        if (defender.type !== defType || !defender.isReady()) continue;

        let bestThreat = null;
        let bestScore = -Infinity;

        for (const threat of this.threats) {
          if (!threat.alive || threat.intercepted || !threat.detected) continue;
          if (!defender.canEngage.includes(threat.type)) continue;
          if (!defender.canIntercept(threat)) continue;

          // Threat prioritization matrix
          const dx = defender.x - threat.x;
          const dy = defender.y - threat.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let score = 0;
          score += (threat.warheadKg || threat.damage) * 1.5;
          score += (defender.interceptionRange - dist) * 0.5;
          if (threat.flightPhase === 'terminal') score += 300;
          if (threat.type === 'ballistic_irbm') score += 250;
          if (threat.type === 'hypersonic') score += 350;
          if (threat.type === 'solid_mrbm') score += 200;
          if (threat.type === 'kamikaze_drone' || threat.type === 'heavy_drone') score += 100;
          if (threat.type === 'alcm') score += 150;
          score -= (1 - Math.min(threat.rcs, 1)) * 50;
          if (threat.chaffDeployed) score -= 80;
          if (threat.maneuverability > 0.15) score -= 60;
          if (threat._ewJammed) score += 50; // EW-jammed targets easier

          if (score > bestScore) {
            bestScore = score;
            bestThreat = threat;
          }
        }

        if (bestThreat) {
          defender._selectedTarget = bestThreat;
        }
      }
    }
  }

  phaseEngagement() {
    for (const defender of this.defenders) {
      if (!defender._selectedTarget) continue;
      const target = defender._selectedTarget;
      defender._selectedTarget = null;

      if (!target.alive || target.intercepted) continue;

      // ── Enhanced fire() with new physics modifiers ──
      const result = defender.fire(target);
      if (!result) continue;

      // ── Apply multipath clutter factor (NEW) ──
      if (window.WeaponsDB && target.altitude !== undefined) {
        const clutterFactor = WeaponsDB.physics.multipathClutterFactor(
          target.currentAltitudeKm || (target.altitude * 30)
        );
        // Already applied inside fire(), but log it
        if (clutterFactor < 0.8) {
          result._clutterPenalty = true;
        }
      }

      // ── EW degradation bonus for defenders ──
      if (target._ewJammed && target._ewDegradation > 0) {
        this.stats.ewJamCount++;
      }

      this.stats.defenseShotsFired++;
      this.stats.salvosFired += result.salvos;

      this.stats.pkHistory.push(result.effectiveProbability);
      this.stats.avgPk = this.stats.pkHistory.reduce((a, b) => a + b, 0) / this.stats.pkHistory.length;

      this.stats.engagementLog.push({
        time: this.time,
        defender: defender.name,
        threat: target.name,
        hit: result.hit,
        pk: result.effectiveProbability,
        basePk: result.basePk,
        salvos: result.salvos
      });

      if (result.hit) {
        this.stats.defenseHits++;
        this.stats.totalIntercepted++;
        this.explosions.push(new Entities.Explosion(target.x, target.y, true, 1.2));

        let msg = `✅ ${defender.name} — SPLASH! ${target.name} destroyed`;
        if (result.salvos > 1) msg += ` [${result.salvos}-rnd salvo]`;
        msg += ` | Pk: ${(result.singleShotPk * 100).toFixed(0)}%→${(result.effectiveProbability * 100).toFixed(0)}%`;
        if (target._ewJammed) msg += ' [EW-ASSIST]';
        this.addEvent('intercept_success', msg, '#2ed573');
      } else {
        this.stats.totalMissed++;
        this.explosions.push(new Entities.Explosion(target.x, target.y, false, 0.8));

        let msg = `❌ ${defender.name} — MISS on ${target.name}`;
        if (result.ecmActive) { msg += ' [ECM]'; this.stats.ecmJams++; }
        if (result.chaffActive) {
          msg += ' [CHAFF]';
          this.stats.chaffDeployed++;
          this.chaffClouds.push(new Entities.ChaffCloud(target.x, target.y));
        }
        if (result._clutterPenalty) msg += ' [CLUTTER]';
        msg += ` | Pk: ${(result.effectiveProbability * 100).toFixed(0)}%`;
        this.addEvent('intercept_fail', msg, '#ff4757');
      }
    }
  }

  phaseOutcome() {
    for (let i = this.threats.length - 1; i >= 0; i--) {
      const threat = this.threats[i];
      if (threat.reachedTarget && threat.alive && !threat.intercepted) {
        if (threat.damage > 0) {
          this.stats.totalGotThrough++;
          this.explosions.push(new Entities.Explosion(threat.x, threat.y, false, 1.5));

          const ke = threat.currentVelocityMs > 0
            ? (0.5 * (threat.massKg || 1000) * threat.currentVelocityMs * threat.currentVelocityMs / 1e6).toFixed(1)
            : '?';

          // ── Blast radius calculation (NEW) ──
          let blastStr = '';
          if (window.WeaponsDB && threat.warheadKg > 0) {
            const blastR = WeaponsDB.physics.blastRadiusM(threat.warheadKg);
            blastStr = ` | Blast: ${blastR.toFixed(0)}m`;
            this.stats.blastDamageTotal += threat.warheadKg;
          }

          this.addEvent('impact',
            `💥 IMPACT — ${threat.name} | W/H: ${threat.warheadKg}kg | KE: ${ke} MJ${blastStr} | DEFENSE BREACH`,
            '#ff6348'
          );
        } else {
          this.addEvent('info', `📡 ${threat.name} — ISR orbit complete, RTB`, '#70a1ff');
        }
        threat.alive = false;
      }
    }
    this.threats = this.threats.filter(t => t.alive);
    this.updateStats();
  }

  updateStats() {
    if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
  }

  // ── Main Loop ──────────────────────────────

  update(dt) {
    if (!this.running) return;

    const scaledDt = dt * this.speedMultiplier;
    this.time += scaledDt;

    // Update wind state for HUD
    if (window.WeaponsDB) {
      this.currentWind = WeaponsDB.physics.windAtAltitude(5);
    }

    // Auto-wave
    this.waveTimer += scaledDt;
    if (this.waveTimer >= this.waveCooldown && this.threats.length < 16) {
      this.waveTimer = 0;
      this.launchWave();
    }

    // Update entities
    for (const threat of this.threats) {
      threat.update(scaledDt);
      for (const s of threat.smokeTrail) {
        s.alpha -= scaledDt * 0.8;
        s.x += s.vx;
        s.y += s.vy;
        s.size *= 1 + scaledDt * 0.3;
      }
      threat.smokeTrail = threat.smokeTrail.filter(s => s.alpha > 0);

      // Decay plasma trail for HGV
      if (threat.plasmaTrail) {
        for (const p of threat.plasmaTrail) p.alpha -= scaledDt * 1.5;
        threat.plasmaTrail = threat.plasmaTrail.filter(p => p.alpha > 0);
      }
    }

    for (const defender of this.defenders) {
      defender.update(scaledDt);
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update(scaledDt);
      if (!this.explosions[i].alive) this.explosions.splice(i, 1);
    }

    for (let i = this.chaffClouds.length - 1; i >= 0; i--) {
      this.chaffClouds[i].update(scaledDt);
      if (!this.chaffClouds[i].alive) this.chaffClouds.splice(i, 1);
    }

    // Kill chain phases
    this.phaseDetection();
    this.phaseEW();
    this.phaseDecision();
    this.phaseEngagement();
    this.phaseOutcome();

    // Fade trails
    for (const threat of this.threats) {
      for (const tp of threat.trail) tp.alpha -= scaledDt * 0.6;
      threat.trail = threat.trail.filter(t => t.alpha > 0);
    }
  }

  start() {
    this.running = true;
    if (this.wave === 0) this.launchWave();
    this.addEvent('system', '▶ SIMULATION ACTIVE — ALL SYSTEMS WEAPONS FREE', '#2ed573');
  }

  pause() {
    this.running = false;
    this.addEvent('system', '⏸ SIMULATION PAUSED', '#ffa502');
  }

  toggle() {
    if (this.running) this.pause(); else this.start();
  }
}

if (typeof window !== 'undefined') {
  window.Simulation = Simulation;
}
