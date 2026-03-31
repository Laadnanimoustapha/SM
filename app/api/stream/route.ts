import { getSimulation, startServerPhysicsLoop } from '@/lib/game/serverEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // max duration for edge/serverless function (Vercel max is usually much shorter unless Pro)

// Create the SSE route
export async function GET(req: Request) {
  // Ensure the backend physical loop is running
  startServerPhysicsLoop();

  // Create a stream to send data directly
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Set up headers for Server-Sent Events
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const encoder = new TextEncoder();

  let isConnected = true;

  // Cleanup on client disconnect
  req.signal.addEventListener('abort', () => {
    isConnected = false;
    writer.close().catch(() => {});
  });

  // Sending the game loop at 30fps (approx 33ms)
  const streamInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(streamInterval);
      return;
    }

    try {
      const sim = getSimulation();
      
      // Serialize only the data needed by the client for rendering
      const state = {
        meta: {
          running: sim.running,
          time: sim.time,
          wave: sim.wave,
          stats: sim.stats,
          roe: sim.roe,
          wind: sim.currentWind
        },
        threats: sim.threats.map(t => ({
          id: t.id, x: t.x, y: t.y, size: t.size, type: t.type,
          name: t.name, color: t.color, angle: t.angle, flightPhase: t.flightPhase
        })),
        defenders: sim.defenders.map(d => ({
          id: d.id, x: d.x, y: d.y, size: d.size, type: d.type,
          name: d.name, color: d.color, angle: d.angle, systemDesignation: d.systemDesignation,
          missiles: (d.missiles || []).map((m: any) => ({
             x: m.x, y: m.y, size: m.size, type: m.type, color: m.color, angle: m.angle, trail: m.trail, flightPhase: m.flightPhase
          }))
        })),
        explosions: sim.explosions.map(e => ({
          x: e.x, y: e.y, size: e.size, maxRadius: e.maxRadius, 
          life: e.life, maxLife: e.maxLife, color: e.color
        })),
        events: sim.events
      };

      const dataString = `data: ${JSON.stringify(state)}\n\n`;
      writer.write(encoder.encode(dataString));

    } catch (err) {
      console.error('[SSE ERROR]', err);
      clearInterval(streamInterval);
      if (isConnected) writer.close().catch(() => {});
    }

  }, 1000 / 30); // 30 FPS updates to client

  return new Response(readable, { headers });
}
