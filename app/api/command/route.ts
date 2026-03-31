import { NextResponse } from 'next/server';
import { getSimulation } from '@/lib/game/serverEngine';

export async function POST(req: Request) {
  try {
    const sim = getSimulation();
    const body = await req.json();
    const { action, payload } = body;

    switch (action) {
      case 'START':
        sim.running = true;
        sim.addEvent('system', 'SIMULATION ACTIVE — Engaging targets', '#66ff66');
        break;
      case 'PAUSE':
        sim.running = false;
        sim.addEvent('system', 'SIMULATION PAUSED', '#ffaa00');
        break;
      case 'RESET':
        sim.reset();
        break;
      case 'SPEED':
        sim.speedMultiplier = Number(payload.amount);
        break;
      case 'WAVE':
        if (sim.running) {
          sim.launchWave();
        } else {
          sim.addEvent('system', 'Cannot launch wave: Simulation is STANDBY', '#ff4444');
        }
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ status: 'ok', meta: sim.stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
