import { useMemo, useState } from 'react';
import {
  allCards,
  DECK_MIN,
  DECK_SIZE,
  FACTION_LABELS,
  getCard,
  maxCopiesOf,
  validateDeck,
  type CardDef,
  type CardType,
  type Faction,
} from '@boloss/shared';
import { cardImg } from '../lib/game';
import { useInspectFactory } from '../lib/useInspect';

const TYPE_LABELS: Record<CardType, string> = {
  HERO: 'Héros',
  INVOCATION: 'Invocations',
  OBJET: 'Objets',
  ACT: 'Actes',
};

/**
 * Construction d'un deck libre : toutes les cartes du jeu, toutes factions
 * mélangées, 2 exemplaires max (1 pour les rangs S et F). Les cartes-conséquences
 * (tokens) n'apparaissent jamais ici.
 */
export default function DeckBuilder({
  initial,
  onCancel,
  onSave,
}: {
  initial: string[];
  onCancel: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [deck, setDeck] = useState<string[]>(initial);
  const [faction, setFaction] = useState<Faction | 'all'>('all');
  const [query, setQuery] = useState('');
  const { inspectFor, consumeLongPress } = useInspectFactory();

  const pool = useMemo(
    () =>
      allCards()
        .filter((c) => !c.token)
        .filter((c) => faction === 'all' || c.faction === faction)
        .filter((c) => (query ? c.name.toLowerCase().includes(query.toLowerCase()) : true)),
    [faction, query],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [deck]);

  const validation = validateDeck(deck);
  const grouped = useMemo(() => {
    const g = new Map<string, number>();
    for (const id of deck) g.set(id, (g.get(id) ?? 0) + 1);
    return [...g.entries()].sort((a, b) => getCard(a[0]).name.localeCompare(getCard(b[0]).name));
  }, [deck]);

  const add = (c: CardDef) => {
    if (deck.length >= DECK_SIZE) return;
    if ((counts.get(c.id) ?? 0) >= maxCopiesOf(c.id)) return;
    setDeck((d) => [...d, c.id]);
  };
  const removeOne = (id: string) => {
    const i = deck.lastIndexOf(id);
    if (i >= 0) setDeck((d) => d.filter((_, k) => k !== i));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-felt-900">
      {/* Barre du haut */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <button onClick={onCancel} className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/80">
          ← Retour
        </button>
        <div className="text-center">
          <div className="font-display text-lg text-boloss-gold sm:text-xl">Mon deck</div>
          <div className={`text-xs ${validation.ok ? 'text-emerald-400' : 'text-white/50'}`}>
            {deck.length}/{DECK_SIZE} cartes {validation.ok ? '✓' : `(min ${DECK_MIN})`}
          </div>
        </div>
        <button
          onClick={() => onSave(deck)}
          disabled={!validation.ok}
          className="rounded-md bg-boloss-gold px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          Valider
        </button>
      </div>

      {!validation.ok && deck.length > 0 && (
        <div className="bg-boloss-red/20 px-3 py-1.5 text-center text-xs text-red-200">{validation.error}</div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm"
        />
        <select
          value={faction}
          onChange={(e) => setFaction(e.target.value as Faction | 'all')}
          className="rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm"
        >
          <option value="all">Toutes factions</option>
          {(Object.keys(FACTION_LABELS) as Faction[]).map((f) => (
            <option key={f} value={f}>
              {FACTION_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 lg:flex-row">
        {/* Collection */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {pool.map((c) => {
              const n = counts.get(c.id) ?? 0;
              const full = n >= maxCopiesOf(c.id) || deck.length >= DECK_SIZE;
              return (
                <div
                  key={c.id}
                  {...inspectFor(c.id)}
                  onClick={() => {
                    if (consumeLongPress()) return; // l'appui long ouvrait le zoom
                    if (!full) add(c);
                  }}
                  title={`${c.name} — ${TYPE_LABELS[c.type]} · Rang ${c.rank}`}
                  className={`relative cursor-pointer overflow-hidden rounded-md border-2 transition active:scale-95 ${
                    n > 0 ? 'border-boloss-gold' : 'border-transparent'
                  } ${full ? 'opacity-40' : 'hover:border-white/40'}`}
                >
                  <img src={cardImg(c.image)} alt={c.name} className="aspect-[3/4] w-full object-cover" draggable={false} />
                  {n > 0 && (
                    <span className="absolute right-0.5 top-0.5 rounded-full bg-boloss-gold px-1.5 text-[10px] font-bold text-black">
                      ×{n}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {pool.length === 0 && <div className="p-6 text-center text-sm text-white/40">Aucune carte trouvée.</div>}
        </div>

        {/* Deck courant (le zoom d'inspection est rendu au-dessus, cf. CardInspect) */}
        <div className="thin-scroll max-h-48 min-h-0 shrink-0 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 lg:max-h-none lg:w-72">
          <div className="mb-1 text-xs uppercase tracking-wide text-white/50">Deck ({deck.length})</div>
          {grouped.length === 0 && <div className="p-3 text-center text-xs text-white/40">Ajoute des cartes depuis la collection.</div>}
          <ul className="space-y-1">
            {grouped.map(([id, n]) => {
              const c = getCard(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1 text-xs">
                  <img src={cardImg(c.image)} alt="" className="h-8 w-6 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-boloss-gold">×{n}</span>
                  <button onClick={() => removeOne(id)} className="rounded bg-white/10 px-1.5 text-white/70">
                    −
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
