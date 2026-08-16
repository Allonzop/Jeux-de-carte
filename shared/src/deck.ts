import type { Faction } from './types';
import { CARD_MAP, cardsByFaction, getCard } from './cards';
import { DECK_MIN, DECK_SIZE } from './constants';

/** Fisher–Yates shuffle using an injectable RNG (defaults to Math.random). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Nombre de copies autorisées d'une carte dans un deck. */
export function maxCopiesOf(cardId: string): number {
  const c = getCard(cardId);
  return c.rank === 'S' || c.rank === 'F' ? 1 : 2;
}

/** Invocation « basique » : posable en setup et éligible comme héros. */
export function isBasicInvocationId(cardId: string): boolean {
  const c = CARD_MAP[cardId];
  return !!c && c.type === 'INVOCATION' && !c.summoningConditions?.length && !c.token;
}

/**
 * Build a legal starting deck (list of card ids) for a faction.
 *
 * Rules (PRD §2): 30 cards max, 2 copies max of the same card. Legendary (S)
 * and collector (F) cards are limited to a single copy. Les cartes-conséquences
 * (token) ne vont jamais dans un deck.
 */
export function buildDeck(faction: Faction): string[] {
  const pool = cardsByFaction(faction).filter((c) => !c.token);
  const ids: string[] = [];
  for (const card of pool) {
    for (let i = 0; i < maxCopiesOf(card.id); i++) ids.push(card.id);
  }
  return ids.slice(0, DECK_SIZE);
}

export interface DeckValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validation d'un deck personnalisé (côté serveur ET client) :
 * entre DECK_MIN et DECK_SIZE cartes, 2 copies max (1 pour S/F), pas de
 * carte-conséquence, et au moins 5 invocations basiques (pour pouvoir choisir
 * un héros et poser des monstres au setup).
 */
export function validateDeck(ids: unknown): DeckValidation {
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
    return { ok: false, error: 'Deck invalide.' };
  }
  const list = ids as string[];
  if (list.length < DECK_MIN) return { ok: false, error: `Un deck doit contenir au moins ${DECK_MIN} cartes.` };
  if (list.length > DECK_SIZE) return { ok: false, error: `Un deck ne peut pas dépasser ${DECK_SIZE} cartes.` };
  const counts = new Map<string, number>();
  for (const id of list) {
    const def = CARD_MAP[id];
    if (!def) return { ok: false, error: `Carte inconnue : ${id}` };
    if (def.token) return { ok: false, error: `${def.name} est une carte-conséquence : elle ne peut pas être mise dans un deck.` };
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
    if (n > maxCopiesOf(id)) {
      return { ok: false, error: `${def.name} : ${maxCopiesOf(id)} exemplaire(s) maximum.` };
    }
  }
  const basics = list.filter(isBasicInvocationId).length;
  if (basics < 5) return { ok: false, error: 'Il faut au moins 5 invocations sans condition (pour le héros et la mise en place).' };
  return { ok: true };
}
