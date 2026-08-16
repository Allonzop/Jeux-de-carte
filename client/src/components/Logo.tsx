/**
 * Le logo BOLOSS, à la place du mot écrit en dur un peu partout dans l'UI.
 *
 * L'image est résolue **au build** : dépose simplement un fichier
 * `client/src/assets/brand/logo.png` (ou .webp/.jpg/.svg) et il est repris
 * partout, sans toucher au code. Tant qu'il n'y en a pas, on retombe sur un
 * logo typographique — l'interface reste correcte.
 *
 * Le dimensionnement est piloté par le conteneur : le parent impose une
 * **hauteur**, l'image garde son ratio (`object-contain`, `w-auto`) et occupe
 * exactement la place que prenait l'ancien texte.
 */

// Un seul format est censé être présent ; l'ordre départage si jamais il y en a
// plusieurs (raster détouré d'abord, vectoriel en dernier).
const PRIORITY = ['.png', '.webp', '.jpg', '.jpeg', '.svg'];

const found = import.meta.glob('../assets/brand/logo.{png,webp,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const LOGO_URL: string | null =
  Object.entries(found).sort(
    ([a], [b]) =>
      PRIORITY.findIndex((e) => a.endsWith(e)) - PRIORITY.findIndex((e) => b.endsWith(e)),
  )[0]?.[1] ?? null;

/** Hauteurs pensées pour reprendre l'encombrement des anciens titres. */
const SIZES = {
  /** Barre de jeu, en haut du plateau (ex-`text-lg sm:text-2xl`). */
  bar: { box: 'h-6 sm:h-9', text: 'text-lg sm:text-2xl' },
  /** Titre du salon (ex-`text-5xl`). */
  title: { box: 'h-14 sm:h-20', text: 'text-4xl sm:text-5xl' },
  /** Titre de l'accueil (ex-`text-7xl`). */
  hero: { box: 'h-20 sm:h-28', text: 'text-6xl sm:text-7xl' },
  /** Écran de chargement : le conteneur décide, on remplit. */
  fill: { box: 'h-full w-full', text: 'text-7xl sm:text-8xl' },
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
  /** Rendu décoratif : l'écran de chargement porte déjà le nom du jeu. */
  decorative?: boolean;
}

export default function Logo({ size = 'title', className = '', decorative }: Props) {
  const s = SIZES[size];

  if (LOGO_URL) {
    return (
      <img
        src={LOGO_URL}
        alt={decorative ? '' : 'BOLOSS'}
        aria-hidden={decorative || undefined}
        draggable={false}
        // `object-contain` = ratio préservé quoi qu'impose le parent.
        className={`${s.box} w-auto max-w-full select-none object-contain ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`inline-block select-none font-display leading-none tracking-wide text-boloss-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.45)] ${s.text} ${className}`}
    >
      BOLOSS
    </span>
  );
}
