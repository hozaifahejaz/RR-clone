import { useEffect, useRef, useState } from 'preact/hooks';
import type { World } from '../render/world';
import { Game } from '../game/game';
import type { Profile } from '../meta/profile';
import { applyRewards, applyUnlocks, battleConfig, computeRewards, dailyConfig, todayStr } from '../meta/profile';
import { saveProfile } from '../meta/save';
import { BattleUI } from './BattleUI';
import { Collection, DeckScreen, Home, PlayScreen, Records, SettingsScreen, Workshop } from './Menus';
import { Results } from './Results';
import type { RunSummary } from './Results';
import { audio } from '../audio/audio';
import { starterDeck } from '../data/decks';
import type { BattleConfig } from '../sim/types';

type Screen = 'home' | 'play' | 'deck' | 'collection' | 'workshop' | 'records' | 'settings' | 'battle' | 'results';

export function App({ world, overlay, initial }: { world: World; overlay: HTMLElement; initial: Profile }) {
  const [profile, setProfileState] = useState(initial);
  const [, setVer] = useState(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const game = useRef<Game | null>(null);
  const attract = useRef(true);
  const lastCfg = useRef<{ mode: 'endless' | 'daily' | 'lab'; mutators: string[] } | null>(null);
  const [, force] = useState(0);
  const p = profile;

  const upd = (fn: (p: Profile) => void) => {
    fn(profile);
    saveProfile(profile);
    setVer((v) => v + 1);
  };
  const setProfile = (np: Profile) => {
    setProfileState(np);
    saveProfile(np);
    applySettings(np);
  };

  const applySettings = (pp: Profile) => {
    const s = pp.settings;
    if (world.quality !== s.quality) world.setQuality(s.quality);
    world.reduceShake = s.reduceShake;
    audio.musicVol = s.music;
    audio.sfxVol = s.sfx;
    audio.applyVolumes();
    document.documentElement.style.setProperty('--ts', String(s.textScale));
    if (game.current) game.current.view.showNumbers = s.numbers;
  };
  useEffect(() => applySettings(p));

  // ───── game lifecycle ─────
  const disposeGame = () => {
    game.current?.dispose();
    game.current = null;
  };
  const startAttract = () => {
    disposeGame();
    attract.current = true;
    const cfg: BattleConfig = { seed: (Math.random() * 1e9) >>> 0, mode: 'endless', deck: starterDeck(3, 25), workshop: {}, mutators: [] };
    const g = new Game(world, overlay, cfg);
    g.auto = true;
    g.view.showNumbers = false;
    g.silent = true;
    g.onOver = () => startAttract();
    world.zoom = 1;
    world.target.set(0, 0, 0.6);
    game.current = g;
  };

  useEffect(() => {
    startAttract();
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      game.current?.frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.hidden && game.current && !attract.current) {
        game.current.paused = true;
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ───── input ─────
  useEffect(() => {
    const canvas = world.canvas;
    const pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
    let pinch0 = 0, zoom0 = 1, moved = false;
    const down = (e: PointerEvent) => {
      audio.init();
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      moved = false;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = world.zoom;
      }
    };
    const move = (e: PointerEvent) => {
      const g = game.current;
      if (g && !attract.current) {
        const hit = world.pickGround(e.clientX, e.clientY);
        if (hit) g.hoverTile(hit.x, hit.y);
      }
      const pt = pts.get(e.pointerId);
      if (!pt) return;
      const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX;
      pt.y = e.clientY;
      if (attract.current) return;
      if (Math.hypot(pt.x - pt.sx, pt.y - pt.sy) > 10) moved = true;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        world.zoom = Math.max(0.5, Math.min(1.1, zoom0 * (pinch0 / Math.max(1, d))));
        world.manual();
        world.clampTarget();
      } else if (moved && world.zoom < 0.98) {
        const k = (world.baseDist * world.zoom) / canvas.clientHeight * 0.9;
        world.target.x -= dx * k;
        world.target.z -= dy * k * 1.2;
        world.manual();
        world.clampTarget();
      }
    };
    const up = (e: PointerEvent) => {
      const pt = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (!pt || attract.current) return;
      if (!moved && pts.size === 0 && performance.now() - pt.t < 600) {
        const hit = world.pickGround(e.clientX, e.clientY);
        if (hit && game.current) game.current.tapTile(hit.x, hit.y);
      }
    };
    const wheel = (e: WheelEvent) => {
      if (attract.current) return;
      world.zoom = Math.max(0.5, Math.min(1.1, world.zoom * (e.deltaY > 0 ? 1.08 : 0.92)));
      world.manual();
      world.clampTarget();
    };
    const key = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || attract.current) return;
      if (e.key === ' ') { g.paused = !g.paused; setPaused(g.paused); }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const i = parseInt(e.key, 10) - 1;
        if (g.b.offer) g.pick(i);
      }
      if (e.key === 'Enter' && g.place) g.confirm();
      if (e.key === 'r' && g.place) g.cycleRoad(1);
      if (e.key === 'q') g.castSkill(g.b.skills[0]?.id ?? '');
      if (e.key === 'w') g.castSkill(g.b.skills[1]?.id ?? '');
      if (e.key === 'e') g.heroSpecial();
      if (e.key === 'f') { g.speed = g.speed >= 3 ? 1 : g.speed + 1; g.notify(); }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('keydown', key);
    const onResize = () => world.resize();
    window.addEventListener('resize', onResize);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const startRun = (mode: 'endless' | 'daily' | 'lab', mutators: string[]) => {
    audio.init();
    lastCfg.current = { mode, mutators };
    disposeGame();
    attract.current = false;
    let cfg: BattleConfig;
    if (mode === 'daily') cfg = dailyConfig();
    else {
      cfg = battleConfig(p, mutators);
      if (mode === 'lab') cfg.mode = 'lab';
    }
    const g = new Game(world, overlay, cfg, { tutorial: !p.tutorialDone && mode === 'endless' });
    g.view.showNumbers = p.settings.numbers;
    g.onOver = (gg) => finishRun(gg);
    world.zoom = 1;
    world.target.set(0, 0, 0.6);
    game.current = g;
    setPaused(false);
    setScreen('battle');
    // clear "new unlock" notes once seen
    if (p.unlockNotes.length) upd((pp) => { pp.unlockNotes = []; });
  };

  const finishRun = (g: Game) => {
    const b = g.b;
    const agg: Record<string, number> = {};
    for (const t of b.towers) agg[t.def.id] = (agg[t.def.id] ?? 0) + t.dmgDealt;
    const top = Object.entries(agg).map(([id, dmg]) => ({ id, dmg })).sort((a, c) => c.dmg - a.dmg);
    const lab = b.cfg.mode === 'lab';
    const daily = b.cfg.mode === 'daily';
    let rewards = null;
    if (!lab && !g.replaying) {
      rewards = computeRewards(p, b.wave, b.cfg.mutators, daily);
      const r = rewards;
      upd((pp) => {
        applyRewards(pp, r);
        pp.totalRuns++;
        pp.totalKills += b.kills;
        pp.tutorialDone = true;
        if (!daily) {
          const newly = applyUnlocks(pp, b.wave);
          if (newly.length) pp.unlockNotes = r.unlocked;
          pp.bestWave = Math.max(pp.bestWave, b.wave);
          pp.bestScore = Math.max(pp.bestScore, b.score);
          const key = [...b.cfg.mutators].sort().join(',');
          pp.bestByMutators[key] = Math.max(pp.bestByMutators[key] ?? 0, b.wave);
        } else {
          const today = todayStr();
          const yesterday = todayStr(new Date(Date.now() - 86400000));
          if (pp.daily.date !== today) {
            pp.daily.streak = pp.daily.lastPlayed === yesterday ? pp.daily.streak + 1 : 1;
            pp.daily.date = today;
            pp.daily.best = 0;
            pp.daily.attempts = 0;
          }
          pp.daily.lastPlayed = today;
          pp.daily.best = Math.max(pp.daily.best, b.wave);
          pp.daily.attempts++;
        }
        pp.history.unshift({
          id: String(Date.now()), date: Date.now(), mode: daily ? 'daily' : 'endless', seed: b.cfg.seed, preset: b.cfg.preset ?? 'plains',
          wave: b.wave, score: b.score, kills: b.kills, mutators: b.cfg.mutators, deck: b.cfg.deck, workshop: b.cfg.workshop,
          log: b.log, ticks: b.tick, dailyDate: daily ? todayStr() : undefined,
        });
        pp.history = pp.history.slice(0, 25);
      });
    }
    setSummary({ wave: b.wave, kills: b.kills, score: b.score, time: b.time, daily, lab: lab || g.replaying, rewards, topTowers: top, bossesKilled: b.bossesKilled });
    setScreen('results');
    audio.setIntensity(0);
  };

  const quitRun = () => {
    const g = game.current;
    if (!g) return;
    g.paused = false;
    setPaused(false);
    if (g.replaying || g.b.cfg.mode === 'lab') {
      g.b.over = true;
      finishRun(g);
      return;
    }
    g.b.over = true;
    finishRun(g);
  };

  const replay = (id: string) => {
    const r = p.history.find((h) => h.id === id);
    if (!r) return;
    disposeGame();
    attract.current = false;
    const cfg: BattleConfig = { seed: r.seed, mode: r.mode === 'daily' ? 'daily' : 'endless', deck: r.deck, workshop: r.workshop, mutators: r.mutators, preset: r.preset };
    const g = new Game(world, overlay, cfg, { replay: r.log });
    g.speed = 2;
    g.onOver = (gg) => finishRun(gg);
    game.current = g;
    world.zoom = 1;
    world.target.set(0, 0, 0.6);
    setScreen('battle');
  };

  const goHome = () => {
    setScreen('home');
    setSummary(null);
    startAttract();
  };

  const g = game.current;
  return (
    <>
      {screen === 'home' && <Home p={p} go={(s) => setScreen(s as Screen)} onPlay={() => setScreen('play')} />}
      {screen === 'play' && <PlayScreen p={p} back={() => setScreen('home')} start={startRun} />}
      {screen === 'deck' && <DeckScreen p={p} upd={upd} back={() => setScreen('home')} />}
      {screen === 'collection' && <Collection p={p} upd={upd} back={() => setScreen('home')} />}
      {screen === 'workshop' && <Workshop p={p} upd={upd} back={() => setScreen('home')} />}
      {screen === 'records' && <Records p={p} back={() => setScreen('home')} replay={replay} />}
      {screen === 'settings' && <SettingsScreen p={p} upd={upd} back={() => setScreen('home')} setProfile={setProfile} />}
      {screen === 'battle' && g && !attract.current && (
        <BattleUI g={g} settings={p.settings} onPause={() => { g.paused = true; setPaused(true); force((x) => x + 1); }} />
      )}
      {screen === 'battle' && paused && g && (
        <div class="pause ui">
          <div class="panel">
            <div class="title" style={{ fontSize: '2em' }}>PAUSED</div>
            <div class="muted" style={{ fontWeight: 800 }}>Wave {g.b.wave} · {g.b.kills} kills</div>
            <button class="btn green big" onClick={() => { g.paused = false; setPaused(false); }}>▶ Resume</button>
            <div class="row" style={{ justifyContent: 'center' }}>
              <span class="muted" style={{ fontWeight: 800 }}>Quality</span>
              <div class="seg">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button class={p.settings.quality === q ? 'on' : ''} onClick={() => upd((pp) => { pp.settings.quality = q; })}>{q}</button>
                ))}
              </div>
            </div>
            <div class="row" style={{ justifyContent: 'center' }}>
              <button class="btn dark sm" onClick={() => upd((pp) => { pp.settings.music = pp.settings.music > 0 ? 0 : 0.5; })}>🎵 Music {p.settings.music > 0 ? 'on' : 'off'}</button>
              <button class="btn dark sm" onClick={() => upd((pp) => { pp.settings.sfx = pp.settings.sfx > 0 ? 0 : 0.8; })}>🔊 SFX {p.settings.sfx > 0 ? 'on' : 'off'}</button>
            </div>
            <button class="btn red" onClick={quitRun}>{g.replaying ? 'Exit replay' : g.b.cfg.mode === 'lab' ? 'Exit lab' : '🏳 Retreat (keep rewards)'}</button>
          </div>
        </div>
      )}
      {screen === 'results' && summary && (
        <Results s={summary} p={p} upd={upd} onHome={goHome}
          onAgain={() => { const c = lastCfg.current; if (c && !summary.lab) startRun(c.mode, c.mutators); else goHome(); }} />
      )}
    </>
  );
}
