import { useState } from 'preact/hooks';
import type { Profile, Rewards, SpinResult } from '../meta/profile';
import { REEL_SYMBOLS, spinMachine } from '../meta/profile';
import { TOWER_MAP } from '../data/towers';
import { SKILL_MAP, HERO_MAP } from '../data/skills';
import { Coin, Gear, Icon, Joker, Medal, SkillIcon } from './common';
import { audio } from '../audio/audio';

export interface RunSummary {
  wave: number;
  kills: number;
  score: number;
  time: number;
  daily: boolean;
  lab: boolean;
  rewards: Rewards | null;
  topTowers: { id: string; dmg: number }[];
  bossesKilled: number;
}

const SYM: Record<string, string> = { coin: '🪙', gear: '⚙️', star: '⭐', medal: '🏅', joker: '🃏', gem: '💎' };

function LuckyMachine({ spins, wave, onPrize }: { spins: number; wave: number; onPrize: (r: SpinResult) => void }) {
  const [left, setLeft] = useState(spins);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['gem', 'gem', 'gem']);
  const [label, setLabel] = useState('');
  const spin = () => {
    if (spinning || left <= 0) return;
    setSpinning(true);
    setLabel('');
    audio.play('card');
    const r = spinMachine(wave);
    const tick = window.setInterval(() => audio.play('click', { vol: 0.4 }), 90);
    [0, 1, 2].forEach((i) =>
      window.setTimeout(() => {
        setReels((old) => old.map((s, k) => (k === i ? r.reels[i] : s)));
        audio.play('pop');
        if (i === 2) {
          clearInterval(tick);
          setSpinning(false);
          setLeft((x) => x - 1);
          const parts = [r.gold && `+${r.gold} gold`, r.blueprints && `+${r.blueprints} bp`, r.medals && `+${r.medals} medal`, r.jokers && `+${r.jokers} joker`].filter(Boolean);
          setLabel(`${r.label} ${parts.join(' · ')}`);
          audio.play(r.label === 'JACKPOT!' ? 'win' : 'coin');
          onPrize(r);
        }
      }, 700 + i * 350),
    );
  };
  if (spins <= 0) return null;
  return (
    <div class="panel col" style={{ alignItems: 'center', padding: '12px', width: 'min(360px,100%)' }}>
      <div class="title" style={{ fontSize: '1.3em' }}>🎰 Lucky Machine</div>
      <div class="slot">
        {reels.map((s, i) => (
          <div class={'reel' + (spinning ? ' spin' : '')} key={i}>
            <span>{spinning ? SYM[REEL_SYMBOLS[(i * 2 + Math.floor(Date.now() / 90)) % REEL_SYMBOLS.length]] : SYM[s]}</span>
          </div>
        ))}
      </div>
      <div class="prize">{label}</div>
      <button class="btn gold" disabled={spinning || left <= 0} onClick={spin}>{left > 0 ? `SPIN (${left})` : 'No spins left'}</button>
    </div>
  );
}

export function Results({ s, p, upd, onHome, onAgain }: { s: RunSummary; p: Profile; upd: (fn: (p: Profile) => void) => void; onHome: () => void; onAgain: () => void }) {
  const r = s.rewards;
  const name = (id: string) => TOWER_MAP[id]?.name ?? SKILL_MAP[id]?.name ?? HERO_MAP[id]?.name ?? id;
  const total = s.topTowers.reduce((a, t) => a + t.dmg, 0) || 1;
  const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
  return (
    <div class="results ui">
      <div class="muted title" style={{ fontSize: '1.1em', letterSpacing: '4px' }}>{s.lab ? 'LAB CLOSED' : s.daily ? 'DAILY COMPLETE' : 'RAID OVER'}</div>
      <div class="bigWave">{s.wave}</div>
      <div class="title" style={{ marginTop: '-8px' }}>WAVES</div>
      {r?.record && <div class="record">★ NEW RECORD ★</div>}
      <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <span class="chip">☠ {s.kills} kills</span>
        <span class="chip">👑 {s.bossesKilled} bosses</span>
        <span class="chip">⏱ {mm}:{String(ss).padStart(2, '0')}</span>
        <span class="chip">Score {s.score.toLocaleString()}</span>
      </div>
      {s.topTowers.length > 0 && (
        <div class="panel" style={{ padding: '10px 12px', width: 'min(360px,100%)' }}>
          <div class="title" style={{ marginBottom: '6px' }}>Damage dealt</div>
          {s.topTowers.slice(0, 6).map((t) => (
            <div class="row" style={{ marginBottom: '3px' }}>
              <div style={{ width: '28px' }}><Icon k={`tower:${t.id}`} /></div>
              <div style={{ width: '90px', fontWeight: 800, fontSize: '.85em' }}>{name(t.id)}</div>
              <div class="xpBar grow" style={{ height: '10px' }}><i style={{ width: `${(t.dmg / total) * 100}%` }} /></div>
              <div style={{ width: '42px', textAlign: 'right', fontSize: '.8em', fontWeight: 800 }}>{Math.round((t.dmg / total) * 100)}%</div>
            </div>
          ))}
        </div>
      )}
      {r && (
        <>
          <div class="rewardRow">
            <div class="reward panel"><Coin s={30} /><b>+{r.gold}</b></div>
            <div class="reward panel" style={{ animationDelay: '.1s' }}><Gear s={30} /><b>+{r.blueprints}</b></div>
            <div class="reward panel" style={{ animationDelay: '.2s' }}><Medal s={30} /><b>+{r.medals}</b></div>
          </div>
          {r.unlocked.length > 0 && (
            <div class="panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
              <div class="title" style={{ color: '#ffd45c' }}>🎉 UNLOCKED</div>
              {r.unlocked.map((u) => <div style={{ fontWeight: 800 }}>{u}</div>)}
            </div>
          )}
          {r.drops.length > 0 && (
            <div class="panel" style={{ padding: '10px', width: 'min(400px,100%)' }}>
              <div class="title" style={{ textAlign: 'center' }}>📦 Supply Crates ({r.supplyDrops + (r.record ? 1 : 0) || 1})</div>
              <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
                {r.drops.map((d, i) => (
                  <div class="ctile dropCard" style={{ animationDelay: `${0.3 + i * 0.12}s` }}>
                    {SKILL_MAP[d.id] ? <div style={{ padding: '12%' }}><SkillIcon id={d.id} cls="" /></div> : <Icon k={HERO_MAP[d.id] ? `hero:${d.id}` : `tower:${d.id}`} />}
                    <div class="nm">{name(d.id)}</div>
                    <div class="lv" style={{ position: 'static' }}>×{d.n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <LuckyMachine spins={r.spins} wave={s.wave} onPrize={(sp) => upd((pp) => { pp.gold += sp.gold; pp.blueprints += sp.blueprints; pp.medals += sp.medals; pp.jokers += sp.jokers; })} />
        </>
      )}
      <div class="row" style={{ marginTop: '6px', paddingBottom: '20px' }}>
        <button class="btn dark" onClick={onHome}>🏠 Home</button>
        <button class="btn gold" onClick={onAgain}>↻ Play again</button>
      </div>
      <div class="row muted" style={{ fontSize: '.8em' }}><Joker s={14} /> {p.jokers} jokers · <Coin s={14} /> {p.gold}</div>
    </div>
  );
}
