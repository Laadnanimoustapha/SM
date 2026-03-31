"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Simulation } from '@/lib/game/simulation';
import { Renderer } from '@/lib/game/renderer';
import type { WeaponData, SimulationState } from '@/types/game';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const rendererRef = useRef<Renderer | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  
  // Stats state (throttled updates)
  const [stats, setStats] = useState<any>({
    totalLaunched: 0,
    totalIntercepted: 0,
    totalGotThrough: 0,
    defenseShotsFired: 0,
    salvosFired: 0,
    ecmJams: 0,
    chaffDeployed: 0,
    waveNumber: 0,
    avgPk: 0,
    totalWarheadKg: 0
  });

  const [logs, setLogs] = useState<{ id: number, time: string, message: string, color: string, type: string }[]>([]);
  const [weapons, setWeapons] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'offensive' | 'defensive'>('offensive');

  let logIdCounter = 0;

  // Fetch weapons database
  useEffect(() => {
    fetch('/api/weapons')
      .then(res => res.json())
      .then(data => {
        setWeapons(data);
        // Bind to global window for simulation.ts if strictly required, 
        // though we refactored it to use local imports 
        (window as any).WeaponsDB = data;
      })
      .catch(err => console.error("Failed to load Weapons DB:", err));
  }, []);

  // Initialize Canvas and Game Engine
  useEffect(() => {
    if (!canvasRef.current || !weapons) return;
    
    const canvas = canvasRef.current;
    canvas.width = 900;
    canvas.height = 650;
    
    const dpr = window.devicePixelRatio || 1;
    if (dpr > 1) {
      canvas.style.width = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
      canvas.width *= dpr;
      canvas.height *= dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }

    const sim = new Simulation();
    sim.canvasWidth = 900;
    sim.canvasHeight = 650;
    sim.reset();
    
    // Wire up events to React state
    sim.onEvent = (evt: any) => {
      setLogs(prev => {
        const newLogs = [{ id: logIdCounter++, ...evt }, ...prev];
        return newLogs.slice(0, 50); // Keep last 50
      });
    };
    
    sim.onStatsUpdate = (newStats: any) => {
      setStats({ ...newStats });
    };

    simRef.current = sim;
    rendererRef.current = new Renderer(canvas);

    let lastTime = 0;
    let animationId: number;

    const gameLoop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      sim.update(dt);
      rendererRef.current?.render(sim);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame((timestamp) => {
      lastTime = timestamp;
      gameLoop(timestamp);
    });

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [weapons]);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          sim.toggle();
          setIsRunning(sim.running);
          setIsPaused(!sim.running && sim.wave > 0);
          break;
        case 'r':
          sim.reset();
          setLogs([]);
          setIsRunning(false);
          setIsPaused(false);
          setStats(sim.stats);
          break;
        case 'w':
          if (sim.running) sim.launchWave();
          break;
        case '1': sim.speedMultiplier = 1; setSpeedMultiplier(1); break;
        case '2': sim.speedMultiplier = 2; setSpeedMultiplier(2); break;
        case '3': sim.speedMultiplier = 4; setSpeedMultiplier(4); break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStart = () => {
    simRef.current?.start();
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    simRef.current?.pause();
    setIsRunning(false);
    setIsPaused(true);
  };

  const handleReset = () => {
    simRef.current?.reset();
    setLogs([]);
    setIsRunning(false);
    setIsPaused(false);
    if (simRef.current) setStats(simRef.current.stats);
  };

  const handleWave = () => {
    if (simRef.current?.running) simRef.current.launchWave();
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSpeedMultiplier(val);
    if (simRef.current) simRef.current.speedMultiplier = val;
  };

  const activeDefenders = simRef.current ? simRef.current.defenders.filter((d: any) => d.alive).length : 0;
  const totalDefenders = simRef.current ? simRef.current.defenders.length : 0;
  
  const successRate = stats.totalLaunched > 0 ? ((stats.totalIntercepted / stats.totalLaunched) * 100).toFixed(1) : '0.0';

  if (!weapons) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#00cc66', fontFamily: 'JetBrains Mono' }}>Establishing datalink to Weapons Database...</div>;
  }

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
          <div className={`header-status ${isRunning ? 'active' : ''}`}>
            {isRunning ? 'ACTIVE' : isPaused ? 'PAUSED' : 'STANDBY'}
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-section">
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} id="sim-canvas"></canvas>
          </div>

          <div className="controls-bar">
            <div className="controls-group">
              <button 
                onClick={handleStart} 
                disabled={isRunning} 
                className={`ctrl-btn ctrl-start ${!isRunning && stats.waveNumber === 0 ? 'active' : ''}`} 
                title="Start (Space)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <span>Start</span>
              </button>
              <button 
                onClick={handlePause} 
                disabled={!isRunning} 
                className={`ctrl-btn ctrl-pause ${isRunning ? 'active' : ''}`} 
                title="Pause (Space)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span>Pause</span>
              </button>
              <button onClick={handleReset} className="ctrl-btn ctrl-reset" title="Reset (R)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                <span>Reset</span>
              </button>
            </div>

            <div className="controls-divider"></div>

            <div className="controls-group">
              <button onClick={handleWave} disabled={!isRunning} className="ctrl-btn ctrl-wave" title="Launch Wave (W)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                <span>Launch Wave</span>
              </button>
            </div>

            <div className="controls-divider"></div>

            <div className="controls-group speed-group">
              <label htmlFor="speed-slider">SPD</label>
              <input 
                type="range" 
                id="speed-slider" 
                min="0.5" max="4" step="0.5" 
                value={speedMultiplier} 
                onChange={handleSpeedChange} 
              />
              <span className="speed-value">{speedMultiplier}×</span>
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
                <div className="stat-value">{stats.waveNumber}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Threats</div>
                <div className="stat-value">{stats.totalLaunched}</div>
              </div>
              <div className="stat-card stat-card-success">
                <div className="stat-label">Kills</div>
                <div className="stat-value">{stats.totalIntercepted}</div>
                <div className="stat-bar"><div className="stat-bar-fill bar-green" style={{ width: `${stats.totalLaunched ? (stats.totalIntercepted / stats.totalLaunched)*100 : 0}%` }}></div></div>
              </div>
              <div className="stat-card stat-card-danger">
                <div className="stat-label">Leakers</div>
                <div className="stat-value">{stats.totalGotThrough}</div>
                <div className="stat-bar"><div className="stat-bar-fill bar-red" style={{ width: `${stats.totalLaunched ? (stats.totalGotThrough / stats.totalLaunched)*100 : 0}%` }}></div></div>
              </div>
              <div className="stat-card stat-card-highlight">
                <div className="stat-label">Kill Rate (Pk)</div>
                <div className="stat-value stat-value-lg" style={{ color: parseFloat(successRate) >= 70 ? '#00ff66' : parseFloat(successRate) >= 40 ? '#ffa502' : '#ff4757' }}>{successRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">SSKP (avg)</div>
                <div className="stat-value" style={{ color: stats.avgPk >= 0.6 ? '#00ff66' : stats.avgPk >= 0.3 ? '#ffa502' : '#ff4757' }}>
                  {stats.avgPk > 0 ? (stats.avgPk * 100).toFixed(1) + '%' : '—'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Engagements</div>
                <div className="stat-value">{stats.defenseShotsFired}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Salvos</div>
                <div className="stat-value">{stats.salvosFired}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">ECM Jams</div>
                <div className="stat-value">{stats.ecmJams}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Chaff</div>
                <div className="stat-value">{stats.chaffDeployed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Batteries</div>
                <div className="stat-value">{activeDefenders}/{totalDefenders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">W/H Total</div>
                <div className="stat-value">{stats.totalWarheadKg >= 1000 ? (stats.totalWarheadKg / 1000).toFixed(1) + ' t' : stats.totalWarheadKg + ' kg'}</div>
              </div>
            </div>
          </div>

          <div className="panel weapons-panel">
            <h2 className="panel-title panel-title-collapsible">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              Weapons Database
            </h2>
            <div className="weapons-content">
              <div className="weapons-tabs">
                <button className={`weapons-tab ${activeTab === 'offensive' ? 'active' : ''}`} onClick={() => setActiveTab('offensive')}>OFFENSIVE</button>
                <button className={`weapons-tab ${activeTab === 'defensive' ? 'active' : ''}`} onClick={() => setActiveTab('defensive')}>DEFENSIVE</button>
              </div>
              <div className="weapons-list">
                {Object.keys(weapons[activeTab] || {}).map(key => {
                  const sys = weapons[activeTab][key];
                  return (
                    <div key={key} className="weapon-card">
                      <div className="weapon-card-header">
                        <span className="weapon-name">{sys.name}</span>
                        <span className="weapon-designation">{sys.designation}</span>
                      </div>
                      <div className="weapon-specs">
                        <div className="weapon-spec-row">
                          <span className="weapon-spec-label">Class</span>
                          <span className="weapon-spec-value">{sys.natoClass || sys.specs?.typeClass}</span>
                        </div>
                        <div className="weapon-spec-row">
                          <span className="weapon-spec-label">Range</span>
                          <span className="weapon-spec-value">{sys.specs.rangeKm || sys.specs.maxRangeKm} km</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="panel log-panel">
            <h2 className="panel-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z"/></svg>
              Battle Log
            </h2>
            <div className="event-log">
              {logs.map(log => (
                <div key={log.id} className={`log-entry visible log-${log.type}`}>
                  <span className="log-time">[T+{log.time}]</span>
                  <span className="log-msg" style={{color: log.color}}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}
