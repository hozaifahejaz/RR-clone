import { runAuto } from '../src/sim/runner';
import { starterDeck } from '../src/data/decks';
import type { Deck } from '../src/sim/types';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const runs = parseInt(get('runs', '20'), 10);
const rarity = parseInt(get('rarity', '0'), 10);
const level = parseInt(get('level', '1'), 10);
const deckArg = get('deck', '');
const mutators = get('mut', '').split(',').filter(Boolean);
const seed0 = parseInt(get('seed', '1000'), 10);
let deck: Deck = starterDeck(rarity, level);
if (deckArg) deck = { ...deck, towers: deckArg.split(',').map((id) => ({ id, rarity, level })) };

const waves: number[] = [];
const dmg: Record<string, number> = {};
const t0 = Date.now();
let picks = 0;
for (let i = 0; i < runs; i++) {
  const r = runAuto({ seed: seed0 + i, mode: 'endless', deck, workshop: {}, mutators });
  waves.push(r.wave);
  picks += r.picks / Math.max(1, r.wave);
  for (const t of r.towers) dmg[t.id] = (dmg[t.id] ?? 0) + t.dmg;
  process.stdout.write(`run ${i + 1}/${runs}: wave ${r.wave} (picks ${r.picks})\n`);
}
waves.sort((a, b) => a - b);
const total = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
console.log('\nmedian wave', waves[Math.floor(waves.length / 2)], 'min', waves[0], 'max', waves[waves.length - 1]);
console.log('avg picks/wave', (picks / runs).toFixed(2));
console.log('damage share:');
for (const [id, d] of Object.entries(dmg).sort((a, b) => b[1] - a[1])) console.log(`  ${id.padEnd(10)} ${((d / total) * 100).toFixed(1)}%`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
