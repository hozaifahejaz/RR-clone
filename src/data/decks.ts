import type { Deck } from '../sim/types';

export const STARTER_TOWERS = ['cannon', 'skyguard', 'gatling', 'tesla', 'frost', 'gust'];
export const STARTER_SKILLS = ['orbital', 'blizzard'];
export const STARTER_HERO = 'vex';

export function starterDeck(rarity = 0, level = 1): Deck {
  return {
    towers: STARTER_TOWERS.map((id) => ({ id, rarity, level })),
    skills: STARTER_SKILLS.map((id) => ({ id, rarity, level })),
    hero: { id: STARTER_HERO, rarity, level },
  };
}
