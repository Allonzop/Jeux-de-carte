import {
  attackOf,
  cannotAttack,
  getCard,
  getPlayRequirement,
  hasTaunt,
  isSummoningSick,
  maxHp,
  type BoardCard,
  type CardDef,
  type PlayerId,
  type RedactedGameState,
} from '@boloss/shared';

const OTHER: Record<PlayerId, PlayerId> = { A: 'B', B: 'A' };

export function cardImg(image: string): string {
  return `/cards/${image}`;
}

export function cardBackImg(): string {
  return '/cards/card-back.jpg';
}

export function isYourTurn(game: RedactedGameState): boolean {
  return game.status === 'PLAYING' && game.activePlayer === game.you;
}

/** Board characters that are legal targets when playing `def`. */
export function legalPlayTargetIds(game: RedactedGameState, def: CardDef): Set<string> {
  const req = getPlayRequirement(def);
  if (!req.needsTarget) return new Set();
  const me = game.players[game.you];
  const foe = game.players[OTHER[game.you]];
  let pool: BoardCard[] = [];
  const collect = (hero: BoardCard | null, board: BoardCard[]) => {
    if (req.kind === 'CHARACTER' && hero) pool.push(hero);
    pool.push(...board);
  };
  if (req.side === 'ALLY' || req.side === 'ANY') collect(me.hero, me.board);
  if (req.side === 'ENEMY' || req.side === 'ANY') collect(foe.hero, foe.board);
  if (req.faction) pool = pool.filter((c) => getCard(c.cardId).faction === req.faction);
  if (def.id === 'soldat_dios_mios') pool = pool.filter((c) => !!getCard(c.cardId).summoningConditions?.length);
  if (def.id === 'soldat_reboot') pool = pool.filter((c) => c.equipment.length > 0);
  return new Set(pool.map((c) => c.instanceId));
}

/** Enemy characters that can be attacked right now (respecting taunt). */
export function legalAttackTargetIds(game: RedactedGameState): Set<string> {
  const foe = game.players[OTHER[game.you]];
  const taunts = foe.board.filter((c) => hasTaunt(c));
  const pool = taunts.length > 0 ? taunts : [foe.hero, ...foe.board].filter(Boolean) as BoardCard[];
  return new Set(pool.map((c) => c.instanceId));
}

export function canAttackWith(game: RedactedGameState, card: BoardCard): boolean {
  if (!isYourTurn(game) || game.phase !== 'COMBAT') return false;
  return !isSummoningSick(card) && !cannotAttack(card) && !card.hasAttackedThisTurn && attackOf(card) > 0;
}

export interface CardStatus {
  poison: boolean;
  taunt: boolean;
  sick: boolean;
  locked: boolean; // cannot attack
  attackBuff: number;
  hpBuff: number;
}

export function cardStatus(card: BoardCard): CardStatus {
  let attackBuff = 0;
  let hpBuff = 0;
  let poison = false;
  let locked = false;
  for (const m of card.modifiers) {
    if (m.kind === 'ATTACK') attackBuff += m.value ?? 0;
    if (m.kind === 'HP') hpBuff += m.value ?? 0;
    if (m.kind === 'POISON') poison = true;
    if (m.kind === 'CANNOT_ATTACK') locked = true;
  }
  return {
    poison,
    taunt: hasTaunt(card),
    sick: isSummoningSick(card),
    locked,
    attackBuff,
    hpBuff,
  };
}

export { attackOf, maxHp, getCard, OTHER };
