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

/**
 * Cibles d'attaque légales, **exactement** la règle du moteur (sinon on
 * surligne en rouge une carte que le serveur refusera ensuite) :
 *  - provocation globale : le héros est intouchable tant qu'il reste une seule
 *    invocation adverse sur le plateau ;
 *  - une carte avec le mot-clé Provocation passe avant les autres invocations.
 */
export function legalAttackTargetIds(game: RedactedGameState): Set<string> {
  const foe = game.players[OTHER[game.you]];
  const taunts = foe.board.filter((c) => hasTaunt(c));
  if (taunts.length > 0) return new Set(taunts.map((c) => c.instanceId));
  if (foe.board.length > 0) return new Set(foe.board.map((c) => c.instanceId));
  return new Set(foe.hero ? [foe.hero.instanceId] : []);
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

export interface ModifierLine {
  icon: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Décrit en français les altérations d'état actives sur une carte du plateau. */
export function describeModifiers(card: BoardCard): ModifierLine[] {
  const lines: ModifierLine[] = [];
  const def = getCard(card.cardId);

  // Passifs issus de la carte elle-même.
  for (const e of def.effects ?? []) {
    if (e.trigger !== 'PASSIVE') continue;
    const label = e.text ?? '';
    if (e.action === 'TAUNT') lines.push({ icon: '🛡', text: 'Provocation — doit être attaquée en premier', tone: 'good' });
    if (e.action === 'CHARGE') lines.push({ icon: '⚡', text: `${label || 'Charge'} — peut attaquer dès son arrivée`, tone: 'good' });
    if (e.action === 'AURA_BUFF') lines.push({ icon: '✨', text: `${label || 'Aura'} — buff les alliés (+${e.value ?? 0} ATT / +${e.auraHp ?? 0} PV)`, tone: 'good' });
    if (e.action === 'GAIN_ATTACK_PER_TURN') lines.push({ icon: '📈', text: `${label || 'Croissance'} — +${e.value ?? 0} attaque à chaque tour`, tone: 'good' });
    if (e.action === 'COPY_ATTACK') lines.push({ icon: '🎭', text: `${label || 'Copie'} — égale l'attaque du plus fort adversaire`, tone: 'good' });
  }

  // Modificateurs dynamiques.
  const turnsLabel = (t: number | null) => (t === null ? 'permanent' : `${t} tour${t > 1 ? 's' : ''}`);
  for (const m of card.modifiers) {
    const src = m.label ? ` (${m.label})` : '';
    switch (m.kind) {
      case 'ATTACK':
        if (m.value)
          lines.push({
            icon: m.value > 0 ? '⚔️' : '🔻',
            text: `${m.value > 0 ? '+' : ''}${m.value} attaque${src} · ${turnsLabel(m.remainingTurns)}`,
            tone: m.value > 0 ? 'good' : 'bad',
          });
        break;
      case 'HP':
        if (m.value)
          lines.push({
            icon: m.value > 0 ? '❤️' : '💔',
            text: `${m.value > 0 ? '+' : ''}${m.value} PV${src} · ${turnsLabel(m.remainingTurns)}`,
            tone: m.value > 0 ? 'good' : 'bad',
          });
        break;
      case 'POISON':
        lines.push({ icon: '☠️', text: `Poison : −${m.value ?? 0} PV par tour${src} · ${turnsLabel(m.remainingTurns)}`, tone: 'bad' });
        break;
      case 'CANNOT_ATTACK':
        lines.push({ icon: '⛔', text: `Ne peut pas attaquer${src} · ${turnsLabel(m.remainingTurns)}`, tone: 'bad' });
        break;
      default:
        break;
    }
  }

  // États de combat.
  if (isSummoningSick(card)) lines.push({ icon: '💤', text: "Mal d'invocation — ne peut pas attaquer ce tour", tone: 'bad' });
  if (card.hasAttackedThisTurn && card.extraAttacks <= 0) lines.push({ icon: '✅', text: 'A déjà attaqué ce tour', tone: 'neutral' });
  if (card.extraAttacks > 0) lines.push({ icon: '🔁', text: `${card.extraAttacks} attaque(s) supplémentaire(s) ce tour`, tone: 'good' });
  for (const eq of card.equipment) {
    lines.push({ icon: '⚙️', text: `Équipé : ${getCard(eq.cardId).name}`, tone: 'neutral' });
  }

  return lines;
}

export { attackOf, maxHp, getCard, OTHER, isSummoningSick };
