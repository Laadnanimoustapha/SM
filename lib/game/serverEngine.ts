import { Simulation } from './simulation';

// Define a global wrapper to persist the simulation instance across Next.js API hot-reloads
const globalForSimulation = global as unknown as {
  simulationInstance: Simulation | null;
  simulationLoop: NodeJS.Timeout | null;
};

// Initialize the global simulation instance if it does not exist
if (!globalForSimulation.simulationInstance) {
  globalForSimulation.simulationInstance = new Simulation();
}

export const getSimulation = () => {
  return globalForSimulation.simulationInstance as Simulation;
};

// Start the continuous server-side physics loop
export const startServerPhysicsLoop = (fps: number = 30) => {
  if (globalForSimulation.simulationLoop) {
    return; // Already running
  }

  const intervalMs = 1000 / fps;
  let lastTime = Date.now();

  console.log(`[SKYSHIELD-ENGINE] Server physics loop started at ${fps} FPS`);

  globalForSimulation.simulationLoop = setInterval(() => {
    const sim = getSimulation();
    if (sim.running) {
      const now = Date.now();
      let dt = (now - lastTime) / 1000;
      
      // Cap delta-time to avoid huge physics jumps if server lags
      if (dt > 0.1) dt = 0.1;

      sim.update(dt);
    }
    lastTime = Date.now();
  }, intervalMs);
};

// Stop the physics loop (useful for full teardown/reset)
export const stopServerPhysicsLoop = () => {
  if (globalForSimulation.simulationLoop) {
    clearInterval(globalForSimulation.simulationLoop);
    globalForSimulation.simulationLoop = null;
    console.log('[SKYSHIELD-ENGINE] Server physics loop stopped');
  }
};
