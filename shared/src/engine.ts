/**
 * BOLOSS — Server-authoritative game engine.
 *
 * All mutations to a GameState happen here. The engine is deterministic given
 * its inputs (an injectable RNG is used for shuffles), pure of any I/O, and
 * shared with the client for type-safety and target highlighting (the client
 * NEVER trusts its own copy — every action is re-validated here on the server).
 *
 * Design notes:
 *  - Stats are computed on the fly: maxHp = baseHp + Σ HP modifiers,
 *    attack = max(0, baseAttack + Σ ATTACK modifiers). Current hp is tracked
 *    incrementally so healing/temp-HP behaves intuitively.
 *  - Buffs/debuffs are Modifiers with a `remainingTurns` counter, expired at the
 *    END of their controller's turn (except POISON which ticks at turn START).
 *  - Passives (TAUNT, CHARGE, AURA_BUFF, GAIN_ATTACK_PER_TURN) are read straight
 *    from the card definition, so they can never desync from a modifier list.
 */

import type {
  BoardCard,
  CardDef,
  CardEffect,
  CardInstance,
  Equipment,
  Faction,
  GameAction,
  GameState,
  Modifier,
  PlayerId,
  PlayerState,
  RedactedGameState,
  RedactedPlayerState,
  SummoningCondition,
  TargetType,
} from './types';
import { getCard, SIN_IDS } from './cards';
import { buildDeck, isBasicInvocationId, shuffle, validateDeck } from './deck';
import { DRAW_PER_TURN, MAX_BOARD, MAX_HAND, MAX_SETUP_INVOCATIONS, OPENING_HAND } from './constants';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const OTHER: Record<PlayerId, PlayerId> = { A: 'B', B: 'A' };

/* ------------------------------------------------------------------ *
 *  Construction
 * ------------------------------------------------------------------ */

function emptyPlayer(id: PlayerId, name: string): PlayerState {
  return {
    id,
    name,
    faction: null,
    connected: false,
    ready: false,
    hero: null,
    board: [],
    hand: [],
    deck: [],
    graveyard: [],
    sinsPlayed: [],
    setupDone: false,
    mulliganDone: false,
    turnsStarted: 0,
    customDeck: null,
  };
}

export function createGame(roomId: string): GameState {
  return {
    roomId,
    status: 'LOBBY',
    players: { A: emptyPlayer('A', 'Joueur A'), B: emptyPlayer('B', 'Joueur B') },
    activePlayer: 'A',
    phase: 'MAIN',
    turnNumber: 0,
    winner: null,
    log: [],
    seq: 1,
  };
}

/**
 * Identifiant unique. Préfixé par la room : plusieurs parties tournent en
 * parallèle sur le même serveur, et deux parties ne doivent jamais produire le
 * même identifiant de carte.
 */
function genId(state: GameState, prefix: string): string {
  return `${prefix}_${state.roomId}_${state.seq++}`;
}

function log(state: GameState, text: string, player?: PlayerId): void {
  state.log.push({ id: state.seq++, text, player });
  if (state.log.length > 60) state.log = state.log.slice(-60);
}

/* ------------------------------------------------------------------ *
 *  Lobby
 * ------------------------------------------------------------------ */

export function setFaction(state: GameState, playerId: PlayerId, faction: Faction): ActionResult {
  if (state.status !== 'LOBBY') return { ok: false, error: 'La partie a déjà commencé.' };
  const p = state.players[playerId];
  p.faction = faction;
  p.customDeck = null; // choisir une faction annule le deck personnalisé
  p.ready = false;
  return { ok: true };
}

/** Deck personnalisé (mix de factions), validé côté serveur. */
export function setCustomDeck(state: GameState, playerId: PlayerId, ids: string[]): ActionResult {
  if (state.status !== 'LOBBY') return { ok: false, error: 'La partie a déjà commencé.' };
  const v = validateDeck(ids);
  if (!v.ok) return { ok: false, error: v.error };
  const p = state.players[playerId];
  p.customDeck = [...ids];
  p.faction = null;
  p.ready = false;
  return { ok: true };
}

function hasDeckChoice(p: PlayerState): boolean {
  return !!p.faction || !!p.customDeck;
}

export function setReady(state: GameState, playerId: PlayerId, ready: boolean): ActionResult {
  if (state.status !== 'LOBBY') return { ok: false, error: 'La partie a déjà commencé.' };
  const p = state.players[playerId];
  if (ready && !hasDeckChoice(p)) return { ok: false, error: "Choisis d'abord une faction ou construis ton deck." };
  p.ready = ready;
  const both = state.players.A.ready && state.players.B.ready && hasDeckChoice(state.players.A) && hasDeckChoice(state.players.B);
  if (both) startGame(state);
  return { ok: true };
}

function makeBoardCard(state: GameState, cardId: string, owner: PlayerId, summonedThisTurn: boolean): BoardCard {
  const def = getCard(cardId);
  return {
    instanceId: genId(state, 'bc'),
    cardId,
    ownerId: owner,
    hp: def.baseHp ?? 0,
    baseHp: def.baseHp ?? 0,
    baseAttack: def.baseAttack ?? 0,
    modifiers: [],
    equipment: [],
    summonedThisTurn,
    hasAttackedThisTurn: false,
    extraAttacks: 0,
  };
}

/**
 * Setup phase (PRD §2) : chaque joueur pioche 10 cartes, place son HERO, puis
 * pourra poser 0 à 4 invocations face cachée avant la révélation du plateau.
 */
export function startGame(state: GameState, rng: () => number = Math.random): void {
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const p = state.players[pid];
    // Le héros n'est plus automatique : le joueur le choisira dans sa main.
    p.hero = null;
    // Build & shuffle the deck (personnalisé si fourni, sinon deck de faction).
    const baseIds = p.customDeck ?? buildDeck(p.faction!);
    const deckIds = shuffle(baseIds, rng);
    p.deck = deckIds.map((cid) => ({ instanceId: genId(state, 'ci'), cardId: cid }));
    p.hand = [];
    p.graveyard = [];
    p.board = [];
    p.sinsPlayed = [];
    p.setupDone = false;
    p.mulliganDone = false;
    p.turnsStarted = 0;
    // Opening hand — garantit au moins une invocation basique pour le héros.
    drawOpeningHand(state, p, rng);
  }
  state.status = 'SETUP';
  state.activePlayer = rng() < 0.5 ? 'A' : 'B'; // pile ou face pour le premier joueur
  state.phase = 'MAIN';
  state.turnNumber = 1;
  state.winner = null;
  log(state, 'Mise en place : échangez vos cartes, choisissez votre HÉRO, puis posez vos invocations face cachée.');
}

/**
 * Pioche la main d'ouverture. Si aucune invocation basique n'est tirée, on
 * échange une carte contre la première invocation basique du deck : sans ça le
 * joueur ne pourrait pas désigner de héros.
 */
function drawOpeningHand(state: GameState, p: PlayerState, rng: () => number): void {
  for (let i = 0; i < OPENING_HAND; i++) {
    const card = p.deck.shift();
    if (card) p.hand.push(card);
  }
  if (p.hand.some((c) => isBasicInvocationId(c.cardId))) return;
  const idx = p.deck.findIndex((c) => isBasicInvocationId(c.cardId));
  if (idx < 0) return; // deck sans invocation basique : impossible via validateDeck
  const basic = p.deck.splice(idx, 1)[0];
  const swapped = p.hand.pop();
  p.hand.push(basic);
  if (swapped) {
    p.deck.push(swapped);
    p.deck = shuffle(p.deck, rng);
  }
}

/** Mulligan à la Hearthstone : renvoie les cartes choisies et repioche autant. */
export function mulligan(state: GameState, playerId: PlayerId, instanceIds: string[], rng: () => number = Math.random): ActionResult {
  if (state.status !== 'SETUP') return { ok: false, error: 'La mise en place est terminée.' };
  const p = state.players[playerId];
  if (p.mulliganDone) return { ok: false, error: 'Tu as déjà échangé tes cartes.' };
  if (p.hero) return { ok: false, error: 'Trop tard : ton héros est déjà choisi.' };

  const toSwap = p.hand.filter((c) => instanceIds.includes(c.instanceId));
  if (toSwap.length > 0) {
    p.hand = p.hand.filter((c) => !instanceIds.includes(c.instanceId));
    // On repioche AVANT de remettre les cartes rendues, pour ne pas les retirer.
    for (let i = 0; i < toSwap.length; i++) {
      const card = p.deck.shift();
      if (card) p.hand.push(card);
    }
    p.deck.push(...toSwap);
    p.deck = shuffle(p.deck, rng);
    // Garantit encore une invocation basique pour pouvoir choisir un héros.
    if (!p.hand.some((c) => isBasicInvocationId(c.cardId))) {
      const idx = p.deck.findIndex((c) => isBasicInvocationId(c.cardId));
      if (idx >= 0) {
        const basic = p.deck.splice(idx, 1)[0];
        const swapped = p.hand.pop();
        p.hand.push(basic);
        if (swapped) p.deck.push(swapped);
        p.deck = shuffle(p.deck, rng);
      }
    }
    log(state, `${p.name} échange ${toSwap.length} carte(s).`, playerId);
  }
  p.mulliganDone = true;
  return { ok: true };
}

/** Le joueur désigne une invocation de sa main comme HÉROS. */
export function chooseHero(state: GameState, playerId: PlayerId, instanceId: string): ActionResult {
  if (state.status !== 'SETUP') return { ok: false, error: 'La mise en place est terminée.' };
  const p = state.players[playerId];
  if (p.hero) return { ok: false, error: 'Ton héros est déjà choisi.' };
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: 'Carte introuvable dans ta main.' };
  const inst = p.hand[idx];
  if (!isBasicInvocationId(inst.cardId)) {
    return { ok: false, error: 'Seule une invocation sans condition peut devenir ton héros.' };
  }
  p.hand.splice(idx, 1);
  // Le héros est posé depuis la main comme n'importe quelle invocation : il subit
  // donc le mal d'invocation et ne peut pas attaquer pendant le 1er tour de son
  // propriétaire (le flag n'est levé qu'à partir de son 2e tour, cf. beginTurn).
  const hero = makeBoardCard(state, inst.cardId, playerId, /* summonedThisTurn */ true);
  hero.instanceId = inst.instanceId;
  hero.isHero = true;
  p.hero = hero;
  p.mulliganDone = true; // choisir son héros verrouille le mulligan
  log(state, `${p.name} choisit son héros.`, playerId);
  return { ok: true };
}

/** Can this hand card be placed face-down during setup? (basic invocation, no sacrifice) */
function isSetupPlaceable(cardId: string): boolean {
  return isBasicInvocationId(cardId);
}

export function setupPlace(state: GameState, playerId: PlayerId, instanceId: string): ActionResult {
  if (state.status !== 'SETUP') return { ok: false, error: 'La mise en place est terminée.' };
  const p = state.players[playerId];
  if (p.setupDone) return { ok: false, error: 'Tu as déjà validé ta mise en place.' };
  if (p.board.length >= MAX_SETUP_INVOCATIONS) return { ok: false, error: `${MAX_SETUP_INVOCATIONS} invocations maximum en mise en place.` };
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: 'Carte introuvable.' };
  const inst = p.hand[idx];
  if (!isSetupPlaceable(inst.cardId)) return { ok: false, error: 'Seules les invocations sans condition peuvent être posées en mise en place.' };
  p.hand.splice(idx, 1);
  // Mal d'invocation : une carte posée en mise en place ne peut pas attaquer
  // pendant le 1er tour de son propriétaire (le flag n'est levé qu'à son 2e tour).
  const bc = makeBoardCard(state, inst.cardId, playerId, /* summonedThisTurn */ true);
  bc.instanceId = inst.instanceId;
  bc.hidden = true;
  p.board.push(bc);
  return { ok: true };
}

export function setupUnplace(state: GameState, playerId: PlayerId, instanceId: string): ActionResult {
  if (state.status !== 'SETUP') return { ok: false, error: 'La mise en place est terminée.' };
  const p = state.players[playerId];
  if (p.setupDone) return { ok: false, error: 'Tu as déjà validé ta mise en place.' };
  const idx = p.board.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: 'Invocation introuvable.' };
  const bc = p.board.splice(idx, 1)[0];
  p.hand.push({ instanceId: bc.instanceId, cardId: bc.cardId });
  return { ok: true };
}

export function setupDone(state: GameState, playerId: PlayerId): ActionResult {
  if (state.status !== 'SETUP') return { ok: false, error: 'La mise en place est terminée.' };
  const p = state.players[playerId];
  if (!p.hero) return { ok: false, error: "Choisis d'abord ton héros parmi tes invocations." };
  p.setupDone = true;
  log(state, `${p.name} est prêt.`, playerId);
  if (state.players.A.setupDone && state.players.B.setupDone) revealAndStart(state);
  return { ok: true };
}

function revealAndStart(state: GameState): void {
  for (const pid of ['A', 'B'] as PlayerId[]) {
    for (const c of state.players[pid].board) c.hidden = false;
  }
  state.status = 'PLAYING';
  recomputeAuras(state);
  log(state, `Révélation du plateau ! ${state.players[state.activePlayer].name} joue en premier.`);
  beginTurn(state, state.activePlayer, /* firstTurn */ true);
}

/* ------------------------------------------------------------------ *
 *  Stat helpers
 * ------------------------------------------------------------------ */

export function cardDef(card: BoardCard): CardDef {
  return getCard(card.cardId);
}

export function maxHp(card: BoardCard): number {
  let hp = card.baseHp;
  for (const m of card.modifiers) if (m.kind === 'HP') hp += m.value ?? 0;
  return Math.max(0, hp);
}

export function attackOf(card: BoardCard): number {
  let atk = card.baseAttack;
  for (const m of card.modifiers) if (m.kind === 'ATTACK') atk += m.value ?? 0;
  return Math.max(0, atk);
}

function defHasPassive(card: BoardCard, action: CardEffect['action']): CardEffect | undefined {
  return cardDef(card).effects?.find((e) => e.trigger === 'PASSIVE' && e.action === action);
}

export function hasTaunt(card: BoardCard): boolean {
  return !!defHasPassive(card, 'TAUNT');
}

export function hasCharge(card: BoardCard): boolean {
  return !!defHasPassive(card, 'CHARGE');
}

export function cannotAttack(card: BoardCard): boolean {
  return card.modifiers.some((m) => m.kind === 'CANNOT_ATTACK');
}

export function isSummoningSick(card: BoardCard): boolean {
  return card.summonedThisTurn && !hasCharge(card);
}

/* ------------------------------------------------------------------ *
 *  Modifiers
 * ------------------------------------------------------------------ */

function addModifier(state: GameState, card: BoardCard, mod: Omit<Modifier, 'id'>): string {
  const id = genId(state, 'mod');
  const full: Modifier = { id, ...mod };
  card.modifiers.push(full);
  if (full.kind === 'HP' && full.value) card.hp += full.value; // heal on apply
  return id;
}

function removeModifierById(card: BoardCard, id: string): void {
  const idx = card.modifiers.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const m = card.modifiers[idx];
  if (m.kind === 'HP' && m.value) card.hp = Math.max(0, card.hp - m.value);
  card.modifiers.splice(idx, 1);
}

/* ------------------------------------------------------------------ *
 *  Board lookups
 * ------------------------------------------------------------------ */

export function allCharacters(state: GameState): BoardCard[] {
  const out: BoardCard[] = [];
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const p = state.players[pid];
    if (p.hero) out.push(p.hero);
    out.push(...p.board);
  }
  return out;
}

export function findCharacter(state: GameState, instanceId: string): BoardCard | undefined {
  return allCharacters(state).find((c) => c.instanceId === instanceId);
}

/* ------------------------------------------------------------------ *
 *  Auras (recomputed on every board change)
 * ------------------------------------------------------------------ */

export function recomputeAuras(state: GameState): void {
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const p = state.players[pid];
    const targets = [...p.board];
    // Remove old aura HP modifiers, tracking the delta so current HP follows.
    for (const c of targets) {
      const oldAuraHp = c.modifiers.filter((m) => m.fromAura && m.kind === 'HP').reduce((s, m) => s + (m.value ?? 0), 0);
      c.modifiers = c.modifiers.filter((m) => !m.fromAura);
      // Reapply based on current aura sources.
      let newAuraHp = 0;
      let newAuraAtk = 0;
      for (const src of p.board) {
        const aura = cardDef(src).effects?.find((e) => e.trigger === 'PASSIVE' && e.action === 'AURA_BUFF');
        if (!aura) continue;
        if (aura.faction && cardDef(c).faction !== aura.faction) continue;
        if (src.instanceId === c.instanceId) continue; // a source does not buff itself
        newAuraAtk += aura.value ?? 0;
        newAuraHp += aura.auraHp ?? 0;
      }
      if (newAuraAtk) c.modifiers.push({ id: genId(state, 'mod'), kind: 'ATTACK', value: newAuraAtk, remainingTurns: null, fromAura: true, label: 'Aura' });
      if (newAuraHp) c.modifiers.push({ id: genId(state, 'mod'), kind: 'HP', value: newAuraHp, remainingTurns: null, fromAura: true, label: 'Aura' });
      // Adjust current HP by the aura HP delta (heal when gained, clamp when lost).
      const delta = newAuraHp - oldAuraHp;
      if (delta > 0) c.hp += delta;
      if (c.hp > maxHp(c)) c.hp = maxHp(c);
    }
  }

  // COPY_ATTACK passive (Véritable Avocat / Ange) — recomputed after auras so it
  // reads final enemy attack values. Attack becomes at least the strongest enemy.
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const foeId = OTHER[pid];
    const enemyChars = [state.players[foeId].hero, ...state.players[foeId].board].filter(Boolean) as BoardCard[];
    const strongestEnemy = enemyChars.reduce((m, e) => Math.max(m, attackOf(e)), 0);
    for (const c of state.players[pid].board) {
      const copy = cardDef(c).effects?.find((e) => e.trigger === 'PASSIVE' && e.action === 'COPY_ATTACK');
      if (!copy) continue;
      const current = attackOf(c);
      const bonus = Math.max(0, strongestEnemy - current);
      if (bonus > 0) c.modifiers.push({ id: genId(state, 'mod'), kind: 'ATTACK', value: bonus, remainingTurns: null, fromAura: true, label: copy.text ?? 'Copie' });
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Requirement engine (summoning conditions)
 * ------------------------------------------------------------------ */

function invocationMatches(card: BoardCard, m: SummoningCondition['match']): boolean {
  if (!m) return true;
  const def = cardDef(card);
  if (m.cardId && def.id !== m.cardId) return false;
  if (m.name && def.name !== m.name) return false;
  if (m.faction && def.faction !== m.faction) return false;
  if (m.rank && def.rank !== m.rank) return false;
  return true;
}

function equipmentMatches(eq: Equipment, m: SummoningCondition['match']): boolean {
  if (!m) return true;
  const def = getCard(eq.cardId);
  if (m.cardId && def.id !== m.cardId) return false;
  if (m.name && def.name !== m.name) return false;
  if (m.faction && def.faction !== m.faction) return false;
  if (m.tag && !(def.tags ?? []).includes(m.tag)) return false;
  return true;
}

function allEquipment(p: PlayerState): { eq: Equipment; holder: BoardCard }[] {
  const out: { eq: Equipment; holder: BoardCard }[] = [];
  const holders = [p.hero, ...p.board].filter(Boolean) as BoardCard[];
  for (const h of holders) for (const eq of h.equipment) out.push({ eq, holder: h });
  return out;
}

export function evaluateConditions(state: GameState, def: CardDef, playerId: PlayerId): boolean {
  const conds = def.summoningConditions;
  if (!conds || conds.length === 0) return true;
  const p = state.players[playerId];
  // Greedily reserve cards so that two conditions do not claim the same card.
  const usedInvocations = new Set<string>();
  const usedEquipment = new Set<string>();
  for (const cond of conds) {
    if (cond.type === 'SEVEN_SINS') {
      if (p.sinsPlayed.length < 7) return false;
      continue;
    }
    if (cond.type === 'SACRIFICE_INVOCATION') {
      const avail = p.board.filter((c) => !usedInvocations.has(c.instanceId) && invocationMatches(c, cond.match));
      if (avail.length < cond.count) return false;
      avail.slice(0, cond.count).forEach((c) => usedInvocations.add(c.instanceId));
    }
    if (cond.type === 'SACRIFICE_OBJECT') {
      const avail = allEquipment(p).filter((e) => !usedEquipment.has(e.eq.instanceId) && equipmentMatches(e.eq, cond.match));
      if (avail.length < cond.count) return false;
      avail.slice(0, cond.count).forEach((e) => usedEquipment.add(e.eq.instanceId));
    }
  }
  return true;
}

function performSacrifices(state: GameState, def: CardDef, playerId: PlayerId): void {
  const conds = def.summoningConditions ?? [];
  const p = state.players[playerId];
  const usedInvocations = new Set<string>();
  const usedEquipment = new Set<string>();
  for (const cond of conds) {
    if (cond.type === 'SACRIFICE_INVOCATION') {
      const chosen = p.board.filter((c) => !usedInvocations.has(c.instanceId) && invocationMatches(c, cond.match)).slice(0, cond.count);
      for (const c of chosen) {
        usedInvocations.add(c.instanceId);
        destroyCharacter(state, c, /* triggerDeath */ false, /* asSacrifice */ true);
      }
    }
    if (cond.type === 'SACRIFICE_OBJECT') {
      const chosen = allEquipment(p).filter((e) => !usedEquipment.has(e.eq.instanceId) && equipmentMatches(e.eq, cond.match)).slice(0, cond.count);
      for (const e of chosen) {
        usedEquipment.add(e.eq.instanceId);
        removeEquipment(state, e.holder, e.eq, /* toGraveyard */ true);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Play targeting requirements (shared with the client for highlighting)
 * ------------------------------------------------------------------ */

export interface PlayRequirement {
  needsTarget: boolean;
  side: 'ALLY' | 'ENEMY' | 'ANY';
  kind: 'CHARACTER' | 'INVOCATION';
  faction?: Faction; // restrict target to a faction (e.g. Champ de Bataille Floral)
  /**
   * Certaines cartes demandent AUSSI de désigner une carte de sa propre main —
   * Envie doit savoir quelle invocation vient prendre la place.
   */
  handPick?: 'BASIC_INVOCATION';
}

const SPECIAL_ACT_REQUIREMENTS: Record<string, PlayRequirement> = {
  soldat_dios_mios: { needsTarget: true, side: 'ENEMY', kind: 'INVOCATION' },
  soldat_reboot: { needsTarget: true, side: 'ALLY', kind: 'INVOCATION' },
  soldat_contract_revo: { needsTarget: true, side: 'ENEMY', kind: 'INVOCATION' },
  avocat_envie: { needsTarget: true, side: 'ALLY', kind: 'INVOCATION', handPick: 'BASIC_INVOCATION' },
  floral_coup_pression: { needsTarget: true, side: 'ALLY', kind: 'INVOCATION' },
};

/** ACT cards resolved by a dedicated engine code path rather than generic effects. */
const SPECIAL_ACT_IDS = new Set<string>([
  'soldat_dios_mios',
  'soldat_reboot',
  'soldat_contract_revo',
  'avocat_gourmandise',
  'avocat_colere',
  'avocat_luxure',
  'avocat_avarice',
  'avocat_envie',
  'floral_coup_pression',
]);

function sideOfTarget(t: TargetType): 'ALLY' | 'ENEMY' | 'ANY' {
  if (t.startsWith('ENEMY')) return 'ENEMY';
  if (t.startsWith('ALLIED')) return 'ALLY';
  return 'ANY';
}

function kindOfTarget(t: TargetType): 'CHARACTER' | 'INVOCATION' {
  return t.includes('INVOCATION') ? 'INVOCATION' : 'CHARACTER';
}

/** Does this play require the player to pick a specific target on the board? */
export function getPlayRequirement(def: CardDef): PlayRequirement {
  if (def.type === 'INVOCATION' || def.type === 'HERO') {
    return { needsTarget: false, side: 'ANY', kind: 'CHARACTER' };
  }
  if (SPECIAL_ACT_REQUIREMENTS[def.id]) return SPECIAL_ACT_REQUIREMENTS[def.id];

  const onPlay = (def.effects ?? []).filter((e) => e.trigger === 'ON_PLAY');
  for (const e of onPlay) {
    const t = e.target ?? 'NONE';
    const auto = t === 'NONE' || t === 'ALLIED_HERO' || t === 'ENEMY_HERO';
    const pickable = !e.massTarget && !auto && e.action !== 'DAMAGE_ALL_INVOCATIONS' && e.action !== 'FLAVOR';
    if (pickable) {
      return { needsTarget: true, side: sideOfTarget(t), kind: kindOfTarget(t), faction: e.faction };
    }
  }
  return { needsTarget: false, side: 'ANY', kind: 'CHARACTER' };
}

/**
 * Conditions de jeu qui ne portent PAS sur une cible du plateau : contenu de la
 * main, du deck adverse… Renvoie la raison du blocage, ou null si la carte est
 * jouable. Le serveur s'en sert pour refuser l'action, le client pour ne pas
 * proposer la carte — les deux lisent donc exactement la même règle.
 */
/** Le deck n'existe que dans l'état complet du serveur (masqué côté client). */
function deckOrNull(p: PlayerState): CardInstance[] | null {
  return Array.isArray(p?.deck) ? p.deck : null;
}

export function playBlockedReason(state: GameState, playerId: PlayerId, def: CardDef): string | null {
  const p = state.players[playerId];
  switch (def.id) {
    case 'avocat_envie': {
      // « … et pose une invocation de ta main à sa place » : sans invocation en
      // main, la carte n'aurait que son inconvénient (renvoyer la tienne).
      if (p.board.length === 0) return "Envie : tu n'as aucune invocation sur le plateau à échanger.";
      if (!p.hand.some((c) => isBasicInvocationId(c.cardId))) {
        return 'Envie : il te faut une invocation en main pour prendre la place.';
      }
      return null;
    }
    // Attention : le client reçoit une vue *redacted* où les decks sont réduits
    // à un compteur. On ne peut donc pas trancher côté client — on laisse
    // passer, le serveur (qui a l'état complet) refusera si besoin.
    case 'avocat_avarice': {
      const deck = deckOrNull(p);
      if (!deck) return null;
      return deck.some((c) => getCard(c.cardId).type === 'OBJET') ? null : 'Avarice : aucun objet dans ton deck.';
    }
    case 'avocat_luxure': {
      const deck = deckOrNull(state.players[OTHER[playerId]]);
      if (!deck) return null;
      return deck.some((c) => getCard(c.cardId).type === 'OBJET')
        ? null
        : 'Luxure : aucun objet dans le deck adverse.';
    }
    default:
      return null;
  }
}

/**
 * Cartes de la main que le joueur peut désigner comme seconde cible.
 * `exclude` écarte la carte en train d'être jouée.
 */
export function legalHandPicks(
  state: GameState,
  playerId: PlayerId,
  def: CardDef,
  exclude?: string,
): CardInstance[] {
  const req = getPlayRequirement(def);
  if (req.handPick !== 'BASIC_INVOCATION') return [];
  return state.players[playerId].hand.filter(
    (c) => c.instanceId !== exclude && isBasicInvocationId(c.cardId),
  );
}

/** Board characters that are legal targets for the given play requirement. */
export function legalPlayTargets(state: GameState, playerId: PlayerId, def: CardDef): BoardCard[] {
  const req = getPlayRequirement(def);
  if (!req.needsTarget) return [];
  const me = state.players[playerId];
  const foe = state.players[OTHER[playerId]];
  let pool: BoardCard[] = [];
  const collect = (p: PlayerState) => {
    if (req.kind === 'CHARACTER' && p.hero) pool.push(p.hero);
    pool.push(...p.board);
  };
  if (req.side === 'ALLY' || req.side === 'ANY') collect(me);
  if (req.side === 'ENEMY' || req.side === 'ANY') collect(foe);
  if (req.faction) pool = pool.filter((c) => cardDef(c).faction === req.faction);
  if (def.id === 'soldat_dios_mios') pool = pool.filter((c) => !!cardDef(c).summoningConditions?.length);
  if (def.id === 'soldat_reboot') pool = pool.filter((c) => c.equipment.length > 0);
  if (def.id === 'floral_coup_pression') pool = pool.filter((c) => cardDef(c).rank === 'C');
  return pool;
}

/* ------------------------------------------------------------------ *
 *  Effect application
 * ------------------------------------------------------------------ */

function turns(duration: CardEffect['duration']): number | null {
  if (duration === undefined) return 1; // instantaneous statuses default to a single turn
  if (duration === 'PERMANENT') return null;
  return duration;
}

/** Apply a single ON_PLAY effect. `picked` is the chosen target (if any). Returns created modifier ids. */
function applyPlayEffect(
  state: GameState,
  playerId: PlayerId,
  effect: CardEffect,
  picked: BoardCard | undefined,
  sourceInstanceId: string | undefined,
  sourceLabel: string,
): string[] {
  const me = state.players[playerId];
  const foe = state.players[OTHER[playerId]];
  const created: string[] = [];

  const resolveAuto = (): BoardCard | undefined => {
    if (picked) return picked;
    switch (effect.target) {
      case 'ALLIED_HERO':
        return me.hero ?? undefined;
      case 'ENEMY_HERO':
        return foe.hero ?? undefined;
      default:
        return undefined;
    }
  };

  switch (effect.action) {
    case 'DAMAGE': {
      const t = resolveAuto();
      if (t) dealDamage(state, t, effect.value ?? 0, sourceLabel);
      break;
    }
    case 'DAMAGE_ALL_INVOCATIONS': {
      const victims = [...me.board, ...foe.board];
      for (const v of victims) dealDamage(state, v, effect.value ?? 0, sourceLabel);
      break;
    }
    case 'HEAL':
    case 'BUFF_HP': {
      const t = resolveAuto();
      if (t) created.push(addModifier(state, t, { kind: 'HP', value: effect.value ?? 0, remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      break;
    }
    case 'BUFF_ATTACK': {
      if (effect.massTarget) {
        for (const t of me.board) created.push(addModifier(state, t, { kind: 'ATTACK', value: effect.value ?? 0, remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      } else {
        const t = resolveAuto();
        if (t) created.push(addModifier(state, t, { kind: 'ATTACK', value: effect.value ?? 0, remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      }
      break;
    }
    case 'POISON': {
      const t = resolveAuto();
      if (t) created.push(addModifier(state, t, { kind: 'POISON', value: effect.value ?? 0, remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      break;
    }
    case 'SELF_HARM': {
      // « Se blesse elle-même » : la cible s'inflige sa PROPRE attaque à chaque
      // début de son tour. La valeur n'est donc pas fixée à la pose, elle est
      // relue au moment du tic (une cible boostée se fait plus mal).
      const t = resolveAuto();
      if (t) created.push(addModifier(state, t, { kind: 'SELF_HARM', remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      break;
    }
    case 'CANNOT_ATTACK': {
      const side = effect.target && effect.target.startsWith('ALLIED') ? me.board : foe.board;
      const pool = effect.massTarget ? side : picked ? [picked] : [];
      for (const t of pool) created.push(addModifier(state, t, { kind: 'CANNOT_ATTACK', remainingTurns: turns(effect.duration), sourceInstanceId, label: sourceLabel }));
      break;
    }
    case 'DRAW': {
      drawCards(state, playerId, effect.value ?? 1);
      break;
    }
    case 'FLAVOR':
    default:
      break;
  }
  return created;
}

/* ------------------------------------------------------------------ *
 *  Damage & death
 * ------------------------------------------------------------------ */

export function dealDamage(state: GameState, target: BoardCard, amount: number, source: string): void {
  if (amount <= 0) return;
  target.hp -= amount;
  log(state, `${cardDef(target).name} subit ${amount} dégâts (${source}).`, target.ownerId);
  if (target.hp <= 0) destroyCharacter(state, target, true, false);
}

function removeEquipment(state: GameState, holder: BoardCard, eq: Equipment, toGraveyard: boolean): void {
  for (const id of eq.modifierIds) removeModifierById(holder, id);
  holder.equipment = holder.equipment.filter((e) => e.instanceId !== eq.instanceId);
  if (toGraveyard) state.players[holder.ownerId].graveyard.push({ instanceId: eq.instanceId, cardId: eq.cardId });
}

/** Remove a character from the board. Handles hero death (win), ON_DEATH triggers, graveyard. */
export function destroyCharacter(state: GameState, card: BoardCard, triggerDeath: boolean, asSacrifice: boolean): void {
  const owner = state.players[card.ownerId];
  const def = cardDef(card);

  if (card.isHero || owner.hero?.instanceId === card.instanceId) {
    // Hero destroyed → the owner loses.
    state.winner = OTHER[card.ownerId];
    state.status = 'FINISHED';
    log(state, `${def.name} est vaincu ! ${state.players[OTHER[card.ownerId]].name} remporte la partie.`);
    return;
  }

  // Remove from board.
  const idx = owner.board.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return;
  owner.board.splice(idx, 1);

  // Equipped objects fall to the graveyard.
  for (const eq of [...card.equipment]) removeEquipment(state, card, eq, true);

  // The creature itself goes to the graveyard.
  owner.graveyard.push({ instanceId: card.instanceId, cardId: card.cardId });
  log(state, asSacrifice ? `${def.name} est sacrifié.` : `${def.name} est détruit.`, card.ownerId);

  // ON_DEATH triggers (e.g. Rebelle Révolutionnaire, Karma Floral).
  if (triggerDeath) {
    for (const e of def.effects ?? []) {
      if (e.trigger !== 'ON_DEATH') continue;
      if (e.action === 'SUMMON_FROM_DECK' && e.summonCardId) summonFromDeck(state, card.ownerId, e.summonCardId, e.text ?? def.name);
      if (e.action === 'SUMMON_TOKEN' && e.summonCardId) summonToken(state, card.ownerId, e.summonCardId, e.text ?? def.name);
    }
  }
  recomputeAuras(state);
}

/**
 * Crée une carte-conséquence directement sur le plateau (elle n'existe ni dans
 * le deck ni dans la main — ex: Dévoreur de Papillons via Karma Floral).
 */
function summonToken(state: GameState, playerId: PlayerId, cardId: string, label: string): void {
  const p = state.players[playerId];
  if (p.board.length >= MAX_BOARD) return;
  const bc = makeBoardCard(state, cardId, playerId, true);
  p.board.push(bc);
  log(state, `${label} : ${getCard(cardId).name} apparaît sur le terrain !`, playerId);
  recomputeAuras(state);
}

function summonFromDeck(state: GameState, playerId: PlayerId, cardId: string, label: string): void {
  const p = state.players[playerId];
  if (p.board.length >= MAX_BOARD) return;
  const idx = p.deck.findIndex((c) => c.cardId === cardId);
  if (idx < 0) return;
  const inst = p.deck.splice(idx, 1)[0];
  const bc = makeBoardCard(state, inst.cardId, playerId, true);
  bc.instanceId = inst.instanceId;
  p.board.push(bc);
  log(state, `${label} : ${getCard(cardId).name} est invoqué depuis le deck !`, playerId);
  recomputeAuras(state);
}

/* ------------------------------------------------------------------ *
 *  Turn structure
 * ------------------------------------------------------------------ */

/**
 * Pioche `count` cartes.
 *
 * Main pleine : la carte **reste sur le dessus du deck**, elle n'est pas
 * défaussée. La main d'ouverture étant déjà à la limite (10), la brûler
 * envoyait une carte au cimetière dès le premier tour, sans que le joueur ait
 * rien fait — comportement incompréhensible en jeu.
 */
function drawCards(state: GameState, playerId: PlayerId, count: number): void {
  const p = state.players[playerId];
  let skipped = 0;
  for (let i = 0; i < count; i++) {
    if (p.hand.length >= MAX_HAND) {
      skipped++;
      continue;
    }
    const card = p.deck.shift();
    if (!card) {
      log(state, `${p.name} n'a plus de cartes à piocher !`, playerId);
      continue;
    }
    p.hand.push(card);
  }
  if (skipped > 0) {
    log(state, `Main pleine (${MAX_HAND}) — ${skipped} pioche(s) reportée(s), rien n'est perdu.`, playerId);
  }
}

export function beginTurn(state: GameState, playerId: PlayerId, firstTurn = false): void {
  const p = state.players[playerId];
  p.turnsStarted += 1;
  const chars = [p.hero, ...p.board].filter(Boolean) as BoardCard[];

  // Reset combat flags. Le mal d'invocation n'est levé qu'à partir du 2e tour
  // du joueur : les invocations posées en mise en place restent donc
  // endormies pendant tout son 1er tour.
  for (const c of chars) {
    if (p.turnsStarted > 1) c.summonedThisTurn = false;
    c.hasAttackedThisTurn = false;
    c.extraAttacks = 0;
  }

  // Start-of-turn: poison / auto-blessure + per-turn attack growth.
  for (const c of [...chars]) {
    for (const m of [...c.modifiers]) {
      if (m.kind !== 'POISON' && m.kind !== 'SELF_HARM') continue;
      // L'auto-blessure vaut l'attaque COURANTE de la carte, relue à chaque tic.
      const amount = m.kind === 'SELF_HARM' ? attackOf(c) : m.value ?? 0;
      dealDamage(state, c, amount, m.kind === 'SELF_HARM' ? m.label ?? 'Auto-blessure' : 'Poison');
      if (c.hp <= 0) break;
      if (m.remainingTurns !== null) {
        m.remainingTurns -= 1;
        if (m.remainingTurns <= 0) removeModifierById(c, m.id);
      }
    }
  }
  for (const c of p.board) {
    const gain = cardDef(c).effects?.find((e) => e.trigger === 'PASSIVE' && e.action === 'GAIN_ATTACK_PER_TURN');
    if (gain) {
      addModifier(state, c, { kind: 'ATTACK', value: gain.value ?? 0, remainingTurns: null, label: gain.text ?? 'Aura' });
      log(state, `${cardDef(c).name} gagne +${gain.value} attaque (${gain.text ?? 'Culture de l\'Aura'}).`, playerId);
    }
  }

  // Draw.
  drawCards(state, playerId, DRAW_PER_TURN);
  recomputeAuras(state);
  log(state, `— Tour ${state.turnNumber} : au tour de ${p.name}.`, playerId);
}

function decrementTempModifiers(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  const chars = [p.hero, ...p.board].filter(Boolean) as BoardCard[];
  for (const c of chars) {
    for (const m of [...c.modifiers]) {
      if (m.fromAura || m.remainingTurns === null) continue;
      // Poison et auto-blessure sont décomptés à leur tic, en début de tour.
      if (m.kind === 'POISON' || m.kind === 'SELF_HARM') continue;
      m.remainingTurns -= 1;
      if (m.remainingTurns <= 0) removeModifierById(c, m.id);
    }
  }
}

function cleanupSpentEquipment(state: GameState): void {
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const p = state.players[pid];
    const holders = [p.hero, ...p.board].filter(Boolean) as BoardCard[];
    for (const h of holders) {
      for (const eq of [...h.equipment]) {
        const stillActive = eq.modifierIds.some((id) => h.modifiers.some((m) => m.id === id));
        if (!stillActive) removeEquipment(state, h, eq, true);
      }
    }
  }
}

function deathSweep(state: GameState): void {
  for (const c of allCharacters(state)) {
    if (c.hp <= 0) destroyCharacter(state, c, true, false);
  }
}

export function endTurn(state: GameState, playerId: PlayerId): ActionResult {
  if (state.status !== 'PLAYING') return { ok: false, error: 'La partie est terminée.' };
  if (state.activePlayer !== playerId) return { ok: false, error: "Ce n'est pas ton tour." };

  decrementTempModifiers(state, playerId);
  cleanupSpentEquipment(state);
  deathSweep(state);
  recomputeAuras(state);
  if (state.winner) return { ok: true };

  const next = OTHER[playerId];
  state.activePlayer = next;
  state.phase = 'MAIN';
  state.turnNumber += 1;
  beginTurn(state, next);
  deathSweep(state);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Playing a card
 * ------------------------------------------------------------------ */

function requirePlaying(state: GameState, playerId: PlayerId): ActionResult | null {
  if (state.status !== 'PLAYING') return { ok: false, error: 'La partie est terminée.' };
  if (state.activePlayer !== playerId) return { ok: false, error: "Ce n'est pas ton tour." };
  return null;
}

function playCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
  handTargetInstanceId?: string,
): ActionResult {
  const guard = requirePlaying(state, playerId);
  if (guard) return guard;
  if (state.phase !== 'MAIN') return { ok: false, error: 'Les cartes se jouent en Phase Principale.' };

  const p = state.players[playerId];
  const handIdx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (handIdx < 0) return { ok: false, error: 'Carte introuvable dans ta main.' };
  const inst = p.hand[handIdx];
  const def = getCard(inst.cardId);

  const blocked = playBlockedReason(state, playerId, def);
  if (blocked) return { ok: false, error: blocked };

  if (def.type === 'INVOCATION') return playInvocation(state, playerId, handIdx, inst, def);
  if (def.type === 'OBJET') return playObject(state, playerId, handIdx, inst, def, targetInstanceId);
  if (def.type === 'ACT') return playAct(state, playerId, handIdx, inst, def, targetInstanceId, handTargetInstanceId);
  return { ok: false, error: 'Type de carte injouable.' };
}

function playInvocation(state: GameState, playerId: PlayerId, handIdx: number, inst: CardInstance, def: CardDef): ActionResult {
  const p = state.players[playerId];
  if (p.board.length >= MAX_BOARD) return { ok: false, error: 'Le plateau est plein (4 invocations max).' };
  if (!evaluateConditions(state, def, playerId)) return { ok: false, error: `Conditions d'invocation non remplies pour ${def.name}.` };

  if (def.summoningConditions?.length) performSacrifices(state, def, playerId);

  p.hand.splice(handIdx, 1);
  const bc = makeBoardCard(state, inst.cardId, playerId, true);
  bc.instanceId = inst.instanceId;
  p.board.push(bc);
  log(state, `${p.name} invoque ${def.name}.`, playerId);

  // ON_PLAY effects.
  for (const e of def.effects ?? []) {
    if (e.trigger === 'ON_PLAY') applyPlayEffect(state, playerId, e, undefined, bc.instanceId, def.name);
  }
  recomputeAuras(state);
  deathSweep(state);
  return { ok: true };
}

function resolveTarget(state: GameState, playerId: PlayerId, def: CardDef, targetInstanceId?: string): { ok: true; target?: BoardCard } | { ok: false; error: string } {
  const req = getPlayRequirement(def);
  if (!req.needsTarget) return { ok: true, target: undefined };
  const legal = legalPlayTargets(state, playerId, def);
  if (legal.length === 0) return { ok: false, error: `Aucune cible valide pour ${def.name}.` };
  if (!targetInstanceId) return { ok: false, error: 'Cette carte nécessite une cible.' };
  const target = legal.find((c) => c.instanceId === targetInstanceId);
  if (!target) return { ok: false, error: 'Cible invalide.' };
  return { ok: true, target };
}

function playObject(state: GameState, playerId: PlayerId, handIdx: number, inst: CardInstance, def: CardDef, targetInstanceId?: string): ActionResult {
  const res = resolveTarget(state, playerId, def, targetInstanceId);
  if (!res.ok) return { ok: false, error: res.error };
  const target = res.target;
  if (!target) return { ok: false, error: `${def.name} nécessite une cible.` };

  const p = state.players[playerId];
  p.hand.splice(handIdx, 1);

  const equipment: Equipment = { instanceId: inst.instanceId, cardId: inst.cardId, modifierIds: [] };
  for (const e of def.effects ?? []) {
    if (e.trigger !== 'ON_PLAY') continue;
    const ids = applyPlayEffect(state, playerId, e, target, inst.instanceId, def.name);
    equipment.modifierIds.push(...ids);
  }
  // Attach only if it left lasting modifiers; pure poison/consumables still attach so
  // Reboot / sacrifices can interact with them, but empty (flavor) objects go straight to the graveyard.
  if (equipment.modifierIds.length > 0) {
    target.equipment.push(equipment);
  } else {
    p.graveyard.push(inst);
  }
  log(state, `${p.name} équipe ${def.name} sur ${cardDef(target).name}.`, playerId);
  recomputeAuras(state);
  deathSweep(state);
  return { ok: true };
}

function playAct(
  state: GameState,
  playerId: PlayerId,
  handIdx: number,
  inst: CardInstance,
  def: CardDef,
  targetInstanceId?: string,
  handTargetInstanceId?: string,
): ActionResult {
  const res = resolveTarget(state, playerId, def, targetInstanceId);
  if (!res.ok) return { ok: false, error: res.error };
  const target = res.target;

  const p = state.players[playerId];

  // La carte quitte la main AVANT résolution : sinon elle occupe encore un
  // emplacement et fausse les effets qui remplissent la main (Avarice, Luxure,
  // Reboot). En cas d'échec elle est remise exactement là où elle était.
  p.hand.splice(handIdx, 1);

  // Bespoke ACTs.
  if (SPECIAL_ACT_IDS.has(def.id)) {
    const special = resolveSpecialAct(state, playerId, def, target, handTargetInstanceId);
    if (!special.ok) {
      p.hand.splice(handIdx, 0, inst);
      return special;
    }
  } else {
    for (const e of def.effects ?? []) {
      if (e.trigger === 'ON_PLAY') applyPlayEffect(state, playerId, e, target, undefined, def.name);
    }
  }

  p.graveyard.push(inst);
  if ((def.tags ?? []).includes('sin') && !p.sinsPlayed.includes(def.id)) {
    p.sinsPlayed.push(def.id);
    log(state, `${p.name} commet le péché de ${def.name} (${p.sinsPlayed.length}/7).`, playerId);
  } else {
    log(state, `${p.name} joue ${def.name}.`, playerId);
  }
  recomputeAuras(state);
  deathSweep(state);
  return { ok: true };
}

function resolveSpecialAct(
  state: GameState,
  playerId: PlayerId,
  def: CardDef,
  target: BoardCard | undefined,
  handTargetInstanceId?: string,
): ActionResult {
  const p = state.players[playerId];
  switch (def.id) {
    case 'soldat_dios_mios': {
      if (!target) return { ok: false, error: 'Choisis une invocation adverse à sacrifier.' };
      log(state, `Dios Mios renvoie ${cardDef(target).name} au cimetière.`, playerId);
      destroyCharacter(state, target, false, false);
      return { ok: true };
    }
    case 'soldat_reboot': {
      if (!target || target.equipment.length === 0) return { ok: false, error: 'Choisis une invocation équipée.' };
      // Plutôt que de détruire l'objet récupéré, on refuse : rien ne se perd.
      if (p.hand.length >= MAX_HAND) return { ok: false, error: 'Ta main est pleine, tu ne peux pas récupérer l\'objet.' };
      const eq = target.equipment[target.equipment.length - 1];
      for (const id of eq.modifierIds) removeModifierById(target, id);
      target.equipment = target.equipment.filter((e) => e.instanceId !== eq.instanceId);
      p.hand.push({ instanceId: eq.instanceId, cardId: eq.cardId });
      log(state, `Reboot récupère ${getCard(eq.cardId).name} dans la main.`, playerId);
      return { ok: true };
    }
    case 'soldat_contract_revo': {
      if (!target) return { ok: false, error: 'Choisis une invocation adverse.' };
      if (p.board.length >= MAX_BOARD) return { ok: false, error: 'Ton plateau est plein, impossible de prendre le contrôle.' };
      const foe = state.players[OTHER[playerId]];
      foe.board = foe.board.filter((c) => c.instanceId !== target.instanceId);
      target.ownerId = playerId;
      target.summonedThisTurn = true;
      target.hasAttackedThisTurn = false;
      p.board.push(target);
      log(state, `Contract Révolutionnaire : ${cardDef(target).name} change de camp !`, playerId);
      recomputeAuras(state);
      return { ok: true };
    }
    case 'avocat_gourmandise': {
      // Multiplie par 2 les bonus de PV des objets équipés sur ton camp.
      let doubled = 0;
      for (const holder of [p.hero, ...p.board].filter(Boolean) as BoardCard[]) {
        for (const eq of holder.equipment) {
          for (const mid of [...eq.modifierIds]) {
            const m = holder.modifiers.find((x) => x.id === mid);
            if (m && m.kind === 'HP' && (m.value ?? 0) > 0) {
              const id = addModifier(state, holder, { kind: 'HP', value: m.value, remainingTurns: m.remainingTurns, sourceInstanceId: eq.instanceId, label: 'Gourmandise' });
              eq.modifierIds.push(id);
              doubled++;
            }
          }
        }
      }
      log(state, `Gourmandise double ${doubled} bonus de PV.`, playerId);
      return { ok: true };
    }
    case 'avocat_colere': {
      // Multiplie par 2 les bonus d'attaque des objets équipés sur ton camp.
      let doubled = 0;
      for (const holder of [p.hero, ...p.board].filter(Boolean) as BoardCard[]) {
        for (const eq of holder.equipment) {
          for (const mid of [...eq.modifierIds]) {
            const m = holder.modifiers.find((x) => x.id === mid);
            if (m && m.kind === 'ATTACK' && (m.value ?? 0) > 0) {
              const id = addModifier(state, holder, { kind: 'ATTACK', value: m.value, remainingTurns: m.remainingTurns, sourceInstanceId: eq.instanceId, label: 'Colère' });
              eq.modifierIds.push(id);
              doubled++;
            }
          }
        }
      }
      log(state, `Colère double ${doubled} bonus d'attaque.`, playerId);
      return { ok: true };
    }
    case 'avocat_luxure': {
      if (p.hand.length >= MAX_HAND) return { ok: false, error: `Ta main est pleine (${MAX_HAND} cartes).` };
      // Vole un objet du deck adverse et ajoute-le à ta main.
      const foe = state.players[OTHER[playerId]];
      const idx = foe.deck.findIndex((c) => getCard(c.cardId).type === 'OBJET');
      if (idx < 0) return { ok: false, error: 'Aucun objet dans le deck adverse.' };
      const stolen = foe.deck.splice(idx, 1)[0];
      p.hand.push(stolen);
      log(state, `Luxure vole ${getCard(stolen.cardId).name} du deck adverse.`, playerId);
      return { ok: true };
    }
    case 'avocat_avarice': {
      if (p.hand.length >= MAX_HAND) return { ok: false, error: `Ta main est pleine (${MAX_HAND} cartes).` };
      // Cherche un objet dans ton deck et ajoute-le à ta main.
      const idx = p.deck.findIndex((c) => getCard(c.cardId).type === 'OBJET');
      if (idx < 0) return { ok: false, error: 'Aucun objet dans ton deck.' };
      const found = p.deck.splice(idx, 1)[0];
      p.hand.push(found);
      log(state, `Avarice récupère ${getCard(found.cardId).name} du deck.`, playerId);
      return { ok: true };
    }
    case 'avocat_envie': {
      // Le joueur désigne lui-même l'invocation de sa main qui prend la place.
      if (!target) return { ok: false, error: 'Choisis une de tes invocations sur le plateau.' };
      const swapIdx = handTargetInstanceId
        ? p.hand.findIndex((c) => c.instanceId === handTargetInstanceId)
        : -1;
      if (swapIdx < 0) return { ok: false, error: 'Choisis l\'invocation de ta main qui prend sa place.' };
      if (!isBasicInvocationId(p.hand[swapIdx].cardId)) {
        return { ok: false, error: 'Seule une invocation sans condition peut prendre la place.' };
      }

      p.board = p.board.filter((c) => c.instanceId !== target.instanceId);
      for (const eq of [...target.equipment]) removeEquipment(state, target, eq, true);
      const arriving = p.hand.splice(swapIdx, 1)[0];
      p.hand.push({ instanceId: target.instanceId, cardId: target.cardId });

      const bc = makeBoardCard(state, arriving.cardId, playerId, true);
      bc.instanceId = arriving.instanceId;
      p.board.push(bc);
      log(state, `Envie : ${cardDef(target).name} retourne en main, ${getCard(arriving.cardId).name} arrive.`, playerId);
      recomputeAuras(state);
      return { ok: true };
    }
    case 'floral_coup_pression': {
      // Une invocation de rang C attaque une 2e fois ce tour, mais subit 30 dégâts.
      if (!target) return { ok: false, error: 'Choisis une invocation de rang C.' };
      if (cardDef(target).rank !== 'C') return { ok: false, error: 'Cible une invocation de rang C.' };
      target.extraAttacks += 1;
      log(state, `Coup de Pression : ${cardDef(target).name} pourra frapper une 2e fois (−30 PV).`, playerId);
      dealDamage(state, target, 30, 'Coup de Pression');
      return { ok: true };
    }
    default:
      return { ok: false, error: 'Effet inconnu.' };
  }
}

/* ------------------------------------------------------------------ *
 *  Combat
 * ------------------------------------------------------------------ */

function attack(state: GameState, playerId: PlayerId, attackerId: string, targetId: string): ActionResult {
  const guard = requirePlaying(state, playerId);
  if (guard) return guard;
  if (state.phase !== 'COMBAT') return { ok: false, error: 'Passe en Phase de Combat pour attaquer.' };

  const me = state.players[playerId];
  const foe = state.players[OTHER[playerId]];

  const attacker = [me.hero, ...me.board].filter(Boolean).find((c) => c!.instanceId === attackerId) as BoardCard | undefined;
  if (!attacker) return { ok: false, error: "Cet attaquant ne t'appartient pas." };
  if (attacker.ownerId !== playerId) return { ok: false, error: "Cet attaquant ne t'appartient pas." };
  if (isSummoningSick(attacker)) return { ok: false, error: "Mal d'invocation : cette carte ne peut pas attaquer ce tour." };
  if (cannotAttack(attacker)) return { ok: false, error: 'Cette carte est empêchée d\'attaquer.' };
  if (attacker.hasAttackedThisTurn && attacker.extraAttacks <= 0) return { ok: false, error: 'Cette carte a déjà attaqué ce tour.' };
  if (attackOf(attacker) <= 0) return { ok: false, error: "Cette carte n'a pas d'attaque." };

  const target = [foe.hero, ...foe.board].filter(Boolean).find((c) => c!.instanceId === targetId) as BoardCard | undefined;
  if (!target) return { ok: false, error: 'Cible adverse introuvable.' };

  // Provocation globale : toutes les invocations protègent le héros. On ne peut
  // viser le héros que si le plateau adverse est vide. Une carte avec le mot-clé
  // Provocation reste prioritaire sur les autres invocations.
  const isHeroTarget = target.instanceId === foe.hero?.instanceId;
  if (isHeroTarget && foe.board.length > 0) {
    return { ok: false, error: "Tu dois d'abord détruire les invocations adverses avant d'attaquer le héros." };
  }
  const taunts = foe.board.filter((c) => hasTaunt(c));
  if (!isHeroTarget && taunts.length > 0 && !hasTaunt(target)) {
    return { ok: false, error: 'Une provocation adverse doit être attaquée en premier.' };
  }

  const dmg = attackOf(attacker);
  if (attacker.hasAttackedThisTurn && attacker.extraAttacks > 0) attacker.extraAttacks -= 1;
  else attacker.hasAttackedThisTurn = true;
  log(state, `${cardDef(attacker).name} attaque ${cardDef(target).name} (${dmg}).`, playerId);
  dealDamage(state, target, dmg, cardDef(attacker).attackName ?? 'Attaque');
  recomputeAuras(state);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Public action entry point
 * ------------------------------------------------------------------ */

export function applyAction(state: GameState, playerId: PlayerId, action: GameAction): ActionResult {
  switch (action.type) {
    case 'MULLIGAN':
      return mulligan(state, playerId, action.instanceIds);
    case 'CHOOSE_HERO':
      return chooseHero(state, playerId, action.instanceId);
    case 'SETUP_PLACE':
      return setupPlace(state, playerId, action.instanceId);
    case 'SETUP_UNPLACE':
      return setupUnplace(state, playerId, action.instanceId);
    case 'SETUP_DONE':
      return setupDone(state, playerId);
    case 'PLAY_CARD':
      return playCard(state, playerId, action.instanceId, action.targetInstanceId, action.handTargetInstanceId);
    case 'ATTACK':
      return attack(state, playerId, action.attackerInstanceId, action.targetInstanceId);
    case 'NEXT_PHASE': {
      const guard = requirePlaying(state, playerId);
      if (guard) return guard;
      if (state.phase === 'MAIN') {
        state.phase = 'COMBAT';
        log(state, `${state.players[playerId].name} passe en Phase de Combat.`, playerId);
        return { ok: true };
      }
      return { ok: false, error: 'Tu es déjà en Phase de Combat.' };
    }
    case 'END_TURN':
      return endTurn(state, playerId);
    default:
      return { ok: false, error: 'Action inconnue.' };
  }
}

/* ------------------------------------------------------------------ *
 *  Redaction (hide opponent's hidden information)
 * ------------------------------------------------------------------ */

/** Strip a face-down board card of its identity for the opponent's view. */
function maskCard(c: BoardCard): BoardCard {
  return { ...c, cardId: '', hidden: true, modifiers: [], equipment: [] };
}

function redactPlayer(p: PlayerState, isYou: boolean): RedactedPlayerState {
  const board = isYou ? p.board : p.board.map((c) => (c.hidden ? maskCard(c) : c));
  return {
    id: p.id,
    name: p.name,
    faction: p.faction,
    connected: p.connected,
    ready: p.ready,
    hero: p.hero,
    board,
    hand: isYou ? p.hand : p.hand.map(() => null),
    handCount: p.hand.length,
    deckCount: p.deck.length,
    graveyard: p.graveyard,
    sinsPlayed: p.sinsPlayed,
    setupDone: p.setupDone,
    mulliganDone: p.mulliganDone,
    customDeckSize: p.customDeck ? p.customDeck.length : null,
  };
}

export function serializeFor(state: GameState, you: PlayerId): RedactedGameState {
  return {
    roomId: state.roomId,
    status: state.status,
    you,
    players: {
      A: redactPlayer(state.players.A, you === 'A'),
      B: redactPlayer(state.players.B, you === 'B'),
    },
    activePlayer: state.activePlayer,
    phase: state.phase,
    turnNumber: state.turnNumber,
    winner: state.winner,
    log: state.log,
  };
}
