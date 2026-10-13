import type { Vec2 } from '../sim/types';

/**
 * Road pieces are an ordered list of steps in canonical orientation.
 * 'F' forward, 'L' turn left then step, 'R' turn right then step.
 * Forward is the direction the road was heading when it reached the gate
 * (rotations allow any heading).
 */
export interface RoadPiece {
  id: string;
  name: string;
  steps: string;
  rarity: number; // offer weight
  bridge?: boolean;
}

export const ROAD_PIECES: RoadPiece[] = [
  { id: 'stub', name: 'Stub', steps: 'FF', rarity: 10 },
  { id: 'long', name: 'Long', steps: 'FFFF', rarity: 6 },
  { id: 'corner', name: 'Corner', steps: 'FFR', rarity: 10 },
  { id: 'zig', name: 'Zig', steps: 'FRLF', rarity: 7 },
  { id: 'hairpin', name: 'Hairpin', steps: 'FRFRF', rarity: 5 },
  { id: 'hook', name: 'Hook', steps: 'FFRRF', rarity: 3 },
  { id: 'bridge', name: 'Bridge', steps: 'FF', rarity: 3, bridge: true },
];
export const PIECE_MAP: Record<string, RoadPiece> = Object.fromEntries(ROAD_PIECES.map((p) => [p.id, p]));

export interface FieldShape {
  id: string;
  name: string;
  cells: Vec2[]; // offsets around anchor
}

const rect = (w: number, h: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x: x - Math.floor(w / 2), y: y - Math.floor(h / 2) });
  return out;
};

export const FIELD_SHAPES: FieldShape[] = [
  { id: 'square', name: 'Plot 3×3', cells: rect(3, 3) },
  { id: 'strip', name: 'Strip 2×4', cells: rect(2, 4) },
  { id: 'plus', name: 'Cross', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 }] },
];
export const FIELD_MAP: Record<string, FieldShape> = Object.fromEntries(FIELD_SHAPES.map((f) => [f.id, f]));
