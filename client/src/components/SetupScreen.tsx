import { useState } from 'react';
import {
  isBasicInvocationId,
  MAX_SETUP_INVOCATIONS,
  type BoardCard,
  type RedactedGameState,
} from '@boloss/shared';
import { useStore } from '../store';
import CardView from './CardView';

type Step = 'MULLIGAN' | 'HERO' | 'PLACE';

export default function SetupScreen({ game }: { game: RedactedGameState }) {
  const you = game.you;
  const me = game.players[you];
  const foe = game.players[you === 'A' ? 'B' : 'A'];
  const mulligan = useStore((s) => s.mulligan);
  const chooseHero = useStore((s) => s.chooseHero);
  const setupPlace = useStore((s) => s.setupPlace);
  const setupUnplace = useStore((s) => s.setupUnplace);
  const setupReady = useStore((s) => s.setupReady);

  const [swap, setSwap] = useState<Set<string>>(new Set());

  const step: Step = !me.mulliganDone && !me.hero ? 'MULLIGAN' : !me.hero ? 'HERO' : 'PLACE';
  const locked = me.setupDone;
  const boardFull = me.board.length >= MAX_SETUP_INVOCATIONS;
  const emptySlots = Math.max(0, MAX_SETUP_INVOCATIONS - me.board.length);

  const toggleSwap = (id: string) =>
    setSwap((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <header className="text-center">
        <h1 className="font-display text-3xl text-boloss-gold sm:text-4xl">Mise en place</h1>
        <Steps step={step} />
      </header>

      {/* Adversaire (compact) */}
      <section className="rounded-xl border border-white/10 bg-black/25 p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between text-xs sm:text-sm">
          <span className="truncate text-white/70">{foe.name}</span>
          <span className={foe.setupDone ? 'text-emerald-400' : 'text-white/40'}>
            {foe.setupDone ? 'Prêt ✓' : foe.hero ? 'Pose ses cartes…' : 'Choisit son héros…'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {foe.hero ? <CardView faceDown size="sm" /> : <span className="text-xs text-white/30">héros non choisi</span>}
          {foe.board.map((c) => (
            <CardView key={c.instanceId} faceDown size="sm" />
          ))}
        </div>
      </section>

      {/* Ton terrain */}
      <section className="rounded-xl border border-boloss-gold/30 bg-black/25 p-2 sm:p-3">
        <div className="mb-2 text-xs text-white/70 sm:text-sm">Ton terrain</div>
        <div className="flex flex-wrap items-start gap-2 sm:gap-3">
          <div className="flex flex-col items-center">
            {me.hero ? (
              <CardView cardId={me.hero.cardId} board={me.hero} size="md" />
            ) : (
              <div className="flex aspect-[3/4] w-20 items-center justify-center rounded-lg border-2 border-dashed border-boloss-gold/50 text-center text-[10px] text-boloss-gold/70 sm:w-[6.5rem]">
                choisis ton héros
              </div>
            )}
            <span className="mt-1 text-[10px] uppercase tracking-wide text-white/40">Héro</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              <div
                key={i}
                className="flex aspect-[3/4] w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-[10px] text-white/25 sm:w-[6.5rem]"
              >
                slot libre
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Actions selon l'étape */}
      <div className="sticky bottom-2 z-20 flex flex-col items-center gap-2">
        {step === 'MULLIGAN' && (
          <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-xl border border-white/10 bg-felt-800/95 p-3 shadow-lg backdrop-blur">
            <p className="text-center text-xs text-white/70">
              Sélectionne les cartes à échanger contre de nouvelles de ton deck (facultatif).
            </p>
            <div className="flex w-full gap-2">
              <button
                onClick={() => mulligan([...swap])}
                className="flex-1 rounded-lg bg-boloss-gold px-4 py-3 font-semibold text-black transition active:scale-95"
              >
                {swap.size > 0 ? `Échanger ${swap.size} carte(s)` : 'Garder ma main'}
              </button>
              {swap.size > 0 && (
                <button onClick={() => setSwap(new Set())} className="rounded-lg border border-white/20 px-3 py-3 text-sm text-white/70">
                  Annuler
                </button>
              )}
            </div>
          </div>
        )}
        {step === 'HERO' && (
          <div className="w-full max-w-md rounded-xl border border-boloss-gold/40 bg-felt-800/95 p-3 text-center shadow-lg backdrop-blur">
            <p className="text-sm text-boloss-gold">
              Choisis une invocation de ta main : elle devient ton <b>HÉROS</b>.
            </p>
            <p className="mt-1 text-xs text-white/60">Ses PV et son attaque deviennent les tiens. Si elle tombe, tu perds.</p>
          </div>
        )}
        {step === 'PLACE' && (
          <button
            onClick={setupReady}
            disabled={locked}
            className="w-full max-w-md rounded-lg bg-boloss-red px-6 py-4 font-display text-xl tracking-wide text-white shadow-lg transition active:scale-95 disabled:opacity-40 sm:text-2xl"
          >
            {locked ? 'En attente de l’adversaire…' : 'Commencer le combat ⚔'}
          </button>
        )}
      </div>

      {/* Ta main */}
      <section>
        <div className="mb-1 text-center text-[11px] uppercase tracking-wide text-white/40">
          Ta main ({me.hand.length}) —{' '}
          {step === 'MULLIGAN'
            ? 'touche les cartes à échanger'
            : step === 'HERO'
              ? 'touche ton futur héros'
              : 'touche une invocation pour la poser face cachée'}
        </div>
        <div className="flex flex-wrap items-end justify-center gap-1">
          {me.hand.map((inst) => {
            if (!inst) return null;
            const basic = isBasicInvocationId(inst.cardId);
            const selectable =
              step === 'MULLIGAN' ? true : step === 'HERO' ? basic : !locked && !boardFull && basic;
            const selected = step === 'MULLIGAN' && swap.has(inst.instanceId);
            const onClick = !selectable
              ? undefined
              : step === 'MULLIGAN'
                ? () => toggleSwap(inst.instanceId)
                : step === 'HERO'
                  ? () => chooseHero(inst.instanceId)
                  : () => setupPlace(inst.instanceId);
            return (
              <CardView
                key={inst.instanceId}
                cardId={inst.cardId}
                size="lg"
                highlight={selected ? 'selected' : selectable ? 'playable' : 'none'}
                dimmed={!selectable}
                onClick={onClick}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: 'MULLIGAN', label: '1. Échange' },
    { key: 'HERO', label: '2. Héros' },
    { key: 'PLACE', label: '3. Invocations' },
  ];
  const idx = items.findIndex((i) => i.key === step);
  return (
    <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs">
      {items.map((it, i) => (
        <span
          key={it.key}
          className={`rounded-full px-2.5 py-1 ${
            i === idx ? 'bg-boloss-gold font-semibold text-black' : i < idx ? 'bg-emerald-600/70 text-white' : 'bg-white/10 text-white/50'
          }`}
        >
          {i < idx ? '✓' : ''} {it.label}
        </span>
      ))}
    </div>
  );
}
