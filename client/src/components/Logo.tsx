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

// N'IMPORTE QUELLE image posée dans `client/src/assets/brand/` fait le logo :
// pas besoin de renommer quoi que ce soit, « LOGO 2 (1).jpg » marche tel quel.
const found = import.meta.glob('../assets/brand/*.{png,webp,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Départage s'il y a plusieurs images : un nom qui contient « logo » d'abord,
// puis les formats détourables (png/webp) avant le reste.
const FORMATS = ['.png', '.webp', '.svg', '.jpg', '.jpeg'];
function score(path: string): number {
  const name = path.toLowerCase();
  const fmt = FORMATS.findIndex((e) => name.endsWith(e));
  return (name.includes('logo') ? 0 : 100) + (fmt < 0 ? 50 : fmt);
}

export const LOGO_URL: string | null =
  Object.entries(found).sort(([a], [b]) => score(a) - score(b) || a.localeCompare(b))[0]?.[1] ?? null;

/**
 * Encombrement de chaque emplacement, repris des anciens titres.
 *
 * On impose une **hauteur** et on laisse la largeur libre (`w-auto`) : le ratio
 * de l'image est donc toujours respecté, quelle que soit sa forme. L'écran de
 * chargement, lui, se contente de bornes : l'image prend sa taille naturelle
 * sans jamais déborder.
 */
const SIZES = {
  /** Barre de jeu, en haut du plateau (ex-`text-lg sm:text-2xl`). */
  bar: { box: 'h-6 w-auto sm:h-9', text: 'text-lg sm:text-2xl' },
  /** Titre du salon (ex-`text-5xl`). */
  title: { box: 'h-14 w-auto sm:h-20', text: 'text-4xl sm:text-5xl' },
  /** Titre de l'accueil (ex-`text-7xl`). */
  hero: { box: 'h-20 w-auto sm:h-28', text: 'text-6xl sm:text-7xl' },
  /**
   * Écran de chargement : on remplit la boîte du parent et `object-contain` se
   * charge du ratio (le logo est centré, jamais déformé ni rogné).
   */
  fill: { box: 'h-full w-full', text: 'text-6xl sm:text-8xl' },
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
        className={`${s.box} max-w-full select-none object-contain ${className}`}
      />
    );
  }

  // Logo typographique de secours : contour épais à l'encre et dégradé doré,
  // pour que ça se lise comme une marque et pas comme un titre oublié.
  return (
    <span
      aria-hidden={decorative || undefined}
      style={{
        color: '#f2c14e',
        textShadow:
          '0.045em 0.045em 0 #14110c, -0.03em -0.03em 0 #14110c, 0.03em -0.03em 0 #14110c, -0.03em 0.03em 0 #14110c, 0 0.09em 0.05em rgba(0,0,0,0.45)',
      }}
      className={`inline-block -rotate-2 select-none font-display leading-none tracking-wide ${s.text} ${className}`}
    >
      BOLOSS
    </span>
  );
}
