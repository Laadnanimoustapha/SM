// @ts-nocheck
import type { Entity, OffensiveEntity, DefensiveEntity } from './entities';
import { WeaponsDB } from './weapons_data';

// ============================================
// RENDERER — Military HUD & NATO Symbology
// ============================================

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.gridOpacity = 0.04;
    this.scanLineY = 0;

    // Starfield
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.65,
        size: 0.3 + Math.random() * 1.2,
        alpha: 0.2 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2
      });
    }

    this.mountains = this.generateMountains();
    this.clouds = this.generateClouds();

    // Impact markers for BDA
    this.bdaMarkers = [];
  }

  generateMountains() {
    const points = [];
    const w = 900;
    let x = 0;
    while (x < w + 20) {
      points.push({ x, h: 15 + Math.random() * 45 + Math.sin(x * 0.01) * 20 });
      x += 8 + Math.random() * 15;
    }
    return points;
  }

  generateClouds() {
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * 900, y: 40 + Math.random() * 120,
        width: 60 + Math.random() * 100, height: 12 + Math.random() * 18,
        alpha: 0.03 + Math.random() * 0.04, speed: 0.05 + Math.random() * 0.1
      });
    }
    return clouds;
  }

  clear() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#040608');
    bg.addColorStop(0.3, '#080c14');
    bg.addColorStop(0.7, '#0a0f1a');
    bg.addColorStop(1, '#0e1520');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  drawGrid() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const spacing = 50;

    ctx.strokeStyle = `rgba(0, 255, 100, ${this.gridOpacity * 0.5})`;
    ctx.lineWidth = 0.3;

    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Range ring markers
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 255, 100, 0.08)';
    ctx.textAlign = 'right';
    for (let y = spacing; y < h; y += spacing) {
      const rangeKm = Math.floor((h - y) / h * 400);
      ctx.fillText(`${rangeKm}km`, w - 4, y + 3);
    }
  }

  drawStars(time) {
    const ctx = this.ctx;
    for (const star of this.stars) {
      const twinkle = Math.sin(time * 1.5 + star.twinkle) * 0.3 + 0.7;
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = '#c8d6e5';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawClouds(time) {
    const ctx = this.ctx;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed;
      if (cloud.x > 960) cloud.x = -cloud.width;
      ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = '#4a6178';
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawScanLine(time) {
    const ctx = this.ctx;
    const w = 900;
    const h = 650;
    
    // CRT phosphor scan line effect
    this.scanLineY = (this.scanLineY + 0.8) % h;
    
    const grad = ctx.createLinearGradient(0, this.scanLineY - 20, 0, this.scanLineY + 20);
    grad.addColorStop(0, 'rgba(0, 255, 80, 0)');
    grad.addColorStop(0.5, 'rgba(0, 255, 80, 0.03)');
    grad.addColorStop(1, 'rgba(0, 255, 80, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, this.scanLineY - 20, w, 40);
  }

  drawTerrain() {
    const ctx = this.ctx;
    const w = 900;
    const h = 650;
    const groundY = h - 38;

    ctx.fillStyle = '#0a1018';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (const pt of this.mountains) ctx.lineTo(pt.x, groundY - pt.h);
    ctx.lineTo(w, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.mountains.length; i++) {
      const pt = this.mountains[i];
      if (i === 0) ctx.moveTo(pt.x, groundY - pt.h);
      else ctx.lineTo(pt.x, groundY - pt.h);
    }
    ctx.stroke();

    // Ground
    const grd = ctx.createLinearGradient(0, groundY, 0, h);
    grd.addColorStop(0, '#0d1620');
    grd.addColorStop(1, '#080d15');
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, w, h - groundY);

    ctx.strokeStyle = 'rgba(0, 200, 100, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

    // City targets
    const buildings = [
      { x: 45, w: 18, h: 22 }, { x: 67, w: 12, h: 15 }, { x: 85, w: 24, h: 32 }, { x: 115, w: 10, h: 12 },
      { x: 195, w: 16, h: 18 }, { x: 215, w: 20, h: 38 }, { x: 240, w: 14, h: 14 },
      { x: 340, w: 22, h: 25 }, { x: 368, w: 14, h: 42 }, { x: 388, w: 20, h: 20 },
      { x: 440, w: 18, h: 30 }, { x: 465, w: 24, h: 24 }, { x: 495, w: 12, h: 35 },
      { x: 560, w: 20, h: 28 }, { x: 585, w: 16, h: 45 }, { x: 608, w: 22, h: 18 },
      { x: 700, w: 18, h: 22 }, { x: 722, w: 26, h: 34 }, { x: 755, w: 14, h: 16 },
      { x: 810, w: 20, h: 26 }, { x: 836, w: 16, h: 38 }, { x: 858, w: 22, h: 20 }
    ];

    for (const b of buildings) {
      ctx.fillStyle = '#0c141f';
      ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
      ctx.fillStyle = '#141e2b';
      ctx.fillRect(b.x, groundY - b.h, b.w, 2);
      for (let wy = groundY - b.h + 5; wy < groundY - 3; wy += 5) {
        for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 4) {
          if (Math.random() > 0.6) {
            const warm = Math.random() > 0.3;
            ctx.fillStyle = warm
              ? `rgba(255, ${180 + Math.random() * 60}, ${80 + Math.random() * 40}, ${0.12 + Math.random() * 0.12})`
              : `rgba(150, 200, 255, ${0.06 + Math.random() * 0.06})`;
            ctx.fillRect(wx, wy, 2, 2);
          }
        }
      }
    }
  }

  drawDefenders(defenders, time) {
    const ctx = this.ctx;

    for (const def of defenders) {
      if (!def.alive) continue;

      // Radar sweep (military green)
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.beginPath();
      ctx.moveTo(def.x, def.y);
      ctx.arc(def.x, def.y, def.detectionRange, def.radarAngle, def.radarAngle + Math.PI / 5);
      ctx.closePath();
      const radarGrad = ctx.createRadialGradient(def.x, def.y, 0, def.x, def.y, def.detectionRange);
      radarGrad.addColorStop(0, '#00ff6655');
      radarGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radarGrad;
      ctx.fill();
      ctx.restore();

      // Detection range ring
      ctx.globalAlpha = 0.025;
      ctx.beginPath();
      ctx.arc(def.x, def.y, def.detectionRange, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Engagement envelope (kill zone — dashed)
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(def.x, def.y, def.interceptionRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // MIL-STD-2525 friendly symbol (blue rectangle)
      this.drawDefenderIcon(def, time);

      // Ammo bar
      if (def.ammo !== Infinity) {
        const barW = 22;
        const barH = 2.5;
        const ratio = def.ammo / def.maxAmmo;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(def.x - barW / 2, def.y + def.size + 5, barW, barH);
        const barColor = ratio > 0.3 ? '#00ff66' : (ratio > 0.1 ? '#ffa502' : '#ff4757');
        ctx.fillStyle = barColor;
        ctx.fillRect(def.x - barW / 2, def.y + def.size + 5, barW * ratio, barH);
      }

      // Cooldown ring
      if (!def.ready) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffa502';
        ctx.lineWidth = 2;
        const cdRatio = def.cooldownTimer / def.cooldown;
        ctx.beginPath();
        ctx.arc(def.x, def.y, def.size + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdRatio));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Kill chain phase indicator
      if (def.killChainPhase !== 'search') {
        ctx.font = '6px "JetBrains Mono", monospace';
        ctx.fillStyle = def.killChainPhase === 'engage' ? '#ff6b6b' : '#ffa502';
        ctx.textAlign = 'center';
        ctx.fillText(def.killChainPhase.toUpperCase(), def.x, def.y - def.size - 8);
      }

      // Interceptor trails
      for (const trail of def.interceptorTrails) {
        const progress = Math.min(trail.progress, 1);
        const cx = trail.startX + (trail.endX - trail.startX) * progress;
        const cy = trail.startY + (trail.endY - trail.startY) * progress;

        ctx.globalAlpha = 0.2;
        for (const sp of trail.smokeParticles) {
          ctx.fillStyle = '#8899aa';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = trail.alpha * 0.7;
        ctx.strokeStyle = trail.hit ? '#00ff66' : '#ff4757';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(trail.startX, trail.startY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        if (progress < 1) {
          ctx.shadowColor = trail.hit ? '#00ff66' : '#ff4757';
          ctx.shadowBlur = 8;
          ctx.fillStyle = trail.hit ? '#00ff66' : '#ff4757';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  drawDefenderIcon(def, time) {
    const ctx = this.ctx;
    const { x, y, size, color } = def;

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // MIL-STD-2525 friendly base: blue rectangle
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(x - size * 0.65, y - size * 0.65, size * 1.3, size * 1.3);
    ctx.globalAlpha = 1;

    switch (def.type) {
      case 'defense_long':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.65, y + size * 0.25);
        ctx.lineTo(x - size * 0.65, y + size * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x - 1, y + size * 0.25, 2, size * 0.5);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y - size * 0.3, size * 0.4, -Math.PI * 0.7, -Math.PI * 0.3);
        ctx.stroke();
        break;
      case 'defense_mid':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.8);
        ctx.lineTo(x + size * 0.55, y);
        ctx.lineTo(x, y + size * 0.8);
        ctx.lineTo(x - size * 0.55, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#060810';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'defense_short':
        ctx.fillStyle = color;
        ctx.fillRect(x - size * 0.45, y - size * 0.45, size * 0.9, size * 0.9);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(def.rotationAngle || -Math.PI / 2);
        ctx.fillRect(0, -1.5, size * 0.7, 3);
        ctx.restore();
        break;
      case 'defense_ciws':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(def.rotationAngle || -Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 0.9, 0); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -2); ctx.lineTo(size * 0.7, -2);
        ctx.moveTo(0, 2); ctx.lineTo(size * 0.7, 2);
        ctx.stroke();
        ctx.restore();
        break;
      case 'defense_fighter':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.8);
        ctx.lineTo(x + size * 0.35, y + size * 0.3);
        ctx.lineTo(x + size * 0.75, y + size * 0.55);
        ctx.lineTo(x, y + size * 0.15);
        ctx.lineTo(x - size * 0.75, y + size * 0.55);
        ctx.lineTo(x - size * 0.35, y + size * 0.3);
        ctx.closePath();
        ctx.fill();
        break;
      // ── NEW: THAAD — upward arrow (exo-atmospheric) ──
      case 'defense_thaad':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 1.1);
        ctx.lineTo(x + size * 0.5, y - size * 0.2);
        ctx.lineTo(x + size * 0.2, y - size * 0.2);
        ctx.lineTo(x + size * 0.2, y + size * 0.6);
        ctx.lineTo(x - size * 0.2, y + size * 0.6);
        ctx.lineTo(x - size * 0.2, y - size * 0.2);
        ctx.lineTo(x - size * 0.5, y - size * 0.2);
        ctx.closePath();
        ctx.fill();
        // Radar dish arc
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y - size * 0.6, size * 0.5, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();
        break;
      // ── NEW: Pantsir SHORAD — gun + missile combo ──
      case 'defense_shorad':
        ctx.fillStyle = color;
        ctx.fillRect(x - size * 0.5, y - size * 0.35, size, size * 0.7);
        // Twin gun barrels
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(def.rotationAngle || -Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(size * 0.8, -3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(size * 0.8, 3); ctx.stroke();
        // Missile tubes on sides
        ctx.fillStyle = color;
        ctx.fillRect(-size * 0.3, -size * 0.5, size * 0.15, size * 0.15);
        ctx.fillRect(-size * 0.3, size * 0.35, size * 0.15, size * 0.15);
        ctx.restore();
        break;
      // ── NEW: Iron Dome C-RAM — dome shape ──
      case 'defense_cram':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, Math.PI, 0); // Top dome
        ctx.lineTo(x + size * 0.5, y + size * 0.3);
        ctx.lineTo(x - size * 0.5, y + size * 0.3);
        ctx.closePath();
        ctx.fill();
        // Inner dot
        ctx.fillStyle = '#060810';
        ctx.beginPath();
        ctx.arc(x, y - size * 0.1, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        // Range lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.7, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      // ── NEW: EW Jammer — pulsing interference rings ──
      case 'defense_ew':
        // Pulsing jamming radius
        const pulseAlpha = 0.04 + 0.03 * Math.sin(def.jamPulsePhase || time * 2);
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = '#a29bfe';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(x, y, def.jamRadius || 200, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Inner interference rings
        ctx.globalAlpha = pulseAlpha * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, (def.jamRadius || 200) * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // EW station icon — antenna with waves
        ctx.fillStyle = color;
        ctx.fillRect(x - 2, y - size * 0.6, 4, size * 1.2);
        ctx.fillRect(x - size * 0.4, y - size * 0.6, size * 0.8, 3);
        // Wave arcs
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let r = 1; r <= 3; r++) {
          ctx.globalAlpha = 0.4 - r * 0.1;
          ctx.beginPath();
          ctx.arc(x, y - size * 0.5, size * 0.25 * r, -Math.PI * 0.7, -Math.PI * 0.3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
    }

    ctx.shadowBlur = 0;

    // System name + designation
    ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, x, y + size + 16);
    if (def.systemDesignation) {
      ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
      ctx.font = '6px "JetBrains Mono", monospace';
      ctx.fillText(def.systemDesignation, x, y + size + 23);
    }
  }

  drawThreats(threats, time) {
    const ctx = this.ctx;

    for (const t of threats) {
      if (!t.alive) continue;

      // Smoke trail
      for (const s of t.smokeTrail) {
        ctx.globalAlpha = s.alpha * 0.4;
        ctx.fillStyle = '#556677';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Position trail
      for (let i = 0; i < t.trail.length; i++) {
        const tp = t.trail[i];
        ctx.globalAlpha = tp.alpha * 0.35;
        ctx.fillStyle = t.trailColor;
        const trailSize = 1 + (i / t.trail.length) * 1.5;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, trailSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Trajectory prediction line
      if (t.detected && t.targetX !== undefined) {
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.targetX, t.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // ── Thermal IR glow (NEW — for high-Mach threats) ──
      if (t.thermalSig && t.thermalSig > 0.15) {
        ctx.globalAlpha = t.thermalSig * 0.35;
        const irGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size * 3);
        irGrad.addColorStop(0, `rgba(255, ${Math.floor(120 + t.thermalSig * 135)}, 0, 0.6)`);
        irGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = irGrad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Plasma trail for HGV (NEW) ──
      if (t.plasmaTrail) {
        for (const p of t.plasmaTrail) {
          ctx.globalAlpha = p.alpha * 0.6;
          ctx.fillStyle = `hsl(${p.hue}, 100%, 55%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Glow
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.isHypersonic ? 20 : 12;
      ctx.fillStyle = t.color;
      this.drawThreatIcon(t);
      ctx.shadowBlur = 0;

      // MIL-STD hostile diamond bracket + phase label
      if (t.detected) {
        this.drawHostileBracket(t, time);
      }

      // Telemetry readout for ballistic missiles
      if (t.detected && (t.type.startsWith('ballistic') || t.type === 'solid_mrbm' || t.type === 'hypersonic')) {
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';

        const labelX = t.x + t.size + 10;
        let labelY = t.y - 8;

        // Phase
        const phaseLabel = t.flightPhase === 'boost' ? 'BST' : (t.flightPhase === 'midcourse' ? 'MID' : 'TRM');
        ctx.fillStyle = t.flightPhase === 'terminal' ? 'rgba(255,80,80,0.6)' : 'rgba(255,255,255,0.35)';
        ctx.fillText(phaseLabel, labelX, labelY);

        // Mach
        if (t.currentMach > 0.5) {
          labelY += 9;
          ctx.fillStyle = 'rgba(255,200,100,0.4)';
          ctx.fillText(`M${t.currentMach.toFixed(1)}`, labelX, labelY);
        }

        // Altitude
        if (t.currentAltitudeKm > 0.5) {
          labelY += 9;
          ctx.fillStyle = 'rgba(100,200,255,0.35)';
          ctx.fillText(`${t.currentAltitudeKm.toFixed(0)}km`, labelX, labelY);
        }

        // TTI
        if (t.timeToImpact < 100 && t.timeToImpact > 0) {
          labelY += 9;
          ctx.fillStyle = 'rgba(255,100,100,0.4)';
          ctx.fillText(`TTI:${t.timeToImpact.toFixed(1)}s`, labelX, labelY);
        }
      }

      // Cruise/drone minimal label
      if (t.detected && (t.type === 'cruise' || t.type === 'kamikaze_drone' || t.type === 'alcm' || t.type === 'heavy_drone')) {
        ctx.font = '6px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        const labelMap = { cruise: 'GLCM', kamikaze_drone: 'OWA', alcm: 'ALCM', heavy_drone: 'H-OWA' };
        const label = labelMap[t.type] || t.type;
        ctx.fillText(label, t.x, t.y - t.size - 6);
        if (t.rcs < 0.05) {
          ctx.fillStyle = 'rgba(255,100,100,0.3)';
          ctx.fillText('LO-RCS', t.x, t.y + t.size + 12);
        }
        if (t._ewJammed) {
          ctx.fillStyle = 'rgba(162,155,254,0.4)';
          ctx.fillText('JAMMED', t.x, t.y + t.size + 18);
        }
      }

      // Chaff indicator
      if (t.chaffDeployed) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#aabbcc';
        ctx.font = '6px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CHAFF', t.x, t.y + t.size + 10);
        ctx.globalAlpha = 1;
      }

      // Recon drone scan cone
      if (t.type === 'recon_drone' && t.alive) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.arc(t.x, t.y, t.scanRadius, t.scanAngle, t.scanAngle + Math.PI / 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.scanRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }

  // MIL-STD-2525 hostile diamond bracket
  drawHostileBracket(t, time) {
    const ctx = this.ctx;
    const bs = t.size + 8;
    const pulse = 0.7 + Math.sin(time * 4) * 0.3;

    // Diamond (hostile symbol)
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.45 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - bs);        // top
    ctx.lineTo(t.x + bs, t.y);        // right
    ctx.lineTo(t.x, t.y + bs);        // bottom
    ctx.lineTo(t.x - bs, t.y);        // left
    ctx.closePath();
    ctx.stroke();

    // Corner hash marks
    const cl = 4;
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.3 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(t.x - bs - cl, t.y); ctx.lineTo(t.x - bs + 2, t.y);
    ctx.moveTo(t.x + bs - 2, t.y); ctx.lineTo(t.x + bs + cl, t.y);
    ctx.moveTo(t.x, t.y - bs - cl); ctx.lineTo(t.x, t.y - bs + 2);
    ctx.moveTo(t.x, t.y + bs - 2); ctx.lineTo(t.x, t.y + bs + cl);
    ctx.stroke();
  }

  drawThreatIcon(t) {
    const ctx = this.ctx;
    const { x, y, size } = t;

    switch (t.type) {
      case 'ballistic_short':
      case 'ballistic_medium':
      case 'ballistic_long':
      case 'ballistic_irbm':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        // Missile body
        ctx.beginPath();
        ctx.moveTo(size * 1.4, 0);
        ctx.lineTo(size * 0.4, -size * 0.25);
        ctx.lineTo(-size * 0.6, -size * 0.3);
        ctx.lineTo(-size * 0.8, -size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.5);
        ctx.lineTo(-size * 0.6, size * 0.3);
        ctx.lineTo(size * 0.4, size * 0.25);
        ctx.closePath();
        ctx.fill();

        // Nosecone
        ctx.fillStyle = `rgba(255,255,255,0.15)`;
        ctx.beginPath();
        ctx.moveTo(size * 1.4, 0);
        ctx.lineTo(size * 0.6, -size * 0.15);
        ctx.lineTo(size * 0.6, size * 0.15);
        ctx.closePath();
        ctx.fill();

        // Warhead marking (red stripe for IRBM)
        if (t.type === 'ballistic_irbm') {
          ctx.fillStyle = 'rgba(255, 40, 40, 0.4)';
          ctx.fillRect(-size * 0.1, -size * 0.28, size * 0.3, size * 0.56);
        }

        // Exhaust flame
        const flameLen = t.flightPhase === 'boost' ? size * 1.4 : size * 0.5;
        const flameFlicker = 0.7 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(255, ${120 + Math.random() * 100}, 0, ${flameFlicker * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, -size * 0.15);
        ctx.lineTo(-size * 0.6 - flameLen, 0);
        ctx.lineTo(-size * 0.6, size * 0.15);
        ctx.closePath();
        ctx.fill();
        // Inner flame (white-hot)
        ctx.fillStyle = `rgba(255, 255, ${150 + Math.random() * 100}, ${flameFlicker * 0.6})`;
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, -size * 0.08);
        ctx.lineTo(-size * 0.6 - flameLen * 0.6, 0);
        ctx.lineTo(-size * 0.6, size * 0.08);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        break;

      case 'cruise':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        ctx.beginPath();
        ctx.moveTo(size * 1.2, 0);
        ctx.lineTo(size * 0.3, -size * 0.2);
        ctx.lineTo(-size * 0.3, -size * 0.15);
        ctx.lineTo(-size * 0.1, -size * 0.6);
        ctx.lineTo(-size * 0.4, -size * 0.15);
        ctx.lineTo(-size * 0.7, -size * 0.12);
        ctx.lineTo(-size * 0.7, size * 0.12);
        ctx.lineTo(-size * 0.4, size * 0.15);
        ctx.lineTo(-size * 0.1, size * 0.6);
        ctx.lineTo(-size * 0.3, size * 0.15);
        ctx.lineTo(size * 0.3, size * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 150, 50, ${0.5 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(-size * 0.7, 0, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'recon_drone':
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI / 2) * i + Math.PI / 4;
          const px = x + Math.cos(a) * size * 0.9;
          const py = y + Math.sin(a) * size * 0.9;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(px, py, size * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;

      case 'kamikaze_drone':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        ctx.beginPath();
        ctx.moveTo(size * 1, 0);
        ctx.lineTo(-size * 0.5, -size * 0.7);
        ctx.lineTo(-size * 0.3, 0);
        ctx.lineTo(-size * 0.5, size * 0.7);
        ctx.closePath();
        ctx.fill();
        if (t.diveStarted) {
          ctx.fillStyle = `rgba(255, 100, 50, ${0.4 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(-size * 0.3, 0, size * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;

      // ── NEW: Sejjil-2 / Solid MRBM — thicker missile body ──
      case 'solid_mrbm':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        ctx.beginPath();
        ctx.moveTo(size * 1.3, 0);
        ctx.lineTo(size * 0.3, -size * 0.3);
        ctx.lineTo(-size * 0.5, -size * 0.35);
        ctx.lineTo(-size * 0.7, -size * 0.55);
        ctx.lineTo(-size * 0.7, size * 0.55);
        ctx.lineTo(-size * 0.5, size * 0.35);
        ctx.lineTo(size * 0.3, size * 0.3);
        ctx.closePath();
        ctx.fill();
        // Dual stage marking
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(-size * 0.15, -size * 0.32, size * 0.08, size * 0.64);
        // Exhaust
        const sFlame = t.flightPhase === 'boost' ? size * 1.6 : size * 0.4;
        ctx.fillStyle = `rgba(255, ${100 + Math.random() * 120}, 0, ${0.7 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(-size * 0.55, -size * 0.15);
        ctx.lineTo(-size * 0.55 - sFlame, 0);
        ctx.lineTo(-size * 0.55, size * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;

      // ── NEW: Fattah-1 / HGV — sleek wedge shape with plasma glow ──
      case 'hypersonic':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        // HGV wedge body
        ctx.beginPath();
        ctx.moveTo(size * 1.6, 0);
        ctx.lineTo(size * 0.2, -size * 0.35);
        ctx.lineTo(-size * 0.7, -size * 0.2);
        ctx.lineTo(-size * 0.7, size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.35);
        ctx.closePath();
        ctx.fill();
        // Shockwave cone glow
        ctx.fillStyle = `rgba(255, 80, 0, ${0.3 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(size * 1.6, 0);
        ctx.lineTo(size * 2.5, -size * 0.6);
        ctx.lineTo(size * 2.5, size * 0.6);
        ctx.closePath();
        ctx.fill();
        // Extreme exhaust plume
        const hFlame = t.flightPhase === 'boost' ? size * 2 : size * 0.8;
        ctx.fillStyle = `rgba(255, ${60 + Math.random() * 80}, ${Math.random() * 40}, ${0.8 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.12);
        ctx.lineTo(-size * 0.7 - hFlame, 0);
        ctx.lineTo(-size * 0.7, size * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;

      // ── NEW: Paveh ALCM — cruise missile shape (similar to GLCM) ──
      case 'alcm':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        ctx.beginPath();
        ctx.moveTo(size * 1.1, 0);
        ctx.lineTo(size * 0.2, -size * 0.18);
        ctx.lineTo(-size * 0.2, -size * 0.12);
        ctx.lineTo(-size * 0.05, -size * 0.5);
        ctx.lineTo(-size * 0.35, -size * 0.12);
        ctx.lineTo(-size * 0.6, -size * 0.1);
        ctx.lineTo(-size * 0.6, size * 0.1);
        ctx.lineTo(-size * 0.35, size * 0.12);
        ctx.lineTo(-size * 0.05, size * 0.5);
        ctx.lineTo(-size * 0.2, size * 0.12);
        ctx.lineTo(size * 0.2, size * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 130, 60, ${0.4 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(-size * 0.6, 0, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      // ── NEW: Arash-2 / Heavy Attack Drone — delta wing OWA ──
      case 'heavy_drone':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.angle);
        ctx.beginPath();
        ctx.moveTo(size * 1.1, 0);
        ctx.lineTo(-size * 0.3, -size * 0.8);
        ctx.lineTo(-size * 0.5, -size * 0.1);
        ctx.lineTo(-size * 0.7, 0);
        ctx.lineTo(-size * 0.5, size * 0.1);
        ctx.lineTo(-size * 0.3, size * 0.8);
        ctx.closePath();
        ctx.fill();
        if (t.diveStarted) {
          ctx.fillStyle = `rgba(255, 120, 40, ${0.5 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(-size * 0.5, 0, size * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
    }
  }

  drawExplosions(explosions) {
    const ctx = this.ctx;

    for (const exp of explosions) {
      if (exp.shockwaveAlpha > 0) {
        ctx.globalAlpha = exp.shockwaveAlpha * 0.4;
        ctx.strokeStyle = exp.success ? '#00ff66' : '#ff6348';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = exp.alpha * 0.5;
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      if (exp.success) {
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
        gradient.addColorStop(0.3, 'rgba(0, 255, 100, 0.5)');
        gradient.addColorStop(0.7, 'rgba(0, 255, 100, 0.15)');
        gradient.addColorStop(1, 'transparent');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
        gradient.addColorStop(0.2, 'rgba(255, 100, 50, 0.6)');
        gradient.addColorStop(0.6, 'rgba(255, 50, 30, 0.2)');
        gradient.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();

      for (const p of exp.particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const d of exp.debris) {
        ctx.globalAlpha = Math.max(0, d.alpha);
        ctx.fillStyle = '#8899aa';
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.fillRect(-d.size / 2, -1, d.size, 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawChaffClouds(clouds) {
    const ctx = this.ctx;
    for (const cloud of clouds) {
      for (const p of cloud.particles) {
        ctx.globalAlpha = Math.max(0, p.alpha * cloud.alpha);
        ctx.fillStyle = '#aabbcc';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawHUD(sim) {
    const ctx = this.ctx;
    const w = 900;

    // Top HUD bar
    ctx.fillStyle = 'rgba(4, 6, 8, 0.85)';
    ctx.fillRect(0, 0, w, 32);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(w, 32); ctx.stroke();

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    // Time
    ctx.fillStyle = '#00cc66';
    ctx.fillText(`T+${sim.time.toFixed(1)}s`, 10, 20);

    // Wave
    ctx.fillStyle = '#00cc66';
    ctx.fillText(`WAVE ${sim.wave}`, 100, 20);

    // Speed
    ctx.fillText(`${sim.speedMultiplier}× SPD`, 190, 20);

    // Active threats
    const activeThreats = sim.threats.filter(t => t.alive).length;
    ctx.fillStyle = activeThreats > 0 ? '#ff6b6b' : '#00cc66';
    ctx.fillText(`TGT: ${activeThreats}`, 290, 20);

    // Kill rate
    const rate = sim.stats.totalLaunched > 0
      ? ((sim.stats.totalIntercepted / sim.stats.totalLaunched) * 100).toFixed(0) : '0';
    const rateColor = parseFloat(rate) >= 70 ? '#00ff66' : (parseFloat(rate) >= 40 ? '#ffa502' : '#ff4757');
    ctx.fillStyle = rateColor;
    ctx.fillText(`Pk: ${rate}%`, 380, 20);

    // Average SSKP
    if (sim.stats.avgPk > 0) {
      ctx.fillStyle = '#00aacc';
      ctx.fillText(`SSKP: ${(sim.stats.avgPk * 100).toFixed(0)}%`, 460, 20);
    }

    // Salvos
    ctx.fillStyle = '#00cc66';
    ctx.fillText(`SAL: ${sim.stats.salvosFired}`, 560, 20);

    // Warhead tonnage
    if (sim.stats.totalWarheadKg > 0) {
      ctx.fillStyle = '#ff9966';
      ctx.fillText(`W/H: ${(sim.stats.totalWarheadKg / 1000).toFixed(1)}t`, 640, 20);
    }

    // Active defense
    ctx.textAlign = 'right';
    const activeDef = sim.defenders.filter(d => d.alive).length;
    ctx.fillStyle = '#00ff66';
    ctx.fillText(`DEF: ${activeDef}/${sim.defenders.length}`, w - 10, 20);

    // ECM
    ctx.fillStyle = '#ff9ff3';
    ctx.fillText(`ECM: ${sim.stats.ecmJams}`, w - 100, 20);

    ctx.textAlign = 'left';

    // Bottom info bar — ROE and DEFCON
    ctx.fillStyle = 'rgba(4, 6, 8, 0.7)';
    ctx.fillRect(0, 650 - 18, w, 18);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.06)';
    ctx.beginPath(); ctx.moveTo(0, 650 - 18); ctx.lineTo(w, 650 - 18); ctx.stroke();

    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00cc66';
    ctx.fillText('ROE: WEAPONS FREE', 10, 650 - 6);
    ctx.fillText(`ENGAGEMENTS: ${sim.stats.defenseShotsFired}`, 170, 650 - 6);
    ctx.fillText(`LEAKERS: ${sim.stats.totalGotThrough}`, 340, 650 - 6);

    // Wind indicator
    if (sim.currentWind) {
      const windSpd = Math.sqrt(sim.currentWind.wx ** 2 + sim.currentWind.wy ** 2);
      ctx.fillStyle = '#66ccff';
      ctx.fillText(`WIND: ${(windSpd * 100).toFixed(0)}kn`, 460, 650 - 6);
    }

    // EW jams
    if (sim.stats.ewJamCount > 0) {
      ctx.fillStyle = '#a29bfe';
      ctx.fillText(`EW: ${sim.stats.ewJamCount}`, 570, 650 - 6);
    }

    // Thermal detections
    if (sim.stats.thermalDetections > 0) {
      ctx.fillStyle = '#ff9966';
      ctx.fillText(`IR: ${sim.stats.thermalDetections}`, 630, 650 - 6);
    }

    // DEFCON-style alert level
    const leakRate = sim.stats.totalLaunched > 0 ? sim.stats.totalGotThrough / sim.stats.totalLaunched : 0;
    let alertLevel, alertColor;
    if (leakRate > 0.3) { alertLevel = 'DEFCON 1'; alertColor = '#ff2222'; }
    else if (leakRate > 0.15) { alertLevel = 'DEFCON 2'; alertColor = '#ff6600'; }
    else if (leakRate > 0.05) { alertLevel = 'DEFCON 3'; alertColor = '#ffcc00'; }
    else if (sim.threats.length > 0) { alertLevel = 'DEFCON 4'; alertColor = '#00ccff'; }
    else { alertLevel = 'DEFCON 5'; alertColor = '#00ff66'; }

    ctx.textAlign = 'right';
    ctx.fillStyle = alertColor;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(alertLevel, w - 10, 650 - 6);
    ctx.textAlign = 'left';
  }

  render(sim) {
    this.clear();
    this.drawStars(sim.time);
    this.drawClouds(sim.time);
    this.drawGrid();
    this.drawScanLine(sim.time);
    this.drawTerrain();
    this.drawDefenders(sim.defenders, sim.time);
    this.drawThreats(sim.threats, sim.time);
    this.drawChaffClouds(sim.chaffClouds);
    this.drawExplosions(sim.explosions);
    this.drawHUD(sim);
  }
}

if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}
