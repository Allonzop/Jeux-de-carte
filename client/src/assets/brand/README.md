# Assets de marque

## Le logo BOLOSS

**Dépose simplement le fichier image dans ce dossier.** Pas besoin de le
renommer : `LOGO 2 (1).jpg` fonctionne tel quel.

```
client/src/assets/brand/LOGO 2 (1).jpg     ← ça suffit
```

Il est ensuite repris **automatiquement partout** dans l'interface (accueil,
salon, barre de jeu, écran de chargement) : le composant `Logo` détecte au build
(`import.meta.glob`) n'importe quel `.png` / `.webp` / `.jpg` / `.jpeg` / `.svg`
posé ici. Aucun code à toucher.

S'il y a plusieurs images dans le dossier, celle dont le nom contient « logo »
gagne, et à défaut le format le plus propre (`png` avant `jpg`).

Tant qu'aucun fichier n'est présent, l'interface affiche un **logo typographique
de secours** — rien ne casse.

### Recommandations sur le fichier

- **Fond transparent** (PNG ou WebP) : le logo est posé sur des fonds sombres.
  Un JPG fonctionne, mais son fond blanc/uni restera visible.
- **Format paysage**, ~1200 px de large minimum : il est affiché jusqu'à 70 %
  de la largeur de l'écran sur l'écran de chargement.
- Le **ratio est préservé automatiquement** (`object-contain`) : seule la
  hauteur est imposée par l'emplacement, la largeur suit.

## `intro.mp3` — la musique de l'écran de chargement

6,024 s (251 frames MPEG-1 Layer III, 48 kHz). L'animation du logo est calée sur
sa durée réelle, lue au chargement (`audio.duration`) : si tu remplaces le
fichier par un autre extrait, **l'animation se recale toute seule** et l'impact
final du rebond retombera sur la dernière note.
