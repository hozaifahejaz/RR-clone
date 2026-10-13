import { useEffect, useState } from 'preact/hooks';
import type { Game } from '../game/game';
import type { Card } from '../sim/types';
import type { Battle } from '../sim/battle';
import { TOWER_MAP } from '../data/towers';
import { HERO_MAP, SKILL_MAP, SKILLS } from '../data/skills';
import { PIECE_MAP, FIELD_MAP } from '../data/pieces';
import { ENEMIES, BOSSES } from '../data/enemies';
import { xpNeeded } from '../data/endless';
import { CLASS_CSS } from '../render/materials';
import { ArrowsSvg, ClassDot, FieldSvg, Icon, RoadSvg, SkillIcon, Stars } from './common';
import type { Settings } from '../meta/profile';
import { skillCooldown } from '../sim/combat/effects';

function useGame(g: Game): number {
  const [v, setV] = useState(0);
  useEffect(() => g.subscribe(() => setV((x) => x + 1)), [g]);
  return v;
}

const TARGET_LABEL: Record<string, string> = { first: 'First', last: 'Last', strongest: 'Strong', weakest: 'Weak', closest: 'Close' };

export function cardInfo(c: Card, b: Battle | null): { kind: string; name: string; desc: string; art: preact.JSX.Element; cls?: string; tag?: string } {
  switch (c.kind) {
    case 'tower': {
      const d = TOWER_MAP[c.id];
      const n = b ? b.towers.filter((t) => t.def.id === c.id).length : 0;
      const tg = d.targets === 'both' ? 'Air + Ground' : d.targets === 'air' ? 'Air only' : d.targets === 'ground' ? 'Ground only' : 'Support';
      return { kind: 'Tower', name: d.name, desc: `${d.role} · ${tg}`, art: <Icon k={`tower:${c.id}`} />, cls: d.cls, tag: n === 0 ? 'NEW' : `#${n + 1}` };
    }
    case 'road': {
      const [a, z] = c.pieces;
      return {
        kind: 'Road', name: a === z ? PIECE_MAP[a].name : `${PIECE_MAP[a].name} / ${PIECE_MAP[z].name}`, desc: 'Extend the road. The Gate moves to its end.',
        art: (
          <div class="row" style={{ justifyContent: 'center', gap: '6px' }}>
            <RoadSvg id={a} w={a === z ? 70 : 46} />
            {a !== z && <RoadSvg id={z} w={46} />}
          </div>
        ),
      };
    }
    case 'field':
      return { kind: 'Field', name: FIELD_MAP[c.shape].name, desc: 'Reveal new land from the clouds.', art: <FieldSvg id={c.shape} /> };
    case 'star': {
      const d = TOWER_MAP[c.id];
      const s = b?.stars[c.id] ?? 1;
      const perk = d.perks[s - 1];
      return { kind: `★${s} → ★${s + 1}`, name: perk?.name ?? d.name, desc: `${d.name}: ${perk?.desc ?? ''}`, art: <Icon k={s + 1 >= 6 ? `tower:${c.id}:6` : `tower:${c.id}`} />, cls: d.cls };
    }
    case 'skill': {
      const d = SKILL_MAP[c.id];
      const lv = b?.skills.find((s) => s.id === c.id)?.level ?? 0;
      return { kind: lv === 0 ? 'Skill' : `Skill Lv${lv}→${lv + 1}`, name: d.name, desc: lv === 0 ? d.desc : '+25% power, faster cooldown', art: <SkillIcon id={c.id} />, cls: d.cls, tag: lv === 0 ? 'UNLOCK' : undefined };
    }
    case 'hero': {
      const h = HERO_MAP[c.id];
      return { kind: 'Hero', name: h.name, desc: `${h.title} · ${h.special}`, art: <Icon k={`hero:${c.id}`} />, cls: h.cls, tag: 'HERO' };
    }
    case 'move':
      return { kind: 'Tactic', name: 'Move', desc: 'Relocate a tower or your hero.', art: <ArrowsSvg /> };
    case 'switch':
      return { kind: 'Tactic', name: 'Switch', desc: 'Swap the places of two units.', art: <ArrowsSvg swap /> };
    case 'repair':
      return { kind: 'Fortress', name: 'Repair', desc: 'Restore 25% fortress HP.', art: <SkillIcon id="repair" /> };
  }
}

function DraftCard({ c, b, i, onPick }: { c: Card; b: Battle; i: number; onPick: () => void }) {
  const info = cardInfo(c, b);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return (
    <button
      class={`card k-${c.kind}`}
      style={{ animationDelay: `${i * 0.09}s`, transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 18, y: -((e.clientY - r.top) / r.height - 0.5) * 18 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={onPick}
    >
      <div class="frame" style={info.cls ? { borderColor: CLASS_CSS[info.cls] + '99' } : undefined} />
      {info.tag && <div class="tag">{info.tag}</div>}
      {info.cls && <ClassDot cls={info.cls} />}
      <div class="kind">{info.kind}</div>
      <div class="art">{info.art}</div>
      <div class="nm">{info.name}</div>
      <div class="ds">{info.desc}</div>
      <div class="shine" />
    </button>
  );
}

export function Draft({ g }: { g: Game }) {
  const b = g.b;
  if (!b.offer || g.auto || g.replaying) return null;
  return (
    <div class="draft">
      <h2>{b.level === 0 ? 'DRAFT!' : `LEVEL ${b.level}!`}</h2>
      <div class="sub">{b.level === 0 ? 'Build your opening' : 'Choose a card'} {b.pendingPicks > 1 ? `· ${b.pendingPicks} picks waiting` : ''}</div>
      <div class="cards" key={b.offersMade}>
        {b.offer.map((c, i) => (
          <DraftCard c={c} b={b} i={i} onPick={() => g.pick(i)} />
        ))}
      </div>
      <div class="foot">
        <button class="btn dark sm" disabled={b.refreshes <= 0} onClick={() => g.refresh()}>
          ⟳ Refresh ({b.refreshes})
        </button>
      </div>
    </div>
  );
}

function PlaceBar({ g }: { g: Game }) {
  const p = g.place;
  if (!p || g.replaying || g.auto) return null;
  const c = p.card;
  const info = cardInfo(c, g.b);
  let help = '';
  let extra: preact.JSX.Element | null = null;
  switch (c.kind) {
    case 'road':
      help = `${(p.optIdx ?? 0) + 1}/${p.options?.length ?? 0} · tap tiles or cycle`;
      extra = (
        <>
          <button class="btn dark round" onClick={() => g.cycleRoad(-1)}>◀</button>
          <button class="btn dark round" onClick={() => g.cycleRoad(1)}>⟳</button>
        </>
      );
      break;
    case 'field':
      help = 'Tap the clouds where land should rise';
      if (c.shape === 'strip') extra = <button class="btn dark round" onClick={() => g.rotateField()}>⟲</button>;
      break;
    case 'tower':
      help = TOWER_MAP[c.id].onRoad ? 'Tap a road tile' : 'Tap a free tile (blue = power tile)';
      break;
    case 'hero':
      help = 'Tap a free tile for your hero';
      break;
    case 'move':
      help = p.from ? 'Now tap the destination' : 'Tap the unit to move';
      break;
    case 'switch':
      help = p.from ? 'Tap the unit to swap with' : 'Tap the first unit';
      break;
  }
  return (
    <div class="placeBar panel">
      <div class="t">
        {info.kind}: {info.name}
        <small>{help}</small>
      </div>
      {extra}
      <button class="btn green round" disabled={!g.canConfirm()} onClick={() => g.confirm()}>✓</button>
    </div>
  );
}

function TowerPanel({ g }: { g: Game }) {
  const t = g.selected ? g.b.towerById.get(g.selected) : null;
  if (!t || g.place) return null;
  const s = t.stats;
  const stars = g.b.stars[t.def.id] ?? 1;
  const next = t.def.perks[stars - 1];
  return (
    <div class="towerPanel panel">
      <div class="hd">
        <Icon k={stars >= 6 ? `tower:${t.def.id}:6` : `tower:${t.def.id}`} />
        <div class="grow">
          <div class="nm">{t.def.name}</div>
          <Stars n={stars} />
        </div>
        {t.def.delivery !== 'buff' && t.def.delivery !== 'aura' && t.def.delivery !== 'trap' && t.def.delivery !== 'summon' && (
          <button class="btn dark sm" onClick={() => g.cycleTargeting()}>🎯 {TARGET_LABEL[t.mode]}</button>
        )}
        <button class="btn dark sm" onClick={() => { g.selected = null; g.notify(); }}>✕</button>
      </div>
      <div class="statgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div class="stat">DMG<b>{s.dmg ? Math.round(s.dmg) : '—'}</b></div>
        <div class="stat">RATE<b>{s.apm ? Math.round(s.apm) : '—'}</b></div>
        <div class="stat">RANGE<b>{(t.def.delivery === 'buff' ? s.buffRadius : s.range).toFixed(1)}</b></div>
        <div class="stat">KILLS<b>{t.kills}</b></div>
      </div>
      <div class="muted" style={{ fontSize: '.8em', fontWeight: 700 }}>
        Dealt {Math.round(t.dmgDealt).toLocaleString()} dmg{t.power ? ' · ⚡ Power tile +25%' : ''}{t.koT > 0 ? ' · KNOCKED OUT' : ''}
        {next ? <> · Next ★: <b style={{ color: '#ffd45c' }}>{next.name}</b></> : ' · MAX ★'}
      </div>
    </div>
  );
}

function LabPanel({ g }: { g: Game }) {
  const [tab, setTab] = useState<'enemy' | 'card'>('enemy');
  const b = g.b;
  const give = (c: Card) => g.command({ t: 'lab', op: 'card', arg: JSON.stringify(c) });
  return (
    <div class="labPanel panel">
      <div class="seg">
        <button class={tab === 'enemy' ? 'on' : ''} onClick={() => setTab('enemy')}>Enemies</button>
        <button class={tab === 'card' ? 'on' : ''} onClick={() => setTab('card')}>Cards</button>
      </div>
      {tab === 'enemy' ? (
        <>
          <div class="grid2">
            {[...ENEMIES, ...BOSSES].map((e) => (
              <button class="btn dark" onClick={() => g.command({ t: 'lab', op: 'spawn', arg: e.id })}>{e.name}</button>
            ))}
          </div>
          <div class="row">
            <span class="muted" style={{ fontSize: '.75em' }}>Wave lvl</span>
            <input type="range" min="1" max="120" value={Math.max(1, b.wave)} onInput={(e) => g.command({ t: 'lab', op: 'wave', arg: (e.target as HTMLInputElement).value })} />
            <b style={{ fontSize: '.8em' }}>{b.wave}</b>
          </div>
        </>
      ) : (
        <>
          <div class="grid2">
            {b.cfg.deck.towers.map((d) => (
              <button class="btn dark" onClick={() => give({ kind: 'tower', id: d.id })}>{TOWER_MAP[d.id].name}</button>
            ))}
            {b.cfg.deck.towers.map((d) => (
              <button class="btn gold" onClick={() => give({ kind: 'star', id: d.id })}>★ {TOWER_MAP[d.id].name}</button>
            ))}
            <button class="btn dark" onClick={() => give({ kind: 'road', pieces: ['corner', 'zig'] })}>Road</button>
            <button class="btn dark" onClick={() => give({ kind: 'road', pieces: ['hairpin', 'long'] })}>Road 2</button>
            <button class="btn dark" onClick={() => give({ kind: 'field', shape: 'square' })}>Field</button>
            <button class="btn dark" onClick={() => give({ kind: 'move' })}>Move</button>
            {b.cfg.deck.hero && <button class="btn dark" onClick={() => give({ kind: 'hero', id: b.cfg.deck.hero!.id })}>Hero</button>}
            {b.skills.map((s) => (
              <button class="btn dark" onClick={() => give({ kind: 'skill', id: s.id })}>{SKILL_MAP[s.id].name}</button>
            ))}
          </div>
        </>
      )}
      <div class="grid2">
        <button class="btn red" onClick={() => g.command({ t: 'lab', op: 'clear' })}>Clear</button>
        <button class="btn green" onClick={() => g.command({ t: 'lab', op: 'skillsReady' })}>Ready</button>
        <button class="btn dark" onClick={() => g.command({ t: 'lab', op: 'xp' })}>Level up</button>
        <button class="btn dark" onClick={() => g.command({ t: 'lab', op: 'revealAll' })}>Reveal</button>
      </div>
    </div>
  );
}

export function BattleUI({ g, settings, onPause }: { g: Game; settings: Settings; onPause: () => void }) {
  useGame(g);
  const b = g.b;
  const hpFrac = Math.max(0, b.fortHp / b.fortMax);
  const need = xpNeeded(b.level + 1);
  const boss = g.bossBar ? b.enemyById.get(g.bossBar.id) : null;
  const ph = b.phase;
  const timerFrac = b.lab ? 0 : Math.max(0, b.waveTimer / b.waveInterval);
  const hero = b.hero;
  const heroDef = b.cfg.deck.hero ? HERO_MAP[b.cfg.deck.hero.id] : null;
  const showBottomControls = !b.offer;
  return (
    <div class={'ui' + (g.cinematicT > 0.5 ? ' letterbox' : '')}>
      {g.fortFlash > 0 && !settings.reduceFlash && <div class="fortFlash" key={Math.floor(g.fortFlash * 100)} />}
      <div class="hudTop">
        <div class="wavePill">
          <div class="w">{b.lab ? 'LAB' : `WAVE ${Math.max(1, b.wave)}`}</div>
          <div class="ph" style={{ color: ['#9cff8a', '#7af0ff', '#ff7cf0', '#ffd45c', '#ff8a3d', '#ff4d5e'][Math.max(0, ['setup', 'raid', 'elite', 'siege', 'collapse', 'starve'].indexOf(ph.id))] }}>
            {g.replaying ? 'REPLAY' : ph.name}
            {b.cfg.mode === 'daily' ? ' · DAILY' : ''}
          </div>
        </div>
        {!b.lab && (
          <button class="timer" onClick={() => g.callEarly()} title="Call next wave early (+25% XP)">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="rgba(10,12,34,.78)" stroke="#14112a" stroke-width="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#7af0ff" stroke-width="3.5" stroke-dasharray={`${timerFrac * 94.2} 94.2`} stroke-linecap="round" />
            </svg>
            <span>{Math.ceil(b.waveTimer)}</span>
          </button>
        )}
        <div class="hpBox">
          <div class="hpLabel">
            <span>🏰 {Math.ceil(b.fortHp)}</span>
            <span class="muted">{b.lastStandUsed || b.mut('glass') ? '' : '🛡 Last Stand'}</span>
          </div>
          <div class="hpBar">
            <i class={hpFrac < 0.35 ? 'low' : ''} style={{ width: `${hpFrac * 100}%` }} />
          </div>
        </div>
        <button class="btn dark round" style={{ width: '44px', height: '44px' }} onClick={onPause}>❚❚</button>
      </div>
      {boss && (
        <div class="bossBar">
          <div class="nm">{g.bossBar!.name}</div>
          <div class="hpBar">
            <i style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
            {boss.shield > 0 && <b style={{ width: `${Math.min(100, (boss.shield / boss.maxHp) * 100)}%` }} />}
          </div>
        </div>
      )}
      {g.cinematicT > 0.5 && g.bossBar && (
        <div class="bossTitle">
          <div class="b">⚠ BOSS ⚠</div>
          <div class="a">{g.bossBar.name}</div>
        </div>
      )}
      <div class="toasts">
        {g.toasts.map((t) => (
          <div class={`toast ${t.kind}${t.t < 0.3 ? ' out' : ''}`} key={t.id}>
            <div class="a">{t.text}</div>
            {t.sub && <div class="b">{t.sub}</div>}
          </div>
        ))}
      </div>
      {g.hint && (
        <div class="hint panel">
          <span style={{ fontSize: '1.4em' }}>💡</span>
          <span>{g.hint}</span>
          <button class="btn dark sm x" onClick={() => { g.hint = null; g.notify(); }}>OK</button>
        </div>
      )}
      {b.lab && <LabPanel g={g} />}
      <div class="hudBottom">
        <PlaceBar g={g} />
        <TowerPanel g={g} />
        {g.aiming && (
          <div class="placeBar panel">
            <div class="t">{SKILL_MAP[g.aiming].name}<small>Tap the battlefield to cast</small></div>
            <button class="btn dark round" onClick={() => { g.aiming = null; g.notify(); }}>✕</button>
          </div>
        )}
        <div class="xpRow">
          <div class="lvlBadge">{b.level}</div>
          <div class={'xpBar' + (g.levelFlash > 0 ? ' flash' : '')}>
            <i style={{ width: `${Math.min(100, (b.xp / need) * 100)}%` }} />
          </div>
          <span class="muted" style={{ fontSize: '.75em', fontWeight: 800, minWidth: '48px' }}>{b.kills} ☠</span>
        </div>
        {showBottomControls && (
          <div class={'actions' + (settings.leftHanded ? ' left' : '')}>
            {b.skills.map((s) => {
              const def = SKILL_MAP[s.id];
              const cd = s.level > 0 ? Math.max(0, s.cd) / skillCooldown(b, s.id) : 1;
              const ready = s.level > 0 && s.cd <= 0;
              return (
                <button class={'skillBtn' + (ready ? ' ready' : '') + (s.level <= 0 ? ' locked' : '') + (g.aiming === s.id ? ' aiming' : '')}
                  style={{ borderColor: CLASS_CSS[def.cls] }} onClick={() => g.castSkill(s.id)} title={def.name}>
                  <SkillIcon id={s.id} />
                  {s.level > 0 && cd > 0 && <div class="cd" style={{ transform: `scaleY(${cd})` }} />}
                  {s.level > 0 && s.cd > 0 && <div class="cdt">{Math.ceil(s.cd)}</div>}
                  {s.level <= 0 ? <div class="cdt" style={{ fontSize: '.6em' }}>🔒</div> : <div class="lv">L{s.level}</div>}
                </button>
              );
            })}
            {heroDef && (
              <button class={'heroBtn' + (hero && hero.charge >= heroDef.charge ? ' full' : '')} onClick={() => g.heroSpecial()} style={{ opacity: hero ? 1 : 0.4 }} title={heroDef.special}>
                <Icon k={`hero:${heroDef.id}`} />
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#14112a" stroke-width="4" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke={CLASS_CSS[heroDef.cls]} stroke-width="3" stroke-dasharray={`${(hero ? Math.min(1, hero.charge / heroDef.charge) : 0) * 100.5} 100.5`} />
                </svg>
              </button>
            )}
            <div class="smallStack">
              <div class="row">
                <button class={'btn dark mini' + (g.auto ? ' on' : '')} onClick={() => { g.auto = !g.auto; g.notify(); }} title="Autoplay">🤖</button>
                <button class="btn dark mini" onClick={() => { g.speed = g.speed >= 3 ? 1 : g.speed + 1; g.notify(); }}>{g.speed}×</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Draft g={g} />
    </div>
  );
}

export { SKILLS };
