# BOLOSS — Points de règles à arbitrer

Document de travail à relire **avec le game designer**. Il liste ce que le
moteur applique aujourd'hui, les endroits où le code a dû **interpréter** une
carte, et les questions qui restent ouvertes.

> Établi sur la branche `claude/new-session-rzbep2`, catalogue de **70 cartes**.
> Chaque point renvoie au fichier concerné pour que la correction soit rapide
> une fois la décision prise.

**Comment lire les statuts :**

| | Signification |
|---|---|
| 🔴 **À trancher** | Le code a pris une décision par défaut pour que le jeu tourne. Elle peut être fausse. |
| 🟠 **Interprété** | Le texte de la carte est ambigu ; voici la lecture retenue, à confirmer. |
| ⚪ **Pour info** | Choix assumé ou limite technique, signalé pour éviter la surprise. |

---

## 1. Le point le plus important : les decks de faction ne sont pas comparables

Les decks sont construits automatiquement à partir du pool de la faction, avec
**2 exemplaires maximum par carte** (1 seul pour les rangs S et F). Comme les
pools n'ont pas la même taille, les decks non plus — et leur composition est
radicalement différente.

| Faction | Cartes uniques | Taille du deck | Créatures | Objets | Actes | % créatures |
|---|---|---|---|---|---|---|
| Avocat du Diable | 15 | 28 | 8 | 4 | 16 | **29 %** |
| Tyrannie Florale | 14 | 28 | 22 | 4 | 2 | 79 % |
| La Ferme de Jules | 15 | 29 | 16 | 11 | 2 | 55 % |
| **Monster Hunter** | **10** | **20** | **20** | **0** | **0** | **100 %** |
| Soldat Rouge | 15 | 30 | 12 | 12 | 6 | 40 % |

🔴 **À trancher — trois problèmes distincts :**

1. **Monster Hunter n'a que 20 cartes** contre 30 pour Soldat Rouge. À pioche
   égale (2 par tour), il tombe en panne de deck bien plus tôt. Faut-il
   compléter le pool, autoriser 3 exemplaires pour cette faction, ou aligner
   tout le monde sur 20 ?
2. **Monster Hunter n'a aucun objet ni aucun acte** : pas d'équipement, pas de
   retrait, pas de soin. Voulu ?
3. **L'Avocat du Diable n'a que 3 invocations « simples »** (le héros, Idée de
   Merde, Idée Bienveillante), soit 6 cartes sur 28. Comme le HÉROS doit être
   choisi parmi elles et que le plateau se remplit d'invocations, la faction
   peut se retrouver sans rien à poser. Ses 16 actes ne compensent pas.

*Fichier : `shared/src/deck.ts` (`buildDeck`, `maxCopiesOf`).*

---

## 2. Les limites générales appliquées aujourd'hui

| Règle | Valeur appliquée | Statut |
|---|---|---|
| Main de départ | 10 cartes | ⚪ PRD |
| Main maximum | 10 cartes | ⚪ PRD |
| Pioche par tour | 2 cartes | ⚪ PRD |
| Plateau | 1 HÉROS + 4 invocations | ⚪ PRD |
| Deck personnalisé | 20 à 30 cartes, 2 exemplaires max (1 pour S et F) | 🔴 §2.1 |
| Main pleine à la pioche | La carte **reste sur le deck**, rien n'est défaussé | 🔴 §2.2 |
| Deck vide | On ne pioche plus, **aucune pénalité** | 🔴 §2.3 |
| Mal d'invocation | S'applique aussi au HÉROS et aux poses de mise en place | ⚪ tranché |
| Provocation globale | Le HÉROS est intouchable tant qu'il reste **une seule** invocation adverse | ⚪ tranché |
| Premier joueur | Tiré à pile ou face, et il **pioche dès son 1er tour** | 🔴 §2.4 |

### 2.1 🔴 Limite d'exemplaires

2 exemplaires max, 1 pour les rangs S et F. Les rangs S sont les deux finishers
de l'Avocat, le rang F est *Idée pour Contrer l'Ennui*. Rien n'a été dit sur les
rangs A : faut-il aussi les limiter à 1 ?

### 2.2 🔴 Main pleine

**Corrigé pendant ce playtest.** Avant, la carte piochée en trop partait au
cimetière : comme la main d'ouverture est déjà à 10, le joueur perdait une carte
**dès son premier tour** sans avoir rien fait. Désormais elle reste sur le deck.

La vraie question est en amont : **main de 10 + pioche de 2 = main structurellement
pleine**. Trois sorties possibles, à choisir :
- garder la pioche bloquée quand la main est pleine (choix actuel) ;
- monter la main maximum (12 ?) ;
- baisser la main d'ouverture (7-8) pour laisser de la place.

### 2.3 🔴 Fin de deck

Aucune règle de *fatigue*. Un joueur à court de cartes continue de jouer
indéfiniment avec son plateau. Avec Monster Hunter (20 cartes) c'est atteint
vers le tour 6-7. Faut-il des dégâts de fatigue, une défaite, ou rien ?

### 2.4 🔴 Avantage du premier joueur

Le premier joueur pioche 2 cartes dès son premier tour, sans compensation. Dans
la plupart des jeux du genre, le second joueur reçoit un dédommagement.

---

## 3. Cartes dont la logique a dû être interprétée

### 3.1 🟠 Contract de Fourberie — *tranché pendant ce playtest, à confirmer*

> « Équipe sur une invocation adverse pour qu'elle **se blesse lui même** pendant 3 tours »

La carte ne donne aucun chiffre. Lecture retenue (celle demandée en playtest) :
la cible **s'inflige sa propre attaque** à chaque début de son tour, pendant
3 tours. La valeur est relue à chaque fois, donc une cible boostée se fait plus
mal. À confirmer : est-ce bien l'attaque **courante** (avec les buffs) ou
l'attaque **de base** de la carte ?

### 3.2 🟠 Envie — *tranché pendant ce playtest, à confirmer*

> « Renvoie une de tes invocations dans ta main et pose une invocation de ta main à sa place »

La carte est maintenant **injouable** s'il n'y a pas d'invocation en main pour
prendre la place (sinon elle n'avait que son inconvénient). Restent deux
questions :
- **le joueur ne choisit pas** l'invocation qui arrive : le code prend la
  première de la main. Faut-il un vrai choix ?
- l'invocation qui arrive est-elle **fraîchement invoquée** (mal d'invocation) ?
  Aujourd'hui **oui**.

### 3.3 🔴 Les objets « Consomme le »

*Poulet Sauce Maroille* (+60 PV) et *Le Roi du Burger* (+10 PV) disent
« Consomme le ». Le code les traite comme des **équipements permanents** qui
restent attachés à la créature. Conséquence : ils peuvent être repris par
*Reboot* et comptent comme objets pour le sacrifice du *Chat*.

Si « consommer » veut dire à usage unique, il faut qu'ils partent au cimetière
en laissant seulement le bonus — ce qui change la valeur du Chat et de Reboot.

### 3.4 🔴 « Sacrifie **toutes** les X » implémenté comme un nombre fixe

| Carte | Texte de la carte | Codé aujourd'hui |
|---|---|---|
| Chevalier de Mousses | « Sacrifie toutes les fleurs de rang C » | exactement **4** florales rang C |
| Monstres des Abysses | « Sacrifie tous les monstres de rang C (4) » | exactement **4** monstres rang C |
| Chevalier de Cuivre Tout Nu | « Sacrifie tous les équipements de cuivre » | exactement **2** objets tagués cuivre |

« Toutes » et un compte fixe ne veulent pas dire la même chose : avec 3 fleurs
en jeu, la carte est-elle injouable (choix actuel) ou jouable en sacrifiant les
3 ? Le « (4) » des Abysses laisse penser que le nombre fixe est voulu, mais le
Chevalier de Cuivre n'a pas ce garde-fou.

### 3.5 🔴 Les deux finishers rang S

*Véritable Avocat du Diable* et *Véritable Ange de la Raison* demandent tous
deux **les 7 péchés joués**. Une fois les 7 joués, les deux sont débloqués et
peuvent être invoqués **dans la même partie**. Voulu, ou un seul des deux ?

Leur passif *Copie d'attaque* prend l'attaque de l'adversaire le plus fort **si
elle est supérieure** à la leur (110). C'est une lecture : « copie » pourrait
aussi vouloir dire remplacer dans tous les cas.

### 3.6 🔴 Coup de Pression

> « Une invocation de rang C peut attaquer une 2e fois ce tour, mais subit 30 dégâts »

Les 30 dégâts sont infligés **immédiatement**, avant la seconde attaque. Elle
peut donc mourir sans jamais frapper (beaucoup de rangs C ont 30 ou 40 PV).
Faut-il plutôt les infliger **après** la seconde attaque ?

### 3.7 🔴 Luxure

> « Vole un objet du deck adverse »

Le code prend le **premier objet trouvé** dans le deck adverse, sans choix ni
aléatoire. Faut-il un tirage au sort, ou laisser choisir ?
Même remarque pour **Avarice** dans son propre deck.

### 3.8 ⚪ Poulet Feuilleté — 0 attaque

30 PV, **0 attaque**, Provocation. Comme le moteur interdit d'attaquer avec 0
d'attaque, c'est un mur pur qui ne frappera jamais. Cohérent avec la carte, mais
signalé au cas où le 0 serait une coquille.

### 3.9 ⚪ Dévoreur de Papillons — carte-conséquence

20 PV / 80 attaque, avec *Charge*. Il **n'existe pas dans les decks** et
n'apparaît qu'à la mort de la *Fleure Royale avec un Flingue*. Le deck builder
le refuse. C'est la seule carte dans ce cas — **s'il y en a d'autres, il faut le
dire**, la question était restée ouverte au playtest précédent.

### 3.10 🔴 Ce que « pendant N tours » veut dire

Un buff posé sur **ta** créature est décompté à la fin de **ton** tour. Donc :

- *Grenade de la Révolution* « +80 attaque pendant 1 tour » ne dure que le tour
  où elle est jouée : elle a disparu avant ton tour suivant.
- *Faux de la Mort du Fermier* (+60, 1 tour) : pareil.
- *Armure / Arme de Cuivres* (3 tours) : couvrent 3 de tes tours.
- *Revolver Violet* : **6 tours**, ce qui est très long comparé au reste — à
  vérifier, c'est peut-être une coquille pour 6 d'attaque.

À l'inverse, un malus posé sur l'**adversaire** (*Paresse*, *Tiramisu*,
*Fourberie*) est décompté à la fin du tour **de l'adversaire**, donc il couvre
bien son prochain tour complet. C'est cohérent, mais les deux cas se lisent
« 1 tour » sur la carte.

### 3.11 ⚪ Équipements sur le HÉROS

Tous les objets « allié » peuvent être posés sur le HÉROS aussi bien que sur une
invocation. Rien ne l'interdit dans les textes ; signalé parce que ça rend le
HÉROS très solide (ex. Bandana +40 PV puis Armure +50 PV).

### 3.12 ⚪ Le HÉROS est une invocation comme une autre

Le HÉROS est choisi dans la main au début de la partie : ses PV et son attaque
sont ceux de la carte. Un **deuxième exemplaire de la même carte** peut donc se
retrouver sur le plateau — c'est normal, ce sont deux cartes différentes. Seul
le HÉROS fait perdre la partie s'il tombe.

---

## 4. Ce qui est volontairement du décor

Chaque invocation porte un **nom d'attaque**, une **description** et un
**chiffre**. La description est du texte d'ambiance, le chiffre est les dégâts.
Vérifié sur les visuels : *« influence l'adversaire à se blesser lui même »*
(Idée de Merde), *« crée une tornade qui terrasse son adversaire »* (Coureur
Fou), *« tape dans tous les sens »* (Fleur So Sauvage) sont des formules, pas
des règles.

⚠️ **Attention au piège** : la même formule « se blesse lui-même » est du décor
sur une invocation et une **vraie règle** sur *Contract de Fourberie* (§3.1),
parce qu'elle y figure dans le bloc d'effet d'un OBJET. Si l'intention était que
ces invocations aient aussi un effet, il faut le dire.

Les seules invocations qui portent une **vraie** règle sont celles dont le texte
nomme un mot-clé : Provocation (Fleur Tankeuse, Poulet Feuilleté), Monarchie
Florale (Roi Roso, Reine Rosy), Karma Floral (Fleure Royale avec un Flingue),
Appel de la Révolution (Rebelle Révolutionnaire), Culture de l'Aura (Chevalier
de Cuivre), Libération (Dévoreur de Papillons), Manipulation du Diable et
Omnipotence Divine (les deux rangs S).

---

## 5. Points tranchés pendant ce playtest

Pour mémoire, au cas où une décision serait à revoir :

| Point | Décision appliquée |
|---|---|
| Fourberie de Satan | Dégâts = attaque de la cible, plus 10 forfaitaires |
| Envie sans invocation en main | Carte injouable |
| Défausse à main pleine | Supprimée : la carte reste sur le deck |
| Reboot / Luxure / Avarice à main pleine | L'action est refusée, la carte n'est jamais détruite |
| Héros ciblable derrière ses invocations | Le client applique enfin la provocation globale |
| Actes sans cible | Demandent une confirmation (« Jouer X ? ») ; poser une invocation reste immédiat |
| Mal d'invocation du HÉROS | Il dort son 1er tour, comme une invocation posée de la main |

---

## 6. Questions hors cartes

- **Mulligan** : le code pioche les remplaçantes **avant** de remettre les
  cartes rendues dans le deck, donc on ne peut pas retomber sur la même carte.
  Hearthstone fait l'inverse. À confirmer.
- **Le mulligan garantit** qu'il reste au moins une invocation simple en main,
  sinon le joueur ne pourrait pas désigner de HÉROS. Filet de sécurité, pas une
  règle : à valider.
- **Reconnexion** : un joueur qui recharge la page retrouve sa partie
  (jeton en `localStorage`). Aucune limite de temps, aucun abandon automatique.
- **Aucun timer de tour** : une partie peut rester bloquée indéfiniment.
