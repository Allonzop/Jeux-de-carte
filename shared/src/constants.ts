import type { Faction } from './types';

/** Rules constants (see PRD §2). */
export const MAX_BOARD = 4; // invocation slots per player
export const MAX_HAND = 10; // hand size limit — overdraw is discarded
export const DRAW_PER_TURN = 2; // draw at each Start of Turn
export const DECK_SIZE = 30; // deck cap
export const MAX_COPIES = 2; // max copies of the same card in a deck

/**
 * Opening hand.
 *
 * PRD §2 specifies drawing 10 cards during a face-down setup phase where players
 * pre-place their HERO and 0–4 invocations before revealing the board. This MVP
 * does not implement the face-down pre-placement ritual, so drawing 10 (a full
 * hand) would force an immediate discard on the very first Start-of-Turn draw.
 * We open with 7 instead — enough to have real choices without wasting draws.
 */
export const OPENING_HAND = 7;

export const FACTIONS: Faction[] = ['avocat', 'floral', 'jules', 'monster', 'soldat'];

export const FACTION_LABELS: Record<Faction, string> = {
  avocat: "Avocat du Diable",
  floral: 'Tyrannie Florale',
  jules: 'La Ferme de Jules',
  monster: 'Monster Hunter',
  soldat: 'Soldat Rouge',
};

export const FACTION_TAGLINES: Record<Faction, string> = {
  avocat: 'Les 7 péchés capitaux. Utilise-les tous pour invoquer un finisher légendaire.',
  floral: 'Rois, reines et chevaliers floraux. Buffs de meute et provocations épineuses.',
  jules: 'Fermiers, vaches enragées et gros équipements. Cogne fort, cogne bête.',
  monster: 'Bêtes et esprits. Sacrifie les petits pour réveiller les colosses.',
  soldat: 'Révolution rouge. Rebelles increvables et équipements de cuivre.',
};
