import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function shortId(): string {
  // Short, URL-friendly room id.
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 8);
}

export default function Home() {
  const navigate = useNavigate();
  const [join, setJoin] = useState('');

  const createGame = () => navigate(`/play/${shortId()}`);
  const joinGame = () => {
    const raw = join.trim();
    if (!raw) return;
    // Accept a full URL or a bare room id.
    const id = raw.includes('/play/') ? raw.split('/play/')[1].split(/[/?#]/)[0] : raw;
    if (id) navigate(`/play/${id}`);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div>
        <h1 className="font-display text-7xl text-boloss-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]">BOLOSS</h1>
        <p className="mt-1 text-lg text-white/70">Le jeu de cartes 1 contre 1. Pas de compte, juste un lien.</p>
      </div>

      <button
        onClick={createGame}
        className="rounded-xl bg-boloss-red px-10 py-4 font-display text-3xl tracking-wide text-white shadow-card transition hover:brightness-110"
      >
        Créer une partie
      </button>

      <div className="flex w-full max-w-md items-center gap-2">
        <input
          value={join}
          onChange={(e) => setJoin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinGame()}
          placeholder="Colle un lien ou un code de partie"
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm"
        />
        <button onClick={joinGame} className="rounded-md bg-boloss-gold px-4 py-2 font-semibold text-black hover:brightness-110">
          Rejoindre
        </button>
      </div>

      <div className="mt-4 max-w-xl rounded-xl border border-white/10 bg-black/25 p-5 text-left text-sm leading-relaxed text-white/70">
        <div className="mb-2 font-display text-lg text-boloss-gold">Comment jouer</div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Clique sur <b>Créer une partie</b> pour obtenir un lien unique.</li>
          <li>Envoie ce lien à ton adversaire. Dès qu'il rejoint, vous choisissez chacun une faction.</li>
          <li>But : réduire les <b>HP du HÉRO adverse à 0</b>. Aucune mana — joue autant que les conditions le permettent.</li>
          <li>Chaque tour : pioche 2 cartes, joue tes cartes (Phase Principale), puis attaque (Phase de Combat).</li>
          <li>Une invocation ne peut pas attaquer le tour où elle est posée (<b>mal d'invocation</b>).</li>
        </ol>
      </div>
    </div>
  );
}
