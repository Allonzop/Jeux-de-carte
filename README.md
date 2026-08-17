# 🃏 BOLOSS — Jeu de cartes web 1v1 (MVP)

BOLOSS est un jeu de cartes à collectionner **1 contre 1**, jouable dans le
navigateur, **sans création de compte** : un joueur crée une partie, obtient un
lien unique, l'envoie à son adversaire, et le duel commence.

Ce dépôt implémente le **Milestone 1** du PRD : architecture full-stack,
matchmaking par lien, moteur d'état **server-authoritative**, combat + modificateurs,
et l'intégration de mécaniques complexes (sacrifices, buffs temporaires,
triggers à la mort, buffs par tour).

---

## 🏗️ Architecture

Monorepo npm workspaces, 100 % TypeScript strict :

```
shared/   → @boloss/shared : types du Game State, catalogue des 71 cartes,
            moteur de règles (event-driven, requirement engine, modificateurs).
            Isomorphe : partagé par le serveur ET le client.
server/   → @boloss/server : Node + Express + Socket.io. L'état du jeu est
            validé et muté UNIQUEMENT côté serveur (anti-triche). Gestion des
            "rooms" en mémoire, reconnexion par token.
client/   → @boloss/client : React + Vite + TypeScript + Tailwind + Zustand.
            Plateau de jeu, drag/flèche de ciblage, main cachée, journal.
```

### Le moteur (`shared/src/engine.ts`)

- **Server-authoritative** : chaque action client (`PLAY_CARD`, `ATTACK`,
  `NEXT_PHASE`, `END_TURN`) est revalidée côté serveur. Le client reçoit une vue
  *redacted* (la main adverse est masquée).
- **State machine** : tours, phases (Principale → Combat), pioche, ciblage libre.
- **Modificateurs** : chaque carte distingue `base` / stats courantes. Les buffs
  ont une `valeur` et une `durée` (n tours ou permanent). Les buffs temporaires
  sont nettoyés en fin de tour, le poison tique en début de tour.
- **Passifs** lus directement depuis la définition de carte : Provocation
  (taunt), Charge, Aura, Gain d'attaque par tour.
- **Requirement engine** (`evaluateConditions`) : vérifie les sacrifices requis
  avant d'autoriser une invocation.

---

## 🎴 Contenu

**71 cartes** transcrites depuis `carte.zip`, réparties en **5 factions** :

| Faction | Thème | Mécanique signature |
|---|---|---|
| **Avocat du Diable** | 7 péchés capitaux | Jouer les 7 péchés débloque 2 finishers rang S |
| **Tyrannie Florale** | Rois & chevaliers floraux | Auras de meute, provocations, invocation à la mort |
| **La Ferme de Jules** | Fermiers & gros équipements | Frappes AoE, gros buffs d'attaque |
| **Monster Hunter** | Bêtes & esprits | Sacrifices pour invoquer des colosses |
| **Soldat Rouge** | Révolution rouge | Rebelles increvables, équipements de cuivre |

### Les 4 cartes complexes du Milestone 1

- **Loup des Ténèbres** (Monster Hunter) — invocation par **sacrifice** de 2 Esprits Bouffis.
- **Grenade de la Révolution** (Soldat Rouge) — **buff temporaire** +80 attaque pendant 1 tour.
- **Rebelle Révolutionnaire** (Soldat Rouge) — **trigger à la mort** : un autre Rebelle sort du deck pour le remplacer.
- **Chevalier de Cuivre Tout Nu** (Soldat Rouge) — **buff par tour** « Culture de l'Aura » : +10 attaque à chaque début de tour.

---

## 🚀 Démarrage (développement)

Pré-requis : **Node 18+** (testé sur Node 22). Vérifie avec `node --version`.

> ⚠️ **`npm install` est obligatoire avant tout.** Un repo téléchargé (zip GitHub)
> ne contient pas `node_modules` : sans installation, `tsc`/`tsx` seront
> « non reconnus ».

```bash
npm install          # 1) installe les 3 workspaces (obligatoire, ~1 min)
npm run dev          # 2) build shared, puis lance server (:3001) + client (:5173)
```

Ouvre <http://localhost:5173>, clique sur **Créer une partie**, copie le lien et
ouvre-le dans un **second onglet / navigateur** pour incarner le second joueur.

### 🪟 Windows / PowerShell

PowerShell (l'ancien, celui par défaut) **ne comprend pas `&&`**. Tape les
commandes **une par une**, chacune suivie de Entrée :

```powershell
npm install
npm run build
npm start
```

Puis ouvre <http://localhost:3001>. Pour arrêter : `Ctrl + C`.

### Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Développement (hot-reload des 3 packages) |
| `npm run build` | Build de production (shared → server → client) |
| `npm start` | Lance le serveur, qui sert aussi le client buildé |
| `npm run typecheck` | Vérifie les types sur tout le monorepo |

---

## 🌐 Jouer sur 2 machines différentes

Le client compilé est servi par le serveur : **un seul service** sur `PORT`
(défaut 3001), et le client se connecte automatiquement à la même origine.
Trois façons de tester à deux, de la plus simple à la plus durable :

### Option 1 — Réseau local (le plus rapide, gratuit)

Sur ta machine (sous Windows PowerShell, tape-les une par une) :

```bash
npm install
npm run build
npm start
```

Trouve ton IP locale (`ipconfig` sur Windows, `ip a` / `ifconfig` sur Mac/Linux),
puis sur **l'autre appareil du même réseau Wi-Fi**, ouvre `http://TON_IP:3001`
(ex: `http://192.168.1.42:3001`). Crée une partie, partage le lien : vous jouez
chacun sur votre machine.

### Option 2 — Hébergement gratuit Render (URL publique, jouable partout)

1. Pousse ce repo sur GitHub (déjà fait sur ta branche).
2. Sur [Render](https://render.com) : **New → Blueprint**, connecte le repo.
   Render lit `render.yaml`, build et te donne une URL publique
   (ex: `https://boloss.onrender.com`) — WebSockets supportés.
3. Ouvre l'URL sur 2 appareils quelconques (même hors de ton réseau).

> Le plan gratuit s'endort après inactivité : le 1er chargement peut prendre
> ~30 s, ensuite c'est fluide.

### Option 3 — VPS / Docker (contrôle total)

Un `Dockerfile` est fourni :

```bash
docker build -t boloss .
docker run -p 3001:3001 boloss     # puis ouvre http://IP_DU_VPS:3001
```

Fonctionne sur n'importe quel VPS (Hetzner, DigitalOcean, Scaleway…) ou toute
plateforme qui accepte un conteneur (Railway, Fly.io, etc.). Règle `PORT` via
variable d'environnement si besoin.

> Pour un client hébergé séparément du serveur, définir `VITE_SERVER_URL` au
> build du client.

---

## 📜 Règles implémentées (PRD §2)

- **But** : réduire les HP du HÉRO adverse à 0.
- **Pas de mana** : les actions sont illimitées tant que les conditions sont remplies.
- **Deck** : soit un **deck de faction** prêt à jouer, soit un **deck personnalisé**
  mélangeant les cartes de toutes les factions (20 à 30 cartes, 2 exemplaires
  max par carte — 1 seul pour les rangs S et F).
- **Setup en 3 étapes** : pioche de **10 cartes** → **mulligan** (renvoyer tout ou
  partie de sa main et repiocher autant, à la Hearthstone) → **choix du HÉROS**
  (une invocation de ta main devient ton héros, avec **ses** stats) → pose de 0 à
  4 invocations **face cachée**, puis révélation du plateau.
- **Main** : 10 cartes max, l'excédent de pioche est défaussé.
- **Plateau** : 1 HÉRO + 4 invocations max.
- **Tour** : Début (pioche 2, effets de début) → Phase Principale → Phase de Combat → Fin (nettoyage des buffs temporaires).
- **Mal d'invocation** : une invocation ne peut pas attaquer le tour où elle est
  posée (sauf *Charge*). Cela vaut aussi pour **le HÉROS et les invocations
  posées en mise en place** : comme ils arrivent depuis la main, ils dorment
  pendant tout le 1er tour de leur propriétaire et ne peuvent frapper qu'à son 2ᵉ tour.
- **Provocation globale** : le HÉRO est **intouchable tant qu'il reste une seule
  invocation adverse** sur le plateau. Il faut nettoyer le terrain d'abord. Une
  carte avec le mot-clé *Provocation* reste prioritaire sur les autres invocations.
- **Destruction** : à 0 HP, la carte part au cimetière (déclenche les effets à la mort).
- **Cartes-conséquences** : certaines cartes n'existent pas dans les decks et
  n'apparaissent que via un effet — le **Dévoreur de Papillons** (20 PV / 80 ATK)
  ne surgit qu'à la mort de la *Fleure Royale avec un Flingue*. Elles sont
  marquées `token` dans `shared/src/cards.ts` et sont refusées par le deck builder.

### Toutes les cartes sont fonctionnelles

Les 71 cartes ont un effet réel, y compris les cartes bespoke : les 7 péchés
capitaux (Gourmandise/Colère doublent les bonus des objets, Luxure/Avarice
cherchent un objet, Envie échange une invocation, Paresse/Orgueil bloquent
l'attaque), la copie d'attaque des finishers rang S (Manipulation du Diable /
Omnipotence Divine), Coup de Pression (2e attaque contre 30 PV), Dios Mios
(destruction), Reboot (déséquipement), Contract Révolutionnaire (prise de
contrôle). Voir `shared/src/engine.ts`. Seule la carte-blague rang F
(*Idée pour Contrer l'Ennui*) a un effet volontairement mineur (pioche 1).

---

## 🎨 Identité visuelle

### Le logo

Le mot « BOLOSS » n'est plus écrit en dur nulle part : tous les emplacements
(accueil, salon, barre de jeu, écran de chargement) passent par le composant
[`client/src/components/Logo.tsx`](client/src/components/Logo.tsx).

**Pour mettre ton logo :** dépose le fichier image dans ce dossier —

```
client/src/assets/brand/       ← n'importe quel .png / .webp / .jpg / .svg
```

…et c'est tout, **sans le renommer** : `LOGO 2 (1).jpg` est repris tel quel. Le
composant détecte le fichier **au build** (`import.meta.glob`), il apparaît
partout, et le **ratio est préservé** : chaque emplacement impose une hauteur,
la largeur suit (`object-contain`). Tant qu'aucun fichier n'est présent, un logo
typographique de secours prend le relais — rien ne casse. Voir
[`client/src/assets/brand/README.md`](client/src/assets/brand/README.md) pour
les recommandations (fond transparent, format paysage).

> Le plus simple si tu n'as pas le repo en local : sur GitHub, ouvre le dossier
> `client/src/assets/brand/` sur la branche, puis **Add file → Upload files**.

### L'écran de chargement

Au premier chargement d'un onglet, un overlay noir présente le logo :
apparition en fondu, montée en tension, puis **un rebond marqué
(`Ease.OutBounce`) dont le dernier impact tombe exactement sur la fin du
morceau** `client/src/assets/brand/intro.mp3` — flash blanc, onde de choc et
secousse d'écran à chaque contact.

La synchronisation n'est pas codée en dur : la chronologie est **calée sur
`audio.duration`** et l'animation est pilotée par `audio.currentTime`. Si la
lecture démarre en retard, c'est l'image qui se recale sur le son. Remplace le
MP3 par un autre extrait et l'animation s'ajuste toute seule.

Détails : l'intro ne se joue **qu'une fois par session** (onglet), se passe d'un
clic / d'une touche, propose un bouton 🔇 mémorisé, et est **entièrement
désactivée** si le système demande `prefers-reduced-motion`. Si le navigateur
refuse la lecture audio automatique (politique d'autoplay), l'écran propose
« ▶ touche l'écran » puis démarre en silence après 4 s.

### Animations de jeu

Purement cosmétiques — le moteur et les définitions de cartes ne changent pas.
Tout passe par des keyframes CSS déclarées dans `client/tailwind.config.js`, et
les évènements sont déduits en comparant deux états successifs du serveur
([`client/src/lib/fx.ts`](client/src/lib/fx.ts)).

| Moment | Effet |
|---|---|
| **Pioche** | Les cartes sont distribuées une par une, en arrivant par le bas |
| **Pose sur le plateau** | La carte s'écrase depuis le haut, avec un éclair doré à l'impact |
| **Attaque** | L'attaquant recule puis charge vers l'adversaire |
| **Dégâts** | La cible tremble, le chiffre de dégâts s'envole |
| **Destruction** | La carte blanchit et se dissipe **à l'endroit exact** où elle était |
| **Changement de tour** | Bandeau « À TOI DE JOUER » qui balaie l'écran |

## 👁️ Lisibilité en jeu

- **Zoom d'inspection** (façon Hearthstone) : survol de la souris ~0,5 s sur
  desktop, **appui long** ~0,4 s sur mobile. Affiche la carte en grand avec son
  nom, rang, type, PV/attaque courants, son attaque et sa description. Actif
  partout : main, plateau, cimetière, deck builder.
- **Effets actifs lisibles** : pastilles d'état sur les cartes du plateau
  (🛡 provocation, ☠ poison, 💤 mal d'invocation, ⛔ bloquée, ⚔/❤ bonus),
  badges chiffrés (`+80⚔`), et section **« Effets en cours »** dans le zoom qui
  détaille chaque modificateur avec sa source et sa durée restante.
- **Mulligan clair** : les cartes à échanger sont assombries avec une croix
  rouge et un badge « ÉCHANGE » ; celles conservées gardent un liseré vert.

## 📱 Mobile & parties simultanées

- **Mobile** : interface repensée en mobile-first (cartes compactes, plateau sur
  une ligne, main défilable, boutons tactiles, pas de zoom parasite, respect de
  l'encoche). Le deck builder et la mise en place sont utilisables au doigt.
- **Parties simultanées** : le serveur gère déjà **plusieurs parties en
  parallèle** — chaque room a son propre `GameState` isolé. Validé par un test
  automatisé : 3 parties / 6 joueurs en même temps, états étanches, un 3ᵉ joueur
  sur une partie pleine est refusé. Les identifiants de cartes sont préfixés par
  la room pour rester uniques d'une partie à l'autre.

---

## 🗺️ Suite (jalons futurs)

- Sons en jeu (impact d'attaque, pioche, victoire) en plus de la musique d'intro.
- Persistance des parties / spectateurs / reconnexion longue durée.
- Sauvegarde des decks personnalisés entre les sessions.
