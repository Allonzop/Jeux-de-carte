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
- **Setup** : pioche de **10 cartes**, puis pose du HÉRO et de 0 à 4 invocations
  **face cachée**, puis révélation du plateau (pile ou face pour le 1er joueur).
- **Main** : 10 cartes max, l'excédent de pioche est défaussé.
- **Plateau** : 1 HÉRO + 4 invocations max.
- **Tour** : Début (pioche 2, effets de début) → Phase Principale → Phase de Combat → Fin (nettoyage des buffs temporaires).
- **Mal d'invocation** : une invocation ne peut pas attaquer le tour où elle est posée (sauf *Charge* ; les invocations de setup peuvent attaquer dès le 1er tour).
- **Ciblage libre** : on peut attaquer une invocation OU le HÉRO — sauf en présence d'une *Provocation*.
- **Destruction** : à 0 HP, la carte part au cimetière (déclenche les effets à la mort).

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

## 🗺️ Suite (jalons futurs)

- Deck-building personnalisé (au lieu des decks de faction auto-générés).
- Effets de combat plus riches (animations d'attaque, sons).
- Persistance des parties / spectateurs / reconnexion longue durée.
