import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BoardCard } from '@boloss/shared';
import { attackOf, cardImg, cardBackImg, cardStatus, getCard, maxHp } from '../lib/game';

export type Highlight = 'none' | 'playable' | 'target' | 'selected' | 'attacker';

interface Props {
  cardId?: string;
  board?: BoardCard;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: Highlight;
  dimmed?: boolean;
  onClick?: () => void;
  anchorKey?: string; // data attribute name for targeting arrow anchoring
  anchorId?: string;
  title?: string;
}

// Tailles pensées mobile-first : compactes sur petit écran, confortables ensuite.
const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-9 sm:w-14',
  md: 'w-[3.75rem] sm:w-24 md:w-[6.5rem]',
  lg: 'w-20 sm:w-28 md:w-32',
};

const HIGHLIGHT: Record<Highlight, string> = {
  none: '',
  playable: 'ring-2 ring-boloss-gold cursor-pointer hover:-translate-y-1',
  target: 'ring-2 ring-boloss-red animate-pulseTarget cursor-crosshair',
  selected: 'shadow-glow -translate-y-1',
  attacker: 'ring-2 ring-boloss-gold cursor-pointer hover:-translate-y-1',
};

function hpColor(ratio: number): string {
  if (ratio > 0.6) return 'text-emerald-300';
  if (ratio > 0.3) return 'text-amber-300';
  return 'text-red-400';
}

export default function CardView({
  cardId,
  board,
  faceDown,
  size = 'md',
  highlight = 'none',
  dimmed,
  onClick,
  anchorKey,
  anchorId,
  title,
}: Props) {
  const def = useMemo(() => (cardId ? getCard(cardId) : undefined), [cardId]);
  const anchorProps = anchorKey && anchorId ? { [`data-${anchorKey}`]: anchorId } : {};

  // Floating damage / heal number when a board card's HP changes.
  const [float, setFloat] = useState<{ n: number; heal: boolean; key: number } | null>(null);
  const [shake, setShake] = useState(false);
  const prevHp = useRef<number | undefined>(board?.hp);
  useEffect(() => {
    const hp = board?.hp;
    if (hp === undefined) return;
    const prev = prevHp.current;
    if (prev !== undefined && hp !== prev) {
      const diff = hp - prev;
      setFloat({ n: Math.abs(diff), heal: diff > 0, key: Date.now() });
      if (diff < 0) {
        setShake(true);
        setTimeout(() => setShake(false), 350);
      }
      const t = setTimeout(() => setFloat(null), 850);
      prevHp.current = hp;
      return () => clearTimeout(t);
    }
    prevHp.current = hp;
  }, [board?.hp]);

  if (faceDown || !def) {
    return (
      <div
        className={`card-frame relative ${SIZES[size]} aspect-[3/4] overflow-hidden shadow-card ${dimmed ? 'opacity-70' : ''}`}
        {...anchorProps}
      >
        <img src={cardBackImg()} alt="Carte face cachée" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  const isCreature = def.type === 'HERO' || def.type === 'INVOCATION';
  const status = board ? cardStatus(board) : null;
  const curHp = board ? board.hp : def.baseHp ?? 0;
  const maxH = board ? maxHp(board) : def.baseHp ?? 0;
  const curAtk = board ? attackOf(board) : def.baseAttack ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? def.name}
      disabled={!onClick}
      {...anchorProps}
      className={`card-frame group relative ${SIZES[size]} aspect-[3/4] overflow-hidden shadow-card transition-transform duration-150 disabled:cursor-default ${HIGHLIGHT[highlight]} ${dimmed ? 'opacity-60 grayscale' : ''} ${shake ? 'animate-shake' : ''} animate-pop`}
    >
      <img src={cardImg(def.image)} alt={def.name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />

      {/* Live stat overlays for creatures on the board. */}
      {isCreature && (
        <>
          <div className="absolute left-0 top-0 flex items-center gap-0.5 rounded-br-md bg-black/75 px-1 py-0.5">
            <span className={`font-display text-sm leading-none ${hpColor(maxH ? curHp / maxH : 1)}`}>{curHp}</span>
            {board && curHp !== maxH && <span className="text-[9px] text-white/50">/{maxH}</span>}
          </div>
          <div className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl-md bg-black/75 px-1 py-0.5">
            <span
              className={`font-display text-sm leading-none ${
                status && status.attackBuff > 0 ? 'text-boloss-gold' : 'text-orange-200'
              }`}
            >
              {curAtk}
            </span>
          </div>
        </>
      )}

      {/* Status pips. */}
      {status && (
        <div className="absolute right-0 top-0 flex flex-col items-end gap-0.5 p-0.5">
          {status.taunt && <Pip title="Provocation" className="bg-sky-500">🛡</Pip>}
          {status.poison && <Pip title="Poison" className="bg-lime-600">☠</Pip>}
          {status.sick && <Pip title="Mal d'invocation" className="bg-zinc-500">💤</Pip>}
          {status.locked && <Pip title="Ne peut pas attaquer" className="bg-red-700">⛔</Pip>}
        </div>
      )}

      {/* Equipment count. */}
      {board && board.equipment.length > 0 && (
        <div className="absolute bottom-0 left-0 rounded-tr-md bg-black/75 px-1 text-[10px] text-boloss-gold">
          ⚙{board.equipment.length}
        </div>
      )}

      {/* Floating damage / heal. */}
      {float && (
        <div
          key={float.key}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center animate-floatUp font-display text-3xl drop-shadow ${
            float.heal ? 'text-emerald-300' : 'text-red-400'
          }`}
        >
          {float.heal ? '+' : '−'}
          {float.n}
        </div>
      )}
    </button>
  );
}

function Pip({ children, title, className }: { children: ReactNode; title: string; className: string }) {
  return (
    <span title={title} className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white shadow ${className}`}>
      {children}
    </span>
  );
}
