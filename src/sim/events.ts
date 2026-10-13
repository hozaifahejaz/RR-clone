import type { ClassId, Vec2 } from './types';

export type BEvent =
  | { e: 'shot'; tower: number; kind: string; x: number; y: number; tx: number; ty: number; cls: ClassId }
  | { e: 'hit'; x: number; y: number; amount: number; crit: boolean; strong: boolean; dot?: boolean }
  | { e: 'boom'; x: number; y: number; r: number; kind: string; cls?: ClassId }
  | { e: 'chain'; pts: number[]; cls: ClassId }
  | { e: 'death'; id: number; x: number; y: number; type: string; air: boolean; xp: number; elite: boolean; boss: boolean }
  | { e: 'leak'; id: number; dmg: number }
  | { e: 'spawn'; id: number }
  | { e: 'levelup'; level: number }
  | { e: 'wave'; wave: number; name: string; boss: string | null; air: boolean }
  | { e: 'phase'; id: string; name: string; blurb: string }
  | { e: 'towerPlaced'; id: number; x: number; y: number }
  | { e: 'towerMoved'; id: number }
  | { e: 'towerKO'; id: number }
  | { e: 'towerStun'; id: number; t: number }
  | { e: 'star'; tower: string; stars: number }
  | { e: 'road'; tiles: Vec2[]; oldGate: Vec2 }
  | { e: 'field'; cells: Vec2[] }
  | { e: 'skill'; id: string; x: number; y: number }
  | { e: 'bossIntro'; id: number; name: string; type: string }
  | { e: 'bossPhase'; id: number }
  | { e: 'lastStand' }
  | { e: 'gameOver'; wave: number }
  | { e: 'supply'; wave: number }
  | { e: 'crack'; x: number; y: number }
  | { e: 'collapse'; x: number; y: number }
  | { e: 'heroSpecial'; id: string }
  | { e: 'blink'; id: number; x: number; y: number }
  | { e: 'heal'; x: number; y: number }
  | { e: 'fortHit'; dmg: number }
  | { e: 'dance'; x: number; y: number; r: number }
  | { e: 'gust'; x: number; y: number; tx: number; ty: number }
  | { e: 'hook'; x: number; y: number; tx: number; ty: number }
  | { e: 'stomp'; x: number; y: number; r: number }
  | { e: 'freezeCol'; x: number }
  | { e: 'emp'; x: number; y: number; r: number }
  | { e: 'rocket'; x: number; y: number; tx: number; ty: number }
  | { e: 'soldierDie'; x: number; y: number };
