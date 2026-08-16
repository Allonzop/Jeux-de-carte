import { useState } from 'react';
import {
  FACTIONS,
  FACTION_LABELS,
  FACTION_TAGLINES,
  heroForFaction,
  type Faction,
  type RedactedGameState,
  type PlayerId,
} from '@boloss/shared';
import { cardImg } from '../lib/game';
import { useStore } from '../store';
import DeckBuilder from './DeckBuilder';

export default function Lobby({ game }: { game: RedactedGameState }) {
  const you = game.you;
  const me = game.players[you];
  const other: PlayerId = you === 'A' ? 'B' : 'A';
  const foe = game.players[other];
  const setFaction = useStore((s) => s.setFaction);
  const setCustomDeck = useStore((s) => s.setCustomDeck);
  const toggleReady = useStore((s) => s.toggleReady);
  const setName = useStore((s) => s.setName);

  const [copied, setCopied] = useState(false);
  const [name, setNameLocal] = useState(me.name);
  const [building, setBuilding] = useState(false);
  const [myDeck, setMyDeck] = useState<string[]>([]);

  const shareUrl = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* clipboard may be blocked; the link is visible anyway */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (building) {
    return (
      <DeckBuilder
        initial={myDeck}
        onCancel={() => setBuilding(false)}
        onSave={(ids) => {
          setMyDeck(ids);
          setCustomDeck(ids);
          setBuilding(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="font-display text-5xl text-boloss-gold drop-shadow">BOLOSS</h1>
        <p className="text-white/70">Choisis ta faction, puis clique sur « Prêt ».</p>
      </header>

      {/* Share link */}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm text-white/70">
          Invite ton adversaire en partageant ce lien — la partie démarre dès qu'il rejoint :
        </p>
        <div className="flex w-full max-w-xl items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90"
          />
          <button onClick={copy} className="rounded-md bg-boloss-gold px-4 py-2 font-semibold text-black transition hover:brightness-110">
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Name + status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PlayerCard
          title="Toi"
          editable
          name={name}
          faction={me.faction}
          customDeckSize={me.customDeckSize}
          ready={me.ready}
          connected
          onName={(v) => {
            setNameLocal(v);
            setName(v);
          }}
        />
        <PlayerCard
          title="Adversaire"
          name={foe.name}
          faction={foe.faction}
          customDeckSize={foe.customDeckSize}
          ready={foe.ready}
          connected={foe.connected}
        />
      </div>

      {/* Deck personnalisé */}
      <button
        onClick={() => setBuilding(true)}
        className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${
          me.customDeckSize ? 'border-boloss-gold bg-boloss-gold/10 shadow-glow' : 'border-white/15 bg-black/30 hover:border-white/30'
        }`}
      >
        <div>
          <div className="font-display text-lg text-boloss-gold">🛠 Construire mon deck</div>
          <div className="text-xs text-white/65">
            {me.customDeckSize
              ? `Deck personnalisé de ${me.customDeckSize} cartes sélectionné — clique pour modifier.`
              : 'Mélange les cartes de toutes les factions (2 exemplaires max par carte).'}
          </div>
        </div>
        <span className="text-2xl">›</span>
      </button>

      {/* Faction picker */}
      <div>
        <div className="mb-2 text-center text-xs uppercase tracking-wide text-white/40">…ou choisis un deck prêt à jouer</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FACTIONS.map((f) => (
            <FactionTile key={f} faction={f} selected={me.faction === f} onSelect={() => setFaction(f)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={toggleReady}
          disabled={!me.faction && !me.customDeckSize}
          className={`rounded-lg px-8 py-3 font-display text-2xl tracking-wide transition disabled:opacity-40 ${
            me.ready ? 'bg-emerald-500 text-black' : 'bg-boloss-red text-white hover:brightness-110'
          }`}
        >
          {me.ready ? 'Prêt ✓ (annuler)' : 'Prêt !'}
        </button>
        {me.ready && !foe.ready && <p className="text-white/60">En attente de l'adversaire…</p>}
      </div>
    </div>
  );
}

function PlayerCard({
  title,
  name,
  faction,
  customDeckSize,
  ready,
  connected,
  editable,
  onName,
}: {
  title: string;
  name: string;
  faction: Faction | null;
  customDeckSize: number | null;
  ready: boolean;
  connected: boolean;
  editable?: boolean;
  onName?: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-lg text-white/80">{title}</span>
        <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-white/40'}`}>
          {connected ? '● en ligne' : '○ absent'}
        </span>
      </div>
      {editable ? (
        <input
          value={name}
          maxLength={24}
          onChange={(e) => onName?.(e.target.value)}
          className="mb-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-sm"
          placeholder="Ton pseudo"
        />
      ) : (
        <div className="mb-2 truncate text-sm text-white/80">{name}</div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">
          {faction ? FACTION_LABELS[faction] : customDeckSize ? `Deck perso (${customDeckSize})` : 'Aucun deck'}
        </span>
        <span className={ready ? 'text-emerald-400' : 'text-white/40'}>{ready ? 'Prêt' : '…'}</span>
      </div>
    </div>
  );
}

function FactionTile({ faction, selected, onSelect }: { faction: Faction; selected: boolean; onSelect: () => void }) {
  const hero = heroForFaction(faction);
  return (
    <button
      onClick={onSelect}
      className={`flex gap-3 rounded-xl border p-3 text-left transition ${
        selected ? 'border-boloss-gold bg-boloss-gold/10 shadow-glow' : 'border-white/10 bg-black/30 hover:border-white/30'
      }`}
    >
      <img src={cardImg(hero.image)} alt={FACTION_LABELS[faction]} className="h-20 w-16 rounded-md object-cover shadow-card" />
      <div className="flex-1">
        <div className="font-display text-lg text-boloss-gold">{FACTION_LABELS[faction]}</div>
        <div className="text-xs leading-snug text-white/65">{FACTION_TAGLINES[faction]}</div>
      </div>
    </button>
  );
}
