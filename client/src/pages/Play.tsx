import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  evaluateConditions,
  FACTION_LABELS,
  getCard,
  getPlayRequirement,
  MAX_BOARD,
  type BoardCard,
  type CardInstance,
  type GameState,
  type PlayerId,
  type RedactedGameState,
} from '@boloss/shared';
import { useStore } from '../store';
import CardView, { type Highlight } from '../components/CardView';
import TargetingArrow from '../components/TargetingArrow';
import LogPanel from '../components/LogPanel';
import Lobby from '../components/Lobby';
import SetupScreen from '../components/SetupScreen';
import CardInspect from '../components/CardInspect';
import { canAttackWith, cardBackImg, isYourTurn, legalAttackTargetIds, legalPlayTargetIds } from '../lib/game';

export default function Play() {
  const { roomId } = useParams();
  const connect = useStore((s) => s.connect);
  const setPointer = useStore((s) => s.setPointer);
  const cancelInteraction = useStore((s) => s.cancelInteraction);
  const game = useStore((s) => s.game);
  const you = useStore((s) => s.you);
  const connected = useStore((s) => s.connected);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  useEffect(() => {
    if (roomId) connect(roomId);
  }, [roomId, connect]);

  useEffect(() => {
    const move = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && cancelInteraction();
    window.addEventListener('pointermove', move);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', key);
    };
  }, [setPointer, cancelInteraction]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 2800);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (!game || !you) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="font-display text-4xl text-boloss-gold">BOLOSS</div>
          <p className="mt-2 text-white/60">{connected ? 'Connexion à la partie…' : 'Connexion au serveur…'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {game.status === 'LOBBY' && <Lobby game={game} />}
      {game.status === 'SETUP' && <SetupScreen game={game} />}
      {(game.status === 'PLAYING' || game.status === 'FINISHED') && <Board game={game} />}
      {/* Zoom d'inspection : disponible sur tous les écrans. */}
      <CardInspect />
    </>
  );
}

function Board({ game }: { game: RedactedGameState }) {
  const you = game.you;
  const foeId: PlayerId = you === 'A' ? 'B' : 'A';
  const me = game.players[you];
  const foe = game.players[foeId];

  const interaction = useStore((s) => s.interaction);
  const selectHandCard = useStore((s) => s.selectHandCard);
  const selectAttacker = useStore((s) => s.selectAttacker);
  const chooseTarget = useStore((s) => s.chooseTarget);
  const nextPhase = useStore((s) => s.nextPhase);
  const endTurn = useStore((s) => s.endTurn);
  const error = useStore((s) => s.error);

  const myTurn = isYourTurn(game);

  // ---- Derived interaction sets ----------------------------------------
  const playTargets = useMemo(() => {
    if (interaction.mode !== 'play-target') return new Set<string>();
    const inst = me.hand.find((c) => c && c.instanceId === interaction.handInstanceId) as CardInstance | undefined;
    if (!inst) return new Set<string>();
    return legalPlayTargetIds(game, getCard(inst.cardId));
  }, [interaction, game, me.hand]);

  const attackTargets = useMemo(
    () => (interaction.mode === 'attack' ? legalAttackTargetIds(game) : new Set<string>()),
    [interaction, game],
  );

  const attackable = useMemo(() => {
    const s = new Set<string>();
    for (const c of [me.hero, ...me.board].filter(Boolean) as BoardCard[]) if (canAttackWith(game, c)) s.add(c.instanceId);
    return s;
  }, [game, me.hero, me.board]);

  const playableHand = useMemo(() => {
    const set = new Set<string>();
    if (!myTurn || game.phase !== 'MAIN') return set;
    for (const inst of me.hand) {
      if (!inst) continue;
      const def = getCard(inst.cardId);
      let ok = false;
      if (def.type === 'INVOCATION') {
        ok = me.board.length < MAX_BOARD && evaluateConditions(game as unknown as GameState, def, you);
      } else {
        const req = getPlayRequirement(def);
        ok = !req.needsTarget || legalPlayTargetIds(game, def).size > 0;
      }
      if (ok) set.add(inst.instanceId);
    }
    return set;
  }, [game, me.hand, me.board, myTurn, you]);

  // ---- Per-character highlight + click ---------------------------------
  function charHighlight(c: BoardCard): Highlight {
    if (interaction.mode === 'play-target') return playTargets.has(c.instanceId) ? 'target' : 'none';
    if (interaction.mode === 'attack') {
      if (c.instanceId === interaction.attackerInstanceId) return 'selected';
      return attackTargets.has(c.instanceId) ? 'target' : 'none';
    }
    return attackable.has(c.instanceId) ? 'attacker' : 'none';
  }

  function charClick(c: BoardCard): (() => void) | undefined {
    if (interaction.mode === 'play-target') return playTargets.has(c.instanceId) ? () => chooseTarget(c.instanceId) : undefined;
    if (interaction.mode === 'attack') {
      if (c.instanceId === interaction.attackerInstanceId) return () => selectAttacker(c.instanceId);
      return attackTargets.has(c.instanceId) ? () => chooseTarget(c.instanceId) : undefined;
    }
    return attackable.has(c.instanceId) ? () => selectAttacker(c.instanceId) : undefined;
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar game={game} />

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-2">
        {/* Main play field */}
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
          {/* Opponent field */}
          <PlayerField
            player={foe}
            isFoe
            charHighlight={charHighlight}
            charClick={charClick}
          />

          {/* Divider / phase controls */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/10" />
            {myTurn ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {game.phase === 'MAIN' && (
                  <button
                    onClick={nextPhase}
                    className="rounded-md bg-boloss-red px-3 py-2 text-xs font-semibold text-white transition active:scale-95 sm:px-4 sm:py-1.5 sm:text-sm"
                  >
                    ⚔ Combat
                  </button>
                )}
                <button
                  onClick={endTurn}
                  className="rounded-md bg-boloss-gold px-3 py-2 text-xs font-semibold text-black transition active:scale-95 sm:px-4 sm:py-1.5 sm:text-sm"
                >
                  Fin du tour ⏭
                </button>
              </div>
            ) : (
              <span className="rounded-md bg-black/40 px-3 py-1.5 text-xs text-white/60 sm:px-4 sm:text-sm">Tour adverse…</span>
            )}
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Your field */}
          <PlayerField
            player={me}
            isFoe={false}
            charHighlight={charHighlight}
            charClick={charClick}
          />
        </div>

        {/* Log column */}
        <div className="hidden w-64 shrink-0 lg:block">
          <LogPanel log={game.log} you={you} />
        </div>
      </div>

      {/* Your hand */}
      <Hand hand={me.hand} playable={playableHand} interaction={interaction} onPlay={selectHandCard} />

      {error && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-boloss-red px-4 py-2 text-sm font-medium text-white shadow-lg">
          {error}
        </div>
      )}

      <TargetingArrow />
      {game.status === 'FINISHED' && <GameOver game={game} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function TopBar({ game }: { game: RedactedGameState }) {
  const you = game.you;
  const me = game.players[you];
  const foe = game.players[you === 'A' ? 'B' : 'A'];
  const activeName = game.players[game.activePlayer].name;
  const myTurn = isYourTurn(game);
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-4 sm:py-2">
      <div className="font-display text-lg text-boloss-gold sm:text-2xl">BOLOSS</div>
      <div className="hidden items-center gap-4 text-sm md:flex">
        <span className="text-white/70">
          {me.name} <span className="text-white/40">({me.faction ? FACTION_LABELS[me.faction] : 'deck perso'})</span>
        </span>
        <span className="text-white/30">vs</span>
        <span className="text-white/70">
          {foe.name} <span className="text-white/40">({foe.faction ? FACTION_LABELS[foe.faction] : 'deck perso'})</span>
        </span>
      </div>
      <div
        className={`rounded-full px-2 py-1 text-[11px] font-semibold sm:px-3 sm:text-sm ${
          myTurn ? 'bg-emerald-500 text-black' : 'bg-black/40 text-white/70'
        }`}
      >
        T{game.turnNumber} · {myTurn ? 'À toi' : `À ${activeName}`} · {game.phase === 'MAIN' ? 'Principale' : 'Combat'}
      </div>
    </div>
  );
}

function PlayerField({
  player,
  isFoe,
  charHighlight,
  charClick,
}: {
  player: RedactedGameState['players'][PlayerId];
  isFoe: boolean;
  charHighlight: (c: BoardCard) => Highlight;
  charClick: (c: BoardCard) => (() => void) | undefined;
}) {
  const slots: (BoardCard | null)[] = [];
  for (let i = 0; i < MAX_BOARD; i++) slots.push(player.board[i] ?? null);

  const hero = player.hero;

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-black/20 p-1.5 sm:gap-3 sm:p-2">
      {/* Piles + main adverse : compactées à gauche sur mobile */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Pile label="Deck" count={player.deckCount} faceDown />
        <Pile label="Cimetière" count={player.graveyard.length} topCardId={player.graveyard.at(-1)?.cardId} />
        {isFoe && (
          <div className="hidden items-center xl:flex">
            {Array.from({ length: player.handCount }).map((_, i) => (
              <div key={i} className="-ml-6 first:ml-0">
                <CardView faceDown size="sm" />
              </div>
            ))}
          </div>
        )}
        {isFoe && (
          <div className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-1 text-[10px] text-white/60 xl:hidden">
            🖐 {player.handCount}
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="flex shrink-0 flex-col items-center">
        {hero ? (
          <CardView
            cardId={hero.cardId}
            board={hero}
            size="md"
            highlight={charHighlight(hero)}
            onClick={charClick(hero)}
            anchorKey="char"
            anchorId={hero.instanceId}
          />
        ) : (
          <EmptySlot label="Héro" />
        )}
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-boloss-gold/70 sm:text-[10px]">Héro</span>
      </div>

      {/* Invocation slots — défilables horizontalement si ça déborde */}
      <div className="thin-scroll flex flex-1 items-center justify-center gap-1 overflow-x-auto sm:gap-2">
        {slots.map((c, i) =>
          c ? (
            <CardView
              key={c.instanceId}
              cardId={c.cardId}
              board={c}
              size="md"
              highlight={charHighlight(c)}
              onClick={charClick(c)}
              anchorKey="char"
              anchorId={c.instanceId}
            />
          ) : (
            <EmptySlot key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label?: string }) {
  return (
    <div className="flex aspect-[3/4] w-[3.75rem] items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-[9px] text-white/25 sm:w-24 sm:text-[10px] md:w-[6.5rem]">
      {label ?? ''}
    </div>
  );
}

function Pile({ label, count, faceDown, topCardId }: { label: string; count: number; faceDown?: boolean; topCardId?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-12 w-9 sm:h-[4.7rem] sm:w-14">
        {count > 0 ? (
          faceDown ? (
            <img src={cardBackImg()} alt={label} className="card-frame absolute inset-0 h-full w-full object-cover opacity-90" />
          ) : topCardId ? (
            <CardView cardId={topCardId} size="sm" />
          ) : (
            <div className="card-frame h-full w-full opacity-40" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-white/10 text-[10px] text-white/25">
            vide
          </div>
        )}
        {count > 0 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1.5 text-[10px] text-white">{count}</span>
        )}
      </div>
      <span className="mt-0.5 hidden text-[10px] uppercase tracking-wide text-white/40 sm:block">{label}</span>
    </div>
  );
}

function Hand({
  hand,
  playable,
  interaction,
  onPlay,
}: {
  hand: (CardInstance | null)[];
  playable: Set<string>;
  interaction: ReturnType<typeof useStore.getState>['interaction'];
  onPlay: (id: string) => void;
}) {
  return (
    <div className="thin-scroll flex min-h-[7rem] items-end gap-1 overflow-x-auto px-2 pb-2 pt-1 sm:min-h-[9.5rem] sm:justify-center sm:px-4 sm:pb-3">
      {hand.length === 0 && <div className="w-full pb-6 text-center text-sm text-white/40">Main vide</div>}
      {hand.map((inst, i) => {
        if (!inst) return null;
        const isPlayable = playable.has(inst.instanceId);
        const isSelected = interaction.mode === 'play-target' && interaction.handInstanceId === inst.instanceId;
        return (
          <div
            key={inst.instanceId}
            className="shrink-0 transition-transform"
            style={{ marginLeft: i === 0 ? 0 : undefined }}
          >
            <CardView
              cardId={inst.cardId}
              size="lg"
              highlight={isSelected ? 'selected' : isPlayable ? 'playable' : 'none'}
              dimmed={!isPlayable && !isSelected}
              onClick={isPlayable || isSelected ? () => onPlay(inst.instanceId) : undefined}
              anchorKey="hand"
              anchorId={inst.instanceId}
            />
          </div>
        );
      })}
    </div>
  );
}

function GameOver({ game }: { game: RedactedGameState }) {
  const won = game.winner === game.you;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="animate-pop rounded-2xl border border-white/10 bg-felt-800 p-8 text-center shadow-2xl">
        <div className={`font-display text-6xl ${won ? 'text-boloss-gold' : 'text-boloss-red'}`}>
          {won ? 'VICTOIRE !' : 'DÉFAITE'}
        </div>
        <p className="mt-2 text-white/70">
          {won ? "Tu as réduit le HÉRO adverse à néant." : "Ton HÉRO est tombé."}
        </p>
        <a href="/" className="mt-6 inline-block rounded-lg bg-boloss-gold px-6 py-3 font-semibold text-black hover:brightness-110">
          Rejouer
        </a>
      </div>
    </div>
  );
}
