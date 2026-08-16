# Assets de marque

## `logo.*` — le logo BOLOSS

Dépose ici le fichier du logo sous le nom **`logo.jpg`** (ou `.png`, `.webp`,
`.svg` — le premier format trouvé gagne, dans cet ordre : `png`, `webp`, `jpg`,
`jpeg`, `svg`).

```
client/src/assets/brand/logo.png   ← ton fichier « LOGO 2 (1).jpg » renommé
```

Il est ensuite repris **automatiquement partout** dans l'interface (accueil,
salon, barre de jeu, écran de chargement) : le composant `Logo` le détecte au
build via `import.meta.glob`, pas besoin de toucher au code.

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
