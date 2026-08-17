import { useCallback, useEffect, useRef, useState } from 'react';
import introUrl from '../assets/brand/intro.mp3';
import Logo from './Logo';

/**
 * Écran de chargement d'ouverture : le logo surgit au centre et l'animation se
 * termine par un gros rebond dont **le dernier impact tombe pile sur la fin du
 * morceau**.
 *
 * La chronologie est calée sur la durée réelle du fichier audio
 * (`audio.duration`, lue à l'arrivée des métadonnées) et l'animation est pilotée
 * par `audio.currentTime` : si la lecture démarre en retard ou dérive, c'est
 * l'image qui se recale sur le son, jamais l'inverse.
 */

/** Repli si le navigateur ne donne pas la durée (6,024 s mesurées sur le fichier). */
const FALLBACK_DURATION = 6.024;
/** Longueur du rebond final. Il se termine exactement à la fin du son. */
const BOUNCE_DUR = 1.45;
/** Anticipation (le logo se ramasse) juste avant le rebond. */
const ANTICIP_DUR = 0.3;
/** Noir de départ, le temps que le son s'amorce. */
const LEAD_IN = 0.25;
/** Fondu de sortie une fois l'impact final passé. */
const OUTRO_MS = 550;
/** Sans interaction, on lance l'animation en silence au bout de ce délai. */
const BLOCKED_TIMEOUT_MS = 4000;

const SEEN_KEY = 'boloss:intro-seen';
const MUTE_KEY = 'boloss:muted';
const VOLUME = 0.85;

/**
 * Rebond de Robert Penner — l'équivalent du `Ease.OutBounce` de DOTween.
 * Vaut 1, donc « touche le sol », à t = 4/11, 8/11, 10/11 et 1.
 */
function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

/** Instants normalisés où le rebond frappe le sol — le dernier est la fin. */
const IMPACTS = [1 / 2.75, 2 / 2.75, 2.5 / 2.75, 1];
/** Force de chaque impact : le premier claque, le dernier ponctue la musique. */
const IMPACT_POWER = [1, 0.4, 0.22, 0.85];

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Phase = 'loading' | 'blocked' | 'running';

interface Ring {
  id: number;
  power: number;
}

export default function IntroSplash() {
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !sessionStorage.getItem(SEEN_KEY),
  );
  const [phase, setPhase] = useState<Phase>('loading');
  const [leaving, setLeaving] = useState(false);
  const [rings, setRings] = useState<Ring[]>([]);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  /** Impacts déjà joués + instant du dernier, exposés pour vérifier la synchro. */
  const [impacts, setImpacts] = useState<{ count: number; at: number }>({ count: 0, at: 0 });

  const shakeRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ringId = useRef(0);
  const done = useRef(false);

  /** Ferme l'intro (fin naturelle ou saut), en fondant le son. */
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    sessionStorage.setItem(SEEN_KEY, '1');
    const a = audioRef.current;
    if (a && !a.paused) {
      const from = a.volume;
      const t0 = performance.now();
      const fade = () => {
        const k = (performance.now() - t0) / 260;
        if (k >= 1 || a.paused) {
          a.pause();
          return;
        }
        a.volume = from * (1 - k);
        requestAnimationFrame(fade);
      };
      fade();
    }
    setLeaving(true);
    setTimeout(() => setVisible(false), OUTRO_MS);
  }, []);

  // --- Amorçage : on tente le son, sinon on attend un geste -----------------
  useEffect(() => {
    if (!visible) return;

    // Accessibilité : ni animation ni son si l'utilisateur les refuse.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(finish, 900);
      return () => clearTimeout(t);
    }

    const audio = audioRef.current;
    if (!audio) {
      setPhase('running');
      return;
    }

    let cancelled = false;
    audio.volume = muted ? 0 : VOLUME;
    audio.currentTime = 0;

    // On laisse une chance aux métadonnées d'arriver (durée réelle du morceau),
    // mais on ne bloque pas l'écran pour autant.
    const go = () => {
      if (!cancelled) setPhase('running');
    };
    const guard = setTimeout(go, 1200);

    audio
      .play()
      .then(() => {
        if (cancelled) return;
        if (audio.readyState >= 1) go();
        else audio.addEventListener('loadedmetadata', go, { once: true });
      })
      .catch(() => {
        // Autoplay refusé tant qu'il n'y a pas eu d'interaction utilisateur.
        clearTimeout(guard);
        if (!cancelled) setPhase('blocked');
      });

    return () => {
      cancelled = true;
      clearTimeout(guard);
      audio.removeEventListener('loadedmetadata', go);
      audio.pause();
    };
    // `muted` est appliqué à chaud par l'effet dédié plus bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, finish]);

  // Son bloqué : on ne fait pas patienter indéfiniment, l'animation part seule.
  useEffect(() => {
    if (phase !== 'blocked') return;
    const t = setTimeout(() => setPhase('running'), BLOCKED_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // --- L'animation, image par image ----------------------------------------
  useEffect(() => {
    if (!visible || phase !== 'running') return;

    const audio = audioRef.current;
    const duration =
      audio && Number.isFinite(audio.duration) && audio.duration > 1 ? audio.duration : FALLBACK_DURATION;

    // Découpage de la timeline, ancré sur la FIN du morceau.
    const bounceDur = Math.min(BOUNCE_DUR, duration * 0.45);
    const anticipDur = Math.min(ANTICIP_DUR, duration * 0.1);
    const bounceStart = duration - bounceDur;
    const anticipStart = bounceStart - anticipDur;
    const buildStart = Math.min(LEAD_IN, anticipStart * 0.3);

    let raf = 0;
    let cancelled = false;
    let nextImpact = 0;
    let shakeAt = -1;
    let shakePower = 0;
    const wallStart = performance.now();
    /** Vrai dès que le son a réellement démarré : il devient l'horloge maîtresse. */
    let audioLed = false;
    /** L'horloge ne doit jamais reculer, même en changeant de source. */
    let lastT = 0;

    const spawnRing = (power: number) => {
      const id = ++ringId.current;
      setRings((r) => [...r, { id, power }]);
      setTimeout(() => setRings((r) => r.filter((x) => x.id !== id)), 750);
    };

    const flash = (power: number) => {
      const el = flashRef.current;
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = String(0.5 * power);
      requestAnimationFrame(() => {
        if (!flashRef.current) return;
        flashRef.current.style.transition = 'opacity 230ms ease-out';
        flashRef.current.style.opacity = '0';
      });
    };

    const frame = () => {
      if (cancelled) return;

      // Horloge : le son fait foi tant qu'il tourne. Quand il se termine, on se
      // place exactement sur sa dernière image — c'est là que doit tomber
      // l'impact final. Sans son du tout, on retombe sur l'horloge mur.
      let clock: number;
      if (audio && audio.currentTime > 0 && !audio.ended) {
        clock = audio.currentTime;
        audioLed = true;
      } else if (audioLed) {
        clock = duration;
      } else {
        clock = (performance.now() - wallStart) / 1000;
      }
      const raw = Math.max(lastT, clock);
      lastT = raw;
      // Pour le calcul de la pose, on borne : la dernière image est la pose finale.
      const t = Math.min(raw, duration);

      let scale: number;
      let y: number;
      let rot: number;
      let opacity: number;
      let blur = 0;

      if (t < buildStart) {
        scale = 0.4;
        y = 0;
        rot = -3;
        opacity = 0;
      } else if (t < anticipStart) {
        // Montée en tension : le logo respire et grossit lentement.
        const k = easeOut((t - buildStart) / Math.max(0.001, anticipStart - buildStart));
        scale = lerp(0.4, 0.6, k) + Math.sin(t * 7) * 0.006 * k;
        y = Math.sin(t * 3.1) * 1.1;
        rot = lerp(-3, -1.2, k);
        opacity = Math.min(1, k * 3) * 0.55;
      } else if (t < bounceStart) {
        // Anticipation : il se ramasse avant de sauter à la figure.
        const k = easeIn((t - anticipStart) / Math.max(0.001, anticipDur));
        scale = lerp(0.6, 0.42, k);
        y = lerp(0, -5, k);
        rot = lerp(-1.2, 2.5, k);
        opacity = lerp(0.55, 0.14, k);
        blur = k * 4;
      } else {
        // LE rebond. `b` vaut 1 à chaque contact avec le sol.
        const elapsed = t - bounceStart;
        const local = Math.min(1, elapsed / bounceDur);
        const b = easeOutBounce(local);
        scale = lerp(2.3, 1, b);
        y = lerp(-26, 0, b);
        rot = lerp(-7, 0, b);
        opacity = Math.min(1, elapsed / 0.06);
        // Flou de vitesse sur les 130 premières ms : masque le saut d'échelle.
        blur = Math.max(0, 12 * (1 - elapsed / 0.13));

        while (nextImpact < IMPACTS.length && local >= IMPACTS[nextImpact]) {
          const power = IMPACT_POWER[nextImpact];
          spawnRing(power);
          flash(power);
          shakeAt = t;
          shakePower = power;
          nextImpact++;
          const n = nextImpact;
          setImpacts({ count: n, at: t });
        }
      }

      // Secousse d'écran : sinus amorti sur 320 ms après chaque impact.
      let sx = 0;
      let sy = 0;
      if (shakeAt >= 0) {
        const age = (t - shakeAt) / 0.32;
        if (age < 1) {
          const damp = (1 - age) * (1 - age) * shakePower * 11;
          sx = Math.sin(age * 46) * damp;
          sy = Math.cos(age * 39) * damp * 0.6;
        }
      }

      if (shakeRef.current) shakeRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      if (logoRef.current) {
        logoRef.current.style.transform = `translate3d(0, ${y}vh, 0) scale(${scale}) rotate(${rot}deg)`;
        logoRef.current.style.opacity = String(opacity);
        logoRef.current.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : '';
      }

      // L'impact final vient de tomber sur la dernière note : on laisse respirer.
      // On sort APRÈS avoir posé cette image, sinon le dernier rebond n'est
      // jamais dessiné et le logo se fige légèrement au-dessus de sa taille.
      if (raw >= duration) {
        setTimeout(finish, 420);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [visible, phase, finish]);

  // Coupure du son à la volée, sans relancer l'animation.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : VOLUME;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  }, [muted]);

  // Passer l'intro au clavier.
  useEffect(() => {
    if (!visible) return;
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [visible, finish]);

  if (!visible) return null;

  /** Le son est bloqué : le premier geste le débloque au lieu de tout sauter. */
  const onOverlayDown = () => {
    if (phase === 'blocked') {
      const audio = audioRef.current;
      audio?.play().catch(() => undefined);
      setPhase('running');
      return;
    }
    finish();
  };

  return (
    <div
      onPointerDown={onOverlayDown}
      // Attributs de contrôle : ils servent aussi à vérifier la synchro en test.
      data-intro={phase}
      data-impacts={impacts.count}
      data-last-impact={impacts.at.toFixed(3)}
      className={`fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#07110c] transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <audio ref={audioRef} src={introUrl} preload="auto" />

      {/* Halo de fond qui pulse pendant la montée en tension. */}
      <div className="pointer-events-none absolute inset-0 animate-introGlow bg-[radial-gradient(circle_at_50%_50%,rgba(242,193,78,0.20),transparent_62%)]" />

      <div ref={shakeRef} className="relative flex h-full w-full items-center justify-center will-change-transform">
        {/* Ondes de choc : une par impact du rebond. */}
        {rings.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute animate-shockwave rounded-full border-boloss-gold/70"
            style={{
              width: `${28 * r.power + 14}vmin`,
              height: `${28 * r.power + 14}vmin`,
              borderWidth: `${Math.max(2, 6 * r.power)}px`,
            }}
          />
        ))}

        <div
          ref={logoRef}
          data-intro-logo=""
          className={`flex h-[52vh] w-[78vw] max-w-4xl items-center justify-center will-change-transform ${
            phase === 'blocked' ? 'animate-introIdle opacity-60' : 'opacity-0'
          }`}
        >
          <Logo size="fill" decorative />
        </div>

        {phase === 'loading' && (
          <span className="absolute animate-pulse text-xs uppercase tracking-[0.4em] text-white/30">chargement…</span>
        )}
      </div>

      {/* Flash blanc synchronisé sur les impacts. */}
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-white opacity-0" />

      {phase === 'blocked' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 text-center">
          <span className="animate-pulse rounded-full bg-boloss-gold/90 px-5 py-2 font-display text-xl text-black">
            ▶ Touche l’écran pour lancer l’intro
          </span>
        </div>
      )}

      {/* Commandes discrètes. */}
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute bottom-4 left-4 rounded-full bg-black/40 px-3 py-2 text-lg leading-none text-white/70 transition hover:text-white"
        title={muted ? 'Activer le son' : 'Couper le son'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="absolute bottom-5 right-4 text-[11px] uppercase tracking-widest text-white/30">
        {phase === 'blocked' ? 'Son en attente' : 'Toucher pour passer'}
      </div>
    </div>
  );
}
