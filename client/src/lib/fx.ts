import type { BoardCard, PlayerId, RedactedGameState } from '@boloss/shared';

/**
 * Détection des évènements à animer, par comparaison de deux états successifs.
 *
 * Purement cosmétique : on ne touche ni au moteur, ni aux définitions de cartes.
 * Le serveur reste seul maître du jeu, on se contente de regarder ce qui a
 * changé entre deux instantanés pour déclencher la bonne animation.
 */

export interface AttackFx {
  /** Instance de l'attaquant — c'est elle qui charge. */
  from: string;
  /** Instance de la cible, quand on a pu l'identifier (coup sans dégâts, etc.). */
  to: string | null;
  /** Horodatage : sert de déclencheur côté composant. */
  at: number;
}

function characters(g: RedactedGameState): Map<string, { card: BoardCard; owner: PlayerId }> {
  const m = new Map<string, { card: BoardCard; owner: PlayerId }>();
  for (const pid of ['A', 'B'] as PlayerId[]) {
    const p = g.players[pid];
    if (p.hero) m.set(p.hero.instanceId, { card: p.hero, owner: pid });
    for (const c of p.board) m.set(c.instanceId, { card: c, owner: pid });
  }
  return m;
}

/**
 * Repère l'attaque qui vient d'être résolue.
 *
 * L'attaquant est la carte qui a « consommé » une attaque (le moteur passe
 * `hasAttackedThisTurn` à vrai, ou décrémente `extraAttacks` pour une seconde
 * frappe). La cible est, en face, celle qui a perdu des PV — ou qui a disparu
 * du plateau si le coup l'a tuée.
 */
export function detectAttack(prev: RedactedGameState | null, next: RedactedGameState): AttackFx | null {
  if (!prev) return null;
  const before = characters(prev);
  const after = characters(next);

  let attacker: { id: string; owner: PlayerId } | null = null;
  for (const [id, cur] of after) {
    const old = before.get(id);
    if (!old) continue;
    const swung =
      (!old.card.hasAttackedThisTurn && cur.card.hasAttackedThisTurn) ||
      (cur.card.hasAttackedThisTurn && cur.card.extraAttacks < old.card.extraAttacks);
    if (swung) {
      attacker = { id, owner: cur.owner };
      break;
    }
  }
  if (!attacker) return null;

  let target: string | null = null;
  let worst = 0;
  for (const [id, old] of before) {
    if (old.owner === attacker.owner) continue;
    const cur = after.get(id);
    if (!cur) {
      target = id; // tuée sur le coup
      break;
    }
    const lost = old.card.hp - cur.card.hp;
    if (lost > worst) {
      worst = lost;
      target = id;
    }
  }

  // La charge s'anime dès qu'on sait qui a frappé : une attaque à 0 dégât, ou
  // encaissée par un effet, reste une attaque.
  return { from: attacker.id, to: target, at: Date.now() };
}
