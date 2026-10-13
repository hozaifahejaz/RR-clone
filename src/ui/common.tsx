import type { JSX } from 'preact';
import { PIECE_MAP, FIELD_MAP } from '../data/pieces';
import { CLASS_CSS } from '../render/materials';
import { ICONS } from './icons';

export function Coin({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#ffc23d" stroke="#14112a" stroke-width="2.5" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#b86a00" stroke-width="2" />
      <path d="M8 7 Q12 4 16 7" stroke="#fff6" stroke-width="2" fill="none" />
    </svg>
  );
}
export function Gear({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2l2 3 3-1 1 3 3 1-1 3 3 2-3 2 1 3-3 1-1 3-3-1-2 3-2-3-3 1-1-3-3-1 1-3-3-2 3-2-1-3 3-1 1-3 3 1z" fill="#4aa8ff" stroke="#14112a" stroke-width="2" />
      <circle cx="12" cy="12" r="3.5" fill="#14112a" />
    </svg>
  );
}
export function Medal({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M7 2h4l1 6H8zM13 2h4l-1 6h-4z" fill="#ff4d5e" stroke="#14112a" stroke-width="1.6" />
      <circle cx="12" cy="15" r="7" fill="#ffd45c" stroke="#14112a" stroke-width="2.2" />
      <path d="M12 11l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="#b86a00" />
    </svg>
  );
}
export function Joker({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="4" y="2" width="16" height="20" rx="3" fill="#b46bff" stroke="#14112a" stroke-width="2.2" />
      <path d="M12 6l1.6 3.4 3.6.4-2.7 2.4.8 3.6L12 14l-3.3 1.8.8-3.6-2.7-2.4 3.6-.4z" fill="#fff" />
    </svg>
  );
}

const SKILL_PATHS: Record<string, JSX.Element> = {
  orbital: (
    <g>
      <rect x="10" y="0" width="4" height="15" fill="#ffd0a0" />
      <circle cx="12" cy="17" r="6" fill="#ff8a3d" stroke="#14112a" stroke-width="2" />
      <circle cx="12" cy="17" r="2.5" fill="#fff" />
    </g>
  ),
  carpet: (
    <g fill="#ff8a3d" stroke="#14112a" stroke-width="1.6">
      <circle cx="5" cy="17" r="3.5" /><circle cx="12" cy="13" r="3.5" /><circle cx="19" cy="9" r="3.5" />
      <path d="M2 6 L20 2 L22 5 L4 9z" fill="#c8d0e0" />
    </g>
  ),
  blizzard: (
    <g stroke="#cfefff" stroke-width="2.4" stroke-linecap="round">
      <path d="M12 2v20M3 7l18 10M3 17l18-10" />
      <circle cx="12" cy="12" r="3" fill="#8fd8ff" stroke="#14112a" stroke-width="1.6" />
    </g>
  ),
  storm: <path d="M13 1 L5 13 h6 l-2 10 L19 9 h-6 l2-8z" fill="#ffe066" stroke="#14112a" stroke-width="1.8" />,
  caltrops: (
    <g fill="#c8d0e0" stroke="#14112a" stroke-width="1.6">
      <path d="M4 20l4-8 4 8z" /><path d="M12 18l4-8 4 8z" /><path d="M8 12l4-8 4 8z" />
    </g>
  ),
  rally: (
    <g>
      <path d="M6 2v20" stroke="#14112a" stroke-width="2.5" />
      <path d="M7 3h13l-3 5 3 5H7z" fill="#5cff9d" stroke="#14112a" stroke-width="1.8" />
    </g>
  ),
  barricade: (
    <g fill="#c88a50" stroke="#14112a" stroke-width="1.6">
      <rect x="2" y="8" width="20" height="5" rx="1" /><rect x="2" y="15" width="20" height="5" rx="1" />
      <path d="M5 6v16M19 6v16" />
    </g>
  ),
  repair: (
    <g>
      <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z" fill="#ff6a7a" stroke="#14112a" stroke-width="1.8" />
      <path d="M12 9v6M9 12h6" stroke="#fff" stroke-width="2.4" />
    </g>
  ),
};

export function SkillIcon({ id, cls = 'icon' }: { id: string; cls?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24">
      {SKILL_PATHS[id] ?? <circle cx="12" cy="12" r="8" fill="#fff" />}
    </svg>
  );
}

function pieceTiles(id: string): { x: number; y: number }[] {
  const p = PIECE_MAP[id];
  const D = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  let h = 0, x = 0, y = 0;
  const out = [{ x: 0, y: 0 }];
  for (const ch of p.steps) {
    if (ch === 'L') h = (h + 3) % 4;
    if (ch === 'R') h = (h + 1) % 4;
    x += D[h].x;
    y += D[h].y;
    out.push({ x, y });
  }
  return out;
}

export function RoadSvg({ id, w = 70 }: { id: string; w?: number }) {
  const tiles = pieceTiles(id);
  const minX = Math.min(...tiles.map((t) => t.x)), maxX = Math.max(...tiles.map((t) => t.x));
  const minY = Math.min(...tiles.map((t) => t.y)), maxY = Math.max(...tiles.map((t) => t.y));
  const W = maxX - minX + 1, H = maxY - minY + 1;
  const c = 10;
  const bridge = PIECE_MAP[id].bridge;
  const pts = tiles.map((t) => `${(t.x - minX) * c + c / 2},${(t.y - minY) * c + c / 2}`).join(' ');
  return (
    <svg width={w} viewBox={`-2 -2 ${W * c + 4} ${H * c + 4}`}>
      {tiles.map((t, i) => (
        <rect x={(t.x - minX) * c + 0.6} y={(t.y - minY) * c + 0.6} width={c - 1.2} height={c - 1.2} rx="2"
          fill={i === 0 ? '#ff4fd833' : bridge ? '#8ad8ff' : '#e2c48e'} stroke="#14112a" stroke-width="1" stroke-dasharray={i === 0 ? '2 1.5' : undefined} />
      ))}
      <polyline points={pts} fill="none" stroke="#9a643c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={(tiles[tiles.length - 1].x - minX) * c + c / 2} cy={(tiles[tiles.length - 1].y - minY) * c + c / 2} r="2.6" fill="#ff4fd8" stroke="#14112a" stroke-width=".8" />
    </svg>
  );
}

export function FieldSvg({ id, w = 70 }: { id: string; w?: number }) {
  const cells = FIELD_MAP[id].cells;
  const minX = Math.min(...cells.map((t) => t.x)), maxX = Math.max(...cells.map((t) => t.x));
  const minY = Math.min(...cells.map((t) => t.y)), maxY = Math.max(...cells.map((t) => t.y));
  const c = 10;
  return (
    <svg width={w} viewBox={`-2 -2 ${(maxX - minX + 1) * c + 4} ${(maxY - minY + 1) * c + 4}`}>
      {cells.map((t) => (
        <g>
          <rect x={(t.x - minX) * c + 0.6} y={(t.y - minY) * c + 0.6} width={c - 1.2} height={c - 1.2} rx="2" fill="#86d25e" stroke="#14112a" stroke-width="1" />
          <rect x={(t.x - minX) * c + 2} y={(t.y - minY) * c + 2} width={c - 4} height="2" rx="1" fill="#b8f090" />
        </g>
      ))}
    </svg>
  );
}

export function ArrowsSvg({ swap }: { swap?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="64">
      {swap ? (
        <g stroke="#14112a" stroke-width="1.6" fill="#7af0ff">
          <path d="M3 8h12V4l6 6-6 6v-4H3z" transform="translate(0,-2)" />
          <path d="M21 16H9v4l-6-6 6-6v4h12z" transform="translate(0,2)" fill="#ffd45c" />
        </g>
      ) : (
        <g stroke="#14112a" stroke-width="1.6">
          <rect x="2" y="13" width="8" height="8" rx="2" fill="#6a6fa8" stroke-dasharray="2 1" />
          <rect x="14" y="3" width="8" height="8" rx="2" fill="#7af0ff" />
          <path d="M7 12 Q8 6 14 6" fill="none" stroke="#fff" stroke-width="2.4" />
        </g>
      )}
    </svg>
  );
}

export function Stars({ n, max = 6 }: { n: number; max?: number }) {
  return (
    <span class="stars">
      {Array.from({ length: max }, (_, i) => (
        <span class={i < n ? '' : 'off'}>★</span>
      ))}
    </span>
  );
}

export function ClassDot({ cls }: { cls: string }) {
  return <span class="clsdot" style={{ background: CLASS_CSS[cls] }} />;
}

export function Icon({ k, alt }: { k: string; alt?: string }) {
  const src = ICONS.get(k);
  return src ? <img src={src} alt={alt ?? k} draggable={false} /> : <div style={{ width: '100%', aspectRatio: '1' }} />;
}

export function Currencies({ gold, bp, medals, jokers }: { gold: number; bp: number; medals: number; jokers: number }) {
  const f = (n: number) => (n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n));
  return (
    <div class="currencies">
      <div class="cur"><span class="ico"><Coin /></span>{f(gold)}</div>
      <div class="cur"><span class="ico"><Gear /></span>{f(bp)}</div>
      <div class="cur"><span class="ico"><Medal /></span>{medals}</div>
      <div class="cur"><span class="ico"><Joker /></span>{jokers}</div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button class={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} />;
}
