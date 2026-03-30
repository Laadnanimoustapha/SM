export default function Home() {
  return (
    <>
      <header className="app-header">
        <div className="header-brand">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <h1>SKYSHIELD</h1>
          <span className="header-subtitle">Integrated Air Defense Simulator</span>
        </div>
        <div className="header-meta">
          <div className="header-badge">OPEN-SOURCE DATA • SIMULATION</div>
          <div className="header-status" id="sim-status">STANDBY</div>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-section">
          <div className="canvas-wrapper">
            <canvas id="sim-canvas"></canvas>
          </div>

          <div className="controls-bar">
            <div className="controls-group">
              <button id="btn-start" className="ctrl-btn ctrl-start" title="Start (Space)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <span>Start</span>
              </button>
              <button id="btn-pause" className="ctrl-btn ctrl-pause" disabled title="Pause (Space)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span>Pause</span>
              </button>
              <button id="btn-reset" className="ctrl-btn ctrl-reset" title="Reset (R)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                <span>Reset</span>
              </button>
            </div>

            <div className="controls-divider"></div>

            <div className="controls-group">
              <button id="btn-wave" className="ctrl-btn ctrl-wave" disabled title="Launch Wave (W)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                <span>Launch Wave</span>
              </button>
            </div>

            <div className="controls-divider"></div>

            <div className="controls-group speed-group">
              <label htmlFor="speed-slider">SPD</label>
              <input type="range" id="speed-slider" min="0.5" max="4" step="0.5" defaultValue="1" />
              <span id="speed-value" className="speed-value">1×</span>
            </div>

            <div className="controls-shortcuts">
              <kbd>SPACE</kbd> Play/Pause
              <kbd>R</kbd> Reset
              <kbd>W</kbd> Wave
              <kbd>1-3</kbd> Speed
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <div className="panel stats-panel">
            <h2 className="panel-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
              Battle Assessment
            </h2>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Wave</div>
                <div className="stat-value" id="stat-wave">0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Threats</div>
                <div className="stat-value" id="stat-launched">0</div>
              </div>
              <div className="stat-card stat-card-success">
                <div className="stat-label">Kills</div>
                <div className="stat-value" id="stat-intercepted">0</div>
                <div className="stat-bar"><div className="stat-bar-fill bar-green" id="bar-intercepted"></div></div>
              </div>
              <div className="stat-card stat-card-danger">
                <div className="stat-label">Leakers</div>
                <div className="stat-value" id="stat-gotthrough">0</div>
                <div className="stat-bar"><div className="stat-bar-fill bar-red" id="bar-gotthrough"></div></div>
              </div>
              <div className="stat-card stat-card-highlight">
                <div className="stat-label">Kill Rate (Pk)</div>
                <div className="stat-value stat-value-lg" id="stat-successrate">0.0%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">SSKP (avg)</div>
                <div className="stat-value" id="stat-sskp">—</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Engagements</div>
                <div className="stat-value" id="stat-shots">0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Salvos</div>
                <div className="stat-value" id="stat-salvos">0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">ECM Jams</div>
                <div className="stat-value" id="stat-ecm">0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Chaff</div>
                <div className="stat-value" id="stat-chaff">0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Batteries</div>
                <div className="stat-value" id="stat-defenders">0/0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">W/H Total</div>
                <div className="stat-value" id="stat-warhead">0 kg</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">EW Jams</div>
                <div className="stat-value" id="stat-ew" style={{color:"#a29bfe"}}>0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">IR Detect</div>
                <div className="stat-value" id="stat-ir" style={{color:"#ff9966"}}>0</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Blast (kg)</div>
                <div className="stat-value" id="stat-blast" style={{color:"#ff6348"}}>0</div>
              </div>
            </div>
          </div>

          <div className="panel weapons-panel">
            <h2 className="panel-title panel-title-collapsible" id="weapons-toggle">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              Weapons Database
              <span className="panel-toggle-icon">▼</span>
            </h2>
            <div className="weapons-content" id="weapons-content">
              <div className="weapons-tabs">
                <button className="weapons-tab active" data-tab="offensive">OFFENSIVE</button>
                <button className="weapons-tab" data-tab="defensive">DEFENSIVE</button>
              </div>
              <div className="weapons-list" id="weapons-list"></div>
            </div>
          </div>

          <div className="panel legend-panel">
            <h2 className="panel-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
              Threat Classification
            </h2>
            <div className="legend-grid">
              <div className="legend-section-label">OFFENSIVE ◇ HOSTILE</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ff6b6b"}}></span>Shahab-1 (SRBM) — Mach 5</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ff4757"}}></span>Shahab-3 (MRBM) — Mach 7</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ff1744"}}></span>Emad (MaRV) — Mach 11</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#d63031"}}></span>Khorramshahr-4 (IRBM) — Mach 12</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#e84393"}}></span>Fateh-110 (Precision SRBM) — Mach 3</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#c0392b"}}></span>Sejjil-2 (Solid MRBM) — Mach 14</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#e74c3c"}}></span>⚡ Fattah-1 (HGV) — Mach 15</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ffa502"}}></span>Soumar GLCM — RCS 0.01m²</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#fd79a8"}}></span>Paveh ALCM — RCS 0.008m²</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#70a1ff"}}></span>Mohajer-6 (ISR UAV)</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ffd32a"}}></span>Shahed-136 (OWA) — RCS 0.005m²</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#f39c12"}}></span>Arash-2 (Heavy OWA) — Jet-powered</div>
              <div className="legend-divider"></div>
              <div className="legend-section-label">DEFENSIVE □ FRIENDLY</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#fdcb6e"}}></span>THAAD (ABM) — 200km exo-atm</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#54a0ff"}}></span>S-300PMU-2 (SA-20B) — 200km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#0abde3"}}></span>Bavar-373 (Sayyad-4) — 300km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#00b894"}}></span>Khordad-15 (Stealth-hunter) — 75km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#00cec9"}}></span>Iron Dome (C-RAM) — 70km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#00d2d3"}}></span>Tor-M1 (SA-15) — 12km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#6c5ce7"}}></span>Pantsir-S1 (Gun+Missile) — 20km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#ff9ff3"}}></span>Phalanx CIWS (Mk 15) — 3.6km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#5f27cd"}}></span>F-14AM (AIM-54) — 180km</div>
              <div className="legend-item"><span className="legend-dot" style={{background:"#a29bfe"}}></span>EW Jammer (Non-kinetic) — 150km</div>
              <div className="legend-divider"></div>
              <div className="legend-section-label">PHYSICS MODELS</div>
              <div className="legend-item" style={{fontSize:"8px", opacity:0.6}}>Coriolis drift • Wind vectors • Thermal IR</div>
              <div className="legend-item" style={{fontSize:"8px", opacity:0.6}}>Radar horizon • Doppler clutter • Blast radius</div>
              <div className="legend-item" style={{fontSize:"8px", opacity:0.6}}>Proportional nav • Engagement geometry</div>
            </div>
          </div>

          <div className="panel log-panel">
            <h2 className="panel-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z"/></svg>
              Battle Log
            </h2>
            <div className="event-log" id="event-log">
              <div className="log-entry visible">
                <span className="log-time">[T+0.0]</span>
                <span className="log-msg" style={{color: "#00cc66"}}>All defense batteries online. ROE: WEAPONS FREE</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}
