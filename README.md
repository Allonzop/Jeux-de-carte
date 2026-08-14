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

## 🚀 Démarrage

Pré-requis : **Node 18+** (testé sur Node 22).

```bash
npm install          # installe les 3 workspaces
npm run dev          # build shared, puis lance server (:3001) + client (:5173)
```

Ouvre <http://localhost:5173>, clique sur **Créer une partie**, copie le lien et
ouvre-le dans un **second onglet / navigateur** pour incarner le second joueur.

### Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Développement (hot-reload des 3 packages) |
| `npm run build` | Build de production (shared → server → client) |
| `npm start` | Lance le serveur, qui sert aussi le client buildé |
| `npm run typecheck` | Vérifie les types sur tout le monorepo |

En production, le serveur sert le client compilé : un seul service sur `PORT`
(défaut 3001). Le client détecte automatiquement l'URL du serveur ; pour un
déploiement séparé, définir `VITE_SERVER_URL` au build du client.

---

## 📜 Règles implémentées (PRD §2)

- **But** : réduire les HP du HÉRO adverse à 0.
- **Pas de mana** : les actions sont illimitées tant que les conditions sont remplies.
- **Main** : 10 cartes max, l'excédent piochage est défaussé.
- **Plateau** : 1 HÉRO + 4 invocations max.
- **Tour** : Début (pioche 2, effets de début) → Phase Principale → Phase de Combat → Fin (nettoyage des buffs temporaires).
- **Mal d'invocation** : une invocation ne peut pas attaquer le tour où elle est posée (sauf *Charge*).
- **Ciblage libre** : on peut attaquer une invocation OU le HÉRO — sauf en présence d'une *Provocation*.
- **Destruction** : à 0 HP, la carte part au cimetière (déclenche les effets à la mort).

### Écarts assumés pour le MVP

- **Main d'ouverture de 7 cartes** (au lieu de 10) : le PRD prévoit une pose
  face cachée en setup ; comme cette phase n'est pas implémentée, ouvrir à 10
  forcerait une défausse immédiate. Voir `shared/src/constants.ts`.
- Quelques effets très spécifiques (copie d'attaque adverse, échanges de cartes
  entre decks) sont simplifiés ou marqués « collector » — commentés dans
  `shared/src/cards.ts`.

---

## 🗺️ Suite (jalons futurs)

- Phase de setup face cachée (pose simultanée HÉRO + invocations).
- Deck-building personnalisé (au lieu des decks de faction auto-générés).
- Effets exotiques restants + animations de combat.
- Persistance des parties / spectateurs / reconnexion longue durée.
