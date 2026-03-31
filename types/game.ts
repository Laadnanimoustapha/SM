export interface Vector2 {
  x: number;
  y: number;
}

export interface WeaponSpec {
  rangeKm: number;
  speedMach: number;
  speedMs?: number;
  warheadKg: number;
  launchMassKg: number;
  lengthM: number;
  diameterM?: number;
  crossSectionM2: number;
  cepM: number;
  apogeeKm?: number;
  burnTimeS?: number;
  rcsM2: number;
  Cd: number;
  propulsion: string;
  guidance: string;
}

export interface WeaponSimParams {
  color: string;
  trailColor: string;
  size: number;
  ecm: number;
  hasDecoys: boolean;
  decoyCount?: number;
  hasChaff: boolean;
  arcHeightFactor?: number;
  maneuverability: number;
  terminalSpeedMultiplier?: number;
  swarmCapable?: boolean;
  swarmSize?: number;
}

export interface WeaponData {
  name: string;
  designation: string;
  natoClass: string;
  source: string;
  specs: WeaponSpec;
  simParams: WeaponSimParams;
}

export interface EntityConfig {
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  speed?: number;
  health?: number;
  color?: string;
  size?: number;
  accuracy?: number;
  damage?: number;
  trailColor?: string;
  ecm?: number;
  rcs?: number;
  altitude?: number;
  weaponData?: WeaponData | null;
  speedMach?: number;
  warheadKg?: number;
  cepM?: number;
  ballisticCoeff?: number;
  dragCoeff?: number;
  massKg?: number;
  crossSection?: number;
  hasDecoys?: boolean;
  decoyCount?: number;
  hasChaffFlares?: boolean;
  maneuverability?: number;
  detectionRange?: number;
  interceptionRange?: number;
  interceptionProbability?: number;
  cooldown?: number;
  canEngage?: string[];
  ammo?: number;
  salvoSize?: number;
}

export interface SimulationState {
  score: number;
  wave: number;
  waveActive: boolean;
  gameSpeed: number;
  paused: boolean;
  baseHealth: number;
  money: number;
  interceptionRate: number;
}
