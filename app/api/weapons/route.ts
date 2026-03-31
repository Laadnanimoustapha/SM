import { NextResponse } from 'next/server';
import { WeaponsDB } from '@/lib/game/weapons_data';

export async function GET() {
  return NextResponse.json(WeaponsDB);
}
