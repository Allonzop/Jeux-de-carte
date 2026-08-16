import { getCard, type CardDef } from '@boloss/shared';
import { attackOf, cardImg, describeModifiers, maxHp } from '../lib/game';
import { useStore } from '../store';

const TYPE_LABELS: Record<CardDef['type'], string> = {
  HERO: 'Héros',
  INVOCATION: 'Invocation',
  OBJET: 'Objet',
  ACT: 'Acte',
};

/**
 * Zoom d'inspection : affiche la carte en grand et lisible, avec ses stats
 * courantes et la liste détaillée de ses altérations d'état.
 */
export default function CardInspect() {
  const inspect = useStore((s) => s.inspect);
  if (!inspect) return null;

  const def = getCard(inspect.cardId);
  const board = inspect.board;
  const lines = board ? describeModifiers(board) : [];
  const curAtk = board ? attackOf(board) : def.baseAttack ?? 0;
  const curHp = board ? board.hp : def.baseHp ?? 0;
  const maxH = board ? maxHp(board) : def.baseHp ?? 0;
  const isCreature = def.type === 'INVOCATION' || def.type === 'HERO';

  return (
    // `pointer-events-none` est essentiel : sans ça, l'overlay plein écran vole
    // le pointeur à la carte survolée, ce qui déclenche un `pointerleave` et
    // referme le zoom immédiatement (clignotement). La fermeture est pilotée par
    // la carte elle-même (souris qui sort / doigt relâché).
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-4xl animate-pop flex-col items-center gap-4 overflow-y-auto sm:flex-row sm:items-start">
        {/* Carte en grand */}
        <img
          src={cardImg(def.image)}
          alt={def.name}
          className="w-56 shrink-0 rounded-xl border-4 border-black shadow-2xl sm:w-80"
        />

        {/* Fiche détaillée */}
        <div className="w-full max-w-md rounded-xl border border-white/15 bg-felt-800/95 p-4 text-left shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-2xl leading-tight text-boloss-gold">{def.name}</h2>
            <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/70">Rang {def.rank}</span>
          </div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-white/45">
            {TYPE_LABELS[def.type]}
            {board?.isHero && ' · HÉROS'}
            {def.token && ' · carte-conséquence'}
          </div>

          {isCreature && (
            <div className="mt-3 flex gap-2">
              <Stat label="PV" value={board ? `${curHp} / ${maxH}` : `${curHp}`} tone="hp" />
              <Stat label="Attaque" value={`${curAtk}`} tone="atk" />
            </div>
          )}

          {def.attackName && (
            <div className="mt-3">
              <div className="font-display text-lg text-white/90">{def.attackName}</div>
              {def.attackDesc && <p className="text-sm leading-snug text-white/65">{def.attackDesc}</p>}
            </div>
          )}
          {def.effectText && <p className="mt-3 text-sm leading-snug text-white/80">{def.effectText}</p>}

          {def.summoningConditions?.length ? (
            <p className="mt-3 rounded-md bg-boloss-red/20 px-2 py-1.5 text-xs text-red-200">
              ⚠ Invocation soumise à condition (sacrifice requis).
            </p>
          ) : null}

          {/* Altérations d'état en cours */}
          {board && (
            <div className="mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-white/45">Effets en cours</div>
              {lines.length === 0 ? (
                <div className="text-sm text-white/40">Aucun effet actif.</div>
              ) : (
                <ul className="space-y-1">
                  {lines.map((l, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                        l.tone === 'good'
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : l.tone === 'bad'
                            ? 'bg-red-500/15 text-red-200'
                            : 'bg-white/5 text-white/70'
                      }`}
                    >
                      <span className="shrink-0">{l.icon}</span>
                      <span className="leading-snug">{l.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 text-center text-[11px] text-white/35">
            Relâche ton doigt ou éloigne la souris pour fermer
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'hp' | 'atk' }) {
  return (
    <div className={`flex-1 rounded-lg px-3 py-2 ${tone === 'hp' ? 'bg-emerald-500/15' : 'bg-orange-500/15'}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className={`font-display text-2xl ${tone === 'hp' ? 'text-emerald-300' : 'text-orange-300'}`}>{value}</div>
    </div>
  );
}
