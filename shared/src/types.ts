/**
 * BOLOSS — Core type model (shared between client & server).
 *
 * The GameState is the single source of truth. It is owned and mutated only by
 * the server (server-authoritative). The client receives a redacted copy where
 * the opponent's hidden information (hand contents, deck order) is stripped out.
 */

export type Faction = 'avocat' | 'floral' | 'jules' | 'monster' | 'soldat';

export type CardType = 'HERO' | 'INVOCATION' | 'OBJET' | 'ACT';

export type Rank = 'A' | 'B' | 'C' | 'S' | 'F';

export type PlayerId = 'A' | 'B';

/** Where an attack / effect is allowed to point. */
export type TargetType =
  | 'NONE'
  | 'ANY'
  | 'ANY_INVOCATION'
  | 'ANY_CHARACTER' // any hero or invocation
  | 'ENEMY_INVOCATION'
  | 'ENEMY_HERO'
  | 'ENEMY_CHARACTER'
  | 'ALLIED_INVOCATION'
  | 'ALLIED_HERO'
  | 'ALLIED_CHARACTER';

/* ------------------------------------------------------------------ *
 *  Effects (data-driven card behaviour)
 * ------------------------------------------------------------------ */

export type EffectTrigger =
  | 'ON_PLAY'
  | 'ON_DEATH'
  | 'ON_TURN_START'
  | 'ON_TURN_END'
  | 'PASSIVE';

export type EffectAction =
  | 'DAMAGE' // deal `value` damage to target
  | 'DAMAGE_ALL_INVOCATIONS' // AoE damage to every invocation on the board
  | 'HEAL' // restore `value` HP to target (equip / consumable)
  | 'BUFF_ATTACK' // +value attack for `duration` turns (equip / temp)
  | 'BUFF_HP' // +value max & current HP for `duration` turns
  | 'POISON' // deal `value` damage to target at the start of each of its turns
  | 'TAUNT' // passive: enemies must attack this creature
  | 'CHARGE' // passive: can attack the turn it is summoned
  | 'AURA_BUFF' // passive: buff all allied invocations of `faction`
  | 'GAIN_ATTACK_PER_TURN' // at each of the owner's turn starts, +value attack (permanent)
  | 'COPY_ATTACK' // passive: attack becomes at least the strongest enemy attack
  | 'CANNOT_ATTACK' // apply a "cannot attack" status for `duration` turns
  | 'SUMMON_FROM_DECK' // pull `summonCardId` from the owner's deck onto the board
  | 'DRAW' // draw `value` cards
  | 'FLAVOR'; // no mechanical effect (collector / meme cards)

export interface CardEffect {
  trigger: EffectTrigger;
  action: EffectAction;
  target?: TargetType;
  /** When true the effect hits every matching character (no single target picked). */
  massTarget?: boolean;
  value?: number;
  /** Number of turns, or 'PERMANENT'. Omitted == instantaneous. */
  duration?: number | 'PERMANENT';
  /** For AURA_BUFF: also grants this much bonus HP (value is the attack bonus). */
  auraHp?: number;
  /** For AURA_BUFF / faction-restricted effects. */
  faction?: Faction;
  /** For SUMMON_FROM_DECK. */
  summonCardId?: string;
  /** Human readable description, shown in the UI / log. */
  text?: string;
}

/* ------------------------------------------------------------------ *
 *  Summoning conditions (Requirement Engine)
 * ------------------------------------------------------------------ */

export type SummoningConditionType =
  | 'SACRIFICE_INVOCATION'
  | 'SACRIFICE_OBJECT'
  | 'SEVEN_SINS'; // played all 7 "péchés capitaux" (Avocat du Diable finisher)

export interface SummoningCondition {
  type: SummoningConditionType;
  /** How the cards to sacrifice are matched. */
  match?: {
    cardId?: string;
    name?: string;
    faction?: Faction;
    rank?: Rank;
    /** Match by a free-form tag stored on the card (e.g. "cuivre"). */
    tag?: string;
  };
  count: number;
}

/* ------------------------------------------------------------------ *
 *  Card definition (static catalog entry)
 * ------------------------------------------------------------------ */

export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  type: CardType;
  rank: Rank;
  image: string; // e.g. "soldat_grenade.jpg" (served from /cards/)
  baseHp?: number; // HERO / INVOCATION
  baseAttack?: number; // HERO / INVOCATION
  attackName?: string;
  attackDesc?: string;
  effectText?: string; // OBJET / ACT description shown on the card
  flavor?: string;
  summoningConditions?: SummoningCondition[];
  effects?: CardEffect[];
  /** Free-form tags used by summoning conditions & filters (e.g. ["sin"], ["cuivre"]). */
  tags?: string[];
}

/* ------------------------------------------------------------------ *
 *  Runtime board state
 * ------------------------------------------------------------------ */

export type ModifierKind =
  | 'ATTACK' // flat attack delta
  | 'HP' // flat max-hp delta (also heals `value` on apply)
  | 'CANNOT_ATTACK'
  | 'POISON'
  | 'TAUNT'
  | 'GAIN_ATTACK_PER_TURN'
  | 'CHARGE';

export interface Modifier {
  id: string;
  kind: ModifierKind;
  value?: number;
  /** Remaining turns of the *controller* before it expires. null == permanent. */
  remainingTurns: number | null;
  /** instanceId of the source card (object / creature), for cleanup. */
  sourceInstanceId?: string;
  /** Auras are recomputed every board change; they carry this flag. */
  fromAura?: boolean;
  label?: string;
}

/** An object equipped onto a hero or invocation. */
export interface Equipment {
  instanceId: string;
  cardId: string;
  /** Modifier ids created by this object, so they can be removed together. */
  modifierIds: string[];
}

/** A HERO or INVOCATION physically present on the board. */
export interface BoardCard {
  instanceId: string;
  cardId: string;
  ownerId: PlayerId;
  hp: number; // current HP
  baseHp: number;
  baseAttack: number;
  modifiers: Modifier[];
  equipment: Equipment[];
  summonedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  /** Extra attacks granted this turn (e.g. Coup de Pression). */
  extraAttacks: number;
  /** Face-down during the setup phase — cardId is stripped in the opponent's view. */
  hidden?: boolean;
}

/** A card instance living in a hand / deck / graveyard. */
export interface CardInstance {
  instanceId: string;
  cardId: string;
}

export interface LogEntry {
  id: number;
  text: string;
  player?: PlayerId;
}

export type GamePhase = 'MAIN' | 'COMBAT';

export type GameStatus = 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';

export interface PlayerState {
  id: PlayerId;
  name: string;
  faction: Faction | null;
  connected: boolean;
  ready: boolean;
  hero: BoardCard | null;
  board: BoardCard[]; // up to MAX_BOARD invocations
  hand: CardInstance[];
  deck: CardInstance[];
  graveyard: CardInstance[];
  sinsPlayed: string[]; // ids of "péchés capitaux" already used this game
  setupDone: boolean; // has confirmed their face-down placement
  turnsStarted: number; // how many of this player's turns have begun (for setup sickness)
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Record<PlayerId, PlayerState>;
  activePlayer: PlayerId;
  phase: GamePhase;
  turnNumber: number;
  winner: PlayerId | null;
  log: LogEntry[];
  /** Monotonic counter for generating instance ids server-side. */
  seq: number;
}

/* ------------------------------------------------------------------ *
 *  Client → Server actions
 * ------------------------------------------------------------------ */

export type GameAction =
  | { type: 'SETUP_PLACE'; instanceId: string }
  | { type: 'SETUP_UNPLACE'; instanceId: string }
  | { type: 'SETUP_DONE' }
  | { type: 'PLAY_CARD'; instanceId: string; targetInstanceId?: string; slotIndex?: number }
  | { type: 'ATTACK'; attackerInstanceId: string; targetInstanceId: string }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' };

/* ------------------------------------------------------------------ *
 *  Redacted view sent to a specific client
 * ------------------------------------------------------------------ */

export interface RedactedPlayerState {
  id: PlayerId;
  name: string;
  faction: Faction | null;
  connected: boolean;
  ready: boolean;
  hero: BoardCard | null;
  board: BoardCard[];
  /** For "you": the real hand. For the opponent: an array of nulls (count only). */
  hand: (CardInstance | null)[];
  handCount: number;
  deckCount: number;
  graveyard: CardInstance[];
  sinsPlayed: string[];
  setupDone: boolean;
}

export interface RedactedGameState {
  roomId: string;
  status: GameStatus;
  you: PlayerId;
  players: Record<PlayerId, RedactedPlayerState>;
  activePlayer: PlayerId;
  phase: GamePhase;
  turnNumber: number;
  winner: PlayerId | null;
  log: LogEntry[];
}
