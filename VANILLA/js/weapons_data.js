// ============================================
// WEAPONS DATABASE — Open-Source Specifications
// Sources: CSIS Missile Threat, Army Recognition,
//          Wikipedia (verified), OSINT databases
// ============================================

const WeaponsDB = {

  // ── Physics Constants ──────────────────────────
  physics: {
    g0: 9.80665,           // m/s² — standard gravitational acceleration
    R_earth: 6371000,      // m — mean Earth radius
    rho0: 1.225,           // kg/m³ — sea-level atmospheric density
    H_scale: 8500,         // m — atmospheric scale height
    gamma_air: 1.4,        // ratio of specific heats for air
    R_gas: 287.05,         // J/(kg·K) — specific gas constant for air
    T0: 288.15,            // K — sea-level standard temperature
    MACH_1: 343,           // m/s — speed of sound at sea level (15°C)
    OMEGA_EARTH: 7.2921e-5, // rad/s — Earth's angular velocity
    LATITUDE_RAD: 0.5759,  // ~33°N (Iran) in radians
    BOLTZMANN: 5.67e-8,    // W/(m²·K⁴) — Stefan-Boltzmann constant
    RADAR_LAMBDA: 0.03,    // m — typical S-band radar wavelength (10 GHz)

    // ── Core atmospheric / gravity ────────────────

    // Atmospheric density at altitude: ρ(h) = ρ₀·e^(-h/H)
    atmosphericDensity(altitudeKm) {
      const h = altitudeKm * 1000;
      return this.rho0 * Math.exp(-h / this.H_scale);
    },

    // Gravity at altitude: g(h) = g₀·(R/(R+h))²
    gravityAtAltitude(altitudeKm) {
      const h = altitudeKm * 1000;
      const ratio = this.R_earth / (this.R_earth + h);
      return this.g0 * ratio * ratio;
    },

    // Temperature at altitude (ISA model): T(h) = T₀ - 6.5·h (troposphere)
    temperatureAtAltitude(altitudeKm) {
      if (altitudeKm < 11) return this.T0 - 6.5 * altitudeKm;
      if (altitudeKm < 20) return 216.65; // tropopause
      return 216.65 + (altitudeKm - 20) * 1.0; // stratosphere
    },

    // Speed of sound at altitude: a = √(γ·R·T)
    speedOfSoundAtAlt(altitudeKm) {
      const T = this.temperatureAtAltitude(altitudeKm);
      return Math.sqrt(this.gamma_air * this.R_gas * T);
    },

    // ── Drag & ballistics ─────────────────────────

    // Drag force magnitude: D = ½·ρ·V²·Cd·S
    dragForce(velocityMs, altitudeKm, Cd, crossSectionM2) {
      const rho = this.atmosphericDensity(altitudeKm);
      return 0.5 * rho * velocityMs * velocityMs * Cd * crossSectionM2;
    },

    // Drag deceleration: a_drag = D/m = ρ·V²·Cd·S / (2m) = V²/(2β)
    dragDeceleration(velocityMs, altitudeKm, beta) {
      const rho = this.atmosphericDensity(altitudeKm);
      return (rho * velocityMs * velocityMs) / (2 * beta);
    },

    // Ballistic coefficient: β = m / (Cd · S)
    ballisticCoefficient(massKg, Cd, crossSectionM2) {
      return massKg / (Cd * crossSectionM2);
    },

    // ── Radar equations ───────────────────────────

    // Radar detection range: R_det = R_max · (σ / σ_ref)^(1/4)
    radarDetectionRange(maxRangeKm, rcsM2, referenceRcsM2) {
      return maxRangeKm * Math.pow(rcsM2 / referenceRcsM2, 0.25);
    },

    // Radar horizon distance: R_h = √(2·R_earth·h_antenna) + √(2·R_earth·h_target)
    // Returns km — line-of-sight limit for surface radar
    radarHorizon(antennaHeightM, targetAltitudeM) {
      const d1 = Math.sqrt(2 * this.R_earth * antennaHeightM);
      const d2 = Math.sqrt(2 * this.R_earth * Math.max(targetAltitudeM, 0));
      return (d1 + d2) / 1000; // convert to km
    },

    // Doppler shift: f_d = 2·V_radial / λ
    // Returns Hz — used to determine if target is in clutter notch
    dopplerShift(radialVelocityMs) {
      return (2 * Math.abs(radialVelocityMs)) / this.RADAR_LAMBDA;
    },

    // Minimum detectable velocity (clutter notch): V_min ≈ λ·PRF/4
    // Targets slower than this are lost in ground clutter
    clutterNotchVelocity(prfHz) {
      return (this.RADAR_LAMBDA * (prfHz || 3000)) / 4;
    },

    // ── Kill probability ──────────────────────────

    // Salvo kill probability: Pk_salvo = 1 - (1 - Pk_single)^n
    salvoPk(singlePk, salvoCount) {
      return 1 - Math.pow(1 - singlePk, salvoCount);
    },

    // Engagement geometry Pk modifier
    // Head-on (aspect ≈ 0°) = best; tail-chase (aspect ≈ 180°) = worst
    // aspectAngleRad between interceptor velocity and target velocity
    engagementGeometryFactor(aspectAngleRad) {
      // Normalized: 1.0 at head-on, 0.5 at tail-chase
      return 0.75 + 0.25 * Math.cos(aspectAngleRad);
    },

    // ── Warhead & blast ───────────────────────────

    // Blast radius (Hopkinson-Cranz): r_lethal = k · W^(1/3)
    // k ≈ 4.5 for conventional HE fragmentation
    blastRadiusM(warheadKg) {
      return 4.5 * Math.pow(warheadKg, 1 / 3);
    },

    // Blast overpressure at distance: P(r) = P0 · (r_blast/r)²
    // Inverse-square falloff of damage
    blastDamageAtDistance(warheadKg, distanceM) {
      const rBlast = this.blastRadiusM(warheadKg);
      if (distanceM <= 0) return 1.0;
      if (distanceM >= rBlast * 3) return 0;
      return Math.min(1.0, (rBlast * rBlast) / (distanceM * distanceM));
    },

    // ── CEP & accuracy ────────────────────────────

    // CEP to Gaussian sigma: σ ≈ CEP / 1.1774
    cepToSigma(cepMeters) {
      return cepMeters / 1.1774;
    },

    // Random offset within CEP (2D Gaussian)
    randomCEPOffset(cepMeters) {
      const sigma = this.cepToSigma(cepMeters);
      // Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const r = sigma * Math.sqrt(-2 * Math.log(u1));
      const theta = 2 * Math.PI * u2;
      return { dx: r * Math.cos(theta), dy: r * Math.sin(theta) };
    },

    // ── Velocity & energy ─────────────────────────

    // Mach number from velocity: M = V / a
    machNumber(velocityMs) {
      return velocityMs / this.MACH_1;
    },

    // Velocity from Mach number
    machToVelocity(mach) {
      return mach * this.MACH_1;
    },

    // Kinetic energy: KE = ½mv²
    kineticEnergy(massKg, velocityMs) {
      return 0.5 * massKg * velocityMs * velocityMs;
    },

    // Time to impact estimate (simplified parabolic)
    timeToImpact(distanceM, velocityMs) {
      return distanceM / Math.max(velocityMs, 1);
    },

    // ── NEW: Coriolis Effect ──────────────────────
    // Lateral deflection for ballistic missiles: δ = (V·t²·Ω·sin(φ))/3
    // Returns pixel offset per frame (scaled for sim)
    coriolisDeflection(velocityMs, flightTimeS) {
      const delta = (velocityMs * flightTimeS * flightTimeS * this.OMEGA_EARTH * Math.sin(this.LATITUDE_RAD)) / 3;
      return delta * 0.00001; // scale to pixel space
    },

    // ── NEW: Wind Model ──────────────────────────
    // Wind vector at altitude — jet stream increases with height
    // Returns { wx, wy } in pixel/s
    windAtAltitude(altitudeKm) {
      // Surface: light wind; jet stream at 9-12km
      const baseWind = 0.3;
      const jetStream = altitudeKm > 8 ? 2.0 * Math.exp(-((altitudeKm - 10) ** 2) / 8) : 0;
      const gustNoise = (Math.random() - 0.5) * 0.1;
      return {
        wx: (baseWind + jetStream + gustNoise) * 0.15, // predominantly eastward
        wy: (Math.random() - 0.5) * 0.05 // minor N-S component
      };
    },

    // ── NEW: Thermal / IR Signature ──────────────
    // Aerodynamic heating: T_stag = T_ambient · (1 + (γ-1)/2 · M²)
    // Returns IR intensity factor (0-1 normalized)
    thermalSignature(machNumber, altitudeKm) {
      const Tamb = this.temperatureAtAltitude(altitudeKm);
      const Tstag = Tamb * (1 + ((this.gamma_air - 1) / 2) * machNumber * machNumber);
      // Normalize: room temp = 0, Mach 15 stag = 1
      return Math.min(1.0, Math.max(0, (Tstag - 300) / 8000));
    },

    // ── NEW: Proportional Navigation ─────────────
    // Guidance law: a_cmd = N · V_closing · (dλ/dt)
    // N = navigation constant (typically 3-5)
    // Returns lateral acceleration command
    proportionalNavigation(N, closingVelocity, losRateRadS) {
      return N * closingVelocity * losRateRadS;
    },

    // ── NEW: Radar Horizon Check ─────────────────
    // Returns true if target is above radar horizon
    isAboveRadarHorizon(radarHeightM, targetAltKm, distanceKm) {
      const horizonKm = this.radarHorizon(radarHeightM, targetAltKm * 1000);
      return distanceKm <= horizonKm;
    },

    // ── NEW: Multi-path Clutter Factor ───────────
    // Low-altitude targets suffer from ground-bounce multipath
    // Returns Pk degradation factor (0.3 to 1.0)
    multipathClutterFactor(targetAltKm) {
      if (targetAltKm > 1.0) return 1.0; // above clutter
      if (targetAltKm < 0.05) return 0.3; // severe clutter (nap-of-earth)
      return 0.3 + 0.7 * (targetAltKm / 1.0);
    }
  },

  // ── Offensive Systems ──────────────────────────
  // Data from CSIS Missile Threat, Army Recognition,
  // Wikipedia (verified open-source)

  offensive: {
    shahab1: {
      name: 'Shahab-1',
      designation: 'SRBM',
      natoClass: 'SS-1c Scud-B derivative',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 350,
        speedMach: 5.0,
        speedMs: 1715,
        warheadKg: 985,
        launchMassKg: 5860,
        lengthM: 11.25,
        diameterM: 0.88,
        crossSectionM2: 0.608,    // π·r²
        cepM: 2000,
        apogeeKm: 86,
        burnTimeS: 62,
        rcsM2: 1.5,
        Cd: 0.35,
        propulsion: 'Single-stage liquid fuel',
        guidance: 'Inertial (rudimentary)'
      },
      simParams: {
        color: '#ff6b6b',
        trailColor: '#ff6b6b',
        size: 5,
        ecm: 0.02,
        hasDecoys: false,
        hasChaff: false,
        arcHeightFactor: 0.6,
        maneuverability: 0,
        terminalSpeedMultiplier: 1.4
      }
    },

    shahab3: {
      name: 'Shahab-3/Ghadr',
      designation: 'MRBM',
      natoClass: 'No Dong derivative',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 1300,
        speedMach: 7.0,
        speedMs: 2401,
        warheadKg: 750,
        launchMassKg: 16250,
        lengthM: 15.86,
        diameterM: 1.32,
        crossSectionM2: 1.368,
        cepM: 500,
        apogeeKm: 350,
        burnTimeS: 110,
        rcsM2: 1.2,
        Cd: 0.30,
        propulsion: 'Single-stage liquid fuel',
        guidance: 'Inertial + stellar'
      },
      simParams: {
        color: '#ff4757',
        trailColor: '#ff4757',
        size: 6,
        ecm: 0.08,
        hasDecoys: false,
        hasChaff: true,
        arcHeightFactor: 1.2,
        maneuverability: 0,
        terminalSpeedMultiplier: 1.6
      }
    },

    emad: {
      name: 'Emad',
      designation: 'MRBM (MaRV)',
      natoClass: 'Shahab-3 MaRV variant',
      source: 'CSIS / Iran Press',
      specs: {
        rangeKm: 1700,
        speedMach: 11.0,
        speedMs: 3773,
        warheadKg: 750,
        launchMassKg: 17000,
        lengthM: 15.86,
        diameterM: 1.32,
        crossSectionM2: 1.368,
        cepM: 50,
        apogeeKm: 500,
        burnTimeS: 110,
        rcsM2: 1.0,
        Cd: 0.28,
        propulsion: 'Single-stage liquid fuel',
        guidance: 'Inertial + MaRV terminal guidance'
      },
      simParams: {
        color: '#ff1744',
        trailColor: '#ff1744',
        size: 7,
        ecm: 0.15,
        hasDecoys: true,
        decoyCount: 2,
        hasChaff: true,
        arcHeightFactor: 2.0,
        maneuverability: 0.25,
        terminalSpeedMultiplier: 2.2
      }
    },

    khorramshahr: {
      name: 'Khorramshahr-4',
      designation: 'IRBM (MaRV)',
      natoClass: 'BM-25 derivative',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 2000,
        speedMach: 12.0,
        speedMs: 4116,
        warheadKg: 1500,
        launchMassKg: 26000,
        lengthM: 17.0,
        diameterM: 1.5,
        crossSectionM2: 1.767,
        cepM: 200,
        apogeeKm: 600,
        burnTimeS: 130,
        rcsM2: 1.8,
        Cd: 0.32,
        propulsion: 'Single-stage liquid fuel',
        guidance: 'Inertial + MaRV + stellar'
      },
      simParams: {
        color: '#d63031',
        trailColor: '#d63031',
        size: 9,
        ecm: 0.18,
        hasDecoys: true,
        decoyCount: 3,
        hasChaff: true,
        arcHeightFactor: 2.5,
        maneuverability: 0.2,
        terminalSpeedMultiplier: 2.4
      }
    },

    soumar: {
      name: 'Soumar GLCM',
      designation: 'GLCM',
      natoClass: 'Kh-55 derivative',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 2500,
        speedMach: 0.65,
        speedMs: 223,
        warheadKg: 410,
        launchMassKg: 1700,
        lengthM: 6.04,
        diameterM: 0.514,
        crossSectionM2: 0.207,
        cepM: 35,
        cruiseAltitudeM: 50,
        rcsM2: 0.01,
        Cd: 0.025,
        propulsion: 'Turbofan (R95-300)',
        guidance: 'INS + TERCOM + DSMAC'
      },
      simParams: {
        color: '#ffa502',
        trailColor: '#ffa502',
        size: 5,
        ecm: 0.25,
        hasDecoys: true,
        decoyCount: 1,
        hasChaff: true,
        maneuverability: 0.35,
        cruiseAltitude: 0.12
      }
    },

    shahed136: {
      name: 'Shahed-136',
      designation: 'OWA-UAV',
      natoClass: 'Loitering Munition',
      source: 'Army Recognition / OSINT',
      specs: {
        rangeKm: 2500,
        speedMach: 0.15,
        speedMs: 51,
        warheadKg: 40,
        launchMassKg: 200,
        lengthM: 3.5,
        wingspan: 2.5,
        crossSectionM2: 0.04,
        rcsM2: 0.005,
        Cd: 0.04,
        enduranceHrs: 12,
        propulsion: 'MADO MD-550 piston engine',
        guidance: 'INS + GNSS (GPS/GLONASS)'
      },
      simParams: {
        color: '#ffd32a',
        trailColor: '#ffd32a',
        size: 4,
        ecm: 0.05,
        hasDecoys: false,
        hasChaff: false,
        maneuverability: 0.15,
        swarmCapable: true,
        swarmSize: 5
      }
    },

    mohajer6: {
      name: 'Mohajer-6',
      designation: 'ISR/UCAV',
      natoClass: 'Tactical UAV',
      source: 'OSINT / Army Recognition',
      specs: {
        rangeKm: 200,
        speedMach: 0.16,
        speedMs: 56,
        warheadKg: 0,
        payloadKg: 40,
        launchMassKg: 670,
        lengthM: 5.7,
        wingspan: 10.0,
        crossSectionM2: 0.3,
        rcsM2: 0.1,
        Cd: 0.035,
        enduranceHrs: 12,
        ceilingM: 5486,
        propulsion: 'Rotax 912 piston',
        guidance: 'GPS + data link'
      },
      simParams: {
        color: '#70a1ff',
        trailColor: '#70a1ff44',
        size: 4,
        ecm: 0.3,
        hasDecoys: false,
        hasChaff: false,
        maneuverability: 0.08,
        scanRadius: 140,
        orbitRadius: 65
      }
    },

    // ── NEW Offensive Systems ──────────────────────

    fateh110: {
      name: 'Fateh-110',
      designation: 'Precision SRBM',
      natoClass: 'CSS-8 derivative',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 300,
        speedMach: 3.0,
        speedMs: 1029,
        warheadKg: 450,
        launchMassKg: 3545,
        lengthM: 8.86,
        diameterM: 0.61,
        crossSectionM2: 0.292,
        cepM: 100,
        apogeeKm: 50,
        burnTimeS: 30,
        rcsM2: 0.8,
        Cd: 0.30,
        propulsion: 'Single-stage solid fuel',
        guidance: 'INS + GPS + electro-optical'
      },
      simParams: {
        color: '#e84393',
        trailColor: '#e84393',
        size: 5,
        ecm: 0.05,
        hasDecoys: false,
        hasChaff: false,
        arcHeightFactor: 0.4,
        maneuverability: 0.1,
        terminalSpeedMultiplier: 1.2
      }
    },

    paveh: {
      name: 'Paveh ALCM',
      designation: 'ALCM',
      natoClass: 'Air-Launched Cruise Missile',
      source: 'OSINT / Iran MODAFL',
      specs: {
        rangeKm: 1650,
        speedMach: 0.7,
        speedMs: 240,
        warheadKg: 350,
        launchMassKg: 1300,
        lengthM: 5.5,
        diameterM: 0.48,
        crossSectionM2: 0.181,
        cepM: 25,
        cruiseAltitudeM: 30,
        rcsM2: 0.008,
        Cd: 0.022,
        propulsion: 'Toloue-10 Turbofan',
        guidance: 'INS + TERCOM + terminal IR'
      },
      simParams: {
        color: '#fd79a8',
        trailColor: '#fd79a8',
        size: 4,
        ecm: 0.30,
        hasDecoys: true,
        decoyCount: 2,
        hasChaff: true,
        maneuverability: 0.40,
        cruiseAltitude: 0.08
      }
    },

    arash2: {
      name: 'Arash-2',
      designation: 'Heavy OWA',
      natoClass: 'Attack UAV',
      source: 'OSINT / IRGC',
      specs: {
        rangeKm: 2000,
        speedMach: 0.30,
        speedMs: 103,
        warheadKg: 50,
        launchMassKg: 290,
        lengthM: 4.0,
        wingspan: 3.2,
        crossSectionM2: 0.06,
        rcsM2: 0.008,
        Cd: 0.035,
        enduranceHrs: 10,
        propulsion: 'Jet engine (micro-turbojet)',
        guidance: 'INS + GNSS + terminal imaging'
      },
      simParams: {
        color: '#f39c12',
        trailColor: '#f39c12',
        size: 4,
        ecm: 0.08,
        hasDecoys: false,
        hasChaff: false,
        maneuverability: 0.20,
        swarmCapable: true,
        swarmSize: 3
      }
    },

    sejjil2: {
      name: 'Sejjil-2',
      designation: 'Solid MRBM',
      natoClass: 'Two-stage solid-fuel',
      source: 'CSIS Missile Threat',
      specs: {
        rangeKm: 2000,
        speedMach: 14.0,
        speedMs: 4802,
        warheadKg: 750,
        launchMassKg: 23600,
        lengthM: 17.6,
        diameterM: 1.25,
        crossSectionM2: 1.227,
        cepM: 250,
        apogeeKm: 550,
        burnTimeS: 85,
        rcsM2: 1.1,
        Cd: 0.28,
        propulsion: 'Two-stage solid fuel',
        guidance: 'Inertial + stellar'
      },
      simParams: {
        color: '#c0392b',
        trailColor: '#c0392b',
        size: 8,
        ecm: 0.10,
        hasDecoys: true,
        decoyCount: 1,
        hasChaff: true,
        arcHeightFactor: 2.2,
        maneuverability: 0.05,
        terminalSpeedMultiplier: 2.6
      }
    },

    fattah1: {
      name: 'Fattah-1',
      designation: 'Hypersonic MaRV',
      natoClass: 'HGV-equipped MRBM',
      source: 'CSIS / Iran Press',
      specs: {
        rangeKm: 1400,
        speedMach: 15.0,
        speedMs: 5145,
        warheadKg: 500,
        launchMassKg: 19000,
        lengthM: 16.0,
        diameterM: 1.35,
        crossSectionM2: 1.431,
        cepM: 30,
        apogeeKm: 450,
        burnTimeS: 75,
        rcsM2: 0.3,
        Cd: 0.22,
        propulsion: 'Solid-fuel booster + HGV',
        guidance: 'INS + MaRV + active seeker'
      },
      simParams: {
        color: '#e74c3c',
        trailColor: '#ff0044',
        size: 7,
        ecm: 0.20,
        hasDecoys: true,
        decoyCount: 3,
        hasChaff: true,
        arcHeightFactor: 1.8,
        maneuverability: 0.45,
        terminalSpeedMultiplier: 3.0,
        isHypersonic: true
      }
    }
  },

  // ── Defensive Systems ──────────────────────────

  defensive: {
    torM1: {
      name: 'Tor-M1',
      designation: 'SA-15 Gauntlet',
      natoCode: 'SA-15',
      source: 'Wikipedia / Army Recognition',
      specs: {
        typeClass: 'SR-SAM',
        maxRangeKm: 12,
        minRangeKm: 1,
        maxAltitudeM: 6000,
        minAltitudeM: 10,
        missileName: '9M331',
        missileSpeedMach: 2.8,
        missileSpeedMs: 960,
        pkAircraft: { min: 0.26, max: 0.80 },
        pkCruise: { min: 0.45, max: 0.99 },
        pkHelicopter: { min: 0.50, max: 0.98 },
        simultaneousTargets: 2,
        reactionTimeS: 7.4,
        missileCount: 8,
        reloadTimeMin: 18,
        radarRangeKm: 25,
        radarType: 'Phased array (pulse-Doppler)'
      },
      simParams: {
        color: '#00d2d3',
        size: 10,
        detectionRange: 145,
        interceptionRange: 115,
        basePk: 0.72,
        cooldown: 1.8,
        ammo: 8,
        salvoSize: 1,
        radarSpeed: 2.0,
        reactionTime: 0.4,
        killAssessmentTime: 0.3
      }
    },

    bavar373: {
      name: 'Bavar-373',
      designation: 'Sayyad-4',
      natoCode: 'Indigenous LR-SAM',
      source: 'OSINT / Iran MODAFL',
      specs: {
        typeClass: 'LR-SAM',
        maxRangeKm: 300,
        minRangeKm: 3,
        maxAltitudeM: 27000,
        minAltitudeM: 50,
        missileName: 'Sayyad-4B',
        missileSpeedMach: 4.8,
        missileSpeedMs: 1646,
        pkAircraft: { min: 0.70, max: 0.90 },
        pkCruise: { min: 0.55, max: 0.75 },
        pkTBM: { min: 0.40, max: 0.60 },
        simultaneousTargets: 6,
        reactionTimeS: 12,
        missileCount: 4,
        reloadTimeMin: 25,
        radarRangeKm: 450,
        radarType: 'Meraj-4 PESA'
      },
      simParams: {
        color: '#0abde3',
        size: 12,
        detectionRange: 270,
        interceptionRange: 220,
        basePk: 0.65,
        cooldown: 3.0,
        ammo: 4,
        salvoSize: 2,
        radarSpeed: 1.2,
        reactionTime: 0.7,
        killAssessmentTime: 0.6
      }
    },

    s300pmu2: {
      name: 'S-300PMU-2',
      designation: 'SA-20B Gargoyle',
      natoCode: 'SA-20B',
      source: 'Army Recognition / CSIS',
      specs: {
        typeClass: 'LR-SAM / ABM',
        maxRangeKm: 200,
        minRangeKm: 3,
        maxAltitudeM: 27000,
        minAltitudeM: 25,
        missileName: '48N6E2',
        missileSpeedMach: 6.0,
        missileSpeedMs: 2058,
        pkAircraft: { min: 0.80, max: 0.93 },
        pkCruise: { min: 0.40, max: 0.85 },
        pkTBM: { min: 0.50, max: 0.77 },
        simultaneousTargets: 6,
        reactionTimeS: 10,
        missileCount: 8,
        reloadTimeMin: 20,
        radarType: '30N6E2 Tomb Stone (PESA)'
      },
      simParams: {
        color: '#54a0ff',
        size: 14,
        detectionRange: 490,
        interceptionRange: 410,
        basePk: 0.56,
        cooldown: 4.5,
        ammo: 8,
        salvoSize: 2,
        radarSpeed: 1.0,
        reactionTime: 1.0,
        killAssessmentTime: 0.8
      }
    },

    phalanxCIWS: {
      name: 'Phalanx CIWS',
      designation: 'Mk 15',
      natoCode: 'CIWS',
      source: 'General Dynamics',
      specs: {
        typeClass: 'CIWS',
        maxRangeKm: 3.6,
        minRangeKm: 0.2,
        maxAltitudeM: 4800,
        minAltitudeM: 0,
        weaponType: 'M61A1 Vulcan 20mm',
        rateOfFire: 4500,
        muzzleVelocityMs: 1100,
        pkIncoming: { min: 0.7, max: 0.95 },
        ammoCapacity: 1550,
        reactionTimeS: 2,
        radarType: 'Ku-band pulse-Doppler'
      },
      simParams: {
        color: '#ff9ff3',
        size: 8,
        detectionRange: 68,
        interceptionRange: 50,
        basePk: 0.85,
        cooldown: 0.35,
        ammo: 120,
        salvoSize: 1,
        radarSpeed: 4.0,
        reactionTime: 0.12,
        killAssessmentTime: 0.1
      }
    },

    f14am: {
      name: 'F-14AM Tomcat',
      designation: 'Fighter Interceptor',
      natoCode: 'Fighter',
      source: 'OSINT / IRIAF',
      specs: {
        typeClass: 'Fighter-Interceptor',
        maxRangeKm: 180,
        combatRadiusKm: 926,
        maxSpeedMach: 2.34,
        maxSpeedMs: 802,
        missileTypes: ['AIM-54A Phoenix', 'AIM-7 Sparrow', 'AIM-9 Sidewinder'],
        pkAAM: { min: 0.55, max: 0.75 },
        missileCount: 6,
        radarType: 'AN/AWG-9 (upgraded)',
        radarRangeKm: 315
      },
      simParams: {
        color: '#5f27cd',
        size: 11,
        detectionRange: 390,
        interceptionRange: 330,
        basePk: 0.60,
        cooldown: 3.5,
        ammo: 6,
        salvoSize: 2,
        radarSpeed: 1.2,
        reactionTime: 0.8,
        killAssessmentTime: 0.4,
        canEngage: ['cruise', 'kamikaze_drone', 'recon_drone', 'alcm', 'heavy_drone']
      }
    },

    // ── NEW Defensive Systems ──────────────────────

    khordad15: {
      name: 'Khordad-15',
      designation: '3rd Khordad MR-SAM',
      natoCode: 'Indigenous MR-SAM',
      source: 'OSINT / IRGC',
      specs: {
        typeClass: 'MR-SAM',
        maxRangeKm: 75,
        minRangeKm: 2,
        maxAltitudeM: 27000,
        minAltitudeM: 30,
        missileName: 'Sayyad-3',
        missileSpeedMach: 4.5,
        missileSpeedMs: 1543,
        pkAircraft: { min: 0.70, max: 0.90 },
        pkCruise: { min: 0.60, max: 0.80 },
        pkTBM: { min: 0.30, max: 0.50 },
        simultaneousTargets: 4,
        reactionTimeS: 8,
        missileCount: 6,
        reloadTimeMin: 15,
        radarRangeKm: 150,
        radarType: 'Bashir 3D PESA (stealth detection)'
      },
      simParams: {
        color: '#00b894',
        size: 11,
        detectionRange: 200,
        interceptionRange: 160,
        basePk: 0.70,
        cooldown: 2.2,
        ammo: 6,
        salvoSize: 1,
        radarSpeed: 1.8,
        reactionTime: 0.5,
        killAssessmentTime: 0.4,
        stealthBonus: 0.15
      }
    },

    pantsirS1: {
      name: 'Pantsir-S1',
      designation: 'SA-22 Greyhound',
      natoCode: 'SA-22',
      source: 'Army Recognition / CSIS',
      specs: {
        typeClass: 'SHORAD (Gun+Missile)',
        maxRangeKm: 20,
        minRangeKm: 0.2,
        maxAltitudeM: 15000,
        minAltitudeM: 5,
        missileName: '57E6',
        missileSpeedMach: 3.5,
        missileSpeedMs: 1300,
        gunType: '2A38M 30mm twin autocannon',
        gunRateOfFire: 5000,
        gunRangeKm: 4,
        pkAircraft: { min: 0.55, max: 0.85 },
        pkCruise: { min: 0.70, max: 0.95 },
        pkUAV: { min: 0.80, max: 0.95 },
        simultaneousTargets: 4,
        reactionTimeS: 4,
        missileCount: 12,
        reloadTimeMin: 12,
        radarRangeKm: 36,
        radarType: '1RS1-1E PESA + EO/IR'
      },
      simParams: {
        color: '#6c5ce7',
        size: 9,
        detectionRange: 120,
        interceptionRange: 95,
        basePk: 0.78,
        cooldown: 1.0,
        ammo: 12,
        salvoSize: 1,
        radarSpeed: 2.5,
        reactionTime: 0.25,
        killAssessmentTime: 0.2,
        hasGunMode: true,
        gunRange: 40
      }
    },

    ironDome: {
      name: 'Iron Dome',
      designation: 'Tamir C-RAM',
      natoCode: 'C-RAM',
      source: 'Rafael / CSIS',
      specs: {
        typeClass: 'C-RAM / VSHORAD',
        maxRangeKm: 70,
        minRangeKm: 4,
        maxAltitudeM: 10000,
        minAltitudeM: 30,
        missileName: 'Tamir',
        missileSpeedMach: 2.2,
        missileSpeedMs: 750,
        pkRocket: { min: 0.85, max: 0.95 },
        pkCruise: { min: 0.60, max: 0.80 },
        pkUAV: { min: 0.70, max: 0.90 },
        simultaneousTargets: 6,
        reactionTimeS: 3,
        missileCount: 20,
        reloadTimeMin: 10,
        radarRangeKm: 100,
        radarType: 'EL/M-2084 AESA'
      },
      simParams: {
        color: '#00cec9',
        size: 10,
        detectionRange: 180,
        interceptionRange: 140,
        basePk: 0.82,
        cooldown: 1.2,
        ammo: 20,
        salvoSize: 2,
        radarSpeed: 2.2,
        reactionTime: 0.2,
        killAssessmentTime: 0.25,
        smartFilter: true
      }
    },

    thaad: {
      name: 'THAAD',
      designation: 'Terminal High Altitude',
      natoCode: 'Exo-ATM ABM',
      source: 'Lockheed Martin / CSIS',
      specs: {
        typeClass: 'Exo-atmospheric ABM',
        maxRangeKm: 200,
        minRangeKm: 20,
        maxAltitudeM: 150000,
        minAltitudeM: 40000,
        missileName: 'THAAD Interceptor',
        missileSpeedMach: 8.24,
        missileSpeedMs: 2826,
        pkTBM: { min: 0.75, max: 0.95 },
        pkIRBM: { min: 0.60, max: 0.85 },
        simultaneousTargets: 4,
        reactionTimeS: 15,
        missileCount: 8,
        reloadTimeMin: 30,
        radarRangeKm: 1000,
        radarType: 'AN/TPY-2 AESA (X-band)'
      },
      simParams: {
        color: '#fdcb6e',
        size: 13,
        detectionRange: 500,
        interceptionRange: 380,
        basePk: 0.80,
        cooldown: 5.0,
        ammo: 8,
        salvoSize: 1,
        radarSpeed: 0.8,
        reactionTime: 1.2,
        killAssessmentTime: 1.0,
        exoAtmospheric: true,
        canEngage: ['ballistic_medium', 'ballistic_long', 'ballistic_irbm', 'hypersonic', 'solid_mrbm']
      }
    },

    ewJammer: {
      name: 'EW Jammer Station',
      designation: 'Electronic Warfare',
      natoCode: 'EW',
      source: 'OSINT',
      specs: {
        typeClass: 'Electronic Warfare',
        maxRangeKm: 150,
        jammingPowerW: 50000,
        frequencyBands: 'L/S/C/X/Ku',
        degradationPercent: 35,
        radarType: 'Wideband ESM + Active Jammer'
      },
      simParams: {
        color: '#a29bfe',
        size: 10,
        detectionRange: 250,
        interceptionRange: 0,
        basePk: 0,
        cooldown: 0,
        ammo: Infinity,
        salvoSize: 0,
        radarSpeed: 3.0,
        reactionTime: 0,
        killAssessmentTime: 0,
        isEW: true,
        jamRadius: 200,
        guidanceDegradation: 0.35
      }
    }
  },

  // ── Helper: Format specs for display ───────────
  formatSpec(system) {
    const s = system.specs;
    const lines = [];
    lines.push(`${system.name} [${system.designation}]`);
    lines.push(`Source: ${system.source}`);
    if (s.rangeKm) lines.push(`Range: ${s.rangeKm.toLocaleString()} km`);
    if (s.maxRangeKm) lines.push(`Engagement: ${s.minRangeKm}-${s.maxRangeKm} km`);
    if (s.speedMach) lines.push(`Speed: Mach ${s.speedMach} (${s.speedMs.toLocaleString()} m/s)`);
    if (s.warheadKg) lines.push(`Warhead: ${s.warheadKg} kg`);
    if (s.cepM) lines.push(`CEP: ${s.cepM.toLocaleString()} m`);
    if (s.rcsM2 !== undefined) lines.push(`RCS: ${s.rcsM2} m²`);
    if (s.apogeeKm) lines.push(`Apogee: ${s.apogeeKm} km`);
    if (s.Cd) lines.push(`Cd: ${s.Cd}`);
    if (s.launchMassKg) lines.push(`Mass: ${s.launchMassKg.toLocaleString()} kg`);
    if (s.propulsion) lines.push(`Propulsion: ${s.propulsion}`);
    if (s.guidance) lines.push(`Guidance: ${s.guidance}`);
    if (s.pkAircraft) lines.push(`Pk(aircraft): ${(s.pkAircraft.min*100).toFixed(0)}-${(s.pkAircraft.max*100).toFixed(0)}%`);
    if (s.pkCruise) lines.push(`Pk(cruise): ${(s.pkCruise.min*100).toFixed(0)}-${(s.pkCruise.max*100).toFixed(0)}%`);
    if (s.pkTBM) lines.push(`Pk(TBM): ${(s.pkTBM.min*100).toFixed(0)}-${(s.pkTBM.max*100).toFixed(0)}%`);
    if (s.pkRocket) lines.push(`Pk(RAM): ${(s.pkRocket.min*100).toFixed(0)}-${(s.pkRocket.max*100).toFixed(0)}%`);
    if (s.pkUAV) lines.push(`Pk(UAV): ${(s.pkUAV.min*100).toFixed(0)}-${(s.pkUAV.max*100).toFixed(0)}%`);
    if (s.pkIRBM) lines.push(`Pk(IRBM): ${(s.pkIRBM.min*100).toFixed(0)}-${(s.pkIRBM.max*100).toFixed(0)}%`);
    if (s.missileCount) lines.push(`Ready missiles: ${s.missileCount}`);
    if (s.ammoCapacity) lines.push(`Ammo: ${s.ammoCapacity.toLocaleString()} rds`);
    if (s.gunType) lines.push(`Gun: ${s.gunType}`);
    if (s.jammingPowerW) lines.push(`Jamming: ${(s.jammingPowerW/1000).toFixed(0)} kW`);
    if (s.degradationPercent) lines.push(`Degradation: ${s.degradationPercent}%`);
    if (s.radarType) lines.push(`Radar: ${s.radarType}`);
    return lines;
  }
};

if (typeof window !== 'undefined') {
  window.WeaponsDB = WeaponsDB;
}
