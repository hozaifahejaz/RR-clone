import { useState } from 'preact/hooks';
import type { Profile, CardState } from '../meta/profile';
import {
  UNLOCKS, WORKSHOP, canLevel, canMerge, dailyConfig, doLevel, doMerge, exchangeJoker, isFeatureUnlocked, power,
  todayStr, workshopCost, MERGE_COST,
} from '../meta/profile';
import { TOWERS, TOWER_MAP, RARITY_NAMES, RARITY_COLORS, LEVEL_CAP, towerStats } from '../data/towers';
import { SKILLS, SKILL_MAP, HEROES, HERO_MAP } from '../data/skills';
import { ENEMY_MAP } from '../data/enemies';
import { MUTATORS, PHASES } from '../data/endless';
import { ENEMY_UNLOCK } from '../sim/waves/waves';
import { CLASS_CSS } from '../render/materials';
import { Coin, Currencies, Gear, Icon, Joker, Medal, SkillIcon, Toggle } from './common';
import { exportSave, importSave } from '../meta/save';
import type { Quality } from '../render/world';

type Upd = (fn: (p: Profile) => void) => void;

export function Home({ p, go, onPlay }: { p: Profile; go: (s: string) => void; onPlay: () => void }) {
  const newCards = Object.values(p.cards).filter((c) => c.isNew).length;
  return (
    <div class="ui">
      <Currencies gold={p.gold} bp={p.blueprints} medals={p.medals} jokers={p.jokers} />
      <div class="home">
        <div class="logo">
          <h1>PATH<span>RAIDERS</span></h1>
          <p>Build the road. Draft the defense. Survive the raid.</p>
        </div>
        <div class="playWrap">
          {p.unlockNotes.length > 0 && (
            <div class="notes panel">
              <div class="title" style={{ fontSize: '1.1em' }}>🎉 Unlocked!</div>
              {p.unlockNotes.map((n) => <div><b>{n}</b></div>)}
            </div>
          )}
          <div class="homeStats">
            <span class="chip">🏆 Best wave {p.bestWave}</span>
            <span class="chip">⚔ Power {power(p)}</span>
          </div>
          <button class="btn gold big" onClick={onPlay}>▶ PLAY</button>
          <div class="nav">
            <button class="btn dark navbtn" onClick={() => go('deck')}><span class="i">🃏</span>Deck</button>
            <button class="btn dark navbtn" onClick={() => go('collection')}><span class="i">📚</span>Cards{newCards > 0 && <span class="badge">{newCards}</span>}</button>
            <button class="btn dark navbtn" onClick={() => go('workshop')}><span class="i">🛠</span>Workshop</button>
            <button class="btn dark navbtn" onClick={() => go('records')}><span class="i">📜</span>Records</button>
            <button class="btn dark navbtn" onClick={() => go('settings')}><span class="i">⚙</span>Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayScreen({ p, back, start }: { p: Profile; back: () => void; start: (mode: 'endless' | 'daily' | 'lab', mutators: string[]) => void }) {
  const [muts, setMuts] = useState<string[]>([]);
  const mutOk = isFeatureUnlocked(p, 'mutators');
  const dailyOk = isFeatureUnlocked(p, 'daily');
  const daily = dailyConfig();
  const today = todayStr();
  const best = p.daily.date === today ? p.daily.best : 0;
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Choose Mode</h2>
      </div>
      <div class="scroll">
        <div class="panel" style={{ padding: '14px' }}>
          <div class="row">
            <div class="grow">
              <div class="title" style={{ fontSize: '1.5em' }}>♾ Endless</div>
              <div class="muted" style={{ fontWeight: 700, fontSize: '.9em' }}>Survive as long as you can. Six pressure phases: Setup → Raid → Elite → Siege → Collapse → Starvation.</div>
            </div>
          </div>
          <div class="section" style={{ marginTop: '10px' }}>Mutators {mutOk ? `(score ×1.5 each)` : '🔒 reach wave 15'}</div>
          {MUTATORS.map((m) => (
            <div class="setRow panel" style={{ opacity: mutOk ? 1 : 0.5, padding: '8px 10px' }}>
              <div class="l">{m.name}<div class="muted" style={{ fontSize: '.8em' }}>{m.desc}</div></div>
              <Toggle on={muts.includes(m.id)} onChange={(v) => mutOk && setMuts(v ? [...muts, m.id] : muts.filter((x) => x !== m.id))} />
            </div>
          ))}
          <button class="btn gold big" style={{ width: '100%', marginTop: '8px' }} onClick={() => start('endless', muts)}>START ENDLESS</button>
        </div>
        <div class="panel" style={{ padding: '14px', marginTop: '12px', opacity: dailyOk ? 1 : 0.6 }}>
          <div class="title" style={{ fontSize: '1.4em' }}>📅 Daily Endless</div>
          <div class="muted" style={{ fontWeight: 700, fontSize: '.88em' }}>Fixed seed, deck and mutator for {today}. Everyone gets the same puzzle every day. Today: <b style={{ color: '#ffd45c' }}>{daily.mutatorName}</b></div>
          <div class="row" style={{ flexWrap: 'wrap', margin: '8px 0', gap: '4px' }}>
            {daily.deck.towers.map((t) => <span class="enemyChip" style={{ borderLeft: `4px solid ${CLASS_CSS[TOWER_MAP[t.id].cls]}` }}>{TOWER_MAP[t.id].name}</span>)}
            {daily.deck.skills.map((s) => <span class="enemyChip">✨ {SKILL_MAP[s.id].name}</span>)}
            {daily.deck.hero && <span class="enemyChip">🦸 {HERO_MAP[daily.deck.hero.id].name}</span>}
          </div>
          <div class="row">
            <span class="chip">Best today: {best}</span>
            <span class="chip">🔥 Streak {p.daily.streak}</span>
            <button class="btn green grow" disabled={!dailyOk} onClick={() => start('daily', [])}>{dailyOk ? 'PLAY DAILY' : '🔒 Reach wave 10'}</button>
          </div>
        </div>
        <div class="panel" style={{ padding: '14px', marginTop: '12px' }}>
          <div class="title" style={{ fontSize: '1.4em' }}>🧪 The Lab</div>
          <div class="muted" style={{ fontWeight: 700, fontSize: '.88em' }}>Sandbox with your deck: spawn any enemy or boss, give yourself any card, test combos. No rewards.</div>
          <button class="btn dark" style={{ width: '100%', marginTop: '8px' }} onClick={() => start('lab', [])}>OPEN LAB</button>
        </div>
      </div>
    </div>
  );
}

function rarityStyle(r: number) {
  return { borderColor: RARITY_COLORS[r], boxShadow: `0 4px 0 rgba(0,0,0,.35), inset 0 0 14px ${RARITY_COLORS[r]}66` };
}

function iconKey(c: CardState): string {
  return c.kind === 'tower' ? `tower:${c.id}` : c.kind === 'hero' ? `hero:${c.id}` : '';
}
function nameOf(c: CardState): string {
  return c.kind === 'tower' ? TOWER_MAP[c.id].name : c.kind === 'skill' ? SKILL_MAP[c.id].name : HERO_MAP[c.id].name;
}
function clsOf(c: CardState): string {
  return c.kind === 'tower' ? TOWER_MAP[c.id].cls : c.kind === 'skill' ? SKILL_MAP[c.id].cls : HERO_MAP[c.id].cls;
}
function unlockWave(id: string): number {
  return UNLOCKS.find((u) => u.items.includes(id))?.wave ?? 0;
}

export function CardTile({ c, p, onClick, inDeck }: { c: CardState; p: Profile; onClick: () => void; inDeck?: boolean }) {
  const need = c.rarity < 6 ? MERGE_COST[c.rarity] : 0;
  const ready = c.owned && need > 0 && c.copies + p.jokers >= need;
  return (
    <div class={'ctile' + (c.owned ? '' : ' locked') + (ready ? ' ready' : '') + (inDeck ? ' inDeck' : '')} style={rarityStyle(c.rarity)} onClick={onClick}>
      {c.isNew && <span class="newb">NEW</span>}
      <span class="cls" style={{ background: CLASS_CSS[clsOf(c)] }} />
      {c.owned && <span class="lv">Lv{c.level}</span>}
      {c.kind === 'skill' ? <div style={{ padding: '14%' }}><SkillIcon id={c.id} cls="" /></div> : <Icon k={iconKey(c)} />}
      <div class="nm">{nameOf(c)}</div>
      {c.owned ? (
        <div class="bar"><i style={{ width: `${need ? Math.min(100, (c.copies / need) * 100) : 100}%` }} /></div>
      ) : (
        <div class="muted" style={{ fontSize: '.7em', fontWeight: 800 }}>🔒 Wave {unlockWave(c.id)}</div>
      )}
    </div>
  );
}

export function CardModal({ id, p, upd, close }: { id: string; p: Profile; upd: Upd; close: () => void }) {
  const c = p.cards[id];
  const merge = canMerge(p, id);
  const lvl = canLevel(p, id);
  const tower = c.kind === 'tower' ? TOWER_MAP[id] : null;
  const skill = c.kind === 'skill' ? SKILL_MAP[id] : null;
  const hero = c.kind === 'hero' ? HERO_MAP[id] : null;
  const st = tower ? towerStats(tower, c.rarity, c.level, 1) : null;
  return (
    <div class="modalBg" onClick={close}>
      <div class="modal panel" onClick={(e) => e.stopPropagation()} style={rarityStyle(c.rarity)}>
        <div class="row">
          <div style={{ width: '96px' }}>{c.kind === 'skill' ? <SkillIcon id={id} cls="" /> : <Icon k={iconKey(c)} />}</div>
          <div class="grow">
            <h3>{nameOf(c)}</h3>
            <div style={{ color: RARITY_COLORS[c.rarity], fontFamily: 'var(--display)' }}>{RARITY_NAMES[c.rarity]} · Lv {c.level}/{LEVEL_CAP[c.rarity]}</div>
            <div style={{ color: CLASS_CSS[clsOf(c)], fontWeight: 900, textTransform: 'capitalize' }}>{clsOf(c)}{tower ? ` · ${tower.role}` : ''}</div>
          </div>
        </div>
        <p class="muted" style={{ fontWeight: 700 }}>{tower?.desc ?? skill?.desc ?? (hero ? `${hero.title}. Special: ${hero.special} — ${hero.specialDesc} Passive: ${hero.passive}.` : '')}</p>
        {st && tower && (
          <>
            <div class="statgrid">
              {st.dmg > 0 && <div class="stat">Damage<b>{Math.round(st.dmg)}</b></div>}
              {st.apm > 0 && <div class="stat">Attacks / min<b>{Math.round(st.apm)}</b></div>}
              <div class="stat">Range<b>{(tower.delivery === 'buff' ? st.buffRadius : st.range).toFixed(1)}{st.minRange ? ` (min ${st.minRange})` : ''}</b></div>
              <div class="stat">Targets<b style={{ textTransform: 'capitalize' }}>{tower.targets}</b></div>
            </div>
            <div class="section">In-battle stars</div>
            {tower.perks.map((pk, i) => (
              <div class="perk"><span class="st">★{i + 2}</span><span><b>{pk.name}</b> — {pk.desc}</span></div>
            ))}
          </>
        )}
        {c.owned ? (
          <div class="col" style={{ marginTop: '10px' }}>
            <div class="row">
              <span class="chip">Copies {c.copies}{c.rarity < 6 ? ` / ${MERGE_COST[c.rarity]}` : ''}</span>
              <span class="chip"><Joker s={16} /> {p.jokers}</span>
            </div>
            <button class="btn gold" disabled={!merge.ok} onClick={() => upd((pp) => doMerge(pp, id))}>
              {c.rarity >= 6 ? 'MAX RARITY' : <>⬆ Merge → {RARITY_NAMES[c.rarity + 1]} · <Coin s={16} /> {merge.gold}{merge.useJokers ? ` · ${merge.useJokers} joker` : ''}</>}
            </button>
            <button class="btn green" disabled={!lvl.ok} onClick={() => upd((pp) => doLevel(pp, id))}>
              {lvl.capped ? `Level cap ${LEVEL_CAP[c.rarity]} — merge to raise` : <>Level up · <Coin s={16} /> {lvl.gold} · <Gear s={16} /> {lvl.bp}</>}
            </button>
            <button class="btn dark sm" disabled={c.copies < 3} onClick={() => upd((pp) => exchangeJoker(pp, id))}>Joker Exchange: 3 copies → 1 Joker</button>
          </div>
        ) : (
          <div class="chip" style={{ marginTop: '10px' }}>🔒 Unlocks the first time you reach wave {unlockWave(id)} in Endless</div>
        )}
        <button class="btn dark" style={{ width: '100%', marginTop: '12px' }} onClick={close}>Close</button>
      </div>
    </div>
  );
}

export function Collection({ p, upd, back }: { p: Profile; upd: Upd; back: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const deckIds = new Set([...p.deck.towers, ...p.deck.skills, p.deck.hero]);
  const list = (kind: string) => Object.values(p.cards).filter((c) => c.kind === kind).sort((a, b) => Number(b.owned) - Number(a.owned) || unlockWave(a.id) - unlockWave(b.id));
  const openCard = (id: string) => {
    setOpen(id);
    if (p.cards[id].isNew) upd((pp) => { pp.cards[id].isNew = false; });
  };
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Collection</h2>
        <span class="chip"><Coin s={18} />{p.gold}</span>
        <span class="chip"><Gear s={18} />{p.blueprints}</span>
      </div>
      <div class="scroll">
        <div class="muted" style={{ fontWeight: 700, fontSize: '.85em' }}>Merge identical copies to raise rarity (3 copies up to Rare, 2 from Epic). Level up with gold + blueprints. Rarity raises the level cap.</div>
        {(['tower', 'skill', 'hero'] as const).map((k) => (
          <>
            <div class="section">{k === 'tower' ? 'Towers' : k === 'skill' ? 'Skills' : 'Heroes'}</div>
            <div class="grid">{list(k).map((c) => <CardTile c={c} p={p} inDeck={deckIds.has(c.id)} onClick={() => openCard(c.id)} />)}</div>
          </>
        ))}
      </div>
      {open && <CardModal id={open} p={p} upd={upd} close={() => setOpen(null)} />}
    </div>
  );
}

export function DeckScreen({ p, upd, back }: { p: Profile; upd: Upd; back: () => void }) {
  const [slot, setSlot] = useState<{ kind: 'tower' | 'skill' | 'hero'; i: number } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const towers = p.deck.towers.map((id) => p.cards[id]);
  const hasAA = p.deck.towers.some((id) => TOWER_MAP[id].targets !== 'ground' && TOWER_MAP[id].targets !== 'none');
  const classes = new Set(p.deck.towers.map((id) => TOWER_MAP[id].cls));
  const choose = (id: string) => {
    if (!slot) return;
    upd((pp) => {
      if (slot.kind === 'tower') {
        const j = pp.deck.towers.indexOf(id);
        if (j >= 0) pp.deck.towers[j] = pp.deck.towers[slot.i];
        pp.deck.towers[slot.i] = id;
      } else if (slot.kind === 'skill') {
        const j = pp.deck.skills.indexOf(id);
        if (j >= 0) pp.deck.skills[j] = pp.deck.skills[slot.i];
        pp.deck.skills[slot.i] = id;
      } else pp.deck.hero = id;
    });
    setSlot(null);
  };
  const pool = slot ? Object.values(p.cards).filter((c) => c.kind === slot.kind && c.owned) : [];
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Battle Deck</h2>
        <span class="chip">⚔ {power(p)}</span>
      </div>
      <div class="scroll">
        <div class="section">Towers (6 unique)</div>
        <div class="deckSlots">
          {towers.map((c, i) => <CardTile c={c} p={p} onClick={() => setSlot({ kind: 'tower', i })} />)}
        </div>
        <div class="row" style={{ flexWrap: 'wrap', marginTop: '8px' }}>
          {!hasAA && <span class="warn">⚠ No anti-air! Flyers ignore the road.</span>}
          <span class="muted" style={{ fontSize: '.8em', fontWeight: 700 }}>Classes: {[...classes].map((c) => <b style={{ color: CLASS_CSS[c], textTransform: 'capitalize' }}>{c} </b>)}</span>
        </div>
        <div class="section">Skills (2)</div>
        <div class="deckSlots">
          {p.deck.skills.map((id, i) => <CardTile c={p.cards[id]} p={p} onClick={() => setSlot({ kind: 'skill', i })} />)}
          <CardTile c={p.cards[p.deck.hero]} p={p} onClick={() => setSlot({ kind: 'hero', i: 0 })} />
        </div>
        <div class="section">Class triangle</div>
        <div class="panel" style={{ padding: '10px', fontWeight: 800, fontSize: '.88em' }}>
          <span style={{ color: CLASS_CSS.vanguard }}>Vanguard</span> beats <span style={{ color: CLASS_CSS.swift }}>Swift</span> beats <span style={{ color: CLASS_CSS.elemental }}>Elemental</span> beats <span style={{ color: CLASS_CSS.vanguard }}>Vanguard</span> (±20% damage). <span style={{ color: CLASS_CSS.utility }}>Utility</span> is neutral. Elemental breaks shields 50% faster.
        </div>
        <div class="section">Enemies by phase</div>
        {PHASES.map((ph) => (
          <div class="panel" style={{ padding: '8px 10px', marginBottom: '6px' }}>
            <b>{ph.name}</b> <span class="muted" style={{ fontSize: '.8em' }}>from wave {ph.from}</span>
            <div>
              {ph.pool.filter((id) => (ENEMY_UNLOCK[id] ?? 1) < ph.from + 15).map((id) => {
                const e = ENEMY_MAP[id];
                return <span class="enemyChip" style={{ borderLeft: `4px solid ${CLASS_CSS[e.cls]}` }}>{e.air ? '✈ ' : ''}{e.name}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
      {slot && (
        <div class="modalBg" onClick={() => setSlot(null)}>
          <div class="modal panel" onClick={(e) => e.stopPropagation()}>
            <h3>Choose {slot.kind}</h3>
            <div class="grid">
              {pool.map((c) => (
                <CardTile c={c} p={p} inDeck={[...p.deck.towers, ...p.deck.skills, p.deck.hero].includes(c.id)} onClick={() => choose(c.id)} />
              ))}
            </div>
            <div class="row" style={{ marginTop: '10px' }}>
              <button class="btn dark grow" onClick={() => setSlot(null)}>Cancel</button>
              {slot.kind === 'tower' && <button class="btn dark" onClick={() => setInfo(p.deck.towers[slot.i])}>Info</button>}
            </div>
          </div>
        </div>
      )}
      {info && <CardModal id={info} p={p} upd={upd} close={() => setInfo(null)} />}
    </div>
  );
}

export function Workshop({ p, upd, back }: { p: Profile; upd: Upd; back: () => void }) {
  const ok = isFeatureUnlocked(p, 'workshop');
  const groups = [...new Set(WORKSHOP.map((w) => w.group))];
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Workshop</h2>
        <span class="chip"><Medal s={18} /> {p.medals}</span>
      </div>
      <div class="scroll">
        {!ok && <div class="panel" style={{ padding: '12px', marginBottom: '10px' }}>🔒 The Workshop opens when you reach <b>wave 20</b> in Endless. Medals you earn now are kept.</div>}
        <div class="muted" style={{ fontWeight: 700, fontSize: '.85em' }}>Permanent upgrades. Earn medals every 10 waves, for new records and from daily runs.</div>
        {groups.map((gname) => (
          <>
            <div class="section">{gname}</div>
            {WORKSHOP.filter((w) => w.group === gname).map((w) => {
              const rank = p.workshop[w.id] ?? 0;
              const cost = workshopCost(rank);
              const can = ok && rank < w.max && p.medals >= cost;
              return (
                <div class="wsNode panel" style={{ opacity: ok ? 1 : 0.55 }}>
                  <div class="grow">
                    <div class="title">{w.name}</div>
                    <div class="muted" style={{ fontSize: '.82em', fontWeight: 700 }}>{w.desc}</div>
                    <div class="pips">{Array.from({ length: w.max }, (_, i) => <i class={i < rank ? 'on' : ''} />)}</div>
                  </div>
                  <button class="btn gold sm" disabled={!can} onClick={() => upd((pp) => { pp.medals -= cost; pp.workshop[w.id] = rank + 1; })}>
                    {rank >= w.max ? 'MAX' : <><Medal s={16} /> {cost}</>}
                  </button>
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

export function Records({ p, back, replay }: { p: Profile; back: () => void; replay: (id: string) => void }) {
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Records</h2>
      </div>
      <div class="scroll">
        <div class="statgrid">
          <div class="stat panel">Best wave<b>{p.bestWave}</b></div>
          <div class="stat panel">Best score<b>{p.bestScore.toLocaleString()}</b></div>
          <div class="stat panel">Runs<b>{p.totalRuns}</b></div>
          <div class="stat panel">Total kills<b>{p.totalKills.toLocaleString()}</b></div>
          <div class="stat panel">Daily streak<b>🔥 {p.daily.streak}</b></div>
          <div class="stat panel">Collection<b>{Object.values(p.cards).filter((c) => c.owned).length}/{Object.keys(p.cards).length}</b></div>
        </div>
        {Object.keys(p.bestByMutators).length > 0 && (
          <>
            <div class="section">Best by mutator set</div>
            {Object.entries(p.bestByMutators).map(([k, v]) => (
              <div class="panel" style={{ padding: '6px 10px', marginBottom: '4px', fontWeight: 800 }}>
                {k ? k.split(',').map((m) => MUTATORS.find((x) => x.id === m)?.name).join(' + ') : 'No mutators'} — wave {v}
              </div>
            ))}
          </>
        )}
        <div class="section">Run history (replays)</div>
        {p.history.length === 0 && <div class="muted">No runs yet.</div>}
        {p.history.map((r) => (
          <div class="histItem panel">
            <div class="w">{r.wave}</div>
            <div class="grow" style={{ fontSize: '.82em', fontWeight: 700 }}>
              <div>{r.mode === 'daily' ? `📅 Daily ${r.dailyDate}` : '♾ Endless'} · {r.preset} · {new Date(r.date).toLocaleDateString()}</div>
              <div class="muted">{r.deck.towers.map((t) => TOWER_MAP[t.id]?.name).join(', ')}{r.mutators.length ? ` · ${r.mutators.length} mutator(s)` : ''}</div>
            </div>
            <button class="btn dark sm" onClick={() => replay(r.id)}>▶ Replay</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen({ p, upd, back, setProfile }: { p: Profile; upd: Upd; back: () => void; setProfile: (p: Profile) => void }) {
  const s = p.settings;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => upd((pp) => { pp.settings[k] = v; });
  const [msg, setMsg] = useState('');
  return (
    <div class="screen ui">
      <div class="screenHead">
        <button class="btn dark round" onClick={back}>◀</button>
        <h2>Settings</h2>
      </div>
      <div class="scroll">
        <div class="section">Graphics</div>
        <div class="setRow panel">
          <div class="l">Quality<div class="muted" style={{ fontSize: '.78em' }}>High: shadows, bloom, tilt-shift, MSAA</div></div>
          <div class="seg">
            {(['low', 'medium', 'high'] as Quality[]).map((q) => <button class={s.quality === q ? 'on' : ''} onClick={() => set('quality', q)}>{q}</button>)}
          </div>
        </div>
        <div class="setRow panel"><div class="l">Damage numbers</div><Toggle on={s.numbers} onChange={(v) => set('numbers', v)} /></div>
        <div class="setRow panel"><div class="l">Reduce screen shake</div><Toggle on={s.reduceShake} onChange={(v) => set('reduceShake', v)} /></div>
        <div class="setRow panel"><div class="l">Reduce flashing</div><Toggle on={s.reduceFlash} onChange={(v) => set('reduceFlash', v)} /></div>
        <div class="section">Audio</div>
        <div class="setRow panel"><div class="l">Music</div><input type="range" min="0" max="1" step="0.05" value={s.music} onInput={(e) => set('music', parseFloat((e.target as HTMLInputElement).value))} /></div>
        <div class="setRow panel"><div class="l">Sound effects</div><input type="range" min="0" max="1" step="0.05" value={s.sfx} onInput={(e) => set('sfx', parseFloat((e.target as HTMLInputElement).value))} /></div>
        <div class="section">Accessibility</div>
        <div class="setRow panel">
          <div class="l">Text size</div>
          <div class="seg">{[0.9, 1, 1.15].map((v) => <button class={s.textScale === v ? 'on' : ''} onClick={() => set('textScale', v)}>{v === 0.9 ? 'S' : v === 1 ? 'M' : 'L'}</button>)}</div>
        </div>
        <div class="setRow panel"><div class="l">Left-handed HUD</div><Toggle on={s.leftHanded} onChange={(v) => set('leftHanded', v)} /></div>
        <div class="section">Save data (stored on this device)</div>
        <div class="row" style={{ flexWrap: 'wrap' }}>
          <button class="btn dark" onClick={() => exportSave(p)}>⬇ Export save</button>
          <label class="btn dark">
            ⬆ Import save
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (!f) return;
              try {
                setProfile(await importSave(f));
                setMsg('Save imported!');
              } catch (err) {
                setMsg(String((err as Error).message));
              }
            }} />
          </label>
          <button class="btn red" onClick={() => {
            if (confirm('Erase ALL progress? This cannot be undone.')) {
              void import('../meta/profile').then((m) => setProfile(m.newProfile()));
              setMsg('Progress reset.');
            }
          }}>Reset progress</button>
        </div>
        {msg && <div class="chip" style={{ marginTop: '8px' }}>{msg}</div>}
        <div class="section">About</div>
        <div class="muted" style={{ fontSize: '.82em', fontWeight: 700 }}>
          Path Raiders — an offline tower defense inspired by Raid Rush's road-building card draft. All art, audio and names are original and procedurally generated. Works fully offline once installed (Add to Home Screen).
        </div>
      </div>
    </div>
  );
}

export { TOWERS, SKILLS, HEROES };
