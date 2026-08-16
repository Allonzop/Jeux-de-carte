import type { Faction } from './types';

/** Rules constants (see PRD §2). */
export const MAX_BOARD = 4; // invocation slots per player
export const MAX_HAND = 10; // hand size limit — overdraw is discarded
export const DRAW_PER_TURN = 2; // draw at each Start of Turn
export const DECK_SIZE = 30; // deck cap
export const DECK_MIN = 20; // taille minimale d'un deck personnalisé
export const MAX_COPIES = 2; // max copies of the same card in a deck

/**
 * Main d'ouverture : 10 cartes (PRD §2).
 *
 * On implémente la phase de setup face cachée du PRD : après avoir pioché 10,
 * chaque joueur pose son HERO et 0 à 4 invocations face cachée, puis on révèle
 * le plateau. Poser des invocations réduit la main avant le premier tour, ce qui
 * évite une défausse immédiate à la première pioche.
 */
export const OPENING_HAND = 10;
export const MAX_SETUP_INVOCATIONS = 4; // invocations posables face cachée en setup

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
