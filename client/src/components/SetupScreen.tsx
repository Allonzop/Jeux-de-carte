import {
  getCard,
  MAX_SETUP_INVOCATIONS,
  type BoardCard,
  type PlayerId,
  type RedactedGameState,
} from '@boloss/shared';
import { useStore } from '../store';
import CardView from './CardView';

/** Peut-on poser cette carte face cachée en mise en place ? (invocation sans condition) */
function placeable(cardId: string): boolean {
  const d = getCard(cardId);
  return d.type === 'INVOCATION' && !d.summoningConditions?.length;
}

export default function SetupScreen({ game }: { game: RedactedGameState }) {
  const you = game.you;
  const me = game.players[you];
  const foe = game.players[you === 'A' ? 'B' : 'A'];
  const setupPlace = useStore((s) => s.setupPlace);
  const setupUnplace = useStore((s) => s.setupUnplace);
  const setupReady = useStore((s) => s.setupReady);

  const locked = me.setupDone;
  const boardFull = me.board.length >= MAX_SETUP_INVOCATIONS;

  const emptySlots = Math.max(0, MAX_SETUP_INVOCATIONS - me.board.length);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <header className="text-center">
        <h1 className="font-display text-4xl text-boloss-gold">Mise en place</h1>
        <p className="text-white/70">
          Pose ton HÉRO et jusqu'à {MAX_SETUP_INVOCATIONS} invocations <b>face cachée</b>, puis lance le combat.
          <br />
          <span className="text-white/50 text-sm">
            Astuce : poser des invocations réduit ta main de 10 et évite de défausser à la première pioche.
          </span>
        </p>
      </header>

      {/* Adversaire */}
      <section className="rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-white/70">{foe.name}</span>
          <span className={foe.setupDone ? 'text-emerald-400' : 'text-white/40'}>
            {foe.setupDone ? 'Prêt ✓' : 'Mise en place…'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {foe.hero && <CardView cardId={foe.hero.cardId} board={foe.hero} size="sm" />}
          <div className="flex gap-1">
            {foe.board.length === 0 && <span className="text-xs text-white/30">Aucune invocation posée</span>}
            {foe.board.map((c) => (
              <CardView key={c.instanceId} faceDown size="sm" />
            ))}
          </div>
        </div>
      </section>

      {/* Ton terrain */}
      <section className="rounded-xl border border-boloss-gold/30 bg-black/25 p-3">
        <div className="mb-2 text-sm text-white/70">Ton terrain</div>
        <div className="flex flex-wrap items-center gap-3">
          {me.hero && (
            <div className="flex flex-col items-center">
              <CardView cardId={me.hero.cardId} board={me.hero} size="md" />
              <span className="mt-1 text-[10px] uppercase tracking-wide text-white/40">Héro</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {me.board.map((c: BoardCard) => (
              <div key={c.instanceId} className="flex flex-col items-center">
                <CardView
                  cardId={c.cardId}
                  board={c}
                  size="md"
                  highlight={locked ? 'none' : 'selected'}
                  onClick={locked ? undefined : () => setupUnplace(c.instanceId)}
                />
                <span className="mt-1 text-[10px] text-white/40">{locked ? 'posée' : 'retirer'}</span>
              </div>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={i} className="flex w-24 sm:w-[6.5rem] aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-[10px] text-white/25">
                slot libre
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bouton prêt */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={setupReady}
          disabled={locked}
          className="rounded-lg bg-boloss-red px-8 py-3 font-display text-2xl tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {locked ? 'En attente de l’adversaire…' : 'Commencer le combat ⚔'}
        </button>
      </div>

      {/* Ta main */}
      <section>
        <div className="mb-1 text-center text-xs uppercase tracking-wide text-white/40">
          Ta main ({me.hand.length}) — clique une invocation pour la poser face cachée
        </div>
        <div className="flex flex-wrap items-end justify-center gap-1">
          {me.hand.map((inst) => {
            if (!inst) return null;
            const canPlace = !locked && !boardFull && placeable(inst.cardId);
            return (
              <CardView
                key={inst.instanceId}
                cardId={inst.cardId}
                size="lg"
                highlight={canPlace ? 'playable' : 'none'}
                dimmed={!canPlace}
                onClick={canPlace ? () => setupPlace(inst.instanceId) : undefined}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
