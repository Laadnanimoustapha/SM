import { WeaponsDB } from './weapons_data';
import type { EntityConfig, WeaponData } from '@/types/game';

// ============================================
// ENTITIES — Physics-Based Offensive & Defensive Units
// Uses WeaponsDB for real-world specifications
// ============================================

// ── Base Classes ──────────────────────────────

export class Entity {
  constructor(config) {
    this.id = Entity._nextId++;
    this.name = config.name || 'Unknown';
    this.type = config.type || 'unknown';
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.speed = config.speed || 1;
    this.health = config.health || 100;
    this.maxHealth = this.health;
    this.alive = true;
    this.color = config.color || '#fff';
    this.size = config.size || 4;
  }
  update(dt) { }
  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.alive = false; }
  }
}
Entity._nextId = 1;

// ── Offensive Entities ────────────────────────

export class OffensiveEntity extends Entity {
  constructor(config) {
    super(config);
    this.category = 'offensive';
    this.startX = config.x;
    this.startY = config.y;
    this.targetX = config.targetX || this.x;
    this.targetY = config.targetY || 600;
    this.accuracy = config.accuracy || 0.7;
    this.damage = config.damage || 100;
    this.launched = false;
    this.detected = false;
    this.intercepted = false;
    this.reachedTarget = false;
    this.trail = [];
    this.smokeTrail = [];
    this.trailColor = config.trailColor || config.color || '#ff4444';
    this.angle = Math.PI / 2;
    this.prevX = this.x;
    this.prevY = this.y;
    this.electronicCountermeasures = config.ecm || 0;
    this.rcs = config.rcs || 1.0;
    this.altitude = config.altitude || 1.0;
    this.flightPhase = 'boost';
    this.phaseTimer = 0;
    this.totalDistance = 0;

    // Real-world specs reference
    this.weaponData = config.weaponData || null;
    this.speedMach = config.speedMach || 1.0;
    this.currentMach = 0;
    this.currentAltitudeKm = 0;
    this.currentVelocityMs = 0;
    this.warheadKg = config.warheadKg || 100;
    this.cepM = config.cepM || 500;
    this.ballisticCoeff = config.ballisticCoeff || 1000;
    this.dragCoeff = config.dragCoeff || 0.3;
    this.massKg = config.massKg || 5000;
    this.crossSection = config.crossSection || 0.6;
    this.timeToImpact = Infinity;

    // Countermeasures
    this.hasDecoys = config.hasDecoys || false;
    this.decoyCount = config.decoyCount || 0;
    this.hasChaffFlares = config.hasChaffFlares || false;
    this.chaffDeployed = false;
    this.deployedDecoys = [];

    // Maneuverability
    this.maneuverability = config.maneuverability || 0;
    this.evasionCooldown = 0;

    // G-force tracking
    this.gForce = 1.0;
    this.prevVx = 0;
    this.prevVy = 0;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    // Smoke trail particles
    if (Math.random() < 0.7) {
      this.smokeTrail.push({
        x: this.x + (Math.random() - 0.5) * 3,
        y: this.y + (Math.random() - 0.5) * 3,
        alpha: 0.6 + Math.random() * 0.3,
        size: 1.5 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.1,
        life: 1.0
      });
    }
    if (this.smokeTrail.length > 60) this.smokeTrail.shift();

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 40) this.trail.shift();
  }

  distanceTo(entity) {
    const dx = this.x - entity.x;
    const dy = this.y - entity.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  deployChaff() {
    if (this.hasChaffFlares && !this.chaffDeployed) {
      this.chaffDeployed = true;
      return true;
    }
    return false;
  }

  deployDecoy() {
    if (this.hasDecoys && this.decoyCount > 0) {
      this.decoyCount--;
      return { x: this.x + (Math.random() - 0.5) * 30, y: this.y + (Math.random() - 0.5) * 20 };
    }
    return null;
  }

  getEffectiveRCS() {
    let rcs = this.rcs;
    if (this.chaffDeployed) rcs *= 3.0;
    return rcs;
  }

  // Calculate physics telemetry for HUD display
  updateTelemetry(dx, dy, dt) {
    if (dt <= 0) return;
    const vx = dx / dt;
    const vy = dy / dt;
    // Velocity in simulation units → approximate m/s scaling
    const pixelToMeterScale = 500; // rough conversion
    this.currentVelocityMs = Math.sqrt(vx * vx + vy * vy) * pixelToMeterScale;
    this.currentMach = this.currentVelocityMs / 343;

    // G-force from acceleration change
    if (this.prevVx !== 0 || this.prevVy !== 0) {
      const ax = (vx - this.prevVx) / dt;
      const ay = (vy - this.prevVy) / dt;
      const accelMag = Math.sqrt(ax * ax + ay * ay) * pixelToMeterScale;
      this.gForce = 1 + accelMag / 9.81;
    }
    this.prevVx = vx;
    this.prevVy = vy;

    // Altitude (canvas Y inverted, 0=top, 650=ground)
    const groundY = 612;
    const maxAltitudeKm = this.weaponData ? (this.weaponData.specs.apogeeKm || 30) : 30;
    this.currentAltitudeKm = Math.max(0, ((groundY - this.y) / groundY) * maxAltitudeKm);

    // TTI estimate
    const distToTarget = Math.sqrt((this.targetX - this.x) ** 2 + (this.targetY - this.y) ** 2);
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    this.timeToImpact = currentSpeed > 0.01 ? distToTarget / currentSpeed : Infinity;
  }
}

// ── Ballistic Missiles (physics-based arc) ──

export class BallisticMissile extends OffensiveEntity {
  constructor(x, y, targetX, targetY, tier) {
    // Use WeaponsDB for real specs
    const db = WeaponsDB;
    const tierMap = {
      short: db ? db.offensive.shahab1 : null,
      medium: db ? db.offensive.shahab3 : null,
      long: db ? db.offensive.emad : null,
      irbm: db ? db.offensive.khorramshahr : null,
      precision: db ? db.offensive.fateh110 : null
    };

    const weaponEntry = tierMap[tier];
    const sp = weaponEntry ? weaponEntry.simParams : {};
    const specs = weaponEntry ? weaponEntry.specs : {};

    const tiers = {
      short: {
        name: weaponEntry ? weaponEntry.name : 'Shahab-1',
        type: 'ballistic_short',
        speed: 5.0, accuracy: 0.45, damage: 80, health: 50,
        color: sp.color || '#ff6b6b', trailColor: sp.trailColor || '#ff6b6b',
        size: sp.size || 5, ecm: sp.ecm || 0.02, rcs: specs.rcsM2 || 1.5,
        arcHeight: 80, boostTime: 0.8,
        hasChaffFlares: sp.hasChaff || false, hasDecoys: sp.hasDecoys || false,
        decoyCount: 0, maneuverability: sp.maneuverability || 0,
        speedMach: specs.speedMach || 5, warheadKg: specs.warheadKg || 985,
        cepM: specs.cepM || 2000, massKg: specs.launchMassKg || 5860,
        dragCoeff: specs.Cd || 0.35, crossSection: specs.crossSectionM2 || 0.608,
        apogeeKm: specs.apogeeKm || 86
      },
      medium: {
        name: weaponEntry ? weaponEntry.name : 'Shahab-3/Ghadr',
        type: 'ballistic_medium',
        speed: 4.2, accuracy: 0.65, damage: 140, health: 65,
        color: sp.color || '#ff4757', trailColor: sp.trailColor || '#ff4757',
        size: sp.size || 6, ecm: sp.ecm || 0.08, rcs: specs.rcsM2 || 1.2,
        arcHeight: 160, boostTime: 1.2,
        hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || false,
        decoyCount: 0, maneuverability: sp.maneuverability || 0,
        speedMach: specs.speedMach || 7, warheadKg: specs.warheadKg || 750,
        cepM: specs.cepM || 500, massKg: specs.launchMassKg || 16250,
        dragCoeff: specs.Cd || 0.30, crossSection: specs.crossSectionM2 || 1.368,
        apogeeKm: specs.apogeeKm || 350
      },
      long: {
        name: weaponEntry ? weaponEntry.name : 'Emad',
        type: 'ballistic_long',
        speed: 3.2, accuracy: 0.82, damage: 220, health: 80,
        color: sp.color || '#ff1744', trailColor: sp.trailColor || '#ff1744',
        size: sp.size || 7, ecm: sp.ecm || 0.15, rcs: specs.rcsM2 || 1.0,
        arcHeight: 280, boostTime: 1.8,
        hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
        decoyCount: sp.decoyCount || 2, maneuverability: sp.maneuverability || 0.25,
        speedMach: specs.speedMach || 11, warheadKg: specs.warheadKg || 750,
        cepM: specs.cepM || 50, massKg: specs.launchMassKg || 17000,
        dragCoeff: specs.Cd || 0.28, crossSection: specs.crossSectionM2 || 1.368,
        apogeeKm: specs.apogeeKm || 500
      },
      irbm: {
        name: weaponEntry ? weaponEntry.name : 'Khorramshahr-4',
        type: 'ballistic_irbm',
        speed: 2.8, accuracy: 0.75, damage: 350, health: 120,
        color: sp.color || '#d63031', trailColor: sp.trailColor || '#d63031',
        size: sp.size || 9, ecm: sp.ecm || 0.18, rcs: specs.rcsM2 || 1.8,
        arcHeight: 350, boostTime: 2.2,
        hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
        decoyCount: sp.decoyCount || 3, maneuverability: sp.maneuverability || 0.2,
        speedMach: specs.speedMach || 12, warheadKg: specs.warheadKg || 1500,
        cepM: specs.cepM || 200, massKg: specs.launchMassKg || 26000,
        dragCoeff: specs.Cd || 0.32, crossSection: specs.crossSectionM2 || 1.767,
        apogeeKm: specs.apogeeKm || 600
      },
      precision: {
        name: weaponEntry ? weaponEntry.name : 'Fateh-110',
        type: 'ballistic_short',
        speed: 5.5, accuracy: 0.85, damage: 110, health: 45,
        color: sp.color || '#e84393', trailColor: sp.trailColor || '#e84393',
        size: sp.size || 5, ecm: sp.ecm || 0.05, rcs: specs.rcsM2 || 0.8,
        arcHeight: 60, boostTime: 0.5,
        hasChaffFlares: sp.hasChaff || false, hasDecoys: sp.hasDecoys || false,
        decoyCount: 0, maneuverability: sp.maneuverability || 0.1,
        speedMach: specs.speedMach || 3, warheadKg: specs.warheadKg || 450,
        cepM: specs.cepM || 100, massKg: specs.launchMassKg || 3545,
        dragCoeff: specs.Cd || 0.30, crossSection: specs.crossSectionM2 || 0.292,
        apogeeKm: specs.apogeeKm || 50
      }
    };
    const t = tiers[tier] || tiers.short;
    super({ x, y, targetX, targetY, weaponData: weaponEntry, ...t });
    this.tier = tier;
    this.arcHeight = t.arcHeight;
    this.boostTime = t.boostTime;
    this.progress = 0;
    this.totalDist = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);
    this.terminalSpeed = this.speed * (t.maneuverability > 0.1 ? 2.2 : 1.8);

    // Physics: ballistic coefficient β = m / (Cd · S)
    this.beta = t.massKg / (t.dragCoeff * t.crossSection);

    // CEP-based target offset (Gaussian)
    if (WeaponsDB) {
      const offset = WeaponsDB.physics.randomCEPOffset(t.cepM);
      // Scale CEP to pixel space (1 pixel ≈ 1km at this zoom)
      const cepScale = 0.015;
      this.targetX += offset.dx * cepScale;
      this.targetY += offset.dy * cepScale;
    }

    // Thermal signature tracking
    this.thermalSig = 0;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    // Progress along path (0 to 1)
    let currentSpeed = this.speed;

    // Flight phases with physics-based speed modeling
    if (this.progress < 0.2) {
      this.flightPhase = 'boost';
      // During boost: accelerating, fighting gravity
      currentSpeed = this.speed * (0.5 + this.progress * 2.5);
      this.altitude = this.progress * 5;
    } else if (this.progress < 0.7) {
      this.flightPhase = 'midcourse';
      this.altitude = 1.0;
      // Midcourse: coasting in exo-atmosphere, minimal drag
      currentSpeed = this.speed * 1.1;
    } else {
      this.flightPhase = 'terminal';
      // Terminal: reentry acceleration — v increases with atmospheric density
      // Simplified: dV/dt ≈ g·sin(γ) - ρV²/(2β)
      const reentryProgress = (this.progress - 0.7) / 0.3;
      const atmosphericDrag = reentryProgress * reentryProgress * 0.3;
      currentSpeed = this.terminalSpeed * (1 + reentryProgress * 0.5) - atmosphericDrag;
      this.altitude = (1 - this.progress) * 3.3;

      // MaRV terminal maneuvers for Emad/Khorramshahr
      if (this.maneuverability > 0 && this.evasionCooldown <= 0) {
        const marvAuthority = this.maneuverability * 40;
        this.targetX += (Math.random() - 0.5) * marvAuthority;
        this.evasionCooldown = 0.3 + Math.random() * 0.3;
      }
    }

    this.evasionCooldown -= dt;
    this.progress += (currentSpeed * dt * 60) / this.totalDist;
    this.progress = Math.min(this.progress, 1);

    // Parabolic arc trajectory: y = -4h·t·(1-t) for apogee at midpoint
    const t_p = this.progress;
    const linearX = this.startX + (this.targetX - this.startX) * t_p;
    const linearY = this.startY + (this.targetY - this.startY) * t_p;
    const arcOffset = -this.arcHeight * 4 * t_p * (1 - t_p);

    this.x = linearX;
    this.y = linearY + arcOffset;

    // ── NEW: Coriolis deflection (shifts impact point eastward) ──
    if (WeaponsDB && this.speedMach > 2) {
      const coriolisShift = WeaponsDB.physics.coriolisDeflection(
        this.speedMach * 343, this.phaseTimer
      );
      this.x += coriolisShift;
    }

    // ── NEW: Wind effect during midcourse ──
    if (WeaponsDB && this.flightPhase === 'midcourse') {
      const wind = WeaponsDB.physics.windAtAltitude(this.currentAltitudeKm || 10);
      this.x += wind.wx * dt;
      this.y += wind.wy * dt;
    }

    // ── NEW: Thermal signature from aerodynamic heating ──
    if (WeaponsDB) {
      this.thermalSig = WeaponsDB.physics.thermalSignature(
        this.currentMach || this.speedMach, this.currentAltitudeKm || 0
      );
    }

    // Update angle from movement
    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.angle = Math.atan2(dy, dx);
    }

    // Physics telemetry
    this.updateTelemetry(dx, dy, dt);

    if (this.progress >= 1) {
      this.reachedTarget = true;
    }

    // Smoke trail (heavier during boost phase)
    const smokeRate = this.flightPhase === 'boost' ? 1.0 : (this.flightPhase === 'terminal' ? 0.8 : 0.3);
    if (Math.random() < smokeRate) {
      this.smokeTrail.push({
        x: this.x + (Math.random() - 0.5) * 2,
        y: this.y + (Math.random() - 0.5) * 2,
        alpha: 0.5 + Math.random() * 0.4,
        size: this.flightPhase === 'boost' ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.3,
        life: 1.0
      });
    }
    if (this.smokeTrail.length > 80) this.smokeTrail.shift();

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 50) this.trail.shift();
  }
}

// ── Cruise Missile (terrain-hugging, evasive) ──

export class CruiseMissile extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.soumar : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Soumar GLCM', type: 'cruise',
      x, y, targetX, targetY, weaponData: we,
      speed: 2.8, accuracy: 0.88, damage: 160, health: 50,
      color: sp.color || '#ffa502', trailColor: sp.trailColor || '#ffa502',
      size: sp.size || 5, ecm: sp.ecm || 0.25, rcs: specs.rcsM2 || 0.01,
      hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
      decoyCount: sp.decoyCount || 1, maneuverability: sp.maneuverability || 0.35,
      speedMach: specs.speedMach || 0.65, warheadKg: specs.warheadKg || 410,
      cepM: specs.cepM || 35, massKg: specs.launchMassKg || 1700,
      dragCoeff: specs.Cd || 0.025, crossSection: specs.crossSectionM2 || 0.207
    });
    this.waveMagnitude = 25 + Math.random() * 20;
    this.waveFrequency = 0.015 + Math.random() * 0.008;
    this.waveOffset = Math.random() * Math.PI * 2;
    this.baseX = x;
    this.distanceTraveled = 0;
    this.cruiseAltitude = sp.cruiseAltitude || 0.12;
    this.altitude = this.cruiseAltitude;
    this.flightPhase = 'cruise';

    // TERCOM waypoints
    this.waypoints = [];
    const segments = 2 + Math.floor(Math.random() * 2);
    for (let i = 1; i <= segments; i++) {
      const frac = i / (segments + 1);
      this.waypoints.push({
        x: x + (targetX - x) * frac + (Math.random() - 0.5) * 100,
        y: y + (targetY - y) * frac
      });
    }
    this.currentWaypoint = 0;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;
    this.distanceTraveled += this.speed * dt * 60;

    // TERCOM waypoint navigation
    let navTargetX = this.targetX;
    let navTargetY = this.targetY;
    if (this.currentWaypoint < this.waypoints.length) {
      navTargetX = this.waypoints[this.currentWaypoint].x;
      navTargetY = this.waypoints[this.currentWaypoint].y;
      const wpDist = Math.sqrt((this.x - navTargetX) ** 2 + (this.y - navTargetY) ** 2);
      if (wpDist < 20) this.currentWaypoint++;
    }

    const dx = navTargetX - this.x;
    const dy = navTargetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Evasive terrain-following sinusoidal
    const lateralOffset = Math.sin(this.distanceTraveled * this.waveFrequency + this.waveOffset) * this.waveMagnitude;
    const perpX = -dy / dist;
    const perpY = dx / dist;

    const moveX = (dx / dist) * this.speed * dt * 60 + perpX * lateralOffset * dt * 2;
    const moveY = (dy / dist) * this.speed * dt * 60 + perpY * lateralOffset * dt * 2;

    this.x += moveX;
    this.y += moveY;

    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
      this.angle = Math.atan2(moveY, moveX);
    }

    // DSMAC terminal homing
    const finalDist = Math.sqrt((this.x - this.targetX) ** 2 + (this.y - this.targetY) ** 2);
    if (finalDist < 50) {
      this.flightPhase = 'terminal';
    }

    if (finalDist < this.speed * dt * 60 * 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.reachedTarget = true;
    }

    // Telemetry
    this.updateTelemetry(moveX, moveY, dt);

    // Exhaust
    if (Math.random() < 0.5) {
      this.smokeTrail.push({
        x: this.x - Math.cos(this.angle) * 5 + (Math.random() - 0.5) * 2,
        y: this.y - Math.sin(this.angle) * 5 + (Math.random() - 0.5) * 2,
        alpha: 0.35 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.15,
        life: 1.0
      });
    }
    if (this.smokeTrail.length > 50) this.smokeTrail.shift();

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 45) this.trail.shift();
  }
}

// ── Recon Drone ──

export class ReconDrone extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.mohajer6 : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Mohajer-6', type: 'recon_drone',
      x, y, targetX, targetY, weaponData: we,
      speed: 1.5, accuracy: 0, damage: 0, health: 18,
      color: sp.color || '#70a1ff', trailColor: sp.trailColor || '#70a1ff44',
      size: sp.size || 4, ecm: sp.ecm || 0.3, rcs: specs.rcsM2 || 0.1,
      maneuverability: sp.maneuverability || 0.08,
      speedMach: specs.speedMach || 0.16, massKg: specs.launchMassKg || 670
    });
    this.scanRadius = sp.scanRadius || 140;
    this.scanAngle = 0;
    this.orbitRadius = sp.orbitRadius || 65;
    this.orbitPhase = Math.random() * Math.PI * 2;
    this.loiterPoint = { x: targetX, y: targetY - 80 };
    this.isLoitering = false;
    this.altitude = 0.8;
    this.flightPhase = 'ingress';
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;
    this.scanAngle += dt * 2;

    if (!this.isLoitering) {
      const dx = this.loiterPoint.x - this.x;
      const dy = this.loiterPoint.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) {
        this.isLoitering = true;
        this.flightPhase = 'loiter';
      } else {
        this.x += (dx / dist) * this.speed * dt * 60;
        this.y += (dy / dist) * this.speed * dt * 60;
        this.angle = Math.atan2(dy, dx);
      }
    } else {
      this.orbitPhase += dt * 0.8;
      this.x = this.loiterPoint.x + Math.cos(this.orbitPhase) * this.orbitRadius;
      this.y = this.loiterPoint.y + Math.sin(this.orbitPhase) * this.orbitRadius * 0.5;
      this.angle = this.orbitPhase + Math.PI / 2;

      if (this.phaseTimer > 25) {
        this.reachedTarget = true;
      }
    }

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 30) this.trail.shift();
  }
}

// ── Kamikaze Drone ──

export class KamikazeDrone extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.shahed136 : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Shahed-136', type: 'kamikaze_drone',
      x, y, targetX, targetY, weaponData: we,
      speed: 1.9, accuracy: 0.88, damage: 95, health: 12,
      color: sp.color || '#ffd32a', trailColor: sp.trailColor || '#ffd32a',
      size: sp.size || 4, ecm: sp.ecm || 0.05, rcs: specs.rcsM2 || 0.005,
      hasChaffFlares: false, hasDecoys: false,
      maneuverability: sp.maneuverability || 0.15,
      speedMach: specs.speedMach || 0.15, warheadKg: specs.warheadKg || 40,
      massKg: specs.launchMassKg || 200
    });
    this.altitude = 0.3;
    this.flightPhase = 'cruise';
    this.diveStarted = false;
    this.swarmOffset = (Math.random() - 0.5) * 60;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    const dx = this.targetX + this.swarmOffset - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let currentSpeed = this.speed;
    if (dist < 80 && !this.diveStarted) {
      this.diveStarted = true;
      this.flightPhase = 'terminal';
    }
    if (this.diveStarted) {
      currentSpeed = this.speed * 1.5;
    }

    if (dist < currentSpeed * dt * 60 * 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.reachedTarget = true;
    } else {
      const weave = Math.sin(this.phaseTimer * 3) * 0.4;
      const moveX = (dx / dist) * currentSpeed * dt * 60 + weave;
      const moveY = (dy / dist) * currentSpeed * dt * 60;
      this.x += moveX;
      this.y += moveY;
      this.angle = Math.atan2(dy + weave, dx);
      this.updateTelemetry(moveX, moveY, dt);
    }

    if (Math.random() < 0.4) {
      this.smokeTrail.push({
        x: this.x + (Math.random() - 0.5) * 2,
        y: this.y + (Math.random() - 0.5) * 2,
        alpha: 0.25 + Math.random() * 0.15,
        size: 1 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.1,
        life: 1.0
      });
    }
    if (this.smokeTrail.length > 30) this.smokeTrail.shift();

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 25) this.trail.shift();
  }
}

// ── Defensive Entities ────────────────────────

export class DefensiveEntity extends Entity {
  constructor(config) {
    super(config);
    this.category = 'defensive';
    this.detectionRange = config.detectionRange || 200;
    this.interceptionRange = config.interceptionRange || 150;
    this.interceptionProbability = config.interceptionProbability || 0.6;
    this.cooldown = config.cooldown || 2;
    this.cooldownTimer = 0;
    this.ready = true;
    this.currentTarget = null;
    this.interceptorTrails = [];
    this.totalShots = 0;
    this.totalHits = 0;
    this.canEngage = config.canEngage || ['ballistic_short', 'ballistic_medium', 'ballistic_long', 'ballistic_irbm', 'cruise', 'kamikaze_drone', 'recon_drone'];
    this.ammo = config.ammo || Infinity;
    this.maxAmmo = this.ammo;

    // Weapon system data
    this.weaponData = config.weaponData || null;
    this.systemDesignation = config.systemDesignation || '';

    // Realistic additions
    this.radarAngle = Math.random() * Math.PI * 2;
    this.radarSpeed = config.radarSpeed || 1.5;
    this.trackingTargets = [];
    this.salvoSize = config.salvoSize || 1;
    this.minEngageAltitude = config.minEngageAltitude || 0;
    this.maxEngageAltitude = config.maxEngageAltitude || 2;
    this.reactionTime = config.reactionTime || 0.5;
    this.reactionTimer = 0;
    this.engagementPhase = config.engagementPhase || 'any';
    this.killAssessmentTime = config.killAssessmentTime || 0.5;
    this.assessing = false;
    this.rotationAngle = 0;

    // Kill chain state
    this.killChainPhase = 'search'; // search → detect → track → engage → assess
    this.engagementCount = 0;
    this.lastEngagementResult = null;

    // Shoot-look-shoot
    this.shootLookShoot = config.shootLookShoot !== false;
    this.reengageDelay = config.reengageDelay || 1.0;
  }

  isReady() {
    return this.ready && this.alive && this.ammo > 0 && !this.assessing;
  }

  canDetect(threat) {
    const dx = this.x - threat.x;
    const dy = this.y - threat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Radar equation: R_det = R_max · (σ / σ_ref)^(1/4)
    const effectiveRange = this.detectionRange * Math.pow(Math.max(threat.getEffectiveRCS(), 0.001), 0.25);
    return dist <= effectiveRange;
  }

  canIntercept(threat) {
    const dx = this.x - threat.x;
    const dy = this.y - threat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.interceptionRange) return false;
    if (threat.altitude < this.minEngageAltitude || threat.altitude > this.maxEngageAltitude) return false;
    if (this.engagementPhase !== 'any' && threat.flightPhase !== this.engagementPhase) return false;
    return true;
  }

  fire(threat) {
    if (!this.isReady()) return null;

    this.ready = false;
    this.cooldownTimer = this.cooldown;
    this.currentTarget = threat;
    this.totalShots++;
    this.engagementCount++;

    const salvos = Math.min(this.salvoSize, this.ammo === Infinity ? this.salvoSize : this.ammo);
    if (this.ammo !== Infinity) this.ammo -= salvos;

    this.rotationAngle = Math.atan2(threat.y - this.y, threat.x - this.x);
    this.killChainPhase = 'engage';

    // ── Calculate Pk using real formulas ──
    let basePk = this.interceptionProbability;

    // Pk varies by target type (use weapon data if available)
    if (this.weaponData && this.weaponData.specs) {
      const specs = this.weaponData.specs;
      if (threat.type === 'cruise' && specs.pkCruise) {
        basePk = specs.pkCruise.min + Math.random() * (specs.pkCruise.max - specs.pkCruise.min);
      } else if (threat.type.startsWith('ballistic') && specs.pkTBM) {
        basePk = specs.pkTBM.min + Math.random() * (specs.pkTBM.max - specs.pkTBM.min);
      } else if (specs.pkAircraft) {
        basePk = specs.pkAircraft.min + Math.random() * (specs.pkAircraft.max - specs.pkAircraft.min);
      }
    }

    let effectiveProb = basePk;

    // ECM burn-through degradation
    if (Math.random() < threat.electronicCountermeasures) {
      effectiveProb *= 0.55;
    }

    // Chaff/flare interference
    if (threat.chaffDeployed) {
      effectiveProb *= 0.4;
    }

    // RCS effect on tracking: harder to track smaller targets
    effectiveProb *= Math.min(1.0, 0.5 + threat.rcs * 0.5);

    // Random environmental interference (6% chance)
    if (Math.random() < 0.06) {
      effectiveProb *= 0.4;
    }

    // Terminal phase — faster target, harder to engage
    if (threat.flightPhase === 'terminal') {
      effectiveProb *= 0.75;
    }

    // MaRV evasion penalty
    if (threat.maneuverability > 0.15) {
      effectiveProb *= (1 - threat.maneuverability * 0.5);
    }

    // Salvo Pk formula: Pk_salvo = 1 - (1 - Pk_single)^n
    const singleShotPk = Math.max(0, Math.min(1, effectiveProb));
    const salvoPk = 1 - Math.pow(1 - singleShotPk, salvos);

    const hit = Math.random() < salvoPk;

    // Create interceptor trails
    for (let i = 0; i < salvos; i++) {
      const spreadAngle = (i - (salvos - 1) / 2) * 0.05;
      const targetOffsetX = threat.x + Math.cos(spreadAngle) * 5;
      const targetOffsetY = threat.y + Math.sin(spreadAngle) * 5;
      this.interceptorTrails.push({
        startX: this.x,
        startY: this.y,
        endX: targetOffsetX,
        endY: targetOffsetY,
        progress: 0,
        hit: hit && i === 0,
        alpha: 1,
        speed: 3 + Math.random() * 2,
        smokeParticles: []
      });
    }

    // Threat deploys countermeasures on miss
    if (!hit && threat.hasChaffFlares && !threat.chaffDeployed && Math.random() < 0.6) {
      threat.deployChaff();
    }

    if (hit) {
      this.totalHits++;
      threat.intercepted = true;
      threat.alive = false;
      this.killChainPhase = 'assess';
      this.assessing = true;
      setTimeout(() => {
        this.assessing = false;
        this.killChainPhase = 'search';
      }, this.killAssessmentTime * 1000);
    } else {
      this.killChainPhase = 'search';
    }

    this.lastEngagementResult = {
      hit, defender: this, threat,
      ecmActive: threat.electronicCountermeasures > 0,
      chaffActive: threat.chaffDeployed,
      singleShotPk: singleShotPk,
      effectiveProbability: salvoPk,
      salvos,
      basePk: basePk
    };

    return this.lastEngagementResult;
  }

  update(dt) {
    this.radarAngle += dt * this.radarSpeed * Math.PI * 2;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.cooldownTimer = 0;
        this.ready = true;
        this.currentTarget = null;
      }
    }

    for (let i = this.interceptorTrails.length - 1; i >= 0; i--) {
      const trail = this.interceptorTrails[i];
      trail.progress += dt * trail.speed;
      if (trail.progress >= 1) {
        trail.alpha -= dt * 2;
      }
      if (trail.progress < 1 && Math.random() < 0.6) {
        const p = trail.progress;
        trail.smokeParticles.push({
          x: trail.startX + (trail.endX - trail.startX) * p + (Math.random() - 0.5) * 3,
          y: trail.startY + (trail.endY - trail.startY) * p + (Math.random() - 0.5) * 3,
          alpha: 0.4,
          size: 1.5
        });
      }
      for (const sp of trail.smokeParticles) { sp.alpha -= dt * 2; }
      trail.smokeParticles = trail.smokeParticles.filter(s => s.alpha > 0);

      if (trail.alpha <= 0) {
        this.interceptorTrails.splice(i, 1);
      }
    }
  }
}

export class ShortRangeInterceptor extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.torM1 : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Tor-M1', type: 'defense_short',
      systemDesignation: we ? we.designation : 'SA-15',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 145,
      interceptionRange: sp.interceptionRange || 115,
      interceptionProbability: sp.basePk || 0.72,
      cooldown: sp.cooldown || 1.8,
      health: 150, color: sp.color || '#00d2d3', size: sp.size || 10,
      ammo: sp.ammo || 8, radarSpeed: sp.radarSpeed || 2.0,
      salvoSize: sp.salvoSize || 1,
      minEngageAltitude: 0, maxEngageAltitude: 1.5,
      reactionTime: sp.reactionTime || 0.4,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.3
    });
  }
}

export class MidRangeInterceptor extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.bavar373 : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Bavar-373', type: 'defense_mid',
      systemDesignation: we ? we.designation : 'Sayyad-4',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 270,
      interceptionRange: sp.interceptionRange || 220,
      interceptionProbability: sp.basePk || 0.65,
      cooldown: sp.cooldown || 3.0,
      health: 200, color: sp.color || '#0abde3', size: sp.size || 12,
      ammo: sp.ammo || 4, radarSpeed: sp.radarSpeed || 1.2,
      salvoSize: sp.salvoSize || 2,
      minEngageAltitude: 0.1, maxEngageAltitude: 2,
      reactionTime: sp.reactionTime || 0.7,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.6
    });
  }
}

export class LongRangeInterceptor extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.s300pmu2 : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'S-300PMU-2', type: 'defense_long',
      systemDesignation: we ? we.designation : 'SA-20B',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 490,
      interceptionRange: sp.interceptionRange || 410,
      interceptionProbability: sp.basePk || 0.56,
      cooldown: sp.cooldown || 4.5,
      health: 250, color: sp.color || '#54a0ff', size: sp.size || 14,
      ammo: sp.ammo || 8, radarSpeed: sp.radarSpeed || 1.0,
      salvoSize: sp.salvoSize || 2,
      minEngageAltitude: 0.3, maxEngageAltitude: 2,
      reactionTime: sp.reactionTime || 1.0,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.8
    });
  }
}

export class RapidDefenseSystem extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.phalanxCIWS : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Phalanx CIWS', type: 'defense_ciws',
      systemDesignation: we ? we.designation : 'Mk 15',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 68,
      interceptionRange: sp.interceptionRange || 50,
      interceptionProbability: sp.basePk || 0.85,
      cooldown: sp.cooldown || 0.35,
      health: 100, color: sp.color || '#ff9ff3', size: sp.size || 8,
      ammo: sp.ammo || 120, radarSpeed: sp.radarSpeed || 4.0,
      salvoSize: sp.salvoSize || 1,
      minEngageAltitude: 0, maxEngageAltitude: 0.8,
      reactionTime: sp.reactionTime || 0.12,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.1
    });
  }
}

export class FighterJetSquadron extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.f14am : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'F-14AM Tomcat', type: 'defense_fighter',
      systemDesignation: we ? we.designation : 'Fighter Interceptor',
      weaponData: we, x, y, speed: 6,
      detectionRange: sp.detectionRange || 390,
      interceptionRange: sp.interceptionRange || 330,
      interceptionProbability: sp.basePk || 0.60,
      cooldown: sp.cooldown || 3.5,
      health: 180, color: sp.color || '#5f27cd', size: sp.size || 11,
      ammo: sp.ammo || 6, radarSpeed: sp.radarSpeed || 1.2,
      salvoSize: sp.salvoSize || 2,
      minEngageAltitude: 0, maxEngageAltitude: 2,
      canEngage: sp.canEngage || ['cruise', 'kamikaze_drone', 'recon_drone', 'alcm', 'heavy_drone'],
      reactionTime: sp.reactionTime || 0.8,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.4
    });
  }
}

// ── NEW: Khordad-15 (Stealth-hunter MR-SAM) ──

export class KhordadSystem extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.khordad15 : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Khordad-15', type: 'defense_mid',
      systemDesignation: we ? we.designation : '3rd Khordad MR-SAM',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 200,
      interceptionRange: sp.interceptionRange || 160,
      interceptionProbability: sp.basePk || 0.70,
      cooldown: sp.cooldown || 2.2,
      health: 180, color: sp.color || '#00b894', size: sp.size || 11,
      ammo: sp.ammo || 6, radarSpeed: sp.radarSpeed || 1.8,
      salvoSize: sp.salvoSize || 1,
      minEngageAltitude: 0.05, maxEngageAltitude: 2,
      reactionTime: sp.reactionTime || 0.5,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.4
    });
    this.stealthBonus = sp.stealthBonus || 0.15;
  }

  // Override: Khordad-15 has stealth detection bonus
  canDetect(threat) {
    const dx = this.x - threat.x;
    const dy = this.y - threat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Enhanced stealth detection: RCS threshold is lower
    const enhancedRCS = Math.max(threat.getEffectiveRCS(), 0.0005);
    const effectiveRange = this.detectionRange * Math.pow(enhancedRCS, 0.25) * (1 + this.stealthBonus);
    return dist <= effectiveRange;
  }
}

// ── NEW: Pantsir-S1 (SHORAD — Gun + Missile combo) ──

export class PantsirSystem extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.pantsirS1 : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Pantsir-S1', type: 'defense_shorad',
      systemDesignation: we ? we.designation : 'SA-22 Greyhound',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 120,
      interceptionRange: sp.interceptionRange || 95,
      interceptionProbability: sp.basePk || 0.78,
      cooldown: sp.cooldown || 1.0,
      health: 140, color: sp.color || '#6c5ce7', size: sp.size || 9,
      ammo: sp.ammo || 12, radarSpeed: sp.radarSpeed || 2.5,
      salvoSize: sp.salvoSize || 1,
      minEngageAltitude: 0, maxEngageAltitude: 1.5,
      reactionTime: sp.reactionTime || 0.25,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.2
    });
    this.hasGunMode = sp.hasGunMode || true;
    this.gunRange = sp.gunRange || 40;
  }
}

// ── NEW: Iron Dome (C-RAM, smart threat filtering) ──

export class IronDomeSystem extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.ironDome : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'Iron Dome', type: 'defense_cram',
      systemDesignation: we ? we.designation : 'Tamir C-RAM',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 180,
      interceptionRange: sp.interceptionRange || 140,
      interceptionProbability: sp.basePk || 0.82,
      cooldown: sp.cooldown || 1.2,
      health: 160, color: sp.color || '#00cec9', size: sp.size || 10,
      ammo: sp.ammo || 20, radarSpeed: sp.radarSpeed || 2.2,
      salvoSize: sp.salvoSize || 2,
      minEngageAltitude: 0, maxEngageAltitude: 1.5,
      reactionTime: sp.reactionTime || 0.2,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 0.25
    });
    this.smartFilter = sp.smartFilter || true;
  }
}

// ── NEW: THAAD (Exo-atmospheric ABM — terminal phase only) ──

export class THAADSystem extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.thaad : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'THAAD', type: 'defense_thaad',
      systemDesignation: we ? we.designation : 'Terminal High Altitude',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 500,
      interceptionRange: sp.interceptionRange || 380,
      interceptionProbability: sp.basePk || 0.80,
      cooldown: sp.cooldown || 5.0,
      health: 250, color: sp.color || '#fdcb6e', size: sp.size || 13,
      ammo: sp.ammo || 8, radarSpeed: sp.radarSpeed || 0.8,
      salvoSize: sp.salvoSize || 1,
      minEngageAltitude: 0.8, maxEngageAltitude: 3,
      canEngage: sp.canEngage || ['ballistic_medium', 'ballistic_long', 'ballistic_irbm', 'hypersonic', 'solid_mrbm'],
      reactionTime: sp.reactionTime || 1.2,
      engagementPhase: 'any',
      killAssessmentTime: sp.killAssessmentTime || 1.0
    });
    this.exoAtmospheric = true;
  }
}

// ── NEW: EW Jammer Station (Electronic Warfare — non-kinetic) ──

export class EWJammerStation extends DefensiveEntity {
  constructor(x, y) {
    const db = WeaponsDB;
    const we = db ? db.defensive.ewJammer : null;
    const sp = we ? we.simParams : {};
    super({
      name: we ? we.name : 'EW Jammer', type: 'defense_ew',
      systemDesignation: we ? we.designation : 'Electronic Warfare',
      weaponData: we, x, y, speed: 0,
      detectionRange: sp.detectionRange || 250,
      interceptionRange: 0,
      interceptionProbability: 0,
      cooldown: 0,
      health: 100, color: sp.color || '#a29bfe', size: sp.size || 10,
      ammo: Infinity, radarSpeed: sp.radarSpeed || 3.0,
      salvoSize: 0,
      reactionTime: 0,
      killAssessmentTime: 0
    });
    this.isEW = true;
    this.jamRadius = sp.jamRadius || 200;
    this.guidanceDegradation = sp.guidanceDegradation || 0.35;
    this.jamPulsePhase = 0;
  }

  isReady() { return false; } // EW never fires kinetically

  // EW jammer degrades threat accuracy & ECM resistance within radius
  applyJamming(threats) {
    for (const threat of threats) {
      if (!threat.alive || threat.intercepted) continue;
      const dx = this.x - threat.x;
      const dy = this.y - threat.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.jamRadius) {
        // Degrade guidance accuracy (increase CEP effect)
        threat.accuracy = Math.max(0, (threat.accuracy || 0.7) - this.guidanceDegradation * 0.01);
        // Increase ECM vulnerability for defenders engaging this threat
        threat._ewJammed = true;
        threat._ewDegradation = this.guidanceDegradation * (1 - dist / this.jamRadius);
      }
    }
  }

  update(dt) {
    super.update(dt);
    this.jamPulsePhase += dt * 2;
  }
}

// ── NEW Offensive: Sejjil-2 (Solid-fuel MRBM — faster boost) ──

export class SolidBallisticMissile extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.sejjil2 : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Sejjil-2', type: 'solid_mrbm',
      x, y, targetX, targetY, weaponData: we,
      speed: 3.0, accuracy: 0.70, damage: 250, health: 90,
      color: sp.color || '#c0392b', trailColor: sp.trailColor || '#c0392b',
      size: sp.size || 8, ecm: sp.ecm || 0.10, rcs: specs.rcsM2 || 1.1,
      hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
      decoyCount: sp.decoyCount || 1, maneuverability: sp.maneuverability || 0.05,
      speedMach: specs.speedMach || 14, warheadKg: specs.warheadKg || 750,
      cepM: specs.cepM || 250, massKg: specs.launchMassKg || 23600,
      dragCoeff: specs.Cd || 0.28, crossSection: specs.crossSectionM2 || 1.227
    });
    this.progress = 0;
    this.arcHeight = 320;
    this.totalDist = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);
    this.terminalSpeed = this.speed * 2.6;
    this.beta = (specs.launchMassKg || 23600) / ((specs.Cd || 0.28) * (specs.crossSectionM2 || 1.227));
    this.thermalSig = 0;

    if (WeaponsDB) {
      const offset = WeaponsDB.physics.randomCEPOffset(specs.cepM || 250);
      this.targetX += offset.dx * 0.015;
      this.targetY += offset.dy * 0.015;
    }
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    let currentSpeed = this.speed;

    // Solid fuel: faster boost, shorter burn
    if (this.progress < 0.15) {
      this.flightPhase = 'boost';
      currentSpeed = this.speed * (0.8 + this.progress * 4.0); // Faster acceleration
      this.altitude = this.progress * 6;
    } else if (this.progress < 0.65) {
      this.flightPhase = 'midcourse';
      this.altitude = 1.2;
      currentSpeed = this.speed * 1.2;
    } else {
      this.flightPhase = 'terminal';
      const reentryProgress = (this.progress - 0.65) / 0.35;
      currentSpeed = this.terminalSpeed * (1 + reentryProgress * 0.4);
      this.altitude = (1 - this.progress) * 3.5;
    }

    this.progress += (currentSpeed * dt * 60) / this.totalDist;
    this.progress = Math.min(this.progress, 1);

    const t_p = this.progress;
    this.x = this.startX + (this.targetX - this.startX) * t_p;
    this.y = this.startY + (this.targetY - this.startY) * t_p + (-this.arcHeight * 4 * t_p * (1 - t_p));

    // Coriolis + wind
    if (WeaponsDB && this.speedMach > 2) {
      this.x += WeaponsDB.physics.coriolisDeflection(this.speedMach * 343, this.phaseTimer);
    }
    if (WeaponsDB && this.flightPhase === 'midcourse') {
      const wind = WeaponsDB.physics.windAtAltitude(12);
      this.x += wind.wx * dt;
    }
    if (WeaponsDB) {
      this.thermalSig = WeaponsDB.physics.thermalSignature(this.currentMach || this.speedMach, this.currentAltitudeKm || 0);
    }

    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) this.angle = Math.atan2(dy, dx);
    this.updateTelemetry(dx, dy, dt);
    if (this.progress >= 1) this.reachedTarget = true;

    if (Math.random() < (this.flightPhase === 'boost' ? 1.0 : 0.4)) {
      this.smokeTrail.push({
        x: this.x + (Math.random() - 0.5) * 2, y: this.y + (Math.random() - 0.5) * 2,
        alpha: 0.5, size: 2 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2, life: 1.0
      });
    }
    if (this.smokeTrail.length > 70) this.smokeTrail.shift();
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 50) this.trail.shift();
  }
}

// ── NEW Offensive: Fattah-1 (Hypersonic Glide Vehicle) ──

export class HypersonicGlideVehicle extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.fattah1 : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Fattah-1', type: 'hypersonic',
      x, y, targetX, targetY, weaponData: we,
      speed: 2.5, accuracy: 0.90, damage: 300, health: 70,
      color: sp.color || '#e74c3c', trailColor: sp.trailColor || '#ff0044',
      size: sp.size || 7, ecm: sp.ecm || 0.20, rcs: specs.rcsM2 || 0.3,
      hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
      decoyCount: sp.decoyCount || 3, maneuverability: sp.maneuverability || 0.45,
      speedMach: specs.speedMach || 15, warheadKg: specs.warheadKg || 500,
      cepM: specs.cepM || 30, massKg: specs.launchMassKg || 19000,
      dragCoeff: specs.Cd || 0.22, crossSection: specs.crossSectionM2 || 1.431
    });
    this.progress = 0;
    this.arcHeight = 250;
    this.totalDist = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);
    this.terminalSpeed = this.speed * 3.0;
    this.isHypersonic = true;
    this.plasmaTrail = [];
    this.skipPhase = 0;
    this.thermalSig = 0;

    if (WeaponsDB) {
      const offset = WeaponsDB.physics.randomCEPOffset(specs.cepM || 30);
      this.targetX += offset.dx * 0.015;
      this.targetY += offset.dy * 0.015;
    }
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    let currentSpeed = this.speed;

    // HGV flight profile: boost → skip-glide → terminal dive
    if (this.progress < 0.12) {
      this.flightPhase = 'boost';
      currentSpeed = this.speed * (0.6 + this.progress * 6.0);
      this.altitude = this.progress * 8;
    } else if (this.progress < 0.75) {
      this.flightPhase = 'midcourse';
      this.altitude = 0.8;
      currentSpeed = this.speed * 1.4;
      // Skip-glide oscillation: HGV bounces off upper atmosphere
      this.skipPhase += dt * 4;
    } else {
      this.flightPhase = 'terminal';
      const reentryProgress = (this.progress - 0.75) / 0.25;
      currentSpeed = this.terminalSpeed * (1 + reentryProgress * 0.3);
      this.altitude = (1 - this.progress) * 2.5;

      // Extreme MaRV maneuvers
      if (this.evasionCooldown <= 0) {
        const marvAuthority = this.maneuverability * 55;
        this.targetX += (Math.random() - 0.5) * marvAuthority;
        this.evasionCooldown = 0.15 + Math.random() * 0.2;
      }
    }

    this.evasionCooldown -= dt;
    this.progress += (currentSpeed * dt * 60) / this.totalDist;
    this.progress = Math.min(this.progress, 1);

    const t_p = this.progress;
    const linearX = this.startX + (this.targetX - this.startX) * t_p;
    const linearY = this.startY + (this.targetY - this.startY) * t_p;
    // Skip-glide trajectory: sinusoidal overlay on arc
    const arcOffset = -this.arcHeight * 4 * t_p * (1 - t_p);
    const skipBounce = this.flightPhase === 'midcourse' ? Math.sin(this.skipPhase) * 25 : 0;

    this.x = linearX;
    this.y = linearY + arcOffset + skipBounce;

    // Coriolis
    if (WeaponsDB) {
      this.x += WeaponsDB.physics.coriolisDeflection(this.speedMach * 343, this.phaseTimer);
      this.thermalSig = WeaponsDB.physics.thermalSignature(this.currentMach || 15, this.currentAltitudeKm || 0);
    }

    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) this.angle = Math.atan2(dy, dx);
    this.updateTelemetry(dx, dy, dt);
    if (this.progress >= 1) this.reachedTarget = true;

    // Plasma trail (hypersonic heating)
    if (Math.random() < 0.9) {
      this.plasmaTrail.push({
        x: this.x + (Math.random() - 0.5) * 4,
        y: this.y + (Math.random() - 0.5) * 4,
        alpha: 0.7 + Math.random() * 0.3,
        size: 2 + Math.random() * 4,
        hue: 10 + Math.random() * 30
      });
    }
    if (this.plasmaTrail.length > 40) this.plasmaTrail.shift();

    if (Math.random() < 0.8) {
      this.smokeTrail.push({
        x: this.x, y: this.y, alpha: 0.6, size: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 0.5, vy: -0.3, life: 1.0
      });
    }
    if (this.smokeTrail.length > 80) this.smokeTrail.shift();
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 55) this.trail.shift();
  }
}

// ── NEW Offensive: Paveh ALCM (Air-Launched Cruise Missile — sea-skimming) ──

export class AirLaunchedCruise extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.paveh : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Paveh ALCM', type: 'alcm',
      x, y, targetX, targetY, weaponData: we,
      speed: 2.9, accuracy: 0.90, damage: 150, health: 45,
      color: sp.color || '#fd79a8', trailColor: sp.trailColor || '#fd79a8',
      size: sp.size || 4, ecm: sp.ecm || 0.30, rcs: specs.rcsM2 || 0.008,
      hasChaffFlares: sp.hasChaff || true, hasDecoys: sp.hasDecoys || true,
      decoyCount: sp.decoyCount || 2, maneuverability: sp.maneuverability || 0.40,
      speedMach: specs.speedMach || 0.7, warheadKg: specs.warheadKg || 350,
      cepM: specs.cepM || 25, massKg: specs.launchMassKg || 1300,
      dragCoeff: specs.Cd || 0.022, crossSection: specs.crossSectionM2 || 0.181
    });
    this.cruiseAltitude = sp.cruiseAltitude || 0.08;
    this.altitude = this.cruiseAltitude;
    this.flightPhase = 'cruise';
    this.waveMagnitude = 20 + Math.random() * 15;
    this.waveFrequency = 0.018 + Math.random() * 0.01;
    this.waveOffset = Math.random() * Math.PI * 2;
    this.distanceTraveled = 0;
    this.thermalSig = 0;

    // TERCOM waypoints
    this.waypoints = [];
    const segments = 2 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= segments; i++) {
      const frac = i / (segments + 1);
      this.waypoints.push({
        x: x + (targetX - x) * frac + (Math.random() - 0.5) * 120,
        y: y + (targetY - y) * frac
      });
    }
    this.currentWaypoint = 0;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;
    this.distanceTraveled += this.speed * dt * 60;

    let navTargetX = this.targetX;
    let navTargetY = this.targetY;
    if (this.currentWaypoint < this.waypoints.length) {
      navTargetX = this.waypoints[this.currentWaypoint].x;
      navTargetY = this.waypoints[this.currentWaypoint].y;
      const wpDist = Math.sqrt((this.x - navTargetX) ** 2 + (this.y - navTargetY) ** 2);
      if (wpDist < 20) this.currentWaypoint++;
    }

    const dxNav = navTargetX - this.x;
    const dyNav = navTargetY - this.y;
    const dist = Math.sqrt(dxNav * dxNav + dyNav * dyNav);

    const lateralOffset = Math.sin(this.distanceTraveled * this.waveFrequency + this.waveOffset) * this.waveMagnitude;
    const perpX = -dyNav / dist;
    const perpY = dxNav / dist;

    const moveX = (dxNav / dist) * this.speed * dt * 60 + perpX * lateralOffset * dt * 2;
    const moveY = (dyNav / dist) * this.speed * dt * 60 + perpY * lateralOffset * dt * 2;

    this.x += moveX;
    this.y += moveY;

    // Wind effect on cruise missiles
    if (WeaponsDB) {
      const wind = WeaponsDB.physics.windAtAltitude(0.03);
      this.x += wind.wx * dt * 0.5;
      this.y += wind.wy * dt * 0.5;
    }

    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
      this.angle = Math.atan2(moveY, moveX);
    }

    const finalDist = Math.sqrt((this.x - this.targetX) ** 2 + (this.y - this.targetY) ** 2);
    if (finalDist < 50) this.flightPhase = 'terminal';
    if (finalDist < this.speed * dt * 60 * 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.reachedTarget = true;
    }

    this.updateTelemetry(moveX, moveY, dt);

    if (Math.random() < 0.4) {
      this.smokeTrail.push({
        x: this.x - Math.cos(this.angle) * 4, y: this.y - Math.sin(this.angle) * 4,
        alpha: 0.3, size: 1.5, vx: (Math.random() - 0.5) * 0.2, vy: -0.1, life: 1.0
      });
    }
    if (this.smokeTrail.length > 40) this.smokeTrail.shift();
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 40) this.trail.shift();
  }
}

// ── NEW Offensive: Arash-2 (Heavy Attack Drone — jet-powered OWA) ──

export class HeavyAttackDrone extends OffensiveEntity {
  constructor(x, y, targetX, targetY) {
    const db = WeaponsDB;
    const we = db ? db.offensive.arash2 : null;
    const sp = we ? we.simParams : {};
    const specs = we ? we.specs : {};

    super({
      name: we ? we.name : 'Arash-2', type: 'heavy_drone',
      x, y, targetX, targetY, weaponData: we,
      speed: 2.2, accuracy: 0.85, damage: 110, health: 18,
      color: sp.color || '#f39c12', trailColor: sp.trailColor || '#f39c12',
      size: sp.size || 4, ecm: sp.ecm || 0.08, rcs: specs.rcsM2 || 0.008,
      hasChaffFlares: false, hasDecoys: false,
      maneuverability: sp.maneuverability || 0.20,
      speedMach: specs.speedMach || 0.30, warheadKg: specs.warheadKg || 50,
      massKg: specs.launchMassKg || 290
    });
    this.altitude = 0.35;
    this.flightPhase = 'cruise';
    this.diveStarted = false;
    this.swarmOffset = (Math.random() - 0.5) * 50;
    this.thermalSig = 0;
  }

  update(dt) {
    if (!this.alive || this.intercepted || this.reachedTarget) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.phaseTimer += dt;

    const dx = this.targetX + this.swarmOffset - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let currentSpeed = this.speed;
    if (dist < 90 && !this.diveStarted) {
      this.diveStarted = true;
      this.flightPhase = 'terminal';
    }
    if (this.diveStarted) currentSpeed = this.speed * 1.6;

    // Wind effect
    let windDx = 0, windDy = 0;
    if (WeaponsDB) {
      const wind = WeaponsDB.physics.windAtAltitude(0.5);
      windDx = wind.wx * dt;
      windDy = wind.wy * dt;
    }

    if (dist < currentSpeed * dt * 60 * 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.reachedTarget = true;
    } else {
      const weave = Math.sin(this.phaseTimer * 2.5) * 0.5;
      const moveX = (dx / dist) * currentSpeed * dt * 60 + weave + windDx;
      const moveY = (dy / dist) * currentSpeed * dt * 60 + windDy;
      this.x += moveX;
      this.y += moveY;
      this.angle = Math.atan2(dy + weave, dx);
      this.updateTelemetry(moveX, moveY, dt);
    }

    if (Math.random() < 0.5) {
      this.smokeTrail.push({
        x: this.x, y: this.y, alpha: 0.3, size: 1.5,
        vx: (Math.random() - 0.5) * 0.2, vy: -0.15, life: 1.0
      });
    }
    if (this.smokeTrail.length > 35) this.smokeTrail.shift();
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 30) this.trail.shift();
  }
}

// ── Explosions & Effects ──────────────────────

export class Explosion {
  constructor(x, y, success, size) {
    this.x = x;
    this.y = y;
    this.success = success;
    this.radius = 0;
    this.maxRadius = (success ? 30 : 20) * (size || 1);
    this.alpha = 1;
    this.shockwaveRadius = 0;
    this.shockwaveAlpha = 0.8;
    this.particles = [];
    this.debris = [];
    this.alive = true;

    const count = success ? 18 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 1.5 + Math.random() * 3,
        color: success
          ? `hsl(${100 + Math.random() * 60}, 90%, ${50 + Math.random() * 20}%)`
          : `hsl(${Math.random() * 40}, 100%, ${45 + Math.random() * 20}%)`
      });
    }

    if (success) {
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        this.debris.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + 1,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 10,
          alpha: 1,
          size: 2 + Math.random() * 2
        });
      }
    }
  }

  update(dt) {
    this.radius += dt * 80;
    this.alpha -= dt * 1.8;

    this.shockwaveRadius += dt * 120;
    this.shockwaveAlpha -= dt * 2.5;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += dt * 2;
      p.alpha -= dt * 2.0;
      p.vx *= 0.97;
      p.vy *= 0.97;
    }

    for (const d of this.debris) {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += dt * 5;
      d.rotation += d.rotSpeed * dt;
      d.alpha -= dt * 1.2;
      d.vx *= 0.98;
    }

    if (this.alpha <= 0 && this.shockwaveAlpha <= 0) this.alive = false;
  }
}

// ── Chaff Cloud Effect ──

export class ChaffCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.alpha = 1;
    this.radius = 5;
    this.maxRadius = 35;
    this.alive = true;
    this.particles = [];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        alpha: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 2
      });
    }
  }

  update(dt) {
    this.radius += dt * 15;
    this.alpha -= dt * 0.5;
    for (const p of this.particles) {
      p.x += p.vx * dt * 10;
      p.y += p.vy * dt * 10;
      p.alpha -= dt * 0.4;
    }
    if (this.alpha <= 0) this.alive = false;
  }
}

if (typeof window !== 'undefined') {
  window.Entities = {
    BallisticMissile, CruiseMissile,
    ReconDrone, KamikazeDrone,
    SolidBallisticMissile, HypersonicGlideVehicle,
    AirLaunchedCruise, HeavyAttackDrone,
    ShortRangeInterceptor, MidRangeInterceptor, LongRangeInterceptor,
    RapidDefenseSystem, FighterJetSquadron,
    KhordadSystem, PantsirSystem, IronDomeSystem,
    THAADSystem, EWJammerStation,
    Explosion, ChaffCloud
  };
}
