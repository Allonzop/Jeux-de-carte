import type { Faction } from './types';
import { cardsByFaction } from './cards';
import { DECK_SIZE } from './constants';

/** Fisher–Yates shuffle using an injectable RNG (defaults to Math.random). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a legal starting deck (list of card ids) for a faction.
 *
 * Rules (PRD §2): 30 cards max, 2 copies max of the same card. The HERO is not
 * part of the draw deck — it starts in the HERO slot. Legendary (S) and collector
 * (F) cards are limited to a single copy.
 */
export function buildDeck(faction: Faction): string[] {
  const pool = cardsByFaction(faction).filter((c) => c.type !== 'HERO');
  const ids: string[] = [];
  for (const card of pool) {
    const copies = card.rank === 'S' || card.rank === 'F' ? 1 : 2;
    for (let i = 0; i < copies; i++) ids.push(card.id);
  }
  return ids.slice(0, DECK_SIZE);
}
